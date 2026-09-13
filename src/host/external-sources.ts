/**
 * Independent quota sources which cannot be inferred from a normal model API key.
 * CPAMC uses its management key; Volcano Ark uses an AK/SK signature pair.
 * Portions of the protocol normalization are adapted from dsh-cost-meter (MIT).
 */
import { createHash, createHmac } from 'node:crypto'
import { adapterFor } from '../core/adapters.ts'
import type { PlanWindowView, ProviderSnapshotState } from '../core/types.ts'

export interface CpamcOptions {
  enabled: boolean
  baseURL: string
  managementKey?: string
}

export interface VolcanoOptions {
  enabled: boolean
  accessKeyId?: string
  secretAccessKey?: string
}

const timeout = (): AbortSignal => AbortSignal.timeout(15_000)

function clamp(value: unknown): number | undefined {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : undefined
}

function iso(value: unknown): string | undefined {
  const number = Number(value)
  const date = Number.isFinite(number) && number > 0
    ? new Date(number < 1e12 ? number * 1000 : number)
    : new Date(String(value ?? ''))
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function listOf(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (typeof payload !== 'object' || payload === null) return []
  const root = payload as Record<string, unknown>
  for (const key of ['auth_files', 'authFiles', 'files', 'accounts', 'data']) {
    if (Array.isArray(root[key])) return root[key] as unknown[]
  }
  return []
}

function cpamcOrigin(raw: string): string | undefined {
  try {
    const url = new URL(raw)
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return undefined
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'
    if (!loopback || (url.protocol !== 'http:' && url.protocol !== 'https:')) return undefined
    return url.origin
  } catch {
    return undefined
  }
}

async function cpamcFetch(origin: string, path: string, key: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(origin + path, {
    ...init,
    redirect: 'manual',
    signal: timeout(),
    headers: { accept: 'application/json', 'content-type': 'application/json', 'x-management-key': key, ...init?.headers },
  })
  if (response.status >= 300 && response.status < 400) throw new Error('CPAMC redirect refused')
  if (!response.ok) throw new Error(`CPAMC HTTP ${response.status}`)
  return response.json()
}

function cpamcProvider(row: Record<string, unknown>): 'codex' | 'kimi' | 'claude' | undefined {
  const raw = String(row.provider ?? row.type ?? '').toLowerCase()
  if (raw.includes('codex')) return 'codex'
  if (raw.includes('kimi')) return 'kimi'
  if (raw.includes('claude') || raw.includes('anthropic')) return 'claude'
  return undefined
}

function cpamcRequest(provider: 'codex' | 'kimi' | 'claude', account: Record<string, unknown>): { url: string; headers: Record<string, string> } {
  if (provider === 'kimi') return { url: 'https://api.kimi.com/coding/v1/usages', headers: { authorization: 'Bearer $TOKEN$' } }
  if (provider === 'claude') return { url: 'https://api.anthropic.com/api/oauth/usage', headers: { authorization: 'Bearer $TOKEN$', 'anthropic-version': '2023-06-01' } }
  const accountId = String(account.chatgpt_account_id ?? account.chatgptAccountId ?? '')
  return { url: 'https://chatgpt.com/backend-api/wham/usage', headers: { authorization: 'Bearer $TOKEN$', ...(accountId ? { 'chatgpt-account-id': accountId } : {}) } }
}

function cpamcWindows(provider: 'codex' | 'kimi' | 'claude', body: unknown): PlanWindowView[] {
  if (provider === 'codex') return adapterFor('openai-codex')?.plan?.parse(200, body)?.windows ?? []
  if (provider === 'kimi') return adapterFor('kimi-coding')?.plan?.parse(200, body)?.windows ?? []
  if (typeof body !== 'object' || body === null) return []
  const root = body as Record<string, unknown>
  const windows: PlanWindowView[] = []
  for (const [field, key] of [['five_hour', '5h'], ['seven_day', 'week']] as const) {
    const row = root[field]
    if (typeof row !== 'object' || row === null) continue
    const item = row as Record<string, unknown>
    const percent = clamp(item.utilization ?? item.used_percent)
    if (percent !== undefined) windows.push({ key, percent, resetsAt: iso(item.resets_at ?? item.reset_at) })
  }
  return windows
}

/** Query supported accounts through CPAMC's fixed, read-only management routes. */
export async function probeCpamc(options: CpamcOptions): Promise<ProviderSnapshotState[]> {
  const origin = cpamcOrigin(options.baseURL)
  if (!options.enabled || origin === undefined || !options.managementKey) return []
  const auth = await cpamcFetch(origin, '/v0/management/auth-files', options.managementKey)
  const output: ProviderSnapshotState[] = []
  let index = 0
  for (const raw of listOf(auth).slice(0, 16)) {
    if (typeof raw !== 'object' || raw === null) continue
    const account = raw as Record<string, unknown>
    const authIndex = String(account.auth_index ?? account.authIndex ?? '')
    const provider = cpamcProvider(account)
    if (!authIndex || provider === undefined) continue
    const request = cpamcRequest(provider, account)
    const envelope = await cpamcFetch(origin, '/v0/management/api-call', options.managementKey, {
      method: 'POST',
      body: JSON.stringify({ auth_index: authIndex, method: 'GET', url: request.url, header: request.headers }),
    })
    if (typeof envelope !== 'object' || envelope === null) continue
    const wrapped = envelope as Record<string, unknown>
    const status = Number(wrapped.status_code)
    if (status < 200 || status >= 300 || typeof wrapped.body !== 'string') continue
    let body: unknown
    try { body = JSON.parse(wrapped.body) } catch { continue }
    const windows = cpamcWindows(provider, body).filter((window) => window.percent !== undefined)
    if (windows.length === 0) continue
    const label = String(account.email ?? account.label ?? `账号 ${index + 1}`)
    output.push({
      provider: `cpamc:${provider}:${index}`,
      displayName: `CPAMC · ${provider} · ${label.replace(/^(.).*(@.*)$/, '$1***$2')}`,
      credential: 'env', supported: true, planSupported: true, source: 'cpamc',
      plan: { windows, updatedAt: Date.now() }, updatedAt: Date.now(),
    })
    index += 1
  }
  return output
}

const VOLC_HOST = 'open.volcengineapi.com'
const VOLC_ACTIONS = ['GetCodingPlanUsage', 'GetAFPUsage', 'GetUsageDetails', 'GetPersonalPlan']

function sha(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex') }
function hmac(key: string | Buffer, value: string): Buffer { return createHmac('sha256', key).update(value, 'utf8').digest() }
function queryString(query: Record<string, string>): string {
  return Object.keys(query).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`).join('&')
}
function volcHeaders(ak: string, sk: string, query: Record<string, string>): Record<string, string> {
  const xDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = xDate.slice(0, 8)
  const bodySha = sha('')
  const signedHeaders = 'host;x-content-sha256;x-date'
  const canonicalHeaders = `host:${VOLC_HOST}\nx-content-sha256:${bodySha}\nx-date:${xDate}`
  const request = ['GET', '/', queryString(query), `${canonicalHeaders}\n`, signedHeaders, bodySha].join('\n')
  const scope = `${date}/cn-beijing/ark/request`
  const toSign = ['HMAC-SHA256', xDate, scope, sha(request)].join('\n')
  const signature = hmac(hmac(hmac(hmac(sk, date), 'cn-beijing'), 'ark'), 'request')
  const hex = createHmac('sha256', signature).update(toSign, 'utf8').digest('hex')
  return { 'x-date': xDate, 'x-content-sha256': bodySha, host: VOLC_HOST, authorization: `HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=${signedHeaders}, Signature=${hex}` }
}

function volcKey(raw: unknown): string | undefined {
  const value = String(raw ?? '').toLowerCase()
  if (value.includes('session') || value.includes('5h') || value.includes('five')) return '5h'
  if (value.includes('week')) return 'week'
  if (value.includes('month')) return 'month'
  return undefined
}

function volcWindows(body: unknown): PlanWindowView[] {
  if (typeof body !== 'object' || body === null) return []
  const root = body as Record<string, any>
  const result = root.Result ?? root.result ?? root.data?.Result ?? root.data ?? root
  const rows = result?.QuotaUsage ?? result?.quotaUsage ?? result?.UsageDetails ?? result?.usageDetails ?? result?.periods ?? result?.items
  if (!Array.isArray(rows)) return []
  const windows: PlanWindowView[] = []
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const key = volcKey(row.Level ?? row.level ?? row.QuotaType ?? row.quotaType ?? row.Label ?? row.label ?? row.Period ?? row.period)
    if (key === undefined) continue
    let percent = clamp(row.Percent ?? row.percent ?? row.percentage ?? row.UsedPercent ?? row.usedPercent)
    const total = Number(row.Total ?? row.total ?? row.Limit ?? row.limit ?? row.Cap ?? row.cap)
    const used = Number(row.Used ?? row.used ?? row.Usage ?? row.usage)
    if (percent === undefined && Number.isFinite(total) && total > 0 && Number.isFinite(used)) percent = clamp(used / total * 100)
    if (percent !== undefined) windows.push({ key, percent, resetsAt: iso(row.ResetTimestamp ?? row.resetTimestamp ?? row.ResetTime ?? row.resetTime ?? row.resetAt) })
  }
  return windows
}

/** Query Volcano Ark's official control-plane Plan endpoint using AK/SK HMAC. */
export async function probeVolcano(options: VolcanoOptions): Promise<ProviderSnapshotState[]> {
  if (!options.enabled || !options.accessKeyId || !options.secretAccessKey) return []
  let lastError = 'no quota response'
  for (const action of VOLC_ACTIONS) {
    const query = { Action: action, Version: '2024-01-01' }
    try {
      const response = await fetch(`https://${VOLC_HOST}/?${queryString(query)}`, { headers: volcHeaders(options.accessKeyId, options.secretAccessKey, query), redirect: 'manual', signal: timeout() })
      const body: unknown = await response.json().catch(() => undefined)
      if (!response.ok) { lastError = `HTTP ${response.status}`; continue }
      const windows = volcWindows(body).filter((window) => window.percent !== undefined)
      if (windows.length === 0) { lastError = 'unrecognized response shape'; continue }
      return [{ provider: 'volcano:ark-plan', displayName: '火山方舟 Coding Plan', credential: 'env', supported: true, planSupported: true, source: 'volcano', plan: { windows, updatedAt: Date.now() }, updatedAt: Date.now() }]
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  return [{ provider: 'volcano:ark-plan', displayName: '火山方舟 Coding Plan', credential: 'env', supported: true, planSupported: true, source: 'volcano', planError: lastError, updatedAt: Date.now() }]
}
