/**
 * Generic gateway quota auto-detection: the standard dashboard endpoints a
 * configured route without a shipped adapter may still expose (One API /
 * New API / `/credits`), plus the Host wiring that turns a recognized balance
 * into a normal overview row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectGatewayQuota, formatGatewayAmount, type GatewayFetch } from '../src/core/gateways.ts'
import { UsageService, type UsageServiceOptions } from '../src/host/usage-service.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Transport stub keyed by URL path; unknown paths are 404 JSON. */
function transport(routes: Record<string, unknown>, calls: string[] = []): GatewayFetch {
  return async (url) => {
    calls.push(url)
    const path = new URL(url).pathname
    const body = routes[path]
    if (body === undefined) return { ok: false, status: 404, body: { error: 'not found' } }
    return { ok: true, status: 200, body }
  }
}

describe('detectGatewayQuota', () => {
  it('recognizes an OpenAI-compatible /credits balance', async () => {
    const calls: string[] = []
    const result = await detectGatewayQuota(
      { baseURL: 'https://gw.example.com/v1', apiKey: 'sk-test' },
      { fetch: transport({ '/v1/credits': { balance: '12.5' } }, calls) },
    )
    expect(result).toEqual({ id: 'credits', name: 'Credits', currency: 'USD', totalBalance: '12.50' })
    expect(calls[0]).toBe('https://gw.example.com/v1/credits')
  })

  it('recognizes a One API subscription plus usage (cents)', async () => {
    const result = await detectGatewayQuota(
      { baseURL: 'https://one.example.com/v1', apiKey: 'sk-test' },
      {
        fetch: transport({
          '/dashboard/billing/subscription': { hard_limit_usd: 20 },
          '/dashboard/billing/usage': { total_usage: 500 },
        }),
      },
    )
    expect(result).toEqual({ id: 'one-api', name: 'One API', currency: 'USD', totalBalance: '15.00' })
  })

  it('recognizes a New API quota converted by quota_per_unit', async () => {
    const result = await detectGatewayQuota(
      { baseURL: 'https://new.example.com', apiKey: 'sk-test' },
      {
        fetch: transport({
          '/api/user/self': { success: true, data: { quota: 2_500_000 } },
          '/api/status': { success: true, data: { quota_per_unit: 500_000, quota_display_type: 'USD' } },
        }),
      },
    )
    expect(result).toEqual({ id: 'new-api', name: 'New API', currency: 'USD', totalBalance: '5.00' })
  })

  it('returns undefined for a host with no standard quota endpoint', async () => {
    const result = await detectGatewayQuota(
      { baseURL: 'https://plain.example.com/v1', apiKey: 'sk-test' },
      { fetch: transport({}) },
    )
    expect(result).toBeUndefined()
  })

  it('ignores a response shape it does not recognize', async () => {
    const result = await detectGatewayQuota(
      { baseURL: 'https://weird.example.com', apiKey: 'sk-test' },
      { fetch: transport({ '/credits': { hello: 'world' }, '/dashboard/billing/subscription': { hard_limit_usd: 'x' } }) },
    )
    expect(result).toBeUndefined()
  })

  it('rejects an invalid base URL or a blank key without any request', async () => {
    const calls: string[] = []
    expect(await detectGatewayQuota({ baseURL: 'not a url', apiKey: 'k' }, { fetch: transport({}, calls) })).toBeUndefined()
    expect(await detectGatewayQuota({ baseURL: 'https://gw.example.com', apiKey: '   ' }, { fetch: transport({}, calls) })).toBeUndefined()
    expect(calls).toEqual([])
  })

  it('never throws when the transport fails', async () => {
    const failing: GatewayFetch = async () => {
      throw new Error('connection reset')
    }
    expect(await detectGatewayQuota({ baseURL: 'https://gw.example.com', apiKey: 'k' }, { fetch: failing })).toBeUndefined()
  })

  it('formats sub-cent balances with meaningful precision', () => {
    expect(formatGatewayAmount(12.5)).toBe('12.50')
    expect(formatGatewayAmount(0)).toBe('0.00')
    expect(formatGatewayAmount(0.004)).toBe('0.0040')
  })
})

