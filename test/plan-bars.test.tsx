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
import { emptyTotals, type ProviderSnapshotView, type UsageAlert, type UsageHealth, type UsageOverviewView } from '../src/core/types.ts'
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
