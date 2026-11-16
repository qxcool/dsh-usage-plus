/**
 * Generic "custom plan" quota source: users can point the Host at an arbitrary
 * quota endpoint without waiting for a shipped provider adapter. The module is
 * deliberately transport-only and pure-to-the-edge so the service can store a
 * plain `ProviderSnapshotView`:
 *
 * 1. {@link parseCustomPlans} validates the user-supplied JSON config (from a
 *    settings string) and never throws — every bad field is reported per entry.
 * 2. {@link probeCustomPlan} GETs the endpoint under the Host's own trust
 *    rules: allow-listed/loopback hosts only, redirects refused, 8s timeout,
 *    secrets read from the Host environment and never echoed in errors.
 * 3. {@link normalizeCustomPlan} accepts the two payload shapes seen in the
 *    wild (opencode-style `usage` object and a `windows` array) and returns
 *    sorted `PlanWindowView`s.
 * 4. {@link customPlanSnapshot} shapes the probe result into the wire view the
 *    overview/Plans tab already renders.
 *
 * Header values may be literals or `${env:NAME}` references; the parser keeps
 * them unresolved and {@link resolveHeaders} fills them in host-side only.
 * @module @linxin666/dsh-usage-plus/host/custom-plans
 */

import { isLoopbackHostname } from './loopback.ts'
import type { PlanWindowView, ProviderSnapshotView } from '../core/types.ts'

/** Hard bounds that keep a user-supplied config small, bounded and safe. */
export const CUSTOM_PLAN_LIMITS = Object.freeze({
  /** Maximum number of entries accepted from the JSON document. */
  maxEntries: 12,
  /** Maximum number of `allowedHosts` entries per plan. */
  maxAllowedHosts: 8,
  /** Maximum number of custom request headers per plan. */
  maxHeaders: 16,
  /** Maximum number of normalized windows returned per probe. */
  maxWindows: 8,
  /** Maximum `id` length (the id pattern itself allows 32). */
  maxIdLength: 32,
  /** Maximum display-name length. */
  maxNameLength: 64,
  /** Maximum absolute URL length. */
  maxUrlLength: 2048,
  /** Maximum hostname length (DNS allows 253). */
  maxHostLength: 253,
  /** Maximum header-name length. */
  maxHeaderNameLength: 64,
  /** Maximum raw header-value length. */
  maxHeaderValueLength: 1024,
  /** Maximum environment-variable name length. */
  maxEnvNameLength: 64,
  /** Default probe timeout in milliseconds. */
  timeoutMs: 8_000,
} as const)

/** Resolve one environment variable host-side; explorer for tests. */
export type CustomPlanEnvReader = (name: string) => string | undefined

/** Typed, secret-free failure codes produced by parsing/probing. */
export type CustomPlanErrorCode =
  /** The request or its configured timeout was aborted. */
  | 'timeout'
  /** The transport rejected (DNS/TLS/connection reset/...). */
  | 'network'
  /** A 3xx response was refused (no redirects are followed). */
  | 'redirect'
  /** 401/403: the endpoint rejected the (never echoed) credential. */
  | 'auth'
  /** Any other non-2xx response. */
  | 'http'
  /** A 2xx body that is not valid JSON. */
  | 'invalid-json'
  /** Valid JSON without one usable quota window. */
  | 'no-windows'
  /** `tokenEnv` is configured but the host environment does not define it. */
  | 'missing-token'
  /** A hand-built entry is structurally invalid. */
  | 'invalid-config'
  /** A header name/value (or token value) failed the safety checks. */
  | 'unsafe-header'
  /** URL is not absolute http(s), carries credentials/fragment, or too long. */
  | 'invalid-url'
  /** URL host is neither loopback nor listed in `allowedHosts`. */
  | 'not-allowed'

/** A typed probe/config failure. Messages never contain secret values. */
export class CustomPlanError extends Error {
  readonly code: CustomPlanErrorCode
  readonly status?: number

  constructor(code: CustomPlanErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'CustomPlanError'
    this.code = code
    if (status !== undefined) this.status = status
  }
}

/** One validated custom plan. Headers stay unresolved until probed. */
export interface CustomPlanEntry {
  /** URL-safe unique id (`/^[a-z0-9][a-z0-9-]{0,31}$/`). */
  id: string
  /** Display name; falls back to the id. */
  name: string
  /** Normalized absolute endpoint URL. */
  url: string
  /** URL hostname (lowercased, no port). */
  host: string
  /** Extra hosts allowed besides loopback, lowercased. */
  allowedHosts: string[]
  /** Environment variable holding the bearer token, when configured. */
  tokenEnv?: string
  /** Unresolved request headers (literal or `${env:NAME}` values). */
  headers: Record<string, string>
  /** Resolve `${env:NAME}` header values; unresolved references drop the header. */
  resolveHeaders(getEnv: CustomPlanEnvReader): Record<string, string>
  /** Optional free-form label from the config document (kept for forward compat). */
  label?: string
}

