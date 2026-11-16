/**
 * Threshold alerts: pure threshold/severity/episode evaluation plus the
 * service wiring (pet bubbles once per episode, cooldown, disabled switches,
 * and the alerts carried on the overview document).
 */
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { emptyTotals, type ProviderSnapshotState, type UsageLedgerDocument, type UsageOverviewView } from '../src/core/types.ts'
import { foldUsage, localDateKey } from '../src/core/ledger.ts'
import { alertKey, evaluateAlerts, type AlertThresholds } from '../src/host/alerts.ts'
import { UsageService, type UsageServiceOptions } from '../src/host/usage-service.ts'

const THRESHOLDS: AlertThresholds = { alertsEnabled: true, dailyCostLimitCny: 10, planAlertPercent: 80, balanceAlertCny: 10 }

function provider(overrides: Partial<ProviderSnapshotState> & { provider: string }): ProviderSnapshotState {
  return { displayName: overrides.provider, credential: 'env', supported: true, updatedAt: 1, ...overrides }
}

describe('evaluateAlerts', () => {
  it('raises the daily-cost warning at 80% and critical at the limit', () => {
    const episodes = new Map<string, number>()
    const facts = (cost: number) => ({ todayCost: cost, providers: [] })
    expect(evaluateAlerts(facts(7.99), THRESHOLDS, episodes, 1).alerts).toEqual([])
    const warning = evaluateAlerts(facts(8), THRESHOLDS, episodes, 2)
    expect(warning.alerts).toHaveLength(1)
    expect(warning.alerts[0]).toMatchObject({ kind: 'daily-cost', severity: 'warning', value: 8, threshold: 10, since: 2 })
    expect(warning.started).toHaveLength(1)
    const critical = evaluateAlerts(facts(10), THRESHOLDS, episodes, 3)
    expect(critical.alerts[0]).toMatchObject({ severity: 'critical' })
    // Same episode keeps its original since and is not re-started.
    expect(critical.alerts[0]?.since).toBe(2)
    expect(critical.started).toEqual([])
  })

  it('dedupes plan windows to the tightest window per provider', () => {
    const episodes = new Map<string, number>()
    const rows = [
      provider({ provider: 'p1', plan: { windows: [{ key: '5h', percent: 50 }, { key: 'week', percent: 92 }], updatedAt: 1 } }),
      provider({ provider: 'p2', plan: { windows: [{ key: '5h', percent: 85 }], updatedAt: 1 } }),
      provider({ provider: 'p3', plan: { windows: [{ key: '5h', percent: 20 }], updatedAt: 1 } }),
    ]
    const result = evaluateAlerts({ todayCost: 0, providers: rows }, THRESHOLDS, episodes, 10)
    expect(result.alerts.map((alert) => `${alert.provider}:${alert.window}:${alert.severity}`)).toEqual([
      'p1:week:warning',
      'p2:5h:warning',
    ])
    expect(result.alerts[0]?.value).toBe(92)
  })

  it('marks plan alerts critical at 95% and ignores percent-less windows', () => {
    const episodes = new Map<string, number>()
    const rows = [
      provider({ provider: 'p', plan: { windows: [{ key: '5h' }, { key: 'week', percent: 95 }], updatedAt: 1 } }),
    ]
    const result = evaluateAlerts({ todayCost: 0, providers: rows }, THRESHOLDS, episodes, 10)
    expect(result.alerts[0]).toMatchObject({ kind: 'plan-threshold', severity: 'critical', window: 'week', value: 95 })
  })

  it('applies the CNY balance thresholds, ignoring other currencies', () => {
    const episodes = new Map<string, number>()
    const facts = (providers: ProviderSnapshotState[]) => ({ todayCost: 0, providers })
    expect(evaluateAlerts(facts([provider({ provider: 'p', balance: { currency: 'CNY', totalBalance: '10.01', updatedAt: 1 } })]), THRESHOLDS, episodes, 1).alerts).toEqual([])
    expect(evaluateAlerts(facts([provider({ provider: 'p', balance: { currency: 'CNY', totalBalance: '10', updatedAt: 1 } })]), THRESHOLDS, episodes, 1).alerts[0])
      .toMatchObject({ kind: 'balance-low', severity: 'warning', value: 10 })
    expect(evaluateAlerts(facts([provider({ provider: 'p', balance: { currency: 'CNY', totalBalance: '5', updatedAt: 1 } })]), THRESHOLDS, episodes, 1).alerts[0])
      .toMatchObject({ severity: 'critical' })
    expect(evaluateAlerts(facts([provider({ provider: 'p', balance: { currency: 'USD', totalBalance: '1', updatedAt: 1 } })]), THRESHOLDS, episodes, 1).alerts).toEqual([])
  })

  it('clears episodes when the condition clears so a re-crossing is a new episode', () => {
    const episodes = new Map<string, number>()
    const condition = { todayCost: 12, providers: [] }
    const first = evaluateAlerts(condition, THRESHOLDS, episodes, 100)
    expect(first.started).toHaveLength(1)
    expect(episodes.size).toBe(1)
    const cleared = evaluateAlerts({ todayCost: 0, providers: [] }, THRESHOLDS, episodes, 200)
    expect(cleared.alerts).toEqual([])
    expect(episodes.size).toBe(0)
    const again = evaluateAlerts(condition, THRESHOLDS, episodes, 300)
    expect(again.started).toHaveLength(1)
    expect(again.alerts[0]?.since).toBe(300)
  })

  it('produces no alerts when disabled or when every threshold is zero', () => {
    const episodes = new Map<string, number>()
    episodes.set(alertKey('daily-cost'), 1)
    const facts = { todayCost: 100, providers: [provider({ provider: 'p', balance: { currency: 'CNY', totalBalance: '0.01', updatedAt: 1 }, plan: { windows: [{ key: '5h', percent: 100 }], updatedAt: 1 } })] }
    expect(evaluateAlerts(facts, { ...THRESHOLDS, alertsEnabled: false }, episodes, 2)).toEqual({ alerts: [], started: [] })
    expect(episodes.size).toBe(0)
    episodes.set(alertKey('daily-cost'), 1)
    expect(evaluateAlerts(facts, { alertsEnabled: true, dailyCostLimitCny: 0, planAlertPercent: 0, balanceAlertCny: 0 }, episodes, 2).alerts).toEqual([])
    expect(episodes.size).toBe(0)
  })

  it('never throws on malformed facts', () => {
    const episodes = new Map<string, number>()
    const rows = [
      { provider: 'broken', displayName: 'x', credential: 'none', supported: false } as ProviderSnapshotState,
      provider({ provider: 'bad-plan', plan: { windows: [], updatedAt: 1 } }),
      provider({ provider: 'bad-balance', balance: { currency: 'CNY', totalBalance: 'not-a-number', updatedAt: 1 } }),
    ]
    expect(() => evaluateAlerts({ todayCost: Number.NaN, providers: rows }, THRESHOLDS, episodes, 1)).not.toThrow()
    expect(evaluateAlerts({ todayCost: Number.NaN, providers: rows }, THRESHOLDS, episodes, 1).alerts).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Service wiring (pet bubble episodes + overview payload)
// ---------------------------------------------------------------------------

const BASE_OPTIONS: UsageServiceOptions = {
  pollIntervalSec: 60,
  bubbleMode: 'always',
  retainDays: 182,
  cpamcEnabled: false,
  cpamcBaseURL: 'http://127.0.0.1:8317',
  cpamcManagementKeyEnv: 'CPAMC_MANAGEMENT_KEY',
  cpamcAllowedHosts: '',
  volcanoEnabled: false,
  volcanoAccessKeyEnv: 'VOLC_ACCESSKEY',
  volcanoSecretKeyEnv: 'VOLC_SECRETKEY',
}

interface AlertInternals {
  ledger: UsageLedgerDocument
  snapshots: Map<string, ProviderSnapshotState>
  alertEpisodes: Map<string, number>
  bumpRevision(): void
  bumpLedgerRevision(): void
}

interface AlertHarness {
  service: UsageService
  internals: AlertInternals
  petCalls: Array<Record<string, unknown>>
  dir: string
}

async function alertHarness(options: Partial<UsageServiceOptions>, snapshots: ProviderSnapshotState[] = []): Promise<AlertHarness> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-alert-'))
  const petCalls: Array<Record<string, unknown>> = []
  const routes = snapshots.map((snapshot) => ({ id: snapshot.provider, name: snapshot.displayName }))
  const ctx = {
    get: (name: string) => {
      if (name === 'pet') return { announce: (input: Record<string, unknown>) => { petCalls.push(input) } }
      if (name === 'llm') return { listProviders: () => routes, listConfigurableProviders: () => [] }
      return undefined
    },
    on: () => () => {},
  } as unknown as Context
  const service = new UsageService(ctx, { ...BASE_OPTIONS, ...options }, dir)
  const internals = service as unknown as AlertInternals
  for (const snapshot of snapshots) internals.snapshots.set(snapshot.provider, snapshot)
  return { service, internals, petCalls, dir }
}

function seedTodayCost(internals: AlertInternals, cost: number): void {
  foldUsage(internals.ledger, new Date().setHours(12, 0, 0, 0), 'deepseek-official', 'deepseek-v4', {
    ...emptyTotals(),
    inputTokens: 1,
    calls: 1,
    cost,
  })
  internals.bumpLedgerRevision()
}

async function close(harness: AlertHarness): Promise<void> {
  await harness.service.stop()
  await rm(harness.dir, { recursive: true, force: true })
}

describe('alert service wiring', () => {
  it('carries active alerts on the document and bubbles a new episode exactly once', async () => {
    const harness = await alertHarness({ dailyCostLimitCny: 10 })
    try {
      seedTodayCost(harness.internals, 10)
      const first = await harness.service.overview()
      expect(first.alerts).toHaveLength(1)
      expect(first.alerts?.[0]).toMatchObject({ kind: 'daily-cost', severity: 'critical', value: 10, threshold: 10 })
      expect(first.alerts?.[0]?.since).toBeGreaterThan(0)
      expect(harness.petCalls).toHaveLength(1)
      expect(harness.petCalls[0]).toMatchObject({ source: 'dsh-usage-plus', kind: 'cost' })

      // A warm read at the same revision reuses the cached document: active
      // alert stays visible, but the episode does not bubble again.
      const second = await harness.service.overview()
      expect(second).toBe(first)
      expect(second.alerts).toHaveLength(1)
      expect(harness.petCalls).toHaveLength(1)
    } finally {
      await close(harness)
    }
  })

  it('shows warning severity near the daily limit', async () => {
    const harness = await alertHarness({ dailyCostLimitCny: 10 })
    try {
      seedTodayCost(harness.internals, 8)
      const document = await harness.service.overview()
      expect(document.alerts?.[0]).toMatchObject({ kind: 'daily-cost', severity: 'warning' })
    } finally {
      await close(harness)
    }
  })

  it('raises plan and balance alerts from provider snapshots', async () => {
    const planProvider = provider({
      provider: 'plan-provider',
      plan: { windows: [{ key: '5h', percent: 40 }, { key: 'week', percent: 96 }], updatedAt: 1 },
    })
    const balanceProvider = provider({ provider: 'balance-provider', balance: { currency: 'CNY', totalBalance: '3.00', updatedAt: 1 } })
    const harness = await alertHarness({ planAlertPercent: 80, balanceAlertCny: 10 }, [planProvider, balanceProvider])
    try {
      const document = await harness.service.overview()
      expect(document.alerts?.map((alert) => `${alert.kind}:${alert.provider}:${alert.window ?? ''}:${alert.severity}`)).toEqual([
        'plan-threshold:plan-provider:week:critical',
        'balance-low:balance-provider::critical',
      ])
      // One bubble per new episode (2 alerts, 2 bubbles).
      expect(harness.petCalls).toHaveLength(2)
    } finally {
      await close(harness)
    }
  })

  it('clears the episode when the condition clears and re-crossing starts a new one', async () => {
    const harness = await alertHarness({ dailyCostLimitCny: 10, alertCooldownMinutes: 0 })
    try {
      seedTodayCost(harness.internals, 12)
      const first = await harness.service.overview()
      const firstSince = first.alerts?.[0]?.since ?? 0
      expect(harness.petCalls).toHaveLength(1)

      // Disable (clears episodes) then re-enable: the old alert is gone, so the
      // still-over-limit cost starts a fresh episode and bubbles again.
      harness.service.applyOptions({ ...BASE_OPTIONS, dailyCostLimitCny: 0 })
      const cleared = await harness.service.overview()
      expect(cleared.alerts).toEqual([])

      harness.service.applyOptions({ ...BASE_OPTIONS, dailyCostLimitCny: 10, alertCooldownMinutes: 0 })
      const again = await harness.service.overview()
      expect(again.alerts).toHaveLength(1)
      expect(again.alerts?.[0]?.since).toBeGreaterThanOrEqual(firstSince)
      expect(harness.petCalls).toHaveLength(2)
    } finally {
      await close(harness)
    }
  })

  it('rate-limits bubbles per episode key but keeps the alert active', async () => {
    const plan = provider({ provider: 'p', plan: { windows: [{ key: '5h', percent: 90 }], updatedAt: 1 } })
    const harness = await alertHarness({ planAlertPercent: 80, alertCooldownMinutes: 60 }, [plan])
    try {
      const first = await harness.service.overview()
      expect(first.alerts).toHaveLength(1)
      expect(harness.petCalls).toHaveLength(1)

      // Clear then immediately re-cross within the cooldown: the alert is
      // active again but the bubble is suppressed.
      harness.service.applyOptions({ ...BASE_OPTIONS, planAlertPercent: 0, alertCooldownMinutes: 60 })
      await harness.service.overview()
      harness.service.applyOptions({ ...BASE_OPTIONS, planAlertPercent: 80, alertCooldownMinutes: 60 })
      const again = await harness.service.overview()
      expect(again.alerts).toHaveLength(1)
      expect(harness.petCalls).toHaveLength(1)
    } finally {
      await close(harness)
    }
  })

  it('sends an empty alerts array when disabled or when thresholds are zero', async () => {
    const disabled = await alertHarness({ alertsEnabled: false, dailyCostLimitCny: 10, planAlertPercent: 80, balanceAlertCny: 10 })
    try {
      seedTodayCost(disabled.internals, 100)
      expect((await disabled.service.overview()).alerts).toEqual([])
      expect(disabled.petCalls).toHaveLength(0)
    } finally {
      await close(disabled)
    }
    const zeroed = await alertHarness({})
    try {
      seedTodayCost(zeroed.internals, 100)
      expect((await zeroed.service.overview()).alerts).toEqual([])
      expect(zeroed.petCalls).toHaveLength(0)
    } finally {
      await close(zeroed)
    }
  })

  it('keeps alerts in the payload but skips bubbles when the bubble mode is off', async () => {
    const harness = await alertHarness({ dailyCostLimitCny: 10, bubbleMode: 'off' })
    try {
      seedTodayCost(harness.internals, 12)
      const document = await harness.service.overview()
      expect(document.alerts).toHaveLength(1)
      expect(harness.petCalls).toHaveLength(0)
    } finally {
      await close(harness)
    }
  })

  it('never throws when alert facts are missing', async () => {
    const harness = await alertHarness({ dailyCostLimitCny: 10, planAlertPercent: 80, balanceAlertCny: 10 })
    try {
      const document = await harness.service.overview()
      expect(document.alerts).toEqual([])
    } finally {
      await close(harness)
    }
  })
})

describe('alert episode key', () => {
  it('keys by kind, provider, and window', () => {
    expect(alertKey('daily-cost')).toBe('daily-cost::')
    expect(alertKey('plan-threshold', 'p', '5h')).toBe('plan-threshold:p:5h')
    expect(alertKey('balance-low', 'p')).toBe('balance-low:p:')
  })
})
