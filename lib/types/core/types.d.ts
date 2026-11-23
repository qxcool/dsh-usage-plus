/**
 * Wire-facing view types shared by the dsh-usage host service, its HTTP
 * routes, and the browser section. Everything here crosses the wire as JSON
 * and must stay provider-agnostic: provider quirks are normalized inside the
 * core adapters, never here.
 * @module @linxin666/dsh-usage/core/types
 */
/** One disjoint token bucket total, aggregated over calls (billed input = input + cacheRead + cacheWrite). */
export interface UsageTokenTotals {
    /** Uncached input tokens. */
    inputTokens: number;
    /** Output tokens (reasoning included). */
    outputTokens: number;
    /** Cache read tokens. */
    cacheReadTokens: number;
    /** Cache write tokens. */
    cacheWriteTokens: number;
    /** Reasoning tokens, when the provider reported them. */
    reasoningTokens: number;
    /** Provider calls that reported usage. */
    calls: number;
    /**
     * Spend estimate stamped at fold time, in the priced provider's billing
     * currency (currently DeepSeek official only, CNY); every other provider
     * stays 0 = unpriced, so the sum is never a mixed-currency total. Persisted
     * buckets recorded before a price-book change keep the old pricing.
     */
    cost: number;
}
/** A zeroed totals bucket. */
export declare function emptyTotals(): UsageTokenTotals;
/** Add `right` into `left` in place. */
export declare function addTotals(left: UsageTokenTotals, right: Readonly<UsageTokenTotals>): UsageTokenTotals;
/** On-disk usage ledger: per local day, per provider route, per model. */
export interface UsageLedgerDocument {
    version: 1;
    /** Local-date key `YYYY-MM-DD` → per-provider per-model totals. */
    days: Record<string, Record<string, Record<string, UsageTokenTotals>>>;
}
/** One provider row of the day summary the overview serves. */
export interface UsageProviderSummary {
    provider: string;
    totals: UsageTokenTotals;
    /** Per-model breakdown, heaviest by total tokens first, capped by the route. */
    models: Array<{
        model: string;
        totals: UsageTokenTotals;
    }>;
}
/** One day row of the trend the overview serves. */
export interface UsageDaySummary {
    date: string;
    totals: UsageTokenTotals;
}
/** A balance fact normalized from a provider probe. */
export interface BalanceView {
    /** ISO 4217 code the provider bills in (`CNY`, `USD`, ...). */
    currency: string;
    /** Spendable total formatted for display (no currency symbol). */
    totalBalance: string;
    /** Epoch ms of the successful probe. */
    updatedAt: number;
}
/** One quota window of a coding plan. */
export interface PlanWindowView {
    /** Stable window key the UI localizes (`5h`, `week`, `month`, provider strings otherwise). */
    key: string;
    /** Provider-supplied window name, when it sends one. */
    name?: string;
    /** Used percent 0-100, when computable. */
    percent?: number;
    /** ISO 8601 reset instant, when the provider reports one. */
    resetsAt?: string;
}
/** A coding-plan quota fact normalized from a provider probe. */
export interface PlanView {
    /** Plan tier name, when the provider reports one. */
    planName?: string;
    windows: PlanWindowView[];
    updatedAt: number;
}
/** How the credential backing one provider route was resolved. */
export type CredentialKind = 'api-key' | 'env' | 'oauth' | 'none';
/** One aggregated usage window (the 30-day trend, or the whole retained ledger). */
export interface UsageWindowSummary {
    from: string;
    to: string;
    totals: UsageTokenTotals;
    providers: UsageProviderSummary[];
}
/** One provider row of the overview snapshot. */
export interface ProviderSnapshotView {
    /** Provider route key (`deepseek`, `kimi-coding`, custom routes, ...). */
    provider: string;
    /** Where quota data came from; model routes remain the default. */
    source?: 'model' | 'cpamc' | 'volcano' | 'custom';
    /** Display name from the LLM runtime, else the adapter's, else the route key. */
    displayName: string;
    credential: CredentialKind;
    /** Whether any balance/plan adapter exists for this route. */
    supported: boolean;
    /** A balance adapter exists for this route (the Usage tab's balance card). */
    balanceSupported?: boolean;
    /** A coding-plan adapter exists for this route — the Plans tab lists these only. */
    planSupported?: boolean;
    /**
     * How the quota adapter was recognized: by route id, inferred from the
     * configured base URL (a standard provider set up under a custom route name),
     * or detected as a standard gateway dashboard endpoint on an otherwise
     * unknown base URL.
     * Absent means no adapter matched.
     */
    matchedBy?: 'id' | 'baseURL' | 'gateway';
    /** Display label of the detected gateway probe (`One API`, `New API`, `Credits`). */
    gatewayName?: string;
    balance?: BalanceView;
    plan?: PlanView;
    /** Last probe failure, cleared on the next success. */
    error?: string;
    updatedAt?: number;
}
/** Write-only external secret slots (CPAMC management token, Volcano AK/SK). */
export type ExternalCredentialTarget = 'cpamc' | 'volcano.ak' | 'volcano.sk';
/**
 * Whether each external secret is present in the credential store or process
 * env. Values themselves never cross the wire — only these booleans do.
 */
