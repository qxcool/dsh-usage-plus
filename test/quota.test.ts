import { describe, expect, it } from 'vitest'
import { adapterFor } from '../src/core/adapters.ts'
import { customBalanceCredentialVars, extractByRule } from '../src/core/custom-balance.ts'
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

describe('custom balance extract + 26-week heatmap', () => {
  it('extracts nested paths and arithmetic rules', () => {
    const body = { data: { total_available: '12.5', quota: 1_000_000, used: 250_000 } }
    expect(extractByRule(body, 'data.total_available')).toBe(12.5)
    expect(extractByRule(body, { op: 'divide', path: 'data.quota', by: 500_000 })).toBe(2)
    expect(extractByRule(body, { op: 'subtract', paths: ['data.quota', 'data.used'] })).toBe(750_000)
    expect(extractByRule(body, { op: 'add', paths: ['data.used', 'data.used'] })).toBe(500_000)
  })

  it('collects {{VAR}} names from headers JSON', () => {
    expect(customBalanceCredentialVars('{"Authorization":"Bearer {{API_KEY}}","X-Trace":"{{ TRACE_ID }}"}')).toEqual([
      'API_KEY',
      'TRACE_ID',
    ])
    expect(customBalanceCredentialVars('not-json')).toEqual([])
  })

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
