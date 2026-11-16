/**
 * models.dev price book: normalize the public catalog into USD-per-1M-token
 * lookup rows, resolve one provider/model route to a row with an explicit
 * confidence, and estimate a window's reference spend. This is deliberately
 * separate from the DeepSeek CNY ledger cost in `pricing.ts`: the ledger keeps
 * its own currency, and this module only ever answers in USD from the public
 * catalog.
 *
 * Catalog shape (`https://models.dev/api.json`):
 * `{ [providerId]: { id, name, models: { [modelKey]: { id, name,
 * canonical_model_id?, cost?: { input, output, cache_read?, cache_write?,
 * tiers?, context_over_200k? } } } } }` — costs are USD per 1M tokens. A
 * missing or zero `cost.input`/`cost.output` means the model is not priced
 * (no row), so a free/unknown model is counted as unpriced rather than
 * silently estimated at $0. Tiered / long-context surcharge prices are
 * ignored: the row is the catalog's base price, which makes the reference
 * estimate conservative.
 *
 * Route → catalog provider aliases (`PROVIDER_ALIASES`) bridge route keys the
 * host sees onto the catalog's provider ids. An exact `${provider}/${model}`
 * row always wins; the alias list is only consulted afterwards:
 * - `deepseek-official` → `deepseek`
 * - `openai-codex`, `codex` → `openai`
 * - `github` → `github-copilot` (the catalog spells the provider id out)
 * - `vercel-ai-gateway` → `vercel`
 * - `moonshot`, `kimi-coding` → `moonshotai`, then `moonshotai-cn`
 * - `moonshotai-cn` → `moonshotai-cn`, then `moonshotai`
 * - `zai-coding` → `zai`, then `zhipuai`
 * - `zai-coding-cn` → `zhipuai`, then `zai`
 * Every other route key is looked up as-is (the catalog's own provider id).
 *
 * Resolution precedence is exact, canonical id, then short model name. A
 * canonical id prefers the route provider family's own catalog row (many
 * resellers publish the same canonical model at different prices) and a
 * canonical/short match only returns when every candidate row agrees on the
 * price, so an ambiguous alias is an honest miss instead of a guess.
 * @module @linxin666/dsh-usage/core/pricing-book
 */

import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { UsageCostEstimate, UsageTokenTotals } from './types.ts'

/** Public models.dev catalog endpoint. */
export const MODELS_DEV_URL = 'https://models.dev/api.json'

/** Default timeout for one catalog fetch. */
export const MODELS_DEV_TIMEOUT_MS = 8_000

/** Price-book cache basename written by `savePriceBook`. */
export const PRICE_BOOK_FILENAME = 'pricing-book.json'

/** How long a cached price book stays fresh (24 hours). */
export const PRICE_BOOK_MAX_AGE_MS = 24 * 60 * 60 * 1_000

/**
 * Route-key → models.dev provider id fallbacks, in precedence order. The exact
 * route key is always tried first (see the module header for the table).
 */
export const PROVIDER_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'deepseek-official': ['deepseek'],
  'openai-codex': ['openai'],
  codex: ['openai'],
  github: ['github-copilot'],
  'vercel-ai-gateway': ['vercel'],
  moonshot: ['moonshotai', 'moonshotai-cn'],
  'kimi-coding': ['moonshotai', 'moonshotai-cn'],
  'moonshotai-cn': ['moonshotai'],
  'zai-coding': ['zai', 'zhipuai'],
  'zai-coding-cn': ['zhipuai', 'zai'],
}

/** One model price row, USD per 1M tokens. */
export interface PriceRow {
  /** Cache-miss (uncached) input. */
  miss: number
  /** Input served from the provider prompt cache. */
  hit: number
  /** Cache-write input; falls back to `miss` when the catalog has no separate price. */
  write: number
  /** Output (reasoning included). */
  out: number
}

/** Lookup tables normalized from one models.dev catalog. */
export interface PriceBookLookups {
  /** Normalized `${provider}/${model}` (lowercase) → price row. */
  rows: Record<string, PriceRow>
  /** Short model name (after the last `/`) → row keys carrying it. */
  byShortName: Record<string, string[]>
  /** Canonical model id (`provider/model`, lowercase) → row keys mapped to it. */
  byCanonical: Record<string, string[]>
}

