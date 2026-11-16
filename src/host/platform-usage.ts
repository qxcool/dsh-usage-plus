/**
 * Official DeepSeek platform (billing console) facts, read with the host's own
 * logged-in platform grant. The console API is internal and undocumented, so
 * every failure degrades to a typed `UsagePlatformView` instead of throwing:
 * signed out means `unavailable`, an expired grant or a bad upstream response
 * means `error` with a short credential-free message.
 *
 * The token comes from DSH itself — `deepseekAccount.getPlatformSession()`
 * when that service is present, else the `deepseek-account-platform/default`
 * grant record — so the user never pastes a console token. Response
 * normalization is adapted from DeepSeek-Usage (MIT, commit 0cba805f94); this
 * module reads cost facts only (no per-model token/amount detail).
 * @module @linxin666/dsh-usage-plus/host/platform-usage
 */

import type { Context } from '@deepseek-ai/cordis'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import type { UsagePlatformView } from '../core/types.ts'

/** Default console origin. */
export const PLATFORM_ORIGIN = 'https://platform.deepseek.com'

/** Desktop Chrome UA; the upstream rate-limits (429) requests without one. */
export const PLATFORM_DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Console client version header; the upstream 429s without it too. */
export const PLATFORM_APP_VERSION = '0.1.0'

/** Endpoint for wallets + lifetime spend (all-time facts). */
const SUMMARY_PATH = '/api/v0/users/get_user_summary'

/** Endpoint for the requested month's per-day cost detail. */
const COST_PATH = '/api/v0/usage/cost'

/** Host credential record scope/id DSH's deepseek-account plugin writes. */
const PLATFORM_CREDENTIAL_SCOPE = 'deepseek-account-platform'
const PLATFORM_CREDENTIAL_ID = 'default'

/** Per-request timeout budget. */
const PLATFORM_TIMEOUT_MS = 10_000

/** Small backoff before the single retry of a 429/5xx response. */
const PLATFORM_RETRY_DELAY_MS = 500

/** Envelope codes the console uses for a signed-out/expired session. */
const AUTH_ERROR_CODES = new Set([40001, 40002, 40003, 401, 403])

/** Marker message for a non-JSON upstream body (mapped to a display string). */
const INVALID_JSON_MESSAGE = 'platform response was not valid JSON'

/** Options for {@link fetchPlatformUsage}; every seam is injectable for tests. */
export interface PlatformUsageOptions {
  /** Fetch implementation; defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Clock; defaults to `Date.now`. */
  now?: () => number
  /** Console origin override (tests / a relocated console). */
  origin?: string
  /** `x-app-version` override; defaults to {@link PLATFORM_APP_VERSION}. */
  appVersion?: string
  /** `user-agent` override; defaults to {@link PLATFORM_DESKTOP_USER_AGENT}. */
  userAgent?: string
  /** Query month (1-12) override; defaults to the current local month. */
  month?: number
  /** Query year override; defaults to the current local year. */
  year?: number
  /** Per-request timeout in ms; defaults to 10s. */
  timeoutMs?: number
  /** Delay before the single 429/5xx retry in ms; defaults to 500. */
  retryDelayMs?: number
}

/** One official per-day cost fact. */
export interface PlatformCostDay {
  /** Local-date key `YYYY-MM-DD`. */
  date: string
  /** Official spend for that day in CNY. */
  cost: number
}

/** Month/year context used to resolve bare day-of-month rows and filter days. */
export interface PlatformCostDaysOptions {
  /** Calendar month 1-12. When both month and year are given, other months are dropped. */
  month?: number
  /** Calendar year. */
  year?: number
}

/** All-time facts read from `get_user_summary`. */
export interface PlatformSummaryFacts {
  /** Lifetime spend in CNY (`total_costs`); absent when the API reports none. */
  cumulativeCost?: number
}

/** The resolved platform grant. */
export interface PlatformToken {
  token: string
  /** Origin the session belongs to, when the account service reports one. */
  origin?: string
}

