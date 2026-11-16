import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import {
  PLATFORM_ORIGIN,
  fetchPlatformUsage,
  normalizePlatformCostDays,
  normalizePlatformSummary,
  type PlatformUsageOptions,
} from '../src/host/platform-usage.ts'

/** Deterministic "now" for month/year/updatedAt assertions (local noon). */
const FIXED_NOW = new Date(2026, 10, 16, 12, 0, 0).getTime()

const SUMMARY_BODY = {
  code: 0,
  msg: 'ok',
  data: {
    biz_data: {
      normal_wallets: [{ currency: 'CNY', balance: '9.99' }],
      bonus_wallets: [],
      total_costs: [{ currency: 'CNY', amount: '123.456789' }],
    },
  },
}

const COST_BODY = {
  code: 0,
  data: {
    biz_data: [
      {
        currency: 'CNY',
        total: '3.5',
        days: [
          { date: '2026-11-02', cost: '1.25' },
          { date: '2026-11-15', cost: '1.75' },
          { date: '2026-11-01', cost: '0.5' },
        ],
      },
    ],
  },
}

const GRANT_RECORD = { kind: 'grant', payload: { token: 'stored-platform-token', userId: 'user-1' } }

interface FetchCall {
  url: string
  init?: RequestInit
}

type FetchHandler = (url: string, init: RequestInit | undefined, call: number) => Response | Promise<Response>

function mockFetch(handler: FetchHandler): { fetch: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push({ url, ...(init !== undefined ? { init } : {}) })
    return handler(url, init, calls.length - 1)
  }) as typeof fetch
  return { fetch: impl, calls }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** Happy-path fetch: summary then cost, keyed off the request path. */
function successFetch(): { fetch: typeof fetch; calls: FetchCall[] } {
  return mockFetch((url) => (url.includes('get_user_summary') ? jsonResponse(SUMMARY_BODY) : jsonResponse(COST_BODY)))
}

interface TestContextOptions {
  record?: unknown
  session?: unknown
  recordThrows?: boolean
  sessionThrows?: boolean
  readRecordKeys?: unknown[]
}

function testContext(options: TestContextOptions = {}): Context {
  const credentials = {
    readRecord: async (key: unknown): Promise<unknown> => {
      options.readRecordKeys?.push(key)
      if (options.recordThrows === true) throw new Error('credentials unavailable')
      return options.record
    },
  }
  const account = {
    getPlatformSession: async (): Promise<unknown> => {
      if (options.sessionThrows === true) throw new Error('account unavailable')
      return options.session ?? null
    },
  }
  return {
    get(name: string): unknown {
      if (name === 'credentials') return credentials
      if (name === 'deepseekAccount') return account
      return undefined
    },
  } as never
}

function emptyContext(): Context {
  return { get: (): unknown => undefined } as never
}

function run(options: PlatformUsageOptions, ctx: Context = emptyContext()): ReturnType<typeof fetchPlatformUsage> {
  return fetchPlatformUsage(ctx, { now: () => FIXED_NOW, retryDelayMs: 0, ...options })
}

