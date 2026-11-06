/**
 * Conversation-scoped usage view ("用量"): the current session's own token
 * totals, per-model split, cost, and the quota windows of the model it used.
 *
 * It deliberately does NOT repeat per-turn detail: the built-in Trajectory and
 * session-statistics views already own turn/step/timing tables, and the
 * Context view owns prompt composition. This view answers the other question —
 * "what did this conversation cost against which quota" — so it stays a
 * two-card surface: 计费口径 + 账号额度.
 * @module dsh-usage-plus/client/SessionUsageView
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { currentPlanProvider, orderedPlanWindows, planSourceLabelKey } from '../core/plan-match.ts'
import type { UsageSessionView, UsageTokenTotals } from '../core/types.ts'
import { formatPlanReset, t } from './locales.ts'
import type { UsageStoreInstance } from './usage-store.ts'
import styles from './usage.module.css'

/** Faster than the strip's cadence: this view only reads a local counter. */
const SESSION_POLL_MS = 10_000

export interface SessionUsageViewProps {
  /** Injected by the `conversation.view` slot for this session. */
  sessionId: string
  store: UsageStoreInstance
}

async function fetchSessionUsage(sessionId: string): Promise<UsageSessionView | undefined> {
  const response = await fetch(
    '/api/dsh-usage-plus/session?id=' + encodeURIComponent(sessionId),
    { signal: AbortSignal.timeout(10_000) },
  )
  // A host built before this view shipped answers 401/404 (the route does not
  // exist yet): the client half may be newer than the running host until the
  // process restarts.
  if (response.status === 404 || response.status === 401) return undefined
  if (!response.ok) throw new Error('usage session failed: ' + response.status)
  return (await response.json()) as UsageSessionView
}

/** Compact token counts: 1.2M / 34.5k / 987. */
function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value))
}

function formatCost(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `¥${value.toFixed(value >= 1 ? 2 : 4)}`
}

function totalOf(totals: UsageTokenTotals): number {
  return totals.inputTokens + totals.outputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
}

/** Billed input, the same "上下文" column the session statistics table shows. */
function contextOf(totals: UsageTokenTotals): number {
  return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
}

