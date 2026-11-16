/**
 * Custom-plan source: config parsing (per-field, never throwing), host-side
 * `${env:NAME}` header resolution, URL safety, probe failure taxonomy,
 * normalization of both payload shapes, snapshot shaping and error messages.
 * All probes are mocked; this file never touches the network.
 * @module test/custom-plans.test
 */
import { describe, expect, it } from 'vitest'
import {
  CUSTOM_PLAN_LIMITS,
  CustomPlanError,
  customPlanSnapshot,
  describeCustomPlanError,
  normalizeCustomPlan,
  parseCustomPlans,
  probeCustomPlan,
  resolveHeaders,
  type CustomPlanEntry,
  type CustomPlanProbeOptions,
  type CustomPlanProbeResult,
} from '../src/host/custom-plans.ts'
import type { PlanWindowView } from '../src/core/types.ts'

/** Secret values used to prove failures never echo them. */
const PLAN_TOKEN = 'super-secret-plan-token'
const TENANT = 'acme-tenant'

const CONFIG_JSON = JSON.stringify([
  {
    id: 'my-plan',
    name: 'My Plan',
    url: 'https://api.example.com/usage',
    allowedHosts: ['api.example.com'],
    tokenEnv: 'MY_PLAN_TOKEN',
    headers: { 'x-tenant': '${env:MY_TENANT}' },
  },
])

interface FetchCall {
  url: string
  init?: RequestInit
}

