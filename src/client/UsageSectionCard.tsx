/**
 * The usage statistics settings section: three tabs (用量: today's usage,
 * balances, trend; 个人套餐: per-provider plan quota windows; Token 银行:
 * the whale-yuan voucher minted from the DeepSeek official family's usage)
 * plus a compact settings row. Data comes from the host's loopback-fenced
 * /api/dsh-usage/overview document; polling runs only while the section is
 * mounted and the tab is visible.
 * @module @linxin666/dsh-usage/client/UsageSectionCard
 */

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { UsageStoreInstance } from './usage-store.ts'
import { t } from './locales.ts'
import styles from './usage.module.css'
import { isDeepSeekProviderRoute } from '../core/adapters.ts'
import { customBalanceCredentialVars } from '../core/custom-balance.ts'
import { buildHeatmapGrid } from '../core/heatmap.ts'
import { currentPlanProvider, orderedPlanWindows, planSourceLabelKey, planTabProviders } from '../core/plan-match.ts'
import { deepseekPeriodAt } from '../core/pricing.ts'
import { deepseekVoucherData, drawVoucher, faceValue, formatDay, formatDenomination, loadVoucherArt } from './voucher.ts'
import type { ExternalCredentialStatus, ExternalCredentialTarget, ObservedSpendView, ProviderSnapshotView, UsageDaySummary, UsageOverviewView, UsageProviderSummary, UsageTokenTotals, UsageWindowSummary } from '../core/types.ts'

/** The settings fields this section edits (immediate-apply semantics). */
export interface UsageSettings {
  enabled?: boolean
  pollIntervalSec?: number
  bubbleMode?: string
  cpamcEnabled?: boolean
  cpamcBaseURL?: string
  cpamcManagementKeyEnv?: string
  volcanoEnabled?: boolean
  volcanoAccessKeyEnv?: string
  volcanoSecretKeyEnv?: string
  customBalanceEnabled?: boolean
  customBalanceLabel?: string
  customBalanceCurrency?: string
  customBalanceUrl?: string
  customBalanceMethod?: string
  customBalanceHeadersJson?: string
  customBalanceExtractRemaining?: string
  customBalanceAllowedHosts?: string
}

/** The registration-side face the section's slot entry injects. */
export interface UsageSectionFace {
  /** The section-local store (overview snapshot + lifecycle). */
  store: UsageStoreInstance
  /** Fetch one overview now. */
  poll: () => void
  /** Force a host probe cycle now (resolves with the fresh overview). */
  refresh: () => void
  /** Whether a forced refresh is in flight (component-local state mirrors it). */
  settings: SettingsScope<UsageSettings>
  /** Write one external secret into the host credential store (write-only). */
  setCredential: (target: ExternalCredentialTarget, value: string) => Promise<void>
  /** Remove one external secret from the host credential store. */
  clearCredential: (target: ExternalCredentialTarget) => Promise<void>
}

