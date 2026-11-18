import z from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
//#region src/core/types.d.ts
/**
 * Official DeepSeek platform (billing console) facts plus the local ledger's
 * DeepSeek-only month cost, for the overview reconcile strip. Optional: the
 * platform endpoint is internal and may be unavailable/signed out.
 */
interface UsagePlatformView {
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
//#endregion
//#region src/core/pricing-book.d.ts
/** One model price row, USD per 1M tokens. */
interface PriceRow {
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
interface PriceBookLookups {
  /** Normalized `${provider}/${model}` (lowercase) → price row. */
  rows: Record<string, PriceRow>;
  /** Short model name (after the last `/`) → row keys carrying it. */
  byShortName: Record<string, string[]>;
  /** Canonical model id (`provider/model`, lowercase) → row keys mapped to it. */
  byCanonical: Record<string, string[]>;
}
/** A normalized price book plus the fetch instant (the on-disk cache shape). */
interface PriceBook extends PriceBookLookups {
  /** Epoch ms of the catalog fetch that produced this book. */
  fetchedAt: number;
  source: 'models.dev';
}
//#endregion
//#region src/host/usage-service.d.ts
/** Poll-loop and announce options; re-applied live on settings change. */
interface UsageServiceOptions {
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
//#endregion
//#region src/index.d.ts
declare const name = "dsh-usage-plus";
declare const inject: string[];
/**
 * Profile entry id declared by `cordis.patch.yml`.
 * DSH 0.1.7+ addresses configuration forms by this id (not a settings namespace).
 * @see https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/settings.md
 */
declare const USAGE_ENTRY_ID = "usage-plus";
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Volatile-only Config commit on this fiber.
     * @see vendor/loader README — Volatile configuration
     */
    'loader/volatile-update'(paths: readonly string[]): void;
  }
}
/** Plain config fields (after volatile refs are read via `.get()`). */
interface Config {
  enabled?: boolean;
  /** Provider probe cycle in seconds; 30-3600. */
  pollIntervalSec?: number;
  /** Pet bubble mode: always (refreshes each poll), change (only on value change), off. */
  bubbleMode?: string;
  /** Ledger retention in local days. */
  retainDays?: number;
  /** Master switch for threshold alerts (in-page banner + optional pet bubble). */
  alertsEnabled?: boolean;
  /** Today's priced spend limit in CNY; 0 disables the daily-cost alert. */
  dailyCostLimitCny?: number;
  /** Tightest official plan window percent that raises an alert; 0 disables it. */
  planAlertPercent?: number;
  /**
   * Percent a longer plan window must reach before it replaces the 5-hour
   * window in the composer ring. Default 100 (only a fully used window wins).
   */
  planPromotePercent?: number;
  /** Known provider balance (CNY) below which an alert is raised; 0 disables it. */
  balanceAlertCny?: number;
  /** Minutes before the same alert kind/provider/window may bubble again. */
  alertCooldownMinutes?: number;
  /** Read official DeepSeek platform billing for the reconcile strip (internal API). */
  platformUsageEnabled?: boolean;
  /** Estimate non-DeepSeek/global cost from the models.dev price book (USD reference). */
  costEstimateEnabled?: boolean;
  /** JSON array of generic custom plan sources (`[{id,name,url,...}]`); empty disables. */
  customPlans?: string;
  cpamcEnabled?: boolean;
  cpamcBaseURL?: string;
  cpamcManagementKeyEnv?: string;
  /** Comma-separated hosts allowed as CPAMC management origins beyond loopback. */
  cpamcAllowedHosts?: string;
  volcanoEnabled?: boolean;
  volcanoAccessKeyEnv?: string;
  volcanoSecretKeyEnv?: string;
}
/**
 * Cordis Config schema for the `usage-plus` profile row.
 * Every user-editable field is `.volatile()` so DSH projects it into a form
 * and keeps a live reference the plugin reads with `.get()`.
 * @see @deepseek-ai/dsh-settings README — "Forms expose only volatile fields"
 */
declare const Config: z<Schemastery.ObjectS<NoInfer<{
  enabled: z<boolean, boolean, "volatile-defined">;
  pollIntervalSec: z<number, number, "volatile-defined">;
  bubbleMode: z<string, string, "volatile-defined">;
  retainDays: z<number, number, "volatile-defined">;
  alertsEnabled: z<boolean, boolean, "volatile-defined">;
  dailyCostLimitCny: z<number, number, "volatile-defined">;
  planAlertPercent: z<number, number, "volatile-defined">;
  planPromotePercent: z<number, number, "volatile-defined">;
  balanceAlertCny: z<number, number, "volatile-defined">;
  alertCooldownMinutes: z<number, number, "volatile-defined">;
  platformUsageEnabled: z<boolean, boolean, "volatile-defined">;
  costEstimateEnabled: z<boolean, boolean, "volatile-defined">;
  customPlans: z<string, string, "volatile-defined">;
  cpamcEnabled: z<boolean, boolean, "volatile-defined">;
  cpamcBaseURL: z<string, string, "volatile-defined">;
  cpamcManagementKeyEnv: z<string, string, "volatile-defined">;
  cpamcAllowedHosts: z<string, string, "volatile-defined">;
  volcanoEnabled: z<boolean, boolean, "volatile-defined">;
  volcanoAccessKeyEnv: z<string, string, "volatile-defined">;
  volcanoSecretKeyEnv: z<string, string, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
  enabled: z<boolean, boolean, "volatile-defined">;
  pollIntervalSec: z<number, number, "volatile-defined">;
  bubbleMode: z<string, string, "volatile-defined">;
  retainDays: z<number, number, "volatile-defined">;
  alertsEnabled: z<boolean, boolean, "volatile-defined">;
  dailyCostLimitCny: z<number, number, "volatile-defined">;
  planAlertPercent: z<number, number, "volatile-defined">;
  planPromotePercent: z<number, number, "volatile-defined">;
  balanceAlertCny: z<number, number, "volatile-defined">;
  alertCooldownMinutes: z<number, number, "volatile-defined">;
  platformUsageEnabled: z<boolean, boolean, "volatile-defined">;
  costEstimateEnabled: z<boolean, boolean, "volatile-defined">;
  customPlans: z<string, string, "volatile-defined">;
  cpamcEnabled: z<boolean, boolean, "volatile-defined">;
  cpamcBaseURL: z<string, string, "volatile-defined">;
  cpamcManagementKeyEnv: z<string, string, "volatile-defined">;
  cpamcAllowedHosts: z<string, string, "volatile-defined">;
  volcanoEnabled: z<boolean, boolean, "volatile-defined">;
  volcanoAccessKeyEnv: z<string, string, "volatile-defined">;
  volcanoSecretKeyEnv: z<string, string, "volatile-defined">;
}>>, "plain">;
interface ResolvedConfig extends UsageServiceOptions {
  enabled: boolean;
  alertsEnabled: boolean;
  dailyCostLimitCny: number;
  planAlertPercent: number;
  planPromotePercent: number;
  balanceAlertCny: number;
  alertCooldownMinutes: number;
  platformUsageEnabled: boolean;
  costEstimateEnabled: boolean;
  customPlans: string;
}
/**
 * Snapshot loader Config (volatile refs or plain values) into a plain partial.
 * Presence-only: a ref currently holding `undefined` is dropped.
 */
declare function plainConfigInput(input?: Record<string, unknown>): Config;
/** Validate and normalize entry config for the usage service. */
declare function resolveConfig(input?: Record<string, unknown> | Config): ResolvedConfig;
declare const apply: (ctx: Context, input?: Record<string, unknown>) => void;
//#endregion
export { Config, ResolvedConfig, USAGE_ENTRY_ID, apply, inject, name, plainConfigInput, resolveConfig };
//# sourceMappingURL=index.d.ts.map