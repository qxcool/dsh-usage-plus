/**
 * The dsh-usage host service: folds live session usage into the persistent
 * ledger, probes each configured provider's balance/coding-plan endpoint on
 * a poll cycle, and announces the current provider's status to the pet
 * bubble. Secrets stay in the host process; the browser only ever sees the
 * overview document.
 * @module @linxin666/dsh-usage/host/usage-service
 */
import type { Context } from '@deepseek-ai/cordis';
import { type PriceBook } from '../core/pricing-book.ts';
import type { ExternalCredentialStatus, ExternalCredentialTarget, ProviderSnapshotState, ProviderSnapshotView, UsageDayDetail, UsageOverviewView, UsagePlatformView, UsageTokenTotals } from '../core/types.ts';
import { type LedgerExportDocument } from './export.ts';
/** Source tag the plugin stamps onto pet announcements. */
export declare const USAGE_ANNOUNCE_SOURCE = "dsh-usage-plus";
/** Poll-loop and announce options; re-applied live on settings change. */
export interface UsageServiceOptions {
    pollIntervalSec: number;
    bubbleMode: 'always' | 'change' | 'off';
    retainDays: number;
    /** Master switch for threshold alerts (payload + pet bubble). Default true. */
    alertsEnabled?: boolean;
    /** Today's priced spend (CNY) limit; 0/absent disables the daily-cost alert. */
    dailyCostLimitCny?: number;
    /** Official plan-window percent that raises an alert; 0/absent disables it. */
    planAlertPercent?: number;
    /**
     * Percent a longer plan window must reach before the composer ring replaces
     * the 5-hour window with it. Default 100; exposed in the overview document.
     */
    planPromotePercent?: number;
    /** Known CNY balance at/below which an alert is raised; 0/absent disables it. */
    balanceAlertCny?: number;
    /** Minutes between alert bubbles for the same episode key. Default 60. */
    alertCooldownMinutes?: number;
    /** Read official DeepSeek platform billing for the reconcile strip. */
    platformUsageEnabled?: boolean;
    /** Estimate USD cost from the models.dev price book. */
    costEstimateEnabled?: boolean;
    /** Raw JSON array of generic custom plan sources; empty disables the feature. */
    customPlans?: string;
    /** Test seam: pre-built price book (avoids the network). */
    priceBook?: PriceBook;
    /** Test seam: replace the models.dev catalog fetch. */
    priceBookFetcher?: () => Promise<PriceBook | undefined>;
    /** Test seam: replace the official platform fetch. */
    platformFetcher?: (ctx: Context) => Promise<UsagePlatformView>;
    /**
     * Filesystem-fact health cache TTL in ms. Default 2000; tests set 0 to make
     * corrupt-file/backfill-status changes visible immediately.
     */
    healthCacheTtlMs?: number;
    cpamcEnabled: boolean;
    cpamcBaseURL: string;
    cpamcManagementKeyEnv: string;
    cpamcAllowedHosts: string;
    volcanoEnabled: boolean;
    volcanoAccessKeyEnv: string;
    volcanoSecretKeyEnv: string;
}
/** Default overview trend window in local days (backward compatible). */
export declare const DEFAULT_RANGE_DAYS = 30;
/** The only `days` values the overview route accepts (besides the default). */
export declare const ALLOWED_RANGE_DAYS: readonly [7, 30, 90, 182];
/** The wire payload of one overview read: the cached document plus its ETag. */
export interface UsageOverviewPayload {
    document: UsageOverviewView;
    etag: string;
}
/** External sources the Settings page can test on demand. */
export type ExternalTestTarget = 'cpamc' | 'volcano' | 'custom';
/**
 * Unsaved Settings draft values used for one connection test. The browser
 * sends them with the loopback-only test request so a test sees exactly what is
 * typed instead of the previously saved config; nothing here is persisted, and
 * secret fields are used only for the probe (never echoed in the result).
 */