function mockFetch(
  handler: (url: string, init: RequestInit | undefined, call: number) => Response | Promise<Response>,
): { fetch: typeof fetch; calls: FetchCall[] } {
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

/** Env reader backed by a literal map. */
function envOf(values: Record<string, string>): (name: string) => string | undefined {
  return (name) => values[name]
}

/** Every plan token/tenant the parser/probe should be able to resolve. */
const FULL_ENV = envOf({ MY_PLAN_TOKEN: PLAN_TOKEN, MY_TENANT: TENANT })

/** Parse a single raw entry and return its result. */
function parseOne(entry: unknown): ReturnType<typeof parseCustomPlans> {
  return parseCustomPlans([entry])
}

/** Assert a probe failed with the given typed code and secret-free message. */
function expectProbeFailure(result: CustomPlanProbeResult, code: string): CustomPlanError {
  if (result.ok) throw new Error(`expected a ${code} failure, got success`)
  expect(result.error).toBeInstanceOf(CustomPlanError)
  expect(result.error.code).toBe(code)
  const serialized = JSON.stringify(result)
  expect(serialized).not.toContain(PLAN_TOKEN)
  expect(serialized).not.toContain(TENANT)
  return result.error
}

/** Successful probe assertion helper. */
function expectProbeSuccess(result: CustomPlanProbeResult): void {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}: ${result.error.message}`)
}

describe('parseCustomPlans', () => {
  it('accepts the documented JSON string config, keeping env headers unresolved', () => {
    const result = parseCustomPlans(CONFIG_JSON)
    expect(result.errors).toEqual([])
    expect(result.entries).toHaveLength(1)
    const entry = result.entries[0]
    expect(entry).toBeDefined()
    expect(entry).toMatchObject({
      id: 'my-plan',
      name: 'My Plan',
      url: 'https://api.example.com/usage',
      host: 'api.example.com',
      allowedHosts: ['api.example.com'],
      tokenEnv: 'MY_PLAN_TOKEN',
      headers: { 'x-tenant': '${env:MY_TENANT}' },
    })
    expect(typeof entry?.resolveHeaders).toBe('function')
  })

  it('accepts an already-parsed array and literal header values', () => {
    const result = parseCustomPlans([
      { id: 'local-plan', url: 'http://127.0.0.1:8317/usage', headers: { 'x-api-key': 'plain-literal' } },
    ])
    expect(result.errors).toEqual([])
    expect(result.entries[0]).toMatchObject({
      id: 'local-plan',
      name: 'local-plan',
      host: '127.0.0.1',
      headers: { 'x-api-key': 'plain-literal' },
    })
  })

  it('treats an absent config as feature-off, not an error', () => {
    expect(parseCustomPlans(undefined)).toEqual({ entries: [], errors: [] })
    expect(parseCustomPlans(null)).toEqual({ entries: [], errors: [] })
    expect(parseCustomPlans('')).toEqual({ entries: [], errors: [] })
    expect(parseCustomPlans('   ')).toEqual({ entries: [], errors: [] })
  })

  it('reports malformed JSON and non-array documents as one document error', () => {
    const malformed = parseCustomPlans('[{oops')
    expect(malformed.entries).toEqual([])
    expect(malformed.errors).toHaveLength(1)
    expect(malformed.errors[0]).toMatchObject({ index: -1, field: 'document', message: 'custom plans must be valid JSON' })
    const object = parseCustomPlans({ plans: [] })
    expect(object.errors[0]).toMatchObject({ index: -1, field: 'document', message: 'custom plans must be a JSON array' })
    const scalar = parseCustomPlans('"hello"')
    expect(scalar.errors[0]?.field).toBe('document')
  })

  it('falls back to the id when name is absent and trims a supplied name', () => {
    const noName = parseOne({ id: 'fallback', url: 'http://localhost:9000/usage' })
    expect(noName.errors).toEqual([])
    expect(noName.entries[0]?.name).toBe('fallback')
    const trimmed = parseOne({ id: 'trimmed', name: '  My Plan  ', url: 'http://localhost:9000/usage' })
    expect(trimmed.entries[0]?.name).toBe('My Plan')
  })

  it('rejects bad ids and the later of duplicate ids', () => {
    for (const id of ['MY-PLAN', '-plan', 'a'.repeat(33), 'has space', '', 42]) {
      const result = parseOne({ id, name: 'X', url: 'http://localhost/usage' })
      expect(result.entries).toEqual([])
      expect(result.errors[0]).toMatchObject({ index: 0, field: 'id' })
    }
    const duplicate = parseCustomPlans([
      { id: 'dup', name: 'First', url: 'https://api.example.com/usage', allowedHosts: ['api.example.com'] },
      { id: 'dup', name: 'Second', url: 'https://api.example.com/usage', allowedHosts: ['api.example.com'] },
    ])
    expect(duplicate.entries).toHaveLength(1)
    expect(duplicate.entries[0]?.name).toBe('First')
    expect(duplicate.errors).toHaveLength(1)
    expect(duplicate.errors[0]).toMatchObject({ index: 1, field: 'id', id: 'dup' })
    expect(duplicate.errors[0]?.message).toContain('duplicate')
  })

  it('rejects non-object entries and keeps parsing the rest', () => {
    const result = parseCustomPlans([
      null,
      'string',
      42,
      [],
      { id: 'good', name: 'Good', url: 'http://localhost/usage' },
    ])
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.id).toBe('good')
    expect(result.errors).toHaveLength(4)
    expect(result.errors.map((error) => error.field)).toEqual(['entry', 'entry', 'entry', 'entry'])
  })

  it('caps the number of entries and reports the excess', () => {
    const many = Array.from({ length: CUSTOM_PLAN_LIMITS.maxEntries + 1 }, (_, index) => ({
      id: `plan-${index}`,
      name: `Plan ${index}`,
      url: `https://api${index}.example.com/usage`,
      allowedHosts: [`api${index}.example.com`],
    }))
    const result = parseCustomPlans(many)
    expect(result.entries).toHaveLength(CUSTOM_PLAN_LIMITS.maxEntries)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({ index: CUSTOM_PLAN_LIMITS.maxEntries, field: 'document' })
  })

  it('requires https for foreign hosts and allows http only on loopback', () => {
    const httpForeign = parseOne({ id: 'http-foreign', url: 'http://api.example.com/usage', allowedHosts: ['api.example.com'] })
    expect(httpForeign.errors[0]?.message).toContain('https unless its host is loopback')
    for (const url of ['http://127.0.0.1:8317/usage', 'http://localhost:9000/usage', 'http://[::1]:8080/usage']) {
      const result = parseOne({ id: 'loop', url })
      expect(result.errors).toEqual([])
      expect(result.entries).toHaveLength(1)
    }
  })

  it('requires foreign hosts to be listed in allowedHosts', () => {
    const foreign = parseOne({ id: 'foreign', url: 'https://api.example.com/usage' })
    expect(foreign.entries).toEqual([])
    expect(foreign.errors[0]?.message).toContain('not loopback and not listed in allowedHosts')
    const allowed = parseOne({ id: 'allowed', url: 'https://api.example.com/usage', allowedHosts: ['API.EXAMPLE.COM'] })
    expect(allowed.errors).toEqual([])
    expect(allowed.entries[0]?.allowedHosts).toEqual(['api.example.com'])
  })

  it('rejects credentials, fragments, relative and non-http URLs', () => {
    for (const url of [
      'https://user:secret@api.example.com/usage',
      'https://api.example.com/usage#frag',
      '/usage',
      'api.example.com/usage',
      'ftp://api.example.com/usage',
    ]) {
      const result = parseOne({ id: 'bad-url', url, allowedHosts: ['api.example.com'] })
      expect(result.entries).toEqual([])
      expect(result.errors[0]).toMatchObject({ index: 0, field: 'url' })
    }
  })

  it('rejects over-long URLs and over-long hosts', () => {
    const longUrl = parseOne({ id: 'long', url: `https://api.example.com/${'a'.repeat(3000)}`, allowedHosts: ['api.example.com'] })
    expect(longUrl.errors[0]?.field).toBe('url')
    expect(longUrl.errors[0]?.message).toContain('at most')
  })

  it('validates allowedHosts shape and caps the list', () => {
    for (const allowedHosts of ['api.example.com', ['bad host'], ['api.example.com:443'], ['https://api.example.com']]) {
      const result = parseOne({ id: 'hosts', url: 'https://api.example.com/usage', allowedHosts })
      expect(result.errors.some((error) => error.field === 'allowedHosts')).toBe(true)
    }
    const tooMany = Array.from({ length: CUSTOM_PLAN_LIMITS.maxAllowedHosts + 1 }, (_, index) => `api${index}.example.com`)
    const result = parseOne({ id: 'many-hosts', url: 'https://api0.example.com/usage', allowedHosts: tooMany })
    expect(result.errors[0]?.message).toContain('at most')
  })

  it('rejects unsafe, forbidden and malformed headers', () => {
    const forbidden = ['host', 'content-length', 'connection', 'accept-encoding', 'authorization', 'transfer-encoding']
    for (const name of forbidden) {
      const result = parseOne({ id: 'header', url: 'http://localhost/usage', headers: { [name]: 'x' } })
      expect(result.entries).toEqual([])
      expect(result.errors[0]?.field).toBe(`headers.${name}`)
      expect(result.errors[0]?.message).toContain('may not be overridden')
    }
    for (const headers of [
      { 'bad name': 'x' },
      { 'x-tenant': 42 },
      { 'x-tenant': 'a\r\nx-evil: 1' },
      { 'x-tenant': '${TOKEN}' },
      { 'x-tenant': '${env:}' },
      { 'x-tenant': '${env:BAD-NAME}' },
      { 'x-tenant': '${env:FOO' },
      { 'x-tenant': 'v'.repeat(CUSTOM_PLAN_LIMITS.maxHeaderValueLength + 1) },
      { 'X-Tenant': 'a', 'x-tenant': 'b' },
    ]) {
      const result = parseOne({ id: 'header', url: 'http://localhost/usage', headers })
      expect(result.entries).toEqual([])
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]?.field.startsWith('headers.')).toBe(true)
    }
    const tooMany = Object.fromEntries(Array.from({ length: CUSTOM_PLAN_LIMITS.maxHeaders + 1 }, (_, index) => [`h${index}`, 'v']))
    const result = parseOne({ id: 'header', url: 'http://localhost/usage', headers: tooMany })
    expect(result.errors[0]?.field).toBe('headers')
  })

  it('normalizes header names to lowercase', () => {
    const result = parseOne({ id: 'header', url: 'http://localhost/usage', headers: { 'X-Tenant': '${env:MY_TENANT}' } })
    expect(result.entries[0]?.headers).toEqual({ 'x-tenant': '${env:MY_TENANT}' })
  })

  it('validates tokenEnv names', () => {
    for (const tokenEnv of ['MY-PLAN', '1BAD', '', 42]) {
      const result = parseOne({ id: 'token', url: 'http://localhost/usage', tokenEnv })
      expect(result.errors[0]).toMatchObject({ index: 0, field: 'tokenEnv' })
      expect(result.entries).toEqual([])
    }
  })

  it('collects every bad field of one entry instead of stopping at the first', () => {
    const result = parseOne({
      id: 'BAD ID',
      name: '',
      url: 'http://api.example.com/usage',
      headers: { host: 'x' },
    })
    expect(result.entries).toEqual([])
    expect(result.errors.map((error) => error.field).sort()).toEqual(['headers.host', 'id', 'name', 'url'])
  })

  it('never throws on arbitrary garbage', () => {
    const garbage: unknown[] = [42, true, 1n, [{}, [], 'x', 42], { plans: 'nope' }, '[{]', () => 1]
    for (const value of garbage) {
      expect(() => parseCustomPlans(value)).not.toThrow()
      expect(Array.isArray(parseCustomPlans(value).errors)).toBe(true)
    }
  })
})

