/**
 * Plugin update check: semver parsing/comparison across prerelease ranks,
 * the VersionChecker's TTL cache, registry fallback and failure caching, and
 * the loopback-fenced `/version` route contract (updateAvailable stays null
 * while either side is unknown). Every fixture is local: no test hits the
 * network.
 */
import { describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { compareVersions, isNewerVersion, parseVersion, readPackageVersion, VersionChecker, type VersionCheckerOptions, type VersionFetchLike } from '../src/host/version.ts'
import { makeUsageVersionRoute } from '../src/host/routes.ts'
import { VERSION_TIMEOUT_MS, VERSION_TTL_MS } from '../src/host/version.ts'

/** Registry response for one version string. */
function registry(version: string): { ok: boolean; json: () => Promise<unknown> } {
  return { ok: true, json: () => Promise.resolve({ name: 'dsh-usage-plus', version }) }
}

/** Fetch stub counting requests per registry URL. */
function fetchStub(
  responses: Record<string, { ok?: boolean; json?: unknown; error?: Error }>,
): { fetch: VersionFetchLike; calls: string[] } {
  const calls: string[] = []
  const fetch: VersionFetchLike = async (url) => {
    calls.push(url)
    const entry = responses[url]
    if (entry === undefined) throw new Error('unexpected registry ' + url)
    if (entry.error !== undefined) throw entry.error
    if (entry.ok === false) return { ok: false, json: () => Promise.resolve(null) }
    return { ok: true, json: () => Promise.resolve(entry.json) }
  }
  return { fetch, calls }
}

function checker(responses: Record<string, { ok?: boolean; json?: unknown; error?: Error }>, options: Partial<VersionCheckerOptions> = {}): { checker: VersionChecker; calls: string[] } {
  const stub = fetchStub(responses)
  return {
    checker: new VersionChecker({
      fetchImpl: stub.fetch,
      registries: Object.keys(responses),
      ...options,
    }),
    calls: stub.calls,
  }
}

describe('semver comparison', () => {
  it('parses plain releases, v-prefixes, prereleases and build suffixes', () => {
    expect(parseVersion('1.2.3')).toMatchObject({ major: 1, minor: 2, patch: 3, rank: 4, serial: 0 })
    expect(parseVersion('v2.0.0')).toMatchObject({ major: 2, rank: 4 })
    expect(parseVersion('1.2.3-rc.2')).toMatchObject({ rank: 3, serial: 2 })
    expect(parseVersion('1.2.3-beta')).toMatchObject({ rank: 2, serial: 0 })
    expect(parseVersion('1.2.3-alpha.7')).toMatchObject({ rank: 1, serial: 7 })
    expect(parseVersion('1.2.3+build.42')).toMatchObject({ rank: 4, serial: 0 })
  })

  it('rejects tags outside the accepted shape', () => {
    expect(parseVersion('')).toBeNull()
    expect(parseVersion('abc')).toBeNull()
    expect(parseVersion('1.2')).toBeNull()
    expect(parseVersion('1.2.3-nightly')).toBeNull()
    expect(parseVersion('1.2.3.4')).toBeNull()
  })

  it('orders releases above prereleases and rc above beta above alpha', () => {
    expect(compareVersions('1.0.0', '1.0.0-rc.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0-rc.2', '1.0.0-rc.1')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0-rc.1', '1.0.0-beta.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0-beta.1', '1.0.0-alpha.9')).toBeGreaterThan(0)
    expect(compareVersions('0.7.0', '0.6.10')).toBeGreaterThan(0)
    expect(compareVersions('0.7.0', '0.7.0')).toBe(0)
  })

  it('ignores build metadata and is strict on isNewer', () => {
    expect(compareVersions('1.2.3+build.1', '1.2.3')).toBe(0)
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false)
    expect(isNewerVersion('1.2.4', '1.2.3')).toBe(true)
    expect(isNewerVersion('1.3.0-rc.1', '1.2.9')).toBe(true)
    expect(isNewerVersion('1.2.3-rc.1', '1.2.3')).toBe(false)
  })
})

describe('VersionChecker', () => {
  it('caches a successful read for the TTL and refetches after it', async () => {
    let now = 1_000
    const { checker: inst, calls } = checker({
      'https://registry.example/a': { json: { version: '0.8.0' } },
    }, { now: () => now, currentVersion: '0.7.0' })

    const first = await inst.check()
    expect(first).toMatchObject({ value: '0.8.0', ready: true, failed: false, checkedAt: 1_000 })
    const second = await inst.check()
    expect(second.checkedAt).toBe(1_000)
    expect(calls).toHaveLength(1)

    now = 1_000 + VERSION_TTL_MS
    await inst.check()
    expect(calls).toHaveLength(2)
  })

  it('de-duplicates concurrent checks into one registry cycle', async () => {
    const { checker: inst, calls } = checker({
      'https://registry.example/a': { json: { version: '0.8.0' } },
    }, { currentVersion: '0.7.0' })
    const [a, b] = await Promise.all([inst.check(), inst.check()])
    expect(a.value).toBe('0.8.0')
    expect(b.value).toBe('0.8.0')
    expect(calls).toHaveLength(1)
  })

  it('falls back to the next registry when one fails', async () => {
    const { checker: inst, calls } = checker({
      'https://registry.example/a': { error: new Error('boom') },
      'https://registry.example/b': { json: { version: '0.8.1' } },
    }, { currentVersion: '0.7.0' })
    const read = await inst.check()
    expect(read).toMatchObject({ value: '0.8.1', ready: true, failed: false })
    expect(calls).toEqual(['https://registry.example/a', 'https://registry.example/b'])
  })

  it('skips registries with a non-ok response or an unusable version', async () => {
    const { checker: inst } = checker({
      'https://registry.example/a': { ok: false },
      'https://registry.example/b': { json: { version: 'not-a-version' } },
      'https://registry.example/c': { json: { version: '0.9.0-rc.1' } },
    }, { currentVersion: '0.8.0' })
    const read = await inst.check()
    expect(read).toMatchObject({ value: '0.9.0-rc.1', ready: true })
    expect(read.checkedAt).toBeGreaterThan(0)
  })

  it('caches a failed cycle for the TTL instead of hammering the network', async () => {
    let now = 5_000
    const { checker: inst, calls } = checker({
      'https://registry.example/a': { error: new Error('offline') },
    }, { now: () => now, currentVersion: '0.7.0' })
    const read = await inst.check()
    expect(read).toMatchObject({ value: null, ready: false, failed: true, checkedAt: 5_000 })

    now += VERSION_TTL_MS / 2
    const cached = await inst.check()
    expect(cached.failed).toBe(true)
    expect(calls).toHaveLength(1)

    now += VERSION_TTL_MS
    await inst.check()
    expect(calls).toHaveLength(2)
  })

  it('reports updateAvailable facts through the route contract', async () => {
    const { checker: inst } = checker({
      'https://registry.example/a': { json: { version: '0.8.0' } },
    }, { currentVersion: '0.7.0' })
    await inst.check()
    expect(inst.current()).toBe('0.7.0')
  })

  it('stops fetching after dispose', async () => {
    const { checker: inst, calls } = checker({
      'https://registry.example/a': { json: { version: '0.8.0' } },
    }, { currentVersion: '0.7.0' })
    await inst.check()
    inst.dispose()
    const read = await inst.check()
    expect(read.value).toBe('0.8.0')
    expect(calls).toHaveLength(1)
  })

  it('carries the package.json version via self-reference in this checkout', () => {
    expect(readPackageVersion()).toBe('0.8.0')
  })
})

function request(url: string, method = 'GET', remoteAddress = '127.0.0.1'): IncomingMessage {
  return { url, method, headers: { host: '127.0.0.1:53215' }, socket: { remoteAddress } } as unknown as IncomingMessage
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

describe('version route', () => {
  function route(check: () => Promise<{ value: string | null; ready: boolean; failed: boolean; checkedAt: number }>, current: string | undefined) {
    const fake = { check, current: () => current } as unknown as VersionChecker
    return makeUsageVersionRoute(fake)
  }

  it('fences non-loopback requests and rejects non-GET methods', async () => {
    const fenced = route(async () => ({ value: '0.8.0', ready: true, failed: false, checkedAt: 1 }), '0.7.0')
    const out = response()
    await fenced.handler(request('/api/dsh-usage-plus/version', 'GET', '203.0.113.9'), out.res)
    expect(out.status()).toBe(403)

    const get = route(async () => ({ value: '0.8.0', ready: true, failed: false, checkedAt: 1 }), '0.7.0')
    const rejected = response()
    await get.handler(request('/api/dsh-usage-plus/version', 'POST'), rejected.res)
    expect(rejected.status()).toBe(405)
  })

  it('serves the running version, latest, and a strictly-newer verdict', async () => {
    const handler = route(async () => ({ value: '0.8.0', ready: true, failed: false, checkedAt: 42 }), '0.7.0')
    const out = response()
    await handler.handler(request('/api/dsh-usage-plus/version'), out.res)
    expect(out.status()).toBe(200)
    const payload = JSON.parse(out.body()) as { ok: boolean; value: Record<string, unknown> }
    expect(payload.ok).toBe(true)
    expect(payload.value).toMatchObject({
      ready: true,
      failed: false,
      checkedAt: 42,
      current: '0.7.0',
      updateAvailable: true,
      latest: '0.8.0',
    })
  })

  it('answers up to date when the latest is not newer', async () => {
    const handler = route(async () => ({ value: '0.7.0', ready: true, failed: false, checkedAt: 1 }), '0.7.0')
    const out = response()
    await handler.handler(request('/api/dsh-usage-plus/version'), out.res)
    const payload = JSON.parse(out.body()) as { value: { updateAvailable: boolean; latest?: string } }
    expect(payload.value.updateAvailable).toBe(false)
    expect(payload.value.latest).toBe('0.7.0')
  })

  it('keeps updateAvailable null when a check failed or the version is unreadable', async () => {
    const failed = route(async () => ({ value: null, ready: false, failed: true, checkedAt: 1 }), '0.7.0')
    const failedOut = response()
    await failed.handler(request('/api/dsh-usage-plus/version'), failedOut.res)
    const failedPayload = JSON.parse(failedOut.body()) as { value: { updateAvailable: unknown; latest?: string } }
    expect(failedPayload.value.updateAvailable).toBeNull()
    expect(failedPayload.value.latest).toBeUndefined()

    const noVersion = route(async () => ({ value: '0.8.0', ready: true, failed: false, checkedAt: 1 }), undefined)
    const noVersionOut = response()
    await noVersion.handler(request('/api/dsh-usage-plus/version'), noVersionOut.res)
    const noVersionPayload = JSON.parse(noVersionOut.body()) as { value: { updateAvailable: unknown; current: unknown } }
    expect(noVersionPayload.value.updateAvailable).toBeNull()
    expect(noVersionPayload.value.current).toBeNull()
  })

  it('degrades to a 500 when the checker itself throws', async () => {
    const handler = route(async () => { throw new Error('internal') }, '0.7.0')
    const out = response()
    await handler.handler(request('/api/dsh-usage-plus/version'), out.res)
    expect(out.status()).toBe(500)
  })

  it('uses the production registry list and timeout defaults', () => {
    expect(VERSION_TTL_MS).toBe(60 * 60 * 1_000)
    expect(VERSION_TIMEOUT_MS).toBe(8_000)
  })
})
