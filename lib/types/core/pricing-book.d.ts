/**
 * models.dev price book: normalize the public catalog into USD-per-1M-token
 * lookup rows, resolve one provider/model route to a row with an explicit
 * confidence, and estimate a window's reference spend. This is deliberately
 * separate from the DeepSeek CNY ledger cost in `pricing.ts`: the ledger keeps
 * its own currency, and this module only ever answers in USD from the public
 * catalog.
 *
 * Catalog shape (`https://models.dev/api.json`):
 * `{ [providerId]: { id, name, models: { [modelKey]: { id, name,
 * canonical_model_id?, cost?: { input, output, cache_read?, cache_write?,
 * tiers?, context_over_200k? } } } } }` — costs are USD per 1M tokens. A
 * missing or zero `cost.input`/`cost.output` means the model is not priced
 * (no row), so a free/unknown model is counted as unpriced rather than
 * silently estimated at $0. Tiered / long-context surcharge prices are
 * ignored: the row is the catalog's base price, which makes the reference
 * estimate conservative.
 *
 * Route → catalog provider aliases (`PROVIDER_ALIASES`) bridge route keys the
 * host sees onto the catalog's provider ids. An exact `${provider}/${model}`
 * row always wins; the alias list is only consulted afterwards:
 * - `deepseek-official` → `deepseek`
 * - `openai-codex`, `codex` → `openai`
 * - `github` → `github-copilot` (the catalog spells the provider id out)
 * - `vercel-ai-gateway` → `vercel`
 * - `moonshot`, `kimi-coding` → `moonshotai`, then `moonshotai-cn`
 * - `moonshotai-cn` → `moonshotai-cn`, then `moonshotai`
 * - `zai-coding` → `zai`, then `zhipuai`
 * - `zai-coding-cn` → `zhipuai`, then `zai`
 * Every other route key is looked up as-is (the catalog's own provider id).
 *
 * Resolution precedence is exact, canonical id, then short model name. A
 * canonical id prefers the route provider family's own catalog row (many
 * resellers publish the same canonical model at different prices) and a
 * canonical/short match only returns when every candidate row agrees on the
 * price, so an ambiguous alias is an honest miss instead of a guess.
 * @module @linxin666/dsh-usage/core/pricing-book
 */
import type { UsageCostEstimate, UsageTokenTotals } from './types.ts';
/** Public models.dev catalog endpoint. */
export declare const MODELS_DEV_URL = "https://models.dev/api.json";
/** Default timeout for one catalog fetch. */
export declare const MODELS_DEV_TIMEOUT_MS = 8000;
/** Price-book cache basename written by `savePriceBook`. */
export declare const PRICE_BOOK_FILENAME = "pricing-book.json";
/** How long a cached price book stays fresh (24 hours). */
export declare const PRICE_BOOK_MAX_AGE_MS: number;
/**
 * Route-key → models.dev provider id fallbacks, in precedence order. The exact
 * route key is always tried first (see the module header for the table).
 */
