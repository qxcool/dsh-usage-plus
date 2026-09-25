import { describe, expect, it } from 'vitest'
import { adapterFor } from '../src/core/adapters.ts'
import { buildHeatmapGrid } from '../src/core/heatmap.ts'
import { currentPlanProvider, orderedPlanWindows, planTabProviders } from '../src/core/plan-match.ts'
import { emptyTotals, type UsageOverviewView } from '../src/core/types.ts'

function overview(partial?: Partial<UsageOverviewView>): UsageOverviewView {
  return {
    updatedAt: 1,
    current: { provider: 'openai-codex', model: 'gpt-5', source: 'default' },
    providers: [{
      provider: 'openai-codex', displayName: 'Codex', credential: 'oauth', supported: true,
      planSupported: true, plan: { updatedAt: 1, windows: [{ key: '5h', percent: 25 }, { key: 'day', percent: 50 }] },
    }],
    usage: { today: { date: '2026-09-13', totals: emptyTotals(), providers: [] }, days: [] },
    ...partial,
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

  it('maps a volcano model route onto the volcano external plan snapshot', () => {
    const value = overview({
      current: { provider: 'volcengine', model: 'doubao-seed-1.6', source: 'default' },
      providers: [{
        provider: 'volcano:ark-plan',
        displayName: '火山方舟 Coding Plan',
        credential: 'env',
        supported: true,
        planSupported: true,
        source: 'volcano',
        plan: { updatedAt: 1, windows: [{ key: '5h', percent: 42 }, { key: 'week', percent: 18 }] },
      }],
    })
    expect(currentPlanProvider(value)?.plan?.windows).toEqual([
      { key: '5h', percent: 42 },
      { key: 'week', percent: 18 },
    ])
  })

  it('maps a CLI Proxy baseURL onto the matching CPAMC family plan', () => {
    const value = overview({
      current: {
        provider: 'my-proxy',
        model: 'gpt-5',
        source: 'default',
        baseURL: 'http://127.0.0.1:8317/v1',
      },
      providers: [{
        provider: 'cpamc:codex:0',
        displayName: 'CPAMC · codex · a***@x.com',
        credential: 'env',
        supported: true,
        planSupported: true,
        source: 'cpamc',
        plan: { updatedAt: 1, windows: [{ key: '5h', percent: 11 }] },
      }],
    })
    expect(currentPlanProvider(value)?.provider).toBe('cpamc:codex:0')
    expect(currentPlanProvider(value)?.plan?.windows).toEqual([{ key: '5h', percent: 11 }])
  })

  it('prefers the per-session route override over the host global current', () => {
    const value = overview({
      current: { provider: 'openai-codex', model: 'gpt-5', source: 'live' },
      providers: [
        {
          provider: 'openai-codex', displayName: 'Codex', credential: 'oauth', supported: true,
          planSupported: true, plan: { updatedAt: 1, windows: [{ key: '5h', percent: 25 }] },
        },
        {
          provider: 'kimi-coding', displayName: 'Kimi', credential: 'oauth', supported: true,
          planSupported: true, plan: { updatedAt: 1, windows: [{ key: '5h', percent: 77 }] },
        },
      ],
    })
    expect(currentPlanProvider(value, { provider: 'kimi-coding', model: 'kimi-k2' })?.provider).toBe('kimi-coding')
    expect(currentPlanProvider(value)?.provider).toBe('openai-codex')
  })

  it('maps a per-session CPAMC route via provider id heuristics', () => {
    const value = overview({
      current: { provider: 'openai-codex', model: 'gpt-5', source: 'default' },
      providers: [{
        provider: 'cpamc:kimi:0',
        displayName: 'CPAMC · kimi · a***@x.com',
        credential: 'env',
        supported: true,
        planSupported: true,
        source: 'cpamc',
        plan: { updatedAt: 1, windows: [{ key: '5h', percent: 3 }] },
      }],
    })
    expect(currentPlanProvider(value, { provider: 'kimi-coding', model: 'kimi-k2' })?.provider).toBe('cpamc:kimi:0')
  })

  it('orders plan windows as 5h → week → month', () => {
    expect(orderedPlanWindows({
      updatedAt: 1,
      windows: [
        { key: 'month', percent: 9 },
        { key: '5h', percent: 1 },
        { key: 'week', percent: 4 },
      ],
    }).map((window) => window.key)).toEqual(['5h', 'week', 'month'])
  })

  it('keeps external error rows on the plans tab', () => {
    const rows = planTabProviders([
      {
        provider: 'cpamc:status',
        displayName: 'CPAMC',
        credential: 'env',
        supported: true,
        planSupported: true,
        source: 'cpamc',
        error: 'missing management token',
      },
      {
        provider: 'deepseek',
        displayName: 'DeepSeek',
        credential: 'env',
        supported: true,
        balanceSupported: true,
      },
    ])
    expect(rows.map((row) => row.provider)).toEqual(['cpamc:status'])
  })
})

describe('26-week heatmap', () => {
  it('builds a 26×7 Mon–Sun grid ending on the current week', () => {
    const now = new Date(2026, 8, 13, 12, 0, 0).getTime() // Sunday local
    const days = [
      { date: '2026-09-13', totals: { ...emptyTotals(), inputTokens: 100, calls: 1 }, providers: [] },
      { date: '2026-09-01', totals: { ...emptyTotals(), inputTokens: 50, calls: 1 }, providers: [] },
    ]
    const grid = buildHeatmapGrid(days, now)
    expect(grid.cells).toHaveLength(26 * 7)
    expect(grid.monthLabels).toHaveLength(26)
    const today = grid.cells.find((cell) => cell.date === '2026-09-13')
    expect(today?.isToday).toBe(true)
    expect(today?.tokens).toBe(100)
    expect(today?.level).toBeGreaterThan(0)
    expect(grid.cells[0]!.date <= grid.cells[6]!.date).toBe(true)
  })
})
