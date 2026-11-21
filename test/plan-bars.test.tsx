// @vitest-environment jsdom
/**
 * Locks the plan-quota bar geometry on the Plugins-page 套餐额度 tab, and the
 * v0.4.0 overview window picker + export downloads that share the section.
 *
 * `styles.barFill` owns the fill's non-colour geometry (height, radius,
 * transition) while `barWarn` / `barLow` only supply the colour. Rendering a
 * high-usage window with the colour class alone collapses the inner span to
 * zero height, so a 91% bar looks blank while a 19% bar looks fine.
 * @module test/plan-bars
 */
import { act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { UsageSectionCard, type UsageSectionFace } from '../src/client/UsageSectionCard.tsx'
import { apply } from '../src/client/index.ts'
import { emptyTotals, type ProviderSnapshotView, type UsageAlert, type UsageCostEstimate, type UsageDayDetail, type UsageHealth, type UsageOverviewView, type UsagePlatformView, type UsageTokenTotals } from '../src/core/types.ts'
import { createUsageStore } from '../src/client/usage-store.ts'
import { exportRequestPath, overviewRequestPath, type UsageRangeDays } from '../src/client/usage-api.ts'
import styles from '../src/client/usage.module.css'

// The real store engine pulls the browser-only client-store runtime (and its
// zustand transport), which this standalone SDK project does not install. The
// store module only needs `defineStore`'s contract for the action test below.
vi.mock('@deepseek-ai/dsh-client-store', () => ({
  defineStore: (spec: {
    init: () => Record<string, unknown>
    actions: Record<string, (draft: Record<string, unknown>, ...args: unknown[]) => void>
  }) => ({
    create: () => {
      const listeners = new Set<() => void>()
      const state = spec.init()
      const actions: Record<string, (...args: unknown[]) => void> = {}
      for (const [name, action] of Object.entries(spec.actions)) {
        actions[name] = (...args: unknown[]) => {
          action(state, ...args)
          listeners.forEach((listener) => listener())
        }
      }
      return {
        getSnapshot: () => state,
        subscribe: (listener: () => void) => {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        actions,
      }
    },
  }),
}))

// The component resolves its copy from document.documentElement.lang at call
// time; pin the Chinese dictionary for the assertions below (non-zh falls back
// to English by design).
document.documentElement.lang = 'zh'

function provider(partial: Partial<ProviderSnapshotView>): ProviderSnapshotView {
  return { provider: 'x', displayName: 'X', credential: 'env', supported: true, ...partial }
}

function overview(): UsageOverviewView {
  return {
    updatedAt: 1,
    current: { provider: 'opencode-go', model: 'glm-5.3-flash', source: 'live' },
    providers: [
      provider({
        provider: 'opencode-go',
        displayName: 'opencode-go (completions)',
        planSupported: true,
        plan: {
          updatedAt: 1,
          windows: [{ key: '5h', percent: 20 }, { key: 'week', percent: 19 }, { key: 'month', percent: 91 }],
        },
      }),
    ],
    usage: {
      today: { date: '2026-09-26', totals: emptyTotals(), providers: [] },
      days: [],
      range: { from: '2026-08-28', to: '2026-09-26', totals: emptyTotals(), providers: [] },
    },
  }
}

function face(
  snapshot: UsageOverviewView,
  options: {
    rangeDays?: UsageRangeDays
    onRange?: (days: UsageRangeDays) => void
    onMutate?: (ops: ReadonlyArray<{ op: string; path: readonly string[]; value?: unknown }>) => void
    /** Host-resolved config fields; a legacy set proves the old-Host path. */
    settingsValue?: Record<string, unknown>
  } = {},
): Record<string, unknown> {
  const state = {
    snapshot,
    status: 'ready' as const,
    error: null,
    rangeDays: options.rangeDays ?? 30,
  }
  return {
    view: 'page',
    store: { subscribe: () => () => {}, getSnapshot: () => state },
    poll: () => {},
    refresh: () => {},
    setRangeDays: (days: UsageRangeDays) => options.onRange?.(days),
    startStripPolling: () => () => {},
    setCredential: async () => {},
    clearCredential: async () => {},
    settings: {
      getSnapshot: () => ({ status: 'ready', value: options.settingsValue ?? {}, writable: true, revision: 0 }),
      subscribe: () => () => {},
      set: async () => true,
      mutate: async (ops: ReadonlyArray<{ op: string; path: readonly string[]; value?: unknown }>) => {
        options.onMutate?.(ops)
        return true
      },
    },
  }
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
}

function mount(snapshot: UsageOverviewView, options?: Parameters<typeof face>[1]): { host: HTMLDivElement; root: Root } {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => {
    root.render(createElement(UsageSectionCard, face(snapshot, options) as never))
  })
  return { host, root }
}

describe('plans tab quota bars', () => {
  let root: Root | undefined
  afterEach(() => {
    cleanup()
    root?.unmount()
    root = undefined
  })

  it('keeps the fill geometry on a high-usage window (91% shows a coloured bar)', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    act(() => {
      root?.render(createElement(UsageSectionCard, face(overview()) as never))
    })
    await flush()

    const tab = [...host.querySelectorAll('button')].find((button) => button.textContent === '套餐额度')
    expect(tab).toBeDefined()
    act(() => {
      tab?.click()
    })

    const high = host.querySelector('[data-dsh-part="plan-window"] [style*="width: 91%"]')
    expect(high).not.toBeNull()
    // Geometry must ride the fill base class; the colour class alone is height-less.
    expect(high?.classList.contains(styles.barFill)).toBe(true)
    expect(high?.classList.contains(styles.barLow)).toBe(true)

    const low = host.querySelector('[data-dsh-part="plan-window"] [style*="width: 19%"]')
    expect(low?.classList.contains(styles.barFill)).toBe(true)
    expect(low?.classList.contains(styles.barLow)).toBe(false)
  })
})

