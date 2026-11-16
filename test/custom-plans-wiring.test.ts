/**
 * Custom-plan wiring: settings JSON -> parsed entries, poll-produced `custom:`
 * snapshots, overview parse errors, and the per-plan test route. Network is
 * mocked; no real endpoint is contacted.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { makeUsageTestRoute } from '../src/host/routes.ts'
import { UsageService, type UsageServiceOptions } from '../src/host/usage-service.ts'

const BASE: UsageServiceOptions = {
  pollIntervalSec: 60,
  bubbleMode: 'off',
  retainDays: 182,
  cpamcEnabled: false,
  cpamcBaseURL: 'http://127.0.0.1:8317',
  cpamcManagementKeyEnv: 'CPAMC_MANAGEMENT_KEY_TEST',
  cpamcAllowedHosts: '',
  volcanoEnabled: false,
  volcanoAccessKeyEnv: 'VOLC_ACCESSKEY_TEST',
  volcanoSecretKeyEnv: 'VOLC_SECRETKEY_TEST',
  customPlans: '',
}

function ctx(): Context {
  return { get: () => undefined, on: () => () => {} } as unknown as Context
}

const PLANS = JSON.stringify([
  { id: 'my-plan', name: 'My Plan', url: 'http://127.0.0.1:9100/usage' },
])

afterEach(() => {
  vi.unstubAllGlobals()
})

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

function request(body: unknown, remoteAddress = '127.0.0.1'): IncomingMessage {
  const payload = Buffer.from(JSON.stringify(body))
  return {
    url: '/api/dsh-usage-plus/test',
    method: 'POST',
    headers: { host: '127.0.0.1:53215', 'content-type': 'application/json' },
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {
      yield payload
    },
    destroy: () => {},
  } as unknown as IncomingMessage
}

async function withService<T>(customPlans: string, run: (service: UsageService) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-custom-wire-'))
  const service = new UsageService(ctx(), { ...BASE, customPlans }, dir)
  try {
    return await run(service)
  } finally {
    await service.stop()
    await rm(dir, { recursive: true, force: true, maxRetries: 3 })
  }
}

describe('custom plan wiring', () => {
  it('stores one custom snapshot per configured plan and renders its windows', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      windows: [
        { label: 'weekly', percent: 42, resetsAt: '2026-11-20T00:00:00Z' },
        { label: '5h', percent: 12, resetAt: '2026-11-16T20:00:00Z' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await withService(PLANS, async (service) => {
      await service.refresh()
      const document = await service.overview()
      const row = document.providers.find((provider) => provider.provider === 'custom:my-plan')
      expect(row?.source).toBe('custom')
      expect(row?.displayName).toBe('My Plan')
      expect(row?.plan?.windows.map((window) => window.key)).toEqual(['5h', 'week'])
      expect(row?.plan?.windows[1]?.percent).toBe(42)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  it('records a per-plan probe failure instead of dropping the row', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    await withService(PLANS, async (service) => {
      await service.refresh()
      const document = await service.overview()
      const row = document.providers.find((provider) => provider.provider === 'custom:my-plan')
      expect(row?.error).toContain('401')
      expect(row?.plan).toBeUndefined()
    })
  })

  it('reports invalid settings JSON in the overview and never probes it', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await withService(JSON.stringify([{ id: 'Bad ID', name: '', url: 'http://example.com/usage' }]), async (service) => {
      await service.refresh()
      const document = await service.overview()
      expect(document.customPlanErrors?.length).toBeGreaterThan(0)
      expect(document.customPlanErrors?.[0]?.field).toBeDefined()
      expect(document.providers.some((provider) => provider.source === 'custom')).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  it('drops a custom snapshot once its entry is removed from settings', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ usage: { weekly: { percent: 30 } } }), { status: 200 })))
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-custom-remove-'))
    const service = new UsageService(ctx(), { ...BASE, customPlans: PLANS }, dir)
    try {
      await service.refresh()
      expect((await service.overview()).providers.some((provider) => provider.provider === 'custom:my-plan')).toBe(true)
      service.applyOptions({ ...BASE, customPlans: '' })
      await service.refresh()
      expect((await service.overview()).providers.some((provider) => provider.provider === 'custom:my-plan')).toBe(false)
    } finally {
      await service.stop()
      await rm(dir, { recursive: true, force: true, maxRetries: 3 })
    }
  })
})

describe('custom plan test route', () => {
  it('tests one plan by id and rejects a malformed id', async () => {
    const service = {
      testExternalSource: vi.fn(async (target: string, id?: string) => ({
        target,
        id,
        ok: true,
        latencyMs: 3,
        windows: [{ key: 'week', percent: 42 }],
      })),
    } as unknown as UsageService
    const route = makeUsageTestRoute(service)

    const ok = response()
    await route.handler(request({ target: 'custom', id: 'my-plan' }), ok.res)
    expect(ok.status()).toBe(200)
    expect(service.testExternalSource).toHaveBeenCalledWith('custom', 'my-plan', {})
    expect(JSON.parse(ok.body())).toMatchObject({ target: 'custom', id: 'my-plan', ok: true })

    const bad = response()
    await route.handler(request({ target: 'custom', id: 'Bad ID' }), bad.res)
    expect(bad.status()).toBe(400)
  })
})
