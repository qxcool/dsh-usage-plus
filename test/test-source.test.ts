/**
 * External-source connection test: the loopback-fenced `/test` route and the
 * host-side CPAMC probe diagnostics used by the Settings "test connection"
 * button. All network calls are mocked; no live CPAMC is required.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { describeExternalFetchError } from '../src/host/external-sources.ts'
import { makeUsageTestRoute } from '../src/host/routes.ts'
import { UsageService, type UsageServiceOptions } from '../src/host/usage-service.ts'

const BASE_OPTIONS: UsageServiceOptions = {
  pollIntervalSec: 60,
  bubbleMode: 'off',
  retainDays: 182,
  cpamcEnabled: true,
  cpamcBaseURL: 'http://127.0.0.1:8317',
  cpamcManagementKeyEnv: 'CPAMC_MANAGEMENT_KEY_TEST',
  cpamcAllowedHosts: '',
  volcanoEnabled: false,
  volcanoAccessKeyEnv: 'VOLC_ACCESSKEY_TEST',
  volcanoSecretKeyEnv: 'VOLC_SECRETKEY_TEST',
}

function ctx(): Context {
  return { get: () => undefined, on: () => () => {} } as unknown as Context
}

function request(url: string, method = 'POST', body?: unknown, remoteAddress = '127.0.0.1'): IncomingMessage {
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
  return {
    url,
    method,
    headers: { host: '127.0.0.1:53215', 'content-type': 'application/json' },
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {
      if (payload !== undefined) yield payload
    },
    destroy: () => {},
  } as unknown as IncomingMessage
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

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.CPAMC_MANAGEMENT_KEY_TEST
})

describe('fetch error descriptions', () => {
  it('keeps the underlying network code and maps timeouts', () => {
    const refused = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    expect(describeExternalFetchError(refused)).toBe('fetch failed (ECONNREFUSED)')
    const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' })
    expect(describeExternalFetchError(timeout)).toBe('request timed out')
  })
})

describe('external test route', () => {
  const result = { target: 'cpamc' as const, ok: true, latencyMs: 12, accounts: 2, windows: [{ key: '5h', percent: 42 }] }
  const service = { testExternalSource: vi.fn(async () => result) } as unknown as UsageService
  const route = makeUsageTestRoute(service)

  it('fences non-loopback requests', async () => {
    const out = response()
    await route.handler(request('/api/dsh-usage-plus/test', 'POST', { target: 'cpamc' }, '203.0.113.7'), out.res)
    expect(out.status()).toBe(403)
    expect(service.testExternalSource).not.toHaveBeenCalled()
  })

  it('rejects non-POST methods', async () => {
    const out = response()
    await route.handler(request('/api/dsh-usage-plus/test', 'GET'), out.res)
    expect(out.status()).toBe(405)
  })

  it('rejects missing or unknown targets', async () => {
    for (const body of [{}, { target: 'nope' }, undefined]) {
      const out = response()
      await route.handler(request('/api/dsh-usage-plus/test', 'POST', body), out.res)
      expect(out.status()).toBe(400)
    }
  })

  it('returns the structured result for a valid target', async () => {
    const out = response()
    await route.handler(request('/api/dsh-usage-plus/test', 'POST', { target: 'cpamc' }), out.res)
    expect(out.status()).toBe(200)
    expect(service.testExternalSource).toHaveBeenCalledWith('cpamc')
    expect(JSON.parse(out.body())).toEqual(result)
  })
})

describe('CPAMC test probes', () => {
  async function withService<T>(options: Partial<UsageServiceOptions>, run: (service: UsageService, dir: string) => Promise<T>): Promise<T> {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-test-source-'))
    const service = new UsageService(ctx(), { ...BASE_OPTIONS, ...options }, dir)
    try {
      return await run(service, dir)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  function cpamcFetchMock(): void {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      call += 1
      if (call === 1) {
        return new Response(JSON.stringify({
          auth_files: [{ auth_index: 'a1', provider: 'codex', email: 'user@example.com' }],
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        status_code: 200,
        body: JSON.stringify({
          rate_limit: {
            primary_window: { used_percent: 42, limit_window_seconds: 18000, reset_at: 1_765_000_000 },
          },
        }),
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
  }

  it('reports accounts and windows when CPAMC answers', async () => {
    process.env.CPAMC_MANAGEMENT_KEY_TEST = 'test-management-key'
    cpamcFetchMock()
    await withService({}, async (service) => {
      const result = await service.testExternalSource('cpamc')
      expect(result.ok).toBe(true)
      expect(result.accounts).toBe(1)
      expect(result.windows?.[0]).toMatchObject({ key: '5h', percent: 42 })
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })
  })

  it('explains a refused local port and suggests the allowed remote host', async () => {
    process.env.CPAMC_MANAGEMENT_KEY_TEST = 'test-management-key'
    const refused = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    vi.stubGlobal('fetch', vi.fn(async () => { throw refused }))
    await withService({ cpamcAllowedHosts: 'api.example.com' }, async (service) => {
      const result = await service.testExternalSource('cpamc')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('ECONNREFUSED')
      expect(result.hint).toContain('api.example.com')
    })
  })

  it('explains a missing management token without calling the network', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await withService({}, async (service) => {
      const result = await service.testExternalSource('cpamc')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('missing management token')
      expect(result.hint).toContain('Management Token')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  it('reports a disabled source instead of probing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await withService({ cpamcEnabled: false }, async (service) => {
      const result = await service.testExternalSource('cpamc')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('CPAMC 未启用')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  it('maps an unauthorized answer to the token hint', async () => {
    process.env.CPAMC_MANAGEMENT_KEY_TEST = 'bad-key'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })))
    await withService({}, async (service) => {
      const result = await service.testExternalSource('cpamc')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('401')
      expect(result.hint).toContain('Management Token')
    })
  })
})