/** One config-validation problem. `index -1` means the whole document. */
export interface CustomPlanConfigError {
  /** 0-based entry index, or -1 for a document-level error. */
  index: number
  /** Entry id when the id itself parsed far enough to identify the entry. */
  id?: string
  /** Field path (`id`, `url`, `headers.x-tenant`, ...) or `document`/`entry`. */
  field: string
  /** Secret-free human message. */
  message: string
}

/** Result of {@link parseCustomPlans}; bad entries are dropped, never thrown. */
export interface CustomPlansParseResult {
  entries: CustomPlanEntry[]
  errors: CustomPlanConfigError[]
}

/** Options for {@link probeCustomPlan}; every seam is injectable for tests. */
export interface CustomPlanProbeOptions {
  /** Fetch implementation; defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Optional caller abort signal, combined with the timeout. */
  signal?: AbortSignal
  /** Per-request timeout in ms; defaults to {@link CUSTOM_PLAN_LIMITS.timeoutMs}. */
  timeoutMs?: number
  /** Environment reader for `tokenEnv` + `${env:NAME}` headers; defaults to `process.env`. */
  env?: CustomPlanEnvReader
  /** Clock; defaults to `Date.now`. */
  now?: () => number
}

/** Successful probe: normalized plan windows. */
export interface CustomPlanProbeSuccess {
  ok: true
  /** HTTP status of the accepted response. */
  status: number
  /** Normalized windows (always at least one). */
  windows: PlanWindowView[]
  /** Probe completion instant (epoch ms). */
  updatedAt: number
}

/** Failed probe: a typed, secret-free error. */
export interface CustomPlanProbeFailure {
  ok: false
  error: CustomPlanError
}

/** Probe outcome; callers branch on `ok`. */
export type CustomPlanProbeResult = CustomPlanProbeSuccess | CustomPlanProbeFailure

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/
const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/

/** Header names are HTTP tokens; values may only carry `${env:NAME}` references. */
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9a-z]+$/i
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/
const ENV_REFERENCE_PATTERN = /\$\{env:([A-Za-z_][A-Za-z0-9_]{0,63})\}/g
const ANY_REFERENCE_PATTERN = /\$\{([^}]*)\}/g

/** Request headers a custom plan may never override (Hop-by-hop + Host + auth). */
const FORBIDDEN_HEADERS = new Set([
  'accept-encoding',
  'authorization',
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

/** Canonical window keys in rendering order. */
const CANONICAL_WINDOW_ORDER = ['5h', 'week', 'month', 'session'] as const

const PERCENT_FIELDS = [
  'percent',
  'used_percent',
  'usedPercent',
  'usedPercentage',
  'used_percentage',
  'percentage',
  'utilization',
  'utilisation',
  'usagePercent',
  'usage_percent',
] as const

const REMAINING_FIELDS = [
  'remaining',
  'remainingPercent',
  'remaining_percent',
  'remainingPercentage',
  'remaining_percentage',
  'remain',
  'left',
] as const

const USED_FRACTION_FIELDS = ['usedFraction', 'used_fraction'] as const
const REMAINING_FRACTION_FIELDS = ['remainingFraction', 'remaining_fraction'] as const

const RESET_FIELDS = [
  'resetsAt',
  'resetAt',
  'resets_at',
  'reset_at',
  'resetTime',
  'reset_time',
  'nextResetAt',
  'next_reset_at',
  'nextResetTime',
] as const

const LABEL_FIELDS = ['label', 'name', 'key', 'window', 'title', 'period', 'type'] as const

/** One window extracted from an arbitrary payload, before canonical shaping. */
interface RawWindow {
  key: string
  name?: string
  percent: number
  resetsAt?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parse a JSON-string payload, else return it unchanged (garbage → undefined). */
function unwrapJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (text === '' || (text[0] !== '{' && text[0] !== '[')) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** Number from a number or numeric string (`"40%"` / `"0.35"` tolerated). */
function numericValue(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return undefined
  const text = value.trim().replace(/%$/, '')
  if (text === '') return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Clamp to 0..100, reading values below 1 as fractions (a la opencode). */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  const percent = value > 0 && value < 1 ? value * 100 : value
  return Math.max(0, Math.min(100, percent))
}

/** First defined field in the list. */
function pick(row: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key]
  }
  return undefined
}

/** First non-empty trimmed string among the candidates. */
function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return undefined
}

/** Milliseconds epoch or ISO string → normalized ISO 8601, else undefined. */
function toIso(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const millis = value < 1e12 ? value * 1000 : value
    const date = new Date(millis)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (text === '') return undefined
  // Epoch instants also arrive as strings; route them through the numeric branch.
  if (/^\d+$/.test(text)) return toIso(Number(text))
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** Branded sanitized key for an unknown label (`Credits` → `credits`). */
function slugLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug === '' ? 'window' : slug.slice(0, 32)
}

