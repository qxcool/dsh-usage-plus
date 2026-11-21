/**
 * The usage statistics settings section: overview (today's usage, plan
 * quotas, trend), plan windows, and settings. Data comes from the host's
 * loopback-fenced /api/dsh-usage-plus/overview document; polling runs only
 * while the section is mounted and the tab is visible.
 *
 * The overview is a quiet instrument panel: one hero figure for today, a
 * compact comparator group, then the 26-week activity heatmap and the account
 * quota rings as the two rich moments. Every derived value is formatted from
 * the host document; the component invents no numbers.
 * @module dsh-usage-plus/client/UsageSectionCard
 */

import { memo, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import type { UsageStoreInstance } from './usage-store.ts'
import { CustomPlanEditor } from './CustomPlanEditor.tsx'
import { formatPlanReset, friendlyCustomPlanError, friendlyProbeError, isCpamcLoopbackUrl, t } from './locales.ts'
import { PlanUsageStrip } from './PlanUsageStrip.tsx'
import styles from './usage.module.css'
import { isDeepSeekProviderRoute } from '../core/adapters.ts'
import { buildHeatmapGrid, HEATMAP_WEEKS, type HeatmapCell } from '../core/heatmap.ts'
import { currentPlanProvider, isPlanWindowFull, orderedPlanWindows, planSourceLabelKey, planTabProviders } from '../core/plan-match.ts'
import { deepseekPeriodAt } from '../core/pricing.ts'
import type { ExternalCredentialStatus, ExternalCredentialTarget, ProviderSnapshotView, UsageAlert, UsageCostEstimate, UsageCustomPlanError, UsageDayDetail, UsageDaySummary, UsageHealth, UsageOverviewView, UsagePlatformView, UsageProviderSummary, UsageTokenTotals } from '../core/types.ts'
import { dayRequestPath, exportRequestPath, USAGE_RANGE_DAYS, type UsageRangeDays } from './usage-api.ts'
import { cacheHitText, formatCost, formatCny, formatExact, formatTokens, formatUsd } from './format.ts'

export { formatExact, formatTokens } from './format.ts'

/** The settings fields this section edits (staged Save via configForms.mutate). */
export interface UsageSettings {
  enabled?: boolean
  pollIntervalSec?: number
  bubbleMode?: string
  /** Master switch for threshold alerts (Overview banner + strip warning dot). */
  alertsEnabled?: boolean
  /** Today's priced spend limit in CNY; 0 disables the daily-cost alert. */
  dailyCostLimitCny?: number
  /** Tightest official plan window percent that raises an alert; 0 disables it. */
  planAlertPercent?: number
  /** Percent a longer plan window must reach before it replaces 5h in the ring. */
  planPromotePercent?: number
  /** Known provider balance (CNY) below which an alert is raised; 0 disables it. */
  balanceAlertCny?: number
  /** Minutes before the same alert kind/provider/window may bubble again. */
  alertCooldownMinutes?: number
  cpamcEnabled?: boolean
  cpamcBaseURL?: string
  cpamcManagementKeyEnv?: string
  cpamcAllowedHosts?: string
  volcanoEnabled?: boolean
  /** v0.6.0: read official DeepSeek platform billing for the reconcile strip. */
  platformUsageEnabled?: boolean
  /** v0.6.0: estimate USD from the models.dev price book. */
  costEstimateEnabled?: boolean
  /** v0.6.1: JSON array of generic custom plan sources. */
  customPlans?: string
}

/**
 * Subset of `ctx.configForms.get(entryId)` used by this page.
 * @see @deepseek-ai/dsh-client-ui-settings — Configuration forms
 */
export interface UsageConfigForm {
  getSnapshot(): {
    status: string
    value?: UsageSettings
    writable: boolean
    revision?: number
  }
  subscribe(listener: () => void): () => void
  set(field: keyof UsageSettings, value: unknown): Promise<boolean>
  /** Atomic multi-field write (preferred for Save on the bundle configuration page). */
  mutate(
    ops: ReadonlyArray<{ op: 'set'; path: readonly string[]; value: unknown } | { op: 'unset'; path: readonly string[] }>,
    expectedRevision?: number,
  ): Promise<boolean>
}

/** Result of the Settings "test connection" call (secret-free). */
interface UsageSourceTestResult {
  target: 'cpamc' | 'volcano' | 'custom'
  /** Custom-plan id this result belongs to. */
  id?: string
  ok: boolean
  latencyMs: number
  accounts?: number
  windows?: Array<{ key: string; percent?: number; resetsAt?: string }>
  error?: string
  hint?: string
}

/** The registration-side face the bundle configuration page injects. */
export interface UsageSectionFace {
  /** The section-local store (overview snapshot + lifecycle). */
  store: UsageStoreInstance
  /** Fetch one overview now. */
  poll: () => void
  /** Select the overview window; the shared poller repolls with the new range. */
  setRangeDays: (days: UsageRangeDays) => void
  /** Force a host probe cycle now (resolves with the fresh overview). */
  refresh: () => void
  /** Shared configuration form for the `usage-plus` profile entry. */
  settings: UsageConfigForm
  /** Acquire the shared composer-strip poller (same lifecycle as the dock strip). */
  startStripPolling: () => () => void
  /** Write one external secret into the host credential store (write-only). */
  setCredential: (target: ExternalCredentialTarget, value: string) => Promise<void>
  /** Remove one external secret from the host credential store. */
  clearCredential: (target: ExternalCredentialTarget) => Promise<void>
}

export interface UsageSectionProps extends UsageSectionFace {
  /**
   * Plugins page view discriminator (`PluginConfigViewProps.view`).
   * `summary` — one-liner under the card title; `page` — full form.
   */
  view?: 'summary' | 'page'
}

/** Poll cadence while the section is open. */
const SECTION_POLL_MS = 10_000

/**
 * A document older than this is presented as stale: the freshness dot next to
 * `更新于` dims and the exact timestamp still carries the truth.
 */
const FRESH_WINDOW_MS = 30_000

/** How many model sub-bars render under one provider bar. */
const CHART_MODEL_CAP = 3

/** One heatmap value metric; the intensity levels stay quartile-based. */
type HeatmapMetric = 'tokens' | 'calls' | 'cost'

function formatTime(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString()
  } catch {
    return ''
  }
}

function formatClock(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/** One percent reading, same format everywhere in the panel. */
function percentText(value: number): string {
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}%`
}

function totalOf(totals: UsageTokenTotals): number {
  return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens
}

function cacheHitRate(totals: UsageTokenTotals): number | null {
  const billed = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
  if (billed <= 0) return null
  return (totals.cacheReadTokens / billed) * 100
}

/** A provider row backed by a configured credential (api key, env key, or OAuth grant). */
function isConfigured(provider: ProviderSnapshotView): boolean {
  // An older wire document without the credential field renders as before.
  return provider.credential !== 'none'
}

function balanceAmount(provider: ProviderSnapshotView): number | null {
  if (provider.balance === undefined) return null
  const raw = Number(provider.balance.totalBalance)
  return Number.isFinite(raw) ? raw : null
}

function balanceStatus(provider: ProviderSnapshotView): string {
  const amount = balanceAmount(provider)
  if (amount === null) return t('usage.balance.empty')
  if (amount <= 5) return t('usage.balance.low')
  return t('usage.balance.ok')
}

function balanceText(provider: ProviderSnapshotView): string | null {
  if (provider.balance === undefined) return null
  const currency = provider.balance.currency.toUpperCase()
  const prefix = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : ''
  const suffix = currency !== 'CNY' && currency !== 'USD' ? ` ${currency}` : ''
  return `${prefix}${provider.balance.totalBalance}${suffix}`
}

/** Only providers with a real balance fact — skip unconfigured / unsupported noise. */
function balanceCardRows(providers: ProviderSnapshotView[]): ProviderSnapshotView[] {
  const seen = new Set<string>()
  const rows: ProviderSnapshotView[] = []
  for (const provider of providers) {
    if (!isConfigured(provider) || balanceText(provider) === null) continue
    const key = `${provider.displayName.trim().toLowerCase()}|${balanceText(provider)}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(provider)
  }
  return rows
}

/**
 * Fill classes for one plan window. `barFill` always rides along because it
 * owns the fill's non-colour geometry (height, radius, transition); `barWarn`
 * and `barLow` only override the colour. Returning a colour class alone
 * collapses the inner span to zero height, so a >=70% window renders blank
 * while a lower one looks fine. Mirrors `barTone` in PlanUsageStrip.
 */
function toneClass(percent: number): string {
  if (percent >= 90) return `${styles.barFill} ${styles.barLow}`
  if (percent >= 70) return `${styles.barFill} ${styles.barWarn}`
  return styles.barFill
}

// ---------------------------------------------------------------------------
// Small inline line icons: one 16px box, one 1.5 stroke, text-colour inherited.
// ---------------------------------------------------------------------------

