/**
 * Number formatting shared by the page and the composer summary.
 *
 * Conventions follow the official surfaces: compact K/M/B with one decimal
 * below 100 (12345 -> 12.3k, 1234567 -> 1.2M), exact grouped integers for
 * dialogs/titles, cache-hit percentages that never round a partial hit up to
 * 100%, and explicit currency labels so CNY and USD are never mixed.
 * @module @linxin666/dsh-usage/client/format
 */
/** Compact token count in the official K/M conventions. */
export declare function formatTokens(value: number): string;
/** Exact grouped integer for dialogs/titles (official convention). */
export declare function formatExact(value: number): string;
/** Formatted CNY spend estimate. */
export declare function formatCost(cost: number): string;
/**
 * CNY reading that never invents a zero for an unpriced day: calls but no
 * priced bucket renders `—`; sub-cent spend renders `<¥0.01`.
 */
export declare function formatCny(cost: number, calls: number): string;
/** USD reference estimate; the currency label stays explicit. */
export declare function formatUsd(amount: number): string;
/**
 * Cache-hit reading with the official denominator (input + cacheRead +
 * cacheWrite). A partial hit never rounds up to 100%: the value is floored to
 * 0.1%, and 100% appears only when every billed token hit cache.
 */
export declare function cacheHitText(cacheRead: number, billed: number): string;
//# sourceMappingURL=format.d.ts.map