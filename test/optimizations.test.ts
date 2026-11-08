/**
 * Wire/polling optimizations: overview row trimming, conditional GET, and
 * probe retry backoff. These guard the browser half's data contract, so they
 * assert what must SURVIVE the trim, not just what it drops.
 */
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { emptyTotals, type ProviderSnapshotState, type ProviderSnapshotView, type UsageLedgerDocument, type UsageOverviewView, type UsageTokenTotals } from '../src/core/types.ts'
import { foldUsage, localDateKey, summarizeDays, summarizeDayTotals, summarizeProviderTotals } from '../src/core/ledger.ts'
import { jsonEtag } from '../src/host/http.ts'
import { makeUsageOverviewRoute, requestEtagMatches } from '../src/host/routes.ts'
import { probeBackoffDelayMs, selectOverviewProviders, UsageService, type UsageServiceOptions } from '../src/host/usage-service.ts'

/** A provider row with the defaults a catalog-only route would carry. */
function row(overrides: Partial<ProviderSnapshotView>): ProviderSnapshotView {
  return { provider: 'route', displayName: 'Route', credential: 'none', supported: false, ...overrides }
}

describe('selectOverviewProviders', () => {
  const rows: ProviderSnapshotView[] = [
    row({ provider: 'catalog-empty' }),
    row({ provider: 'supported-unconfigured', supported: true, planSupported: true }),
    row({ provider: 'configured', credential: 'env', supported: true, planSupported: true }),
    row({ provider: 'with-plan', plan: { windows: [{ key: '5h', percent: 12 }], updatedAt: 1 } }),
    row({ provider: 'with-balance', balance: { currency: 'CNY', totalBalance: '3.00', updatedAt: 1 } }),
    row({ provider: 'with-error', error: 'HTTP 401' }),
    row({ provider: 'current-route' }),
    row({ provider: 'used-route' }),
    row({ provider: 'volcano:ark-plan', source: 'volcano', supported: true }),
  ]

  const kept = selectOverviewProviders(rows, {
    usageProviders: new Set(['used-route']),
    currentProvider: 'current-route',
  })

  it('drops empty catalog rows', () => {
    const names = kept.map((entry) => entry.provider)
    expect(names).not.toContain('catalog-empty')
    expect(names).not.toContain('supported-unconfigured')
  })

  it('keeps every row a surface renders', () => {
    const names = kept.map((entry) => entry.provider)
    expect(names).toEqual([
      'configured',
      'with-plan',
      'with-balance',
      'with-error',
      'current-route',
      'used-route',
      'volcano:ark-plan',
    ])
  })

  it('keeps every row when there is nothing to trim', () => {
    expect(selectOverviewProviders([row({ provider: 'only' })], { usageProviders: new Set(['only']) })).toHaveLength(1)
  })
})

describe('probeBackoffDelayMs', () => {
  it('probes normally with no recorded failures', () => {
    expect(probeBackoffDelayMs(0)).toBe(0)
    expect(probeBackoffDelayMs(-1)).toBe(0)
    expect(probeBackoffDelayMs(Number.NaN)).toBe(0)
  })

  it('grows 1m → 5m → 15m and then caps', () => {
    expect(probeBackoffDelayMs(1)).toBe(60_000)
    expect(probeBackoffDelayMs(2)).toBe(300_000)
    expect(probeBackoffDelayMs(3)).toBe(900_000)
    expect(probeBackoffDelayMs(9)).toBe(900_000)
  })
})

describe('jsonEtag', () => {
  const document = { updatedAt: 1_000, providers: [{ provider: 'a' }], usage: { today: { totals: 1 } } }

  it('ignores the volatile updatedAt so polling can revalidate', () => {
    expect(jsonEtag(document)).toBe(jsonEtag({ ...document, updatedAt: 9_999 }))
  })

  it('changes when any rendered value changes', () => {
    expect(jsonEtag(document)).not.toBe(jsonEtag({ ...document, usage: { today: { totals: 2 } } }))
  })

  it('is a quoted strong validator', () => {
    expect(jsonEtag(document)).toMatch(/^"[A-Za-z0-9_-]{27}"$/)
  })
})

