/**
 * Threshold alert evaluation: a pure, defensive fold from the facts the
 * overview already renders (today's priced spend, provider plan windows, known
 * balances) into the active `UsageAlert` list.
 *
 * Episodes live in a caller-owned `Map<key, since>`: a key that stays active
 * keeps its original `since`, a key whose condition clears is removed so a
 * later re-crossing starts a fresh episode. The evaluator never throws on
 * malformed facts — an unknown/missing fact simply produces no alert.
 * @module dsh-usage-plus/host/alerts
 */
import type { ProviderSnapshotView, UsageAlert } from '../core/types.ts';
/** Alert thresholds; each `0` disables its alert kind. */
export interface AlertThresholds {
    alertsEnabled: boolean;
    /** Today's priced spend (CNY) that triggers the daily-cost alert. */
    dailyCostLimitCny: number;
    /** Official plan-window percent that triggers the plan alert. */
    planAlertPercent: number;
    /** Known CNY balance at/below which the balance alert triggers. */
    balanceAlertCny: number;
}
/** Facts the evaluator reads from one overview document. */
export interface AlertFacts {
    /** Today's priced spend in CNY (`usage.today.totals.cost`). */
    todayCost: number;
    /** Provider rows (after overview trimming/sorting). */
    providers: readonly ProviderSnapshotView[];
}
/** Result of one evaluation pass. */
export interface AlertEvaluation {
    /** Every active alert, in stable order (daily, plan, balance). */
    alerts: UsageAlert[];
    /** Alerts whose key was not active before: the caller may bubble these once. */
    started: UsageAlert[];
}
/** Stable episode key: `kind:provider:window` (empty for absent dimensions). */
export declare function alertKey(kind: string, provider?: string, window?: string): string;
/**
 * Evaluate the current facts against the thresholds, updating `episodes` in
 * place. Disabled alerts (master switch off, or every threshold 0) produce an
 * empty list and clear the episode map so a later enable starts fresh.
 */
export declare function evaluateAlerts(facts: AlertFacts, thresholds: AlertThresholds, episodes: Map<string, number>, nowMs: number): AlertEvaluation;
//# sourceMappingURL=alerts.d.ts.map