/** A normalized price book plus the fetch instant (the on-disk cache shape). */
export interface PriceBook extends PriceBookLookups {
  /** Epoch ms of the catalog fetch that produced this book. */
  fetchedAt: number
  source: 'models.dev'
}

/** One resolved route → catalog row, with how it matched and how much to trust it. */
export interface ResolvedPrice {
  row: PriceRow
  /** Match path: exact key, canonical model id, or short model name. */
  via: 'exact' | 'canonical' | 'short'
  /** `high` for exact keys, `medium` for canonical/short fallbacks. */
  confidence: 'high' | 'medium'
  /** Normalized row key that supplied the price (diagnostic). */
  key: string
}

/** Minimal response shape a fetch implementation must satisfy. */
export interface FetchResponseLike {
  ok: boolean
  json(): Promise<unknown>
}

/** Injectable fetch: the global `fetch` satisfies this. */
export type FetchLike = (url: string, init: { signal?: AbortSignal }) => Promise<FetchResponseLike>

/** `fetchPriceBook` options; every dependency is injectable for tests. */
export interface PriceBookFetchOptions {
  /** Fetch implementation (defaults to the global `fetch`). */
  fetchImpl?: FetchLike
  /** Clock returning epoch ms for `fetchedAt` (defaults to `Date.now`). */
  now?: () => number
  /** Per-fetch timeout in ms (defaults to `MODELS_DEV_TIMEOUT_MS`). */
  timeoutMs?: number
}

/** One provider row of the usage window `estimateUsd` prices. */
export interface CostEstimateProviderRow {
  provider: string
  totals: Readonly<UsageTokenTotals>
  /** Per-model breakdown; absent/empty rows stay un-attributed (never guessed). */
  models?: ReadonlyArray<{ model: string; totals: Readonly<UsageTokenTotals> }>
}

/** The minimal usage-window shape `estimateUsd` consumes (`UsageWindowSummary` matches it). */
export interface CostEstimateWindow {
  providers: ReadonlyArray<CostEstimateProviderRow>
}

/** Options for `estimateUsd`. */
export interface EstimateOptions {
  /** Decimal places kept on the USD amount; default 6 (micro-USD). */
  roundDigits?: number
}

/** On-disk cache document; `version` lets a future shape change be detected. */
interface PriceBookDocument {
  version: 1
  fetchedAt: number
  source: 'models.dev'
  rows: Record<string, PriceRow>
  byShortName: Record<string, string[]>
  byCanonical: Record<string, string[]>
}

/** Prototype-free map so untrusted provider/model ids can never pollute objects. */
function safeMap<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>
}

/** Own-property lookup that also works on a JSON-revived plain object. */
function ownLookup<T>(map: unknown, key: string): T | undefined {
  if (typeof map !== 'object' || map === null) return undefined
  return Object.prototype.hasOwnProperty.call(map, key) ? (map as Record<string, T>)[key] : undefined
}

/** Trimmed lowercase id, or '' for non-strings. */
function normalizeId(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/** A finite number, or undefined. */
function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** A finite positive price (a zero/missing input or output means unpriced). */
function positivePrice(value: unknown): number | undefined {
  const price = finiteNumber(value)
  return price !== undefined && price > 0 ? price : undefined
}

/** A finite non-negative price (an explicit published zero is meaningful). */
function nonNegativePrice(value: unknown): number | undefined {
  const price = finiteNumber(value)
  return price !== undefined && price >= 0 ? price : undefined
}

/** The short model name: the segment after the last `/` (whole id when there is none). */
function shortNameOf(modelKey: string): string {
  const slash = modelKey.lastIndexOf('/')
  return slash === -1 ? modelKey : modelKey.slice(slash + 1)
}

/** The provider prefix of a normalized row key (provider ids never contain `/`). */
function providerOfRowKey(rowKey: string): string {
  const slash = rowKey.indexOf('/')
  return slash === -1 ? rowKey : rowKey.slice(0, slash)
}

/** Append `value` to `map[key]`'s list once. */
function pushUnique(map: Record<string, string[]>, key: string, value: string): void {
  const list = map[key] ?? (map[key] = [])
  if (!list.includes(value)) list.push(value)
}

/**
 * Read one catalog `cost` object into a row. Missing/zero input or output, or
 * any malformed number, yields no row (unpriced). `cache_read`/`cache_write`
 * fall back to the cache-miss price when absent; an explicit published zero is
 * kept.
 */
function readableCost(value: unknown): PriceRow | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const cost = value as Record<string, unknown>
  const miss = positivePrice(cost.input)
  const out = positivePrice(cost.output)
  if (miss === undefined || out === undefined) return undefined
  const hit = nonNegativePrice(cost.cache_read)
  const write = nonNegativePrice(cost.cache_write)
  return { miss, hit: hit ?? miss, write: write ?? miss, out }
}