export interface ExternalCredentialStatus {
    cpamc: boolean;
    volcanoAk: boolean;
    volcanoSk: boolean;
}
/**
 * Host-evaluated alert kinds:
 * - `daily-cost` — today's priced spend crossed the configured CNY limit;
 * - `plan-threshold` — the tightest official plan window crossed the configured percent;
 * - `balance-low` — a provider's known balance fell below the configured CNY amount.
 */
export type UsageAlertKind = 'daily-cost' | 'plan-threshold' | 'balance-low';
/** Alert severity: `critical` means at/over a hard limit, `warning` is approaching it. */
export type UsageAlertSeverity = 'warning' | 'critical';
/** One active alert raised by the Host from the current ledger/snapshot facts. */
export interface UsageAlert {
    kind: UsageAlertKind;
    severity: UsageAlertSeverity;
    /** Provider route the alert belongs to, when it is provider-scoped. */
    provider?: string;
    /** Plan window key (`5h` / `week` / `month` / provider string), for plan alerts. */
    window?: string;
    /** Observed value: CNY for daily-cost/balance, percent for plan-threshold. */
    value: number;
    /** Configured threshold that triggered the alert (same unit as `value`). */
    threshold: number;
    /** Epoch ms the current alert episode started. */
    since: number;
    /** Short English message; the section can localize by `kind` instead. */
    message: string;
}
/** Ledger/storage and probe health shown in the data-health section. */
export interface UsageHealth {
    storage: {
        /** Display-safe data directory label (`~/.dsh/dsh-usage-plus`). */
        label: string;
        /** Ledger file size in bytes, 0 when it has not been written yet. */
        bytes: number;
        /** Retained days that hold at least one usage bucket. */
        activeDays: number;
        /** Oldest retained day key, when any. */
        firstDay: string | null;
        /** Newest retained day key, when any. */
        lastDay: string | null;
        /** Configured retention in local days. */
        retentionDays: number;
        /** Basenames of preserved corrupt ledger files (`.corrupt-<epoch>`). */
        corruptFiles: string[];
    };
    /** Completion state of the one-time session-history backfill, when it ran. */
    backfill: {
        completedAt: number;
        cutoff: number;
        sessions: number;
        events: number;
        /** Inherited fork-prefix usage events skipped, so forks are not double counted. */
        forkEvents?: number;
        truncated?: boolean;
    } | null;
    probes: {
        lastAttemptAt: number | null;
        lastSuccessAt: number | null;
        /** Provider route ids whose last probe failed. */
        failing: string[];
    };
}
/**
 * Official DeepSeek platform (billing console) facts plus the local ledger's
 * DeepSeek-only month cost, for the overview reconcile strip. Optional: the
 * platform endpoint is internal and may be unavailable/signed out.
 */