/** Session shape returned by the (optional) `deepseekAccount` service. */
interface PlatformSessionLike {
  origin?: unknown
  token?: unknown
}

/** The optional `deepseekAccount` service surface used here. */
interface DeepSeekAccountService {
  getPlatformSession?: () => PlatformSessionLike | null | undefined | Promise<PlatformSessionLike | null | undefined>
}

/** The optional `credentials` service surface used here. */
interface CredentialsService {
  readRecord?: (key: unknown) => Promise<{ kind?: unknown; payload?: unknown } | undefined>
}

/** Best-effort typed service read: absent services resolve to undefined at runtime. */
function service<T>(ctx: Context, name: string): T | undefined {
  try {
    return (ctx as unknown as { get(name: string): unknown }).get(name) as T | undefined
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/** Parse a JSON-string payload, else return the value unchanged. */
function unwrapJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (text === '' || (text[0] !== '{' && text[0] !== '[')) return value
  try {
    return JSON.parse(text) as unknown
  } catch {
    return value
  }
}

/** Number from a number or numeric string (thousands separators tolerated). */
function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return undefined
  const text = value.trim().replace(/,/g, '')
  if (text === '') return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Keep sums free of binary-float noise without truncating real precision. */
function roundAmount(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function isValidDay(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (month < 1 || month > 12 || day < 1) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function formatDay(year: number, month: number, day: number): string | undefined {
  return isValidDay(year, month, day) ? `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}` : undefined
}

/** Normalize one date-ish value to `YYYY-MM-DD`; bare day numbers need month/year. */
function resolveDayDate(value: unknown, year?: number, month?: number): string | undefined {
  const parsed = unwrapJson(value)
  if (typeof parsed === 'number') return resolveNumericDay(parsed, year, month)
  if (typeof parsed !== 'string') return undefined
  const text = parsed.trim()
  if (text === '') return undefined
  const separated = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text)
  if (separated !== null) return formatDay(Number(separated[1]), Number(separated[2]), Number(separated[3]))
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text)
  if (compact !== null) return formatDay(Number(compact[1]), Number(compact[2]), Number(compact[3]))
  const numeric = Number(text)
  return Number.isFinite(numeric) ? resolveNumericDay(numeric, year, month) : undefined
}

/** `1..31` reads as day-of-month inside the given month; larger values read as epoch. */
function resolveNumericDay(value: number, year?: number, month?: number): string | undefined {
  if (!Number.isFinite(value)) return undefined
  if (Number.isInteger(value) && value >= 1 && value <= 31) {
    return year !== undefined && month !== undefined ? formatDay(year, month, value) : undefined
  }
  const millis = value >= 1e12 ? value : value >= 1e9 ? value * 1000 : undefined
  if (millis === undefined) return undefined
  const date = new Date(millis)
  if (Number.isNaN(date.getTime())) return undefined
  return formatDay(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/** Strip the console envelope until the `biz_data` payload is reached. */
function platformBizData(payload: unknown): unknown {
  let node = unwrapJson(payload)
  for (let depth = 0; depth < 3; depth += 1) {
    if (!isRecord(node)) return node
    const next = unwrapJson(node.biz_data ?? node.bizData ?? node.data)
    if (next === undefined) return node
    node = next
  }
  return node
}

const COST_NESTED_KEYS = ['biz_data', 'bizData', 'data', 'days', 'costs', 'items', 'list', 'rows', 'detail', 'details'] as const
const DATE_FIELD_KEYS = ['date', 'date_str', 'dateStr', 'dayStr', 'stat_date', 'statDate', 'biz_date', 'bizDate', 'timestamp', 'time', 'ts', 'dt'] as const
const COST_FIELD_KEYS = ['cost', 'amount', 'total', 'value', 'fee', 'spend', 'price'] as const

function pickField(row: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key]
  }
  return undefined
}

/** Read one `{date, cost}` row, tolerating field-name drift and bare day numbers. */
function readCostDay(row: Record<string, unknown>, month?: number, year?: number): PlatformCostDay | undefined {
  let date = resolveDayDate(pickField(row, DATE_FIELD_KEYS), year, month)
  if (date === undefined && row.day !== undefined) {
    const rowYear = numberValue(row.year)
    const rowMonth = numberValue(row.month)
    date = resolveDayDate(row.day, rowYear !== undefined ? rowYear : year, rowMonth !== undefined ? rowMonth : month)
  }
  if (date === undefined) return undefined
  const cost = numberValue(pickField(row, COST_FIELD_KEYS))
  if (cost === undefined) return undefined
  return { date, cost }
}

/**
 * Normalize the `/usage/cost` payload to sorted official day rows.
 *
 * Tolerates the console's envelope drift (`biz_data` object/array/JSON string),
 * a bare array of day rows, and per-API-key rows carrying a `days` array.
 * Duplicate dates are summed. When both `month` and `year` are supplied, days
 * outside that calendar month are dropped (the console can return neighbours).
 */
export function normalizePlatformCostDays(payload: unknown, options: PlatformCostDaysOptions = {}): PlatformCostDay[] {
  const month = options.month
  const year = options.year
  const monthKey = month !== undefined && year !== undefined ? `${String(year).padStart(4, '0')}-${pad2(month)}` : undefined
  const totals = new Map<string, number>()
  const visit = (node: unknown): void => {
    const value = unwrapJson(node)
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (!isRecord(value)) return
    const day = readCostDay(value, month, year)
    if (day !== undefined) {
      totals.set(day.date, (totals.get(day.date) ?? 0) + day.cost)
      return
    }
    for (const key of COST_NESTED_KEYS) {
      if (value[key] !== undefined) visit(value[key])
    }
  }
  visit(payload)
  const days: PlatformCostDay[] = []
  for (const [date, cost] of totals) {
    if (monthKey !== undefined && !date.startsWith(monthKey)) continue
    days.push({ date, cost: roundAmount(cost) })
  }
  days.sort((left, right) => left.date.localeCompare(right.date))
  return days
}

/** Find the `total_costs` rows anywhere in the summary envelope. */
function findTotalCostRows(node: unknown): unknown[] {
  if (Array.isArray(node)) {
    for (const item of node) {
      const nested = findTotalCostRows(item)
      if (nested.length > 0) return nested
    }
    return []
  }
  if (!isRecord(node)) return []
  for (const key of ['total_costs', 'totalCosts', 'total_cost', 'totalCost'] as const) {
    const value = unwrapJson(node[key])
    if (value === undefined) continue
    if (Array.isArray(value)) return value
    if (isRecord(value)) {
      return Object.entries(value).map(([currency, amount]) => (isRecord(amount) ? { currency, ...amount } : { currency, amount }))
    }
    return [value]
  }
  return []
}

/**
 * Normalize `get_user_summary` to the all-time CNY spend. Wallet balances are
 * deliberately ignored: the reconcile strip only needs `total_costs`, and the
 * balance card already reads DeepSeek's public `/user/balance` endpoint.
 */
export function normalizePlatformSummary(payload: unknown): PlatformSummaryFacts {
  const rows = findTotalCostRows(platformBizData(payload))
  let cumulative: number | undefined
  for (const raw of rows) {
    const row = unwrapJson(raw)
    if (!isRecord(row)) {
      const amount = numberValue(row)
      if (amount !== undefined) cumulative = (cumulative ?? 0) + amount
      continue
    }
    const currency = (nonEmptyString(row.currency) ?? nonEmptyString(row.currency_code) ?? nonEmptyString(row.currencyCode) ?? 'CNY').toUpperCase()
    if (currency !== 'CNY' && currency !== 'RMB') continue
    const amount = numberValue(row.amount ?? row.total ?? row.value ?? row.cost)
    if (amount !== undefined) cumulative = (cumulative ?? 0) + amount
  }
  return cumulative === undefined ? {} : { cumulativeCost: roundAmount(cumulative) }
}

/** Normalize an origin string to a bare `scheme://host[:port]`. */
function normalizeOrigin(value: unknown): string | undefined {
  const raw = nonEmptyString(value)
  if (raw === undefined) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    if (url.username !== '' || url.password !== '') return undefined
    if (url.search !== '' || url.hash !== '') return undefined
    return url.origin
  } catch {
    return undefined
  }
}