/** Map a payload label/key onto the canonical window key, when recognized. */
function canonicalWindowKey(raw: string): string | undefined {
  const compact = raw.trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (
    compact === '5h' || compact === '5hour' || compact === '5hours'
    || compact === 'fivehour' || compact === 'fivehours'
    || compact === 'rolling' || compact === 'rolling5h' || compact === 'rolling5'
  ) return '5h'
  if (
    compact === 'week' || compact === 'weekly' || compact === 'wk'
    || compact === '7d' || compact === '7day' || compact === '7days'
    || compact === 'seven' || compact === 'sevenday'
  ) return 'week'
  if (compact === 'month' || compact === 'monthly' || compact === '30d' || compact === '30day' || compact === '30days') return 'month'
  if (compact === 'session' || compact === 'sess' || compact === 'currentsession') return 'session'
  return undefined
}

/** Read the used percent out of one window object, tolerating common field names. */
function windowPercent(row: Record<string, unknown>): number | undefined {
  const percent = numericValue(pick(row, PERCENT_FIELDS))
  if (percent !== undefined) return clampPercent(percent)
  const remainingFraction = numericValue(pick(row, REMAINING_FRACTION_FIELDS))
  if (remainingFraction !== undefined) return clampPercent(100 - clampPercent(remainingFraction))
  const remaining = numericValue(pick(row, REMAINING_FIELDS))
  if (remaining !== undefined) return clampPercent(100 - clampPercent(remaining))
  const usedFraction = numericValue(pick(row, USED_FRACTION_FIELDS))
  if (usedFraction !== undefined) return clampPercent(usedFraction)
  return undefined
}

/** Read the reset instant out of one window object. */
function windowResetsAt(row: Record<string, unknown>): string | undefined {
  return toIso(pick(row, RESET_FIELDS))
}

/** Build one window from a map entry (`{rolling:{percent}, weekly:55, ...}`). */
function readMapWindow(rawKey: string, value: unknown): RawWindow | undefined {
  let percent: number | undefined
  let resetsAt: string | undefined
  if (typeof value === 'number' || typeof value === 'string') {
    const number = numericValue(value)
    if (number === undefined) return undefined
    percent = clampPercent(number)
  } else if (isRecord(value)) {
    percent = windowPercent(value)
    resetsAt = windowResetsAt(value)
  } else {
    return undefined
  }
  if (percent === undefined) return undefined
  const key = canonicalWindowKey(rawKey)
  if (key !== undefined) return { key, percent, ...(resetsAt !== undefined ? { resetsAt } : {}) }
  return {
    key: slugLabel(rawKey),
    name: rawKey.trim().slice(0, CUSTOM_PLAN_LIMITS.maxNameLength),
    percent,
    ...(resetsAt !== undefined ? { resetsAt } : {}),
  }
}

/** Build one window from a `windows: []` row (`{label, percent, resetsAt}`). */
function readRowWindow(row: Record<string, unknown>): RawWindow | undefined {
  const label = firstNonEmptyString(pick(row, LABEL_FIELDS))
  if (label === undefined) return undefined
  const percent = windowPercent(row)
  if (percent === undefined) return undefined
  const resetsAt = windowResetsAt(row)
  const key = canonicalWindowKey(label)
  if (key !== undefined) return { key, percent, ...(resetsAt !== undefined ? { resetsAt } : {}) }
  return {
    key: slugLabel(label),
    name: label.slice(0, CUSTOM_PLAN_LIMITS.maxNameLength),
    percent,
    ...(resetsAt !== undefined ? { resetsAt } : {}),
  }
}

/** Rank one window key for sorting (canonical keys first, unknowns last). */
function windowRank(key: string): number {
  const index = CANONICAL_WINDOW_ORDER.indexOf(key as typeof CANONICAL_WINDOW_ORDER[number])
  return index === -1 ? CANONICAL_WINDOW_ORDER.length : index
}

/** Deduplicate (first wins), sort canonical-first, then clamp to the cap. */
function finalizeWindows(raw: RawWindow[]): PlanWindowView[] {
  const unique = new Map<string, RawWindow>()
  for (const window of raw) {
    if (!unique.has(window.key)) unique.set(window.key, window)
  }
  const sorted = [...unique.values()].sort((left, right) => {
    const rank = windowRank(left.key) - windowRank(right.key)
    return rank !== 0 ? rank : left.key.localeCompare(right.key)
  })
  return sorted.slice(0, CUSTOM_PLAN_LIMITS.maxWindows).map((window) => ({
    key: window.key,
    percent: window.percent,
    ...(window.name !== undefined ? { name: window.name } : {}),
    ...(window.resetsAt !== undefined ? { resetsAt: window.resetsAt } : {}),
  }))
}

/**
 * Normalize a custom-plan probe payload into sorted plan windows.
 *
 * Accepts the two shapes seen in the wild:
 * - `{usage:{rolling|weekly|monthly|session:{percent, resetsAt}}}`
 * - `{windows:[{label, percent, resetAt?, resetsAt?}]}` (also `windows: {...}`)
 * and, as a fallback, a flat window map at the root or a bare window array.
 * `percent` may be 0..1 (fraction) or 0..100 and is clamped; `resetsAt`/`resetAt`
 * may be epoch seconds/milliseconds or an ISO string. Unknown labels are kept
 * when they carry a percent (with a slugged key and the raw label as `name`);
 * unusable windows are silently skipped. Returns undefined when none parse.
 */