/**
 * Normalize a models.dev catalog (untrusted JSON) into lookup tables. Unknown
 * shapes resolve to empty tables; malformed provider/model/cost entries are
 * dropped rather than thrown. Never throws.
 */
export function normalizeModelsDev(json: unknown): PriceBookLookups {
  const rows = safeMap<PriceRow>()
  const byShortName = safeMap<string[]>()
  const byCanonical = safeMap<string[]>()
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return { rows, byShortName, byCanonical }
  for (const [providerId, providerValue] of Object.entries(json as Record<string, unknown>)) {
    const providerKey = normalizeId(providerId)
    if (providerKey === '') continue
    if (typeof providerValue !== 'object' || providerValue === null) continue
    const models = (providerValue as Record<string, unknown>).models
    if (typeof models !== 'object' || models === null || Array.isArray(models)) continue
    for (const [modelKeyRaw, modelValue] of Object.entries(models as Record<string, unknown>)) {
      if (typeof modelValue !== 'object' || modelValue === null) continue
      const model = modelValue as Record<string, unknown>
      const row = readableCost(model.cost)
      if (row === undefined) continue
      const modelKey = normalizeId(modelKeyRaw)
      if (modelKey === '') continue
      const rowKey = `${providerKey}/${modelKey}`
      rows[rowKey] = row
      const modelId = normalizeId(model.id)
      if (modelId !== '' && modelId !== modelKey) rows[`${providerKey}/${modelId}`] = row
      const canonicalId = normalizeId(model.canonical_model_id)
      if (canonicalId.includes('/')) pushUnique(byCanonical, canonicalId, rowKey)
      // Short names only help when the catalog id itself carries a namespace
      // segment (openrouter/vercel style); otherwise it is the exact id.
      const aliasModelKeys = modelId !== '' && modelId !== modelKey ? [modelKey, modelId] : [modelKey]
      for (const key of aliasModelKeys) {
        const short = shortNameOf(key)
        if (short !== key) pushUnique(byShortName, short, rowKey)
      }
    }
  }
  return { rows, byShortName, byCanonical }
}

/** The route key plus its documented catalog provider aliases, deduplicated. */
function providerCandidates(providerKey: string): string[] {
  const candidates = [providerKey]
  const seen = new Set(candidates)
  const aliases = PROVIDER_ALIASES[providerKey]
  if (Array.isArray(aliases)) {
    for (const alias of aliases) {
      const normalized = normalizeId(alias)
      if (normalized !== '' && !seen.has(normalized)) {
        seen.add(normalized)
        candidates.push(normalized)
      }
    }
  }
  return candidates
}

/** Read the row at one normalized key, if present. */
function rowAt(book: PriceBookLookups, key: string): PriceRow | undefined {
  return ownLookup<PriceRow>(book.rows, key)
}

/** Whether two rows publish the same four prices. */
function sameRow(left: PriceRow, right: PriceRow): boolean {
  return left.miss === right.miss && left.hit === right.hit && left.write === right.write && left.out === right.out
}

/**
 * Resolve the row list to one price, only when every candidate row agrees.
 * Returns undefined for an empty or ambiguous list (conservative by design).
 */