/**
 * Resolve the host's platform grant: prefer the live `deepseekAccount` session,
 * fall back to the stored `deepseek-account-platform/default` grant record.
 * Returns undefined when neither source yields a token; never throws.
 */
export async function resolvePlatformToken(ctx: Context): Promise<PlatformToken | undefined> {
  const account = service<DeepSeekAccountService>(ctx, 'deepseekAccount')
  const getPlatformSession = account?.getPlatformSession
  if (typeof getPlatformSession === 'function') {
    try {
      const session = await getPlatformSession.call(account)
      const token = isRecord(session) ? nonEmptyString(session.token) : undefined
      if (token !== undefined) {
        const origin = isRecord(session) ? normalizeOrigin(session.origin) : undefined
        return origin === undefined ? { token } : { token, origin }
      }
    } catch {
      // Fall through to the stored grant.
    }
  }
  const credentials = service<CredentialsService>(ctx, 'credentials')
  const readRecord = credentials?.readRecord
  if (typeof readRecord !== 'function') return undefined
  try {
    const record = await readRecord.call(credentials, credentialKey(PLATFORM_CREDENTIAL_SCOPE, PLATFORM_CREDENTIAL_ID))
    if (record?.kind !== 'grant') return undefined
    const payload = unwrapJson(record.payload)
    if (!isRecord(payload)) return undefined
    const token = nonEmptyString(payload.token)
    if (token === undefined) return undefined
    const origin = normalizeOrigin(payload.origin)
    return origin === undefined ? { token } : { token, origin }
  } catch {
    return undefined
  }
}

