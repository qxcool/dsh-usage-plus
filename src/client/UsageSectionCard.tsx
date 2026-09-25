/**
 * The usage statistics settings section: overview (today's usage, balances,
 * trend), plan quotas, and settings. Data comes from the host's
 * loopback-fenced /api/dsh-usage-plus/overview document; polling runs only
 * while the section is mounted and the tab is visible.
 * @module dsh-usage-plus/client/UsageSectionCard
 */

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { UsageStoreInstance } from './usage-store.ts'
import { formatPlanReset, friendlyProbeError, isCpamcLoopbackUrl, t } from './locales.ts'
import { PlanUsageStrip } from './PlanUsageStrip.tsx'
import styles from './usage.module.css'
import { isDeepSeekProviderRoute } from '../core/adapters.ts'
import { buildHeatmapGrid } from '../core/heatmap.ts'
import { currentPlanProvider, orderedPlanWindows, planSourceLabelKey, planTabProviders } from '../core/plan-match.ts'
import { deepseekPeriodAt } from '../core/pricing.ts'
import type { ExternalCredentialStatus, ExternalCredentialTarget, ProviderSnapshotView, UsageDaySummary, UsageOverviewView, UsageProviderSummary, UsageTokenTotals } from '../core/types.ts'

/** The settings fields this section edits (staged Save via configForms.mutate). */
export interface UsageSettings {
  enabled?: boolean
  pollIntervalSec?: number
  bubbleMode?: string
  cpamcEnabled?: boolean
  cpamcBaseURL?: string
  cpamcManagementKeyEnv?: string
  cpamcAllowedHosts?: string
  volcanoEnabled?: boolean
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
  /** Atomic multi-field write (preferred for Save on plugins.item pages). */
  mutate(
    ops: ReadonlyArray<{ op: 'set'; path: readonly string[]; value: unknown } | { op: 'unset'; path: readonly string[] }>,
    expectedRevision?: number,
  ): Promise<boolean>
}

/** The registration-side face the plugins.item slot injects. */
export interface UsageSectionFace {
  /** The section-local store (overview snapshot + lifecycle). */
  store: UsageStoreInstance
  /** Fetch one overview now. */
  poll: () => void
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

/** Compact token count: 12345 -> 12.3k, 1234567 -> 1.23M. */
export function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value < 1000) return String(value)
  if (value < 1_000_000) return trim(value / 1000) + 'k'
  if (value < 1_000_000_000) return trim(value / 1_000_000) + 'M'
  return trim(value / 1_000_000_000) + 'B'
}

function trim(value: number): string {
  return value >= 100 ? String(Math.round(value)) : value.toFixed(value >= 10 ? 1 : 2).replace(/\.?0+$/, '')
}

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

/** Formatted CNY spend estimate (the only priced currency today). */
function formatCost(cost: number): string {
  return '¥' + cost.toFixed(2)
}

function toneClass(percent: number): string {
  if (percent >= 90) return styles.barLow
  if (percent >= 70) return styles.barWarn
  return styles.barFill
}

/** A provider row backed by a configured credential (api key, env key, or OAuth grant). */
function isConfigured(provider: ProviderSnapshotView): boolean {
  // An older wire document without the credential field renders as before.
  return provider.credential !== 'none'
}

function totalOf(totals: UsageTokenTotals): number {
  return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens
}

function cacheHitRate(totals: UsageTokenTotals): number | null {
  const billed = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
  if (billed <= 0) return null
  return (totals.cacheReadTokens / billed) * 100
}