describe('requestEtagMatches', () => {
  const etag = '"abc"'

  it('matches an exact validator', () => {
    expect(requestEtagMatches(etag, etag)).toBe(true)
  })

  it('matches a weak validator and a list member', () => {
    expect(requestEtagMatches('W/"abc"', etag)).toBe(true)
    expect(requestEtagMatches('"other", "abc"', etag)).toBe(true)
  })

  it('matches the wildcard', () => {
    expect(requestEtagMatches('*', etag)).toBe(true)
  })

  it('rejects a different validator', () => {
    expect(requestEtagMatches('"nope"', etag)).toBe(false)
    expect(requestEtagMatches('', etag)).toBe(false)
  })
})

/** Minimal request the loopback fence can inspect. */
function request(headers: Record<string, string>, remoteAddress = '127.0.0.1'): IncomingMessage {
  return { socket: { remoteAddress }, headers } as unknown as IncomingMessage
}

/** Capture status, headers, and body from one route handler run. */
function response(): { res: ServerResponse; status: () => number; headers: () => Record<string, unknown>; body: () => string } {
  const state = { status: 0, headers: {} as Record<string, unknown>, body: '' }
  const res = {
    writeHead(status: number, headers: Record<string, unknown>) {
      state.status = status
      state.headers = headers
      return res
    },
    end(body?: string) {
      state.body = body ?? ''
    },
  }
  return {
    res: res as unknown as ServerResponse,
    status: () => state.status,
    headers: () => state.headers,
    body: () => state.body,
  }
}

const overviewDocument: UsageOverviewView = {
  updatedAt: 1,
  providers: [],
  current: { source: 'default' },
  usage: { today: { date: '2026-11-05', totals: emptyTotals(), providers: [] }, days: [] },
}

describe('overview route conditional GET', () => {
  const route = makeUsageOverviewRoute({
    overviewPayload: async () => ({ document: overviewDocument, etag: jsonEtag(overviewDocument) }),
  } as unknown as UsageService)

  it('answers 200 with an ETag', async () => {
    const out = response()
    await route.handler(request({ host: '127.0.0.1:53215' }), out.res)
    expect(out.status()).toBe(200)
    expect(out.headers()['etag']).toBe(jsonEtag(overviewDocument))
    expect(JSON.parse(out.body())).toMatchObject({ updatedAt: 1 })
  })

  it('answers 304 without a body when the client revalidates', async () => {
    const out = response()
    const etag = jsonEtag(overviewDocument) as string
    await route.handler(request({ host: '127.0.0.1:53215', 'if-none-match': etag }), out.res)
    expect(out.status()).toBe(304)
    expect(out.headers()['etag']).toBe(etag)
    expect(out.body()).toBe('')
  })

  it('answers a full body for a stale validator', async () => {
    const out = response()
    await route.handler(request({ host: '127.0.0.1:53215', 'if-none-match': '"stale"' }), out.res)
    expect(out.status()).toBe(200)
    expect(out.body().length).toBeGreaterThan(0)
  })

  it('keeps the loopback fence in front of the cache', async () => {
    const out = response()
    await route.handler(request({ host: '127.0.0.1:53215' }, '203.0.113.7'), out.res)
    expect(out.status()).toBe(403)
  })
})

