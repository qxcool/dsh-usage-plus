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
import { emptyTotals, type ProviderSnapshotView, type UsageOverviewView } from '../src/core/types.ts'
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
  options: { rangeDays?: UsageRangeDays; onRange?: (days: UsageRangeDays) => void } = {},
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
      getSnapshot: () => ({ status: 'ready', value: {}, writable: true, revision: 0 }),
      subscribe: () => () => {},
      set: async () => true,
      mutate: async () => true,
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