describe('resolveHeaders', () => {
  it('substitutes env references only and keeps literals', () => {
    expect(resolveHeaders({ 'x-tenant': '${env:MY_TENANT}', 'x-literal': 'plain' }, FULL_ENV)).toEqual({
      'x-tenant': TENANT,
      'x-literal': 'plain',
    })
    expect(resolveHeaders({ 'x-prefixed': 'tenant=${env:MY_TENANT}' }, FULL_ENV)).toEqual({ 'x-prefixed': `tenant=${TENANT}` })
  })

  it('drops headers whose env reference is unset or whose reader throws', () => {
    const reader = envOf({})
    expect(resolveHeaders({ 'x-tenant': '${env:MY_TENANT}' }, reader)).toEqual({})
    const throwing = (): string | undefined => { throw new Error('no env') }
    expect(resolveHeaders({ 'x-tenant': '${env:MY_TENANT}', 'x-ok': 'literal' }, throwing)).toEqual({ 'x-ok': 'literal' })
  })

  it('drops env values that smuggle control characters', () => {
    const reader = envOf({ MY_TENANT: 'acme\r\nx-evil: 1' })
    expect(resolveHeaders({ 'x-tenant': '${env:MY_TENANT}' }, reader)).toEqual({})
  })

  it('never throws on garbage input and parsed entries resolve through it', () => {
    expect(resolveHeaders(undefined as unknown as Record<string, string>, FULL_ENV)).toEqual({})
    const entry = parseCustomPlans(CONFIG_JSON).entries[0]
    expect(entry?.resolveHeaders(FULL_ENV)).toEqual({ 'x-tenant': TENANT })
  })
})