/** Console request headers; the browser UA + app version keep the upstream from 429ing. */
function buildHeaders(token: string, origin: string, options: PlatformUsageOptions): Record<string, string> {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'x-dsh-auth-token': token,
    'user-agent': nonEmptyString(options.userAgent) ?? PLATFORM_DESKTOP_USER_AGENT,
    'x-app-version': nonEmptyString(options.appVersion) ?? PLATFORM_APP_VERSION,
    origin,
    referer: `${origin}/usage`,
  }
}

/** Console envelope code, when the body carries one. */
function envelopeCode(payload: unknown): number | undefined {
  const root = unwrapJson(payload)
  if (!isRecord(root)) return undefined
  const error = unwrapJson(root.error)
  const raw = root.code ?? root.errno ?? (isRecord(error) ? error.code : undefined)
  if (raw === undefined || raw === null || raw === '') return undefined
  const code = Number(raw)
  return Number.isFinite(code) ? code : undefined
}

class PlatformAuthError extends Error {
  constructor() {
    super('platform session expired')
    this.name = 'PlatformAuthError'
  }
}

class PlatformHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`platform HTTP ${status}`)
    this.name = 'PlatformHttpError'
    this.status = status
  }
}

class PlatformApiError extends Error {
  readonly code: number

  constructor(code: number) {
    super(`platform API error ${code}`)
    this.name = 'PlatformApiError'
    this.code = code
  }
}

/** Short, credential-free display message for any fetch/normalize failure. */
function platformErrorMessage(error: unknown): string {
  if (error instanceof PlatformAuthError) return 'platform session expired'
  if (error instanceof PlatformHttpError) return `platform HTTP ${error.status}`
  if (error instanceof PlatformApiError) return `platform API error ${error.code}`
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'platform request timed out'
    if (error.message === INVALID_JSON_MESSAGE) return 'platform response was not valid JSON'
  }
  return 'platform request failed'
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * GET one console endpoint as JSON, retrying a 429/5xx once. Auth failures and
 * envelope auth codes are raised immediately (no retry); anything else is a
 * typed error for the caller to degrade.
 */
