/**
 * The dsh-usage host service: folds live session usage into the persistent
 * ledger, probes each configured provider's balance/coding-plan endpoint on
 * a poll cycle, and announces the current provider's status to the pet
 * bubble. Secrets stay in the host process; the browser only ever sees the
 * overview document.
 * @module @linxin666/dsh-usage/host/usage-service
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ProviderSnapshotView, UsageOverviewView, UsageTokenTotals } from '../core/types.ts';
/** Source tag the plugin stamps onto pet announcements. */
export declare const USAGE_ANNOUNCE_SOURCE = "dsh-usage-plus";
/**
 * Persisted accrual state for the official DeepSeek family's real spend:
 * consecutive observations of the official CNY balance, decreases counted
 * as spent (a rise is a top-up and never accrues). `since` is the first
 * observation; the ledger keeps no such fact, so this watch is the only
 * source of the voucher's observed-spend figure.
 */
export interface SpendWatch {
    /** Total observed decrease since `since`, in CNY. */
    accruedCny: number;
    /** Epoch ms of the first balance observation. */
    since: number;
    /** The balance the previous observation ended on, when one exists. */
    lastBalanceCny?: number;
}
/** Poll-loop and announce options; re-applied live on settings change. */
export interface UsageServiceOptions {
    pollIntervalSec: number;
    bubbleMode: 'always' | 'change' | 'off';
    retainDays: number;
    cpamcEnabled: boolean;
    cpamcBaseURL: string;
    cpamcManagementKeyEnv: string;
    volcanoEnabled: boolean;
    volcanoAccessKeyEnv: string;
    volcanoSecretKeyEnv: string;
}
/** Format a balance for display: symbol prefix when known, code suffix otherwise. */
export declare function formatMoney(currency: string, totalBalance: string): string;
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
export declare class UsageService {
    private readonly ctx;
    private options;
    private readonly persistDir;
    private readonly ledgerPath;
    private readonly snapshotsPath;
    private ledger;
    private readonly snapshots;
    /** The official DeepSeek family's real-spend watch (see SpendWatch). */
    private spendWatch;
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
    overview(): UsageOverviewView;
    /** One local day aggregated per provider. */
    private daySummary;
    /** Today's ledger spend for one provider's adapter family (0 when unpriced). */
    private familyCostToday;
    /** Today's ledger totals for one provider route (the exact id, not the family). */
    private providerUsageToday;
    /**
     * Accrue the official DeepSeek family's real spend from observed CNY
     * balance decreases; a balance rise is a top-up and never counts. The
     * family's route ids can alias one account, so the watch follows the
     * largest balance seen this cycle and accrues only decreases of that
     * series — a failed probe keeps the stale balance and accrues nothing
     * until the next success reports the whole drop at once.
     */
    private accrueDeepSeekSpend;
    /**
     * The display name for a route key: the LLM runtime's first, then the
     * adapter's, then the id itself — the snapshot may not exist for
     * adapter-less routes, yet the bubble still needs a legible title.
     */
    private routeDisplayName;
    private onSessionEvent;
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
    private listProviderRoutes;
    private probeRoute;
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