export function normalizeCustomPlan(payload: unknown): PlanWindowView[] | undefined {
  const root = unwrapJson(payload)
  const raw: RawWindow[] = []
  const push = (window: RawWindow | undefined): void => {
    if (window !== undefined) raw.push(window)
  }

  if (Array.isArray(root)) {
    for (const row of root.slice(0, 64)) {
      if (isRecord(row)) push(readRowWindow(row))
    }
    return raw.length === 0 ? undefined : finalizeWindows(raw)
  }
  if (!isRecord(root)) return undefined

  // opencode-style usage object, then the windows array/object, then a flat map.
  if (isRecord(root.usage)) {
    for (const [key, value] of Object.entries(root.usage).slice(0, 64)) push(readMapWindow(key, value))
  }
  if (Array.isArray(root.windows)) {
    for (const row of root.windows.slice(0, 64)) {
      if (isRecord(row)) push(readRowWindow(row))
    }
  } else if (isRecord(root.windows)) {
    for (const [key, value] of Object.entries(root.windows).slice(0, 64)) push(readMapWindow(key, value))
  }
  for (const [key, value] of Object.entries(root).slice(0, 64)) {
    if (key === 'usage' || key === 'windows') continue
    push(readMapWindow(key, value))
  }
  return raw.length === 0 ? undefined : finalizeWindows(raw)
}

/** Why a header value is not acceptable, or undefined when it is. */
function envReferenceProblem(value: string): string | undefined {
  for (const match of value.matchAll(ANY_REFERENCE_PATTERN)) {
    const inner = (match[1] ?? '').trim()
    if (!/^env:[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(inner)) {
      return 'header values may only reference environment variables as ${env:NAME}'
    }
  }
  if (value.replace(/\$\{[^}]*\}/g, '').includes('${')) {
    return 'header value has an unterminated ${...} reference'
  }
  return undefined
}

/**
 * Resolve `${env:NAME}` references in a header map.
 *
 * Only that exact syntax is substituted. Headers whose referenced variable is
 * unset (or whose reader throws) are dropped instead of being sent half-filled;
 * resolved values that smuggle control characters are dropped too. Literal
 * values are returned unchanged. Never throws.
 */
export function resolveHeaders(
  headers: Readonly<Record<string, string>>,
  getEnv: CustomPlanEnvReader,
): Record<string, string> {
  const resolved: Record<string, string> = {}
  if (!isRecord(headers)) return resolved
  for (const [name, raw] of Object.entries(headers)) {
    if (typeof raw !== 'string') continue
    let missing = false
    const value = raw.replace(ENV_REFERENCE_PATTERN, (_match: string, envName: string) => {
      let replacement: string | undefined
      try {
        replacement = getEnv(envName)
      } catch {
        replacement = undefined
      }
      if (replacement === undefined) {
        missing = true
        return ''
      }
      return replacement
    })
    if (missing) continue
    // Defence in depth: an environment value must not smuggle header separators.
    if (CONTROL_CHARACTER_PATTERN.test(value)) continue
    resolved[name] = value
  }
  return resolved
}

/** A URL safety verdict shared by the parser and the probe. */
type PlanUrlCheck = { ok: true; url: URL } | { ok: false; code: 'invalid-url' | 'not-allowed'; message: string }

/** Whether one hostname is loopback or explicitly allow-listed. */
function hostAllowed(hostname: string, allowedHosts: readonly string[]): boolean {
  if (isLoopbackHostname(hostname)) return true
  const host = hostname.toLowerCase()
  return allowedHosts.some((item) => typeof item === 'string' && item.trim().toLowerCase() === host)
}

/**
 * Validate a plan endpoint URL: absolute http(s), no credentials/fragment,
 * https unless loopback, bounded length, and host loopback/allow-listed.
 */
function checkPlanUrl(raw: string, allowedHosts: readonly string[]): PlanUrlCheck {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (text.length > CUSTOM_PLAN_LIMITS.maxUrlLength) {
    return { ok: false, code: 'invalid-url', message: `custom plan URL must be at most ${CUSTOM_PLAN_LIMITS.maxUrlLength} characters` }
  }
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return { ok: false, code: 'invalid-url', message: 'custom plan URL must be an absolute URL' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, code: 'invalid-url', message: 'custom plan URL must be absolute https (http only for loopback)' }
  }
  if (url.protocol === 'http:' && !isLoopbackHostname(url.hostname)) {
    return { ok: false, code: 'invalid-url', message: 'custom plan URL must use https unless its host is loopback' }
  }
  if (url.username !== '' || url.password !== '') {
    return { ok: false, code: 'invalid-url', message: 'custom plan URL must not carry credentials' }
  }
  if (url.hash !== '') {
    return { ok: false, code: 'invalid-url', message: 'custom plan URL must not carry a fragment' }
  }
  if (url.hostname.length > CUSTOM_PLAN_LIMITS.maxHostLength) {
    return { ok: false, code: 'invalid-url', message: `custom plan host must be at most ${CUSTOM_PLAN_LIMITS.maxHostLength} characters` }
  }
  if (!hostAllowed(url.hostname, allowedHosts)) {
    return {
      ok: false,
      code: 'not-allowed',
      message: `custom plan host "${url.hostname}" is not loopback and not listed in allowedHosts`,
    }
  }
  return { ok: true, url }
}

