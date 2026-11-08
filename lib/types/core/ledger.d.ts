/**
 * The usage ledger: a pure fold from session usage facts into a per-day,
 * per-provider, per-model totals document, plus its JSON serialization.
 * Host-side state lives only in the document; the service owns persistence.
 * @module @linxin666/dsh-usage/core/ledger
 */
import { type UsageDaySummary, type UsageLedgerDocument, type UsageProviderSummary, type UsageTokenTotals, type UsageWindowSummary } from './types.ts';
/** Local-date key (`YYYY-MM-DD`) for an epoch ms timestamp. */
export declare function localDateKey(ms: number): string;
/** An empty ledger document. */
export declare function createLedgerDocument(): UsageLedgerDocument;
/**
 * Fold one usage report into the ledger in place. `provider` is the route key
 * and `model` the provider-owned model id the step ran under. Reports keyed
 * by prototype-plumbing names are dropped.
 */
export declare function foldUsage(doc: UsageLedgerDocument, atMs: number, provider: string, model: string, usage: Readonly<UsageTokenTotals>): void;
/** Total tokens of a bucket (billed input + output; reasoning is inside output). */
export declare function totalTokens(totals: Readonly<UsageTokenTotals>): number;
/** How many model rows one summarized provider keeps. */
export declare const SUMMARY_MODEL_CAP = 12;
/**
 * Aggregate whole per-day maps (each `provider -> model -> totals`) into the
 * per-provider/per-model summary the overview serves for one day or a range:
 * disjoint bucket sums per provider, per-model rows heaviest first, and the
 * grand total. Pure: reads its inputs, allocates fresh buckets.
 */
export declare function summarizeDays(days: ReadonlyArray<Record<string, Record<string, UsageTokenTotals>>>): {
    totals: UsageTokenTotals;
    providers: UsageProviderSummary[];
};
/** One provider row aggregated over a window, without its per-model detail. */
export interface UsageProviderTotalsRow {
    provider: string;
    totals: UsageTokenTotals;
}
/**
 * Aggregate whole per-day maps into per-provider totals and a grand total
 * only. Same provider ordering as `summarizeDays` (heaviest by total tokens
 * first, stable on first appearance), but no model rows are built or sorted:
 * the overview's all-time window renders provider totals only, so the
 * per-model breakdown would be dead weight that grows with retained history.
 * Pure: reads its inputs, allocates fresh buckets.
 */
export declare function summarizeProviderTotals(days: ReadonlyArray<Record<string, Record<string, UsageTokenTotals>>>): {
    totals: UsageTokenTotals;
    providers: UsageProviderTotalsRow[];
};
/**
 * One total per requested local day. The heatmap needs per-day token totals
 * for up to 182 days; walking each day's provider/model buckets once here is
 * far cheaper than running the full `summarizeDays` per day (which allocates
 * and sorts model rows the heatmap never reads). Days missing from the ledger
 * resolve to a fresh zero bucket, like `summarizeDays([{}])`.
 */
export declare function summarizeDayTotals(doc: Readonly<UsageLedgerDocument>, dayKeys: readonly string[]): Map<string, UsageTokenTotals>;
/** The window options one overview aggregation is built for. */
export interface LedgerUsageOptions {
    /** The current local day key (`YYYY-MM-DD`). */
    todayKey: string;
    /** How many trailing days the heatmap receives (retention already applied by the caller). */
    heatmapDays: number;
    /** How many trailing days the trend window aggregates. */
    rangeDays: number;
}
/**
 * Everything the overview's `usage` section needs, aggregated from one ledger
 * snapshot in one pass per window. Pure and deterministic; the host service
 * caches the result per ledger revision so a warm browser poll does not walk
 * the retained ledger again.
 */
export interface LedgerUsageSummary {
    todayKey: string;
    /** All retained day keys, ascending. */
    allKeys: string[];
    /** The trailing heatmap window (`allKeys.slice(-heatmapDays)`). */
    heatmapKeys: string[];
    /** The trailing trend window (`allKeys.slice(-rangeDays)`). */
    rangeKeys: string[];
    /** Per-day totals for the heatmap, in heatmap order. */
    days: UsageDaySummary[];
    today: {
        date: string;
        totals: UsageTokenTotals;
        providers: UsageProviderSummary[];
    };
    range: UsageWindowSummary;
    all: UsageWindowSummary;
    /** Every provider with usage in any window; the overview keeps these rows. */
    usageProviders: Set<string>;
}
/**
 * Aggregate the overview usage windows from a ledger document. The all-time
 * window skips the per-model breakdown (`models: []` rows) exactly like the
 * previous inline assembly, but without building model rows first.
 */
export declare function summarizeLedgerUsage(doc: Readonly<UsageLedgerDocument>, options: LedgerUsageOptions): LedgerUsageSummary;
/** All local-date keys in the ledger, ascending. */
export declare function ledgerDayKeys(doc: Readonly<UsageLedgerDocument>): string[];
/**
 * Drop every day older than `retainDays` local days before `todayKey`, in
 * place. Returns the number of pruned days.
 */
export declare function pruneLedger(doc: UsageLedgerDocument, todayKey: string, retainDays: number): number;
/**
 * Parse a ledger document from untrusted JSON: unknown shapes resolve to an
 * empty document, malformed entries are dropped, numbers are coerced to
 * finite values. Never throws.
 */
export declare function deserializeLedger(value: unknown): UsageLedgerDocument;
//# sourceMappingURL=ledger.d.ts.map