describe('overview provider trimming (wiring)', () => {
  const options: UsageServiceOptions = {
    pollIntervalSec: 60,
    bubbleMode: 'off',
    retainDays: 182,
    cpamcEnabled: false,
    cpamcBaseURL: 'http://127.0.0.1:8317',
    cpamcManagementKeyEnv: 'CPAMC_MANAGEMENT_KEY',
    cpamcAllowedHosts: '',
    volcanoEnabled: false,
    volcanoAccessKeyEnv: 'VOLC_ACCESSKEY',
    volcanoSecretKeyEnv: 'VOLC_SECRETKEY',
  }

  /** A service whose runtime knows three routes and whose probes already ran. */
  function seededService(): UsageService {
    const ctx = {
      get: (name: string) => name === 'llm'
        ? {
            listProviders: () => [
              { id: 'openai', name: 'OpenAI' },
              { id: 'opencode-go', name: 'opencode-go' },
              { id: 'volcengine', name: 'Volcengine' },
            ],
            listConfigurableProviders: () => [],
          }
        : undefined,
      on: () => () => {},
    } as unknown as Context
    const service = new UsageService(ctx, options)
    const internals = service as unknown as {
      snapshots: Map<string, ProviderSnapshotState>
      ledger: { version: 1; days: Record<string, Record<string, Record<string, ReturnType<typeof emptyTotals>>>> }
      current: { provider?: string; model?: string; source: 'live' | 'default' }
      loaded: boolean
    }
    const dayKey = localDateKey(Date.now())
    internals.ledger = {
      version: 1,
      days: { [dayKey]: { volcengine: { 'deepseek-v4': { ...emptyTotals(), inputTokens: 12, calls: 1 } } } },
    }
    internals.snapshots.set('opencode-go', {
      provider: 'opencode-go',
      displayName: 'opencode-go',
      credential: 'env',
      supported: true,
      plan: { windows: [{ key: '5h', percent: 10 }], updatedAt: 1 },
    })
    internals.current = { provider: 'volcengine', model: 'deepseek-v4', source: 'live' }
    internals.loaded = true
    return service
  }

  it('drops catalog-only rows and keeps fact/usage/current rows', async () => {
    const document = await seededService().overview()
    const names = document.providers.map((entry) => entry.provider)
    expect(names).not.toContain('openai')
    expect(names).toEqual(['opencode-go', 'volcengine'])
    expect(document.usage.today.totals.inputTokens).toBe(12)
  })
})

// ---------------------------------------------------------------------------
// Revision-cached overview (host perf)
// ---------------------------------------------------------------------------

const PERF_PROVIDERS = ['provider-a', 'provider-b'] as const
const PERF_MODELS = ['model-1', 'model-2', 'model-3'] as const

const PERF_OPTIONS: UsageServiceOptions = {
  pollIntervalSec: 60,
  bubbleMode: 'off',
  retainDays: 182,
  cpamcEnabled: false,
  cpamcBaseURL: 'http://127.0.0.1:8317',
  cpamcManagementKeyEnv: 'CPAMC_MANAGEMENT_KEY',
  cpamcAllowedHosts: '',
  volcanoEnabled: false,
  volcanoAccessKeyEnv: 'VOLC_ACCESSKEY',
  volcanoSecretKeyEnv: 'VOLC_SECRETKEY',
}

/**
 * A deterministic ledger: `days` trailing local days ending today, each with
 * every provider × model bucket. Values vary by position so ordering and
 * totals are exercised, but are identical on every run.
 */
function buildPerfLedger(days: number): UsageLedgerDocument {
  const document: UsageLedgerDocument = { version: 1, days: {} }
  const now = new Date()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 12, 0, 0)
    for (const [providerIndex, provider] of PERF_PROVIDERS.entries()) {
      for (const [modelIndex, model] of PERF_MODELS.entries()) {
        const totals: UsageTokenTotals = {
          ...emptyTotals(),
          inputTokens: 1000 + offset * 7 + providerIndex * 11 + modelIndex * 13,
          outputTokens: 200 + offset * 3 + providerIndex * 5 + modelIndex * 7,
          cacheReadTokens: 50 + offset,
          cacheWriteTokens: 10,
          reasoningTokens: 20,
          calls: 1 + (offset % 4),
        }
        foldUsage(document, at.getTime(), provider, model, totals)
      }
    }
  }
  return document
}

/** Private-state view a test legitimately needs to seed the ledger/snapshots. */
interface PerfServiceInternals {
  ledger: UsageLedgerDocument
  snapshots: Map<string, ProviderSnapshotState>
  current: { provider?: string; model?: string; source: 'live' | 'default' }
  loaded: boolean
  revision: number
  ledgerRevision: number
  onSessionEvent(session: unknown, event: unknown): void
}

interface PerfHarness {
  service: UsageService
  internals: PerfServiceInternals
  counters: { llmLists: number; credentialDescribes: number }
}