/** Normalize one `allowedHosts` item to a bare lowercase hostname. */
function normalizeAllowedHost(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const host = value.trim().toLowerCase()
  if (host === '' || host.length > CUSTOM_PLAN_LIMITS.maxHostLength) return undefined
  // Bare DNS names / IPv4 literals only: no scheme, path, port or brackets.
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) ? host : undefined
}

/** Validate one entry's `allowedHosts`; returns the normalized list plus errors. */
function readAllowedHosts(
  value: unknown,
  fail: (field: string, message: string) => void,
): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    fail('allowedHosts', 'allowedHosts must be an array of bare hostnames')
    return []
  }
  if (value.length > CUSTOM_PLAN_LIMITS.maxAllowedHosts) {
    fail('allowedHosts', `allowedHosts must list at most ${CUSTOM_PLAN_LIMITS.maxAllowedHosts} hosts`)
  }
  const hosts: string[] = []
  for (const item of value.slice(0, CUSTOM_PLAN_LIMITS.maxAllowedHosts)) {
    const host = normalizeAllowedHost(item)
    if (host === undefined) {
      fail('allowedHosts', 'allowedHosts entries must be bare hostnames (no scheme, path or port)')
      continue
    }
    if (!hosts.includes(host)) hosts.push(host)
  }
  return hosts
}

/** Validate one entry's `headers`; returns the normalized map plus errors. */
function readHeaders(
  value: unknown,
  fail: (field: string, message: string) => void,
): Record<string, string> {
  const headers: Record<string, string> = {}
  if (value === undefined) return headers
  if (!isRecord(value)) {
    fail('headers', 'headers must be an object of string values')
    return headers
  }
  const names = Object.keys(value)
  if (names.length > CUSTOM_PLAN_LIMITS.maxHeaders) {
    fail('headers', `headers must contain at most ${CUSTOM_PLAN_LIMITS.maxHeaders} entries`)
  }
  for (const originalName of names.slice(0, CUSTOM_PLAN_LIMITS.maxHeaders)) {
    const name = originalName.trim().toLowerCase()
    const field = `headers.${originalName}`
    if (name === '' || name.length > CUSTOM_PLAN_LIMITS.maxHeaderNameLength || !HEADER_NAME_PATTERN.test(name)) {
      fail(field, 'header name is not allowed')
      continue
    }
    if (FORBIDDEN_HEADERS.has(name)) {
      fail(field, `the ${name} header may not be overridden`)
      continue
    }
    if (headers[name] !== undefined) {
      fail(field, `duplicate header "${name}"`)
      continue
    }
    const raw = value[originalName]
    if (typeof raw !== 'string') {
      fail(field, 'header value must be a string')
      continue
    }
    if (raw.length > CUSTOM_PLAN_LIMITS.maxHeaderValueLength) {
      fail(field, `header value must be at most ${CUSTOM_PLAN_LIMITS.maxHeaderValueLength} characters`)
      continue
    }
    if (CONTROL_CHARACTER_PATTERN.test(raw)) {
      fail(field, 'header value must not contain control characters')
      continue
    }
    const referenceProblem = envReferenceProblem(raw)
    if (referenceProblem !== undefined) {
      fail(field, referenceProblem)
      continue
    }
    headers[name] = raw
  }
  return headers
}

/** Validate one raw entry and build a {@link CustomPlanEntry} when it is clean. */
function parseEntry(raw: unknown, index: number, ids: Set<string>): { entry?: CustomPlanEntry; errors: CustomPlanConfigError[] } {
  const errors: CustomPlanConfigError[] = []
  let knownId: string | undefined
  const fail = (field: string, message: string): void => {
    const error: CustomPlanConfigError = { index, field, message }
    if (knownId !== undefined) error.id = knownId
    errors.push(error)
  }
  if (!isRecord(raw)) {
    errors.push({ index, field: 'entry', message: 'custom plan entries must be JSON objects' })
    return { errors }
  }

  const rawId = raw.id
  const validId = typeof rawId === 'string' && ID_PATTERN.test(rawId) ? rawId : undefined
  if (validId === undefined) {
    fail('id', 'id must match /^[a-z0-9][a-z0-9-]{0,31}$/')
  } else {
    knownId = validId
    if (ids.has(validId)) fail('id', `duplicate custom plan id "${validId}"`)
  }

  let name = validId ?? ''
  if (raw.name !== undefined) {
    if (typeof raw.name !== 'string' || raw.name.trim() === '') {
      fail('name', 'name must be a non-empty string')
    } else if (raw.name.trim().length > CUSTOM_PLAN_LIMITS.maxNameLength) {
      fail('name', `name must be at most ${CUSTOM_PLAN_LIMITS.maxNameLength} characters`)
    } else {
      name = raw.name.trim()
    }
  }

  const allowedHosts = readAllowedHosts(raw.allowedHosts, fail)

  let planUrl: URL | undefined
  const urlText = typeof raw.url === 'string' ? raw.url.trim() : ''
  if (urlText === '') {
    fail('url', 'url is required')
  } else {
    const check = checkPlanUrl(urlText, allowedHosts)
    if (!check.ok) fail('url', check.message)
    else planUrl = check.url
  }

  let tokenEnv: string | undefined
  if (raw.tokenEnv !== undefined) {
    if (typeof raw.tokenEnv !== 'string' || !ENV_NAME_PATTERN.test(raw.tokenEnv)) {
      fail('tokenEnv', 'tokenEnv must name an environment variable')
    } else {
      tokenEnv = raw.tokenEnv
    }
  }

  const headers = readHeaders(raw.headers, fail)

  if (errors.length > 0 || validId === undefined || planUrl === undefined) return { errors }
  ids.add(validId)
  const entry: CustomPlanEntry = {
    id: validId,
    name,
    url: planUrl.href,
    host: planUrl.hostname.toLowerCase(),
    allowedHosts,
    ...(tokenEnv !== undefined ? { tokenEnv } : {}),
    headers,
    resolveHeaders: (getEnv) => resolveHeaders(headers, getEnv),
  }
  return { entry, errors }
}

