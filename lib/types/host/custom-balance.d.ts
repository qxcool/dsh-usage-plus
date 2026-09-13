/**
 * Custom HTTPS balance probe: user-configured URL + declarative extract rules.
 * Portions adapted from dsh-cost-meter (MIT).
 * @module dsh-usage-plus/host/custom-balance
 */
import type { Context } from '@deepseek-ai/cordis';
import { customBalanceCredentialVars, extractByRule } from '../core/custom-balance.ts';
import type { ProviderSnapshotState } from '../core/types.ts';
export { customBalanceCredentialVars, extractByRule };
export interface CustomBalanceConfig {
    enabled: boolean;
    label: string;
    currency: string;
    url: string;
    method: string;
    /** JSON object string; header values may use {{VAR}} placeholders. */
    headersJson: string;
    /**
     * Remaining-balance extract rule: a dotted path (`data.balance`) or a JSON
     * rule (`{"op":"divide","path":"data.quota","by":500000}`).
     */
    extractRemaining: string;
    /** Comma-separated hosts allowed when headers carry credentials. */
    allowedHosts: string;
}
/** Probe one custom HTTPS balance endpoint into a provider snapshot row. */
export declare function probeCustomBalance(ctx: Context, options: CustomBalanceConfig): Promise<ProviderSnapshotState[]>;
//# sourceMappingURL=custom-balance.d.ts.map