/** Minimal client `Context` for driving `apply` without the DSH client runtime. */
function fakeClientContext(captured: { face?: UsageSectionFace }): never {
  const form = {
    getSnapshot: () => ({ status: 'ready', value: {}, writable: true, revision: 0 }),
    subscribe: () => () => {},
    set: async () => true,
    mutate: async () => true,
  }
  const context = {
    effect: (run: () => (() => void) | void) => {
      run()
      return () => {}
    },
    locale: { register: () => () => {} },
    configForms: {
      get: () => form,
      whileServed: (_namespaces: readonly string[], register: (served: ReadonlySet<string>) => () => void) =>
        register(new Set(['usage-plus'])),
    },
    slots: {
      inject: (_name: string, run: () => (() => void) | void) => {
        run()
        return () => {}
      },
      register: (options: { name: string; inject?: () => unknown }) => {
        if (options.name === 'plugins.bundle.config' && typeof options.inject === 'function') {
          captured.face = options.inject() as UsageSectionFace
        }
        return () => {}
      },
    },
  }
  return context as never
}

describe('overview window and export', () => {  let root: Root | undefined
  afterEach(() => {
    cleanup()
    root?.unmount()
    root = undefined
    vi.unstubAllGlobals()
  })

  it('defaults the store to 30 days and updates through the action', () => {
    const store = createUsageStore().create()
    expect(store.getSnapshot().rangeDays).toBe(30)
    store.actions.setRangeDays(182)
    expect(store.getSnapshot().rangeDays).toBe(182)
  })

  it('builds the overview and export URLs for one selected window', () => {
    expect(overviewRequestPath(7)).toBe('/api/dsh-usage-plus/overview?days=7')
    expect(overviewRequestPath(182)).toBe('/api/dsh-usage-plus/overview?days=182')
    expect(exportRequestPath('csv', 90)).toBe('/api/dsh-usage-plus/export?format=csv&days=90')
    expect(exportRequestPath('json', 30)).toBe('/api/dsh-usage-plus/export?format=json&days=30')
  })

  it('labels hero + trend with the selected window and dispatches a switch', async () => {
    const calls: UsageRangeDays[] = []
    const { host, root: mounted } = mount(overview(), { rangeDays: 30, onRange: (days) => calls.push(days) })
    root = mounted
    await flush()

    // Hero stat + trend card carry the dynamic window instead of a fixed 30.
    expect(host.textContent).toContain('近 30 天')
    const rangeBar = host.querySelector('[data-dsh-part="range-bar"]')
    expect(rangeBar).not.toBeNull()
    const pressed = rangeBar?.querySelector('[aria-pressed="true"]')
    expect(pressed?.textContent).toBe('30 天')

    const switchButton = [...(rangeBar?.querySelectorAll('button') ?? [])].find((button) => button.textContent === '90 天')
    expect(switchButton).toBeDefined()
    act(() => {
      switchButton?.click()
    })
    expect(calls).toEqual([90])
  })

  it('shows the real covered range when retention is shorter than the selection', async () => {
    const snapshot = overview()
    // 26 covered days cannot satisfy the 90-day selection.
    snapshot.usage.range = { from: '2026-09-01', to: '2026-09-26', totals: emptyTotals(), providers: [] }
    const { host, root: mounted } = mount(snapshot, { rangeDays: 90 })
    root = mounted
    await flush()

    expect(host.textContent).toContain('近 90 天')
    const covered = host.querySelector('[data-dsh-part="range-covered"]')
    expect(covered?.textContent).toBe('实际覆盖 09-01 至 09-26')
  })

  it('downloads CSV through the export route with the selected window', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(['date,tokens'], { type: 'text/csv' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createURL = vi.fn(() => 'blob:usage-export')
    const revokeURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeURL })

    const { host, root: mounted } = mount(overview(), { rangeDays: 7 })
    root = mounted
    await flush()

    const settingsTab = [...host.querySelectorAll('button')].find((button) => button.textContent === '设置')
    expect(settingsTab).toBeDefined()
    act(() => {
      settingsTab?.click()
    })

    const exportButton = [...host.querySelectorAll<HTMLButtonElement>('[data-dsh-part="export-card"] button')]
      .find((button) => button.textContent === '导出 CSV')
    expect(exportButton).toBeDefined()
    await act(async () => {
      exportButton?.click()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/dsh-usage-plus/export?format=csv&days=7')
    expect(createURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    // The object URL is revoked on the next task, never leaked.
    await flush()
    expect(revokeURL).toHaveBeenCalledWith('blob:usage-export')
    clickSpy.mockRestore()
  })

  it('polls with the selected window and resets the ETag when the range changes', async () => {
    const jsonResponse = (etag: string) => ({
      ok: true,
      status: 200,
      headers: new Headers({ etag }),
      json: async () => overview(),
    })
    // The client's diagnostic beacon also uses fetch; answer it quietly.
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>>(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ ok: true }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const captured: { face?: UsageSectionFace } = {}
    apply(fakeClientContext(captured))
    await flush()
    expect(captured.face).toBeDefined()

    const overviewCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/overview'))
    const overviewInit = (index: number): RequestInit | undefined => overviewCalls()[index]?.[1]

    fetchMock.mockImplementationOnce(async () => jsonResponse('"etag-30"'))
    captured.face?.poll()
    await flush()
    expect(overviewCalls().map(([url]) => String(url))).toEqual(['/api/dsh-usage-plus/overview?days=30'])
    expect(overviewInit(0)?.headers).toBeUndefined()

    // Switching windows forces an immediate read for the new variant without a
    // stale validator from the 30-day document.
    fetchMock.mockImplementationOnce(async () => jsonResponse('"etag-7"'))
    captured.face?.setRangeDays(7)
    await flush()
    expect(overviewCalls().map(([url]) => String(url))).toEqual([
      '/api/dsh-usage-plus/overview?days=30',
      '/api/dsh-usage-plus/overview?days=7',
    ])
    expect(overviewInit(1)?.headers).toBeUndefined()

    // Later polls revalidate against the new variant's ETag (the burst window
    // is 750 ms, so wait it out before asking for another poll).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800))
    })
    fetchMock.mockImplementationOnce(async () => ({ ok: true, status: 304, headers: new Headers(), json: async () => ({}) }))
    captured.face?.poll()
    await flush()
    expect(overviewCalls().map(([url]) => String(url))).toEqual([
      '/api/dsh-usage-plus/overview?days=30',
      '/api/dsh-usage-plus/overview?days=7',
      '/api/dsh-usage-plus/overview?days=7',
    ])
    expect(overviewInit(2)?.headers).toEqual({ 'if-none-match': '"etag-7"' })
  })
})

