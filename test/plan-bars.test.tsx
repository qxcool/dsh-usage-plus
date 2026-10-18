// @vitest-environment jsdom
/**
 * Locks the plan-quota bar geometry on the Plugins-page 套餐额度 tab.
 *
 * `styles.barFill` owns the fill's non-colour geometry (height, radius,
 * transition) while `barWarn` / `barLow` only supply the colour. Rendering a
 * high-usage window with the colour class alone collapses the inner span to
 * zero height, so a 91% bar looks blank while a 19% bar looks fine.
 * @module test/plan-bars
 */
import { act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { UsageSectionCard } from '../src/client/UsageSectionCard.tsx'
import { emptyTotals, type ProviderSnapshotView, type UsageOverviewView } from '../src/core/types.ts'
import styles from '../src/client/usage.module.css'

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
    usage: { today: { date: '2026-09-26', totals: emptyTotals(), providers: [] }, days: [] },
  }
}

function face(snapshot: UsageOverviewView): Record<string, unknown> {
  const state = { snapshot, status: 'ready' as const, error: null }
  return {
    view: 'page',
    store: { subscribe: () => () => {}, getSnapshot: () => state },
    poll: () => {},
    refresh: () => {},
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