describe('probeCustomPlan', () => {
  it('probes an allow-listed endpoint with env headers, a bearer token and redirect:manual', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ windows: [{ label: 'weekly', percent: 0.35 }] }))
    const entry = parseCustomPlans(CONFIG_JSON).entries[0] as CustomPlanEntry
    const result = await probeCustomPlan(entry, { fetch, env: FULL_ENV, now: () => 7_000 })
    expectProbeSuccess(result)
    if (!result.ok) throw new Error('unreachable')
    expect(result.windows).toEqual([{ key: 'week', percent: 35 }])
    expect(result.status).toBe(200)
    expect(result.updatedAt).toBe(7_000)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://api.example.com/usage')
    expect(calls[0]?.init).toMatchObject({ method: 'GET', redirect: 'manual' })
    const headers = calls[0]?.init?.headers as Record<string, string>
    expect(headers.accept).toBe('application/json')
    expect(headers.authorization).toBe(`Bearer ${PLAN_TOKEN}`)
    expect(headers['x-tenant']).toBe(TENANT)
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('normalizes the opencode-style usage shape (fractions, ISO and epoch resets)', async () => {
    const resetIso = new Date(1756428000 * 1000).toISOString()
    const { fetch } = mockFetch(() => jsonResponse({
      usage: {
        rolling: { percent: 0.4, resetsAt: '2026-11-16T08:00:00Z' },
        weekly: { percent: 0.35, resetsAt: 1756428000 },
        monthly: { percent: '70', resetAt: 1756428000000 },
      },
    }))
    const result = await probeCustomPlan({ ...testEntry(), tokenEnv: undefined }, { fetch, env: envOf({}) })
    expectProbeSuccess(result)
    if (!result.ok) throw new Error('unreachable')
    expect(result.windows).toEqual([
      { key: '5h', percent: 40, resetsAt: '2026-11-16T08:00:00.000Z' },
      { key: 'week', percent: 35, resetsAt: resetIso },
      { key: 'month', percent: 70, resetsAt: resetIso },
    ])
  })

  it('normalizes the windows array shape and skips unusable rows', async () => {
    const { fetch } = mockFetch(() => jsonResponse({
      windows: [
        { label: '5h', percent: 0.8, resetAt: 1756428000 },
        { label: 'Weekly', percent: 55 },
        { label: 'Credits', percent: 12 },
        { label: 'Mystery' },
      ],
    }))
    const result = await probeCustomPlan(testEntry(), { fetch, env: envOf({}) })
    expectProbeSuccess(result)
    if (!result.ok) throw new Error('unreachable')
    expect(result.windows).toEqual([
      { key: '5h', percent: 80, resetsAt: new Date(1756428000 * 1000).toISOString() },
      { key: 'week', percent: 55 },
      { key: 'credits', percent: 12, name: 'Credits' },
    ])
  })

  it('refuses 3xx redirects without following them', async () => {
    const { fetch } = mockFetch(() => new Response(null, { status: 302, headers: { location: 'https://elsewhere.example.com' } }))
    const error = expectProbeFailure(await probeCustomPlan(testEntry(), { fetch, env: envOf({}) }), 'redirect')
    expect(error.message).toBe('custom plan redirect refused')
    expect(error.status).toBe(302)
  })

  it('maps 401 and 403 to a secret-free auth error', async () => {
    for (const status of [401, 403]) {
      const { fetch } = mockFetch(() => new Response('', { status }))
      const entry: CustomPlanEntry = { ...testEntry(), tokenEnv: 'MY_PLAN_TOKEN' }
      const error = expectProbeFailure(await probeCustomPlan(entry, { fetch, env: FULL_ENV }), 'auth')
      expect(error.message).toBe('custom plan rejected the request (401/403)')
      expect(error.status).toBe(status)
    }
  })

  it('maps other non-2xx responses to a typed HTTP error', async () => {
    const { fetch } = mockFetch(() => new Response('', { status: 500 }))
    const error = expectProbeFailure(await probeCustomPlan(testEntry(), { fetch, env: envOf({}) }), 'http')
    expect(error.message).toBe('custom plan HTTP 500')
    expect(error.status).toBe(500)
  })

  it('rejects a non-JSON 2xx body', async () => {
    const { fetch } = mockFetch(() => new Response('<html>not json</html>', { status: 200 }))
    const error = expectProbeFailure(await probeCustomPlan(testEntry(), { fetch, env: envOf({}) }), 'invalid-json')
    expect(error.message).toBe('custom plan response was not valid JSON')
  })

  it('rejects valid JSON with no usable windows', async () => {
    const { fetch } = mockFetch(() => jsonResponse({ hello: 'world', usage: { rolling: { percent: 'n/a' } } }))
    const error = expectProbeFailure(await probeCustomPlan(testEntry(), { fetch, env: envOf({}) }), 'no-windows')
    expect(error.message).toContain('no usable quota windows')
  })

  it('times out a hanging request', async () => {
    const hanging = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      const fail = (): void => reject(signal?.reason ?? new DOMException('aborted', 'AbortError'))
      if (signal === undefined || signal === null) return
      if (signal.aborted) { fail(); return }
      signal.addEventListener('abort', fail, { once: true })
    })) as typeof fetch
    const error = expectProbeFailure(
      await probeCustomPlan(testEntry(), { fetch: hanging, env: envOf({}), timeoutMs: 25 }),
      'timeout',
    )
    expect(error.message).toBe('custom plan request timed out')
  })

  it('maps transport rejections and honours an already-aborted caller signal', async () => {
    const transport = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    const rejecting = (async () => { throw transport }) as unknown as typeof fetch
    const error = expectProbeFailure(await probeCustomPlan(testEntry(), { fetch: rejecting, env: envOf({}) }), 'network')
    expect(error.message).toContain('ECONNREFUSED')
    expect(error.message).not.toContain(PLAN_TOKEN)

    const controller = new AbortController()
    controller.abort()
    const hanging = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      reject(init?.signal?.reason ?? new DOMException('aborted', 'AbortError'))
    })) as typeof fetch
    const aborted = await probeCustomPlan(testEntry(), { fetch: hanging, env: envOf({}), signal: controller.signal })
    expectProbeFailure(aborted, 'timeout')
  })

  it('fails a configured tokenEnv that the Host environment does not define', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ windows: [{ label: '5h', percent: 10 }] }))
    const entry = parseCustomPlans(CONFIG_JSON).entries[0] as CustomPlanEntry
    const error = expectProbeFailure(await probeCustomPlan(entry, { fetch, env: envOf({}) }), 'missing-token')
    expect(error.message).toContain('MY_PLAN_TOKEN')
    expect(error.message).not.toContain(PLAN_TOKEN)
    expect(calls).toHaveLength(0)
  })

  it('drops tokenEnv values that smuggle header separators', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ windows: [{ label: '5h', percent: 10 }] }))
    const entry: CustomPlanEntry = { ...testEntry(), tokenEnv: 'MY_PLAN_TOKEN' }
    const error = expectProbeFailure(await probeCustomPlan(entry, { fetch, env: envOf({ MY_PLAN_TOKEN: 'tok\r\nX: 1' }) }), 'unsafe-header')
    expect(error.message).toContain('invalid characters')
    expect(calls).toHaveLength(0)
  })

  it('drops unresolved env headers from the outgoing request but keeps literals', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ windows: [{ label: '5h', percent: 10 }] }))
    const headers = { 'x-tenant': '${env:MISSING_TENANT}', 'x-keep': 'literal' }
    const entry: CustomPlanEntry = {
      ...testEntry(),
      headers,
      resolveHeaders: (getEnv) => resolveHeaders(headers, getEnv),
    }
    const result = await probeCustomPlan(entry, { fetch, env: envOf({}) })
    expectProbeSuccess(result)
    expect(calls).toHaveLength(1)
    const sent = calls[0]?.init?.headers as Record<string, string>
    expect(sent['x-keep']).toBe('literal')
    expect(sent['x-tenant']).toBeUndefined()
  })

  it('rejects malformed hand-built URLs, header references and tokenEnv names', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ windows: [{ label: '5h', percent: 10 }] }))
    const badUrl = expectProbeFailure(
      await probeCustomPlan({ ...testEntry(), url: '/usage' }, { fetch, env: envOf({}) }),
      'invalid-url',
    )
    expect(badUrl.message).toContain('absolute URL')
    const badReference = expectProbeFailure(
      await probeCustomPlan({ ...testEntry(), headers: { 'x-tenant': '${env:}' } }, { fetch, env: envOf({}) }),
      'unsafe-header',
    )
    expect(badReference.message).toContain('environment reference')
    const badTokenEnv = expectProbeFailure(
      await probeCustomPlan({ ...testEntry(), tokenEnv: 'BAD-NAME' }, { fetch, env: envOf({}) }),
      'invalid-config',
    )
    expect(badTokenEnv.message).toContain('tokenEnv')
    expect(calls).toHaveLength(0)
  })

  it('refuses disallowed hosts, unsafe headers and malformed entries before any network call', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ windows: [{ label: '5h', percent: 10 }] }))
    const foreign = expectProbeFailure(
      await probeCustomPlan({ ...testEntry(), url: 'https://evil.example.com/usage', allowedHosts: [] }, { fetch, env: envOf({}) }),
      'not-allowed',
    )
    expect(foreign.message).toContain('not loopback')
    const unsafe = expectProbeFailure(
      await probeCustomPlan({ ...testEntry(), headers: { host: 'evil' } }, { fetch, env: envOf({}) }),
      'unsafe-header',
    )
    expect(unsafe.message).toContain('host')
    const malformed = expectProbeFailure(
      await probeCustomPlan(undefined as unknown as CustomPlanEntry, { fetch, env: envOf({}) }),
      'invalid-config',
    )
    expect(malformed.message).toContain('not an object')
    expect(calls).toHaveLength(0)
  })

  it('never throws on garbage options or a garbage entry', async () => {
    const { fetch } = mockFetch(() => jsonResponse({ windows: [{ label: '5h', percent: 10 }] }))
    await expect(probeCustomPlan(42 as unknown as CustomPlanEntry, { fetch, env: envOf({}) })).resolves.toBeDefined()
    await expect(probeCustomPlan(
      testEntry(),
      { fetch, timeoutMs: 'nope', now: () => { throw new Error('clock') }, env: 'nope' } as unknown as CustomPlanProbeOptions,
    )).resolves.toBeDefined()
  })
})