export interface ExternalSourceTestDraft {
    cpamcEnabled?: boolean;
    cpamcBaseURL?: string;
    cpamcAllowedHosts?: string;
    cpamcManagementKey?: string;
    volcanoEnabled?: boolean;
    volcanoAccessKeyId?: string;
    volcanoSecretAccessKey?: string;
    customPlans?: string;
}
/** Result of one external-source connection test (no secrets cross the wire). */
export interface UsageExternalTestResult {
    target: ExternalTestTarget;
    ok: boolean;
    latencyMs: number;
    /** Accounts readable through CPAMC (one row per codex/kimi/claude auth file). */
    accounts?: number;
    /** First few plan windows found by the test, for a concrete success message. */
    windows?: Array<{
        key: string;
        percent?: number;
        resetsAt?: string;
    }>;
    /** Transport or validation error, already free of secret values. */
    error?: string;
    /** Actionable configuration hint derived from the failure. */
    hint?: string;
}
/** Format a balance for display: symbol prefix when known, code suffix otherwise. */
export declare function formatMoney(currency: string, totalBalance: string): string;
/**
 * Delay before the next probe of a provider that just failed that many times
 * in a row; 0 (probe normally next cycle) for a provider with no failures.
 */
export declare function probeBackoffDelayMs(failures: number): number;
/**
 * Delay before the next debounced ledger flush. The burst debounce is the
 * lower bound; a write that started less than the minimum interval ago pushes
 * the next one out so the full-document fsync rewrite cannot run continuously
 * during an active session. Pure: unit-tested directly, no timer involved.
 */
export declare function nextFlushDelayMs(nowMs: number, lastFlushAtMs: number): number;
/**
 * Resolve the overview `days` query value: absent -> 30 (backward compatible),
 * one of `ALLOWED_RANGE_DAYS` -> itself, anything else -> undefined (the route
 * answers 400). Accepts the raw query string so the route and the service
 * share one validation rule.
 */
export declare function resolveRangeDays(value: unknown): number | undefined;
/**
 * Drop overview rows no surface renders: the wire document otherwise carries
 * every catalog provider the runtime knows (40+ empty rows ≈ 6 KiB per poll).
 * A row survives when it carries a fact (plan/balance/error), a configured
 * credential, a usage total, is the current route, or comes from an external
 * source. `supported`-only rows without any of those are pure catalog noise:
 * nothing in the browser half reads `supported`/`planSupported`.
 */
export declare function selectOverviewProviders(rows: readonly ProviderSnapshotView[], options: {
    usageProviders: ReadonlySet<string>;
    currentProvider?: string;
}): ProviderSnapshotView[];
/** Map a used percent to the announcement tone. */
export declare function planTone(percent: number): 'ok' | 'warn' | 'low';
/** Announcement context the service computes per poll: today's family spend and the DeepSeek period. */
export interface AnnounceContext {
    /** Today's ledger spend for the announced provider's family (CNY; 0 = unpriced). */
    todayCost?: number;
    /** Whether DeepSeek peak pricing is in effect right now. */
    peak?: boolean;
}
/**
 * Build the raw pet announce payload for one provider snapshot, or
 * undefined when nothing worth announcing exists. Pure: every payload this
 * returns satisfies the pet's `parseAnnouncement` contract — plan
 * announcements require a numeric percent, so percent-less windows never
 * announce (the pet validator would silently drop them). A priced family
 * (DeepSeek) with spend today announces a cost bubble first; balance-only
 * families announce the balance; plan families announce their tightest
 * percent window.
 */
export declare function buildAnnouncement(snapshot: Pick<ProviderSnapshotView, 'displayName' | 'balance' | 'plan'>, context?: AnnounceContext): Record<string, unknown> | undefined;
/**
 * Compact token-count display for the usage fallback bubble: `9805`,
 * `8.7万`, `1.2亿`. The host-authored bubble copy is zh (like every other
 * line this service speaks), so the magnitudes follow the zh convention.
 */
export declare function formatTokens(count: number): string;
/**
 * The usage fallback for the session's provider: today's token consumption
 * and call count, the one fact the ledger owns for every provider. Providers
 * without a readable balance/plan endpoint (relay stations, local runtimes,
 * token-plan vendors — and probeable providers whose probes are failing)
 * would otherwise leave the pet bubble permanently silent even while their
 * sessions run. Undefined when the provider has no usage today: a bubble
 * about nothing is noise, not information. Pure; the payload satisfies the
 * pet's `parseAnnouncement` contract.
 */
