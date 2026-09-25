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
  return {
    useProjection: (key: string) => (key === 'modelSelection' ? value : undefined),
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
      poll: () => {},
      sessionId: 's1',
      ...projectionOf({ lastUsed: { provider: 'opencode-go', model: 'glm-5.3-flash' }, next: null }),
    }))
    await flush()
    const span = host.querySelector('span[data-dsh-plugin="usage-plus"]')
    expect(span).not.toBeNull()
    expect(span?.getAttribute('data-usage-plus-rev')).toBe('4')
    expect(span?.querySelector('circle')).not.toBeNull()
    expect(host.textContent).toContain('41%')
    root.unmount()
  })

  it('follows a different session selection without using the global current', async () => {
    const snapshot = overview({ current: { provider: 'opencode-go', model: 'glm-5.3-flash', source: 'live' } })
    const store = fakeStore(snapshot)
    const { root, host } = mount(createElement(PlanUsageStrip, {
      store: store as never,
      poll: () => {},
      sessionId: 's2',
      ...projectionOf({ next: { provider: 'minimax-cn', model: 'MiniMax-M3' } }),
    }))
    await flush()
    expect(host.textContent).toContain('12%')
    expect(host.textContent).not.toContain('41%')
    root.unmount()
  })

  it('does not fall back to global when the session route has no plan', async () => {
    const snapshot = overview({ current: { provider: 'opencode-go', model: 'glm-5.3-flash', source: 'live' } })
    const store = fakeStore(snapshot)
    const { root, host } = mount(createElement(PlanUsageStrip, {
      store: store as never,
      poll: () => {},
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
    const { root, host } = mount(createElement(PlanUsageStrip, { store: store as never, poll: () => {} }))
    await flush()
    expect(host.querySelector('span[data-dsh-plugin="usage-plus"]')).toBeNull()
    root.unmount()
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
})