async function requestJson(fetchImpl: typeof fetch, url: string, headers: Record<string, string>, options: PlatformUsageOptions): Promise<unknown> {
  const timeoutMs = options.timeoutMs !== undefined && options.timeoutMs > 0 ? options.timeoutMs : PLATFORM_TIMEOUT_MS
  const retryDelayMs = options.retryDelayMs !== undefined ? Math.max(0, options.retryDelayMs) : PLATFORM_RETRY_DELAY_MS
  let attempt = 0
  for (;;) {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if ((response.status === 429 || response.status >= 500) && attempt === 0) {
      attempt = 1
      await sleep(retryDelayMs)
      continue
    }
    if (response.status === 401 || response.status === 403) throw new PlatformAuthError()
    if (!response.ok) throw new PlatformHttpError(response.status)
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new Error(INVALID_JSON_MESSAGE)
    }
    const code = envelopeCode(body)
    if (code !== undefined && code !== 0 && code !== 200) {
      if (AUTH_ERROR_CODES.has(code)) throw new PlatformAuthError()
      throw new PlatformApiError(code)
    }
    return body
  }
}

/** Resolve the local month the cost endpoint is queried for. */
function resolvePeriod(nowMs: number, options: PlatformUsageOptions): { month: number; year: number } {
  const local = new Date(nowMs)
  const month = typeof options.month === 'number' && Number.isInteger(options.month) && options.month >= 1 && options.month <= 12
    ? options.month
    : local.getMonth() + 1
  const year = typeof options.year === 'number' && Number.isInteger(options.year) && options.year >= 1970 && options.year <= 9999
    ? options.year
    : local.getFullYear()
  return { month, year }
}

/**
 * Read the official DeepSeek platform month cost, lifetime cost and per-day
 * month cost through the host's own platform grant.
 *
 * Never throws. Returns `unavailable` (no network call) when no grant is
 * resolvable, `error` with a short message when the upstream rejects or
 * misbehaves, and `ready` with official CNY facts otherwise. `localMonthCost`,
 * `coverage` and `delta` are the integrating service's ledger facts, so they
 * are intentionally not filled here.
 */
export async function fetchPlatformUsage(ctx: Context, options: PlatformUsageOptions = {}): Promise<UsagePlatformView> {
  const now = options.now ?? Date.now
  const timestamp = (): number => now()
  const token = await resolvePlatformToken(ctx)
  if (token === undefined) return { status: 'unavailable', currency: 'CNY', updatedAt: timestamp() }
  const origin = normalizeOrigin(options.origin) ?? normalizeOrigin(token.origin) ?? PLATFORM_ORIGIN
  const period = resolvePeriod(timestamp(), options)
  const headers = buildHeaders(token.token, origin, options)
  const fetchImpl = options.fetch ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    return { status: 'error', currency: 'CNY', updatedAt: timestamp(), error: 'platform fetch is unavailable' }
  }
  try {
    const summary = await requestJson(fetchImpl, `${origin}${SUMMARY_PATH}`, headers, options)
    const cost = await requestJson(fetchImpl, `${origin}${COST_PATH}?month=${String(period.month)}&year=${String(period.year)}`, headers, options)
    const facts = normalizePlatformSummary(summary)
    const days = normalizePlatformCostDays(cost, period)
    const monthCost = roundAmount(days.reduce((total, day) => total + day.cost, 0))
    return {
      status: 'ready',
      currency: 'CNY',
      monthCost,
      ...(facts.cumulativeCost !== undefined ? { cumulativeCost: facts.cumulativeCost } : {}),
      days,
      updatedAt: timestamp(),
    }
  } catch (error) {
    return { status: 'error', currency: 'CNY', updatedAt: timestamp(), error: platformErrorMessage(error) }
  }
}