/**
 * Parse and validate the user-supplied custom-plan config.
 *
 * Accepts a JSON string, an already-parsed array, or `undefined`/`null`/an
 * empty string (feature off). Strict per-field validation collects every
 * problem instead of throwing; entries with errors are dropped so the service
 * can show them and keep serving the rest. Duplicate ids reject the later entry.
 */
export function parseCustomPlans(json: unknown): CustomPlansParseResult {
  const errors: CustomPlanConfigError[] = []
  let document: unknown = json
  if (typeof json === 'string') {
    const text = json.trim()
    if (text === '') return { entries: [], errors: [] }
    try {
      document = JSON.parse(text) as unknown
    } catch {
      return { entries: [], errors: [{ index: -1, field: 'document', message: 'custom plans must be valid JSON' }] }
    }
  }
  if (document === undefined || document === null) return { entries: [], errors: [] }
  if (!Array.isArray(document)) {
    return { entries: [], errors: [{ index: -1, field: 'document', message: 'custom plans must be a JSON array' }] }
  }

  const entries: CustomPlanEntry[] = []
  const ids = new Set<string>()
  for (let index = 0; index < document.length; index += 1) {
    if (index >= CUSTOM_PLAN_LIMITS.maxEntries) {
      errors.push({
        index,
        field: 'document',
        message: `at most ${CUSTOM_PLAN_LIMITS.maxEntries} custom plans are supported`,
      })
      continue
    }
    const parsed = parseEntry(document[index], index, ids)
    if (parsed.entry !== undefined) entries.push(parsed.entry)
    errors.push(...parsed.errors)
  }
  return { entries, errors }
}

/** Default environment reader for the Host (never throws). */
function processEnv(name: string): string | undefined {
  try {
    return typeof process !== 'undefined' && process.env !== undefined ? process.env[name] : undefined
  } catch {
    return undefined
  }
}

/** Read one environment variable from a possibly-throwing reader. */
function readEnv(getEnv: CustomPlanEnvReader, name: string): string | undefined {
  try {
    return getEnv(name)
  } catch {
    return undefined
  }
}

/** Raise a typed failure. */
function failure(error: CustomPlanError): CustomPlanProbeFailure {
  return { ok: false, error }
}

/**
 * Defensive entry validation for the probe: hand-built entries (or garbage
 * values) must be refused before any network call. Parsed entries always pass.
 */
function entryConfigurationProblem(entry: unknown): CustomPlanError | undefined {
  if (!isRecord(entry)) return new CustomPlanError('invalid-config', 'custom plan entry is not an object')
  if (typeof entry.id !== 'string' || !ID_PATTERN.test(entry.id)) {
    return new CustomPlanError('invalid-config', 'custom plan id is invalid')
  }
  if (typeof entry.name !== 'string' || entry.name.trim() === '') {
    return new CustomPlanError('invalid-config', 'custom plan name is missing')
  }
  if (typeof entry.url !== 'string') {
    return new CustomPlanError('invalid-url', 'custom plan URL must be an absolute URL')
  }
  const allowedHosts = Array.isArray(entry.allowedHosts)
    ? entry.allowedHosts.filter((item): item is string => typeof item === 'string')
    : []
  const urlCheck = checkPlanUrl(entry.url, allowedHosts)
  if (!urlCheck.ok) return new CustomPlanError(urlCheck.code, urlCheck.message)
  if (entry.tokenEnv !== undefined && (typeof entry.tokenEnv !== 'string' || !ENV_NAME_PATTERN.test(entry.tokenEnv))) {
    return new CustomPlanError('invalid-config', 'custom plan tokenEnv is invalid')
  }
  if (entry.headers !== undefined) {
    if (!isRecord(entry.headers)) {
      return new CustomPlanError('unsafe-header', 'custom plan headers must be an object')
    }
    for (const [rawName, rawValue] of Object.entries(entry.headers)) {
      const name = rawName.trim().toLowerCase()
      if (name === '' || !HEADER_NAME_PATTERN.test(name) || FORBIDDEN_HEADERS.has(name)) {
        return new CustomPlanError('unsafe-header', `custom plan header "${rawName}" is not allowed`)
      }
      if (typeof rawValue !== 'string' || CONTROL_CHARACTER_PATTERN.test(rawValue)) {
        return new CustomPlanError('unsafe-header', `custom plan header "${rawName}" has an unsafe value`)
      }
      const referenceProblem = envReferenceProblem(rawValue)
      if (referenceProblem !== undefined) {
        return new CustomPlanError('unsafe-header', `custom plan header "${rawName}" has an invalid environment reference`)
      }
    }
  }
  return undefined
}