export declare function buildLedgerAnnouncement(input: {
    displayName: string;
    totals: UsageTokenTotals;
}): Record<string, unknown> | undefined;
export declare function readEntryConfig(ctx: Context, id: string): Record<string, unknown> | undefined;
/**
 * Replace one external source only after its complete probe result is ready.
 * Never expose an empty CPAMC/Volcano interval to an overlapping browser
 * `/overview` poll: a transient fetch failure retains the last known rows;
 * an intentional disabled/status result still atomically replaces them.
 */
export declare function replaceExternalSnapshots(snapshots: Map<string, ProviderSnapshotState>, source: 'cpamc' | 'volcano' | 'custom', rows: readonly ProviderSnapshotState[]): void;
/**
 * Whether two snapshot states carry the same *facts*. Volatile probe read
 * timestamps (`updatedAt` on the row, balance, and plan) are ignored: a
 * provider that keeps returning identical facts must not rewrite the snapshot
 * map, the persisted snapshots file, or the overview revision/ETag every
 * poll. Extend this when a new wire fact is added to `ProviderSnapshotState`.
 */
export declare function providerSnapshotFactsEqual(left: ProviderSnapshotState, right: ProviderSnapshotState): boolean;
export declare class UsageService {
    private readonly ctx;
    private options;
    private readonly persistDir;
    private readonly ledgerPath;
    private readonly snapshotsPath;
    private ledger;
    private readonly snapshots;
    /** Per-live-session route attribution (WeakMap: disposed sessions age out). */
    private readonly sessionRoutes;
    /** The most recent route seen this boot; the pet bubble follows it. */
    private current;
    private sessionListenerDisposer;
    private pollTimer;
    private flushTimer;
    private pollInFlight;
    /** The running poll cycle; manual refresh joins it instead of no-oping. */
    private pollPromise;
    /** Serialized ledger flushes: overlapping debounce/stop flushes queue, never interleave. */
    private flushChain;
    /** True once loadPersisted finished; nothing may overwrite the files before that. */
    private loaded;
    private disposed;
    private lastSignature;
    /** Last prune guard: once per local day, and whenever retention shrinks. */
    private lastPrune;
    /** Consecutive probe failures per provider; drives the retry backoff. */
    private readonly probeBackoff;
    /** Last snapshots document written; an unchanged document is not rewritten. */
    private lastPersistedSnapshots;
    /** Start instant of the last ledger write attempt; enforces the flush floor. */
    private lastFlushAt;
    /**
     * Bumped on every document-visible mutation: ledger fold, persisted merge,
     * prune, settings/retention change, composer/current change, probe result,
     * or a route/config/credential-flag change. The derived overview document
     * is served from cache until this moves.
     */
    private revision;
    /** Bumped only by ledger mutations; the usage windows aggregate from it. */
    private ledgerRevision;
    /**
     * Derived overview documents, one per accepted range window, keyed by
     * `revision|dayKey`. Different `?days=` variants do not thrash each other;
     * a revision/day rollover replaces the whole map.
     */
    private overviewCache;
    /**
     * Aggregated usage windows, one per accepted range window, keyed by
     * `ledgerRevision|retainDays|dayKey`. The today/heatmap/all-time windows are
     * range-independent but cheap to rebuild per variant once per revision.
     */
    private usageCache;
    /** Provider route list TTL cache (the llm registry is a config scan). */
    private routesCache;
    /** configEditor entry snapshots a document read depends on; TTL-cached. */
    private readonly entryConfigCache;
    /** External credential-status TTL cache: three vault reads per assembly otherwise. */
    private credentialStatusCache;
    /** Last credential flags observed before a cache invalidation; drives invalidation. */
    private lastCredentialStatus;
    /** Dedupes overlapping credential-status reads. */
    private credentialStatusInFlight;
    /** Parsed custom-plan config, keyed by the raw settings string. */
    private customPlansCache;
    /** Invalidates in-flight credential-status reads that predate a credential write. */
    private credentialStatusGeneration;
    /** Short-TTL data-health cache: health costs filesystem reads, not per-poll work. */
    private healthCache;
    /** Alert episodes: `kind:provider:window` → epoch ms the current episode started. */
    private readonly alertEpisodes;
    /** Last pet bubble instant per alert key; enforces the configured cooldown. */
    private readonly alertBubbleAt;
    /** Last probe attempt instant (any provider), surfaced in `health.probes`. */
    private probeAttemptAt;
    /** Last successful probe instant, surfaced in `health.probes`. */
    private probeSuccessAt;
    /** Official DeepSeek platform facts (best-effort, network-backed). */
    private platformView;
    /** Signature of the last platform payload, so polls only bump on real change. */
    private platformSignature;
    private platformFetchedAt;
    private platformInFlight;
    /** models.dev catalog used for USD reference estimates. */
    private priceBook;
    private priceBookFetchedAt;
    private priceBookInFlight;
    /**
     * @param ctx - host context.
     * @param options - resolved plugin options.
     * @param persistDir - ledger/snapshot directory override (tests only; the
     *   live service always uses the DSH home). Kept as a narrow seam so
     *   persistence tests never write into the user's real data directory.
     */
    constructor(ctx: Context, options: UsageServiceOptions, persistDir?: string);
    /** Start the listeners, load persisted state, and arm the first poll. */
    start(): void;
    /**
     * Stop timers and flush pending ledger writes. The returned promise
     * resolves after the final flush lands, so a successor instance (quick
     * disable → enable) can serialize its first load behind it.
     */
    stop(): Promise<void>;
    /** Re-apply options live (settings change); retention shrink prunes now. */
    applyOptions(options: UsageServiceOptions): void;
    /** Force one poll now (manual refresh route); joins an in-flight cycle. */
    refresh(): Promise<void>;
    /**
     * Probe one external source now and report a structured, secret-free result
     * for the Settings "test connection" button. Never throws: transport errors
     * and configuration mistakes both come back as `ok: false` plus a hint.
     */
    testExternalSource(target: ExternalTestTarget, planId?: string, draft?: ExternalSourceTestDraft): Promise<UsageExternalTestResult>;
    /** Actionable CPAMC hint for one probe failure message. */
    private cpamcTestHint;
    /** Actionable hint for one custom-plan probe failure. */
    private customPlanTestHint;
    /** Actionable Volcano hint for one probe failure message. */
    private volcanoTestHint;
    dayDetail(date: string): UsageDayDetail;
    /**
     * Refresh the official platform facts in the background. Network-backed and
     * fully best-effort: failure keeps the previous view (or none) and never
     * blocks a poll cycle.
     */
    private refreshPlatformTruth;
    /**
     * Load the cached models.dev price book and refresh it when stale. The fetch
     * is background-only so a slow catalog never delays a poll.
     */
    private refreshPriceBook;
    /**
     * Attach the local-side compare facts to the official platform view: the
     * DeepSeek-only month cost from our ledger, coverage of official active days,
     * and the signed delta. Currencies stay CNY on both sides.
     */
    private enrichPlatformView;
    /**
     * Assemble the overview document the browser section renders.
     * @param days - trend window (one of `ALLOWED_RANGE_DAYS`); default 30.
     */
    overview(days?: number): Promise<UsageOverviewView>;
    /**
     * The overview document plus its strong ETag for one range window. A warm
     * request (same data revision and same window) answers from the derived
     * cache: no ledger re-summarization, no provider rebuild, and no SHA-1 over
     * the JSON — the GET route only needs the cached validator to answer 304.
     * `updatedAt` moves with each read but stays out of the ETag.
     */
    overviewPayload(days?: number): Promise<UsageOverviewPayload>;
    /**
     * The aggregate ledger export document for the last `days` local days
     * (1..730, default 182). Transport-free so the export route stays a thin
     * HTTP wrapper; the payload is ledger aggregates only — no secrets.
     */
    exportLedger(days: number): LedgerExportDocument;
    /**
     * Build the wire document from an already-aggregated usage summary. Rows
     * and the provider keep-set (the exact ids the trend/today cards look up)
     * are computed once per revision. The returned `providers` array is freshly
     * sorted, so it never aliases the cached route list.
     */
    private assembleOverview;
    /**
     * Aggregate the usage windows for the current ledger revision, local day,
     * and range window. One pass over the retained ledger per revision/window;
     * warm polls (and the pet bubble's today lookup) reuse it.
     */
    private usageSummary;
    /**
     * Data health. Filesystem-derived facts (ledger bytes, corrupt files,
     * backfill state) sit behind a short TTL so a warm overview poll performs no
     * I/O; the in-memory probe instants are cheap and refreshed on every read.
     */
    private currentHealth;
    /**
     * Filesystem/ledger facts for `currentHealth`: storage stats and backfill
     * state. Never throws: each file read is individually guarded. The volatile
     * probe instants are normalized out of the ETag (see `jsonEtag`).
     */
    private buildHealthFacts;
    /**
     * Bubble one newly-started alert to the pet. Honors the bubble off switch,
     * the alert master switch, and the per-key cooldown; active alerts still
     * appear in the overview payload regardless of whether the bubble is
     * suppressed. Fully guarded: a missing/failing pet never breaks the overview.
     */
    private announceAlert;
    /** Mark a document-visible mutation: the next overview read rebuilds. */
    private bumpRevision;
    /** Mark a ledger mutation: both the document and the usage windows rebuild. */
    private bumpLedgerRevision;
    /** Adopt a new current route, bumping the revision only when it changed. */
    private setCurrent;
    /**
     * Write-only: store one external secret in the DSH credential vault under
     * the configured env-var name. Never returns the value.
     */
    setExternalCredential(target: ExternalCredentialTarget, value: string): Promise<{
        ok: true;
    } | {
        ok: false;
        error: string;
    }>;
    /** Remove one external secret from the DSH credential vault. */
    clearExternalCredential(target: ExternalCredentialTarget): Promise<{
        ok: true;
    } | {
        ok: false;
        error: string;
    }>;
    /**
     * Configured/missing flags only — never the secret values. Short-TTL cached:
     * the document renders them and a 10s poll must not read the vault three
     * times per request. A changed flag bumps the revision so the next overview
     * rebuilds; credential writes and settings changes invalidate explicitly.
     */
    externalCredentialStatus(): Promise<ExternalCredentialStatus>;
    /** Drop the cached flags after a credential write or env-name change. */
    private invalidateCredentialStatus;
    /** The live (uncached) credential-status read: three vault describes. */
    private readExternalCredentialStatus;
    private externalCredentialEnv;
    private isEnvConfigured;
    /** Today's ledger spend for one provider's adapter family (0 when unpriced). */
    private familyCostToday;
    /** Today's ledger totals for one provider route (the exact id, not the family). */
    private providerUsageToday;
    /**
     * The display name for a route key: the LLM runtime's first, then the
     * adapter's, then the id itself — the snapshot may not exist for
     * adapter-less routes, yet the bubble still needs a legible title.
     */
    private routeDisplayName;
    private onSessionEvent;
    /**
     * Follow the composer model selector (`agent-default-model`). The strip
     * must update as soon as the user picks another provider/model, not only
     * when the next request/header event lands.
     */
    private syncCurrentFromComposer;
    /**
     * Normalize a provider TokenUsage into the ledger bucket (one call). The
     * DeepSeek official family is priced at the fold instant (its billing
     * period is time-of-day); other families stay unpriced (cost 0).
     */
    private totalsFrom;
    private loadPersisted;
    /**
     * Merge one persisted ledger file into the live document. The file is only
     * trusted after a shape check; an unreadable ledger is preserved beside the
     * live path as `<name>.corrupt-<epoch>` instead of being silently overwritten
     * by the next flush. Never throws.
     */
    private mergePersistedLedger;
    /**
     * Move an unreadable ledger aside so its bytes survive the next flush. A
     * locked or cross-device file falls back to a best-effort copy; preservation
     * failure must never block startup, so both failures are swallowed.
     */
    private preserveUnreadableLedger;
    private mergePersistedSnapshots;
    /** Read the completion state; undefined when absent or unrecognized. */
    private readBackfillState;
    private writeBackfillState;
    /**
     * Rebuild the ledger from prior sessions after `loadPersisted()` resolves.
     *
     * Runs only when all of these hold: the optional `ctx.sessionQuery` service
     * is present, the in-memory ledger has no usage (fresh install or data-dir
     * loss), and no `backfill.json` completion state exists yet. Anything else is
     * a normal upgrade (non-empty ledger) and simply records the state once so
     * the empty-ledger check is not repeated on every boot. Never throws.
     */
    private maybeBackfill;
    /**
     * Arm one debounced ledger flush. The delay is the burst debounce or the
     * remaining flush floor, whichever is later, so an active session cannot
     * rewrite the full ledger document on every 3 s window. Exactly one timer is
     * ever pending; folds that land while it runs are covered by the write that
     * follows (and reschedule afterwards when the write already started).
     */
    private scheduleFlush;
    /**
     * Queue one ledger flush behind the previous one. Debounce and stop-time
     * flushes serialize here, so two `writeJsonAtomic` calls can never run
     * concurrently on the same path. `stop()` calls this directly, so the final
     * flush is never delayed by the floor.
     */
    private flushLedger;
    private writeLedgerOnce;
    /**
     * Prune days past retention. Runs at most once per local day and whenever
     * `retainDays` shrinks — not only at startup, so long-lived processes and
     * live settings changes both honor retention.
     */
    private pruneIfNeeded;
    private persistSnapshots;
    private rearmPoll;
    /**
     * One poll cycle: enumerate routes, resolve credentials, probe, announce.
     * A call while a cycle is already running joins that cycle instead of
     * returning immediately, so a manual refresh always waits for real probes.
     */
    pollNow(): Promise<void>;
    /**
     * The live LLM provider routes, short-TTL cached: the registry call walks
     * config, and every overview/poll/announce reads it. A registry change is
     * document-visible (provider rows), so it bumps the revision.
     */
    private listProviderRoutes;
    private readProviderRoutes;
    private probeRoute;
    /** Advance or clear the retry backoff after one provider's probe run. */
    private recordProbeOutcome;
    /**
     * Resolve the credential backing one route: pi-ai credential records
     * first, then the profile's apiKeyEnv reference, then the DeepSeek
     * official adapter's env reference. OAuth grants hand their stored access
     * token to the oauth-aware adapters (Codex plan quota); a stale token
     * fails its probe with a 401 and refreshes the next time the harness
     * itself runs that provider.
     */
    private resolveCredential;
    private resolveEnv;
    /** Synchronous environment read for the custom-plan probe's `${env:NAME}` headers. */
    private readEnvValue;
    private probeExternalSources;
    /**
     * Probe every configured custom plan and replace its `custom:` snapshots.
     * Each plan is independent: a failing or slow entry records its own `planError`
     * and never affects the others or the poll cycle. Removed entries drop their
     * snapshots here so the page cannot show a plan that no longer exists.
     */
    private probeCustomPlans;
    /** Parsed custom-plan config, re-parsed only when the settings string changes. */
    private customPlanConfig;
    /**
     * Replace one external source's rows, bumping the revision only when the
     * facts actually changed. A disabled/idle source and an unchanged quota
     * response must not invalidate the cached overview (and its ETag) or rewrite
     * the snapshots file every poll; the probe read timestamps are ignored for
     * this comparison.
     */
    private replaceExternalSnapshotsChecked;
    /**
     * A configEditor entry snapshot, short-TTL cached. Config is part of the
     * document (the current route's baseURL), so a changed value bumps the
     * revision; the TTL keeps the config scan off the warm poll path.
     */
    private cachedEntryConfig;
    /** The llm-pi-ai profile object for one provider route, when configured. */
    private piAiProfile;
    /** The DeepSeek official adapter's credential reference name. */
    private deepseekApiKeyEnv;
    /**
     * Announce the current provider's spend, balance, or plan usage to the pet.
     * In `change` mode only meaningful value changes re-announce; `off` skips.
     * The TTL rides the poll interval (bubble_mode `always` re-announces every
     * cycle, so a TTL of two cycles + margin keeps the bubble continuous
     * across polls; the pet contract caps the ceiling). A route id the
     * catalogs spell differently than the snapshot keys falls back to its
     * adapter family's snapshot. When the provider has no announceable probe
     * fact (no adapter, failing probes, percent-less windows) the bubble falls
     * back to the provider's today ledger usage, and with neither fact nor
     * usage it stays silent. Fully guarded: a malformed snapshot or a failing
     * pet service must never break the poll loop, and a disposed service never
     * announces.
     */
    private announceCurrent;
}
//# sourceMappingURL=usage-service.d.ts.map