function percentText(value: number): string {
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}%`
}

function barClass(percent: number): string {
  if (percent >= 90) return `${styles.barFill} ${styles.barLow}`
  if (percent >= 70) return `${styles.barFill} ${styles.barWarn}`
  return styles.barFill
}

function clock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function durationText(firstAt: number, lastAt: number): string {
  const minutes = Math.max(0, Math.round((lastAt - firstAt) / 60_000))
  if (minutes < 1) return '<1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

/** The "用量" Conversation View body. */
export function SessionUsageView(props: SessionUsageViewProps): ReactNode {
  const ui = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot)
  const [usage, setUsage] = useState<UsageSessionView | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  /** False while the running host predates this view — needs a restart. */
  const [hostReady, setHostReady] = useState(true)

  useEffect(() => {
    let alive = true
    const load = (): void => {
      if (document.visibilityState !== 'visible') return
      fetchSessionUsage(props.sessionId).then((next) => {
        if (!alive) return
        setHostReady(next !== undefined)
        if (next !== undefined) setUsage(next)
        setError(undefined)
      }, (failure: unknown) => {
        if (!alive) return
        setError(failure instanceof Error ? failure.message : String(failure))
      })
    }
    load()
    const timer = window.setInterval(load, SESSION_POLL_MS)
    document.addEventListener('visibilitychange', load)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', load)
    }
  }, [props.sessionId])

  const totals = usage?.totals
  const route = usage?.route
  const identity = route?.provider === undefined
    ? t('usage.session.noRoute')
    : `${route.provider}${route.model !== undefined && route.model !== '' ? ` · ${route.model}` : ''}`

  // Quota is account-level; bind it to the route this session actually used.
  const matched = route?.provider !== undefined && ui.snapshot !== null
    ? currentPlanProvider(ui.snapshot, {
        provider: route.provider,
        ...(route.model !== undefined ? { model: route.model } : {}),
      })
    : undefined
  const windows = matched?.plan === undefined
    ? []
    : orderedPlanWindows(matched.plan).filter((window) => typeof window.percent === 'number')

  const settled = totals !== undefined && totals.calls > 0
  const billed = totals === undefined ? 0 : contextOf(totals)
  const hitRate = billed > 0 ? ((totals?.cacheReadTokens ?? 0) / billed) * 100 : null

  return (
    <div className={styles.section} data-dsh-plugin="usage" data-dsh-part="session-view">
      <div className={styles.header}>
        <span className={styles.currentProvider}>
          <span className={styles.identityName}>{identity}</span>
          <span className={styles.scopeChip}>{t('usage.scope.session')}</span>
        </span>
        <span className={styles.headerActions}>
          <span className={styles.muted}>
            {usage === undefined || usage.updatedAt === 0
              ? t('usage.session.noUsage')
              : `${clock(usage.updatedAt)} · ${durationText(usage.startedAt ?? usage.updatedAt, usage.updatedAt)}`}
          </span>
        </span>
      </div>

      {error !== undefined && <span className={styles.errorLine}>{error}</span>}
      {!hostReady && <span className={styles.muted}>{t('usage.session.needsRestart')}</span>}

      <div className={styles.card} data-dsh-part="session-totals-card">
        <div className={styles.cardHead}>
          <span className={styles.cardHeadGroup}>
            <span className={styles.cardTitle}>{t('usage.session.title')}</span>
            <span className={styles.scopeChip}>{t('usage.scope.session')}</span>
          </span>
          {settled && totals !== undefined && (
            <span className={styles.cardSummary}>
              {totals.cost > 0 ? formatCost(totals.cost) : t('usage.metric.unpriced')}
            </span>
          )}
        </div>
        {usage === undefined || !settled || totals === undefined
          ? <span className={styles.muted}>{t('usage.session.noUsage')}</span>
          : <>
              <div className={styles.kpiGrid}>
                <div className={styles.kpiTile}>
                  <span className={styles.kpiValue}>{formatTokens(billed)}</span>
                  <span className={styles.kpiLabel}>{t('usage.session.context')}</span>
                  <span className={styles.kpiHint}>
                    {t('usage.tokens.cacheRatio', {
                      read: formatTokens(totals.cacheReadTokens),
                      billed: formatTokens(billed),
                    })}
                  </span>
                </div>
                <div className={styles.kpiTile}>
                  <span className={styles.kpiValue}>{formatTokens(totals.outputTokens)}</span>
                  <span className={styles.kpiLabel}>{t('usage.session.output')}</span>
                  <span className={styles.kpiHint}>{formatTokens(totalOf(totals))} {t('usage.tokens.total')}</span>
                </div>
                <div className={styles.kpiTile}>
                  <span className={`${styles.kpiValue} ${hitRate !== null && hitRate >= 90 ? styles.kpiGood : ''}`}>
                    {hitRate === null ? '—' : percentText(hitRate)}
                  </span>
                  <span className={styles.kpiLabel}>{t('usage.session.cacheHit')}</span>
                  <span className={styles.kpiHint}>{formatTokens(totals.cacheReadTokens)}</span>
                </div>
                <div className={styles.kpiTile}>
                  <span className={styles.kpiValue}>{totals.calls}</span>
                  <span className={styles.kpiLabel}>{t('usage.session.calls')}</span>
                  <span className={styles.kpiHint}>
                    {usage.startedAt !== undefined
                      ? `${clock(usage.startedAt)}–${clock(usage.updatedAt)}`
                      : ''}
                  </span>
                </div>
              </div>
              {usage.models.length > 0 && (
                <div className={styles.bucketGrid} data-dsh-part="session-models">
                  <span className={styles.subTitle}>{t('usage.session.models')}</span>
                  {usage.models.map((row) => (
                    <div key={row.model} className={styles.modelRow}>
                      <span className={styles.modelName}>{row.model}</span>
                      <span className={styles.providerTokens}>
                        {formatTokens(totalOf(row.totals))}
                        {' · '}
                        {t('usage.calls', { n: row.totals.calls })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>}
      </div>

      {windows.length > 0 && matched !== undefined && (
        <div className={styles.card} data-dsh-part="session-plan-card">
          <div className={styles.cardHead}>
            <span className={styles.cardHeadGroup}>
              <span className={styles.cardTitle}>{t('usage.plan.quota')}</span>
              <span className={styles.scopeChip}>{t('usage.scope.account')}</span>
            </span>
            <span className={styles.sourceChip}>{t(planSourceLabelKey(matched))}</span>
          </div>
          {windows.map((window) => {
            const percent = window.percent as number
            return (
              <div key={window.key} className={styles.windowRow} data-dsh-part="session-plan-window">
                <span className={styles.windowLabel}>
                  <span>{window.name ?? t(`usage.plan.windows.${window.key}`)}</span>
                  <span>{percentText(percent)}</span>
                </span>
                <span className={styles.bar}>
                  <span className={barClass(percent)} style={{ width: `${Math.min(100, Math.max(0, percent))}%`, display: 'block' }} />
                </span>
                {window.resetsAt !== undefined ? <span className={styles.resetLine}>{formatPlanReset(window.resetsAt)}</span> : null}
              </div>
            )
          })}
        </div>
      )}

      <span className={styles.muted}>{t('usage.session.hint')}</span>
    </div>
  )
}
