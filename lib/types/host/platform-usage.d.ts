/**
 * Official DeepSeek platform (billing console) facts, read with the host's own
 * logged-in platform grant. The console API is internal and undocumented, so
 * every failure degrades to a typed `UsagePlatformView` instead of throwing:
 * signed out means `unavailable`, an expired grant or a bad upstream response
 * means `error` with a short credential-free message.
 *
 * The token comes from DSH itself — `deepseekAccount.getPlatformSession()`
 * when that service is present, else the `deepseek-account-platform/default`
 * grant record — so the user never pastes a console token. Response
 * normalization is adapted from DeepSeek-Usage (MIT, commit 0cba805f94); this
 * module reads cost facts only (no per-model token/amount detail).
 * @module @linxin666/dsh-usage-plus/host/platform-usage
 */
import type { Context } from '@deepseek-ai/cordis';
import type { UsagePlatformView } from '../core/types.ts';
/** Default console origin. */
export declare const PLATFORM_ORIGIN = "https://platform.deepseek.com";
/** Desktop Chrome UA; the upstream rate-limits (429) requests without one. */
export declare const PLATFORM_DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
/** Console client version header; the upstream 429s without it too. */
export declare const PLATFORM_APP_VERSION = "0.1.0";
/** Options for {@link fetchPlatformUsage}; every seam is injectable for tests. */
export interface PlatformUsageOptions {
    /** Fetch implementation; defaults to the global `fetch`. */
    fetch?: typeof fetch;
    /** Clock; defaults to `Date.now`. */
    now?: () => number;
    /** Console origin override (tests / a relocated console). */
    origin?: string;
    /** `x-app-version` override; defaults to {@link PLATFORM_APP_VERSION}. */
    appVersion?: string;
    /** `user-agent` override; defaults to {@link PLATFORM_DESKTOP_USER_AGENT}. */
    userAgent?: string;
    /** Query month (1-12) override; defaults to the current local month. */
    month?: number;
    /** Query year override; defaults to the current local year. */
    year?: number;
    /** Per-request timeout in ms; defaults to 10s. */
    timeoutMs?: number;
    /** Delay before the single 429/5xx retry in ms; defaults to 500. */
    retryDelayMs?: number;
}
/** One official per-day cost fact. */
export interface PlatformCostDay {
    /** Local-date key `YYYY-MM-DD`. */
    date: string;
    /** Official spend for that day in CNY. */
    cost: number;
}
/** Month/year context used to resolve bare day-of-month rows and filter days. */
export interface PlatformCostDaysOptions {
    /** Calendar month 1-12. When both month and year are given, other months are dropped. */
    month?: number;
    /** Calendar year. */
    year?: number;
}
/** All-time facts read from `get_user_summary`. */
export interface PlatformSummaryFacts {
    /** Lifetime spend in CNY (`total_costs`); absent when the API reports none. */
    cumulativeCost?: number;
}
/** The resolved platform grant. */
export interface PlatformToken {
    token: string;
    /** Origin the session belongs to, when the account service reports one. */
    origin?: string;
}
/**
 * Normalize the `/usage/cost` payload to sorted official day rows.
 *
 * Tolerates the console's envelope drift (`biz_data` object/array/JSON string),
 * a bare array of day rows, and per-API-key rows carrying a `days` array.
 * Duplicate dates are summed. When both `month` and `year` are supplied, days
 * outside that calendar month are dropped (the console can return neighbours).
 */
export declare function normalizePlatformCostDays(payload: unknown, options?: PlatformCostDaysOptions): PlatformCostDay[];
/**
 * Normalize `get_user_summary` to the all-time CNY spend. Wallet balances are
 * deliberately ignored: the reconcile strip only needs `total_costs`, and the
 * balance card already reads DeepSeek's public `/user/balance` endpoint.
 */
export declare function normalizePlatformSummary(payload: unknown): PlatformSummaryFacts;
/**
 * Resolve the host's platform grant: prefer the live `deepseekAccount` session,
 * fall back to the stored `deepseek-account-platform/default` grant record.
 * Returns undefined when neither source yields a token; never throws.
 */
export declare function resolvePlatformToken(ctx: Context): Promise<PlatformToken | undefined>;
/**
 * Read the official DeepSeek platform month cost, lifetime cost and per-day
 * month cost through the host's own platform grant.
 *
 * Never throws. Returns `unavailable` (no network call) when no grant is
 * resolvable, `error` with a short message when the upstream rejects or
 * misbehaves, and `ready` with official CNY facts otherwise. `localMonthCost`,
 * `coverage` and `delta` are the integrating service's ledger facts, so they
 * are intentionally not filled here.
 */
export declare function fetchPlatformUsage(ctx: Context, options?: PlatformUsageOptions): Promise<UsagePlatformView>;
//# sourceMappingURL=platform-usage.d.ts.map