/** A service over a 182-day, 2-provider × 3-model ledger with counting stubs. */
function perfHarness(options: Partial<UsageServiceOptions> = {}, ledgerDays = 182): PerfHarness {
  const counters = { llmLists: 0, credentialDescribes: 0 }
  const ctx = {
    get: (name: string) => {
      if (name === 'llm') {
        return {
          listProviders: () => {
            counters.llmLists += 1
            return PERF_PROVIDERS.map((id) => ({ id, name: id }))
          },
          listConfigurableProviders: () => [],
        }
      }
      if (name === 'credentials') {
        return {
          describe: async () => {
            counters.credentialDescribes += 1
            return { configured: true }
          },
        }
      }
      return undefined
    },
    on: () => () => {},
  } as unknown as Context
  const service = new UsageService(ctx, { ...PERF_OPTIONS, ...options })
  const internals = service as unknown as PerfServiceInternals
  internals.ledger = buildPerfLedger(ledgerDays)
  internals.current = { provider: 'provider-a', model: 'model-1', source: 'live' }
  internals.loaded = false
  for (const provider of PERF_PROVIDERS) {
    internals.snapshots.set(provider, {
      provider,
      displayName: provider,
      credential: 'env',
      supported: true,
      balanceSupported: true,
      planSupported: true,
      balance: { currency: 'CNY', totalBalance: '12.34', updatedAt: 1 },
      plan: { windows: [{ key: '5h', percent: 12 }, { key: 'week', percent: 33 }], updatedAt: 1 },
      updatedAt: 1,
    })
  }
  return { service, internals, counters }
}

/** Let a millisecond pass so a refreshed `updatedAt` is observable. */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 2)
  })
}

describe('ledger aggregation helpers', () => {
  const ledger = buildPerfLedger(5)

  it('summarizes provider totals exactly like the full summary, without model rows', () => {
    const days = Object.values(ledger.days)
    const full = summarizeDays(days)
    const lite = summarizeProviderTotals(days)
    expect(lite.totals).toEqual(full.totals)
    expect(lite.providers).toEqual(full.providers.map(({ provider, totals }) => ({ provider, totals })))
  })

  it('precomputes per-day totals equal to a per-day full summary', () => {
    const dayKeys = Object.keys(ledger.days).sort()
    const totals = summarizeDayTotals(ledger, dayKeys)
    for (const date of dayKeys) {
      expect(totals.get(date)).toEqual(summarizeDays([ledger.days[date] ?? {}]).totals)
    }
    expect(totals.get('2000-01-01')).toBeUndefined()
  })
})

