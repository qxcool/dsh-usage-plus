/**
 * Pure helpers for custom HTTPS balance extract rules and header templates.
 * @module dsh-usage-plus/core/custom-balance
 */
/** Evaluate one extract rule against a JSON body. Exported for unit tests. */
export declare function extractByRule(data: unknown, rule: unknown): number | string | null;
/** Collect `{{VAR}}` names from a headers JSON object string. */
export declare function customBalanceCredentialVars(headersJson: string): string[];
//# sourceMappingURL=custom-balance.d.ts.map