export declare const PROVIDER_ALIASES: Readonly<Record<string, readonly string[]>>;
/** One model price row, USD per 1M tokens. */
export interface PriceRow {
    /** Cache-miss (uncached) input. */
    miss: number;
    /** Input served from the provider prompt cache. */
    hit: number;
    /** Cache-write input; falls back to `miss` when the catalog has no separate price. */
    write: number;
    /** Output (reasoning included). */
    out: number;
}
/** Lookup tables normalized from one models.dev catalog. */
export interface PriceBookLookups {
    /** Normalized `${provider}/${model}` (lowercase) → price row. */
    rows: Record<string, PriceRow>;
    /** Short model name (after the last `/`) → row keys carrying it. */
    byShortName: Record<string, string[]>;
    /** Canonical model id (`provider/model`, lowercase) → row keys mapped to it. */
    byCanonical: Record<string, string[]>;
}
/** A normalized price book plus the fetch instant (the on-disk cache shape). */
export interface PriceBook extends PriceBookLookups {
    /** Epoch ms of the catalog fetch that produced this book. */
    fetchedAt: number;
    source: 'models.dev';
}
/** One resolved route → catalog row, with how it matched and how much to trust it. */
export interface ResolvedPrice {
    row: PriceRow;
    /** Match path: exact key, canonical model id, or short model name. */
    via: 'exact' | 'canonical' | 'short';
    /** `high` for exact keys, `medium` for canonical/short fallbacks. */
    confidence: 'high' | 'medium';
    /** Normalized row key that supplied the price (diagnostic). */
    key: string;
}
/** Minimal response shape a fetch implementation must satisfy. */
export interface FetchResponseLike {
    ok: boolean;
    json(): Promise<unknown>;
}
/** Injectable fetch: the global `fetch` satisfies this. */
export type FetchLike = (url: string, init: {
    signal?: AbortSignal;
}) => Promise<FetchResponseLike>;
/** `fetchPriceBook` options; every dependency is injectable for tests. */
export interface PriceBookFetchOptions {
    /** Fetch implementation (defaults to the global `fetch`). */
    fetchImpl?: FetchLike;
    /** Clock returning epoch ms for `fetchedAt` (defaults to `Date.now`). */
    now?: () => number;
    /** Per-fetch timeout in ms (defaults to `MODELS_DEV_TIMEOUT_MS`). */
    timeoutMs?: number;
}
/** One provider row of the usage window `estimateUsd` prices. */
export interface CostEstimateProviderRow {
    provider: string;
    totals: Readonly<UsageTokenTotals>;
    /** Per-model breakdown; absent/empty rows stay un-attributed (never guessed). */
    models?: ReadonlyArray<{
        model: string;
        totals: Readonly<UsageTokenTotals>;
    }>;
}
/** The minimal usage-window shape `estimateUsd` consumes (`UsageWindowSummary` matches it). */
export interface CostEstimateWindow {
    providers: ReadonlyArray<CostEstimateProviderRow>;
}
/** Options for `estimateUsd`. */
export interface EstimateOptions {
    /** Decimal places kept on the USD amount; default 6 (micro-USD). */
    roundDigits?: number;
}
/**
 * Normalize a models.dev catalog (untrusted JSON) into lookup tables. Unknown
 * shapes resolve to empty tables; malformed provider/model/cost entries are
 * dropped rather than thrown. Never throws.
 */
export declare function normalizeModelsDev(json: unknown): PriceBookLookups;
/**
 * Resolve one provider/model route to a catalog price. Precedence: exact
 * `${provider}/${model}`, documented provider aliases, canonical model ids,
 * then the short model name (provider-family scoped). Ambiguous canonical or
 * short candidates miss instead of pricing a possibly different model. Never
 * throws.
 */
export declare function resolvePrice(book: PriceBookLookups | undefined | null, provider: string, model: string): ResolvedPrice | undefined;
/**
 * Price one aggregated usage window against the book as a USD reference
 * estimate. Pure and defensive: malformed summaries/rows never throw; only
 * model rows with a resolved price contribute to `amount`, while every
 * provider/model/call is still counted so the priced coverage is honest.
 * Providers whose model list is missing or capped keep their un-attributed
 * calls counted as unpriced. `amount` is omitted when nothing could be priced.
 */
export declare function estimateUsd(summary: CostEstimateWindow | undefined | null, book: (PriceBookLookups & {
    fetchedAt?: number;
}) | undefined | null, options?: EstimateOptions): UsageCostEstimate;
/**
 * Fetch and normalize the models.dev catalog. Returns undefined on any
 * failure (network error, non-2xx, timeout, unparsable/non-object JSON) and
 * never throws. The injected clock stamps `fetchedAt`.
 */
export declare function fetchPriceBook(options?: PriceBookFetchOptions): Promise<PriceBook | undefined>;
/**
 * Whether a book is within `PRICE_BOOK_MAX_AGE_MS` of `now` (24h). Future
 * timestamps within the window count as fresh (clock skew tolerance); a
 * missing/invalid `fetchedAt` or non-finite `now` is never fresh.
 */
export declare function isPriceBookFresh(book: {
    fetchedAt?: unknown;
} | undefined | null, now?: number): boolean;
/**
 * Atomically write `<dir>/pricing-book.json` (temp file + fsync + rename), so
 * a crash never leaves a half-written cache. Returns false on any failure and
 * never throws.
 */
export declare function savePriceBook(dir: string, book: PriceBook): Promise<boolean>;
/**
 * Read `<dir>/pricing-book.json`. Returns undefined when the file is missing,
 * unparsable, structurally invalid, or the directory is unusable; malformed
 * rows are dropped. Never throws.
 */
export declare function loadPriceBook(dir: string): Promise<PriceBook | undefined>;
//# sourceMappingURL=pricing-book.d.ts.map