// @vitest-environment jsdom
/**
 * Renders the composer strip the way the slot renderer would: session-scope
 * `useProjection('modelSelection')` injected alongside inject-factory props.
 * Locks per-session route behavior: projection selection wins; no fall-through
 * to a different provider's plan when this session already has a route.
 * @module test/strip.test.tsx
 */
import { act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PlanUsageStrip } from '../src/client/PlanUsageStrip.tsx'
import { sessionRouteFrom } from '../src/client/session-route.ts'
import { emptyTotals, type ProviderSnapshotView, type UsageOverviewView } from '../src/core/types.ts'
import styles from '../src/client/usage.module.css'

// The strip resolves copy from document.documentElement.lang at call time; pin
// zh here so the Chinese assertions below are stable (non-zh falls back to en).
document.documentElement.lang = 'zh'

interface FakeStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => { snapshot: UsageOverviewView | null }
}

function fakeStore(snapshot: UsageOverviewView | null): FakeStore {
  const state = { snapshot, status: snapshot === null ? 'loading' as const : 'ready', error: null }
  return {
    subscribe: () => () => {},
    getSnapshot: () => state,
  }
}

function provider(partial: Partial<ProviderSnapshotView>): ProviderSnapshotView {
  return { provider: 'x', displayName: 'X', credential: 'env', supported: true, ...partial }
}

function overview(partial?: Partial<UsageOverviewView>): UsageOverviewView {
  return {
    updatedAt: 1,
    current: { provider: 'deepseek-official', model: 'deepseek-chat', source: 'default' },
    providers: [
      provider({ provider: 'opencode-go', displayName: 'opencode-go', planSupported: true, plan: { updatedAt: 1, windows: [{ key: '5h', percent: 41 }, { key: 'week', percent: 32 }, { key: 'month', percent: 35 }] } }),
      provider({ provider: 'minimax-cn', displayName: 'minimax-cn', planSupported: true, plan: { updatedAt: 1, windows: [{ key: '5h', percent: 12 }, { key: 'week', percent: 8 }] } }),
      provider({ provider: 'deepseek-official', displayName: 'DeepSeek', balanceSupported: true }),
    ],
    usage: { today: { date: '2026-09-15', totals: emptyTotals(), providers: [] }, days: [] },
    ...partial,
  }
}

/** Mimic ui-session keyed projection hook: returns the value directly. */
function projectionOf(value: unknown): { useProjection: (key: string) => unknown } {
  return projections({ modelSelection: value })
}

/** Projection stub for several official session keys at once. */
function projections(values: Record<string, unknown>): { useProjection: (key: string) => unknown } {
  return {
    useProjection: (key: string) => values[key],
  }
}

function mount(element: ReactNode): { root: Root; host: HTMLElement } {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => {
    root.render(element)
  })
  return { root, host }
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
}

