import z from "schemastery";
import { Context } from "@deepseek-ai/cordis";
import { SettingsNamespace } from "@deepseek-ai/dsh-settings";
//#region src/host/usage-service.d.ts
/** Poll-loop and announce options; re-applied live on settings change. */
interface UsageServiceOptions {
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
//#endregion
//#region src/index.d.ts
declare const name = "dsh-usage-plus";
declare const inject: string[];
declare const USAGE_SETTINGS_NAMESPACE: SettingsNamespace;
interface Config {
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
  volcanoEnabled?: boolean;
  volcanoAccessKeyEnv?: string;
  volcanoSecretKeyEnv?: string;
}
declare const Config: z<Config>;
interface ResolvedConfig extends UsageServiceOptions {
  enabled: boolean;
}
declare function resolveConfig(config?: Config): ResolvedConfig;
declare const apply: (ctx: Context, config?: Config) => void;
//#endregion
export { Config, ResolvedConfig, USAGE_SETTINGS_NAMESPACE, apply, inject, name, resolveConfig };
//# sourceMappingURL=index.d.ts.map