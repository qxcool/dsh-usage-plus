import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type UsageServiceOptions } from './host/usage-service.ts';
export declare const name = "dsh-usage-plus";
export declare const inject: string[];
/**
 * Profile entry id declared by `cordis.patch.yml`.
 * DSH 0.1.7+ addresses configuration forms by this id (not a settings namespace).
 * @see https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/settings.md
 */
export declare const USAGE_ENTRY_ID = "usage-plus";
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
export interface Config {
    enabled?: boolean;
    /** Provider probe cycle in seconds; 30-3600. */
    pollIntervalSec?: number;
    /** Pet bubble mode: always (refreshes each poll), change (only on value change), off. */
    bubbleMode?: string;
    /** Ledger retention in local days. */
    retainDays?: number;
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
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    enabled: z<boolean, boolean, "volatile-defined">;
    pollIntervalSec: z<number, number, "volatile-defined">;
    bubbleMode: z<string, string, "volatile-defined">;
    retainDays: z<number, number, "volatile-defined">;
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
    cpamcEnabled: z<boolean, boolean, "volatile-defined">;
    cpamcBaseURL: z<string, string, "volatile-defined">;
    cpamcManagementKeyEnv: z<string, string, "volatile-defined">;
    cpamcAllowedHosts: z<string, string, "volatile-defined">;
    volcanoEnabled: z<boolean, boolean, "volatile-defined">;
    volcanoAccessKeyEnv: z<string, string, "volatile-defined">;
    volcanoSecretKeyEnv: z<string, string, "volatile-defined">;
}>>, "plain">;
export interface ResolvedConfig extends UsageServiceOptions {
    enabled: boolean;
}
/**
 * Snapshot loader Config (volatile refs or plain values) into a plain partial.
 * Presence-only: a ref currently holding `undefined` is dropped.
 */
export declare function plainConfigInput(input?: Record<string, unknown>): Config;
/** Validate and normalize entry config for the usage service. */
export declare function resolveConfig(input?: Record<string, unknown> | Config): ResolvedConfig;
export declare const apply: (ctx: Context, input?: Record<string, unknown>) => void;
//# sourceMappingURL=index.d.ts.map