describe('normalizeCustomPlan', () => {
  it('maps the opencode-style usage object and sorts 5h/week/month/session', () => {
    const windows = normalizeCustomPlan({
      usage: {
        monthly: { percent: 50 },
        weekly: { percent: 30 },
        rolling: { percent: 0.1 },
        session: { percent: 22 },
      },
    })
    expect(windows).toEqual([
      { key: '5h', percent: 10 },
      { key: 'week', percent: 30 },
      { key: 'month', percent: 50 },
      { key: 'session', percent: 22 },
    ])
  })

  it('maps label aliases in the windows array and keeps unknown percent labels', () => {
    const windows = normalizeCustomPlan({
      windows: [
        { label: 'monthly', percent: 50 },
        { label: '7d', percent: 30 },
        { label: '5 hours', percent: 0.2 },
        { label: 'session', percent: 22 },
        { label: 'Credits', percent: 12, resetAt: '2026-12-01T00:00:00Z' },
        { label: 'weird window', percent: 5 },
        { label: 'Mystery' },
      ],
    })
    expect(windows).toEqual([
      { key: '5h', percent: 20 },
      { key: 'week', percent: 30 },
      { key: 'month', percent: 50 },
      { key: 'session', percent: 22 },
      { key: 'credits', percent: 12, name: 'Credits', resetsAt: '2026-12-01T00:00:00.000Z' },
      { key: 'weird-window', percent: 5, name: 'weird window' },
    ])
  })

  it('accepts flat windows objects, root maps and bare window arrays', () => {
    expect(normalizeCustomPlan({ windows: { rolling: { percent: 0.3 }, weekly: { percent: 44 } } }))
      .toEqual([{ key: '5h', percent: 30 }, { key: 'week', percent: 44 }])
    expect(normalizeCustomPlan({ rolling: { percent: 25 }, weekly: 0.5 }))
      .toEqual([{ key: '5h', percent: 25 }, { key: 'week', percent: 50 }])
    expect(normalizeCustomPlan([{ label: 'week', percent: 30 }, { label: '5h', percent: 11 }]))
      .toEqual([{ key: '5h', percent: 11 }, { key: 'week', percent: 30 }])
  })

  it('reads remaining/used fractions and percent strings', () => {
    expect(normalizeCustomPlan({ windows: [{ label: '5h', remaining: 0.4 }] })).toEqual([{ key: '5h', percent: 60 }])
    expect(normalizeCustomPlan({ windows: [{ label: 'week', remaining: 70 }] })).toEqual([{ key: 'week', percent: 30 }])
    expect(normalizeCustomPlan({ windows: [{ label: 'month', usedFraction: 0.8 }] })).toEqual([{ key: 'month', percent: 80 }])
    expect(normalizeCustomPlan({ windows: [{ label: '5h', percent: '40%' }] })).toEqual([{ key: '5h', percent: 40 }])
    expect(normalizeCustomPlan({ windows: [{ label: '5h', used_percent: 65 }] })).toEqual([{ key: '5h', percent: 65 }])
  })

  it('clamps percents, treats values below 1 as fractions and keeps 0/1 boundaries', () => {
    expect(normalizeCustomPlan({ windows: [{ label: '5h', percent: 0.5 }] })).toEqual([{ key: '5h', percent: 50 }])
    expect(normalizeCustomPlan({ windows: [{ label: '5h', percent: 120 }] })).toEqual([{ key: '5h', percent: 100 }])
    expect(normalizeCustomPlan({ windows: [{ label: '5h', percent: -10 }] })).toEqual([{ key: '5h', percent: 0 }])
    expect(normalizeCustomPlan({ windows: [{ label: '5h', percent: 0 }] })).toEqual([{ key: '5h', percent: 0 }])
    expect(normalizeCustomPlan({ windows: [{ label: '5h', percent: 1 }] })).toEqual([{ key: '5h', percent: 1 }])
  })

  it('parses ISO, epoch-seconds, epoch-millis and numeric-string resets; ignores bad resets', () => {
    const seconds = new Date(1756428000 * 1000).toISOString()
    for (const reset of [1756428000, 1756428000000, '1756428000', '2026-11-16T08:00:00Z', '2026-11-16T08:00:00.000Z']) {
      const expected = typeof reset === 'string' && reset.includes('T')
        ? new Date(reset).toISOString()
        : seconds
      expect(normalizeCustomPlan({ windows: [{ label: '5h', percent: 10, resetsAt: reset }] }))
        .toEqual([{ key: '5h', percent: 10, resetsAt: expected }])
    }
    expect(normalizeCustomPlan({ windows: [{ label: '5h', percent: 10, resetsAt: 'soon' }] }))
      .toEqual([{ key: '5h', percent: 10 }])
    expect(normalizeCustomPlan({ windows: [{ label: '5h', percent: 10, resetsAt: 0 }] }))
      .toEqual([{ key: '5h', percent: 10 }])
  })

  it('deduplicates keys with the first occurrence winning', () => {
    expect(normalizeCustomPlan({
      windows: [
        { label: '5h', percent: 10 },
        { label: 'rolling', percent: 20 },
        { label: 'week', percent: 5 },
        { label: 'weekly', percent: 6 },
      ],
    })).toEqual([{ key: '5h', percent: 10 }, { key: 'week', percent: 5 }])
  })

  it('caps the number of normalized windows', () => {
    const rows = Array.from({ length: CUSTOM_PLAN_LIMITS.maxWindows + 2 }, (_, index) => ({
      label: `Extra ${index}`,
      percent: index + 1,
    }))
    const windows = normalizeCustomPlan({ windows: rows })
    expect(windows).toHaveLength(CUSTOM_PLAN_LIMITS.maxWindows)
    expect(windows?.[0]?.key).toBe('extra-0')
  })

  it('accepts a JSON-string payload', () => {
    expect(normalizeCustomPlan(JSON.stringify({ usage: { weekly: { percent: 0.3 } } })))
      .toEqual([{ key: 'week', percent: 30 }])
  })

  it('returns undefined and never throws on unusable payloads', () => {
    const garbage: unknown[] = [
      undefined, null, 42, true, 'nope', {}, { usage: null }, { usage: 'x' },
      { usage: { rolling: {} } }, { usage: { rolling: { percent: 'abc' } } },
      { windows: 'x' }, { windows: [] }, { windows: [null, 42] }, [],
      JSON.stringify({ nothing: true }),
    ]
    for (const value of garbage) {
      expect(() => normalizeCustomPlan(value)).not.toThrow()
      expect(normalizeCustomPlan(value)).toBeUndefined()
    }
  })
})

