import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import { type UsageService } from './usage-service.ts';
import { type VersionChecker } from './version.ts';
export declare const USAGE_API_PREFIX = "/api/dsh-usage-plus";
/**
 * Whether an `If-None-Match` header names this ETag. Handles the list form,
 * weak validators (`W/"..."`), and the `*` wildcard.
 */
export declare function requestEtagMatches(ifNoneMatch: string, etag: string): boolean;
/**
 * Loopback-fenced overview route: provider balances, plan quotas, and token
 * usage totals. Personal account data, so the loopback fence mirrors
 * dsh-perf's stats surface; the browser runs on the same machine.
 *
 * Conditional GET: the browser-strip poller revalidates with
 * `If-None-Match`, so an unchanged document costs a 304 instead of a full
 * body every cadence.
 */
export declare function makeUsageOverviewRoute(service: UsageService): WebRoute;
/**
 * Loopback-fenced aggregate export of the usage ledger.
 *
 * `GET /api/dsh-usage-plus/export?format=csv|json&days=N` where `days` is an
 * integer 1..730 (default 182). The payload is ledger aggregates only — no
 * credential, session-content, or provider-secret value is read. CSV uses the
 * fixed column contract and a CRLF body; JSON serves the versioned document.
 */
export declare function makeUsageExportRoute(service: UsageService): WebRoute;
/**
 * Loopback-fenced per-day drill-down used by the Overview heatmap. Returns the
 * ledger's provider/model rows for one local date (zeros for a day with no
 * usage); future or malformed dates are client errors.
 */
export declare function makeUsageDayRoute(service: UsageService): WebRoute;
/**
 * Loopback-fenced external-source connection test used by the Settings
 * "test connection" button. The optional draft lets the probe use the values
 * currently typed into the form instead of the saved config; returns only
 * probe facts and hints, never a secret value.
 */
export declare function makeUsageTestRoute(service: UsageService): WebRoute;
/**
 * Loopback-fenced manual refresh: forces one probe cycle now and answers
 * with the fresh overview.
 */
export declare function makeUsageRefreshRoute(service: UsageService): WebRoute;
/**
 * Loopback-fenced update check: the running plugin version, the latest
 * published npm version (1h host-side TTL, npmmirror fallback), and whether
 * the latest is strictly newer. `updateAvailable` is null instead of false
 * when either side is unknown, so the client never claims "up to date" on a
 * failed check.
 */
export declare function makeUsageVersionRoute(checker: VersionChecker): WebRoute;
/**
 * Loopback-fenced write-only credential route for CPAMC management token and
 * Volcano AK/SK. Secrets land in the DSH credential store and never come back
 * on the wire — only ok/error plus a refreshed overview.
 */
export declare function makeUsageCredentialsRoute(service: UsageService): WebRoute;
/**
 * Loopback-fenced client-side diagnostics: the browser half appends one
 * NDJSON line per strip mount/state change so the failure point of the
 * quota meter is observable from the host filesystem (desktop shells may
 * have no devtools). Bounded to keep the file meaningful.
 */
export declare function makeUsageClientDiagRoute(): WebRoute;
//# sourceMappingURL=routes.d.ts.map