/** Options shared by the host wiring tests (no other network sources). */
const OPTIONS: UsageServiceOptions = {
  pollIntervalSec: 60,
  bubbleMode: 'off',
  retainDays: 182,
  platformUsageEnabled: false,
  costEstimateEnabled: false,
  cpamcEnabled: false,
  cpamcBaseURL: 'http://127.0.0.1:8317',
  cpamcManagementKeyEnv: 'CPAMC_MANAGEMENT_KEY',
  cpamcAllowedHosts: '',
  volcanoEnabled: false,
  volcanoAccessKeyEnv: 'VOLC_ACCESSKEY',
  volcanoSecretKeyEnv: 'VOLC_SECRETKEY',
}

interface GatewayInternals {
  current: { provider?: string; model?: string; source: 'live' | 'default' }
  snapshots: Map<string, { matchedBy?: string; balance?: { totalBalance: string; currency: string } }>
  gatewayMisses: Map<string, number>
  loadPersisted(): Promise<void>
}

/** A service whose only route is an adapter-less gateway at `baseURL`. */
function gatewayService(input: { route: string; baseURL: string; persistDir: string }): UsageService {
  const ctx = {
    get: (name: string) => {
      if (name === 'llm') {
        return { listProviders: () => [{ id: input.route, name: 'My Gateway' }], listConfigurableProviders: () => [] }
      }
      if (name === 'credentials') {
        return { readRecord: async () => ({ kind: 'api-key', key: 'test-key' }), resolve: async () => undefined }
      }
      if (name === 'configEditor') {
        return {
          configuration: () => [{
            entry: { options: { id: 'llm-pi-ai' }, fiber: { config: { providers: { [input.route]: { baseURL: input.baseURL } } } } },
          }],
        }
      }
      return undefined
    },
    on: () => () => {},
  } as unknown as Context
  const service = new UsageService(ctx, OPTIONS, input.persistDir)
  const internals = service as unknown as GatewayInternals
  internals.current = { provider: input.route, model: 'model-1', source: 'live' }
  return service
}

describe('gateway auto-detection wiring', () => {
  it('turns a detected gateway balance into an overview row', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url)
      const path = new URL(url).pathname
      const body = path === '/v1/credits' ? { balance: '7.25' } : undefined
      return {
        ok: body !== undefined,
        status: body === undefined ? 404 : 200,
        json: async () => body ?? { error: 'not found' },
      } as unknown as Response
    })
    const persistDir = await mkdtemp(join(tmpdir(), 'dsh-usage-gw-'))
    const service = gatewayService({ route: 'my-gateway', baseURL: 'https://gw.example.com/v1', persistDir })
    await service.pollNow()
    const internals = service as unknown as GatewayInternals
    const snapshot = internals.snapshots.get('my-gateway')
    expect(snapshot?.matchedBy).toBe('gateway')
    expect(snapshot?.balance?.totalBalance).toBe('7.25')
    const document = await service.overview()
    const row = document.providers.find((entry) => entry.provider === 'my-gateway')
    expect(row?.matchedBy).toBe('gateway')
    expect(row?.gatewayName).toBe('Credits')
    expect(row?.balanceSupported).toBe(true)
    expect(row?.supported).toBe(true)
    expect(row?.balance?.totalBalance).toBe('7.25')
    expect(calls.length).toBeGreaterThan(0)
  })

  it('caches a miss and does not re-probe the same gateway every poll', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls += 1
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) } as unknown as Response
    })
    const persistDir = await mkdtemp(join(tmpdir(), 'dsh-usage-gw-miss-'))
    const service = gatewayService({ route: 'plain-gw', baseURL: 'https://plain.example.com/v1', persistDir })
    await service.pollNow()
    const internals = service as unknown as GatewayInternals
    expect(internals.snapshots.get('plain-gw')?.balance).toBeUndefined()
    expect(internals.gatewayMisses.get('plain-gw')).toBeDefined()
    const firstCalls = calls
    await service.pollNow()
    expect(calls).toBe(firstCalls)
  })
})