describe('fetchPlatformUsage ready path', () => {
  it('normalizes a summary + cost success into official CNY facts', async () => {
    const mock = successFetch()
    const result = await run({ fetch: mock.fetch }, testContext({ record: GRANT_RECORD }))

    expect(result).toEqual({
      status: 'ready',
      currency: 'CNY',
      monthCost: 3.5,
      cumulativeCost: 123.456789,
      days: [
        { date: '2026-11-01', cost: 0.5 },
        { date: '2026-11-02', cost: 1.25 },
        { date: '2026-11-15', cost: 1.75 },
      ],
      updatedAt: FIXED_NOW,
    })
  })

  it('sends the platform headers and the month/year query at the console origin', async () => {
    const mock = successFetch()
    await run({ fetch: mock.fetch }, testContext({ record: GRANT_RECORD }))

    expect(mock.calls).toHaveLength(2)
    const summaryUrl = new URL(mock.calls[0]?.url ?? '')
    expect(summaryUrl.origin).toBe(PLATFORM_ORIGIN)
    expect(summaryUrl.pathname).toBe('/api/v0/users/get_user_summary')
    const costUrl = new URL(mock.calls[1]?.url ?? '')
    expect(costUrl.pathname).toBe('/api/v0/usage/cost')
    expect(costUrl.searchParams.get('month')).toBe('11')
    expect(costUrl.searchParams.get('year')).toBe('2026')

    const headers = mock.calls[0]?.init?.headers as Record<string, string>
    expect(headers['x-dsh-auth-token']).toBe('stored-platform-token')
    expect(headers.accept).toBe('application/json, text/plain, */*')
    expect(headers['x-app-version']).toBe('0.1.0')
    expect(headers['user-agent']).toContain('Chrome/')
    expect(headers.origin).toBe(PLATFORM_ORIGIN)
    expect(headers.referer).toBe(`${PLATFORM_ORIGIN}/usage`)
    expect(mock.calls[0]?.init?.redirect).toBe('manual')
    expect(mock.calls[0]?.init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('reads the token from the live deepseekAccount session before the stored grant', async () => {
    const mock = successFetch()
    const readRecordKeys: unknown[] = []
    const session = { origin: 'https://console.example.test', token: 'session-token', userId: 'user-1' }
    await run({ fetch: mock.fetch }, testContext({ session, record: GRANT_RECORD, readRecordKeys }))

    expect(readRecordKeys).toHaveLength(0)
    const headers = mock.calls[0]?.init?.headers as Record<string, string>
    expect(headers['x-dsh-auth-token']).toBe('session-token')
    expect(headers.origin).toBe('https://console.example.test')
    expect(new URL(mock.calls[0]?.url ?? '').origin).toBe('https://console.example.test')
  })

  it('falls back to the stored deepseek-account-platform/default grant record', async () => {
    const mock = successFetch()
    const readRecordKeys: unknown[] = []
    await run({ fetch: mock.fetch }, testContext({ record: GRANT_RECORD, readRecordKeys }))

    expect(String(readRecordKeys[0])).toBe('deepseek-account-platform/default')
    const headers = mock.calls[0]?.init?.headers as Record<string, string>
    expect(headers['x-dsh-auth-token']).toBe('stored-platform-token')
  })

  it('accepts injected month/year and custom UA/app-version options', async () => {
    const costMarch = {
      code: 0,
      data: {
        biz_data: [
          { days: [{ date: '2025-03-04', cost: '2.5' }, { date: '2026-11-04', cost: '9' }] },
        ],
      },
    }
    const fetchMarch = mockFetch((url) => (url.includes('get_user_summary') ? jsonResponse(SUMMARY_BODY) : jsonResponse(costMarch)))
    const result = await run(
      { fetch: fetchMarch.fetch, month: 3, year: 2025, userAgent: 'test-agent', appVersion: '9.9.9' },
      testContext({ record: GRANT_RECORD }),
    )

    const costUrl = new URL(fetchMarch.calls[1]?.url ?? '')
    expect(costUrl.searchParams.get('month')).toBe('3')
    expect(costUrl.searchParams.get('year')).toBe('2025')
    const headers = fetchMarch.calls[0]?.init?.headers as Record<string, string>
    expect(headers['user-agent']).toBe('test-agent')
    expect(headers['x-app-version']).toBe('9.9.9')
    expect(result.days).toEqual([{ date: '2025-03-04', cost: 2.5 }])
    expect(result.monthCost).toBe(2.5)
  })
})

describe('fetchPlatformUsage degradation', () => {
  it('returns unavailable without any network call when no token is resolvable', async () => {
    const mock = successFetch()
    const result = await run({ fetch: mock.fetch }, testContext())

    expect(result).toEqual({ status: 'unavailable', currency: 'CNY', updatedAt: FIXED_NOW })
    expect(result.error).toBeUndefined()
    expect(mock.calls).toHaveLength(0)
  })

  it('returns unavailable when the credential service is absent entirely', async () => {
    const mock = successFetch()
    const result = await run({ fetch: mock.fetch }, emptyContext())

    expect(result.status).toBe('unavailable')
    expect(mock.calls).toHaveLength(0)
  })

  it('returns unavailable when every token source throws', async () => {
    const mock = successFetch()
    const result = await run({ fetch: mock.fetch }, testContext({ recordThrows: true, sessionThrows: true }))

    expect(result.status).toBe('unavailable')
    expect(mock.calls).toHaveLength(0)
  })

  it('maps HTTP 401 to a short expired-session error without leaking the token', async () => {
    const mock = mockFetch(() => jsonResponse({ code: 401 }, 401))
    const result = await run({ fetch: mock.fetch }, testContext({ record: GRANT_RECORD }))

    expect(result.status).toBe('error')
    expect(result.error).toBe('platform session expired')
    expect(JSON.stringify(result)).not.toContain('stored-platform-token')
    expect(mock.calls).toHaveLength(1)
  })

  it('maps an envelope auth code (40003) to the expired-session error', async () => {
    const mock = mockFetch(() => jsonResponse({ code: 40003, msg: 'token expired' }))
    const result = await run({ fetch: mock.fetch }, testContext({ record: GRANT_RECORD }))

    expect(result.status).toBe('error')
    expect(result.error).toBe('platform session expired')
  })

  it('returns an error state on malformed JSON instead of throwing', async () => {
    const mock = mockFetch(() => new Response('not json at all', { status: 200 }))
    const result = await run({ fetch: mock.fetch }, testContext({ record: GRANT_RECORD }))

    expect(result.status).toBe('error')
    expect(result.error).toBe('platform response was not valid JSON')
    expect(result.updatedAt).toBe(FIXED_NOW)
  })

  it('returns an error state when the network rejects', async () => {
    const mock = mockFetch(() => Promise.reject(new TypeError('fetch failed')))
    const result = await run({ fetch: mock.fetch }, testContext({ record: GRANT_RECORD }))

    expect(result.status).toBe('error')
    expect(result.error).toBe('platform request failed')
  })

  it('labels a timeout distinctly', async () => {
    const mock = mockFetch(() => {
      const error = new Error('operation timed out')
      error.name = 'TimeoutError'
      return Promise.reject(error)
    })
    const result = await run({ fetch: mock.fetch }, testContext({ record: GRANT_RECORD }))

    expect(result.status).toBe('error')
    expect(result.error).toBe('platform request timed out')
  })

  it('retries a 429 once, then succeeds', async () => {
    let summaryAttempts = 0
    const mock = mockFetch((url) => {
      if (url.includes('get_user_summary')) {
        summaryAttempts += 1
        return summaryAttempts === 1 ? jsonResponse({ code: 0 }, 429) : jsonResponse(SUMMARY_BODY)
      }
      return jsonResponse(COST_BODY)
    })
    const result = await run({ fetch: mock.fetch }, testContext({ record: GRANT_RECORD }))

    expect(summaryAttempts).toBe(2)
    expect(mock.calls).toHaveLength(3)
    expect(result.status).toBe('ready')
    expect(result.monthCost).toBe(3.5)
  })

  it('retries a 5xx once and then reports the HTTP error', async () => {
    const mock = mockFetch(() => jsonResponse({ code: 0 }, 500))
    const result = await run({ fetch: mock.fetch }, testContext({ record: GRANT_RECORD }))

    expect(mock.calls).toHaveLength(2)
    expect(result.status).toBe('error')
    expect(result.error).toBe('platform HTTP 500')
  })

  it('never throws even for an unexpected non-Error rejection', async () => {
    const mock = mockFetch(() => Promise.reject('weird upstream failure'))
    const result = await run({ fetch: mock.fetch }, testContext({ record: GRANT_RECORD }))

    expect(result.status).toBe('error')
    expect(result.error).toBe('platform request failed')
  })
})

describe('official day/month boundaries', () => {
  it('drops rows outside the current local month and sums the rest', async () => {
    const body = {
      code: 0,
      data: {
        biz_data: [
          {
            days: [
              { date: '2026-10-31', cost: '10' },
              { date: '2026-11-01', cost: '0.1' },
              { date: '2026-11-16', cost: '0.2' },
              { date: '2026-12-01', cost: '20' },
            ],
          },
        ],
      },
    }
    const mock = mockFetch((url) => (url.includes('get_user_summary') ? jsonResponse(SUMMARY_BODY) : jsonResponse(body)))
    const result = await run({ fetch: mock.fetch }, testContext({ record: GRANT_RECORD }))

    expect(result.days).toEqual([
      { date: '2026-11-01', cost: 0.1 },
      { date: '2026-11-16', cost: 0.2 },
    ])
    expect(result.monthCost).toBe(0.3)
  })
})

describe('normalizePlatformCostDays', () => {
  it('accepts a bare array, string amounts, duplicates and unsorted rows', () => {
    const days = normalizePlatformCostDays([
      { date: '2026-11-02', cost: '0.1' },
      { date: '2026-11-01', amount: '2' },
      { date: '2026-11-02', total: '0.2' },
      { date: 'not-a-date', cost: '5' },
      { date: '2026-11-03', cost: 'oops' },
    ])

    expect(days).toEqual([
      { date: '2026-11-01', cost: 2 },
      { date: '2026-11-02', cost: 0.3 },
    ])
  })

  it('unwraps a JSON-string biz_data envelope', () => {
    const days = normalizePlatformCostDays({
      code: 0,
      data: { biz_data: JSON.stringify([{ date: '2026-11-05', cost: '1.5' }]) },
    })

    expect(days).toEqual([{ date: '2026-11-05', cost: 1.5 }])
  })

  it('resolves bare day-of-month rows with the supplied month/year', () => {
    const days = normalizePlatformCostDays(
      { data: { biz_data: [{ days: [{ day: 3, cost: '1.5' }, { day: '5', total: '2' }, { day: 40, cost: '9' }] }] } },
      { month: 11, year: 2026 },
    )

    expect(days).toEqual([
      { date: '2026-11-03', cost: 1.5 },
      { date: '2026-11-05', cost: 2 },
    ])
  })

  it('filters other months when the period is supplied and tolerates drift keys', () => {
    const days = normalizePlatformCostDays(
      {
        data: {
          biz_data: [
            { stat_date: '2026/3/4', fee: '1.25' },
            { dateStr: '2026-04-01', spend: '2' },
            { timestamp: Date.UTC(2026, 2, 9, 12), value: '3' },
          ],
        },
      },
      { month: 3, year: 2026 },
    )

    expect(days).toEqual([
      { date: '2026-03-04', cost: 1.25 },
      { date: '2026-03-09', cost: 3 },
    ])
  })
})

describe('normalizePlatformSummary', () => {
  it('sums CNY total_costs and ignores other currencies', () => {
    const facts = normalizePlatformSummary({
      data: {
        biz_data: {
          total_costs: [
            { currency: 'CNY', amount: '100.5' },
            { currency: 'USD', amount: '4' },
            { currency: 'CNY', amount: 0.25 },
          ],
        },
      },
    })

    expect(facts).toEqual({ cumulativeCost: 100.75 })
  })

  it('unwraps a JSON-string biz_data payload and plain scalar totals', () => {
    expect(normalizePlatformSummary({ data: { biz_data: JSON.stringify({ total_costs: [{ amount: '6.5' }] }) } }))
      .toEqual({ cumulativeCost: 6.5 })
    expect(normalizePlatformSummary({ data: { biz_data: { total_cost: '7' } } }))
      .toEqual({ cumulativeCost: 7 })
    expect(normalizePlatformSummary({ data: { biz_data: {} } })).toEqual({})
  })
})
