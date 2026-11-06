/**
 * Wire/polling optimizations: overview row trimming, conditional GET, and
 * probe retry backoff. These guard the browser half's data contract, so they
 * assert what must SURVIVE the trim, not just what it drops.
 */
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { emptyTotals, type ProviderSnapshotState, type ProviderSnapshotView, type UsageOverviewView } from '../src/core/types.ts'
import { localDateKey } from '../src/core/ledger.ts'
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
  const route = makeUsageOverviewRoute({ overview: async () => overviewDocument } as unknown as UsageService)

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
