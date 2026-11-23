/**
 * Generic gateway quota detection.
 *
 * A DSH route whose provider has no shipped adapter may still be an
 * OpenAI-compatible gateway (One API, New API, a self-hosted credit proxy, ...)
 * that exposes a standard balance endpoint. Instead of asking the user to hand
 * write a custom quota source for those, the Host probes the small set of
 * documented gateway endpoints derived from the configured `baseURL` and shows
 * the balance only when a real response shape was recognized.
 *
 * Every probe is read-only, GET-only, keyed by the route's own credential, and
 * never guesses a value: an absent/unrecognized body returns `undefined`.
 * @module dsh-usage-plus/core/gateways
 */

/** Inputs for one gateway detection pass. */
export interface GatewayDetectionInput {
  /** The route's configured pi-ai base URL (`https://gateway.example/v1`). */
  baseURL: string
  /** The route's resolved credential (raw API key or env value). */
  apiKey: string
}

/** A recognized gateway balance. */
export interface GatewayDetection {
  /** Stable probe id (`one-api`, `new-api`, `credits`). */
  id: string
  /** Human label for the auto-detection chip. */
  name: string
  /** ISO currency code; only currencies the endpoint states are returned. */
  currency: string
  /** Balance as a decimal string, two fraction digits. */
  totalBalance: string
}

/** One parsed HTTP response; `body` is `undefined` when it was not JSON. */
export interface GatewayHttpResponse {
  ok: boolean
  status: number
  body: unknown
}

/** Injectable transport. Returning `undefined` is a transport failure. */
export type GatewayFetch = (
  url: string,
  init: { headers: Record<string, string>; signal?: AbortSignal },
) => Promise<GatewayHttpResponse | undefined>

/** Timings/seams for {@link detectGatewayQuota}. */
export interface GatewayDetectionOptions {
  /** Transport seam; defaults to the Host's global `fetch`. */
  fetch?: GatewayFetch
  /** Per-request timeout in milliseconds. Default 8000. */
  timeoutMs?: number
}

/** Probe order: cheapest, most common gateway shapes first. */
const PROBE_ORDER = ['credits', 'one-api', 'new-api'] as const

/** Default per-request timeout. */
const DEFAULT_TIMEOUT_MS = 8_000

/** Parse a finite number from a number or numeric string. */
function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/** Render a finite amount as a two-decimal string, keeping sub-cent values meaningful. */
export function formatGatewayAmount(value: number): string {
  if (!Number.isFinite(value)) return '0.00'
  if (Math.abs(value) < 1 && value !== 0) {
    const digits = Math.min(6, Math.max(2, Math.ceil(-Math.log10(Math.abs(value))) + 1))
    return value.toFixed(digits)
  }
  return value.toFixed(2)
}

/** Whether a value is a plain JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** First recognized numeric field among the candidates. */
function firstNumber(record: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const parsed = toNumber(record[key])
    if (parsed !== undefined) return parsed
  }
  return undefined
}

/** The `base` URL without a trailing slash, and its origin, or undefined. */
function normalizeBaseURL(raw: string): { base: string; origin: string } | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    const base = `${url.origin}${url.pathname}`.replace(/\/+$/, '')
    return { base, origin: url.origin }
  } catch {
    return undefined
  }
}

/** Host-default transport: JSON-only, no redirects, bounded timeout. */
function defaultFetch(timeoutMs: number): GatewayFetch {
  return async (url, init) => {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', ...init.headers },
      redirect: 'manual',
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    })
    const body: unknown = await response.json().catch(() => undefined)
    return { ok: response.ok, status: response.status, body }
  }
}

/** Run one GET and return its JSON body only for a 2xx response. */
async function getJson(
  trans: GatewayFetch,
  url: string,
  headers: Record<string, string>,
): Promise<unknown> {
  try {
    const response = await trans(url, { headers })
    if (response === undefined || !response.ok) return undefined
    return response.body
  } catch {
    return undefined
  }
}

/** Bearer authorization header shared by all gateway dashboard endpoints. */
function bearer(apiKey: string): Record<string, string> {
  return { authorization: `Bearer ${apiKey}` }
}

/**
 * OpenAI-compatible credit proxies (Vercel-style `/credits`): the balance is
 * a top-level `balance` / `total_available` / `remaining` value in USD.
 */
