/**
 * Overview window contract shared by the store, the fetch layer and the UI.
 *
 * The Host serves `GET /api/dsh-usage-plus/overview?days=7|30|90|182` and
 * `GET /api/dsh-usage-plus/export?format=csv|json&days=N`; both paths are
 * built here so the selected window can never drift between the poller and
 * the export buttons.
 * @module @linxin666/dsh-usage/client/usage-api
 */
/** Windows the overview supports, shortest first (the segmented control order). */
export declare const USAGE_RANGE_DAYS: readonly [7, 30, 90, 182];
/** One supported overview window, in days. */
export type UsageRangeDays = (typeof USAGE_RANGE_DAYS)[number];
/** Default window matches the Host default when `days` is omitted. */
export declare const DEFAULT_USAGE_RANGE_DAYS: UsageRangeDays;
/** Whether `value` is one of the supported windows. */
export declare function isUsageRangeDays(value: unknown): value is UsageRangeDays;
/** The overview request path for one window (the ETag is per variant). */
export declare function overviewRequestPath(days: UsageRangeDays): string;
/** The export download path for one window and format. */
export declare function exportRequestPath(format: 'csv' | 'json', days: UsageRangeDays): string;
/** The per-day drill-down path (heatmap navigation). */
export declare function dayRequestPath(date: string): string;
//# sourceMappingURL=usage-api.d.ts.map