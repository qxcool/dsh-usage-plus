/**
 * DeepSeek official peak/off-peak pricing: the published price book plus the
 * peak-window clock, folded into a per-call spend estimate the ledger stamps
 * at fold time (the provider bills each request in the period the request ran
 * in, so pricing at the fold is the honest estimate).
 *
 * Policy (api-docs.deepseek.com pricing page, effective 2026-09-10 12:00
 * Beijing): peak hours are Beijing time Monday-Friday 09:00-12:00 and
 * 14:00-18:00; every other hour (nights, weekends) is off-peak and billed at
 * half the peak price. All prices here are CNY per million tokens.
 *
 * The published rows are `deepseek-flash` (DeepSeek-V4.1-Flash) and
 * `deepseek-v4-pro` (DeepSeek-V4-Pro-0813). The retired flash ids
 * (`deepseek-v4-flash`, `deepseek-v4-flash-vision-exp`) stay accepted and bill
 * at the flash row; DeepSeek routes `deepseek-v4-pro` to V4.1-Flash from the
 * retirement instant below until V4.1 Pro ships.
 * @module @linxin666/dsh-usage/core/pricing
 */
import type { UsageTokenTotals } from './types.ts';
/**
 * The DeepSeek billing period at `ms`, plus when it next flips. The clock is
 * Beijing time regardless of the host timezone (UTC+8 has no DST, so a fixed
 * shift is exact). `boundaryMs` is the instant the current period ends — the
 * window's close while peaking, the next window's open otherwise.
 */
export declare function deepseekPeriodAt(ms: number): {
    peak: boolean;
    boundaryMs: number;
};
/**
 * Estimate one call's DeepSeek spend in CNY from its token totals, priced in
 * the billing period at `atMs`. Uncatalogued model ids take the flash-class
 * row; ids from other providers never reach this function (the service gates
 * by route family). Rounded to micro-CNY so the ledger stays readable.
 */
export declare function deepseekModelSpend(model: string, totals: Readonly<UsageTokenTotals>, atMs: number): number;
//# sourceMappingURL=pricing.d.ts.map