describe('customPlanSnapshot', () => {
  const entry = parseCustomPlans(CONFIG_JSON).entries[0] as CustomPlanEntry
  const windows: PlanWindowView[] = [
    { key: '5h', percent: 40 },
    { key: 'week', percent: 10 },
  ]

  it('shapes a plain ProviderSnapshotView marked source custom', () => {
    const snapshot = customPlanSnapshot(entry, windows, 1_234_567_890)
    expect(snapshot).toEqual({
      provider: 'custom:my-plan',
      source: 'custom',
      displayName: 'My Plan',
      credential: 'env',
      supported: true,
      planSupported: true,
      plan: { windows, updatedAt: 1_234_567_890 },
      updatedAt: 1_234_567_890,
    })
    expect(snapshot).not.toHaveProperty('resolveHeaders')
  })

  it('copies the windows so later mutation cannot leak into the snapshot', () => {
    const input: PlanWindowView[] = [{ key: '5h', percent: 40 }]
    const snapshot = customPlanSnapshot(entry, input, 99)
    expect(snapshot.plan?.windows).toEqual([{ key: '5h', percent: 40 }])
    input.push({ key: 'week', percent: 5 })
    expect(snapshot.plan?.windows).toEqual([{ key: '5h', percent: 40 }])
  })

  it('never throws on garbage entries, windows or clocks', () => {
    expect(() => customPlanSnapshot(
      { id: 'x' } as unknown as CustomPlanEntry,
      undefined as unknown as PlanWindowView[],
      Number.NaN,
    )).not.toThrow()
    const snapshot = customPlanSnapshot({ id: 'x' } as unknown as CustomPlanEntry, [], Number.NaN)
    expect(snapshot.provider).toBe('custom:x')
    expect(snapshot.plan?.windows).toEqual([])
  })
})

