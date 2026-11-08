/**
 * The dsh-usage host service: folds live session usage into the persistent
 * ledger, probes each configured provider's balance/coding-plan endpoint on
 * a poll cycle, and announces the current provider's status to the pet
 * bubble. Secrets stay in the host process; the browser only ever sees the
 * overview document.
 * @module @linxin666/dsh-usage/host/usage-service
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ExternalCredentialStatus, ExternalCredentialTarget, ProviderSnapshotState, ProviderSnapshotView, UsageOverviewView, UsageTokenTotals } from '../core/types.ts';
/** Source tag the plugin stamps onto pet announcements. */
export declare const USAGE_ANNOUNCE_SOURCE = "dsh-usage-plus";
/** Poll-loop and announce options; re-applied live on settings change. */
export interface UsageServiceOptions {
    pollIntervalSec: number;
    bubbleMode: 'always' | 'change' | 'off';
    retainDays: number;
    cpamcEnabled: boolean;
    cpamcBaseURL: string;
    cpamcManagementKeyEnv: string;
    cpamcAllowedHosts: string;
    volcanoEnabled: boolean;
    volcanoAccessKeyEnv: string;
    volcanoSecretKeyEnv: string;
}
/** The wire payload of one overview read: the cached document plus its ETag. */
export interface UsageOverviewPayload {
    document: UsageOverviewView;
    etag: string;
}
/** Format a balance for display: symbol prefix when known, code suffix otherwise. */
export declare function formatMoney(currency: string, totalBalance: string): string;
/**
 * Delay before the next probe of a provider that just failed that many times
 * in a row; 0 (probe normally next cycle) for a provider with no failures.
 */
export declare function probeBackoffDelayMs(failures: number): number;
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
export declare function replaceExternalSnapshots(snapshots: Map<string, ProviderSnapshotState>, source: 'cpamc' | 'volcano', rows: readonly ProviderSnapshotState[]): void;
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
    /**
     * Bumped on every document-visible mutation: ledger fold, persisted merge,
     * prune, settings/retention change, composer/current change, probe result,
     * or a route/config/credential-flag change. The derived overview document
     * is served from cache until this moves.
     */
    private revision;
    /** Bumped only by ledger mutations; the usage windows aggregate from it. */
    private ledgerRevision;
    /** Derived overview document, rebuilt at most once per revision. */
    private overviewCache;
    /** Aggregated usage windows, rebuilt at most once per ledger revision. */
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
    /** Invalidates in-flight credential-status reads that predate a credential write. */
    private credentialStatusGeneration;
    constructor(ctx: Context, options: UsageServiceOptions);
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
    /** Assemble the overview document the browser section renders. */
    overview(): Promise<UsageOverviewView>;
    /**
     * The overview document plus its strong ETag. A warm request (same data
     * revision) answers from the derived cache: no ledger re-summarization, no
     * provider rebuild, and no SHA-1 over the JSON — the GET route only needs
     * the cached validator to answer 304. `updatedAt` moves with each read but
     * stays out of the ETag, exactly like the uncached path.
     */
    overviewPayload(): Promise<UsageOverviewPayload>;
    /**
     * Build the wire document from an already-aggregated usage summary. Rows
     * and the provider keep-set (the exact ids the trend/today cards look up)
     * are computed once per revision. The returned `providers` array is freshly
     * sorted, so it never aliases the cached route list.
     */
    private assembleOverview;
    /**
     * Aggregate the usage windows for the current ledger revision and local day.
     * One pass over the retained ledger per revision; warm polls (and the pet
     * bubble's today lookup) reuse it instead of re-summarizing 182 days.
     */
    private usageSummary;
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
    private scheduleFlush;
    /**
     * Queue one ledger flush behind the previous one. Debounce and stop-time
     * flushes serialize here, so two `writeJsonAtomic` calls can never run
     * concurrently on the same path.
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
    private probeExternalSources;
    /**
     * Replace one external source's rows, bumping the revision only when the
     * map actually changed (a disabled/idle source must not invalidate the
     * cached overview on every poll).
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