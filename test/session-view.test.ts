/**
 * Conversation "用量" view data path: the host folds session/event usage into
 * a live per-session map and serves it over a loopback-fenced route. These
 * tests pin both halves without a running application.
 */
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { makeUsageSessionRoute } from '../src/host/routes.ts'
import { UsageService, type UsageServiceOptions } from '../src/host/usage-service.ts'
import type { Session } from '@deepseek-ai/dsh-session'

const OPTIONS: UsageServiceOptions = {
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

/** A service whose host services are absent: every lookup degrades silently. */
function service(): UsageService {
  const ctx = { get: () => undefined, on: () => () => {} } as unknown as Context
  return new UsageService(ctx, OPTIONS)
}

/** Minimal request the loopback fence can inspect. */
function request(url: string, headers: Record<string, string> = {}, remoteAddress = '127.0.0.1'): IncomingMessage {
  return { url, socket: { remoteAddress }, headers } as unknown as IncomingMessage
}

/** Capture status, headers, and body from one route handler run. */
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

describe('session usage fold', () => {
  it('reports zero usage for a session it has never seen', () => {
    const usage = service().sessionUsage('never-seen')
    expect(usage).toEqual({ sessionId: 'never-seen', totals: expect.objectContaining({ calls: 0 }), updatedAt: 0 })
  })

  it('records the route and folds one assistant/message into that session only', () => {
    const svc = service()
    const internals = svc as unknown as {
      onSessionEvent(session: Session, event: unknown): void
    }
    const mine = { id: 'session-a' } as unknown as Session
    const other = { id: 'session-b' } as unknown as Session

    internals.onSessionEvent(mine, {
      type: 'request/header',
      data: { header: { config: { provider: 'opencode-go', model: 'deepseek-v4.1-flash' } } },
    })
    internals.onSessionEvent(mine, {
      type: 'assistant/message',
      data: { usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 1, reasoningTokens: 0 } },
    })
    internals.onSessionEvent(other, {
      type: 'assistant/message',
      data: { usage: { inputTokens: 99, outputTokens: 0 } },
    })

    const usage = svc.sessionUsage('session-a')
    expect(usage.route).toEqual({ provider: 'opencode-go', model: 'deepseek-v4.1-flash' })
    expect(usage.totals.inputTokens).toBe(10)
    expect(usage.totals.outputTokens).toBe(5)
    expect(usage.totals.cacheReadTokens).toBe(2)
    expect(usage.totals.calls).toBe(1)
    expect(usage.updatedAt).toBeGreaterThan(0)

    // The sibling session never contributed (no route seen) and stays isolated.
    expect(svc.sessionUsage('session-b').totals.calls).toBe(0)
  })
})

describe('session usage route', () => {
  it('serves the service payload for a session id', async () => {
    const route = makeUsageSessionRoute({
      sessionUsage: (id: string) => ({ sessionId: id, totals: { calls: 3 }, updatedAt: 7 }),
    } as unknown as UsageService)
    const out = response()
    await route.handler(request('/api/dsh-usage-plus/session?id=session-a', { host: '127.0.0.1:51260' }), out.res)
    expect(out.status()).toBe(200)
    expect(JSON.parse(out.body())).toMatchObject({ sessionId: 'session-a', totals: { calls: 3 } })
  })

  it('rejects a request without an id', async () => {
    const route = makeUsageSessionRoute({ sessionUsage: () => null } as unknown as UsageService)
    const out = response()
    await route.handler(request('/api/dsh-usage-plus/session', { host: '127.0.0.1:51260' }), out.res)
    expect(out.status()).toBe(400)
  })

  it('keeps the loopback fence', async () => {
    const route = makeUsageSessionRoute({ sessionUsage: () => null } as unknown as UsageService)
    const out = response()
    await route.handler(
      request('/api/dsh-usage-plus/session?id=x', { host: '127.0.0.1:51260' }, '203.0.113.9'),
      out.res,
    )
    expect(out.status()).toBe(403)
  })
})
