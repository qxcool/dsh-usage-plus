/**
 * Local visual preview harness entry.
 *
 * Renders the REAL client components (`UsageSectionCard`, `PlanUsageStrip`)
 * against a synthetic overview so design work does not need the authenticated
 * DSH Web GUI (its per-process launch token blocks direct browser access).
 *
 * URL parameters (all optional):
 *   part=section|strip        which surface to mount (default: section)
 *   w=<px>                    container width, default 1280
 *   theme=dark|light          colour scheme to emulate, default dark
 *   lang=zh|en                document language for the `t()` helper, default zh
 *   tab=usage|plans|settings  section tab to activate, default usage
 *   range=7|30|90|182         overview window to select, default 30
 *   retain=<days>             simulated ledger retention (forces the covered-range note)
 *   variant=rich|sparse       fixture shape, default rich
 *   updated=fresh|stale       document age for the header freshness dot
 *                             (fresh = 8 s, stale = 10 min), default fresh
 *   open=1                    strip: open the quota popover on load
 */
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { UsageSectionCard } from '../../src/client/UsageSectionCard.tsx'
import { PlanUsageStrip } from '../../src/client/PlanUsageStrip.tsx'
import { buildOverview } from './fixture.ts'
import { DEFAULT_USAGE_RANGE_DAYS, isUsageRangeDays, type UsageRangeDays } from '../../src/client/usage-api.ts'
import { addTotals, emptyTotals, type UsageOverviewView, type UsageProviderSummary, type UsageTokenTotals } from '../../src/core/types.ts'
import './theme.css'

/**
 * Local noon of the current day: the ledger dates read as "now", while the
 * seeded series stays stable for every run made on the same day.
 */
const FIXED_NOW = (() => {
  const at = new Date()
  at.setHours(12, 0, 0, 0)
  return at.getTime()
})()

const params = new URLSearchParams(window.location.search)
const part = params.get('part') === 'strip' ? 'strip' : 'section'
const width = Number(params.get('w') ?? 1280)
const theme = params.get('theme') === 'light' ? 'light' : 'dark'
const lang = params.get('lang') === 'en' ? 'en' : 'zh'
const tab = params.get('tab') ?? 'usage'
const rangeParam = Number(params.get('range') ?? DEFAULT_USAGE_RANGE_DAYS)
const initialRange: UsageRangeDays = isUsageRangeDays(rangeParam) ? rangeParam : DEFAULT_USAGE_RANGE_DAYS
/** Optional simulated ledger retention, so the "covered range" note can be previewed. */
const retainParam = Number(params.get('retain') ?? 0)
const retainDays = Number.isFinite(retainParam) && retainParam > 0 ? Math.floor(retainParam) : undefined
const variant = params.get('variant') === 'sparse' ? 'sparse' : 'rich'
/** `updatedAt` is wall-clock (freshness dot); everything else hangs off FIXED_NOW. */
const updatedAgoMs = params.get('updated') === 'stale' ? 10 * 60_000 : 8_000
const openOnLoad = params.get('open') === '1'

document.documentElement.lang = lang
document.documentElement.dataset.theme = theme

/**
 * The strip beacons its diagnostic state to a DSH host route that does not
 * exist under Vite, which would log a 404 on every capture. Answer those
 * beacons locally so the console only shows real problems.
 */
const realFetch = window.fetch.bind(window)
window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/api/dsh-usage-plus/')) {
    return Promise.resolve(new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
  }
  return realFetch(input as RequestInfo, init)
}) as typeof window.fetch

function noop(): void {}

function totalOf(totals: UsageTokenTotals): number {
  return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens
}

/** Scale one totals bucket; keeps provider shares identical across windows. */
function scaleTotals(totals: UsageTokenTotals, factor: number): UsageTokenTotals {
  return {
    inputTokens: Math.round(totals.inputTokens * factor),
    outputTokens: Math.round(totals.outputTokens * factor),
    cacheReadTokens: Math.round(totals.cacheReadTokens * factor),
    cacheWriteTokens: Math.round(totals.cacheWriteTokens * factor),
    reasoningTokens: Math.round(totals.reasoningTokens * factor),
    calls: Math.round(totals.calls * factor),
    cost: totals.cost * factor,
  }
}

function scaleProvider(row: UsageProviderSummary, factor: number): UsageProviderSummary {
  return {
    ...row,
    totals: scaleTotals(row.totals, factor),
    models: row.models.map((model) => ({ ...model, totals: scaleTotals(model.totals, factor) })),
  }
}

