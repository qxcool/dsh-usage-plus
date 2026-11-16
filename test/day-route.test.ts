/**
 * Per-day drill-down route: the loopback fence, method/date validation,
 * future-date rejection, and the provider/model rows the heatmap panel
 * renders.
 */
import { describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { makeUsageDayRoute } from '../src/host/routes.ts'
import type { UsageService } from '../src/host/usage-service.ts'
import type { UsageDayDetail } from '../src/core/types.ts'

function request(url: string, method = 'GET', headers: Record<string, string> = { host: '127.0.0.1:53215' }, remoteAddress = '127.0.0.1'): IncomingMessage {
  return { url, method, headers, socket: { remoteAddress } } as unknown as IncomingMessage
}

function response(): { res: ServerResponse; status: () => number; body: () => string } {
  const state = { status: 0, body: '' }
  const res = {
    writeHead(status: number) {
      state.status = status
      return res
    },
    end(body?: string) {
      state.body = body ?? ''
    },
  }
  return { res: res as unknown as ServerResponse, status: () => state.status, body: () => state.body }
}

function detail(date: string): UsageDayDetail {
  return {
    date,
    totals: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, calls: 1, cost: 0.1 },
    providers: [{ provider: 'deepseek', totals: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, calls: 1, cost: 0.1 }, models: [{ model: 'deepseek-chat', totals: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, calls: 1, cost: 0.1 } }] }],
  }
}

describe('day drill-down route', () => {
  const service = { dayDetail: (date: string) => detail(date) } as unknown as UsageService
  const route = makeUsageDayRoute(service)

  it('fences non-loopback requests', async () => {
    const out = response()
    await route.handler(request('/api/dsh-usage-plus/day?date=2026-11-15', 'GET', { host: '127.0.0.1:53215' }, '203.0.113.9'), out.res)
    expect(out.status()).toBe(403)
  })

  it('rejects non-GET methods', async () => {
    const out = response()
    await route.handler(request('/api/dsh-usage-plus/day?date=2026-11-15', 'POST'), out.res)
    expect(out.status()).toBe(405)
  })

  it('rejects a missing or malformed date', async () => {
    for (const url of [
      '/api/dsh-usage-plus/day',
      '/api/dsh-usage-plus/day?date=',
      '/api/dsh-usage-plus/day?date=2026-1-1',
      '/api/dsh-usage-plus/day?date=2026-11-15T00',
      '/api/dsh-usage-plus/day?date=abc',
    ]) {
      const out = response()
      await route.handler(request(url), out.res)
      expect(out.status(), url).toBe(400)
    }
  })

  it('rejects a future date', async () => {
    const out = response()
    await route.handler(request('/api/dsh-usage-plus/day?date=2999-01-01'), out.res)
    expect(out.status()).toBe(400)
  })

  it('returns the provider/model rows for a valid past date', async () => {
    const out = response()
    await route.handler(request('/api/dsh-usage-plus/day?date=2026-11-15'), out.res)
    expect(out.status()).toBe(200)
    const payload = JSON.parse(out.body()) as UsageDayDetail
    expect(payload.date).toBe('2026-11-15')
    expect(payload.providers[0]?.provider).toBe('deepseek')
    expect(payload.providers[0]?.models[0]?.model).toBe('deepseek-chat')
    expect(payload.totals.cost).toBeCloseTo(0.1)
  })
})