// ---------------------------------------------------------------------------
// v0.5.0: threshold alerts, alert settings, data health.
// ---------------------------------------------------------------------------

/** Set a controlled input the way React's onChange sees a real edit. */
function setInputValue(input: HTMLInputElement, value: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function pressTab(host: HTMLElement, label: string): void {
  const button = [...host.querySelectorAll('button')].find((candidate) => candidate.textContent === label)
  expect(button).toBeDefined()
  act(() => {
    button?.click()
  })
}

const ALERTS: UsageAlert[] = [
  { kind: 'daily-cost', severity: 'critical', value: 12.4, threshold: 10, since: 1, message: 'daily cost' },
  { kind: 'plan-threshold', severity: 'warning', provider: 'opencode-go', window: 'week', value: 78, threshold: 70, since: 2, message: 'plan threshold' },
  { kind: 'balance-low', severity: 'warning', provider: 'opencode-go', value: 23.17, threshold: 50, since: 3, message: 'balance low' },
]

function healthy(): UsageHealth {
  const now = Date.now()
  return {
    storage: {
      label: '~/.dsh/dsh-usage-plus',
      bytes: 2_411_724,
      activeDays: 42,
      firstDay: '2026-10-03',
      lastDay: '2026-11-16',
      retentionDays: 182,
      corruptFiles: ['usage.json.corrupt-1763000000'],
    },
    backfill: { completedAt: now - 3 * 60 * 60_000, cutoff: now - 180 * 86_400_000, sessions: 128, events: 8_412, truncated: true },
    probes: { lastAttemptAt: now - 20_000, lastSuccessAt: now - 25_000, failing: ['kimi-coding'] },
  }
}

function totals(partial: Partial<UsageTokenTotals>): UsageTokenTotals {
  return { ...emptyTotals(), ...partial }
}

function dayDetail(): UsageDayDetail {
  return {
    date: '2026-11-16',
    totals: totals({ inputTokens: 1_000_000, outputTokens: 200_000, cacheReadTokens: 30_000, calls: 42, cost: 1.23 }),
    providers: [
      {
        provider: 'opencode-go',
        totals: totals({ inputTokens: 1_000_000, outputTokens: 200_000, cacheReadTokens: 30_000, calls: 42, cost: 1.23 }),
        models: [{ model: 'glm-4.6', totals: totals({ inputTokens: 600_000, outputTokens: 120_000, cacheReadTokens: 30_000, calls: 21, cost: 0.61 }) }],
      },
    ],
  }
}

describe('v0.6.0 heatmap navigation, platform reconcile and USD estimate', () => {
  let root: Root | undefined
  afterEach(() => {
    cleanup()
    root?.unmount()
    root = undefined
    vi.unstubAllGlobals()
  })

  it('fetches the day route on cell click, opens the detail panel, switches metric and closes', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url)
      if (target.includes('/day?')) {
        return new Response(JSON.stringify(dayDetail()), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response('{}', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { host, root: mounted } = mount(overview())
    root = mounted
    await flush()

    const grid = host.querySelector('[data-dsh-part="heatmap-grid"]')
    expect(grid?.getAttribute('role')).toBe('grid')
    const cells = [...host.querySelectorAll<HTMLButtonElement>('[data-dsh-part="heatmap-cell"]:not([data-future])')]
    expect(cells.length).toBeGreaterThan(7)
    expect(cells[0]?.getAttribute('role')).toBe('gridcell')
    expect(cells[0]?.getAttribute('aria-label')).toContain('次调用')
    // Future cells are disabled and labelled as such.
    for (const future of host.querySelectorAll<HTMLButtonElement>('[data-future="yes"]')) {
      expect(future.disabled).toBe(true)
      expect(future.getAttribute('aria-label')).toContain('未来日期')
    }

    act(() => {
      cells[0]?.click()
    })
    await flush()
    const dayUrl = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.includes('/day?'))
    expect(dayUrl).toContain('/api/dsh-usage-plus/day?date=')
    const panel = host.querySelector('[data-dsh-part="day-detail"]')
    expect(panel).not.toBeNull()
    expect(panel?.getAttribute('data-day-state')).toBe('ready')
    expect(panel?.textContent).toContain('opencode-go (completions)')
    expect(panel?.textContent).toContain('glm-4.6')
    expect(panel?.getAttribute('data-day-date')).toBe(cells[0]?.getAttribute('data-date'))

    const metric = panel?.querySelector('[data-dsh-part="day-metric"]')
    expect(metric?.textContent).toBe('1.2M')
    const callsToggle = [...host.querySelectorAll<HTMLButtonElement>('[data-dsh-part="heatmap-card"] button')]
      .find((button) => button.textContent === '调用')
    expect(callsToggle?.getAttribute('aria-pressed')).toBe('false')
    act(() => {
      callsToggle?.click()
    })
    await flush()
    expect(callsToggle?.getAttribute('aria-pressed')).toBe('true')
    expect(panel?.querySelector('[data-dsh-part="day-metric"]')?.textContent).toBe('42')

    const close = [...host.querySelectorAll<HTMLButtonElement>('[data-dsh-part="day-detail"] button')]
      .find((button) => button.textContent === '关闭')
    act(() => {
      close?.click()
    })
    await flush()
    expect(host.querySelector('[data-dsh-part="day-detail"]')).toBeNull()
  })

  it('shows loading/error and empty states for the day drill-down', async () => {
    let attempts = 0
    const fetchMock = vi.fn(async () => {
      attempts += 1
      if (attempts === 1) return new Response('{}', { status: 500 })
      return new Response(JSON.stringify({ ...dayDetail(), totals: emptyTotals(), providers: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { host, root: mounted } = mount(overview())
    root = mounted
    await flush()
    const cell = host.querySelector<HTMLButtonElement>('[data-dsh-part="heatmap-cell"]:not([data-future])')
    act(() => {
      cell?.click()
    })
    await flush()
    const panel = host.querySelector('[data-dsh-part="day-detail"]')
    expect(panel?.getAttribute('data-day-state')).toBe('error')
    expect(panel?.textContent).toContain('当日明细读取失败')

    const retry = [...(panel?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((button) => button.textContent === '重试')
    act(() => {
      retry?.click()
    })
    await flush()
    expect(host.querySelector('[data-dsh-part="day-detail"]')?.getAttribute('data-day-state')).toBe('empty')
    expect(host.querySelector('[data-dsh-part="day-detail"]')?.textContent).toContain('该日无用量')
  })

  it('renders the platform reconcile strip in ready/error states and hides it when unavailable', async () => {
    const ready = overview()
    ready.platform = {
      status: 'ready',
      currency: 'CNY',
      monthCost: 128.42,
      localMonthCost: 119.87,
      coverage: 0.86,
      delta: 8.55,
      updatedAt: Date.now(),
    } satisfies UsagePlatformView
    const first = mount(ready)
    root = first.root
    await flush()
    const strip = first.host.querySelector('[data-dsh-part="platform-strip"]')
    expect(strip?.getAttribute('data-platform-status')).toBe('ready')
    expect(strip?.textContent).toContain('官方本月 ¥128.42 · 本地 ¥119.87')
    expect(strip?.textContent).toContain('覆盖 86%')
    expect(strip?.textContent).toContain('差异 +¥8.55')
    first.root.unmount()
    root = undefined

    const failed = overview()
    failed.platform = { status: 'error', currency: 'CNY', updatedAt: 1, error: '401 unauthorized' }
    const second = mount(failed)
    root = second.root
    await flush()
    const errorStrip = second.host.querySelector('[data-dsh-part="platform-strip"]')
    expect(errorStrip?.getAttribute('data-platform-status')).toBe('error')
    expect(errorStrip?.textContent).toContain('官方平台对账暂不可用')
    expect(errorStrip?.textContent).toContain('401 unauthorized')
    second.root.unmount()
    root = undefined

    const hidden = overview()
    hidden.platform = { status: 'unavailable', currency: 'CNY', updatedAt: 1 }
    const third = mount(hidden)
    root = third.root
    await flush()
    expect(third.host.querySelector('[data-dsh-part="platform-strip"]')).toBeNull()
  })

  it('labels the USD reference estimate and its unpriced calls without mixing currencies', async () => {
    const priced = overview()
    priced.costEstimate = {
      currency: 'USD',
      amount: 0.42,
      pricedCalls: 6_234,
      totalCalls: 6_270,
      pricedModels: 12,
      totalModels: 15,
      source: 'models.dev',
    } satisfies UsageCostEstimate
    const first = mount(priced)
    root = first.root
    await flush()
    const line = first.host.querySelector('[data-dsh-part="usd-estimate"]')
    expect(line?.getAttribute('data-usd-priced')).toBe('yes')
    expect(line?.textContent).toContain('≈$0.42 USD 参考 · 已定价 12/15 模型')
    expect(line?.textContent).toContain('另有 36 次调用未定价')
    first.root.unmount()
    root = undefined

    const unpriced = overview()
    unpriced.costEstimate = {
      currency: 'USD',
      pricedCalls: 0,
      totalCalls: 6_270,
      pricedModels: 0,
      totalModels: 15,
      source: 'models.dev',
    } satisfies UsageCostEstimate
    const second = mount(unpriced)
    root = second.root
    await flush()
    const none = second.host.querySelector('[data-dsh-part="usd-estimate"]')
    expect(none?.getAttribute('data-usd-priced')).toBe('no')
    expect(none?.textContent).toContain('USD 参考：暂无可定价模型')
    expect(none?.textContent).toContain('6270 次调用未定价')
  })

  it('never rounds a partial cache hit up to 100%', async () => {
    const snapshot = overview()
    // 999_600 / 1_000_000 billed = 99.96% -> must display 99.9%, never 100%.
    snapshot.usage.today.totals = totals({ cacheReadTokens: 999_600, inputTokens: 400, calls: 10 })
    const first = mount(snapshot)
    root = first.root
    await flush()
    const hero = first.host.querySelector('[data-dsh-part="hero"]')
    expect(hero?.textContent).toContain('99.9%')
    expect(hero?.textContent).not.toContain('100%')
    first.root.unmount()
    root = undefined

    const exact = overview()
    exact.usage.today.totals = totals({ cacheReadTokens: 1_000, inputTokens: 0, calls: 1 })
    const second = mount(exact)
    root = second.root
    await flush()
    expect(second.host.querySelector('[data-dsh-part="hero"]')?.textContent).toContain('100%')
  })
})

describe('threshold alerts', () => {
  let root: Root | undefined
  afterEach(() => {
    cleanup()
    root?.unmount()
    root = undefined
  })

  it('renders one banner per alert with kind copy, severity styling and scope chips', async () => {
    const snapshot = overview()
    snapshot.alerts = ALERTS
    const { host, root: mounted } = mount(snapshot)
    root = mounted
    await flush()

    const stack = host.querySelector('[data-dsh-part="alert-stack"]')
    expect(stack).not.toBeNull()
    expect(stack?.getAttribute('data-alert-count')).toBe('3')
    const items = [...host.querySelectorAll('[data-dsh-part="alert"]')]
    expect(items).toHaveLength(3)
    expect(items[0]?.getAttribute('data-alert-kind')).toBe('daily-cost')
    expect(items[0]?.getAttribute('data-alert-severity')).toBe('critical')
    expect(items[1]?.getAttribute('data-alert-severity')).toBe('warning')
    expect(items[1]?.getAttribute('data-alert-provider')).toBe('opencode-go')

    // Localized by kind, not the Host's English message.
    expect(host.textContent).toContain('今日消费 ¥12.40 已达上限 ¥10.00')
    expect(host.textContent).toContain('opencode-go (completions) 每周 已用 78%（阈值 70%）')
    expect(host.textContent).toContain('opencode-go (completions) 余额 ¥23.17 低于 ¥50.00')
    // Scope chips: device-wide cost vs account-level provider facts.
    expect(items[0]?.textContent).toContain('全设备')
    expect(items[1]?.textContent).toContain('账号级')
  })

  it('renders no stack at all when the Host reports no alerts', async () => {
    const { host, root: mounted } = mount(overview())
    root = mounted
    await flush()
    expect(host.querySelector('[data-dsh-part="alert-stack"]')).toBeNull()
    expect(host.querySelector('[data-dsh-part="alert"]')).toBeNull()
  })
})

describe('alert settings and data health', () => {
  let root: Root | undefined
  afterEach(() => {
    cleanup()
    root?.unmount()
    root = undefined
  })

  it('edits custom sources in the form and saves the same JSON the JSON view shows', async () => {
    const calls: Array<ReadonlyArray<{ op: string; path: readonly string[]; value?: unknown }>> = []
    const customPlans = JSON.stringify([
      { id: 'my-plan', name: '内部额度网关', url: 'https://quota.example.com/usage', allowedHosts: ['quota.example.com'], tokenEnv: 'MY_PLAN_TOKEN' },
    ])
    const { host, root: mounted } = mount(overview(), {
      settingsValue: {
        enabled: true,
        pollIntervalSec: 60,
        bubbleMode: 'always',
        alertsEnabled: true,
        dailyCostLimitCny: 0,
        planAlertPercent: 0,
        balanceAlertCny: 0,
        alertCooldownMinutes: 60,
        planPromotePercent: 100,
        cpamcEnabled: false,
        cpamcBaseURL: 'http://127.0.0.1:8317',
        cpamcAllowedHosts: '',
        volcanoEnabled: false,
        customPlans,
      },
      onMutate: (ops) => calls.push(ops),
    })
    root = mounted
    await flush()
    pressTab(host, '设置')

    // Form mode is the default for valid JSON, and it renders one card per entry.
    const editor = host.querySelector('[data-dsh-part="custom-plan-editor"]')
    expect(editor).not.toBeNull()
    const entries = host.querySelectorAll('[data-dsh-part="custom-plan-entry"]')
    expect(entries).toHaveLength(1)
    expect(host.querySelector('[data-dsh-part="custom-plan-form"]')).not.toBeNull()

    const idField = entries[0]?.querySelectorAll<HTMLInputElement>('.planField input, input')[0]
    expect(idField?.value).toBe('my-plan')
    setInputValue(idField!, 'my-plan-2')

    act(() => host.querySelector<HTMLButtonElement>('[data-dsh-part="custom-plan-add"]')?.click())
    expect(host.querySelectorAll('[data-dsh-part="custom-plan-entry"]')).toHaveLength(2)
    // The new entry has no id yet, so the form warns before saving.
    expect(host.textContent).toContain('id 不能为空')

    // The JSON view shows the same document the form edits, before saving. This
    // stub's settings snapshot never updates, so the draft resets after a
    // successful save and the post-save view is not the thing to assert here.
    const jsonButton = host.querySelector<HTMLButtonElement>('[data-dsh-part="custom-plan-mode-json"]')
    expect(jsonButton).not.toBeNull()
    act(() => jsonButton?.click())
    const textarea = host.querySelector<HTMLTextAreaElement>('[data-dsh-part="custom-plan-json"]')
    expect(textarea).not.toBeNull()
    const fromJsonView = JSON.parse(textarea!.value) as Array<Record<string, unknown>>
    expect(fromJsonView).toHaveLength(2)
    expect(fromJsonView[0]).toMatchObject({ id: 'my-plan-2', name: '内部额度网关', url: 'https://quota.example.com/usage' })
    expect(fromJsonView[1]).toEqual({})

    const save = [...host.querySelectorAll<HTMLButtonElement>('[data-dsh-part="settings-row"] button')]
      .filter((button) => button.textContent === '保存' && !button.disabled)
      .pop()
    await act(async () => {
      save?.click()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(calls).toHaveLength(1)
    const saved = (calls[0] ?? []).find((op) => op.path.join('.') === 'customPlans')?.value
    expect(typeof saved).toBe('string')
    expect(JSON.parse(String(saved))).toEqual(fromJsonView)
  })

  it('falls back to the JSON editor when the stored document is invalid', async () => {
    const { host, root: mounted } = mount(overview(), {
      settingsValue: {
        enabled: true,
        pollIntervalSec: 60,
        bubbleMode: 'always',
        cpamcEnabled: false,
        cpamcBaseURL: 'http://127.0.0.1:8317',
        cpamcAllowedHosts: '',
        volcanoEnabled: false,
        platformUsageEnabled: true,
        costEstimateEnabled: true,
        customPlans: '[{"id": "ok"},',
      },
    })
    root = mounted
    await flush()
    pressTab(host, '设置')
    const editor = host.querySelector('[data-dsh-part="custom-plan-editor"]')
    expect(editor).not.toBeNull()
    // Broken JSON opens in the JSON view; the form does not try to render it.
    expect(host.querySelector('[data-dsh-part="custom-plan-form"]')).toBeNull()
    expect(host.querySelector('[data-dsh-part="custom-plan-json"]')).not.toBeNull()
    expect(host.querySelector('[data-dsh-part="custom-plan-form"]')).toBeNull()
  })

  it('stages and saves the ring promotion threshold when the Host supports it', async () => {
    const calls: Array<ReadonlyArray<{ op: string; path: readonly string[]; value?: unknown }>> = []
    const { host, root: mounted } = mount(overview(), {
      settingsValue: {
        enabled: true,
        pollIntervalSec: 60,
        bubbleMode: 'always',
        alertsEnabled: true,
        dailyCostLimitCny: 0,
        planAlertPercent: 0,
        balanceAlertCny: 0,
        alertCooldownMinutes: 60,
        planPromotePercent: 100,
        cpamcEnabled: false,
        cpamcBaseURL: 'http://127.0.0.1:8317',
        cpamcAllowedHosts: '',
        volcanoEnabled: false,
      },
      onMutate: (ops) => calls.push(ops),
    })
    root = mounted
    await flush()
    pressTab(host, '设置')

    const promote = host.querySelector<HTMLInputElement>('[data-dsh-part="plan-promote-percent"]')
    expect(promote).not.toBeNull()
    expect(promote?.value).toBe('100')
    setInputValue(promote!, '95')

    const save = [...host.querySelectorAll<HTMLButtonElement>('[data-dsh-part="settings-row"] button')]
      .filter((button) => button.textContent === '保存' && !button.disabled)
      .pop()
    await act(async () => {
      save?.click()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(calls).toHaveLength(1)
    const byPath = new Map((calls[0] ?? []).map((op) => [op.path.join('.'), op.value]))
    expect(byPath.get('planPromotePercent')).toBe(95)
  })

  it('hides the promotion field on a Host that does not know it', async () => {
    const legacyFields = {
      enabled: true,
      pollIntervalSec: 60,
      bubbleMode: 'always',
      alertsEnabled: true,
      dailyCostLimitCny: 0,
      planAlertPercent: 0,
      balanceAlertCny: 0,
      alertCooldownMinutes: 60,
      cpamcEnabled: false,
      cpamcBaseURL: 'http://127.0.0.1:8317',
      cpamcAllowedHosts: '',
      volcanoEnabled: false,
    }
    const { host, root: mounted } = mount(overview(), { settingsValue: legacyFields })
    root = mounted
    await flush()
    pressTab(host, '设置')
    expect(host.querySelector('[data-dsh-part="plan-promote-percent"]')).toBeNull()
  })

  it('stages and saves all five alert fields with the existing payload semantics', async () => {
    const calls: Array<ReadonlyArray<{ op: string; path: readonly string[]; value?: unknown }>> = []
    const { host, root: mounted } = mount(overview(), { onMutate: (ops) => calls.push(ops) })
    root = mounted
    await flush()
    pressTab(host, '设置')

    const group = host.querySelector<HTMLElement>('[data-dsh-part="alert-settings"]')
    expect(group).not.toBeNull()
    const inputs = [...(group?.querySelectorAll<HTMLInputElement>('input') ?? [])]
    expect(inputs).toHaveLength(5)
    // Defaults mirror the Host schema: alerts on, 0 thresholds, 60-minute cooldown.
    expect(inputs[0]?.type).toBe('checkbox')
    expect(inputs[0]?.checked).toBe(true)
    expect(inputs[1]?.value).toBe('0')
    expect(inputs[4]?.value).toBe('60')

    // Turning alerts off disables the threshold inputs without losing values.
    act(() => inputs[0]?.click())
    expect(inputs[1]?.disabled).toBe(true)
    act(() => inputs[0]?.click())
    expect(inputs[1]?.disabled).toBe(false)

    setInputValue(inputs[1]!, '25')
    setInputValue(inputs[2]!, '85')
    setInputValue(inputs[3]!, '40')
    setInputValue(inputs[4]!, '30')

    const save = [...host.querySelectorAll<HTMLButtonElement>('[data-dsh-part="settings-row"] button')]
      .filter((button) => button.textContent === '保存' && !button.disabled)
      .pop()
    expect(save).toBeDefined()
    await act(async () => {
      save?.click()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(calls).toHaveLength(1)
    const byPath = new Map((calls[0] ?? []).map((op) => [op.path.join('.'), op.value]))
    expect(byPath.get('alertsEnabled')).toBe(true)
    expect(byPath.get('dailyCostLimitCny')).toBe(25)
    expect(byPath.get('planAlertPercent')).toBe(85)
    expect(byPath.get('balanceAlertCny')).toBe(40)
    expect(byPath.get('alertCooldownMinutes')).toBe(30)
  })

  it('uses a themed listbox for the display select instead of the native menu', async () => {
    const calls: Array<ReadonlyArray<{ op: string; path: readonly string[]; value?: unknown }>> = []
    const { host, root: mounted } = mount(overview(), {
      settingsValue: {
        enabled: true,
        pollIntervalSec: 60,
        bubbleMode: 'always',
        alertsEnabled: true,
        dailyCostLimitCny: 0,
        planAlertPercent: 0,
        balanceAlertCny: 0,
        alertCooldownMinutes: 60,
        cpamcEnabled: false,
        cpamcBaseURL: 'http://127.0.0.1:8317',
        cpamcAllowedHosts: '',
        volcanoEnabled: false,
        platformUsageEnabled: true,
        costEstimateEnabled: true,
        customPlans: '',
      },
      onMutate: (ops) => calls.push(ops),
    })
    root = mounted
    await flush()
    pressTab(host, '设置')

    // The native popup renders as a light OS menu on some platforms, so the
    // settings form must not use <select> at all.
    expect(host.querySelector('[data-dsh-part="settings-row"] select')).toBeNull()
    const trigger = host.querySelector<HTMLButtonElement>('[data-dsh-part="setting-select"] [role="combobox"]')
    expect(trigger?.getAttribute('aria-haspopup')).toBe('listbox')
    expect(trigger?.getAttribute('aria-expanded')).toBe('false')
    expect(trigger?.textContent).toContain('常驻显示')

    act(() => trigger?.click())
    await flush()
    expect(trigger?.getAttribute('aria-expanded')).toBe('true')
    const options = [...host.querySelectorAll<HTMLElement>('[role="option"]')]
    expect(options.map((option) => option.textContent?.replace('✓', ''))).toEqual(['常驻显示', '仅变化时', '关闭'])
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')

    const off = options.find((option) => option.textContent?.includes('关闭'))
    act(() => off?.click())
    await flush()
    expect(host.querySelector('[role="listbox"]')).toBeNull()
    expect(trigger?.textContent).toContain('关闭')

    const save = [...host.querySelectorAll<HTMLButtonElement>('[data-dsh-part="settings-row"] button')]
      .filter((button) => button.textContent === '保存' && !button.disabled)
      .pop()
    await act(async () => {
      save?.click()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    const byPath = new Map((calls[0] ?? []).map((op) => [op.path.join('.'), op.value]))
    expect(byPath.get('bubbleMode')).toBe('off')
  })

  it('saves only legacy fields and explains the version skew on an older Host', async () => {
    const calls: Array<ReadonlyArray<{ op: string; path: readonly string[]; value?: unknown }>> = []
    const snapshot = overview()
    // Old Host: no health payload and a config schema without the alert fields.
    delete snapshot.health
    const legacyFields = {
      enabled: true,
      pollIntervalSec: 60,
      bubbleMode: 'always',
      cpamcEnabled: false,
      cpamcBaseURL: 'http://127.0.0.1:8317',
      cpamcAllowedHosts: '',
      volcanoEnabled: false,
    }
    const { host, root: mounted } = mount(snapshot, {
      settingsValue: legacyFields,
      onMutate: (ops) => calls.push(ops),
    })
    root = mounted
    await flush()
    pressTab(host, '设置')

    const alertGroup = host.querySelector<HTMLElement>('[data-dsh-part="alert-settings"]')
    expect(alertGroup?.getAttribute('data-host-compat')).toBe('old')
    expect(host.querySelector('[data-dsh-part="alert-settings-host-note"]')?.textContent).toContain('重启 DSH')
    const alertInputs = [...(alertGroup?.querySelectorAll<HTMLInputElement>('input') ?? [])]
    expect(alertInputs.every((input) => input.disabled)).toBe(true)
    expect(host.textContent).toContain('需要 v0.5.0 及以上')

    // Legacy settings still save; the undeliverable alert paths are omitted.
    const pollInput = [...host.querySelectorAll<HTMLInputElement>('[data-dsh-part="settings-row"] input[type="number"]')][0]
    expect(pollInput).toBeDefined()
    setInputValue(pollInput!, '120')
    const save = [...host.querySelectorAll<HTMLButtonElement>('[data-dsh-part="settings-row"] button')]
      .filter((button) => button.textContent === '保存' && !button.disabled)
      .pop()
    expect(save).toBeDefined()
    await act(async () => {
      save?.click()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(calls).toHaveLength(1)
    const paths = (calls[0] ?? []).map((op) => op.path.join('.'))
    expect(paths).toContain('pollIntervalSec')
    expect(paths).not.toContain('alertsEnabled')
    expect(paths).not.toContain('dailyCostLimitCny')
    expect(paths).not.toContain('alertCooldownMinutes')
  })

  it('tests the CPAMC connection through the loopback test route', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        target: 'cpamc',
        ok: true,
        latencyMs: 23,
        accounts: 2,
        windows: [{ key: 'week', percent: 78 }],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const settingsValue = {
      enabled: true,
      pollIntervalSec: 60,
      bubbleMode: 'always',
      alertsEnabled: true,
      dailyCostLimitCny: 0,
      planAlertPercent: 0,
      balanceAlertCny: 0,
      alertCooldownMinutes: 60,
      cpamcEnabled: true,
      cpamcBaseURL: 'http://127.0.0.1:8317',
      cpamcAllowedHosts: '',
      volcanoEnabled: false,
    }
    const { host, root: mounted } = mount(overview(), { settingsValue })
    root = mounted
    await flush()
    pressTab(host, '设置')

    const button = host.querySelector<HTMLButtonElement>('[data-dsh-part="cpamc-test"] button')
    expect(button?.textContent).toBe('测试连接')
    await act(async () => {
      button?.click()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/dsh-usage-plus/test')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      target: 'cpamc',
      config: {
        cpamcEnabled: true,
        cpamcBaseURL: 'http://127.0.0.1:8317',
        cpamcAllowedHosts: '',
      },
    })
    expect(host.textContent).toContain('连接成功：2 个账号')
    expect(host.textContent).toContain('78%')
  })

  it('tests the CPAMC fields typed into the form before Save', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ target: 'cpamc', ok: true, latencyMs: 11, accounts: 1, windows: [{ key: '5h', percent: 12 }] }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const calls: Array<ReadonlyArray<{ op: string; path: readonly string[]; value?: unknown }>> = []
    const { host, root: mounted } = mount(overview(), {
      settingsValue: {
        enabled: true,
        pollIntervalSec: 60,
        bubbleMode: 'always',
        alertsEnabled: true,
        dailyCostLimitCny: 0,
        planAlertPercent: 0,
        balanceAlertCny: 0,
        alertCooldownMinutes: 60,
        cpamcEnabled: true,
        cpamcBaseURL: 'http://127.0.0.1:8317',
        cpamcAllowedHosts: '',
        volcanoEnabled: false,
        platformUsageEnabled: true,
        costEstimateEnabled: true,
        customPlans: '',
      },
      onMutate: (ops) => calls.push(ops),
    })
    root = mounted
    await flush()
    pressTab(host, '设置')

    setInputValue(host.querySelector<HTMLInputElement>('[data-dsh-part="cpamc-url"]')!, 'https://api.example.com')
    setInputValue(host.querySelector<HTMLInputElement>('[data-dsh-part="cpamc-allowed-hosts"]')!, 'api.example.com')
    setInputValue(host.querySelector<HTMLInputElement>('[data-dsh-part="cpamc-token"]')!, 'fresh-management-key')

    const button = host.querySelector<HTMLButtonElement>('[data-dsh-part="cpamc-test"] button')
    await act(async () => {
      button?.click()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    // The unsaved draft is what the probe sees, and nothing was persisted.
    expect(calls).toHaveLength(0)
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as {
      target: string
      config: Record<string, unknown>
    }
    expect(body.target).toBe('cpamc')
    expect(body.config).toMatchObject({
      cpamcEnabled: true,
      cpamcBaseURL: 'https://api.example.com',
      cpamcAllowedHosts: 'api.example.com',
      cpamcManagementKey: 'fresh-management-key',
    })
    expect(host.textContent).toContain('连接成功')
  })

  it('shows the CPAMC hint when the test fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        target: 'cpamc',
        ok: false,
        latencyMs: 4,
        error: 'fetch failed (ECONNREFUSED)',
        hint: '若 CPAMC 部署在 api.example.com，请把管理地址改为 https://api.example.com。',
      }),
    })))
    const { host, root: mounted } = mount(overview(), { settingsValue: { cpamcEnabled: true, cpamcBaseURL: 'http://127.0.0.1:8317' } })
    root = mounted
    await flush()
    pressTab(host, '设置')

    const button = host.querySelector<HTMLButtonElement>('[data-dsh-part="cpamc-test"] button')
    await act(async () => {
      button?.click()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(host.textContent).toContain('连接失败：fetch failed (ECONNREFUSED)')
    expect(host.querySelector('[data-dsh-part="cpamc-test-hint"]')?.textContent).toContain('api.example.com')
  })

  it('renders coverage, ledger size, backfill, probes and corrupt files in the health card', async () => {
    const snapshot = overview()
    snapshot.health = healthy()
    snapshot.providers.push(provider({ provider: 'kimi-coding', displayName: 'Kimi Coding' }))
    const { host, root: mounted } = mount(snapshot)
    root = mounted
    await flush()
    pressTab(host, '设置')

    const card = host.querySelector('[data-dsh-part="health-card"]')
    expect(card).not.toBeNull()
    expect(card?.getAttribute('data-health-state')).toBe('ready')
    expect(host.textContent).toContain('台账覆盖')
    expect(host.textContent).toContain('10-03 至 11-16')
    expect(host.textContent).toContain('42/182 天有数据')
    expect(host.textContent).toContain('2.3 MiB')
    expect(host.textContent).toContain('已完成')
    expect(host.textContent).toContain('128 会话 / 8412 事件')
    expect(host.textContent).toContain('已截断')
    expect(host.textContent).toContain('Kimi Coding')
    expect(host.textContent).toContain('发现 1 个损坏台账文件')
    // Coverage bar width = activeDays / retentionDays.
    const fill = host.querySelector<HTMLElement>('[data-dsh-part="health-coverage"] span[style*="width"]')
    expect(fill?.style.width).toMatch(/^23\.0/)
  })

  it('falls back to a note when an older Host omits health', async () => {
    const snapshot = overview()
    delete snapshot.health
    const { host, root: mounted } = mount(snapshot)
    root = mounted
    await flush()
    pressTab(host, '设置')

    const card = host.querySelector('[data-dsh-part="health-card"]')
    expect(card?.getAttribute('data-health-state')).toBe('missing')
    expect(host.textContent).toContain('需要 v0.5.0 及以上')
  })
})
