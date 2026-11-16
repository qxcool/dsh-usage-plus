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
import type { UsageOverviewView } from '../../src/core/types.ts'
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

/**
 * Minimal stand-in for `EngineStoreInstance`: `useSyncExternalStore` only
 * needs a stable `subscribe`/`getSnapshot` pair. No action is ever triggered
 * because the harness never polls.
 */
function createFakeStore(view: UsageOverviewView) {
  const state = { snapshot: view, status: 'ready' as const, error: null }
  return {
    subscribe: () => noop,
    getSnapshot: () => state,
    actions: {},
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
const store = createFakeStore(fixture)
const settings = createFakeSettings()
const face = {
  store,
  poll: noop,
  refresh: noop,
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