describe('PlanUsageStrip per-session route', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows the ring for the route selected in the session (e.g. opencode-go 41%)', async () => {
    const snapshot = overview()
    const store = fakeStore(snapshot)
    const { root, host } = mount(createElement(PlanUsageStrip, {
      store: store as never,
      sessionId: 's1',
      ...projectionOf({ lastUsed: { provider: 'opencode-go', model: 'glm-5.3-flash' }, next: null }),
    }))
    await flush()
    const span = host.querySelector('span[data-dsh-plugin="usage-plus"]')
    expect(span).not.toBeNull()
    expect(span?.getAttribute('data-usage-plus-rev')).toBe('4')
    expect(span?.querySelector('circle')).not.toBeNull()
    expect(host.textContent).toContain('额度')
    expect(host.textContent).toContain('5h 41.0%')
    expect(host.textContent).toContain('周 32.0%')
    expect(host.textContent).toContain('月 35.0%')
    root.unmount()
  })

  it('follows a different session selection without using the global current', async () => {
    const snapshot = overview({ current: { provider: 'opencode-go', model: 'glm-5.3-flash', source: 'live' } })
    const store = fakeStore(snapshot)
    const { root, host } = mount(createElement(PlanUsageStrip, {
      store: store as never,
      sessionId: 's2',
      ...projectionOf({ next: { provider: 'minimax-cn', model: 'MiniMax-M3' } }),
    }))
    await flush()
    expect(host.textContent).toContain('12.0%')
    expect(host.textContent).not.toContain('41.0%')
    root.unmount()
  })

  it('keeps the fill geometry for a high-usage monthly window', async () => {
    const snapshot = overview({
      current: { provider: 'opencode-go', model: 'glm-5.3-flash', source: 'live' },
      providers: [provider({
        provider: 'opencode-go', displayName: 'opencode-go', planSupported: true,
        plan: { updatedAt: 1, windows: [{ key: '5h', percent: 20 }, { key: 'week', percent: 19 }, { key: 'month', percent: 91 }] },
      })],
    })
    const { root, host } = mount(createElement(PlanUsageStrip, { store: fakeStore(snapshot) as never }))
    await flush()
    const ring = host.querySelector(`.${styles.quotaMeterFill}`)
    const dashLength = Number(ring?.getAttribute('stroke-dasharray')?.split(' ')[0])
    expect(dashLength).toBeCloseTo(2 * Math.PI * 5.5 * 0.91)
    expect(host.querySelector('[data-dsh-part="quota-meter"]')?.classList.contains(styles.quotaMeterDanger)).toBe(true)
    const trigger = host.querySelector('button')
    act(() => trigger?.click())

    const monthlyFill = host.querySelector('[style*="width: 91%"]')
    expect(monthlyFill?.classList.contains(styles.barFill)).toBe(true)
    expect(monthlyFill?.classList.contains(styles.barLow)).toBe(true)
    root.unmount()
  })

  it('does not fall back to global when the session route has no plan', async () => {
    const snapshot = overview({ current: { provider: 'opencode-go', model: 'glm-5.3-flash', source: 'live' } })
    const store = fakeStore(snapshot)
    const { root, host } = mount(createElement(PlanUsageStrip, {
      store: store as never,
      ...projectionOf({ lastUsed: { provider: 'some-new-route', model: 'm' }, next: null }),
    }))
    await flush()
    // Session picked an unknown route — hide rather than showing opencode-go's global plan.
    expect(host.querySelector('[data-dsh-part="quota-meter"]')).toBeNull()
    root.unmount()
  })

  it('renders nothing when neither session nor global route has a plan window', async () => {
    const snapshot = overview()
    const store = fakeStore(snapshot)
    const { root, host } = mount(createElement(PlanUsageStrip, { store: store as never }))
    await flush()
    expect(host.querySelector('span[data-dsh-plugin="usage-plus"]')).toBeNull()
    root.unmount()
  })

  it('links the popover, marks the tightest window and formats readings uniformly', async () => {
    const resetsAt = new Date(Date.now() + 3_600_000).toISOString()
    const snapshot = overview({
      current: { provider: 'opencode-go', model: 'glm-5.3-flash', source: 'live' },
      providers: [provider({
        provider: 'opencode-go',
        displayName: 'opencode-go',
        planSupported: true,
        plan: {
          updatedAt: 1,
          windows: [
            { key: '5h', percent: 41, resetsAt },
            { key: 'week', percent: 32, resetsAt },
            { key: 'month', percent: 35, resetsAt },
          ],
        },
      })],
    })
    const { root, host } = mount(createElement(PlanUsageStrip, { store: fakeStore(snapshot) as never }))
    await flush()
    const trigger = host.querySelector('button')
    expect(trigger).not.toBeNull()
    const controls = trigger?.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    expect(trigger?.getAttribute('aria-expanded')).toBe('false')

    act(() => trigger?.click())
    await flush()
    const panel = host.querySelector('[role="dialog"]')
    expect(panel).not.toBeNull()
    expect(panel?.id).toBe(controls)
    expect(panel?.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(panel)

    const heads = [...(panel?.querySelectorAll(`.${styles.quotaMeterBarHead}`) ?? [])]
    expect(heads).toHaveLength(3)
    // One consistent one-decimal format across the whole panel.
    expect(heads.every((head) => /\d+\.\d%/.test(head.textContent ?? ''))).toBe(true)

    // The "tightest" badge sits on the highest-usage window (5h 41%).
    const tight = panel?.querySelector(`.${styles.quotaMeterTight}`)
    expect(tight).not.toBeNull()
    expect(tight?.textContent).toBe('最紧')
    expect(heads[0]?.contains(tight as Node)).toBe(true)

    // Relative reset copy keeps the absolute instant as a tooltip.
    const reset = panel?.querySelector(`.${styles.quotaMeterReset}`)
    expect(reset?.getAttribute('title')).toBeTruthy()

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    await flush()
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    root.unmount()
  })

  it('falls back to English for non-Chinese document languages', async () => {
    const previous = document.documentElement.lang
    document.documentElement.lang = 'ja-JP'
    try {
      const snapshot = overview({
        current: { provider: 'opencode-go', model: 'glm-5.3-flash', source: 'live' },
      })
      const { root, host } = mount(createElement(PlanUsageStrip, { store: fakeStore(snapshot) as never }))
      await flush()
      expect(host.textContent).toContain('Quota')
      expect(host.textContent).toContain('5h 41.0%')
      expect(host.textContent).not.toContain('额度')
      root.unmount()
    } finally {
      document.documentElement.lang = previous
    }
  })

  it('shows a warning dot only when an alert names the current provider', async () => {
    const current = { provider: 'opencode-go', model: 'glm-5.3-flash', source: 'live' as const }
    const matching = overview({
      current,
      alerts: [{ kind: 'plan-threshold', severity: 'warning', provider: 'opencode-go', window: 'week', value: 78, threshold: 70, since: 1, message: 'plan' }],
    })
    const first = mount(createElement(PlanUsageStrip, { store: fakeStore(matching) as never }))
    await flush()
    const dot = first.host.querySelector('[data-dsh-part="quota-alert-dot"]')
    expect(dot).not.toBeNull()
    expect(dot?.getAttribute('data-alert-severity')).toBe('warning')
    expect(first.host.textContent).toContain('额度')
    first.root.unmount()

    // A device-wide cost alert or another provider's alert must not mark this pill.
    const unrelated = overview({
      current,
      alerts: [
        { kind: 'daily-cost', severity: 'critical', value: 12.4, threshold: 10, since: 1, message: 'cost' },
        { kind: 'balance-low', severity: 'critical', provider: 'minimax-cn', value: 3, threshold: 10, since: 2, message: 'balance' },
      ],
    })
    const second = mount(createElement(PlanUsageStrip, { store: fakeStore(unrelated) as never }))
    await flush()
    expect(second.host.querySelector('[data-dsh-part="quota-alert-dot"]')).toBeNull()
    second.root.unmount()
  })

  it('shows this-session tokens, cache hit, context occupancy and DeepSeek cost in the popover', async () => {
    const snapshot = overview({
      current: { provider: 'deepseek-official', model: 'deepseek-v4.1-flash', source: 'live' },
      providers: [
        provider({
          provider: 'deepseek-official',
          displayName: 'DeepSeek',
          planSupported: true,
          plan: { updatedAt: 1, windows: [{ key: '5h', percent: 20 }, { key: 'week', percent: 12 }] },
        }),
      ],
    })
    const { root, host } = mount(createElement(PlanUsageStrip, {
      store: fakeStore(snapshot) as never,
      ...projections({
        tokenUsage: {
          uncachedInputTokens: 1_240_000,
          outputTokens: 860_000,
          cacheReadTokens: 37_600_000,
          cacheWriteTokens: 230_000,
        },
        contextPressure: { pressureTokens: 92_000, projectedTokens: 96_500, contextWindow: 128_000 },
      }),
    }))
    await flush()

    const trigger = host.querySelector<HTMLButtonElement>('[data-dsh-part="quota-meter"] button')
    expect(trigger?.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger?.getAttribute('aria-expanded')).toBe('false')
    act(() => {
      trigger?.click()
    })
    await flush()
    expect(trigger?.getAttribute('aria-expanded')).toBe('true')

    const summary = host.querySelector('[data-dsh-part="session-summary"]')
    expect(summary).not.toBeNull()
    const row = (name: string): string => summary?.querySelector(`[data-session-row="${name}"]`)?.textContent ?? ''
    // billed = 1.24M uncached + 37.6M cache read + 0.23M cache write + 0.86M output
    expect(row('tokens')).toContain('39.9M')
    // cache hit uses input+cacheRead+cacheWrite (96.2%), not output.
    expect(row('cache')).toContain('96.2%')
    // projectedTokens differs from the exact sample, so the estimate carries ~.
    expect(row('context')).toContain('~75%')
    // Positive CNY estimate for the DeepSeek route, never ¥0.00.
    expect(row('cost')).toContain('≈¥')
    expect(row('cost')).toMatch(/≈¥\d/)
    expect(row('cost')).not.toContain('¥0.00')

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    await flush()
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    root.unmount()
  })

  it('marks session cost unknown for a non-DeepSeek route and hides the summary without projections', async () => {
    const nonDeepseek = overview({
      current: { provider: 'opencode-go', model: 'glm-5.3-flash', source: 'live' },
      providers: [provider({
        provider: 'opencode-go',
        displayName: 'opencode-go',
        planSupported: true,
        plan: { updatedAt: 1, windows: [{ key: '5h', percent: 41 }] },
      })],
    })
    const first = mount(createElement(PlanUsageStrip, {
      store: fakeStore(nonDeepseek) as never,
      ...projections({ tokenUsage: { uncachedInputTokens: 1_000, outputTokens: 2_000 } }),
    }))
    await flush()
    const trigger = first.host.querySelector<HTMLButtonElement>('[data-dsh-part="quota-meter"] button')
    act(() => {
      trigger?.click()
    })
    await flush()
    const costRow = first.host.querySelector('[data-session-row="cost"]')
    expect(costRow?.textContent).toContain('—')
    first.root.unmount()

    // No projections (older kit / tests that only stub modelSelection): no section.
    const plain = overview()
    const second = mount(createElement(PlanUsageStrip, {
      store: fakeStore(plain) as never,
      ...projectionOf({ lastUsed: { provider: 'opencode-go', model: 'glm-5.3-flash' }, next: null }),
    }))
    await flush()
    const plainTrigger = second.host.querySelector<HTMLButtonElement>('[data-dsh-part="quota-meter"] button')
    act(() => {
      plainTrigger?.click()
    })
    await flush()
    expect(second.host.querySelector('[role="dialog"]')).not.toBeNull()
    expect(second.host.querySelector('[data-dsh-part="session-summary"]')).toBeNull()
    second.root.unmount()
  })

  it('parses session route views with next set', () => {
    expect(sessionRouteFrom({ next: { provider: 'opencode-go', model: 'glm-5.3-flash' } })).toEqual({
      provider: 'opencode-go',
      model: 'glm-5.3-flash',
    })
    expect(sessionRouteFrom({ lastUsed: null, next: null })).toBeUndefined()
    expect(sessionRouteFrom(undefined)).toBeUndefined()
  })
})

