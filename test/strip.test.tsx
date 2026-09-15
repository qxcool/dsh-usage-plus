// @vitest-environment jsdom
/**
 * Renders the composer strip the way the slot renderer would: standard
 * session props injected alongside the inject-factory props. Locks the
 * per-session route behavior: projection selection wins, matching fallback
 * to the host global current, and full hiding when no plan matches either.
 * @module test/strip.test.tsx
 */
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PlanUsageStrip } from '../src/client/PlanUsageStrip.tsx'
import { sessionRouteFrom, type SessionFaceLike } from '../src/client/session-route.ts'
import { emptyTotals, type ProviderSnapshotView, type UsageOverviewView } from '../src/core/types.ts'

interface FakeStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => { snapshot: UsageOverviewView | null }
}

function fakeStore(snapshot: UsageOverviewView | null): FakeStore {
  const listeners = new Set<() => void>()
  // Cached/stable snapshot object — useSyncExternalStore identity-checks results.
  const state = { snapshot, status: snapshot === null ? 'loading' as const : 'ready', error: null }
  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
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
      provider({ provider: 'deepseek-official', displayName: 'DeepSeek', balanceSupported: true }),
    ],
    usage: { today: { date: '2026-09-15', totals: emptyTotals(), providers: [] }, days: [] },
    ...partial,
  }
}

/** One projection face; stable getSnapshot. */
function faceOf(value: unknown) {
  return { getSnapshot: () => value, subscribe: () => () => {} }
}

/** A session-layer stand-in whose useSession returns a structurally valid face. */
function sessionWith(value: unknown): { useSession?: () => SessionFaceLike | undefined } {
  const projections = { faceOf: (key: string) => (key === 'modelSelection' ? faceOf(value) : undefined) }
  const session: SessionFaceLike = { projections }
  return { useSession: idempotent(session) }
}

function idempotent(value: unknown): () => SessionFaceLike | undefined {
  return () => value as SessionFaceLike | undefined
}

function mount(element: ReactNode): { root: Root; host: HTMLElement } {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  root.render(element)
  return { root, host }
}

function flushSyncRender(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20))
}

const flush = flushSyncRender

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
      ...sessionWith({ lastUsed: { provider: 'opencode-go', model: 'glm-5.3-flash' }, next: null }),
    }))
    await flush()
    const span = host.querySelector('span[data-dsh-plugin="usage-plus"]')
    expect(span).not.toBeNull()
    expect(span?.getAttribute('data-usage-plus-rev')).toBe('2')
    expect(span?.querySelector('circle')).not.toBeNull()
    root.unmount()
  })

  it('falls back to the host global current when the session route has no plan', async () => {
    const snapshot = overview({ current: { provider: 'opencode-go', model: 'glm-5.3-flash', source: 'live' } })
    const store = fakeStore(snapshot)
    const { root, host } = mount(createElement(PlanUsageStrip, {
      store: store as never,
      poll: () => {},
      ...sessionWith({ lastUsed: { provider: 'some-new-route', model: 'm' }, next: null }),
    }))
    await flush()
    // some-new-route has no plan; the global live route (opencode-go) keeps the ring visible.
    expect(host.querySelector('span[data-dsh-plugin="usage-plus"]')).not.toBeNull()
    root.unmount()
  })

  it('stays hidden when neither session nor global route has a plan window', async () => {
    const snapshot = overview()
    const store = fakeStore(snapshot)
    const { root, host } = mount(createElement(PlanUsageStrip, { store: store as never, poll: () => {} }))
    await flush()
    // Global default deepseek-official has no plan; no session route → hidden.
    expect(host.querySelector('span[data-dsh-plugin="usage-plus"]')).toBeNull()
    root.unmount()
  })

  it('hides when a session-selected unknown route replaces a planed global current', async () => {
    const snapshot = overview()
    const store = fakeStore(snapshot)
    const { root, host } = mount(createElement(PlanUsageStrip, {
      store: store as never,
      poll: () => {},
      ...sessionWith({ lastUsed: { provider: 'universe', model: 'x' }, pending: null }),
      // next missing on purpose → falls through to lastUsed → unknown provider
    }))
    await flush()
    // universe has no plan → hidden (accuracy: never borrow another provider's window)
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