function consistentRow(book: PriceBookLookups, rowKeys: readonly string[]): ResolvedPrice | undefined {
  let first: { row: PriceRow; key: string } | undefined
  for (const key of rowKeys) {
    const row = rowAt(book, key)
    if (row === undefined) continue
    if (first === undefined) {
      first = { row, key }
      continue
    }
    if (!sameRow(first.row, row)) return undefined
  }
  if (first === undefined) return undefined
  return { row: first.row, via: 'canonical', confidence: 'medium', key: first.key }
}

/** String-list lookup from a possibly JSON-revived table. */
function stringListAt(map: unknown, key: string): string[] {
  const value = ownLookup<unknown>(map, key)
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
}

/**
 * Resolve one provider/model route to a catalog price. Precedence: exact
 * `${provider}/${model}`, documented provider aliases, canonical model ids,
 * then the short model name (provider-family scoped). Ambiguous canonical or
 * short candidates miss instead of pricing a possibly different model. Never
 * throws.
 */
export function resolvePrice(
  book: PriceBookLookups | undefined | null,
  provider: string,
  model: string,
): ResolvedPrice | undefined {
  try {
    if (book === null || book === undefined || typeof book !== 'object') return undefined
    const providerKey = normalizeId(provider)
    const modelKey = normalizeId(model)
    if (providerKey === '' || modelKey === '') return undefined
    const providers = providerCandidates(providerKey)

    const directKey = `${providerKey}/${modelKey}`
    const direct = rowAt(book, directKey)
    if (direct !== undefined) return { row: direct, via: 'exact', confidence: 'high', key: directKey }

    for (const alias of providers.slice(1)) {
      const aliasKey = `${alias}/${modelKey}`
      const row = rowAt(book, aliasKey)
      if (row !== undefined) return { row, via: 'exact', confidence: 'high', key: aliasKey }
    }

    const family = new Set(providers)
    const canonicalKeys: string[] = []
    for (const candidate of providers) canonicalKeys.push(`${candidate}/${modelKey}`)
    // A fully qualified route model may itself be the canonical id.
    if (modelKey.includes('/')) canonicalKeys.push(modelKey)
    for (const canonicalKey of canonicalKeys) {
      const rowKeys = stringListAt(book.byCanonical, canonicalKey)
      if (rowKeys.length === 0) continue
      // Many resellers publish the same canonical model at different prices.
      // Prefer the route's own provider family first; only fall back to the
      // global row set when the family has no catalog row. Either way the
      // candidate rows must agree, so a genuine conflict is an honest miss.
      const familyRowKeys = rowKeys.filter((rowKey) => family.has(providerOfRowKey(rowKey)))
      const resolved = consistentRow(book, familyRowKeys.length > 0 ? familyRowKeys : rowKeys)
      if (resolved !== undefined) return resolved
    }

    const shortCandidates = stringListAt(book.byShortName, shortNameOf(modelKey))
      .filter((rowKey) => family.has(providerOfRowKey(rowKey)))
    const resolved = consistentRow(book, shortCandidates)
    if (resolved !== undefined) return { ...resolved, via: 'short', confidence: 'medium' }
    return undefined
  } catch {
    return undefined
  }
}

/** A finite non-negative token/call count, else 0. */
function countOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** The subset of a totals bucket the estimator reads, with malformed values zeroed. */
interface SafeTotals {
  calls: number
  input: number
  hit: number
  write: number
  out: number
}

/** Coerce an untrusted totals bucket; malformed numbers become 0. */
function safeTotals(value: unknown): SafeTotals {
  if (typeof value !== 'object' || value === null) {
    return { calls: 0, input: 0, hit: 0, write: 0, out: 0 }
  }
  const totals = value as Record<string, unknown>
  return {
    calls: countOf(totals.calls),
    input: countOf(totals.inputTokens),
    hit: countOf(totals.cacheReadTokens),
    write: countOf(totals.cacheWriteTokens),
    out: countOf(totals.outputTokens),
  }
}

