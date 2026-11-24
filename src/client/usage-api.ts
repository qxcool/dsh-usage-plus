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
export const USAGE_RANGE_DAYS = [7, 30, 90, 182] as const

/** One supported overview window, in days. */
export type UsageRangeDays = (typeof USAGE_RANGE_DAYS)[number]

/** Default window matches the Host default when `days` is omitted. */
export const DEFAULT_USAGE_RANGE_DAYS: UsageRangeDays = 30

/** Whether `value` is one of the supported windows. */
export function isUsageRangeDays(value: unknown): value is UsageRangeDays {
  return typeof value === 'number' && (USAGE_RANGE_DAYS as readonly number[]).includes(value)
}

/** The overview request path for one window (the ETag is per variant). */
export function overviewRequestPath(days: UsageRangeDays): string {
  return `/api/dsh-usage-plus/overview?days=${days}`
}

/** The export download path for one window and format. */
export function exportRequestPath(format: 'csv' | 'json', days: UsageRangeDays): string {
  return `/api/dsh-usage-plus/export?format=${format}&days=${days}`
}

/** The per-day drill-down path (heatmap navigation). */
export function dayRequestPath(date: string): string {
  return `/api/dsh-usage-plus/day?date=${encodeURIComponent(date)}`
}

/** The plugin update-check path (loopback-fenced, host-side 1h TTL). */
export function versionRequestPath(): string {
  return '/api/dsh-usage-plus/version'
}