async function probeCredits(
  trans: GatewayFetch,
  input: GatewayDetectionInput,
  urls: readonly string[],
): Promise<GatewayDetection | undefined> {
  for (const url of urls) {
    const body = await getJson(trans, url, bearer(input.apiKey))
    if (!isRecord(body)) continue
    const amount = firstNumber(body, ['balance', 'total_available', 'remaining', 'credit_balance'])
    if (amount === undefined) continue
    return {
      id: 'credits',
      name: 'Credits',
      currency: 'USD',
      totalBalance: formatGatewayAmount(amount),
    }
  }
  return undefined
}

/**
 * One API (`/dashboard/billing/subscription` + `/dashboard/billing/usage`):
 * `hard_limit_usd` is the budget, `total_usage` is lifetime spend in cents.
 */
async function probeOneAPI(
  trans: GatewayFetch,
  input: GatewayDetectionInput,
  origins: readonly string[],
): Promise<GatewayDetection | undefined> {
  for (const origin of origins) {
    const subscription = await getJson(trans, `${origin}/dashboard/billing/subscription`, bearer(input.apiKey))
    if (!isRecord(subscription)) continue
    const hardLimit = firstNumber(subscription, ['hard_limit_usd', 'system_hard_limit_usd'])
    if (hardLimit === undefined) continue
    const usage = await getJson(trans, `${origin}/dashboard/billing/usage`, bearer(input.apiKey))
    if (!isRecord(usage)) continue
    const totalUsageCents = firstNumber(usage, ['total_usage', 'total_used'])
    if (totalUsageCents === undefined) continue
    const remaining = hardLimit - totalUsageCents / 100
    if (!Number.isFinite(remaining)) continue
    return {
      id: 'one-api',
      name: 'One API',
      currency: 'USD',
      totalBalance: formatGatewayAmount(Math.max(0, remaining)),
    }
  }
  return undefined
}

/**
 * New API (`/api/user/self` + `/api/status`): `data.quota` is the remaining
 * quota in abstract units; `data.quota_per_unit` converts one currency unit
 * (USD or CNY per `quota_display_type`) into those units.
 */
async function probeNewAPI(
  trans: GatewayFetch,
  input: GatewayDetectionInput,
  origins: readonly string[],
): Promise<GatewayDetection | undefined> {
  for (const origin of origins) {
    const self = await getJson(trans, `${origin}/api/user/self`, bearer(input.apiKey))
    if (!isRecord(self) || !isRecord(self.data)) continue
    const remainingUnits = firstNumber(self.data as Record<string, unknown>, ['quota'])
    if (remainingUnits === undefined) continue
    const status = await getJson(trans, `${origin}/api/status`, bearer(input.apiKey))
    if (!isRecord(status) || !isRecord(status.data)) continue
    const statusData = status.data as Record<string, unknown>
    const perUnit = firstNumber(statusData, ['quota_per_unit'])
    if (perUnit === undefined || perUnit <= 0) continue
    const displayType = typeof statusData.quota_display_type === 'string' ? statusData.quota_display_type.toUpperCase() : 'USD'
    if (displayType !== 'USD' && displayType !== 'CNY') continue
    const amount = remainingUnits / perUnit
    if (!Number.isFinite(amount)) continue
    return {
      id: 'new-api',
      name: 'New API',
      currency: displayType,
      totalBalance: formatGatewayAmount(Math.max(0, amount)),
    }
  }
  return undefined
}

/**
 * Detect a standard gateway balance endpoint for one configured route.
 *
 * Accepts any OpenAI-compatible `baseURL`; probes the documented dashboard/
 * credit endpoints in {@link PROBE_ORDER} and returns the first recognized
 * balance. Returns `undefined` when the host is a non-standard gateway (the
 * case that needs a custom quota source or a new adapter), or when the
 * credential does not authorize any of them. Never throws.
 */
export async function detectGatewayQuota(
  input: GatewayDetectionInput,
  options: GatewayDetectionOptions = {},
): Promise<GatewayDetection | undefined> {
  const normalized = normalizeBaseURL(input.baseURL)
  if (normalized === undefined) return undefined
  if (input.apiKey.trim() === '') return undefined
  const trans = options.fetch ?? defaultFetch(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const { base, origin } = normalized
  const origins = [origin]
  const creditsUrls = [`${base}/credits`]
  if (base !== `${origin}/v1`) creditsUrls.push(`${origin}/v1/credits`)

  for (const probe of PROBE_ORDER) {
    if (probe === 'credits') {
      const found = await probeCredits(trans, input, creditsUrls)
      if (found !== undefined) return found
    } else if (probe === 'one-api') {
      const found = await probeOneAPI(trans, input, origins)
      if (found !== undefined) return found
    } else {
      const found = await probeNewAPI(trans, input, origins)
      if (found !== undefined) return found
    }
  }
  return undefined
}