/** One bucket's reference USD spend at a row's per-1M prices. */
function usdFor(totals: SafeTotals, row: PriceRow): number {
  return (totals.input / 1_000_000) * row.miss
    + (totals.hit / 1_000_000) * row.hit
    + (totals.write / 1_000_000) * row.write
    + (totals.out / 1_000_000) * row.out
}

/** Round a USD amount to `digits` places (default 6 = micro-USD). */
function roundAmount(value: number, digits: number | undefined): number {
  const places = typeof digits === 'number' && Number.isInteger(digits) && digits >= 0 && digits <= 12 ? digits : 6
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/**
 * Price one aggregated usage window against the book as a USD reference
 * estimate. Pure and defensive: malformed summaries/rows never throw; only
 * model rows with a resolved price contribute to `amount`, while every
 * provider/model/call is still counted so the priced coverage is honest.
 * Providers whose model list is missing or capped keep their un-attributed
 * calls counted as unpriced. `amount` is omitted when nothing could be priced.
 */
export function estimateUsd(
  summary: CostEstimateWindow | undefined | null,
  book: (PriceBookLookups & { fetchedAt?: number }) | undefined | null,
  options?: EstimateOptions,
): UsageCostEstimate {
  let amount = 0
  let pricedAny = false
  let pricedCalls = 0
  let totalCalls = 0
  let pricedModels = 0
  let totalModels = 0
  try {
    const providerRows = typeof summary === 'object' && summary !== null && Array.isArray(summary.providers)
      ? summary.providers
      : []
    for (const providerRow of providerRows) {
      if (typeof providerRow !== 'object' || providerRow === null) continue
      const provider = typeof providerRow.provider === 'string' ? providerRow.provider : ''
      const providerTotals = safeTotals(providerRow.totals)
      totalCalls += providerTotals.calls
      const modelRows = Array.isArray(providerRow.models) ? providerRow.models : []
      for (const modelRow of modelRows) {
        if (typeof modelRow !== 'object' || modelRow === null) continue
        totalModels += 1
        const model = typeof modelRow.model === 'string' ? modelRow.model : ''
        const totals = safeTotals(modelRow.totals)
        if (model === '') continue
        const resolved = resolvePrice(book, provider, model)
        if (resolved === undefined) continue
        pricedModels += 1
        pricedCalls += totals.calls
        amount += usdFor(totals, resolved.row)
        pricedAny = true
      }
    }
  } catch {
    // Defensive: an unexpected shape must not escape the estimator.
  }
  const estimate: UsageCostEstimate = {
    currency: 'USD',
    pricedCalls,
    totalCalls,
    pricedModels,
    totalModels,
    source: 'models.dev',
  }
  if (pricedAny) estimate.amount = roundAmount(amount, options?.roundDigits)
  const fetchedAt = typeof book === 'object' && book !== null ? finiteNumber(book.fetchedAt) : undefined
  if (fetchedAt !== undefined) estimate.priceBookUpdatedAt = fetchedAt
  return estimate
}

/**
 * Fetch and normalize the models.dev catalog. Returns undefined on any
 * failure (network error, non-2xx, timeout, unparsable/non-object JSON) and
 * never throws. The injected clock stamps `fetchedAt`.
 */
export async function fetchPriceBook(options: PriceBookFetchOptions = {}): Promise<PriceBook | undefined> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike | undefined)
  if (typeof fetchImpl !== 'function') return undefined
  const timeoutMs = typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : MODELS_DEV_TIMEOUT_MS
  const now = typeof options.now === 'function' ? options.now : Date.now
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => {
        controller.abort()
        resolve(undefined)
      }, timeoutMs)
    })
    const request = (async () => {
      const response = await fetchImpl(MODELS_DEV_URL, { signal: controller.signal })
      if (response === null || typeof response !== 'object' || response.ok !== true) return undefined
      const json: unknown = await response.json()
      if (typeof json !== 'object' || json === null || Array.isArray(json)) return undefined
      return normalizeModelsDev(json)
    })().catch(() => undefined)
    const normalized = await Promise.race([request, timeout])
    if (normalized === undefined) return undefined
    return { ...normalized, fetchedAt: now(), source: 'models.dev' }
  } catch {
    return undefined
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/**
 * Whether a book is within `PRICE_BOOK_MAX_AGE_MS` of `now` (24h). Future
 * timestamps within the window count as fresh (clock skew tolerance); a
 * missing/invalid `fetchedAt` or non-finite `now` is never fresh.
 */
export function isPriceBookFresh(book: { fetchedAt?: unknown } | undefined | null, now: number = Date.now()): boolean {
  if (typeof book !== 'object' || book === null) return false
  const fetchedAt = finiteNumber((book as { fetchedAt?: unknown }).fetchedAt)
  if (fetchedAt === undefined || !Number.isFinite(now)) return false
  return Math.abs(now - fetchedAt) <= PRICE_BOOK_MAX_AGE_MS
}

/** Revive one untrusted cache row; malformed/zero-price rows are dropped. */
function reviveRow(value: unknown): PriceRow | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  const miss = positivePrice(row.miss)
  const out = positivePrice(row.out)
  const hit = nonNegativePrice(row.hit)
  const write = nonNegativePrice(row.write)
  if (miss === undefined || out === undefined || hit === undefined || write === undefined) return undefined
  return { miss, hit, write, out }
}