/**
 * Aggregate the fixture's deterministic daily rows into the selected window,
 * and scale the fixture's provider/model split to that window's total. The
 * fixture's day rows only carry totals, so the split is the base 30-day split
 * (shares stay identical across windows); harness-only, never sent anywhere.
 */
function windowFor(view: UsageOverviewView, days: UsageRangeDays, retain = retainDays): UsageOverviewView {
  const covered = retain === undefined ? days : Math.min(days, retain)
  const rows = view.usage.days.slice(-covered)
  const totals = emptyTotals()
  for (const row of rows) addTotals(totals, row.totals)
  const base = view.usage.range
  const baseTotal = base === undefined ? 0 : totalOf(base.totals)
  const factor = baseTotal > 0 ? totalOf(totals) / baseTotal : 0
  const providers = (base?.providers ?? []).map((row) => scaleProvider(row, factor))
  const from = rows[0]?.date ?? view.usage.today.date
  const to = base?.to ?? view.usage.today.date
  return {
    ...view,
    usage: {
      ...view.usage,
      range: { from, to, totals, providers },
    },
  }
}

/**
 * Fake `EngineStoreInstance` backed by one mutable snapshot: `useSyncExternalStore`
 * gets a stable subscribe/getSnapshot pair, and `setRangeDays` (wired into the
 * face below) re-derives the window so the picker is interactive in the harness.
 */
function createFakeStore(view: UsageOverviewView) {
  let state = { snapshot: view, status: 'ready' as const, error: null, rangeDays: initialRange }
  const listeners = new Set<() => void>()
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => state,
    actions: {},
    setRangeDays(days: UsageRangeDays) {
      state = { ...state, rangeDays: days, snapshot: windowFor(view, days) }
      listeners.forEach((listener) => listener())
    },
  }
}

/** Stand-in for the Plugins-page `configForms` handle. */
function createFakeSettings() {
  const snapshot = {
    status: 'ready',
    value: {
      enabled: true,
      pollIntervalSec: 60,
      bubbleMode: 'always',
      cpamcEnabled: true,
      cpamcBaseURL: 'http://127.0.0.1:8317',
      cpamcManagementKeyEnv: 'CPAMC_TOKEN',
      cpamcAllowedHosts: 'localhost',
      volcanoEnabled: false,
    },
    writable: true,
    revision: 3,
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => noop,
    set: async () => true,
    mutate: async () => true,
  }
}

const fixture = buildOverview({ now: FIXED_NOW, variant, updatedAgoMs })
const store = createFakeStore(windowFor(fixture, initialRange))
const settings = createFakeSettings()
const face = {
  store,
  poll: noop,
  refresh: noop,
  setRangeDays: (days: UsageRangeDays) => store.setRangeDays(days),
  settings,
  setCredential: async () => {},
  clearCredential: async () => {},
  startStripPolling: () => noop,
}

function selectTab(name: string): void {
  const order = ['usage', 'plans', 'settings']
  const index = order.indexOf(name)
  if (index < 0) return
  const buttons = document.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  buttons[index]?.click()
}

function SectionPreview() {
  useEffect(() => {
    selectTab(tab)
    document.documentElement.dataset.previewReady = '1'
  }, [])
  return (
    <div className="preview-frame" data-shot="section" style={{ width: `${width}px` }}>
      <UsageSectionCard {...face} view="page" />
    </div>
  )
}

function StripPreview() {
  useEffect(() => {
    if (openOnLoad) {
      window.setTimeout(() => {
        document.querySelector<HTMLButtonElement>('[data-dsh-part="quota-meter"] button')?.click()
      }, 120)
    }
    document.documentElement.dataset.previewReady = '1'
  }, [])
  return (
    <div
      className="strip-frame"
      data-shot="strip"
      style={{ width: 'fit-content', paddingTop: openOnLoad ? '300px' : '20px' }}
    >
      <div className="dock-row">
        <span className="dock-stat">⟳ 14 轮 384 步 · 97 tok/s</span>
        <span className="dock-stat">▤ 119M tok · 缓存命中 98%</span>
        <PlanUsageStrip store={store} />
        <span className="dock-stat">◔ 52%</span>
      </div>
    </div>
  )
}

const host = document.getElementById('root')
if (host === null) throw new Error('preview root missing')
createRoot(host).render(part === 'strip' ? <StripPreview /> : <SectionPreview />)
