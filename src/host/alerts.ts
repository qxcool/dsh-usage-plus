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

import type { ProviderSnapshotView, UsageAlert } from '../core/types.ts'

/** Alert thresholds; each `0` disables its alert kind. */
export interface AlertThresholds {
  alertsEnabled: boolean
  /** Today's priced spend (CNY) that triggers the daily-cost alert. */
  dailyCostLimitCny: number
  /** Official plan-window percent that triggers the plan alert. */
  planAlertPercent: number
  /** Known CNY balance at/below which the balance alert triggers. */
  balanceAlertCny: number
}

/** Facts the evaluator reads from one overview document. */
export interface AlertFacts {
  /** Today's priced spend in CNY (`usage.today.totals.cost`). */
  todayCost: number
  /** Provider rows (after overview trimming/sorting). */
  providers: readonly ProviderSnapshotView[]
}

/** Result of one evaluation pass. */
export interface AlertEvaluation {
  /** Every active alert, in stable order (daily, plan, balance). */
  alerts: UsageAlert[]
  /** Alerts whose key was not active before: the caller may bubble these once. */
  started: UsageAlert[]
}

/** Stable episode key: `kind:provider:window` (empty for absent dimensions). */
export function alertKey(kind: string, provider?: string, window?: string): string {
  return `${kind}:${provider ?? ''}:${window ?? ''}`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Daily-cost alert candidate, or undefined when the threshold is off/unmet. */
function dailyCostAlert(todayCost: number, limitCny: number): Omit<UsageAlert, 'since'> | undefined {
  if (!isFiniteNumber(limitCny) || limitCny <= 0 || !isFiniteNumber(todayCost) || todayCost < limitCny * 0.8) return undefined
  const severity = todayCost >= limitCny ? 'critical' : 'warning'
  return {
    kind: 'daily-cost',
    severity,
    value: todayCost,
    threshold: limitCny,
    message: `Today's spend ${todayCost.toFixed(2)} CNY ${severity === 'critical' ? 'reached' : 'is near'} the ${limitCny.toFixed(2)} CNY limit`,
  }
}

/** Per-provider plan alert candidates, deduped to the tightest window. */
function planAlerts(providers: readonly ProviderSnapshotView[], threshold: number): Array<Omit<UsageAlert, 'since'>> {
  if (!isFiniteNumber(threshold) || threshold <= 0) return []
  const alerts: Array<Omit<UsageAlert, 'since'>> = []
  for (const provider of providers) {
    const windows = provider.plan?.windows
    if (!Array.isArray(windows)) continue
    let tightest: { key: string; percent: number } | undefined
    for (const window of windows) {
      if (typeof window?.percent !== 'number' || !Number.isFinite(window.percent)) continue
      if (tightest === undefined || window.percent > tightest.percent) tightest = { key: window.key, percent: window.percent }
    }
    if (tightest === undefined || tightest.percent < threshold) continue
    const severity = tightest.percent >= 95 ? 'critical' : 'warning'
    alerts.push({
      kind: 'plan-threshold',
      severity,
      provider: provider.provider,
      window: tightest.key,
      value: tightest.percent,
      threshold,
      message: `Plan window ${tightest.key} is at ${tightest.percent.toFixed(1)}% (alert threshold ${threshold}%)`,
    })
  }
  return alerts
}

/** Per-provider low-balance candidates (CNY balances only; the alert is CNY). */
function balanceAlerts(providers: readonly ProviderSnapshotView[], threshold: number): Array<Omit<UsageAlert, 'since'>> {
  if (!isFiniteNumber(threshold) || threshold <= 0) return []
  const alerts: Array<Omit<UsageAlert, 'since'>> = []
  for (const provider of providers) {
    const balance = provider.balance
    if (balance === undefined || typeof balance.currency !== 'string' || balance.currency.toUpperCase() !== 'CNY') continue
    const amount = Number(balance.totalBalance)
    if (!Number.isFinite(amount) || amount > threshold) continue
    const severity = amount <= threshold * 0.5 ? 'critical' : 'warning'
    alerts.push({
      kind: 'balance-low',
      severity,
      provider: provider.provider,
      value: amount,
      threshold,
      message: `Balance ${amount.toFixed(2)} CNY is ${severity === 'critical' ? 'critically' : ''} low (threshold ${threshold.toFixed(2)} CNY)`,
    })
  }
  return alerts
}

/**
 * Evaluate the current facts against the thresholds, updating `episodes` in
 * place. Disabled alerts (master switch off, or every threshold 0) produce an
 * empty list and clear the episode map so a later enable starts fresh.
 */
export function evaluateAlerts(
  facts: AlertFacts,
  thresholds: AlertThresholds,
  episodes: Map<string, number>,
  nowMs: number,
): AlertEvaluation {
  if (!thresholds.alertsEnabled) {
    episodes.clear()
    return { alerts: [], started: [] }
  }
  const dailyLimit = thresholds.dailyCostLimitCny
  const planThreshold = thresholds.planAlertPercent
  const balanceThreshold = thresholds.balanceAlertCny
  if (!(dailyLimit > 0) && !(planThreshold > 0) && !(balanceThreshold > 0)) {
    episodes.clear()
    return { alerts: [], started: [] }
  }

  const candidates: Array<Omit<UsageAlert, 'since'>> = []
  const daily = dailyCostAlert(facts.todayCost, dailyLimit)
  if (daily !== undefined) candidates.push(daily)
  candidates.push(...planAlerts(facts.providers, planThreshold))
  candidates.push(...balanceAlerts(facts.providers, balanceThreshold))

  const alerts: UsageAlert[] = []
  const started: UsageAlert[] = []
  const activeKeys = new Set<string>()
  for (const candidate of candidates) {
    const key = alertKey(candidate.kind, candidate.provider, candidate.window)
    activeKeys.add(key)
    let since = episodes.get(key)
    const isNew = since === undefined
    if (since === undefined) {
      since = nowMs
      episodes.set(key, since)
    }
    const alert: UsageAlert = { ...candidate, since }
    alerts.push(alert)
    if (isNew) started.push(alert)
  }
  for (const key of [...episodes.keys()]) {
    if (!activeKeys.has(key)) episodes.delete(key)
  }
  return { alerts, started }
}