/** Revive a string-list table, keeping only keys that resolve to a loaded row. */
function reviveStringListMap(value: unknown, rows: Record<string, PriceRow>): Record<string, string[]> {
  const revived = safeMap<string[]>()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return revived
  for (const [key, listValue] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(listValue)) continue
    const keys: string[] = []
    for (const entry of listValue) {
      if (typeof entry !== 'string' || entry === '') continue
      if (ownLookup<PriceRow>(rows, entry) === undefined) continue
      if (!keys.includes(entry)) keys.push(entry)
    }
    if (keys.length > 0) revived[key] = keys
  }
  return revived
}

/** Revive an untrusted cache document; anything structurally invalid is undefined. */
function revivePriceBook(value: unknown): PriceBook | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const document = value as Record<string, unknown>
  const fetchedAt = finiteNumber(document.fetchedAt)
  const rawRows = document.rows
  if (fetchedAt === undefined || typeof rawRows !== 'object' || rawRows === null || Array.isArray(rawRows)) return undefined
  const rows = safeMap<PriceRow>()
  for (const [key, rowValue] of Object.entries(rawRows as Record<string, unknown>)) {
    const row = reviveRow(rowValue)
    if (row !== undefined) rows[key] = row
  }
  return {
    fetchedAt,
    source: 'models.dev',
    rows,
    byShortName: reviveStringListMap(document.byShortName, rows),
    byCanonical: reviveStringListMap(document.byCanonical, rows),
  }
}

/**
 * Atomically write `<dir>/pricing-book.json` (temp file + fsync + rename), so
 * a crash never leaves a half-written cache. Returns false on any failure and
 * never throws.
 */
export async function savePriceBook(dir: string, book: PriceBook): Promise<boolean> {
  if (typeof dir !== 'string' || dir.trim() === '') return false
  if (typeof book !== 'object' || book === null) return false
  const target = join(dir, PRICE_BOOK_FILENAME)
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  try {
    await mkdir(dir, { recursive: true })
    const document: PriceBookDocument = {
      version: 1,
      fetchedAt: book.fetchedAt,
      source: 'models.dev',
      rows: book.rows,
      byShortName: book.byShortName,
      byCanonical: book.byCanonical,
    }
    const handle = await open(temp, 'w')
    try {
      await handle.writeFile(JSON.stringify(document), 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temp, target)
    return true
  } catch {
    await unlink(temp).catch(() => {})
    return false
  }
}

/**
 * Read `<dir>/pricing-book.json`. Returns undefined when the file is missing,
 * unparsable, structurally invalid, or the directory is unusable; malformed
 * rows are dropped. Never throws.
 */
export async function loadPriceBook(dir: string): Promise<PriceBook | undefined> {
  if (typeof dir !== 'string' || dir.trim() === '') return undefined
  try {
    const raw = await readFile(join(dir, PRICE_BOOK_FILENAME), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    return revivePriceBook(parsed)
  } catch {
    return undefined
  }
}