export interface UsageSectionProps extends UsageSectionFace {
  /** Close the settings panel (the shell owns the open state). */
  close: () => void
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
}): ReactNode {
  const { totals, rangeTotals, allTotals } = props
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

function BalanceCard(props: { providers: ProviderSnapshotView[]; current?: string }): ReactNode {
  const rows = balanceCardRows(props.providers)
  return (
    <div className={styles.card} data-dsh-part="balance-card">
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{t('usage.balance')}</span>
      </div>
      {rows.length === 0
        ? <span className={styles.muted}>{t('usage.balance.empty')}</span>
        : rows.map((provider) => {
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

function PlanPreview(props: {
  providers: ProviderSnapshotView[]
  currentId?: string
  onSeeAll: () => void
}): ReactNode {
  const { providers, currentId, onSeeAll } = props
  if (providers.length === 0) return null
  const ranked = [...providers].sort((left, right) => {
    if (left.provider === currentId) return -1
    if (right.provider === currentId) return 1
    return left.displayName.localeCompare(right.displayName)
  }).slice(0, 3)
  return (
    <div className={styles.card} data-dsh-part="plan-preview">
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{t('usage.plan.preview')}</span>
        <button type="button" className={styles.linkBtn} onClick={onSeeAll}>{t('usage.plan.seeAll')}</button>
      </div>
      {ranked.map((provider) => (
        <div key={provider.provider} className={styles.planPreviewBlock}>
          <span className={styles.providerName}>
            {provider.displayName}
            {currentId === provider.provider && <span className={styles.currentBadge}>{t('usage.current')}</span>}
            <span className={styles.sourceChip}>{t(planSourceLabelKey(provider))}</span>
            {provider.plan?.planName !== undefined ? <span className={styles.mutedInline}> · {provider.plan.planName}</span> : null}
          </span>
          <div className={styles.planMiniGrid}>
            {orderedPlanWindows(provider.plan).slice(0, 3).map((window) => {
              const percent = window.percent as number
              const label = window.key === '5h' || window.key === 'week' || window.key === 'month'
                ? t(`usage.plan.windows.${window.key}.short`)
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
                </div>
              )
            })}
          </div>
        </div>
      ))}
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
  const { store, poll, refresh, settings, setCredential, clearCredential } = props
  const ui = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const settingsSnapshot = settings.getSnapshot()
  const settingsValue = settingsSnapshot.value ?? {}
  const [tab, setTab] = useState<'usage' | 'plans' | 'bank' | 'settings'>('usage')
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
  const previewPlans = planProviders.filter((provider) => provider.plan !== undefined && orderedPlanWindows(provider.plan).length > 0)

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
        <button type="button" role="tab" aria-selected={tab === 'bank'} className={tab === 'bank' ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab('bank')}>
          {t('usage.tab.bank')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'settings'} className={tab === 'settings' ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => setTab('settings')}>
          {t('usage.tab.settings')}
        </button>
      </div>

      {tab === 'usage' && (
        <>
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
                />}
            <ProviderBreakdown
              rows={snapshot.usage.today.providers}
              providers={snapshot.providers}
              current={current.provider}
            />
            {snapshot.providers.some((provider) => isConfigured(provider) && provider.error !== undefined) && (
              <span className={styles.errorLine}>
                {snapshot.providers.filter((provider) => isConfigured(provider) && provider.error !== undefined).map((provider) => `${provider.displayName}: ${t('usage.provider.error', { error: provider.error ?? '' })}`).join(t('usage.errorListSeparator'))}
              </span>
            )}
          </div>

          <BalanceCard providers={snapshot.providers} current={current.provider} />

          <PlanPreview
            providers={previewPlans}
            currentId={matchedPlan?.provider}
            onSeeAll={() => setTab('plans')}
          />

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

      {tab === 'bank' && <VoucherCard window={snapshot.usage.all ?? snapshot.usage.range} observedSpend={snapshot.usage.observedSpend} />}

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
  const days = [...props.days].slice(-14).reverse()
  return (
    <div className={styles.card} data-dsh-part="history-card">
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{t('usage.history')}</span>
      </div>
      {days.length === 0
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
        ))}
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

/**
 * The Token 银行 card: the DeepSeek official family's retained-ledger usage
 * minted onto the whale-yuan note at 1000 tokens per whale yuan. The window
 * prefers the host's whole-ledger aggregate and falls back to the 30-day
 * trend when an older host serves no `all`; the spend line prefers the
 * official balance watch and falls back to the fold-time estimate; the
 * artwork draw failure degrades to an error line and never takes the
 * section down.
 */
function VoucherCard(props: { window?: UsageWindowSummary; observedSpend?: ObservedSpendView }): ReactNode {
  const { window: ledger, observedSpend } = props
  const data = deepseekVoucherData(ledger)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [drawError, setDrawError] = useState<string | undefined>(undefined)
  const dataKey = data === undefined ? '' : `${data.from}|${data.to}|${data.tokens}|${data.calls}|${data.cost}`

  useEffect(() => {
    if (data === undefined) return
    const voucher = data
    let cancelled = false
    loadVoucherArt().then((art) => {
      if (cancelled) return
      const canvas = canvasRef.current
      if (canvas !== null) {
        try {
          drawVoucher(canvas, art, voucher)
        } catch (error) {
          if (!cancelled) setDrawError(error instanceof Error ? error.message : String(error))
        }
      }
    }, (error) => {
      if (!cancelled) setDrawError(error instanceof Error ? error.message : String(error))
    })
    return () => {
      cancelled = true
    }
  // dataKey covers every field the draw and the buttons read.
  }, [dataKey])

  const onSave = (): void => {
    const canvas = canvasRef.current
    if (canvas === null || data === undefined) return
    canvas.toBlob((blob) => {
      if (blob === null) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `dsh-whale-voucher-${data.to}.png`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }, 'image/png')
  }

  const shareSupported = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
  const onShare = (): void => {
    const canvas = canvasRef.current
    if (canvas === null || data === undefined || !shareSupported) return
    canvas.toBlob(async (blob) => {
      if (blob === null) return
      const file = new File([blob], `dsh-whale-voucher-${data.to}.png`, { type: 'image/png' })
      if (!navigator.canShare({ files: [file] })) return
      try {
        await navigator.share({ files: [file], title: t('usage.bank.title') })
      } catch {
        // A user-cancelled share sheet rejects; nothing to report.
      }
    }, 'image/png')
  }

  return (
    <div className={styles.card} data-dsh-part="bank-card">
      <span className={styles.cardTitle}>{t('usage.bank.title')}</span>
      {data === undefined
        ? <span className={styles.muted}>{t('usage.bank.noUsage')}</span>
        : <>
            <span className={styles.muted}>{t('usage.bank.hint')}</span>
            <div className={styles.voucherPreview} data-dsh-part="voucher-preview">
              <canvas ref={canvasRef} aria-label={t('usage.bank.title')} />
            </div>
            {drawError !== undefined && <span className={styles.errorLine}>{t('usage.bank.drawError', { error: drawError })}</span>}
            <div className={styles.providerRow}>
              <span className={styles.providerName}>{t('usage.bank.minted', { minted: formatDenomination(faceValue(data.tokens)), tokens: formatTokens(data.tokens) })}</span>
              <span className={styles.providerTokens}>{t('usage.calls', { n: data.calls })}</span>
            </div>
            <span className={styles.muted}>
              {observedSpend !== undefined
                ? t('usage.bank.spend.observed', { cost: observedSpend.cny.toFixed(2), since: formatDay(observedSpend.since) })
                : t('usage.bank.spend.estimated', { cost: data.cost.toFixed(2) })}
            </span>
            <span className={styles.muted}>{t('usage.bank.window', { from: data.from, to: data.to })}</span>
            <div className={styles.buttonRow}>
              <button type="button" className={styles.refreshBtn} onClick={onSave}>{t('usage.bank.save')}</button>
              {shareSupported && <button type="button" className={styles.refreshBtn} onClick={onShare}>{t('usage.bank.share')}</button>}
            </div>
          </>}
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
      {provider.error !== undefined && <span className={styles.errorLine}>{t('usage.provider.error', { error: provider.error })}</span>}
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
                <span className={styles.resetLine}>
                  {window.resetsAt !== undefined
                    ? t('usage.plan.reset', { date: new Date(window.resetsAt).toLocaleString() })
                    : '—'}
                </span>
              </div>
            )
          })}
    </div>
  )
}

function SettingsRow(props: {
  settings: UsageSectionProps['settings']
  snapshot?: { writable: boolean }
  value: UsageSettings
  providers?: ProviderSnapshotView[]
  credentials?: ExternalCredentialStatus
  setCredential: UsageSectionProps['setCredential']
  clearCredential: UsageSectionProps['clearCredential']
}): ReactNode {
  const { settings, snapshot, value, providers = [], credentials, setCredential, clearCredential } = props
  const disabled = snapshot !== undefined && !snapshot.writable
  const bubbleMode = typeof value.bubbleMode === 'string' && ['always', 'change', 'off'].includes(value.bubbleMode) ? value.bubbleMode : 'always'
  const cpamc = providers.find((provider) => provider.source === 'cpamc')
  const volcano = providers.find((provider) => provider.source === 'volcano')
  const cpamcOn = value.cpamcEnabled ?? false
  const volcanoOn = value.volcanoEnabled ?? false
  const customOn = value.customBalanceEnabled ?? false
  const custom = providers.find((provider) => provider.source === 'custom')
  const headerVars = customBalanceCredentialVars(value.customBalanceHeadersJson ?? '')
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
            checked={value.enabled ?? true}
            disabled={disabled}
            onChange={(event) => { void settings.set('enabled', event.target.checked) }}
          />
        </label>
        <label className={styles.settingRow}>
          <span>{t('usage.config.pollIntervalSec')}</span>
          <input
            type="number"
            min={30}
            max={3600}
            value={typeof value.pollIntervalSec === 'number' ? value.pollIntervalSec : 60}
            disabled={disabled}
            onChange={(event) => {
              const parsed = Number(event.target.value)
              if (Number.isFinite(parsed) && parsed >= 30 && parsed <= 3600) void settings.set('pollIntervalSec', Math.round(parsed))
            }}
          />
        </label>
      </div>

      <div className={styles.settingsSection}>
        <span className={styles.subTitle}>{t('usage.config.display')}</span>
        <label className={styles.settingRow}>
          <span>{t('usage.config.bubbleMode')}</span>
          <select
            value={bubbleMode}
            disabled={disabled}
            onChange={(event) => { void settings.set('bubbleMode', event.target.value) }}
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
          <input type="checkbox" checked={cpamcOn} disabled={disabled} onChange={(event) => { void settings.set('cpamcEnabled', event.target.checked) }} />
        </label>
        <label className={styles.settingRow}>
          <span>{t('usage.config.cpamcUrl')}</span>
          <input type="text" value={value.cpamcBaseURL ?? 'http://127.0.0.1:8317'} disabled={disabled || !cpamcOn} onChange={(event) => { void settings.set('cpamcBaseURL', event.target.value) }} />
        </label>
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
              ? ` · ${cpamc.error}`
              : `${balanceText(cpamc) !== null ? ` · ${balanceText(cpamc)}` : ''}${
                cpamc.plan?.windows?.[0]?.percent !== undefined
                  ? ` · ${t('usage.plan.windows.5h.short')} ${Math.round(cpamc.plan.windows[0].percent as number)}%`
                  : ''
              }`}
          </span>
        )}
        <label className={styles.settingRow}>
          <span>{t('usage.config.volcano')}</span>
          <input type="checkbox" checked={volcanoOn} disabled={disabled} onChange={(event) => { void settings.set('volcanoEnabled', event.target.checked) }} />
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

      <div className={styles.settingsSection}>
        <span className={styles.subTitle}>{t('usage.config.customBalance')}</span>
        <label className={styles.settingRow}>
          <span>{t('usage.config.customBalance.enabled')}</span>
          <input type="checkbox" checked={customOn} disabled={disabled} onChange={(event) => { void settings.set('customBalanceEnabled', event.target.checked) }} />
        </label>
        <label className={styles.settingRow}>
          <span>{t('usage.config.customBalance.label')}</span>
          <input type="text" value={value.customBalanceLabel ?? 'Custom balance'} disabled={disabled || !customOn} onChange={(event) => { void settings.set('customBalanceLabel', event.target.value) }} />
        </label>
        <label className={styles.settingRow}>
          <span>{t('usage.config.customBalance.currency')}</span>
          <input type="text" value={value.customBalanceCurrency ?? 'USD'} disabled={disabled || !customOn} onChange={(event) => { void settings.set('customBalanceCurrency', event.target.value) }} />
        </label>
        <label className={styles.settingRow}>
          <span>{t('usage.config.customBalance.url')}</span>
          <input type="text" value={value.customBalanceUrl ?? ''} disabled={disabled || !customOn} placeholder="https://…" onChange={(event) => { void settings.set('customBalanceUrl', event.target.value) }} />
        </label>
        <label className={styles.settingRow}>
          <span>{t('usage.config.customBalance.method')}</span>
          <select value={(value.customBalanceMethod ?? 'GET').toUpperCase()} disabled={disabled || !customOn} onChange={(event) => { void settings.set('customBalanceMethod', event.target.value) }}>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </label>
        <label className={styles.settingRow}>
          <span>{t('usage.config.customBalance.headers')}</span>
          <textarea
            rows={3}
            value={value.customBalanceHeadersJson ?? '{"Authorization":"Bearer {{API_KEY}}"}'}
            disabled={disabled || !customOn}
            onChange={(event) => { void settings.set('customBalanceHeadersJson', event.target.value) }}
          />
        </label>
        <label className={styles.settingRow}>
          <span>{t('usage.config.customBalance.extract')}</span>
          <input type="text" value={value.customBalanceExtractRemaining ?? 'data.total_available'} disabled={disabled || !customOn} onChange={(event) => { void settings.set('customBalanceExtractRemaining', event.target.value) }} />
        </label>
        <label className={styles.settingRow}>
          <span>{t('usage.config.customBalance.allowedHosts')}</span>
          <input type="text" value={value.customBalanceAllowedHosts ?? ''} disabled={disabled || !customOn} placeholder="api.example.com" onChange={(event) => { void settings.set('customBalanceAllowedHosts', event.target.value) }} />
        </label>
        {headerVars.map((name) => (
          <SecretField
            key={name}
            label={t('usage.config.customBalance.var', { name })}
            configured={credentials?.customVars?.[name] === true}
            disabled={disabled || !customOn}
            onSave={(secret) => setCredential(`customVar:${name}`, secret)}
            onClear={() => clearCredential(`customVar:${name}`)}
          />
        ))}
        {custom !== undefined && (
          <span className={styles.settingHint}>
            {custom.displayName}
            {custom.error !== undefined
              ? ` · ${custom.error}`
              : balanceText(custom) !== null ? ` · ${balanceText(custom)}` : ''}
          </span>
        )}
        <span className={styles.muted}>{t('usage.config.customBalance.hint')}</span>
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
