import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { UsageService } from './usage-service.ts';
export declare const USAGE_API_PREFIX = "/api/dsh-usage-plus";
/**
 * Loopback-fenced overview route: provider balances, plan quotas, and token
 * usage totals. Personal account data, so the loopback fence mirrors
 * dsh-perf's stats surface; the browser runs on the same machine.
 */
export declare function makeUsageOverviewRoute(service: UsageService): WebRoute;
/**
 * Loopback-fenced manual refresh: forces one probe cycle now and answers
 * with the fresh overview.
 */
export declare function makeUsageRefreshRoute(service: UsageService): WebRoute;
/**
 * Loopback-fenced write-only credential route for CPAMC management token and
 * Volcano AK/SK. Secrets land in the DSH credential store and never come back
 * on the wire — only ok/error plus a refreshed overview.
 */
export declare function makeUsageCredentialsRoute(service: UsageService): WebRoute;
//# sourceMappingURL=routes.d.ts.map