function TotalsRow(props: {
  totals: UsageTokenTotals
  rangeTotals?: UsageTokenTotals
  allTotals?: UsageTokenTotals
  store: UsageStoreInstance
  startStripPolling: () => () => void
}): ReactNode {
  const { totals, rangeTotals, allTotals, store, startStripPolling } = props
  const hit = cacheHitRate(totals)
  const billed = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
  const month = rangeTotals ?? emptyLike(totals)
  const all = allTotals ?? month
  const avgCost = totals.calls > 0 && totals.cost > 0 ? totals.cost / totals.calls : null

  return (
    <>
      <div className={styles.summaryGrid}>
        <SummaryTile label={t('usage.summary.today')} totals={totals} />
        <SummaryTile label={t('usage.summary.month')} totals={month} />
        <SummaryTile label={t('usage.summary.all')} totals={all} />
      </div>
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiTile} ${styles.kpiAccent}`}>
          <span className={`${styles.kpiValue} ${hit !== null && hit >= 90 ? styles.kpiGood : ''}`}>
            {hit === null ? '—' : `${hit >= 10 ? Math.round(hit) : hit.toFixed(1)}%`}
          </span>
          <span className={styles.kpiLabel}>{t('usage.tokens.cacheHit')}</span>
          <span className={styles.kpiHint}>
            {t('usage.tokens.cacheRatio', {
              read: formatTokens(totals.cacheReadTokens),
              billed: formatTokens(billed),
            })}
          </span>
        </div>
        <div className={styles.kpiTile}>
          <span className={styles.kpiValue}>{formatTokens(totalOf(totals))}</span>
          <span className={styles.kpiLabel}>{t('usage.tokens.total')}</span>
          <span className={styles.kpiHint}>
            {t('usage.tokens.detail', {
              input: formatTokens(totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens),
              output: formatTokens(totals.outputTokens),
            })}
          </span>
        </div>
        <div className={styles.kpiTile}>
          <span className={styles.kpiValue}>{avgCost === null ? '—' : formatCost(avgCost)}</span>
          <span className={styles.kpiLabel}>{t('usage.metric.avgCost')}</span>
          <span className={styles.kpiHint}>{t('usage.metric.avgCostHint', { n: totals.calls })}</span>
        </div>
        <div className={styles.kpiTile}>
          <span className={styles.kpiValue}>{totals.calls}</span>
          <span className={styles.kpiLabel}>{t('usage.tokens.calls')}</span>
          <span className={styles.kpiHint}>{t('usage.calls', { n: totals.calls })}</span>
        </div>
      </div>
      {/* Quota ring right after the cache-hit KPI row — the card owns this
          React tree, so it renders regardless of shell slot wiring. */}
      <div className={styles.quotaStripRow}>
        <PlanUsageStrip store={store} startStripPolling={startStripPolling} />
      </div>
      <TokenBuckets totals={totals} />
    </>
  )
}

function emptyLike(_totals: UsageTokenTotals): UsageTokenTotals {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, calls: 0, cost: 0 }
}

function SummaryTile(props: { label: string; totals: UsageTokenTotals }): ReactNode {
  const { label, totals } = props
  return (
    <div className={styles.summaryTile}>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{totals.cost > 0 ? formatCost(totals.cost) : formatTokens(totalOf(totals))}</span>
      <span className={styles.summaryHint}>
        {t('usage.summary.tokens')} {formatTokens(totalOf(totals))} · {t('usage.summary.calls')} {totals.calls}
        {totals.cost > 0 ? ` · ${t('usage.summary.cost')} ${formatCost(totals.cost)}` : ''}
      </span>
    </div>
  )
}

function TokenBuckets(props: { totals: UsageTokenTotals }): ReactNode {
  const { totals } = props
  const rows: Array<{ key: string; label: string; value: number }> = [
    { key: 'input', label: t('usage.tokens.input'), value: totals.inputTokens },
    { key: 'cacheRead', label: t('usage.tokens.cacheRead'), value: totals.cacheReadTokens },
    { key: 'cacheWrite', label: t('usage.tokens.cacheWrite'), value: totals.cacheWriteTokens },
    { key: 'output', label: t('usage.tokens.output'), value: totals.outputTokens },
  ]
  if (totals.reasoningTokens > 0) rows.push({ key: 'reasoning', label: t('usage.tokens.reasoning'), value: totals.reasoningTokens })
  rows.push({ key: 'calls', label: t('usage.tokens.calls'), value: totals.calls })
  return (
    <div className={styles.bucketGrid} data-dsh-part="token-buckets">
      <span className={styles.subTitle}>{t('usage.tokens.buckets')}</span>
      <div className={styles.bucketRow}>
        {rows.map((row) => (
          <div key={row.key} className={styles.bucketCell}>
            <span className={styles.bucketLabel}>{row.label}</span>
            <span className={styles.bucketValue}>{row.key === 'calls' ? row.value : formatTokens(row.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProviderBreakdown(props: {
  rows: UsageProviderSummary[]
  providers: ProviderSnapshotView[]
  current?: string
}): ReactNode {
  const { rows, providers, current } = props
  const [open, setOpen] = useState<Record<string, boolean>>({})
  if (rows.length === 0) return null
  return (
    <div data-dsh-part="provider-list">
      <span className={styles.subTitle}>{t('usage.today.breakdown')}</span>
      {rows.map((row) => {
        const provider = providers.find((item) => item.provider === row.provider)
        const expanded = open[row.provider] === true
        const hasModels = row.models.length > 0
        const balance = provider === undefined ? null : balanceText(provider)
        return (
          <div key={row.provider} className={styles.providerBlock}>
            <button
              type="button"
              className={styles.providerRowBtn}
              disabled={!hasModels}
              aria-expanded={expanded}
              onClick={() => {
                if (!hasModels) return
                setOpen((prev) => ({ ...prev, [row.provider]: !expanded }))
              }}
            >
              <span className={styles.providerName}>
                {provider?.displayName ?? row.provider}
                {current === row.provider && <span className={styles.currentBadge}>{t('usage.current')}</span>}
              </span>
              <span className={styles.providerMeta}>
                {balance !== null && (
                  <span className={styles.providerBalanceInline}>{balance}</span>
                )}
                <span className={styles.providerTokens}>
                  {formatTokens(totalOf(row.totals))}
                  {' · '}
                  {t('usage.calls', { n: row.totals.calls })}
                  {row.totals.cost > 0 ? ` · ${formatCost(row.totals.cost)}` : ''}
                </span>
                {hasModels && <span className={styles.expandHint}>{expanded ? t('usage.collapse') : t('usage.expand')}</span>}
              </span>
            </button>
            {expanded && row.models.map((model) => (
              <div key={model.model} className={styles.modelRow}>
                <span className={styles.modelName}>{model.model}</span>
                <span className={styles.providerTokens}>
                  {formatTokens(totalOf(model.totals))}
                  {' · '}
                  {t('usage.calls', { n: model.totals.calls })}
                  {model.totals.cost > 0 ? ` · ${formatCost(model.totals.cost)}` : ''}
                </span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
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
            <span className={`${styles.statusDot} ${low ? styles.statusWarn : styles.statusOk}`} aria-hidden="true" />
            <span className={styles.providerName}>
              {provider.displayName}
              {props.current === provider.provider && <span className={styles.currentBadge}>{t('usage.current')}</span>}
            </span>
          </span>
          <span className={styles.balanceMeta}>
            <span className={styles.providerBalance}>{balanceText(provider)}</span>
            <span className={styles.balanceHint}>{balanceStatus(provider)}</span>
          </span>
        </div>
        )
      })}
    </div>
  )
}

/** Overview hero: only the plan matched to the current model route. */
function PlanHero(props: {
  provider: ProviderSnapshotView
  model?: string
  onSeeAll: () => void
}): ReactNode {
  const { provider, model, onSeeAll } = props
  const windows = orderedPlanWindows(provider.plan)
  if (windows.length === 0) return null
  const title = model === undefined || model === ''
    ? provider.displayName
    : `${provider.displayName} · ${model}`
  return (
    <div className={styles.card} data-dsh-part="plan-hero">
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{t('usage.plan.preview')}</span>
        <button type="button" className={styles.linkBtn} onClick={onSeeAll}>{t('usage.plan.seeAll')}</button>
      </div>
      <div className={styles.planPreviewBlock}>
        <span className={styles.providerName}>
          {title}
          <span className={styles.currentBadge}>{t('usage.current')}</span>
          <span className={styles.sourceChip}>{t(planSourceLabelKey(provider))}</span>
          {provider.plan?.planName !== undefined ? <span className={styles.mutedInline}> · {provider.plan.planName}</span> : null}
        </span>
        <div className={styles.planMiniGrid}>
          {windows.slice(0, 3).map((window) => {
            const percent = window.percent as number
            const label = window.key === '5h' || window.key === 'week' || window.key === 'month'
              ? t(`usage.plan.windows.${window.key}`)
              : (window.name ?? window.key)
            return (
              <div key={window.key} className={styles.planMini}>
                <span className={styles.planMiniLabel}>
                  <span>{label}</span>
                  <span>{percent >= 10 ? Math.round(percent) : percent.toFixed(1)}%</span>
                </span>
                <span className={styles.bar}>
                  <span className={toneClass(percent)} style={{ width: `${Math.min(100, Math.max(0, percent))}%`, display: 'block' }} />
                </span>
                <span className={styles.resetLine}>{formatPlanReset(window.resetsAt)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function balanceText(provider: ProviderSnapshotView): string | null {
  if (provider.balance === undefined) return null
  const currency = provider.balance.currency.toUpperCase()
  const prefix = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : ''
  const suffix = currency !== 'CNY' && currency !== 'USD' ? ` ${currency}` : ''
  return `${prefix}${provider.balance.totalBalance}${suffix}`
}

/** The section component; the slot merges the face into these props. */
export function UsageSectionCard(props: UsageSectionProps): ReactNode {
  const { store, poll, refresh, settings, setCredential, clearCredential, startStripPolling, view } = props
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
    return (
      <div className={styles.section} data-dsh-plugin="usage">
        <span className={styles.muted} data-dsh-part="status-line">
          {!enabled
            ? t('usage.disabled')
            : ui.status === 'error'
              ? t('usage.error', { error: ui.error ?? '' })
              : t('usage.loading')}
        </span>
        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected className={`${styles.tab} ${styles.tabActive}`}>
            {t('usage.tab.settings')}
          </button>
        </div>
        <SettingsRow
          settings={settings}
          snapshot={settingsSnapshot.status === 'ready' ? settingsSnapshot : undefined}
          value={settingsValue}
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

  return (
    <div className={styles.section} data-dsh-plugin="usage">
      <div className={styles.header} data-dsh-part="header">
        <span className={styles.currentProvider}>
          {currentProvider !== undefined
            ? <>
                <span className={styles.identityName}>
                  {currentProvider.displayName}
                  {current.model !== undefined && current.model !== '' ? ` · ${current.model}` : ''}
                </span>
                {balanceText(currentProvider) !== null && (
                  <span className={styles.identityBalance}>{balanceText(currentProvider)}</span>
                )}
              </>
            : t('usage.noData')}
        </span>
        <span className={styles.headerActions}>
          <span className={styles.muted}>{t('usage.updated', { time: formatTime(snapshot.updatedAt) })}</span>
          <button type="button" className={styles.refreshBtn} onClick={onRefresh} disabled={refreshing}>
            {refreshing ? t('usage.refreshing') : t('usage.refresh')}
          </button>
        </span>
      </div>

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
        <>
          {matchedPlan !== undefined && orderedPlanWindows(matchedPlan.plan).length > 0 && (
            <PlanHero
              provider={matchedPlan}
              model={current.model}
              onSeeAll={() => setTab('plans')}
            />
          )}

          <div className={styles.card} data-dsh-part="today-card">
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>{t('usage.today')}</span>
              {deepseekVisible && (
                <span className={styles.peakPill} data-dsh-part="peak-status">
                  {t(deepseekPeriod.peak ? 'usage.peak.on' : 'usage.peak.off', { time: formatClock(deepseekPeriod.boundaryMs) })}
                </span>
              )}
            </div>
            {snapshot.usage.today.totals.calls === 0 && (snapshot.usage.range?.totals.calls ?? 0) === 0
              ? <span className={styles.muted}>{t('usage.noData')}</span>
              : <TotalsRow
                  totals={snapshot.usage.today.totals}
                  rangeTotals={snapshot.usage.range?.totals}
                  allTotals={snapshot.usage.all?.totals}
                  store={store}
                  startStripPolling={startStripPolling}
                />}
            <ProviderBreakdown
              rows={snapshot.usage.today.providers}
              providers={snapshot.providers}
              current={current.provider}
            />
            <BalanceInline
              providers={snapshot.providers}
              current={current.provider}
              excludeIds={new Set(snapshot.usage.today.providers.map((row) => row.provider))}
            />
          </div>

          <HeatmapCard days={snapshot.usage.days} />
          <RangeCard range={snapshot.usage.range} providers={snapshot.providers} currentProvider={current.provider} />
          <HistoryCard days={snapshot.usage.days} />
        </>
      )}

      {tab === 'plans' && (
        planProviders.length === 0
          ? <div className={styles.card}><span className={styles.muted}>{t('usage.plan.noneConfigured')}</span></div>
          : <>
              <PlanGroup title={t('usage.plan.group.models')} providers={modelPlans} currentId={matchedPlan?.provider} showEmpty />
              <PlanGroup title={t('usage.plan.group.cpamc')} providers={cpamcPlans} currentId={matchedPlan?.provider} showEmpty />
              <PlanGroup title={t('usage.plan.group.volcano')} providers={volcanoPlans} currentId={matchedPlan?.provider} showEmpty />
            </>
      )}

      {tab === 'settings' && (
        <SettingsRow
          settings={settings}
          snapshot={settingsSnapshot.status === 'ready' ? settingsSnapshot : undefined}
          value={settingsValue}
          providers={snapshot.providers}
          credentials={snapshot.externalCredentials}
          setCredential={setCredential}
          clearCredential={clearCredential}
        />
      )}
    </div>
  )
}

function PlanGroup(props: {
  title: string
  providers: ProviderSnapshotView[]
  currentId?: string
  showEmpty?: boolean
}): ReactNode {
  const { title, providers, currentId, showEmpty } = props
  if (providers.length === 0 && !showEmpty) return null
  return (
    <div className={styles.planGroup}>
      <span className={styles.cardTitle}>{t('usage.plan.groupCount', { title, n: providers.length })}</span>
      {providers.length === 0
        ? <div className={styles.card}><span className={styles.muted}>{t('usage.plan.groupEmpty')}</span></div>
        : providers.map((provider) => <PlanCard key={provider.provider} provider={provider} currentId={currentId} />)}
    </div>
  )
}

function HeatmapCard(props: { days: UsageDaySummary[] }): ReactNode {
  const grid = buildHeatmapGrid(props.days)
  const hasData = grid.cells.some((cell) => cell.tokens > 0)
  return (
    <div className={styles.card} data-dsh-part="heatmap-card">
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{t('usage.heatmap')}</span>
        <span className={styles.muted}>{t('usage.heatmap.weeks')}</span>
      </div>
      {!hasData
        ? <span className={styles.muted}>{t('usage.heatmap.empty')}</span>
        : <>
            <div className={styles.heatmapWrap}>
              <div className={styles.heatmapDow}>
                <span>{t('usage.heatmap.dow.mon')}</span>
                <span />
                <span>{t('usage.heatmap.dow.wed')}</span>
                <span />
                <span>{t('usage.heatmap.dow.fri')}</span>
                <span />
                <span />
              </div>
              <div className={styles.heatmapMain}>
                <div className={styles.heatmapMonths}>
                  {grid.monthLabels.map((label, index) => (
                    <span key={`m${index}`}>{label}</span>
                  ))}
                </div>
                <div className={styles.heatmapGrid26}>
                  {grid.cells.map((cell) => {
                    const cost = cell.totals.cost > 0 ? ` · ${formatCost(cell.totals.cost)}` : ''
                    return (
                      <span
                        key={cell.date}
                        className={`${styles.heatmapCell26} ${styles[`heatmapL${cell.level}`]} ${cell.isToday ? styles.heatmapToday : ''}`}
                        title={t('usage.heatmap.day', {
                          date: cell.date,
                          tokens: formatTokens(cell.tokens),
                          calls: t('usage.calls', { n: cell.totals.calls }),
                          cost,
                        })}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
            <div className={styles.heatmapLegend}>
              <span>{t('usage.heatmap.less')}</span>
              <span className={`${styles.heatmapCell26} ${styles.heatmapL0}`} />
              <span className={`${styles.heatmapCell26} ${styles.heatmapL1}`} />
              <span className={`${styles.heatmapCell26} ${styles.heatmapL2}`} />
              <span className={`${styles.heatmapCell26} ${styles.heatmapL3}`} />
              <span className={`${styles.heatmapCell26} ${styles.heatmapL4}`} />
              <span>{t('usage.heatmap.more')}</span>
            </div>
          </>}
    </div>
  )
}

function HistoryCard(props: { days: UsageDaySummary[] }): ReactNode {
  const [open, setOpen] = useState(false)
  const days = [...props.days].slice(-14).reverse()
  return (
    <div className={styles.card} data-dsh-part="history-card">
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{t('usage.history')}</span>
        <button type="button" className={styles.linkBtn} onClick={() => setOpen((value) => !value)}>
          {open ? t('usage.history.hide') : t('usage.history.show')}
        </button>
      </div>
      {open && (days.length === 0
        ? <span className={styles.muted}>{t('usage.history.empty')}</span>
        : days.map((day) => (
          <div key={day.date} className={styles.historyRow}>
            <span className={styles.historyDate}>{day.date}</span>
            <span className={styles.providerTokens}>
              {formatTokens(totalOf(day.totals))}
              {' · '}
              {t('usage.calls', { n: day.totals.calls })}
              {day.totals.cost > 0 ? ` · ${formatCost(day.totals.cost)}` : ''}
            </span>
          </div>
        )))}
    </div>
  )
}

/** How many model sub-bars render under one provider bar. */
const CHART_MODEL_CAP = 3

/**
 * The 近 30 天 card: horizontal bars per provider over the trend window,
 * each with its heaviest models as nested sub-bars. Window totals come from
 * the host's aggregated `usage.range` (an older host without it renders no
 * card instead of a wrong one).
 */
function RangeCard(props: { range?: UsageOverviewView['usage']['range']; providers: ProviderSnapshotView[]; currentProvider?: string }): ReactNode {
  const { range, providers, currentProvider } = props
  if (range === undefined) return null
  const grandTotal = range.totals.inputTokens + range.totals.outputTokens + range.totals.cacheReadTokens + range.totals.cacheWriteTokens
  const maxProvider = Math.max(1, ...range.providers.map((row) => totalOf(row.totals)))
  const nameOf = (id: string): string => providers.find((provider) => provider.provider === id)?.displayName ?? id
  return (
    <div className={styles.card} data-dsh-part="trend-card">
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{t('usage.trend')}</span>
        {grandTotal > 0 && (
          <span className={styles.cardSummary}>
            {t('usage.trend.summary', {
              tokens: formatTokens(grandTotal),
              calls: t('usage.calls', { n: range.totals.calls }),
            })}
          </span>
        )}
      </div>
      {range.providers.length === 0 || grandTotal === 0
        ? <span className={styles.muted}>{t('usage.noData')}</span>
        : <div className={styles.chart} data-dsh-part="usage-chart">
            {range.providers.map((row) => (
              <ChartProviderRow key={row.provider} row={row} name={nameOf(row.provider)} max={maxProvider} current={currentProvider === row.provider} />
            ))}
            <span className={styles.trendAxis}>
              <span>{range.from.slice(5)}</span>
              <span>{range.to.slice(5)}</span>
            </span>
          </div>}
    </div>
  )
}

function ChartProviderRow(props: { row: UsageProviderSummary; name: string; max: number; current: boolean }): ReactNode {
  const { row, name, max, current } = props
  const total = totalOf(row.totals)
  const maxModel = Math.max(1, ...row.models.slice(0, CHART_MODEL_CAP).map((model) => totalOf(model.totals)))
  return (
    <div className={styles.chartProvider}>
      <span className={styles.chartHead}>
        <span className={styles.providerName}>
          {name}
          {current && <span className={styles.currentBadge}>{t('usage.current')}</span>}
        </span>
        <span className={styles.chartTokens}>{formatTokens(total)} · {t('usage.calls', { n: row.totals.calls })}</span>
      </span>
      <span className={styles.chartBar}>
        <span className={styles.chartFill} style={{ width: `${Math.max(2, Math.round((total / max) * 100))}%` }} />
      </span>
      {row.models.slice(0, CHART_MODEL_CAP).map((model) => {
        const modelTotal = totalOf(model.totals)
        return (
          <span key={model.model} className={styles.chartModel} title={`${row.provider} · ${model.model}: ${formatTokens(modelTotal)}`}>
            <span className={styles.chartModelName}>{model.model}</span>
            <span className={styles.chartModelBar}>
              <span className={styles.chartModelFill} style={{ width: `${Math.max(3, Math.round((modelTotal / maxModel) * 100))}%` }} />
            </span>
            <span className={styles.chartTokens}>{formatTokens(modelTotal)}</span>
          </span>
        )
      })}
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
          {provider.plan?.planName !== undefined ? ` · ${provider.plan.planName}` : ''}
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
                  <span>{window.name ?? t(`usage.plan.windows.${window.key}`)}</span>
                  <span>{`${percent >= 10 ? Math.round(percent) : percent.toFixed(1)}%`}</span>
                </span>
                <span className={styles.bar}>
                  <span className={toneClass(percent)} style={{ width: `${Math.min(100, Math.max(0, percent))}%`, display: 'block' }} />
                </span>
                <span className={styles.resetLine}>{formatPlanReset(window.resetsAt)}</span>
              </div>
            )
          })}
    </div>
  )
}

const CONFIG_DEFAULTS: Required<Pick<UsageSettings, 'enabled' | 'pollIntervalSec' | 'bubbleMode' | 'cpamcEnabled' | 'cpamcBaseURL' | 'cpamcAllowedHosts' | 'volcanoEnabled'>> = {
  enabled: true,
  pollIntervalSec: 60,
  bubbleMode: 'always',
  cpamcEnabled: false,
  cpamcBaseURL: 'http://127.0.0.1:8317',
  cpamcAllowedHosts: '',
  volcanoEnabled: false,
}

function normalizeSettings(value: UsageSettings | undefined): typeof CONFIG_DEFAULTS {
  const bubble = value?.bubbleMode
  return {
    enabled: value?.enabled ?? CONFIG_DEFAULTS.enabled,
    pollIntervalSec: typeof value?.pollIntervalSec === 'number' ? value.pollIntervalSec : CONFIG_DEFAULTS.pollIntervalSec,
    bubbleMode: bubble === 'change' || bubble === 'off' || bubble === 'always' ? bubble : CONFIG_DEFAULTS.bubbleMode,
    cpamcEnabled: value?.cpamcEnabled ?? CONFIG_DEFAULTS.cpamcEnabled,
    cpamcBaseURL: value?.cpamcBaseURL ?? CONFIG_DEFAULTS.cpamcBaseURL,
    cpamcAllowedHosts: value?.cpamcAllowedHosts ?? CONFIG_DEFAULTS.cpamcAllowedHosts,
    volcanoEnabled: value?.volcanoEnabled ?? CONFIG_DEFAULTS.volcanoEnabled,
  }
}

/**
 * Config tab for plugins.item: edits stay staged until Save.
 * Matches the official Plugins page contract (leave page → discard draft).
 */
function SettingsRow(props: {
  settings: UsageSectionProps['settings']
  snapshot?: { writable: boolean; revision?: number }
  value: UsageSettings
  providers?: ProviderSnapshotView[]
  credentials?: ExternalCredentialStatus
  setCredential: UsageSectionProps['setCredential']
  clearCredential: UsageSectionProps['clearCredential']
}): ReactNode {
  const { settings, snapshot, value, providers = [], credentials, setCredential, clearCredential } = props
  const disabled = snapshot !== undefined && !snapshot.writable
  const [draft, setDraft] = useState(() => normalizeSettings(value))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | undefined>()

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
      { op: 'set', path: ['cpamcEnabled'], value: draft.cpamcEnabled },
      { op: 'set', path: ['cpamcBaseURL'], value: draft.cpamcBaseURL },
      { op: 'set', path: ['cpamcAllowedHosts'], value: draft.cpamcAllowedHosts },
      { op: 'set', path: ['volcanoEnabled'], value: draft.volcanoEnabled },
    ]
    void settings.mutate(ops, snapshot?.revision).then((ok) => {
      setSaving(false)
      if (!ok) {
        setSaveError(t('usage.config.saveFailed'))
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
  const cpamcOn = draft.cpamcEnabled
  const volcanoOn = draft.volcanoEnabled
  return (
    <div className={styles.card} data-dsh-part="settings-row">
      <span className={styles.cardTitle}>{t('usage.config.title')}</span>
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
        <label className={styles.settingRow}>
          <span>{t('usage.config.bubbleMode')}</span>
          <select
            value={draft.bubbleMode}
            disabled={disabled || saving}
            onChange={(event) => {
              const next = event.target.value
              if (next === 'always' || next === 'change' || next === 'off') edit('bubbleMode', next)
            }}
          >
            <option value="always">{t('usage.config.bubbleMode.always')}</option>
            <option value="change">{t('usage.config.bubbleMode.change')}</option>
            <option value="off">{t('usage.config.bubbleMode.off')}</option>
          </select>
        </label>
      </div>

      <div className={styles.settingsSection}>
        <span className={styles.subTitle}>{t('usage.config.external')}</span>
        <label className={styles.settingRow}>
          <span>{t('usage.config.cpamc')}</span>
          <input type="checkbox" checked={cpamcOn} disabled={disabled || saving} onChange={(event) => { edit('cpamcEnabled', event.target.checked) }} />
        </label>
        <label className={styles.settingRow}>
          <span>{t('usage.config.cpamcUrl')}</span>
          <input
            type="text"
            value={draft.cpamcBaseURL}
            disabled={disabled || saving || !cpamcOn}
            placeholder={t('usage.config.cpamcUrl.placeholder')}
            onChange={(event) => { edit('cpamcBaseURL', event.target.value) }}
          />
        </label>
        <label className={styles.settingRow}>
          <span>{t('usage.config.cpamcAllowedHosts')}</span>
          <input type="text" value={draft.cpamcAllowedHosts} disabled={disabled || saving || !cpamcOn} placeholder="cli.example.com" onChange={(event) => { edit('cpamcAllowedHosts', event.target.value) }} />
        </label>
        {cpamcOn && !isCpamcLoopbackUrl(draft.cpamcBaseURL, draft.cpamcAllowedHosts) && (
          <span className={styles.settingWarn}>{t('usage.config.cpamcUrl.invalid')}</span>
        )}
        <SecretField
          label={t('usage.config.cpamcToken')}
          configured={credentials?.cpamc === true}
          disabled={disabled || !cpamcOn}
          onSave={(secret) => setCredential('cpamc', secret)}
          onClear={() => clearCredential('cpamc')}
        />
        {cpamc !== undefined && (
          <span className={styles.settingHint}>
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
        />
        <SecretField
          label={t('usage.config.volcanoSk')}
          configured={credentials?.volcanoSk === true}
          disabled={disabled || !volcanoOn}
          onSave={(secret) => setCredential('volcano.sk', secret)}
          onClear={() => clearCredential('volcano.sk')}
        />
        {volcano !== undefined && (
          <span className={styles.settingHint}>
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
  )
}

function SecretField(props: {
  label: string
  configured: boolean
  disabled: boolean
  onSave: (value: string) => Promise<void>
  onClear: () => Promise<void>
}): ReactNode {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const save = (): void => {
    const value = draft.trim()
    if (value === '' || busy || props.disabled) return
    setBusy(true)
    setError(undefined)
    void props.onSave(value).then(() => {
      setDraft('')
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
          autoComplete="off"
          spellCheck={false}
          placeholder={props.configured ? t('usage.config.secret.replace') : t('usage.config.secret.placeholder')}
          value={draft}
          disabled={props.disabled || busy}
          onChange={(event) => { setDraft(event.target.value) }}
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
