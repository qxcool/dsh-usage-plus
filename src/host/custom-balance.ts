/**
 * Custom HTTPS balance probe: user-configured URL + declarative extract rules.
 * Portions adapted from dsh-cost-meter (MIT).
 * @module dsh-usage-plus/host/custom-balance
 */

import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { Context } from '@deepseek-ai/cordis'
import { customBalanceCredentialVars, extractByRule } from '../core/custom-balance.ts'
import type { ProviderSnapshotState } from '../core/types.ts'

export { customBalanceCredentialVars, extractByRule }

export interface CustomBalanceConfig {
  enabled: boolean
  label: string
  currency: string
  url: string
  method: string
  /** JSON object string; header values may use {{VAR}} placeholders. */
  headersJson: string
  /**
   * Remaining-balance extract rule: a dotted path (`data.balance`) or a JSON
   * rule (`{"op":"divide","path":"data.quota","by":500000}`).
   */
  extractRemaining: string
  /** Comma-separated hosts allowed when headers carry credentials. */
  allowedHosts: string
}

function toStrictNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN
  if (typeof value === 'string') {
    const text = value.trim()
    if (text.length > 0 && /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(text)) return Number(text)
  }
  return Number.NaN
}

function parseExtractRule(raw: string): unknown {
  const text = raw.trim()
  if (text === '') return null
  if (text.startsWith('{') || text.startsWith('[')) {
    try { return JSON.parse(text) } catch { return text }
  }
  return text
}

function parseHeaders(raw: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(raw || '{}')
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

async function resolveTemplate(value: string, ctx: Context): Promise<string> {
  const pattern = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g
  let out = value
  const names = [...value.matchAll(pattern)].map((match) => match[1])
  const credentials = (ctx as { get?(name: string): { resolve(ref: unknown): Promise<{ value: string } | undefined> } | undefined }).get?.('credentials')
  for (const name of names) {
    let resolved = ''
    try {
      const hit = await credentials?.resolve(credentialRef(name))
      if (typeof hit?.value === 'string' && hit.value.trim() !== '') resolved = hit.value.trim()
    } catch {}
    if (resolved === '') resolved = String(process.env[name] ?? '').trim()
    out = out.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g'), () => resolved)
  }
  return out
}

async function resolveHeaders(headers: Record<string, string>, ctx: Context): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) out[key] = await resolveTemplate(value, ctx)
  return out
}

function formatRemaining(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(4).replace(/\.?0+$/, '')
}

/** Probe one custom HTTPS balance endpoint into a provider snapshot row. */
export async function probeCustomBalance(ctx: Context, options: CustomBalanceConfig): Promise<ProviderSnapshotState[]> {
  if (!options.enabled) return []
  const label = options.label.trim() || 'Custom balance'
  const provider = 'custom:http-balance'
  const fail = (error: string): ProviderSnapshotState[] => [{
    provider,
    displayName: label,
    credential: 'env',
    supported: true,
    balanceSupported: true,
    source: 'custom',
    balanceError: error,
    updatedAt: Date.now(),
  }]

  if (!options.url.trim()) return fail('custom balance URL is required')
  let parsedUrl: URL
  try {
    parsedUrl = new URL(options.url.trim())
  } catch {
    return fail('custom balance URL is invalid')
  }
  if (parsedUrl.protocol !== 'https:') return fail('custom balance URL must use https')

  const headersRaw = parseHeaders(options.headersJson)
  const usesCredentials = Object.values(headersRaw).some((value) => /\{\{\s*[A-Za-z_][A-Za-z0-9_]*\s*\}\}/.test(value))
  const host = parsedUrl.host.toLowerCase()
  const allowed = options.allowedHosts
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== '')
  if (usesCredentials && allowed.length > 0 && !allowed.includes(host)) {
    return fail(`host ${host} is not in allowedHosts`)
  }

  try {
    const headers = await resolveHeaders(headersRaw, ctx)
    const method = (options.method || 'GET').toUpperCase()
    const response = await fetch(parsedUrl.toString(), {
      method,
      headers: { accept: 'application/json', ...headers },
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    })
    if (response.status >= 300 && response.status < 400) return fail('redirect refused')
    if (!response.ok) return fail(`HTTP ${response.status}`)
    const body: unknown = await response.json().catch(() => null)
    if (body === null) return fail('response is not JSON')
    const remaining = extractByRule(body, parseExtractRule(options.extractRemaining))
    const amount = typeof remaining === 'number' ? remaining : toStrictNumber(remaining)
    if (!Number.isFinite(amount)) return fail('extract.remaining did not yield a number')
    const currency = (options.currency || 'USD').toUpperCase()
    return [{
      provider,
      displayName: label,
      credential: 'env',
      supported: true,
      balanceSupported: true,
      source: 'custom',
      balance: { currency, totalBalance: formatRemaining(amount), updatedAt: Date.now() },
      updatedAt: Date.now(),
    }]
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}