/** Build the resolved request-header map for one entry (host-side only). */
function entryRequestHeaders(entry: CustomPlanEntry, getEnv: CustomPlanEnvReader): Record<string, string> {
  const rawHeaders = isRecord((entry as unknown as Record<string, unknown>).headers)
    ? entry.headers as unknown as Record<string, string>
    : {}
  let resolved: Record<string, string>
  const method = (entry as unknown as { resolveHeaders?: unknown }).resolveHeaders
  if (typeof method === 'function') {
    try {
      const value = (method as (getEnv: CustomPlanEnvReader) => unknown).call(entry, getEnv)
      resolved = isRecord(value)
        ? Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'string' && !CONTROL_CHARACTER_PATTERN.test(item))) as Record<string, string>
        : resolveHeaders(rawHeaders, getEnv)
    } catch {
      resolved = resolveHeaders(rawHeaders, getEnv)
    }
  } else {
    resolved = resolveHeaders(rawHeaders, getEnv)
  }
  return resolved
}

/** Bound a caller-supplied timeout; invalid values fall back to the default. */
function resolveTimeout(value: unknown): number {
  const number = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(number) || number <= 0) return CUSTOM_PLAN_LIMITS.timeoutMs
  return Math.min(Math.max(Math.round(number), 1), 60_000)
}

/** Duck-typed AbortSignal check (cross-realm safe). */
function asAbortSignal(value: unknown): AbortSignal | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as { aborted?: unknown; addEventListener?: unknown; removeEventListener?: unknown }
  return typeof candidate.aborted === 'boolean'
    && typeof candidate.addEventListener === 'function'
    && typeof candidate.removeEventListener === 'function'
    ? value as AbortSignal
    : undefined
}

/**
 * One request signal combining the caller's signal with the timeout. The
 * controller is disposed (timer cleared, listener removed) when the probe ends.
 */
function requestSignal(timeoutMs: number, external: AbortSignal | undefined): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new DOMException('custom plan request timed out', 'TimeoutError'))
  }, timeoutMs)
  let listener: (() => void) | undefined
  if (external !== undefined) {
    listener = () => { controller.abort(external.reason) }
    if (external.aborted) listener()
    else external.addEventListener('abort', listener, { once: true })
  }
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer)
      if (external !== undefined && listener !== undefined) external.removeEventListener('abort', listener)
    },
  }
}

/** Transport-level detail for a network failure, or undefined for other errors. */
function transportFailureDetail(error: Error): string | undefined {
  const cause = (error as { cause?: unknown }).cause
  const causeCode = isRecord(cause) && typeof cause.code === 'string' && cause.code !== '' ? cause.code : undefined
  if (causeCode !== undefined) return `fetch failed (${causeCode})`
  if (error.message === 'fetch failed') return 'fetch failed'
  return undefined
}

/** Map any thrown probe failure onto a typed, secret-free error. */
function probeErrorFrom(error: unknown): CustomPlanError {
  if (error instanceof CustomPlanError) return error
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return new CustomPlanError('timeout', 'custom plan request timed out')
    }
    const detail = transportFailureDetail(error)
    return new CustomPlanError('network', detail === undefined ? 'custom plan request failed' : `custom plan request failed: ${detail}`)
  }
  return new CustomPlanError('network', 'custom plan request failed')
}

/**
 * GET one custom plan endpoint and normalize its quota windows.
 *
 * Safety invariants (the same rules the external sources follow): only
 * loopback/allow-listed hosts, redirects refused, an 8s default timeout, and
 * secrets (`tokenEnv` bearer token and `${env:NAME}` headers) live only in the
 * Host request. Never throws: every failure degrades to a typed
 * {@link CustomPlanError} whose message contains no secret values.
 */
