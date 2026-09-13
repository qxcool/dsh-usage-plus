import { describe, expect, it } from 'vitest'
import { adapterFor } from '../src/core/adapters.ts'
import { currentPlanProvider } from '../src/client/PlanUsageStrip.tsx'
import { emptyTotals, type UsageOverviewView } from '../src/core/types.ts'

function overview(): UsageOverviewView {
  return {
    updatedAt: 1,
    current: { provider: 'openai-codex', model: 'gpt-5', source: 'default' },
    providers: [{
      provider: 'openai-codex', displayName: 'Codex', credential: 'oauth', supported: true,
      planSupported: true, plan: { updatedAt: 1, windows: [{ key: '5h', percent: 25 }, { key: 'day', percent: 50 }] },
    }],
    usage: { today: { date: '2026-09-13', totals: emptyTotals(), providers: [] }, days: [] },
  }
}

describe('official quota rendering', () => {
  it('keeps only supported 5h/week/month windows for the current provider', () => {
    expect(currentPlanProvider(overview())?.plan?.windows).toEqual([{ key: '5h', percent: 25 }])
  })

  it('renders nothing when the current provider has no official percentage window', () => {
    const value = overview()
    value.providers[0].plan = { updatedAt: 1, windows: [{ key: '5h' }] }
    expect(currentPlanProvider(value)).toBeUndefined()
  })

  it('normalizes Codex primary and secondary windows', () => {
    const parsed = adapterFor('openai-codex')?.plan?.parse(200, {
      rate_limit: {
        primary_window: { used_percent: 10, limit_window_seconds: 18000, reset_at: 1_800_000_000 },
        secondary_window: { used_percent: 20, limit_window_seconds: 604800, reset_at: 1_800_100_000 },
      },
    })
    expect(parsed?.windows.map((window) => window.key)).toEqual(['5h', 'week'])
  })
})