describe('cpamc / reset helpers', () => {
  it('accepts only loopback origins for CPAMC', async () => {
    const { isCpamcLoopbackUrl, friendlyProbeError } = await import('../src/client/locales.ts')
    expect(isCpamcLoopbackUrl('http://127.0.0.1:8317')).toBe(true)
    expect(isCpamcLoopbackUrl('https://api.ominisalesagent.com')).toBe(false)
    expect(isCpamcLoopbackUrl('http://127.0.0.1:8317/v1')).toBe(false)
    expect(friendlyProbeError('CPAMC URL must be a loopback origin')).toContain('127.0.0.1')
  })

  it('explains custom-plan failures without reusing the CPAMC copy', async () => {
    const { friendlyCustomPlanError } = await import('../src/client/locales.ts')
    // A 401 must not tell the user to fix a CPAMC management token.
    const auth = friendlyCustomPlanError('custom plan rejected the request (401/403)')
    expect(auth).toBeDefined()
    expect(auth).not.toContain('CPAMC')
    expect(auth).toContain('tokenEnv')
    expect(friendlyCustomPlanError('custom plan token env MY_TOKEN is not set')).toContain('tokenEnv')
    expect(friendlyCustomPlanError('custom plan host "evil.example" is not loopback and not listed in allowedHosts')).toContain('allowedHosts')
    expect(friendlyCustomPlanError('custom plan HTTP 500')).toContain('500')
    expect(friendlyCustomPlanError('custom plan redirect refused')).toContain('重定向')
    expect(friendlyCustomPlanError('custom plan response contained no usable quota windows')).toContain('windows')
    expect(friendlyCustomPlanError(undefined)).toBeUndefined()
  })
})