describe('describeCustomPlanError', () => {
  it('returns the typed message and suppresses every credential', () => {
    const cases: Array<[string, string, string]> = [
      ['redirect', 'custom plan redirect refused', 'custom plan redirect refused'],
      ['auth', 'custom plan rejected the request (401/403)', 'custom plan rejected the request (401/403)'],
      ['http', 'custom plan HTTP 500', 'custom plan HTTP 500'],
      ['invalid-json', 'custom plan response was not valid JSON', 'custom plan response was not valid JSON'],
      ['no-windows', 'custom plan response contained no usable quota windows', 'custom plan response contained no usable quota windows'],
    ]
    for (const [code, message, expected] of cases) {
      expect(describeCustomPlanError(new CustomPlanError(code as CustomPlanError['code'], message))).toBe(expected)
    }
  })

  it('handles timeouts, transport failures and serialized errors', () => {
    const timeoutError = new Error('aborted')
    timeoutError.name = 'TimeoutError'
    expect(describeCustomPlanError(timeoutError)).toBe('custom plan request timed out')
    const transport = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })
    expect(describeCustomPlanError(transport)).toBe('custom plan request failed: fetch failed (ENOTFOUND)')
    expect(describeCustomPlanError({ code: 'http', message: 'custom plan HTTP 503' })).toBe('custom plan HTTP 503')
  })

  it('never throws on unknown garbage and never echoes secret-looking values', () => {
    for (const value of [undefined, null, 42, 'garbage', {}, { message: 42 }, () => 1]) {
      expect(() => describeCustomPlanError(value)).not.toThrow()
      expect(describeCustomPlanError(value)).toBe('custom plan request failed')
    }
    expect(describeCustomPlanError(new Error(PLAN_TOKEN))).not.toContain(PLAN_TOKEN)
  })
})

describe('CUSTOM_PLAN_LIMITS', () => {
  it('is frozen and exposes the documented caps', () => {
    expect(Object.isFrozen(CUSTOM_PLAN_LIMITS)).toBe(true)
    expect(CUSTOM_PLAN_LIMITS.maxEntries).toBe(12)
    expect(CUSTOM_PLAN_LIMITS.timeoutMs).toBe(8_000)
  })
})

/** A valid hand-built entry used by probe tests. */
function testEntry(): CustomPlanEntry {
  return {
    id: 'probe-plan',
    name: 'Probe Plan',
    url: 'http://127.0.0.1:8317/usage',
    host: '127.0.0.1',
    allowedHosts: [],
    headers: {},
    resolveHeaders: () => ({}),
  }
}