function RefreshIcon(props: { spinning?: boolean }): ReactNode {
  return (
    <svg className={props.spinning === true ? `${styles.icon} ${styles.iconSpin}` : styles.icon} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

function ChevronIcon(props: { open: boolean }): ReactNode {
  return (
    <svg className={props.open ? `${styles.icon} ${styles.iconOpen}` : styles.icon} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Token composition: one stacked share bar with a quiet legend.
// ---------------------------------------------------------------------------

const TokenComposition = memo(function TokenComposition(props: { totals: UsageTokenTotals }): ReactNode {
  const { totals } = props
  const segments = useMemo(() => {
    const rows: Array<{ key: string; label: string; value: number; cls: string }> = [
      { key: 'cacheRead', label: t('usage.tokens.cacheRead'), value: totals.cacheReadTokens, cls: styles.segCache },
      { key: 'input', label: t('usage.tokens.input'), value: totals.inputTokens, cls: styles.segInput },
      { key: 'cacheWrite', label: t('usage.tokens.cacheWrite'), value: totals.cacheWriteTokens, cls: styles.segWrite },
      { key: 'output', label: t('usage.tokens.output'), value: totals.outputTokens, cls: styles.segOutput },
    ]
    if (totals.reasoningTokens > 0) {
      rows.push({ key: 'reasoning', label: t('usage.tokens.reasoning'), value: totals.reasoningTokens, cls: styles.segReasoning })
    }
    return rows
  }, [totals])
  const sum = useMemo(() => segments.reduce((acc, segment) => acc + segment.value, 0), [segments])
  return (
    <div className={styles.composition} data-dsh-part="token-composition">
      <div className={styles.compositionHead}>
        <span className={styles.subTitle}>{t('usage.tokens.buckets')}</span>
        <span className={styles.mono}>{formatTokens(sum)}</span>
      </div>
      <div className={styles.stackBar}>
        {sum === 0
          ? <span className={styles.stackEmpty} />
          : segments.filter((segment) => segment.value > 0).map((segment) => (
              <span
                key={segment.key}
                className={`${styles.stackSeg} ${segment.cls}`}
                style={{ flexGrow: segment.value }}
                title={`${segment.label} ${formatTokens(segment.value)}`}
              />
            ))}
      </div>
      <div className={styles.legend}>
        {segments.map((segment) => (
          <span key={segment.key} className={styles.legendItem}>
            <i className={`${styles.legendDot} ${segment.cls}`} aria-hidden="true" />
            <span className={styles.legendLabel}>{segment.label}</span>
            <span className={`${styles.legendValue} ${styles.mono}`}>{formatTokens(segment.value)}</span>
          </span>
        ))}
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Today's provider breakdown.
// ---------------------------------------------------------------------------

const ProviderBreakdown = memo(function ProviderBreakdown(props: {
  rows: UsageProviderSummary[]
  providers: ProviderSnapshotView[]
  current?: string
}): ReactNode {
  const { rows, providers, current } = props
  // The current route's model split is the interesting part of "today", so it
  // starts expanded; every row still toggles.
  const [open, setOpen] = useState<Record<string, boolean>>(() => (
    current === undefined ? {} : { [current]: true }
  ))
  const derived = useMemo(() => {
    const byProvider = new Map(providers.map((provider) => [provider.provider, provider]))
    const total = rows.reduce((acc, row) => acc + totalOf(row.totals), 0)
    return { byProvider, total }
  }, [providers, rows])
  if (rows.length === 0) return null
  return (
    <div className={styles.providerList} data-dsh-part="provider-list">
      <span className={styles.subTitle}>{t('usage.today.breakdown')}</span>
      {rows.map((row) => {
        const provider = derived.byProvider.get(row.provider)
        const expanded = open[row.provider] === true
        const hasModels = row.models.length > 0
        const balance = provider === undefined ? null : balanceText(provider)
        const total = totalOf(row.totals)
        const share = derived.total > 0 ? Math.round((total / derived.total) * 100) : 0
        const accent = current === row.provider
        return (
          <div key={row.provider} className={styles.providerBlock} data-accent={accent ? 'yes' : 'no'}>
            <button
              type="button"
              className={styles.providerRow}
              disabled={!hasModels}
              aria-expanded={hasModels ? expanded : undefined}
              onClick={() => {
                if (!hasModels) return
                setOpen((prev) => ({ ...prev, [row.provider]: !expanded }))
              }}
            >
              <span className={styles.providerLead}>
                <i className={styles.providerDot} aria-hidden="true" />
                <span className={styles.providerName}>{provider?.displayName ?? row.provider}</span>
                {accent && <span className={styles.currentBadge}>{t('usage.current')}</span>}
              </span>
              <span className={styles.providerMeta}>
                {balance !== null && <span className={styles.providerBalance}>{balance}</span>}
                <span className={styles.providerTokens}>
                  {formatTokens(total)}
                  <span className={styles.dim}>{` · ${t('usage.calls', { n: row.totals.calls })}`}</span>
                  {row.totals.cost > 0 ? <span className={styles.dim}>{` · ${formatCost(row.totals.cost)}`}</span> : null}
                </span>
                <span className={`${styles.providerShare} ${styles.mono}`}>{share}%</span>
                {hasModels ? <ChevronIcon open={expanded} /> : <span className={styles.iconSpacer} aria-hidden="true" />}
              </span>
            </button>
            <span className={styles.providerTrack} aria-hidden="true">
              <span className={styles.providerFill} style={{ width: `${Math.max(1.5, share)}%` }} />
            </span>
            {expanded && row.models.map((model) => {
              const modelTotal = totalOf(model.totals)
              const modelShare = total > 0 ? Math.round((modelTotal / total) * 100) : 0
              return (
                <div key={model.model} className={styles.modelRow}>
                  <span className={styles.modelName}>{model.model}</span>
                  <span className={styles.modelMeta}>
                    <span className={`${styles.mono}`}>{formatTokens(modelTotal)}</span>
                    <span className={styles.dim}>{t('usage.calls', { n: model.totals.calls })}</span>
                    {model.totals.cost > 0 ? <span className={styles.dim}>{formatCost(model.totals.cost)}</span> : null}
                    <span className={`${styles.modelShare} ${styles.mono}`}>{modelShare}%</span>
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
})

/** Balance rows not already shown beside today's provider breakdown. */
function BalanceInline(props: {
  providers: ProviderSnapshotView[]
  current?: string
  excludeIds: Set<string>
}): ReactNode {
  const rows = balanceCardRows(props.providers).filter((provider) => !props.excludeIds.has(provider.provider))
  if (rows.length === 0) return null
  return (
    <div className={styles.balanceInline} data-dsh-part="balance-inline">
      <span className={styles.subTitle}>{t('usage.balance')}</span>
      {rows.map((provider) => {
        const amount = balanceAmount(provider)
        const low = amount !== null && amount <= 5
        return (
          <div key={provider.provider} className={styles.balanceRow}>
            <span className={styles.balanceLead}>
              <i className={`${styles.statusDot} ${low ? styles.statusWarn : styles.statusOk}`} aria-hidden="true" />
              <span className={styles.providerName}>
                {provider.displayName}
                {props.current === provider.provider && <span className={styles.currentBadge}>{t('usage.current')}</span>}
              </span>
            </span>
            <span className={styles.balanceMeta}>
              <span className={`${styles.balanceAmount} ${styles.mono}`}>{balanceText(provider)}</span>
              <span className={styles.balanceHint}>{balanceStatus(provider)}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero: one figure carries the panel, the rest is a quiet comparator group.
// ---------------------------------------------------------------------------

function Stat(props: { label: string; value: string; hint?: string }): ReactNode {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{props.label}</span>
      <span className={styles.statValue}>{props.value}</span>
      {props.hint !== undefined ? <span className={styles.statHint}>{props.hint}</span> : null}
    </div>
  )
}

/**
 * One ring gauge. The arc is drawn on a fixed viewBox so every ring in the
 * panel (hero cache hit, quota windows) shares one geometry.
 */
function Ring(props: { percent: number | null; size: number; stroke: number; tone: string; valueText?: string }): ReactNode {
  const { percent, size, stroke, tone, valueText } = props
  const radius = size / 2 - stroke / 2 - 1
  const circumference = 2 * Math.PI * radius
  const clamped = percent === null ? 0 : Math.min(100, Math.max(0, percent))
  return (
    <span className={styles.ringBox} style={{ width: size, height: size }}>
      <svg className={styles.ringSvg} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className={styles.ringTrack} cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        {percent !== null && (
          <circle
            className={`${styles.ringFill} ${tone}`}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span className={`${styles.ringValue} ${styles.mono}`}>{valueText ?? (percent === null ? '—' : `${Math.round(clamped)}%`)}</span>
    </span>
  )
}

function HeroBand(props: {
  todayTokens: number
  todayCalls: number
  todayCost: number
  tokenDelta: number | null
  rangeTokens: number
  rangeCalls: number
  allTokens: number
  allCalls: number
  hitRate: number | null
  cacheRead: number
  billed: number
  avgCost: number | null
  rangeDays: UsageRangeDays
}): ReactNode {
  const hitTone = props.hitRate === null
    ? styles.toneAccent
    : props.hitRate >= 90
      ? styles.toneGood
      : props.hitRate >= 60
        ? styles.toneAccent
        : styles.toneWarn
  return (
    <section className={`${styles.card} ${styles.hero}`} data-dsh-part="hero">
      <div className={styles.heroToday}>
        <span className={styles.heroLabel}>{`${t('usage.summary.today')} ${t('usage.tokens.total')}`}</span>
        <div className={styles.heroFigure}>
          <span className={styles.heroValue}>{formatTokens(props.todayTokens)}</span>
          {props.tokenDelta !== null && (
            <span className={styles.delta} data-dir={props.tokenDelta >= 0 ? 'up' : 'down'}>
              <span className={`${styles.deltaValue} ${styles.mono}`}>{props.tokenDelta >= 0 ? '+' : ''}{Math.round(props.tokenDelta)}%</span>
              <span className={styles.deltaLabel}>{t('usage.vsYesterday')}</span>
            </span>
          )}
        </div>
        <span className={styles.heroHint}>
          {props.todayCost > 0
            ? `${t('usage.calls', { n: props.todayCalls })} · ${formatCost(props.todayCost)}`
            : t('usage.calls', { n: props.todayCalls })}
        </span>
      </div>
      <div className={styles.statGroup}>
        <Stat
          label={t('usage.range.window', { n: props.rangeDays })}
          value={formatTokens(props.rangeTokens)}
          hint={t('usage.calls', { n: props.rangeCalls })}
        />
        <Stat
          label={t('usage.summary.all')}
          value={formatTokens(props.allTokens)}
          hint={t('usage.calls', { n: props.allCalls })}
        />
        <Stat
          label={t('usage.tokens.calls')}
          value={String(props.todayCalls)}
          hint={`${formatTokens(props.todayTokens)} ${t('usage.tokens.total')}`}
        />
        <Stat
          label={t('usage.metric.avgCost')}
          value={props.avgCost === null ? '—' : formatCost(props.avgCost)}
          hint={props.avgCost === null && props.todayCalls > 0
            ? t('usage.metric.unpriced')
            : t('usage.metric.avgCostHint', { n: props.todayCalls })}
        />
      </div>
      <div className={styles.heroRing}>
        <Ring percent={props.hitRate} size={84} stroke={7} tone={hitTone} valueText={cacheHitText(props.cacheRead, props.billed)} />
        <span className={styles.heroRingLabel}>{t('usage.tokens.cacheHit')}</span>
        <span className={styles.heroRingHint}>
          {t('usage.tokens.cacheRatio', {
            read: formatTokens(props.cacheRead),
            billed: formatTokens(props.billed),
          })}
        </span>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 26-week activity heatmap: the main chart.
// ---------------------------------------------------------------------------

interface MonthRun {
  label: string
  start: number
  span: number
}

/** Group the per-week month labels into runs so each label starts on its column. */
function monthRuns(labels: string[]): MonthRun[] {
  const starts: number[] = []
  labels.forEach((label, index) => {
    if (label !== '') starts.push(index)
  })
  return starts
    .map((start, index) => ({
      label: labels[start] ?? '',
      start,
      span: (starts[index + 1] ?? labels.length) - start,
    }))
    // A month boundary at the grid's edge can leave a single week column: its
    // label cannot fit one 13px cell and would collide with the next month.
    // The neighbouring label still marks the boundary for the reader.
    .filter((run) => run.span > 1)
}

/** Quartile intensity, same thresholds as the core token levels (0.25/0.5/0.75). */
function heatmapLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0
  const ratio = value / max
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

function heatmapMetricValue(cell: HeatmapCell, metric: HeatmapMetric): number {
  if (metric === 'calls') return cell.totals.calls
  if (metric === 'cost') return cell.totals.cost
  return cell.tokens
}

/** What the compact day-panel summary leads with for the active metric. */
function heatmapMetricText(metric: HeatmapMetric, totals: UsageTokenTotals): string {
  if (metric === 'calls') return formatExact(totals.calls)
  if (metric === 'cost') return formatCny(totals.cost, totals.calls)
  return formatTokens(totalOf(totals))
}

/** Compact Tokens / Calls / Cost toggle that re-levels the heatmap. */
function HeatmapMetricToggle(props: { metric: HeatmapMetric; onChange: (metric: HeatmapMetric) => void }): ReactNode {
  return (
    <div className={styles.rangeSeg} role="group" aria-label={t('usage.heatmap.metric')}>
      {(['tokens', 'calls', 'cost'] as const).map((metric) => (
        <button
          key={metric}
          type="button"
          aria-pressed={props.metric === metric}
          className={props.metric === metric ? `${styles.rangeBtn} ${styles.rangeBtnActive}` : styles.rangeBtn}
          onClick={() => props.onChange(metric)}
        >
          {t(`usage.heatmap.metric.${metric}`)}
        </button>
      ))}
    </div>
  )
}

/** The drill-down under the heatmap for one selected day. */
function DayDetailPanel(props: {
  date: string
  state: 'loading' | 'ready' | 'error'
  detail?: UsageDayDetail
  error?: string
  metric: HeatmapMetric
  providers: ProviderSnapshotView[]
  onClose: () => void
  onRetry: () => void
}): ReactNode {
  const { date, state, detail, metric, providers, onClose, onRetry } = props
  const nameOf = new Map(providers.map((provider) => [provider.provider, provider.displayName]))
  const empty = detail === undefined || (detail.totals.calls === 0 && totalOf(detail.totals) === 0)
  return (
    <div
      className={styles.dayPanel}
      data-dsh-part="day-detail"
      data-day-date={date}
      data-day-state={state === 'ready' && empty ? 'empty' : state}
      role="region"
      aria-label={t('usage.heatmap.dayDetail', { date })}
      aria-live="polite"
    >
      <div className={styles.dayHead}>
        <span className={`${styles.dayTitle} ${styles.mono}`}>{date}</span>
        <button type="button" className={styles.linkBtn} onClick={onClose}>{t('usage.heatmap.close')}</button>
      </div>
      {state === 'loading' && <span className={styles.muted}>{t('usage.heatmap.dayLoading')}</span>}
      {state === 'error' && (
        <div className={styles.dayError}>
          <span>{t('usage.heatmap.dayError')}</span>
          <button type="button" className={styles.linkBtn} onClick={onRetry}>{t('usage.retry')}</button>
        </div>
      )}
      {state === 'ready' && detail !== undefined && (
        empty
          ? <span className={styles.muted}>{t('usage.heatmap.dayEmpty')}</span>
          : (
            <>
              <div className={styles.daySummary}>
                <span className={`${styles.dayMetricValue} ${styles.mono}`} data-dsh-part="day-metric">{heatmapMetricText(metric, detail.totals)}</span>
                <span className={styles.dayMetricUnit}>{t(`usage.heatmap.metric.${metric}`)}</span>
                <span className={styles.daySecondary}>
                  {t('usage.heatmap.dayTotals', {
                    tokens: formatTokens(totalOf(detail.totals)),
                    calls: formatExact(detail.totals.calls),
                    cost: formatCny(detail.totals.cost, detail.totals.calls),
                  })}
                </span>
              </div>
              <div className={styles.dayTable} data-dsh-part="day-providers">
                <div className={`${styles.dayTableHead} ${styles.dayGrid}`} aria-hidden="true">
                  <span>{t('usage.heatmap.colProvider')}</span>
                  <span>{t('usage.tokens.total')}</span>
                  <span>{t('usage.summary.calls')}</span>
                  <span>{t('usage.summary.cost')}</span>
                </div>
                {detail.providers.map((provider) => (
                  <div key={provider.provider} className={styles.dayProviderGroup} data-day-provider={provider.provider}>
                    <div className={`${styles.dayRow} ${styles.dayGrid}`}>
                      <span className={styles.dayName}>{nameOf.get(provider.provider) ?? provider.provider}</span>
                      <span className={styles.mono}>{formatTokens(totalOf(provider.totals))}</span>
                      <span className={styles.mono}>{formatExact(provider.totals.calls)}</span>
                      <span className={styles.mono}>{formatCny(provider.totals.cost, provider.totals.calls)}</span>
                    </div>
                    {provider.models.slice(0, CHART_MODEL_CAP).map((model) => (
                      <div key={model.model} className={`${styles.dayModelRow} ${styles.dayGrid}`}>
                        <span className={styles.dayModelName}>{model.model}</span>
                        <span className={styles.mono}>{formatTokens(totalOf(model.totals))}</span>
                        <span className={styles.mono}>{formatExact(model.totals.calls)}</span>
                        <span className={styles.mono}>{formatCny(model.totals.cost, model.totals.calls)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )
      )}
    </div>
  )
}

const HeatmapCard = memo(function HeatmapCard(props: { days: UsageDaySummary[]; providers: ProviderSnapshotView[] }): ReactNode {
  const { days, providers } = props
  const grid = useMemo(() => buildHeatmapGrid(days), [days])
  const months = useMemo(() => monthRuns(grid.monthLabels), [grid])
  const weeks = useMemo(
    () => Array.from({ length: HEATMAP_WEEKS }, (_, week) => grid.cells.slice(week * 7, week * 7 + 7)),
    [grid],
  )
  const [metric, setMetric] = useState<HeatmapMetric>('tokens')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [dayState, setDayState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error'
    date?: string
    detail?: UsageDayDetail
    error?: string
  }>({ status: 'idle' })
  const gridRef = useRef<HTMLDivElement | null>(null)
  const todayIndex = useMemo(() => grid.cells.findIndex((cell) => cell.isToday), [grid])
  const lastEnabled = todayIndex >= 0 ? todayIndex : grid.cells.length - 1
  const [focusIndex, setFocusIndex] = useState(() => (todayIndex >= 0 ? todayIndex : grid.cells.length - 1))
  useEffect(() => {
    setFocusIndex((current) => Math.min(current, lastEnabled))
  }, [lastEnabled])

  // One day drill-down read per selection; a stale response (or an unmount) is
  // dropped so a fast second click never paints the previous day over it.
  useEffect(() => {
    if (selectedDate === null) {
      setDayState({ status: 'idle' })
      return undefined
    }
    const controller = new AbortController()
    let live = true
    setDayState({ status: 'loading', date: selectedDate })
    fetch(dayRequestPath(selectedDate), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`day ${response.status}`)
        return (await response.json()) as UsageDayDetail
      })
      .then((detail) => {
        if (live) setDayState({ status: 'ready', date: selectedDate, detail })
      }, (error: unknown) => {
        if (live) setDayState({ status: 'error', date: selectedDate, error: error instanceof Error ? error.message : String(error) })
      })
    return () => {
      live = false
      controller.abort()
    }
  }, [selectedDate, retryToken])

  const levels = useMemo(() => {
    const values = grid.cells.map((cell) => heatmapMetricValue(cell, metric))
    const max = Math.max(0, ...values)
    return { max, levels: values.map((value) => heatmapLevel(value, max)), values }
  }, [grid, metric])

  const week = useMemo(() => {
    const recent = days.slice(-7)
    return {
      tokens: recent.reduce((acc, day) => acc + totalOf(day.totals), 0),
      calls: recent.reduce((acc, day) => acc + day.totals.calls, 0),
    }
  }, [days])
  const facts = useMemo(() => {
    let activeDays = 0
    let busiest = grid.cells[0]
    for (const cell of grid.cells) {
      if (cell.tokens > 0) activeDays += 1
      if (busiest === undefined || cell.tokens > busiest.tokens) busiest = cell
    }
    return { activeDays, busiest }
  }, [grid])
  const hasData = facts.activeDays > 0
  const emptyMetric = metric === 'cost' && levels.max <= 0

  const focusCell = (date: string): void => {
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)?.focus()
  }

  // Roving-tabindex keyboard grid: arrows move one day/week, Home/End jump to
  // the retained range's ends, Escape clears the drill-down. Column-major DOM
  // order means ±1 is a day and ±7 is a week.
  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const target = event.target
    if (!(target instanceof HTMLButtonElement)) return
    const index = grid.cells.findIndex((cell) => cell.date === target.dataset.date)
    if (index < 0) return
    let next = index
    switch (event.key) {
      case 'ArrowUp': next = index - 1; break
      case 'ArrowDown': next = index + 1; break
      case 'ArrowLeft': next = index - 7; break
      case 'ArrowRight': next = index + 7; break
      case 'Home': next = 0; break
      case 'End': next = lastEnabled; break
      case 'Escape':
        if (selectedDate !== null) {
          event.preventDefault()
          setSelectedDate(null)
        }
        return
      default:
        return
    }
    event.preventDefault()
    const clamped = Math.max(0, Math.min(lastEnabled, next))
    const cell = grid.cells[clamped]
    if (cell === undefined) return
    setFocusIndex(clamped)
    focusCell(cell.date)
  }

  return (
    <section className={styles.card} data-dsh-part="heatmap-card">
      <div className={`${styles.cardHead} ${styles.heatmapHead}`}>
        <div className={styles.cardHeadGroup}>
          <span className={styles.cardTitle}>{t('usage.heatmap')}</span>
        </div>
        <div className={styles.heatmapTools}>
          <span className={styles.cardMeta}>{t('usage.heatmap.weeks')}</span>
          <HeatmapMetricToggle metric={metric} onChange={setMetric} />
        </div>
      </div>
      <div className={styles.heatmapLayout}>
        <div className={styles.heatmapLeft}>
          <div className={styles.heatmapBody}>
            <div className={styles.heatmapLabels} aria-hidden="true">
              <span className={styles.heatmapCorner} />
              <div className={styles.heatmapDow}>
                <span>{t('usage.heatmap.dow.mon')}</span>
                <span />
                <span>{t('usage.heatmap.dow.wed')}</span>
                <span />
                <span>{t('usage.heatmap.dow.fri')}</span>
                <span />
                <span />
              </div>
            </div>
            <div className={styles.heatmapMain}>
              <div className={styles.heatmapMonths}>
                {months.map((run) => (
                  <span
                    key={`${run.label}-${run.start}`}
                    className={styles.heatmapMonth}
                    style={{ gridColumn: `${run.start + 1} / span ${run.span}` }}
                  >
                    {run.label}
                  </span>
                ))}
              </div>
              <div
                ref={gridRef}
                className={styles.heatmapGrid}
                data-dsh-part="heatmap-grid"
                role="grid"
                aria-label={t('usage.heatmap.gridLabel')}
                onKeyDown={onGridKeyDown}
              >
                {weeks.map((cells, weekIndex) => (
                  <div key={weekIndex} className={styles.heatmapRow} role="row">
                    {cells.map((cell, dayIndex) => {
                      const index = weekIndex * 7 + dayIndex
                      const future = index > todayIndex
                      const level = levels.levels[index] ?? 0
                      const label = future
                        ? t('usage.heatmap.future', { date: cell.date })
                        : t('usage.heatmap.cellAria', {
                          date: cell.date,
                          tokens: formatTokens(cell.tokens),
                          calls: formatExact(cell.totals.calls),
                          cost: cell.totals.cost > 0 ? formatCost(cell.totals.cost) : '—',
                        })
                      return (
                        <button
                          key={cell.date}
                          type="button"
                          role="gridcell"
                          className={[
                            styles.heatmapCell,
                            cell.isToday ? styles.heatmapToday : '',
                            selectedDate === cell.date ? styles.heatmapSelected : '',
                          ].filter(Boolean).join(' ')}
                          data-dsh-part="heatmap-cell"
                          data-date={cell.date}
                          data-level={level}
                          data-future={future ? 'yes' : undefined}
                          disabled={future}
                          aria-label={label}
                          aria-selected={selectedDate === cell.date}
                          title={label}
                          tabIndex={future || index !== focusIndex ? -1 : 0}
                          onFocus={() => setFocusIndex(index)}
                          onClick={() => setSelectedDate((current) => (current === cell.date ? null : cell.date))}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.heatmapLegend}>
            {hasData ? (
              emptyMetric ? (
                <span className={styles.muted}>{t('usage.heatmap.costUnpriced')}</span>
              ) : (
                <>
                  <span>{t('usage.heatmap.less')}</span>
                  {[0, 1, 2, 3, 4].map((level) => (
                    <span key={level} className={styles.heatmapCell} data-level={level} aria-hidden="true" />
                  ))}
                  <span>{t('usage.heatmap.more')}</span>
                </>
              )
            ) : (
              <span className={styles.muted}>{t('usage.heatmap.empty')}</span>
            )}
          </div>
        </div>
        <div className={styles.heatmapSide}>
          <div className={styles.sideStat}>
            <span className={styles.sideLabel}>{t('usage.heatmap.activeDays')}</span>
            <span className={styles.sideValue}>
              <span className={`${styles.mono}`}>{facts.activeDays}</span>
              <span className={styles.sideUnit}>{`/${grid.cells.length}`}</span>
            </span>
          </div>
          <div className={styles.sideStat}>
            <span className={styles.sideLabel}>{t('usage.heatmap.busiest')}</span>
            <span className={`${styles.sideValue} ${styles.mono}`}>{facts.busiest === undefined ? '—' : formatTokens(facts.busiest.tokens)}</span>
            <span className={styles.sideHint}>{facts.busiest === undefined ? '' : facts.busiest.date.slice(5)}</span>
          </div>
          <div className={styles.sideStat}>
            <span className={styles.sideLabel}>{t('usage.heatmap.week')}</span>
            <span className={`${styles.sideValue} ${styles.mono}`}>{formatTokens(week.tokens)}</span>
            <span className={styles.sideHint}>{t('usage.calls', { n: week.calls })}</span>
          </div>
        </div>
      </div>
      {selectedDate !== null && (
        <DayDetailPanel
          date={selectedDate}
          state={dayState.status === 'idle' ? 'loading' : dayState.status}
          detail={dayState.detail}
          error={dayState.error}
          metric={metric}
          providers={providers}
          onClose={() => setSelectedDate(null)}
          onRetry={() => setRetryToken((token) => token + 1)}
        />
      )}
    </section>
  )
})

// ---------------------------------------------------------------------------
// Account quota rings.
// ---------------------------------------------------------------------------

function QuotaRing(props: { percent?: number; label: string; sub?: string; planName?: string }): ReactNode {
  const percent = typeof props.percent === 'number' ? props.percent : 0
  const tone = percent >= 90 ? styles.toneBad : percent >= 70 ? styles.toneWarn : styles.toneAccent
  return (
    <div className={styles.gauge}>
      <Ring percent={percent} size={88} stroke={7} tone={tone} />
      <span className={styles.gaugeLabel}>{props.label}</span>
      {props.sub !== undefined ? <span className={styles.gaugeSub}>{props.sub}</span> : null}
    </div>
  )
}

const QuotaCard = memo(function QuotaCard(props: { provider?: ProviderSnapshotView; model?: string; onSeeAll: () => void }): ReactNode {
  const { provider, model, onSeeAll } = props
  const windows = useMemo(
    () => (provider?.plan === undefined ? [] : orderedPlanWindows(provider.plan)),
    [provider],
  )
  const identity = provider === undefined
    ? undefined
    : `${provider.displayName}${model !== undefined && model !== '' ? ` · ${model}` : ''}`
  return (
    <section className={`${styles.card} ${styles.quotaCard}`} data-dsh-part="quota-card">
      <div className={styles.cardHead}>
        <div className={styles.cardHeadGroup}>
          <span className={styles.cardTitle}>{t('usage.plan.quota')}</span>
          <span className={styles.scopeChip}>{t('usage.scope.account')}</span>
        </div>
        <button type="button" className={styles.linkBtn} onClick={onSeeAll}>{t('usage.plan.seeAll')}</button>
      </div>
      {provider !== undefined && identity !== undefined && (
        <div className={styles.quotaIdentity}>
          <span className={styles.providerName}>{identity}</span>
          <span className={styles.sourceChip}>{t(planSourceLabelKey(provider))}</span>
          {provider.plan?.planName !== undefined ? <span className={styles.planTier}>{provider.plan.planName}</span> : null}
        </div>
      )}
      {windows.length === 0 ? (
        <div className={styles.emptyState} data-dsh-part="quota-empty">
          <Ring percent={null} size={64} stroke={5} tone={styles.toneAccent} />
          <div className={styles.emptyBody}>
            <span className={styles.emptyTitle}>{t('usage.plan.noPlan')}</span>
            <span className={styles.emptyHint}>{t('usage.plan.emptyHint')}</span>
            <button type="button" className={styles.emptyAction} onClick={onSeeAll}>{t('usage.plan.seeAll')}</button>
          </div>
        </div>
      ) : (
        <div className={styles.gaugesRow}>
          {windows.slice(0, 3).map((window) => (
            <QuotaRing
              key={window.key}
              percent={window.percent}
              label={window.name ?? t(`usage.plan.windows.${window.key}`)}
              sub={window.resetsAt !== undefined ? formatPlanReset(window.resetsAt) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
})

// ---------------------------------------------------------------------------
// 30-day provider trend: ranked bars, one accent for the current route.
// ---------------------------------------------------------------------------

const RangeCard = memo(function RangeCard(props: {
  range?: UsageOverviewView['usage']['range']
  providers: ProviderSnapshotView[]
  currentProvider?: string
  rangeDays: UsageRangeDays
  costEstimate?: UsageCostEstimate
}): ReactNode {
  const { range, providers, currentProvider, costEstimate } = props
  const derived = useMemo(() => {
    const nameOf = new Map(providers.map((provider) => [provider.provider, provider.displayName]))
    const grandTotal = range === undefined ? 0 : totalOf(range.totals)
    return { nameOf, grandTotal }
  }, [providers, range])
  if (range === undefined) return null
  const { nameOf, grandTotal } = derived
  return (
    <section className={styles.card} data-dsh-part="trend-card">
      <div className={styles.cardHead}>
        <div className={styles.cardHeadGroup}>
          <span className={styles.cardTitle}>{t('usage.range.window', { n: props.rangeDays })}</span>
        </div>
        {grandTotal > 0 && (
          <span className={styles.cardMeta}>
            {t('usage.trend.summary', {
              tokens: formatTokens(grandTotal),
              calls: t('usage.calls', { n: range.totals.calls }),
            })}
          </span>
        )}
      </div>
      {range.providers.length === 0 || grandTotal === 0 ? (
        <span className={styles.muted}>{t('usage.noData')}</span>
      ) : (
        <div className={styles.chart} data-dsh-part="usage-chart">
          {range.providers.map((row) => {
            const total = totalOf(row.totals)
            const share = grandTotal > 0 ? (total / grandTotal) * 100 : 0
            const accent = currentProvider === row.provider
            return (
              <div key={row.provider} className={styles.chartRow} data-accent={accent ? 'yes' : 'no'}>
                <div className={styles.chartHead}>
                  <span className={styles.chartLead}>
                    <i className={styles.providerDot} aria-hidden="true" />
                    <span className={styles.chartName}>{nameOf.get(row.provider) ?? row.provider}</span>
                    {accent && <span className={styles.currentBadge}>{t('usage.current')}</span>}
                  </span>
                  <span className={styles.chartMeta}>
                    <span className={`${styles.chartShare} ${styles.mono}`}>{percentText(share)}</span>
                    <span className={`${styles.dim} ${styles.mono}`}>
                      {formatTokens(total)}
                      {` · ${t('usage.calls', { n: row.totals.calls })}`}
                    </span>
                  </span>
                </div>
                <span className={styles.chartBar} aria-hidden="true">
                  <span className={styles.chartFill} style={{ width: `${Math.max(1.5, share)}%` }} />
                </span>
                {row.models.slice(0, CHART_MODEL_CAP).map((model) => {
                  const modelTotal = totalOf(model.totals)
                  const modelShare = total > 0 ? (modelTotal / total) * 100 : 0
                  return (
                    <div key={model.model} className={styles.chartModel} title={`${row.provider} · ${model.model}: ${formatTokens(modelTotal)}`}>
                      <span className={styles.chartModelName}>{model.model}</span>
                      <span className={styles.chartModelBar} aria-hidden="true">
                        <span className={styles.chartModelFill} style={{ width: `${Math.max(1.5, modelShare)}%` }} />
                      </span>
                      <span className={`${styles.chartModelValue} ${styles.mono}`}>{percentText(modelShare)}</span>
                      <span className={`${styles.chartModelTokens} ${styles.mono}`}>{formatTokens(modelTotal)}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
          <span className={styles.trendAxis}>
            <span>{range.from.slice(5)}</span>
            <span>{range.to.slice(5)}</span>
          </span>
        </div>
      )}
      {costEstimate !== undefined && costEstimate.totalCalls > 0 && (
        <div
          className={styles.usdLine}
          data-dsh-part="usd-estimate"
          data-usd-priced={costEstimate.amount !== undefined ? 'yes' : 'no'}
          title={`${costEstimate.source}${costEstimate.priceBookUpdatedAt !== undefined ? ` · ${new Date(costEstimate.priceBookUpdatedAt).toLocaleDateString()}` : ''}`}
        >
          <span className={`${styles.usdAmount} ${styles.mono}`}>
            {costEstimate.amount !== undefined
              ? t('usage.trend.usd', {
                amount: formatUsd(costEstimate.amount),
                priced: costEstimate.pricedModels,
                total: costEstimate.totalModels,
              })
              : t('usage.trend.usdNone')}
          </span>
          {costEstimate.pricedCalls < costEstimate.totalCalls && (
            <span className={styles.usdNote} data-dsh-part="usd-unpriced">
              {t('usage.trend.usdUnpriced', { n: costEstimate.totalCalls - costEstimate.pricedCalls })}
            </span>
          )}
        </div>
      )}
    </section>
  )
})

// ---------------------------------------------------------------------------
// Daily history: a slim collapsible row, not a full empty band.
// ---------------------------------------------------------------------------

const HistoryCard = memo(function HistoryCard(props: { days: UsageDaySummary[] }): ReactNode {
  const [open, setOpen] = useState(false)
  const rows = useMemo(() => [...props.days].slice(-14).reverse(), [props.days])
  const max = useMemo(() => Math.max(1, ...rows.map((day) => totalOf(day.totals))), [rows])
  return (
    <section className={styles.card} data-dsh-part="history-card">
      <div className={styles.cardHead}>
        <div className={styles.cardHeadGroup}>
          <span className={styles.cardTitle}>{t('usage.history')}</span>
        </div>
        <button type="button" className={styles.linkBtn} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? t('usage.history.hide') : t('usage.history.show')}
        </button>
      </div>
      {open && (rows.length === 0
        ? <span className={styles.muted}>{t('usage.history.empty')}</span>
        : (
          <div className={styles.historyGrid}>
            {rows.map((day) => {
              const total = totalOf(day.totals)
              return (
                <div key={day.date} className={styles.historyRow}>
                  <span className={`${styles.historyDate} ${styles.mono}`}>{day.date.slice(5)}</span>
                  <span className={styles.historyBar} aria-hidden="true">
                    <span style={{ width: `${Math.max(2, Math.round((total / max) * 100))}%` }} />
                  </span>
                  <span className={`${styles.historyTokens} ${styles.mono}`}>{formatTokens(total)}</span>
                  <span className={styles.historyCalls}>{t('usage.calls', { n: day.totals.calls })}</span>
                </div>
              )
            })}
          </div>
        ))}
    </section>
  )
})

// ---------------------------------------------------------------------------
// Overview window control + coverage note.
// ---------------------------------------------------------------------------

/**
 * The real covered range when retained history is shorter than the selection.
 * `usage.range.from/to` are the Host's truth; the copy stays hidden when the
 * whole requested window exists.
 */
function coveredRange(
  range: UsageOverviewView['usage']['range'],
  days: UsageRangeDays,
): { from: string; to: string } | undefined {
  if (range === undefined) return undefined
  const from = Date.parse(`${range.from}T00:00:00Z`)
  const to = Date.parse(`${range.to}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return undefined
  const coveredDays = Math.round((to - from) / 86_400_000) + 1
  if (coveredDays >= days) return undefined
  return { from: range.from.slice(5), to: range.to.slice(5) }
}

/** Compact segmented window picker; `aria-pressed` carries the selection. */
function RangeBar(props: {
  days: UsageRangeDays
  covered?: { from: string; to: string }
  onSelect: (days: UsageRangeDays) => void
}): ReactNode {
  return (
    <div className={styles.rangeBar} data-dsh-part="range-bar" data-range={props.days}>
      <div className={styles.rangeSeg} role="group" aria-label={t('usage.range.label')}>
        {USAGE_RANGE_DAYS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === props.days}
            className={option === props.days ? `${styles.rangeBtn} ${styles.rangeBtnActive}` : styles.rangeBtn}
            onClick={() => props.onSelect(option)}
          >
            {t('usage.range.days', { n: option })}
          </button>
        ))}
      </div>
      {props.covered !== undefined && (
        <span className={styles.rangeCovered} data-dsh-part="range-covered">
          {t('usage.range.covered', { from: props.covered.from, to: props.covered.to })}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Export (Settings tab): a local CSV / JSON download of the selected window.
// ---------------------------------------------------------------------------

function ExportCard(props: { days: UsageRangeDays }): ReactNode {
  const [busy, setBusy] = useState<'csv' | 'json' | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)

  const run = async (format: 'csv' | 'json'): Promise<void> => {
    if (busy !== null) return
    setBusy(format)
    setError(undefined)
    try {
      const response = await fetch(exportRequestPath(format, props.days))
      if (!response.ok) throw new Error(`export failed: ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      try {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `dsh-usage-${props.days}d.${format}`
        document.body.append(anchor)
        anchor.click()
        anchor.remove()
      } finally {
        // Revoke after the click settles; a task boundary avoids freeing the
        // URL before the browser has started reading it.
        window.setTimeout(() => URL.revokeObjectURL(url), 0)
      }
    } catch {
      setError(t('usage.export.failed'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={`${styles.card} ${styles.exportCard}`} data-dsh-part="export-card">
      <div className={styles.cardHead}>
        <div className={styles.cardHeadGroup}>
          <span className={styles.cardTitle}>{t('usage.export.title')}</span>
          <span className={styles.scopeChip}>{t('usage.range.days', { n: props.days })}</span>
        </div>
      </div>
      <p className={styles.exportHint}>{t('usage.export.hint', { n: props.days })}</p>
      <div className={styles.exportActions}>
        <button
          type="button"
          className={styles.refreshBtn}
          disabled={busy !== null}
          data-busy={busy === 'csv' ? 'yes' : 'no'}
          onClick={() => void run('csv')}
        >
          {busy === 'csv' ? t('usage.export.busy') : t('usage.export.csv')}
        </button>
        <button
          type="button"
          className={styles.refreshBtn}
          disabled={busy !== null}
          data-busy={busy === 'json' ? 'yes' : 'no'}
          onClick={() => void run('json')}
        >
          {busy === 'json' ? t('usage.export.busy') : t('usage.export.json')}
        </button>
      </div>
      {error !== undefined && <span className={styles.exportError} role="alert">{error}</span>}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Threshold alerts (Overview banner stack).
// ---------------------------------------------------------------------------

/** Localized label for the plan window key carried by a plan alert. */
function alertWindowLabel(window: string | undefined): string {
  if (window === undefined || window === '') return ''
  if (window === '5h' || window === 'week' || window === 'month') return t(`usage.plan.windows.${window}`)
  return window
}

/** One alert's kind-specific copy; unknown future kinds fall back to the wire message. */
function alertText(alert: UsageAlert, nameOf: ReadonlyMap<string, string>): string {
  const provider = alert.provider === undefined ? '' : nameOf.get(alert.provider) ?? alert.provider
  switch (alert.kind) {
    case 'daily-cost':
      return t('usage.alerts.dailyCost', { value: formatCost(alert.value), threshold: formatCost(alert.threshold) })
    case 'plan-threshold':
      return t('usage.alerts.plan', {
        provider,
        window: alertWindowLabel(alert.window),
        value: percentText(alert.value),
        threshold: percentText(alert.threshold),
      })
    case 'balance-low':
      return t('usage.alerts.balance', { provider, value: formatCost(alert.value), threshold: formatCost(alert.threshold) })
    default:
      return alert.message
  }
}

/**
 * Quiet threshold-alert strip: one summary line with the most severe alert,
 * expandable to the full list. Renders nothing when there is no alert, so the
 * Overview never reserves dead space and the chrome stays quiet.
 */
function AlertStack(props: { alerts: UsageAlert[]; providers: ProviderSnapshotView[] }): ReactNode {
  const { alerts, providers } = props
  if (alerts.length === 0) return null
  const nameOf = new Map(providers.map((provider) => [provider.provider, provider.displayName]))
  const severityRank = (alert: UsageAlert): number => (alert.severity === 'critical' ? 2 : 1)
  const top = alerts.reduce((lead, alert) => (severityRank(alert) > severityRank(lead) ? alert : lead), alerts[0])
  const more = alerts.length - 1
  return (
    <details className={styles.alertStack} data-dsh-part="alert-stack" data-alert-count={alerts.length} role="status" aria-live="polite">
      <summary className={styles.alertSummary}>
        <span
          className={`${styles.alertDot} ${top.severity === 'critical' ? styles.alertCritical : styles.alertWarning}`}
          aria-hidden="true"
        />
        <span className={styles.alertSummaryText}>{alertText(top, nameOf)}</span>
        {more > 0 && <span className={styles.alertSummaryCount}>{t('usage.alerts.more', { count: more })}</span>}
        <svg className={styles.alertChevron} viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className={styles.alertList}>
        {alerts.map((alert) => (
          <div
            key={`${alert.kind}:${alert.provider ?? ''}:${alert.window ?? ''}:${alert.since}`}
            className={`${styles.alertItem} ${alert.severity === 'critical' ? styles.alertCritical : styles.alertWarning}`}
            data-dsh-part="alert"
            data-alert-kind={alert.kind}
            data-alert-severity={alert.severity}
            data-alert-provider={alert.provider ?? ''}
          >
            <span className={`${styles.alertDot} ${styles.alertDotRow}`} aria-hidden="true" />
            <span className={styles.alertText}>{alertText(alert, nameOf)}</span>
            <span className={styles.alertChips}>
              {alert.provider !== undefined && <span className={styles.scopeChip}>{nameOf.get(alert.provider) ?? alert.provider}</span>}
              <span className={styles.scopeChip}>{alert.kind === 'daily-cost' ? t('usage.scope.device') : t('usage.scope.account')}</span>
            </span>
          </div>
        ))}
      </div>
    </details>
  )
}

// ---------------------------------------------------------------------------
// Data health (Settings tab reference card).
// ---------------------------------------------------------------------------

/** Human-readable byte size; the health card is the only place bytes surface. */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB'] as const
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/** Coarse relative time for probe/backfill timestamps. */
function formatAgo(ms: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - ms) / 60_000))
  if (minutes < 1) return t('usage.health.ago.now')
  if (minutes < 60) return t('usage.health.ago.minutes', { n: minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 48) return t('usage.health.ago.hours', { n: hours })
  return t('usage.health.ago.days', { n: Math.round(hours / 24) })
}

/** Ledger coverage, backfill, probe and corruption health. */
function HealthCard(props: { health?: UsageHealth; providers: ProviderSnapshotView[] }): ReactNode {
  const { health, providers } = props
  if (health === undefined) {
    return (
      <section className={`${styles.card} ${styles.healthCard}`} data-dsh-part="health-card" data-health-state="missing">
        <span className={styles.cardTitle}>{t('usage.health.title')}</span>
        <span className={styles.muted}>{t('usage.health.missing')}</span>
      </section>
    )
  }
  const { storage, backfill, probes } = health
  const coverage = storage.retentionDays > 0
    ? Math.min(100, Math.max(0, (storage.activeDays / storage.retentionDays) * 100))
    : 0
  const nameOf = new Map(providers.map((provider) => [provider.provider, provider.displayName]))
  const failing = probes.failing.map((id) => nameOf.get(id) ?? id)
  return (
    <section className={`${styles.card} ${styles.healthCard}`} data-dsh-part="health-card" data-health-state="ready">
      <div className={styles.cardHead}>
        <div className={styles.cardHeadGroup}>
          <span className={styles.cardTitle}>{t('usage.health.title')}</span>
          <span className={styles.scopeChip}>{storage.label}</span>
        </div>
      </div>
      <div className={styles.healthBody}>
        <div className={styles.healthRow} data-dsh-part="health-coverage">
          <span className={styles.healthLabel}>{t('usage.health.coverageLabel')}</span>
          <span className={`${styles.healthValue} ${styles.mono}`}>
            {storage.firstDay !== null && storage.lastDay !== null
              ? t('usage.health.coverage', { from: storage.firstDay.slice(5), to: storage.lastDay.slice(5) })
              : t('usage.health.noDays')}
          </span>
          <span className={styles.healthHint}>{t('usage.health.coverageDays', { active: storage.activeDays, retention: storage.retentionDays })}</span>
          <span className={styles.healthBar} aria-hidden="true">
            <span style={{ width: `${coverage}%` }} />
          </span>
        </div>
        <div className={styles.healthRow} data-dsh-part="health-ledger">
          <span className={styles.healthLabel}>{t('usage.health.ledgerLabel')}</span>
          <span className={`${styles.healthValue} ${styles.mono}`}>{formatBytes(storage.bytes)}</span>
        </div>
        <div className={styles.healthRow} data-dsh-part="health-backfill">
          <span className={styles.healthLabel}>{t('usage.health.backfillLabel')}</span>
          {backfill === null
            ? <span className={`${styles.healthValue} ${styles.muted}`}>{t('usage.health.backfillNone')}</span>
            : (
              <span className={styles.healthValue}>
                {t('usage.health.backfill', {
                  ago: formatAgo(backfill.completedAt),
                  sessions: backfill.sessions,
                  events: backfill.events,
                })}
              </span>
            )}
          {backfill?.truncated === true && <span className={styles.healthWarn}>{t('usage.health.backfillTruncated')}</span>}
          {typeof backfill?.forkEvents === 'number' && backfill.forkEvents > 0 && (
            <span className={styles.muted} data-dsh-part="health-backfill-forks">
              {t('usage.health.backfillForks', { n: backfill.forkEvents })}
            </span>
          )}
        </div>
        <div className={styles.healthRow} data-dsh-part="health-probes">
          <span className={styles.healthLabel}>{t('usage.health.probesLabel')}</span>
          <span className={styles.healthValue}>
            {probes.lastSuccessAt === null
              ? t('usage.health.probesNone')
              : t('usage.health.probes', { ago: formatAgo(probes.lastSuccessAt) })}
          </span>
          <span className={failing.length > 0 ? styles.healthWarn : styles.healthHint}>
            {failing.length > 0
              ? t('usage.health.probesFailing', { providers: failing.join(' · ') })
              : t('usage.health.probesOk')}
          </span>
        </div>
        {storage.corruptFiles.length > 0 && (
          <div className={styles.healthRow} data-dsh-part="health-corrupt">
            <span className={styles.healthLabel}>{t('usage.health.corruptLabel')}</span>
            <span className={styles.healthWarn}>{t('usage.health.corrupt', { n: storage.corruptFiles.length })}</span>
            <span className={`${styles.healthHint} ${styles.mono}`}>{storage.corruptFiles.join(' · ')}</span>
          </div>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Official platform reconcile (DeepSeek web account facts).
// ---------------------------------------------------------------------------

/**
 * A quiet one-line reconcile of the official monthly spend against our local
 * ledger. `unavailable` renders nothing; `error` keeps a muted hint so the
 * surface never pretends the check passed.
 */
function PlatformStrip(props: { platform?: UsagePlatformView }): ReactNode {
  const { platform } = props
  if (platform === undefined || platform.status === 'unavailable') return null
  if (platform.status === 'error') {
    return (
      <div className={styles.platformStrip} data-dsh-part="platform-strip" data-platform-status="error" role="status">
        <span className={styles.platformTitle}>{t('usage.platform.title')}</span>
        <span className={styles.muted}>{t('usage.platform.error', { error: platform.error ?? t('usage.platform.unknown') })}</span>
        <span className={styles.platformHint}>{t('usage.platform.retry')}</span>
      </div>
    )
  }
  const cny = (value: number | undefined): string => (typeof value === 'number' ? formatCost(value) : '—')
  const coverage = typeof platform.coverage === 'number'
    ? Math.round(Math.min(1, Math.max(0, platform.coverage)) * 100)
    : undefined
  const delta = typeof platform.delta === 'number' ? platform.delta : undefined
  return (
    <div className={styles.platformStrip} data-dsh-part="platform-strip" data-platform-status="ready">
      <span className={styles.platformTitle}>{t('usage.platform.title')}</span>
      <span className={styles.scopeChip}>{t('usage.platform.scope')}</span>
      <span data-dsh-part="platform-month">
        {t('usage.platform.month', { official: cny(platform.monthCost), local: cny(platform.localMonthCost) })}
      </span>
      {coverage !== undefined && (
        <span className={styles.platformHint} data-dsh-part="platform-coverage">
          {t('usage.platform.coverage', { percent: coverage })}
        </span>
      )}
      {delta !== undefined && (
        <span
          className={styles.platformHint}
          data-dsh-part="platform-delta"
          data-delta={delta >= 0 ? 'positive' : 'negative'}
        >
          {t('usage.platform.delta', { delta: `${delta >= 0 ? '+' : '−'}${formatCost(Math.abs(delta))}` })}
        </span>
      )}
      <span className={styles.platformHint}>{t('usage.platform.updated', { time: formatClock(platform.updatedAt) })}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plan windows tab.
// ---------------------------------------------------------------------------

function PlanGroup(props: {
  title: string
  providers: ProviderSnapshotView[]
  currentId?: string
  showEmpty?: boolean
  /** A group with several providers spans the plans grid and lays its cards out side by side. */
  wide?: boolean
}): ReactNode {
  const { title, providers, currentId, showEmpty, wide } = props
  if (providers.length === 0 && !showEmpty) return null
  return (
    <div className={styles.planGroup} data-wide={wide === true ? 'yes' : 'no'}>
      <span className={styles.groupTitle}>
        {providers.length > 1 ? t('usage.plan.groupCount', { title, n: providers.length }) : title}
      </span>
      {providers.length === 0
        ? <span className={styles.groupEmpty}>{t('usage.plan.groupEmpty')}</span>
        : (
          <div className={styles.planCards}>
            {providers.map((provider) => <PlanCard key={provider.provider} provider={provider} currentId={currentId} />)}
          </div>
        )}
    </div>
  )
}

function PlanCard(props: { provider: ProviderSnapshotView; currentId?: string }): ReactNode {
  const { provider, currentId } = props
  const windows = orderedPlanWindows(provider.plan)
  return (
    <div className={`${styles.card} ${styles.planCard}`} data-dsh-part="plan-card">
      <div className={styles.planHead}>
        <span className={styles.planName}>
          {provider.displayName}
          {currentId === provider.provider && <span className={styles.currentBadge}>{t('usage.current')}</span>}
          <span className={styles.sourceChip}>{t(planSourceLabelKey(provider))}</span>
          <span className={styles.scopeChip}>{t('usage.scope.account')}</span>
          {provider.plan?.planName !== undefined ? <span className={styles.planTier}>{provider.plan.planName}</span> : ''}
        </span>
      </div>
      {provider.error !== undefined && <span className={styles.errorLine}>{t('usage.provider.error', { error: friendlyProbeError(provider.error) ?? provider.error })}</span>}
      {provider.credential === 'none' && provider.plan === undefined
        ? <span className={styles.muted}>{t('usage.balance.noCredential')}</span>
        : windows.length === 0
          ? (provider.error === undefined ? <span className={styles.muted}>{t('usage.plan.noPlan')}</span> : null)
          : windows.map((window) => {
            const percent = window.percent as number
            return (
              <div key={window.key} className={styles.windowRow} data-dsh-part="plan-window">
                <span className={styles.windowLabel}>
                  <span className={styles.windowName}>
                    <span>{window.name ?? t(`usage.plan.windows.${window.key}`)}</span>
                    {isPlanWindowFull(window) && <span className={styles.windowFull}>{t('usage.plan.full')}</span>}
                  </span>
                  <span className={`${styles.mono}`}>{percentText(percent)}</span>
                </span>
                <span className={styles.bar}>
                  <span className={toneClass(percent)} style={{ width: `${Math.min(100, Math.max(0, percent))}%`, display: 'block' }} />
                </span>
                {window.resetsAt !== undefined ? <span className={styles.resetLine}>{formatPlanReset(window.resetsAt)}</span> : null}
              </div>
            )
          })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings tab.
// ---------------------------------------------------------------------------

/** Numeric alert thresholds mirror the Host schema bounds (0 disables). */
const ALERT_DEFAULTS = {
  alertsEnabled: true,
  dailyCostLimitCny: 0,
  planAlertPercent: 0,
  planPromotePercent: 100,
  balanceAlertCny: 0,
  alertCooldownMinutes: 60,
} as const

type AlertSettings = typeof ALERT_DEFAULTS

const CONFIG_DEFAULTS: Required<Pick<UsageSettings, 'enabled' | 'pollIntervalSec' | 'bubbleMode' | 'alertsEnabled' | 'dailyCostLimitCny' | 'planAlertPercent' | 'balanceAlertCny' | 'alertCooldownMinutes' | 'cpamcEnabled' | 'cpamcBaseURL' | 'cpamcAllowedHosts' | 'volcanoEnabled' | 'platformUsageEnabled' | 'costEstimateEnabled' | 'customPlans' | 'planPromotePercent'>> = {
  enabled: true,
  pollIntervalSec: 60,
  bubbleMode: 'always',
  ...ALERT_DEFAULTS,
  cpamcEnabled: false,
  cpamcBaseURL: 'http://127.0.0.1:8317',
  cpamcAllowedHosts: '',
  volcanoEnabled: false,
  platformUsageEnabled: true,
  costEstimateEnabled: true,
  customPlans: '',
}

/** Clamp one numeric alert field the way the Host schema does. */
function clampAlertNumber(field: keyof AlertSettings, value: unknown): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : ALERT_DEFAULTS[field] as number
  if (field === 'planAlertPercent') return Math.min(100, Math.max(0, parsed))
  if (field === 'alertCooldownMinutes') return Math.min(1440, Math.max(1, Math.round(parsed)))
  return Math.min(1_000_000_000, Math.max(0, parsed))
}

function normalizeSettings(value: UsageSettings | undefined): typeof CONFIG_DEFAULTS {
  const bubble = value?.bubbleMode
  return {
    enabled: value?.enabled ?? CONFIG_DEFAULTS.enabled,
    pollIntervalSec: typeof value?.pollIntervalSec === 'number' ? value.pollIntervalSec : CONFIG_DEFAULTS.pollIntervalSec,
    bubbleMode: bubble === 'change' || bubble === 'off' || bubble === 'always' ? bubble : CONFIG_DEFAULTS.bubbleMode,
    alertsEnabled: value?.alertsEnabled ?? CONFIG_DEFAULTS.alertsEnabled,
    dailyCostLimitCny: clampAlertNumber('dailyCostLimitCny', value?.dailyCostLimitCny),
    planAlertPercent: clampAlertNumber('planAlertPercent', value?.planAlertPercent),
    planPromotePercent: typeof value?.planPromotePercent === 'number'
      ? Math.min(100, Math.max(1, Math.round(value.planPromotePercent)))
      : CONFIG_DEFAULTS.planPromotePercent,
    balanceAlertCny: clampAlertNumber('balanceAlertCny', value?.balanceAlertCny),
    alertCooldownMinutes: clampAlertNumber('alertCooldownMinutes', value?.alertCooldownMinutes),
    cpamcEnabled: value?.cpamcEnabled ?? CONFIG_DEFAULTS.cpamcEnabled,
    cpamcBaseURL: value?.cpamcBaseURL ?? CONFIG_DEFAULTS.cpamcBaseURL,
    cpamcAllowedHosts: value?.cpamcAllowedHosts ?? CONFIG_DEFAULTS.cpamcAllowedHosts,
    volcanoEnabled: value?.volcanoEnabled ?? CONFIG_DEFAULTS.volcanoEnabled,
    platformUsageEnabled: value?.platformUsageEnabled ?? CONFIG_DEFAULTS.platformUsageEnabled,
    costEstimateEnabled: value?.costEstimateEnabled ?? CONFIG_DEFAULTS.costEstimateEnabled,
    customPlans: typeof value?.customPlans === 'string' ? value.customPlans : CONFIG_DEFAULTS.customPlans,
  }
}

/**
 * Config tab on the bundle's configuration page: edits stay staged until Save.
 * Matches the official Plugins page contract (leave page → discard draft).
 */
/** Alert fields only a v0.5.0+ Host understands; older Hosts reject them. */
const ALERT_SETTING_FIELDS = ['alertsEnabled', 'dailyCostLimitCny', 'planAlertPercent', 'balanceAlertCny', 'alertCooldownMinutes'] as const

function SettingsRow(props: {
  settings: UsageSectionProps['settings']
  snapshot?: { writable: boolean; revision?: number }
  value: UsageSettings
  /** Whether the running Host's schema knows the alert fields (v0.5.0+). */
  alertsSupported?: boolean
  /** Whether the running Host's schema knows platform/cost-estimate fields (v0.6.0+). */
  platformSupported?: boolean
  /** Whether the running Host's schema knows the custom-plan field (v0.6.1+). */
  customPlansSupported?: boolean
  /** Whether the running Host's schema knows the ring-promotion threshold (v0.6.7+). */
  planPromoteSupported?: boolean
  /** Rejected custom-plan config fields reported by the Host. */
  customPlanErrors?: UsageCustomPlanError[]
  providers?: ProviderSnapshotView[]
  credentials?: ExternalCredentialStatus
  setCredential: UsageSectionProps['setCredential']
  clearCredential: UsageSectionProps['clearCredential']
}): ReactNode {
  const { settings, snapshot, value, providers = [], credentials, setCredential, clearCredential } = props
  const alertsSupported = props.alertsSupported ?? true
  const platformSupported = props.platformSupported ?? false
  const customPlansSupported = props.customPlansSupported ?? false
  const planPromoteSupported = props.planPromoteSupported ?? false
  const customPlanErrors = props.customPlanErrors ?? []
  const disabled = snapshot !== undefined && !snapshot.writable
  const [draft, setDraft] = useState(() => normalizeSettings(value))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | undefined>()
  const [sourceTest, setSourceTest] = useState<{ target: 'cpamc' | 'volcano' | 'custom'; id?: string; busy: boolean; result?: UsageSourceTestResult; error?: string } | undefined>(undefined)

  useEffect(() => {
    if (dirty) return
    setDraft(normalizeSettings(value))
  }, [value, dirty])

  const edit = <K extends keyof typeof CONFIG_DEFAULTS>(field: K, next: (typeof CONFIG_DEFAULTS)[K]): void => {
    setDraft((prev) => ({ ...prev, [field]: next }))
    setDirty(true)
    setSaveError(undefined)
  }

  const discard = (): void => {
    setDraft(normalizeSettings(value))
    setDirty(false)
    setSaveError(undefined)
  }

  const save = (): void => {
    if (disabled || saving || !dirty) return
    setSaving(true)
    setSaveError(undefined)
    const ops: Array<{ op: 'set'; path: readonly string[]; value: unknown }> = [
      { op: 'set', path: ['enabled'], value: draft.enabled },
      { op: 'set', path: ['pollIntervalSec'], value: draft.pollIntervalSec },
      { op: 'set', path: ['bubbleMode'], value: draft.bubbleMode },
      ...(alertsSupported
        ? ([
            { op: 'set', path: ['alertsEnabled'], value: draft.alertsEnabled },
            { op: 'set', path: ['dailyCostLimitCny'], value: draft.dailyCostLimitCny },
            { op: 'set', path: ['planAlertPercent'], value: draft.planAlertPercent },
            { op: 'set', path: ['balanceAlertCny'], value: draft.balanceAlertCny },
            { op: 'set', path: ['alertCooldownMinutes'], value: draft.alertCooldownMinutes },
          ] as const)
        : []),
      { op: 'set', path: ['cpamcEnabled'], value: draft.cpamcEnabled },
      { op: 'set', path: ['cpamcBaseURL'], value: draft.cpamcBaseURL },
      { op: 'set', path: ['cpamcAllowedHosts'], value: draft.cpamcAllowedHosts },
      { op: 'set', path: ['volcanoEnabled'], value: draft.volcanoEnabled },
      ...(platformSupported
        ? ([
            { op: 'set', path: ['platformUsageEnabled'], value: draft.platformUsageEnabled },
            { op: 'set', path: ['costEstimateEnabled'], value: draft.costEstimateEnabled },
          ] as const)
        : []),
      ...(customPlansSupported
        ? ([{ op: 'set', path: ['customPlans'], value: draft.customPlans }] as const)
        : []),
      ...(planPromoteSupported
        ? ([{ op: 'set', path: ['planPromotePercent'], value: draft.planPromotePercent }] as const)
        : []),
    ]
    void settings.mutate(ops, snapshot?.revision).then((ok) => {
      setSaving(false)
      if (!ok) {
        setSaveError(t(alertsSupported ? 'usage.config.saveFailed' : 'usage.config.saveFailedHostOld'))
        return
      }
      setDirty(false)
    }, (err: unknown) => {
      setSaving(false)
      setSaveError(err instanceof Error ? err.message : String(err))
    })
  }

  const cpamc = providers.find((provider) => provider.source === 'cpamc')
  const volcano = providers.find((provider) => provider.source === 'volcano')
  const customPlans = providers
    .filter((provider) => provider.source === 'custom')
    .map((provider) => ({ ...provider, id: provider.provider.startsWith('custom:') ? provider.provider.slice(7) : provider.provider }))
  const cpamcOn = draft.cpamcEnabled
  const volcanoOn = draft.volcanoEnabled
  // Unsaved secret inputs, so "test connection" can probe what is typed before
  // the user saves the credential. They never leave this component otherwise.
  const credentialDrafts = useRef<{ cpamc: string; volcanoAk: string; volcanoSk: string }>({ cpamc: '', volcanoAk: '', volcanoSk: '' })

  const testSource = (target: 'cpamc' | 'volcano' | 'custom', id?: string, config?: Record<string, unknown>): void => {
    if (sourceTest?.busy === true) return
    setSourceTest({ target, id, busy: true })
    void fetch('/api/dsh-usage-plus/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target, ...(id === undefined ? {} : { id }), ...(config === undefined ? {} : { config }) }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => undefined) as UsageSourceTestResult | undefined
        if (!response.ok) {
          throw new Error(response.status === 401 || response.status === 404
            ? t('usage.config.testNeedsRestart')
            : payload?.error ?? `HTTP ${response.status}`)
        }
        if (payload === undefined) throw new Error('empty response')
        return payload
      })
      .then((result) => { setSourceTest({ target, id, busy: false, result }) })
      .catch((error: unknown) => {
        setSourceTest({ target, id, busy: false, error: error instanceof Error ? error.message : String(error) })
      })
  }

  const testWindowText = (window: { key: string; percent?: number }): string => {
    const label = window.key === '5h'
      ? t('usage.plan.windows.5h.short')
      : t(`usage.plan.windows.${window.key}`)
    return `${label} ${window.percent === undefined ? '—' : `${Math.round(window.percent)}%`}`
  }
  const testText = (result: UsageSourceTestResult | undefined): string => {
    if (result === undefined || !result.ok) {
      const error = result?.error
      const shown = result?.target === 'custom' ? friendlyCustomPlanError(error) : undefined
      return t('usage.config.testFailed', { error: shown ?? error ?? 'unknown error' })
    }
    const head = result.target === 'custom'
      ? t('usage.config.testCustomOk', { windows: result.windows?.length ?? 0, ms: result.latencyMs })
      : result.accounts === undefined
      ? t('usage.config.testOkPlain', { ms: result.latencyMs })
      : t('usage.config.testOk', { accounts: result.accounts, ms: result.latencyMs })
    const windows = result.windows === undefined || result.windows.length === 0
      ? ''
      : ` · ${result.windows.map(testWindowText).join(' · ')}`
    return head + windows
  }
  return (
    <div className={styles.card} data-dsh-part="settings-row">
      <span className={styles.cardTitle}>{t('usage.config.title')}</span>
      <div className={styles.settingsForm}>
        {disabled && <span className={styles.muted}>{t('usage.config.readonly')}</span>}

        <div className={styles.settingsSection}>
          <span className={styles.subTitle}>{t('usage.config.basic')}</span>
          <label className={styles.settingRow}>
            <span>{t('usage.config.enabled')}</span>
            <input
              type="checkbox"
              checked={draft.enabled}
              disabled={disabled || saving}
              onChange={(event) => { edit('enabled', event.target.checked) }}
            />
          </label>
          <label className={styles.settingRow}>
            <span>{t('usage.config.pollIntervalSec')}</span>
            <input
              type="number"
              min={30}
              max={3600}
              value={draft.pollIntervalSec}
              disabled={disabled || saving}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                if (Number.isFinite(parsed) && parsed >= 30 && parsed <= 3600) edit('pollIntervalSec', Math.round(parsed))
              }}
            />
          </label>
        </div>

        <div className={styles.settingsSection}>
          <span className={styles.subTitle}>{t('usage.config.display')}</span>
          <div className={styles.settingRow}>
            <span>{t('usage.config.bubbleMode')}</span>
            <SelectMenu
              label={t('usage.config.bubbleMode')}
              value={draft.bubbleMode}
              disabled={disabled || saving}
              options={[
                { value: 'always', label: t('usage.config.bubbleMode.always') },
                { value: 'change', label: t('usage.config.bubbleMode.change') },
                { value: 'off', label: t('usage.config.bubbleMode.off') },
              ]}
              onChange={(next) => {
                if (next === 'always' || next === 'change' || next === 'off') edit('bubbleMode', next)
              }}
            />
          </div>
        </div>

        <div className={styles.settingsSection} data-dsh-part="alert-settings" data-host-compat={alertsSupported ? 'current' : 'old'}>
          <span className={styles.subTitle}>{t('usage.config.alerts')}</span>
          <label className={styles.settingRow}>
            <span>{t('usage.config.alertsEnabled')}</span>
            <input
              type="checkbox"
              checked={draft.alertsEnabled}
              disabled={disabled || saving || !alertsSupported}
              onChange={(event) => { edit('alertsEnabled', event.target.checked) }}
            />
          </label>
          <label className={styles.settingRow}>
            <span>{t('usage.config.dailyCostLimitCny')}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={draft.dailyCostLimitCny}
              disabled={disabled || saving || !alertsSupported || !draft.alertsEnabled}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                if (Number.isFinite(parsed) && parsed >= 0) edit('dailyCostLimitCny', parsed)
              }}
            />
          </label>
          <label className={styles.settingRow}>
            <span>{t('usage.config.planAlertPercent')}</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.planAlertPercent}
              disabled={disabled || saving || !alertsSupported || !draft.alertsEnabled}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) edit('planAlertPercent', parsed)
              }}
            />
          </label>
          <label className={styles.settingRow}>
            <span>{t('usage.config.balanceAlertCny')}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={draft.balanceAlertCny}
              disabled={disabled || saving || !alertsSupported || !draft.alertsEnabled}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                if (Number.isFinite(parsed) && parsed >= 0) edit('balanceAlertCny', parsed)
              }}
            />
          </label>
          <label className={styles.settingRow}>
            <span>{t('usage.config.alertCooldownMinutes')}</span>
            <input
              type="number"
              min={1}
              max={1440}
              step={1}
              value={draft.alertCooldownMinutes}
              disabled={disabled || saving || !alertsSupported || !draft.alertsEnabled}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 1440) edit('alertCooldownMinutes', Math.round(parsed))
              }}
            />
          </label>
          <span className={styles.muted}>{t('usage.config.alertsHint')}</span>
          {planPromoteSupported && (
            <>
              <label className={styles.settingRow}>
                <span>{t('usage.config.planPromotePercent')}</span>
                <input
                  type="number"
                  data-dsh-part="plan-promote-percent"
                  min={1}
                  max={100}
                  step={1}
                  value={draft.planPromotePercent}
                  disabled={disabled || saving}
                  onChange={(event) => {
                    const parsed = Number(event.target.value)
                    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100) edit('planPromotePercent', Math.round(parsed))
                  }}
                />
              </label>
              <span className={styles.settingHint}>{t('usage.config.planPromoteHint')}</span>
            </>
          )}
          {!alertsSupported && (
            <span className={styles.settingWarn} data-dsh-part="alert-settings-host-note">
              {t('usage.config.hostOld')}
            </span>
          )}
        </div>

        <div className={styles.settingsSection}>
          <span className={styles.subTitle}>{t('usage.config.external')}</span>
          {platformSupported && (
            <>
              <label className={styles.settingRow}>
                <span>{t('usage.config.platformUsage')}</span>
                <input type="checkbox" checked={draft.platformUsageEnabled} disabled={disabled || saving} onChange={(event) => { edit('platformUsageEnabled', event.target.checked) }} />
              </label>
              <span className={styles.settingHint}>{t('usage.config.platformUsageHint')}</span>
              <label className={styles.settingRow}>
                <span>{t('usage.config.costEstimate')}</span>
                <input type="checkbox" checked={draft.costEstimateEnabled} disabled={disabled || saving} onChange={(event) => { edit('costEstimateEnabled', event.target.checked) }} />
              </label>
              <span className={styles.settingHint}>{t('usage.config.costEstimateHint')}</span>
            </>
          )}
          <label className={styles.settingRow}>
            <span>{t('usage.config.cpamc')}</span>
            <input type="checkbox" checked={cpamcOn} disabled={disabled || saving} onChange={(event) => { edit('cpamcEnabled', event.target.checked) }} />
          </label>
          <label className={styles.settingRow}>
            <span>{t('usage.config.cpamcUrl')}</span>
            <input
              type="text"
              data-dsh-part="cpamc-url"
              value={draft.cpamcBaseURL}
              disabled={disabled || saving || !cpamcOn}
              placeholder={t('usage.config.cpamcUrl.placeholder')}
              onChange={(event) => { edit('cpamcBaseURL', event.target.value) }}
            />
          </label>
          <span className={styles.settingHint}>{t('usage.config.cpamcUrlHint')}</span>
          <label className={styles.settingRow}>
            <span>{t('usage.config.cpamcAllowedHosts')}</span>
            <input type="text" data-dsh-part="cpamc-allowed-hosts" value={draft.cpamcAllowedHosts} disabled={disabled || saving || !cpamcOn} placeholder="cli.example.com" onChange={(event) => { edit('cpamcAllowedHosts', event.target.value) }} />
          </label>
          <span className={styles.settingHint}>{t('usage.config.cpamcHostsHint')}</span>
          {cpamcOn && !isCpamcLoopbackUrl(draft.cpamcBaseURL, draft.cpamcAllowedHosts) && (
            <span className={styles.settingWarn}>{t('usage.config.cpamcUrl.invalid')}</span>
          )}
          <SecretField
            label={t('usage.config.cpamcToken')}
            dataPart="cpamc-token"
            configured={credentials?.cpamc === true}
            disabled={disabled || !cpamcOn}
            onSave={(secret) => setCredential('cpamc', secret)}
            onClear={() => clearCredential('cpamc')}
            onDraft={(value) => { credentialDrafts.current.cpamc = value }}
          />
          <span className={styles.settingHint}>{t('usage.config.cpamcTokenHint')}</span>
          <div className={styles.sourceTest} data-dsh-part="cpamc-test">
            <button
              type="button"
              className={styles.refreshBtn}
              disabled={disabled || saving || sourceTest?.busy === true}
              onClick={() => testSource('cpamc', undefined, {
                cpamcEnabled: draft.cpamcEnabled,
                cpamcBaseURL: draft.cpamcBaseURL,
                cpamcAllowedHosts: draft.cpamcAllowedHosts,
                ...(credentialDrafts.current.cpamc.trim() === '' ? {} : { cpamcManagementKey: credentialDrafts.current.cpamc }),
              })}
            >
              {sourceTest?.busy === true && sourceTest.target === 'cpamc' ? t('usage.config.testing') : t('usage.config.test')}
            </button>
            {sourceTest?.target === 'cpamc' && sourceTest.busy === false && (
              <span className={sourceTest.error !== undefined || sourceTest.result?.ok === false ? styles.sourceTestFail : styles.sourceTestOk}>
                {testText(sourceTest.result ?? (sourceTest.error === undefined ? undefined : { target: 'cpamc', ok: false, latencyMs: 0, error: sourceTest.error }))}
              </span>
            )}
          </div>
          {sourceTest?.target === 'cpamc' && sourceTest.busy === false && sourceTest.result?.hint !== undefined && (
            <span className={styles.settingHint} data-dsh-part="cpamc-test-hint">{sourceTest.result.hint}</span>
          )}
          <span className={styles.settingHint} data-dsh-part="cpamc-test-draft-hint">{t('usage.config.testDraftHint')}</span>
          {cpamc !== undefined && (
            <span className={cpamc.error !== undefined ? styles.settingWarn : styles.settingHint}>
              {cpamc.displayName}
              {cpamc.error !== undefined
                ? ` · ${friendlyProbeError(cpamc.error) ?? cpamc.error}`
                : `${balanceText(cpamc) !== null ? ` · ${balanceText(cpamc)}` : ''}${
                  cpamc.plan?.windows?.[0]?.percent !== undefined
                    ? ` · ${t('usage.plan.windows.5h.short')} ${Math.round(cpamc.plan.windows[0].percent as number)}%`
                    : ''
                }`}
            </span>
          )}
          <label className={styles.settingRow}>
            <span>{t('usage.config.volcano')}</span>
            <input type="checkbox" checked={volcanoOn} disabled={disabled || saving} onChange={(event) => { edit('volcanoEnabled', event.target.checked) }} />
          </label>
          <SecretField
            label={t('usage.config.volcanoAk')}
            configured={credentials?.volcanoAk === true}
            disabled={disabled || !volcanoOn}
            onSave={(secret) => setCredential('volcano.ak', secret)}
            onClear={() => clearCredential('volcano.ak')}
            onDraft={(value) => { credentialDrafts.current.volcanoAk = value }}
          />
          <SecretField
            label={t('usage.config.volcanoSk')}
            configured={credentials?.volcanoSk === true}
            disabled={disabled || !volcanoOn}
            onSave={(secret) => setCredential('volcano.sk', secret)}
            onClear={() => clearCredential('volcano.sk')}
            onDraft={(value) => { credentialDrafts.current.volcanoSk = value }}
          />
          {volcano !== undefined && (
            <span className={volcano.error !== undefined ? styles.settingWarn : styles.settingHint}>
              {volcano.displayName}
              {volcano.error !== undefined
                ? ` · ${volcano.error}`
                : `${balanceText(volcano) !== null ? ` · ${balanceText(volcano)}` : ''}${
                  volcano.plan?.windows?.[0]?.percent !== undefined
                    ? ` · ${t('usage.plan.windows.5h.short')} ${Math.round(volcano.plan.windows[0].percent as number)}%`
                    : ''
                }`}
            </span>
          )}
          {customPlansSupported && (
            <>
              <CustomPlanEditor
                value={draft.customPlans}
                disabled={disabled || saving}
                onChange={(next) => edit('customPlans', next)}
              />
              {customPlanErrors.length > 0 && (
                <div className={styles.settingWarn} data-dsh-part="custom-plan-errors">
                  {customPlanErrors.map((error, index) => (
                    <span key={`${error.index}-${error.field}-${index}`}>
                      {`#${error.index + 1}${error.id !== undefined ? ` (${error.id})` : ''} ${error.field}: ${friendlyCustomPlanError(error.message) ?? error.message}`}
                    </span>
                  ))}
                </div>
              )}
              {customPlans.length > 0 && (
                <div className={styles.customPlanList} data-dsh-part="custom-plan-list">
                  {customPlans.map((plan) => {
                    const busy = sourceTest?.busy === true && sourceTest.target === 'custom' && sourceTest.id === plan.id
                    const done = sourceTest?.busy === false && sourceTest.target === 'custom' && sourceTest.id === plan.id
                    return (
                      <div className={styles.customPlanRow} key={plan.id}>
                        <div className={styles.customPlanHead}>
                          <span className={styles.customPlanName}>{plan.displayName}</span>
                          <span className={styles.scopeChip}>{plan.id}</span>
                          <button
                            type="button"
                            className={styles.refreshBtn}
                            disabled={disabled || saving || sourceTest?.busy === true}
                            onClick={() => testSource('custom', plan.id, { customPlans: draft.customPlans })}
                          >
                            {busy ? t('usage.config.testing') : t('usage.config.test')}
                          </button>
                        </div>
                        {plan.error !== undefined ? (
                          <span className={styles.settingWarn}>{friendlyCustomPlanError(plan.error) ?? plan.error}</span>
                        ) : (
                          <span className={styles.settingHint}>
                            {plan.plan?.windows !== undefined && plan.plan.windows.length > 0
                              ? plan.plan.windows.map(testWindowText).join(' · ')
                              : t('usage.config.customPlansPending')}
                          </span>
                        )}
                        {done && (
                          <span
                            className={sourceTest.error !== undefined || sourceTest.result?.ok === false ? styles.sourceTestFail : styles.sourceTestOk}
                            data-dsh-part="custom-plan-test-result"
                          >
                            {testText(sourceTest.result ?? (sourceTest.error === undefined ? undefined : { target: 'custom', id: plan.id, ok: false, latencyMs: 0, error: sourceTest.error }))}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
          <span className={styles.muted}>{t('usage.config.externalHint')}</span>
        </div>

        <div className={styles.configActions}>
          {saveError !== undefined && <span className={styles.settingWarn}>{saveError}</span>}
          <button type="button" className={styles.refreshBtn} disabled={disabled || saving || !dirty} onClick={discard}>
            {t('usage.config.discard')}
          </button>
          <button type="button" className={styles.refreshBtn} disabled={disabled || saving || !dirty} onClick={save}>
            {saving ? t('usage.config.saving') : t('usage.config.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * A small select with a plugin-owned popup instead of the native `<select>`
 * menu. The native menu ignores our surface tokens on some platforms (it opens
 * as a light OS popup inside the dark card), so the settings form renders its
 * own listbox that inherits the DSH menu surface in either theme.
 */
function SelectMenu(props: {
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  disabled?: boolean
  onChange: (value: string) => void
}): ReactNode {
  const { label, value, options, disabled = false, onChange } = props
  const menuId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)))
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target) === true) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const openMenu = (): void => {
    if (disabled) return
    setActive(Math.max(0, options.findIndex((option) => option.value === value)))
    setOpen(true)
  }
  const choose = (next: string): void => {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }
  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openMenu()
      }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + options.length) % options.length)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActive(event.key === 'Home' ? 0 : options.length - 1)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const option = options[active]
      if (option !== undefined) choose(option.value)
      return
    }
    if (event.key === 'Tab') setOpen(false)
  }

  return (
    <span ref={rootRef} className={styles.selectWrap} data-dsh-part="setting-select">
      <button
        ref={triggerRef}
        type="button"
        className={styles.selectTrigger}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        disabled={disabled}
        onClick={() => { if (open) setOpen(false); else openMenu() }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={styles.selectValue}>{selected?.label ?? value}</span>
        <svg className={styles.selectChevron} width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className={styles.selectMenu} role="listbox" id={menuId} aria-label={label}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              id={`${menuId}-${index}`}
              aria-selected={option.value === value}
              className={`${styles.selectOption} ${index === active ? styles.selectOptionActive : ''}`}
              onPointerEnter={() => setActive(index)}
              onClick={() => choose(option.value)}
            >
              <span>{option.label}</span>
              {option.value === value && (
                <svg className={styles.selectCheck} width="11" height="9" viewBox="0 0 11 9" aria-hidden="true">
                  <path d="M1 4.5l3 3L10 1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

function SecretField(props: {
  label: string
  /** Optional `data-dsh-part` stamped on the input for tests/screenshots. */
  dataPart?: string
  configured: boolean
  disabled: boolean
  onSave: (value: string) => Promise<void>
  onClear: () => Promise<void>
  /** Notifies the parent of the unsaved value so "test connection" can use it. */
  onDraft?: (value: string) => void
}): ReactNode {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const updateDraft = (value: string): void => {
    setDraft(value)
    props.onDraft?.(value)
  }
  const save = (): void => {
    const value = draft.trim()
    if (value === '' || busy || props.disabled) return
    setBusy(true)
    setError(undefined)
    void props.onSave(value).then(() => {
      setDraft('')
      props.onDraft?.('')
      setBusy(false)
    }, (err: unknown) => {
      setBusy(false)
      setError(err instanceof Error ? err.message : String(err))
    })
  }
  const clear = (): void => {
    if (busy || props.disabled || !props.configured) return
    setBusy(true)
    setError(undefined)
    void props.onClear().then(() => {
      setDraft('')
      props.onDraft?.('')
      setBusy(false)
    }, (err: unknown) => {
      setBusy(false)
      setError(err instanceof Error ? err.message : String(err))
    })
  }
  return (
    <div className={styles.secretField}>
      <div className={styles.settingRow}>
        <span>
          {props.label}
          <span className={styles.secretStatus} data-configured={props.configured ? 'yes' : 'no'}>
            {props.configured ? t('usage.config.secret.configured') : t('usage.config.secret.missing')}
          </span>
        </span>
      </div>
      <div className={styles.secretControls}>
        <input
          type="password"
          data-dsh-part={props.dataPart}
          autoComplete="off"
          spellCheck={false}
          placeholder={props.configured ? t('usage.config.secret.replace') : t('usage.config.secret.placeholder')}
          value={draft}
          disabled={props.disabled || busy}
          onChange={(event) => { updateDraft(event.target.value) }}
          onKeyDown={(event) => { if (event.key === 'Enter') save() }}
        />
        <button type="button" className={styles.refreshBtn} disabled={props.disabled || busy || draft.trim() === ''} onClick={save}>
          {t('usage.config.secret.save')}
        </button>
        <button type="button" className={styles.refreshBtn} disabled={props.disabled || busy || !props.configured} onClick={clear}>
          {t('usage.config.secret.clear')}
        </button>
      </div>
      {error !== undefined && <span className={styles.muted}>{error}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The section.
// ---------------------------------------------------------------------------

function StateGlyph(props: { kind: 'loading' | 'error' | 'disabled' }): ReactNode {
  if (props.kind === 'loading') return <span className={styles.spinner} aria-hidden="true" />
  return (
    <svg className={styles.stateIcon} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {props.kind === 'error'
        ? <><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.2v.1" /></>
        : <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.6a2.4 2.4 0 1 1 3.4 2.2c-.7.35-1 .9-1 1.7" /><path d="M12 16.6v.1" /></>}
    </svg>
  )
}

/** The section component; the slot merges the face into these props. */
export function UsageSectionCard(props: UsageSectionProps): ReactNode {
  const { store, poll, refresh, setRangeDays, settings, setCredential, clearCredential, view } = props
  // Plugins page asks for a one-liner under the card title, or the full page.
  if (view === 'summary') return t('usage.intro')

  const ui = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const settingsSnapshot = settings.getSnapshot()
  const settingsValue = settingsSnapshot.value ?? {}
  const [tab, setTab] = useState<'usage' | 'plans' | 'settings'>('usage')
  const [refreshing, setRefreshing] = useState(false)
  // The enable checkbox writes through the settings scope, so subscribing here
  // keeps the flag below live: the poll starts and stops with it instead of
  // waiting for an unrelated render.
  const [, bumpSettings] = useState(0)
  useEffect(() => settings.subscribe(() => bumpSettings((count) => count + 1)), [settings])
  const enabled = settingsValue.enabled ?? true

  // Poll while mounted, enabled and visible; the overview is cheap (no probes —
  // the host's own cycle owns those) so 10 s keeps balances fresh-ish between
  // manual refreshes.
  useEffect(() => {
    // A disabled plugin deregisters its host routes, so the poll must stop with
    // it; the section re-enables by writing the flag back through the checkbox.
    if (!enabled) return undefined
    poll()
    let timer: number | undefined
    const start = (): void => {
      if (timer === undefined && document.visibilityState === 'visible') timer = window.setInterval(poll, SECTION_POLL_MS)
    }
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        poll()
        start()
      } else if (timer !== undefined) {
        window.clearInterval(timer)
        timer = undefined
      }
    }
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (timer !== undefined) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [poll, enabled])

  const snapshot = ui.snapshot
  // Version skew: a page reload can run the new client over a Host that still
  // has the previous plugin build. That Host's Config schema rejects the alert
  // fields (the whole atomic mutate fails), so advertise them only when the
  // resolved Host form actually contains those keys (or the Host sends health).
  const settingsFields = (() => {
    const resolved = settingsSnapshot.value
    if (resolved === undefined) return undefined
    const keys = Object.keys(resolved)
    return keys.length === 0 ? undefined : keys
  })()
  const alertsSupported = snapshot?.health !== undefined
    || settingsFields === undefined
    || ALERT_SETTING_FIELDS.every((field) => settingsFields.includes(field))
  // v0.6.0 fields: only save them when the running Host's schema lists them, so
  // an older Host never rejects the whole atomic write.
  const platformSupported = settingsFields?.includes('platformUsageEnabled') === true
    || snapshot?.platform !== undefined
    || snapshot?.costEstimate !== undefined
  const customPlansSupported = settingsFields?.includes('customPlans') === true
  const planPromoteSupported = settingsFields?.includes('planPromotePercent') === true

  const onRefresh = (): void => {
    setRefreshing(true)
    try {
      refresh()
    } finally {
      // The POST resolves through the next poll tick; unlock shortly either way.
      window.setTimeout(() => setRefreshing(false), 3000)
    }
  }

  // Disabled, failed and still-loading states keep the settings row mounted:
  // it owns the enable checkbox, so replacing the whole panel would leave the
  // user no way back from the UI.
  if (!enabled || ui.status === 'error' || snapshot === null) {
    const state: 'disabled' | 'error' | 'loading' = !enabled ? 'disabled' : ui.status === 'error' ? 'error' : 'loading'
    return (
      <div className={styles.section} data-dsh-plugin="usage">
        <div className={styles.stateCard} data-state={state} data-dsh-part="status-line">
          <StateGlyph kind={state} />
          <div className={styles.stateBody}>
            <span className={styles.stateTitle}>
              {state === 'disabled'
                ? t('usage.disabled')
                : state === 'error'
                  ? t('usage.error', { error: ui.error ?? '' })
                  : t('usage.loading')}
            </span>
            {state !== 'disabled' && <span className={styles.stateDetail}>{t('usage.intro')}</span>}
          </div>
          {state === 'error' && (
            <button type="button" className={styles.refreshBtn} onClick={() => poll()}>
              {t('usage.retry')}
            </button>
          )}
        </div>
        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected className={`${styles.tab} ${styles.tabActive}`}>
            {t('usage.tab.settings')}
          </button>
        </div>
        <SettingsRow
          settings={settings}
          snapshot={settingsSnapshot.status === 'ready' ? settingsSnapshot : undefined}
          value={settingsValue}
          alertsSupported={alertsSupported}
          platformSupported={platformSupported}
          customPlansSupported={customPlansSupported}
          planPromoteSupported={planPromoteSupported}
          customPlanErrors={snapshot?.customPlanErrors}
          setCredential={setCredential}
          clearCredential={clearCredential}
        />
      </div>
    )
  }

  const current = snapshot.current
  const currentProvider = snapshot.providers.find((provider) => provider.provider === current.provider)
  const matchedPlan = currentPlanProvider(snapshot)
  // Peak-period line: only when the official DeepSeek family is in play this
  // session (the current route, or spend recorded under one today).
  const deepseekPeriod = deepseekPeriodAt(Date.now())
  const deepseekVisible = (current.provider !== undefined && isDeepSeekProviderRoute(current.provider))
    || snapshot.usage.today.providers.some((row) => isDeepSeekProviderRoute(row.provider))
  const planProviders = planTabProviders(snapshot.providers)
  const modelPlans = planProviders.filter((provider) => provider.source === undefined || provider.source === 'model')
  const cpamcPlans = planProviders.filter((provider) => provider.source === 'cpamc')
  const volcanoPlans = planProviders.filter((provider) => provider.source === 'volcano')

  // ---- overview instruments -----------------------------------------
  const days = snapshot.usage.days
  const todayTotals = snapshot.usage.today.totals
  const rangeTotals = snapshot.usage.range?.totals ?? todayTotals
  const allTotals = snapshot.usage.all?.totals ?? rangeTotals
  const todayTokens = totalOf(todayTotals)
  const yesterdayTokens = days.length >= 2 ? totalOf(days[days.length - 2].totals) : undefined
  const tokenDelta = yesterdayTokens !== undefined && yesterdayTokens > 0
    ? ((todayTokens - yesterdayTokens) / yesterdayTokens) * 100
    : null
  const hitRate = cacheHitRate(todayTotals)
  const billedToday = todayTotals.inputTokens + todayTotals.cacheReadTokens + todayTotals.cacheWriteTokens
  const avgCost = todayTotals.calls > 0 && todayTotals.cost > 0 ? todayTotals.cost / todayTotals.calls : null
  const ageMs = Date.now() - snapshot.updatedAt
  const fresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs < FRESH_WINDOW_MS
  const todayProviderIds = new Set(snapshot.usage.today.providers.map((row) => row.provider))
  const identity = currentProvider === undefined
    ? undefined
    : `${currentProvider.displayName}${current.model !== undefined && current.model !== '' ? ` · ${current.model}` : ''}`

  return (
    <div className={styles.section} data-dsh-plugin="usage">
      <header className={styles.pageHead} data-dsh-part="header">
        <div className={styles.pageHeadMain}>
          {/* The Plugins page owns the page title/icon/breadcrumb for this
              item, so the section header starts with the route identity
              instead of repeating the title. */}
          <div className={styles.pageIdentity}>
            <span className={styles.identityName}>{identity ?? t('usage.noData')}</span>
            {currentProvider !== undefined && balanceText(currentProvider) !== null && (
              <span className={`${styles.identityBalance} ${styles.mono}`}>{balanceText(currentProvider)}</span>
            )}
          </div>
        </div>
        <div className={styles.headActions}>
          <span className={styles.freshness} data-fresh={fresh ? 'yes' : 'no'}>
            <i className={styles.freshnessDot} aria-hidden="true" />
            <span className={styles.mono}>{t('usage.updated', { time: formatTime(snapshot.updatedAt) })}</span>
          </span>
          <button type="button" className={styles.refreshBtn} onClick={onRefresh} disabled={refreshing} data-busy={refreshing ? 'yes' : 'no'}>
            <RefreshIcon spinning={refreshing} />
            <span>{refreshing ? t('usage.refreshing') : t('usage.refresh')}</span>
          </button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" data-dsh-part="tabs">
          <button type="button" role="tab" aria-selected={tab === 'usage'} className={tab === 'usage' ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab('usage')}>
            {t('usage.tab.usage')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'plans'} className={tab === 'plans' ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab('plans')}>
            {t('usage.tab.plans')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'settings'} className={tab === 'settings' ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab('settings')}>
            {t('usage.tab.settings')}
          </button>
        </div>
        {tab === 'usage' && (
          <RangeBar
            days={ui.rangeDays}
            covered={coveredRange(snapshot.usage.range, ui.rangeDays)}
            onSelect={setRangeDays}
          />
        )}
      </div>

      {/* Scope line: says what the visible tab measures, so the device-wide
          ledger and the account-level quota are never read as session data. */}
      <span className={styles.scopeNote} data-dsh-part="scope-note">
        {t(`usage.scope.note.${tab}`)}
      </span>

      {tab === 'usage' && (
        <>
          {/* Threshold alerts sit between the range picker and the hero: they
              are about the current facts, not the selected window. */}
          <AlertStack alerts={snapshot.alerts ?? []} providers={snapshot.providers} />
          <div className={styles.cockpit} data-dsh-part="usage-cockpit">
            <div className={`${styles.cell} ${styles.cell12}`}>
              <HeroBand
                todayTokens={todayTokens}
                todayCalls={todayTotals.calls}
                todayCost={todayTotals.cost}
                tokenDelta={tokenDelta}
                rangeTokens={totalOf(rangeTotals)}
                rangeCalls={rangeTotals.calls}
                allTokens={totalOf(allTotals)}
                allCalls={allTotals.calls}
                hitRate={hitRate}
                cacheRead={todayTotals.cacheReadTokens}
                billed={billedToday}
                avgCost={avgCost}
                rangeDays={ui.rangeDays}
              />
            </div>
            {snapshot.platform !== undefined && snapshot.platform.status !== 'unavailable' && (
              <div className={`${styles.cell} ${styles.cell12}`}>
                <PlatformStrip platform={snapshot.platform} />
              </div>
            )}
            <div className={`${styles.cell} ${styles.cell7} ${styles.cellHeatmap}`}>
              <HeatmapCard days={days} providers={snapshot.providers} />
            </div>
            <div className={`${styles.cell} ${styles.cell5} ${styles.cellQuota}`}>
              <QuotaCard provider={matchedPlan} model={current.model} onSeeAll={() => setTab('plans')} />
            </div>
            <div className={`${styles.cell} ${styles.cell7}`}>
              <RangeCard
                range={snapshot.usage.range}
                providers={snapshot.providers}
                currentProvider={current.provider}
                rangeDays={ui.rangeDays}
                costEstimate={snapshot.costEstimate}
              />
            </div>
            <div className={`${styles.cell} ${styles.cell5}`}>
              <section className={styles.card} data-dsh-part="provider-card">
                <div className={styles.cardHead}>
                  <div className={styles.cardHeadGroup}>
                    <span className={styles.cardTitle}>{t('usage.today')}</span>
                  </div>
                  {deepseekVisible && (
                    <span className={styles.peakPill} data-dsh-part="peak-status">
                      {t(deepseekPeriod.peak ? 'usage.peak.on' : 'usage.peak.off', { time: formatClock(deepseekPeriod.boundaryMs) })}
                    </span>
                  )}
                </div>
                <ProviderBreakdown
                  rows={snapshot.usage.today.providers}
                  providers={snapshot.providers}
                  current={current.provider}
                />
                <BalanceInline
                  providers={snapshot.providers}
                  current={current.provider}
                  excludeIds={todayProviderIds}
                />
                <TokenComposition totals={todayTotals} />
              </section>
            </div>
            <div className={`${styles.cell} ${styles.cell12}`}>
              <HistoryCard days={days} />
            </div>
          </div>
        </>
      )}

      {tab === 'plans' && (
        planProviders.length === 0
          ? <div className={styles.card}><span className={styles.muted}>{t('usage.plan.noneConfigured')}</span></div>
          : (
            <div className={styles.plans}>
              <PlanGroup wide title={t('usage.plan.group.models')} providers={modelPlans} currentId={matchedPlan?.provider} showEmpty />
              <PlanGroup title={t('usage.plan.group.cpamc')} providers={cpamcPlans} currentId={matchedPlan?.provider} showEmpty />
              <PlanGroup title={t('usage.plan.group.volcano')} providers={volcanoPlans} currentId={matchedPlan?.provider} showEmpty />
            </div>
          )
      )}

      {tab === 'settings' && (
        <>
          <ExportCard days={ui.rangeDays} />
          <SettingsRow
            settings={settings}
            snapshot={settingsSnapshot.status === 'ready' ? settingsSnapshot : undefined}
            value={settingsValue}
            alertsSupported={alertsSupported}
          platformSupported={platformSupported}
          customPlansSupported={customPlansSupported}
          planPromoteSupported={planPromoteSupported}
          customPlanErrors={snapshot.customPlanErrors}
            providers={snapshot.providers}
            credentials={snapshot.externalCredentials}
            setCredential={setCredential}
            clearCredential={clearCredential}
          />
          <HealthCard health={snapshot.health} providers={snapshot.providers} />
        </>
      )}
    </div>
  )
}