export async function probeCustomPlan(
  entry: CustomPlanEntry,
  opts: CustomPlanProbeOptions = {},
): Promise<CustomPlanProbeResult> {
  const options = isRecord(opts) ? opts as CustomPlanProbeOptions : {}
  const now = typeof options.now === 'function' ? options.now : Date.now
  const getEnv = typeof options.env === 'function' ? options.env : processEnv
  const timestamp = (): number => {
    try {
      const value = now()
      return Number.isFinite(value) ? value : Date.now()
    } catch {
      return Date.now()
    }
  }
  try {
    const configProblem = entryConfigurationProblem(entry)
    if (configProblem !== undefined) return failure(configProblem)

    const config = entry as unknown as Record<string, unknown>
    const headers: Record<string, string> = { accept: 'application/json', ...entryRequestHeaders(entry, getEnv) }
    const tokenEnv = typeof config.tokenEnv === 'string' ? config.tokenEnv : undefined
    if (tokenEnv !== undefined) {
      const token = readEnv(getEnv, tokenEnv)
      if (token === undefined || token.trim() === '') {
        return failure(new CustomPlanError('missing-token', `custom plan token env ${tokenEnv} is not set`))
      }
      if (CONTROL_CHARACTER_PATTERN.test(token)) {
        return failure(new CustomPlanError('unsafe-header', `custom plan token env ${tokenEnv} contains invalid characters`))
      }
      headers.authorization = `Bearer ${token.trim()}`
    }

    const fetchImpl = typeof options.fetch === 'function' ? options.fetch : globalThis.fetch
    if (typeof fetchImpl !== 'function') {
      return failure(new CustomPlanError('invalid-config', 'custom plan fetch is unavailable'))
    }
    const timeoutMs = resolveTimeout(options.timeoutMs)
    const { signal, dispose } = requestSignal(timeoutMs, asAbortSignal(options.signal))
    try {
      const response = await fetchImpl(entry.url, {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal,
      })
      if (response.status >= 300 && response.status < 400) {
        return failure(new CustomPlanError('redirect', 'custom plan redirect refused', response.status))
      }
      if (response.status === 401 || response.status === 403) {
        return failure(new CustomPlanError('auth', 'custom plan rejected the request (401/403)', response.status))
      }
      if (!response.ok) {
        return failure(new CustomPlanError('http', `custom plan HTTP ${response.status}`, response.status))
      }
      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        return failure(new CustomPlanError('invalid-json', 'custom plan response was not valid JSON', response.status))
      }
      const windows = normalizeCustomPlan(payload)
      if (windows === undefined) {
        return failure(new CustomPlanError('no-windows', 'custom plan response contained no usable quota windows', response.status))
      }
      return { ok: true, status: response.status, windows, updatedAt: timestamp() }
    } catch (error) {
      return failure(probeErrorFrom(error))
    } finally {
      dispose()
    }
  } catch (error) {
    return failure(probeErrorFrom(error))
  }
}

/**
 * Shape a successful probe into the wire snapshot the service stores.
 *
 * Returns `provider: 'custom:<id>'`, `source: 'custom'`, the entry's display
 * name, `credential: 'env'`, `planSupported: true`, and a copied `plan`
 * (`windows` + `updatedAt`); nothing is mutated.
 */
export function customPlanSnapshot(
  entry: CustomPlanEntry,
  windows: readonly PlanWindowView[],
  atMs: number,
): ProviderSnapshotView {
  const source = entry as unknown as Record<string, unknown>
  const id = typeof source.id === 'string' ? source.id : 'custom-plan'
  const name = typeof source.name === 'string' && source.name.trim() !== '' ? source.name.trim() : id
  const timestamp = Number.isFinite(atMs) ? atMs : Date.now()
  const copied = Array.isArray(windows)
    ? windows.filter((window): window is PlanWindowView => isRecord(window)).map((window) => ({ ...window }))
    : []
  return {
    provider: `custom:${id}`,
    source: 'custom',
    displayName: name,
    credential: 'env',
    supported: true,
    planSupported: true,
    plan: { windows: copied, updatedAt: timestamp },
    updatedAt: timestamp,
  }
}

/** Error codes a serialized `{code, message}` object may carry. */
const KNOWN_ERROR_CODES = new Set<string>([
  'timeout', 'network', 'redirect', 'auth', 'http', 'invalid-json', 'no-windows',
  'missing-token', 'invalid-config', 'unsafe-header', 'invalid-url', 'not-allowed',
])

/**
 * Friendly, secret-free display message for any custom-plan failure.
 *
 * Handles {@link CustomPlanError}, timeout/abort errors, network errors (with
 * the transport code appended, matching the external-source convention), and
 * serialized `{code, message}` objects; anything else degrades to a generic
 * message. Never throws and never echoes credentials.
 */
export function describeCustomPlanError(error: unknown): string {
  if (error instanceof CustomPlanError) return error.message
  if (isRecord(error)
    && typeof error.message === 'string'
    && error.message.trim() !== ''
    && typeof error.code === 'string'
    && KNOWN_ERROR_CODES.has(error.code)) {
    return error.message
  }
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'custom plan request timed out'
    // Only a transport failure may add detail. Arbitrary error messages are
    // never echoed — they could carry a credential from a misbehaving endpoint.
    const detail = transportFailureDetail(error)
    return detail === undefined ? 'custom plan request failed' : `custom plan request failed: ${detail}`
  }
  return 'custom plan request failed'
}