describe('revision-cached overview', () => {
  it('serves the same document instance while nothing changed', async () => {
    const { service } = perfHarness()
    try {
      const first = await service.overview()
      const stamp = first.updatedAt
      await settle()
      const second = await service.overview()
      // Same revision: no re-assembly, only the updatedAt stamp moves.
      expect(second).toBe(first)
      expect(second.updatedAt).toBeGreaterThanOrEqual(stamp)
    } finally {
      await service.stop()
    }
  })

  it('keeps the ETag stable when only updatedAt moves', async () => {
    const { service } = perfHarness()
    try {
      const first = await service.overviewPayload()
      const stamp = first.document.updatedAt
      await settle()
      const second = await service.overviewPayload()
      expect(second.document).toBe(first.document)
      expect(second.etag).toBe(first.etag)
      expect(second.document.updatedAt).toBeGreaterThanOrEqual(stamp)
      expect(second.etag).toMatch(/^"[A-Za-z0-9_-]{27}"$/)
    } finally {
      await service.stop()
    }
  })

  it('invalidates the cached document when a session fold lands', async () => {
    const { service, internals } = perfHarness()
    try {
      const before = await service.overview()
      const callsBefore = before.usage.today.totals.calls
      const inputBefore = before.usage.today.totals.inputTokens
      const revisionBefore = internals.revision
      const session = { id: 'session-1' }
      internals.onSessionEvent(session, {
        type: 'request/header',
        data: { header: { config: { provider: 'provider-a', model: 'model-1' } } },
      })
      internals.onSessionEvent(session, {
        type: 'assistant/message',
        data: { usage: { inputTokens: 5, outputTokens: 7 } },
      })
      expect(internals.revision).toBeGreaterThan(revisionBefore)
      const after = await service.overview()
      expect(after).not.toBe(before)
      expect(internals.ledgerRevision).toBeGreaterThan(0)
      expect(after.usage.today.totals.calls).toBe(callsBefore + 1)
      expect(after.usage.today.totals.inputTokens).toBe(inputBefore + 5)
    } finally {
      await service.stop()
    }
  })

  it('reuses the provider route list and credential flags across a revision bump', async () => {
    const { service, internals, counters } = perfHarness()
    try {
      const first = await service.overview()
      // One route-registry read and three credential describes per cold assembly.
      expect(counters.llmLists).toBe(1)
      expect(counters.credentialDescribes).toBe(3)
      const session = { id: 'session-2' }
      internals.onSessionEvent(session, {
        type: 'request/header',
        data: { header: { config: { provider: 'provider-a', model: 'model-1' } } },
      })
      internals.onSessionEvent(session, {
        type: 'assistant/message',
        data: { usage: { inputTokens: 1, outputTokens: 1 } },
      })
      const second = await service.overview()
      // The document is rebuilt, but the short-TTL caches still answer.
      expect(second).not.toBe(first)
      expect(counters.llmLists).toBe(1)
      expect(counters.credentialDescribes).toBe(3)
    } finally {
      await service.stop()
    }
  })

  it('serves a warm 182-day overview without re-summarizing the ledger', async () => {
    const { service, internals } = perfHarness()
    try {
      const warm = await service.overviewPayload()
      const usage = warm.document.usage
      expect(usage.days).toHaveLength(182)
      expect(usage.range).toBeDefined()
      expect(usage.all).toBeDefined()
      expect(usage.range?.from).toBe(usage.days[152]?.date)
      // All-time window: provider totals only (no per-model rows).
      const expectedAll = summarizeDays(Object.values(internals.ledger.days))
      expect(usage.all?.totals).toEqual(expectedAll.totals)
      expect(usage.all?.providers.map((row) => ({ provider: row.provider, totals: row.totals })))
        .toEqual(expectedAll.providers.map(({ provider, totals }) => ({ provider, totals })))
      expect(usage.all?.providers.every((row) => row.models.length === 0)).toBe(true)

      const iterations = 50
      const start = performance.now()
      for (let index = 0; index < iterations; index += 1) await service.overviewPayload()
      const perCallMs = (performance.now() - start) / iterations
      // Generous CI bound: the observed warm path is ~0.02ms; anything close to
      // this bound means the derived cache regressed to a full re-aggregation.
      expect(perCallMs).toBeLessThan(15)
    } finally {
      await service.stop()
    }
  })

  it('rebuilds the windows when retention shrinks', async () => {
    const { service } = perfHarness()
    try {
      const before = await service.overview()
      expect(before.usage.days).toHaveLength(182)
      service.applyOptions({ ...PERF_OPTIONS, retainDays: 30 })
      const after = await service.overview()
      expect(after).not.toBe(before)
      expect(after.usage.days).toHaveLength(30)
      expect(after.usage.range?.from).toBe(after.usage.days[0]?.date)
      // The pruned ledger keeps one more day than the 30-day windows.
      expect((after.usage.all?.from ?? '') <= (after.usage.days[0]?.date ?? '')).toBe(true)
    } finally {
      await service.stop()
    }
  })

  it('answers 304 from the cached ETag without rebuilding the document', async () => {
    const { service } = perfHarness()
    try {
      const route = makeUsageOverviewRoute(service)
      const first = response()
      await route.handler(request({ host: '127.0.0.1:53215' }), first.res)
      expect(first.status()).toBe(200)
      const etag = String(first.headers()['etag'])
      expect(etag).toMatch(/^"[A-Za-z0-9_-]{27}"$/)
      await settle()
      const second = response()
      await route.handler(request({ host: '127.0.0.1:53215', 'if-none-match': etag }), second.res)
      expect(second.status()).toBe(304)
      expect(second.headers()['etag']).toBe(etag)
      expect(second.body()).toBe('')
    } finally {
      await service.stop()
    }
  })
})