export interface UsagePlatformView {
    status: 'ready' | 'unavailable' | 'error';
    currency: 'CNY';
    /** Official current-month spend in CNY. */
    monthCost?: number;
    /** Official lifetime spend in CNY (get_user_summary total_costs). */
    cumulativeCost?: number;
    /** Same month from the local ledger, DeepSeek routes only (CNY). */
    localMonthCost?: number;
    /** Fraction 0..1 of official active days with local ledger coverage. */
    coverage?: number;
    /** `monthCost - localMonthCost` (positive = official charges more). */
    delta?: number;
    /** Official per-day spend for the current month, when the API returns it. */
    days?: Array<{
        date: string;
        cost: number;
    }>;
    updatedAt: number;
    /** Human message when status is `error`; never contains credentials. */
    error?: string;
}
/**
 * USD reference estimate for the selected window from the models.dev price
 * book. Deliberately separate from the CNY DeepSeek ledger cost so currencies
 * are never mixed; priced/unpriced counts keep the number honest.
 */
export interface UsageCostEstimate {
    currency: 'USD';
    /** Estimated spend in USD; undefined when no bucket could be priced. */
    amount?: number;
    pricedCalls: number;
    totalCalls: number;
    pricedModels: number;
    totalModels: number;
    source: 'models.dev';
    /** Epoch ms the price book was fetched. */
    priceBookUpdatedAt?: number;
}
/** One day's drill-down: totals plus per-provider/per-model rows. */
export interface UsageDayDetail {
    date: string;
    totals: UsageTokenTotals;
    providers: UsageProviderSummary[];
}
/** One rejected custom-plan config field, surfaced in Settings. */
export interface UsageCustomPlanError {
    /** Entry index in the user's JSON array, or -1 for the document itself. */
    index: number;
    id?: string;
    field: string;
    message: string;
}
/** The overview the browser section renders. */
export interface UsageOverviewView {
    updatedAt: number;
    providers: ProviderSnapshotView[];
    /** Active threshold alerts; optional so an older Host document still parses. */
    alerts?: UsageAlert[];
    /** Ledger/probe health for the data-health section; optional for older Hosts. */
    health?: UsageHealth;
    /** Official DeepSeek platform reconcile facts; optional for older Hosts. */
    platform?: UsagePlatformView;
    /** USD reference estimate for the selected window; optional. */
    costEstimate?: UsageCostEstimate;
    /** Rejected custom-plan fields, when the settings JSON could not be parsed. */
    customPlanErrors?: UsageCustomPlanError[];
    /**
     * Percent a longer plan window must reach before the composer ring features
     * it instead of the 5-hour window. Absent on older Hosts (treat as 100).
     */
    planPromotePercent?: number;
    /** The provider the pet bubble and the header highlight; `source` says how it was picked. */
    current: {
        provider?: string;
        model?: string;
        /** `live` — last request seen this boot; `default` — the agent default model. */
        source: 'live' | 'default';
        /**
         * Optional pi-ai / provider baseURL for the current route. The strip uses
         * this to bind Volcano / CPAMC external plans when the provider id itself
         * is a custom route name.
         */
        baseURL?: string;
    };
    /**
     * Configured/missing flags for CPAMC + Volcano secrets. Optional so an
     * older host document still renders the settings form without status chips.
     */
    externalCredentials?: ExternalCredentialStatus;
    usage: {
        today: {
            date: string;
            totals: UsageTokenTotals;
            providers: UsageProviderSummary[];
        };
        /** Last N local days ascending, including today. */
        days: UsageDaySummary[];
        /**
         * The same window aggregated per provider and model — the trend card's
         * bar-chart data. Optional so an older host document still renders.
         */
        range?: UsageWindowSummary;
        /**
         * The whole retained ledger (up to `retainDays`, today included)
         * aggregated per provider — the overview's all-time totals. Optional for
         * the same older-host tolerance as `range`.
         */
        all?: UsageWindowSummary;
    };
}
/**
 * Host-side snapshot state: the wire view plus one error slot per probed
 * fact. A probe half only clears its own slot, so a plan success can no
 * longer mask a failing balance probe (and vice versa); the overview
 * collapses them into the single wire `error` line, balance first.
 */
export interface ProviderSnapshotState extends ProviderSnapshotView {
    /** Last balance-probe failure; cleared on the next balance success. */
    balanceError?: string;
    /** Last plan-probe failure; cleared on the next plan success. */
    planError?: string;
}
//# sourceMappingURL=types.d.ts.map