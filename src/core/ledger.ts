/**
 * The usage ledger: a pure fold from session usage facts into a per-day,
 * per-provider, per-model totals document, plus its JSON serialization.
 * Host-side state lives only in the document; the service owns persistence.
 * @module @linxin666/dsh-usage/core/ledger
 */

import { addTotals, emptyTotals, type UsageDaySummary, type UsageLedgerDocument, type UsageProviderSummary, type UsageTokenTotals, type UsageWindowSummary } from './types.ts'

/** Local-date key (`YYYY-MM-DD`) for an epoch ms timestamp. */
export function localDateKey(ms: number): string {
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** An empty ledger document. */
export function createLedgerDocument(): UsageLedgerDocument {
  return { version: 1, days: {} }
}

/**
 * Bucket keys come from untrusted directions (persisted JSON, provider and
 * model ids out of session events), so they must never collide with
 * `Object.prototype` plumbing: assigning `day['__proto__']` or reading
 * `day['constructor']` would pollute every object in the host process.
 */
function isSafeBucketKey(key: string): boolean {
  return key !== '__proto__' && key !== 'constructor' && key !== 'prototype'
}

/**
 * Fold one usage report into the ledger in place. `provider` is the route key
 * and `model` the provider-owned model id the step ran under. Reports keyed
 * by prototype-plumbing names are dropped.
 */
export function foldUsage(
  doc: UsageLedgerDocument,
  atMs: number,
  provider: string,
  model: string,
  usage: Readonly<UsageTokenTotals>,
): void {
  if (!isSafeBucketKey(provider) || !isSafeBucketKey(model)) return
  if (usage.calls <= 0 && usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens <= 0) return
  const dayKey = localDateKey(atMs)
  const day = doc.days[dayKey] ?? {}
  const models = day[provider] ?? {}
  const totals = models[model] ?? emptyTotals()
  addTotals(totals, usage)
  models[model] = totals
  day[provider] = models
  doc.days[dayKey] = day
}

/** Total tokens of a bucket (billed input + output; reasoning is inside output). */
export function totalTokens(totals: Readonly<UsageTokenTotals>): number {
  return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens
}

/** How many model rows one summarized provider keeps. */
export const SUMMARY_MODEL_CAP = 12

/**
 * Aggregate whole per-day maps (each `provider -> model -> totals`) into the
 * per-provider/per-model summary the overview serves for one day or a range:
 * disjoint bucket sums per provider, per-model rows heaviest first, and the
 * grand total. Pure: reads its inputs, allocates fresh buckets.
 */
export function summarizeDays(days: ReadonlyArray<Record<string, Record<string, UsageTokenTotals>>>): {
  totals: UsageTokenTotals
  providers: UsageProviderSummary[]
} {
  const merged = new Map<string, Map<string, UsageTokenTotals>>()
  for (const day of days) {
    for (const [provider, models] of Object.entries(day)) {
      if (!isSafeBucketKey(provider) || typeof models !== 'object' || models === null) continue
      let modelMap = merged.get(provider)
      if (modelMap === undefined) {
        modelMap = new Map()
        merged.set(provider, modelMap)
      }
      for (const [model, totals] of Object.entries(models)) {
        if (typeof totals !== 'object' || totals === null) continue
        const bucket = modelMap.get(model) ?? emptyTotals()
        addTotals(bucket, totals)
        modelMap.set(model, bucket)
      }
    }
  }
  const providers: UsageProviderSummary[] = []
  const totals = emptyTotals()
  for (const [provider, modelMap] of merged) {
    const providerTotals = emptyTotals()
    const modelRows = [...modelMap].map(([model, modelTotals]) => ({ model, totals: modelTotals }))
    for (const row of modelRows) addTotals(providerTotals, row.totals)
    modelRows.sort((a, b) => totalTokens(b.totals) - totalTokens(a.totals))
    providers.push({ provider, totals: providerTotals, models: modelRows.slice(0, SUMMARY_MODEL_CAP) })
  }
  providers.sort((a, b) => totalTokens(b.totals) - totalTokens(a.totals))
  for (const row of providers) addTotals(totals, row.totals)
  return { totals, providers }
}

/** One provider row aggregated over a window, without its per-model detail. */
export interface UsageProviderTotalsRow {
  provider: string
  totals: UsageTokenTotals
}

/**
 * Aggregate whole per-day maps into per-provider totals and a grand total
 * only. Same provider ordering as `summarizeDays` (heaviest by total tokens
 * first, stable on first appearance), but no model rows are built or sorted:
 * the overview's all-time window renders provider totals only, so the
 * per-model breakdown would be dead weight that grows with retained history.
 * Pure: reads its inputs, allocates fresh buckets.
 */
export function summarizeProviderTotals(days: ReadonlyArray<Record<string, Record<string, UsageTokenTotals>>>): {
  totals: UsageTokenTotals
  providers: UsageProviderTotalsRow[]
} {
  const merged = new Map<string, UsageTokenTotals>()
  for (const day of days) {
    for (const [provider, models] of Object.entries(day)) {
      if (!isSafeBucketKey(provider) || typeof models !== 'object' || models === null) continue
      const bucket = merged.get(provider) ?? emptyTotals()
      for (const totals of Object.values(models)) {
        if (typeof totals !== 'object' || totals === null) continue
        addTotals(bucket, totals)
      }
      merged.set(provider, bucket)
    }
  }
  const providers: UsageProviderTotalsRow[] = [...merged].map(([provider, totals]) => ({ provider, totals }))
  providers.sort((a, b) => totalTokens(b.totals) - totalTokens(a.totals))
  const totals = emptyTotals()
  for (const row of providers) addTotals(totals, row.totals)
  return { totals, providers }
}

/**
 * One total per requested local day. The heatmap needs per-day token totals
 * for up to 182 days; walking each day's provider/model buckets once here is
 * far cheaper than running the full `summarizeDays` per day (which allocates
 * and sorts model rows the heatmap never reads). Days missing from the ledger
 * resolve to a fresh zero bucket, like `summarizeDays([{}])`.
 */
export function summarizeDayTotals(
  doc: Readonly<UsageLedgerDocument>,
  dayKeys: readonly string[],
): Map<string, UsageTokenTotals> {
  const totalsByDay = new Map<string, UsageTokenTotals>()
  for (const dateKey of dayKeys) {
    const bucket = emptyTotals()
    const day = doc.days[dateKey]
    if (day !== undefined) {
      for (const [provider, models] of Object.entries(day)) {
        if (!isSafeBucketKey(provider) || typeof models !== 'object' || models === null) continue
        for (const modelTotals of Object.values(models)) {
          if (typeof modelTotals !== 'object' || modelTotals === null) continue
          addTotals(bucket, modelTotals)
        }
      }
    }
    totalsByDay.set(dateKey, bucket)
  }
  return totalsByDay
}

/** The window options one overview aggregation is built for. */
export interface LedgerUsageOptions {
  /** The current local day key (`YYYY-MM-DD`). */
  todayKey: string
  /** How many trailing days the heatmap receives (retention already applied by the caller). */
  heatmapDays: number
  /** How many trailing days the trend window aggregates. */
  rangeDays: number
}

/**
 * Everything the overview's `usage` section needs, aggregated from one ledger
 * snapshot in one pass per window. Pure and deterministic; the host service
 * caches the result per ledger revision so a warm browser poll does not walk
 * the retained ledger again.
 */
export interface LedgerUsageSummary {
  todayKey: string
  /** All retained day keys, ascending. */
  allKeys: string[]
  /** The trailing heatmap window (`allKeys.slice(-heatmapDays)`). */
  heatmapKeys: string[]
  /** The trailing trend window (`allKeys.slice(-rangeDays)`). */
  rangeKeys: string[]
  /** Per-day totals for the heatmap, in heatmap order. */
  days: UsageDaySummary[]
  today: { date: string; totals: UsageTokenTotals; providers: UsageProviderSummary[] }
  range: UsageWindowSummary
  all: UsageWindowSummary
  /** Every provider with usage in any window; the overview keeps these rows. */
  usageProviders: Set<string>
}

/**
 * Aggregate the overview usage windows from a ledger document. The all-time
 * window skips the per-model breakdown (`models: []` rows) exactly like the
 * previous inline assembly, but without building model rows first.
 */
export function summarizeLedgerUsage(
  doc: Readonly<UsageLedgerDocument>,
  options: LedgerUsageOptions,
): LedgerUsageSummary {
  const allKeys = ledgerDayKeys(doc)
  const heatmapKeys = allKeys.slice(-options.heatmapDays)
  const rangeKeys = allKeys.slice(-options.rangeDays)
  const range = summarizeDays(rangeKeys.map((key) => doc.days[key] ?? {}))
  const all = summarizeProviderTotals(allKeys.map((key) => doc.days[key] ?? {}))
  const today = summarizeDays([doc.days[options.todayKey] ?? {}])
  const dayTotals = summarizeDayTotals(doc, heatmapKeys)
  const days: UsageDaySummary[] = heatmapKeys.map((date) => ({
    date,
    totals: dayTotals.get(date) ?? emptyTotals(),
  }))
  const usageProviders = new Set<string>()
  for (const row of today.providers) usageProviders.add(row.provider)
  for (const row of range.providers) usageProviders.add(row.provider)
  for (const row of all.providers) usageProviders.add(row.provider)
  return {
    todayKey: options.todayKey,
    allKeys,
    heatmapKeys,
    rangeKeys,
    days,
    today: { date: options.todayKey, totals: today.totals, providers: today.providers },
    range: {
      from: rangeKeys[0] ?? options.todayKey,
      to: rangeKeys[rangeKeys.length - 1] ?? options.todayKey,
      totals: range.totals,
      providers: range.providers,
    },
    all: {
      from: allKeys[0] ?? options.todayKey,
      to: allKeys[allKeys.length - 1] ?? options.todayKey,
      totals: all.totals,
      // Only the totals render; the per-model breakdown is dead weight.
      providers: all.providers.map(({ provider, totals }) => ({ provider, totals, models: [] })),
    },
    usageProviders,
  }
}

/** All local-date keys in the ledger, ascending. */
export function ledgerDayKeys(doc: Readonly<UsageLedgerDocument>): string[] {
  return Object.keys(doc.days).sort()
}

/**
 * Drop every day older than `retainDays` local days before `todayKey`, in
 * place. Returns the number of pruned days.
 */
export function pruneLedger(doc: UsageLedgerDocument, todayKey: string, retainDays: number): number {
  const cutoff = new Date(todayKey + 'T00:00:00')
  cutoff.setDate(cutoff.getDate() - retainDays)
  const cutoffKey = localDateKey(cutoff.getTime())
  let pruned = 0
  for (const key of Object.keys(doc.days)) {
    if (key < cutoffKey) {
      delete doc.days[key]
      pruned += 1
    }
  }
  return pruned
}

function reviveTotals(value: unknown): UsageTokenTotals | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const source = value as Record<string, unknown>
  const num = (key: string): number => typeof source[key] === 'number' && Number.isFinite(source[key]) ? source[key] : 0
  return {
    inputTokens: num('inputTokens'),
    outputTokens: num('outputTokens'),
    cacheReadTokens: num('cacheReadTokens'),
    cacheWriteTokens: num('cacheWriteTokens'),
    reasoningTokens: num('reasoningTokens'),
    calls: num('calls'),
    cost: num('cost'),
  }
}

/**
 * Parse a ledger document from untrusted JSON: unknown shapes resolve to an
 * empty document, malformed entries are dropped, numbers are coerced to
 * finite values. Never throws.
 */
export function deserializeLedger(value: unknown): UsageLedgerDocument {
  const doc = createLedgerDocument()
  if (typeof value !== 'object' || value === null) return doc
  const days = (value as Record<string, unknown>).days
  if (typeof days !== 'object' || days === null) return doc
  for (const [dateKey, providers] of Object.entries(days as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || typeof providers !== 'object' || providers === null) continue
    // Round-trip the date key: an impossible date (9999-99-99) parses to NaN
    // and a rollover (2026-02-30) lands on another day; both would otherwise
    // fold into a bogus, never-pruned bucket.
    const atMs = new Date(dateKey + 'T12:00:00').getTime()
    if (!Number.isFinite(atMs) || localDateKey(atMs) !== dateKey) continue
    for (const [provider, models] of Object.entries(providers as Record<string, unknown>)) {
      if (typeof models !== 'object' || models === null) continue
      for (const [model, totals] of Object.entries(models as Record<string, unknown>)) {
        const revived = reviveTotals(totals)
        if (revived !== undefined) foldUsage(doc, atMs, provider, model, revived)
      }
    }
  }
  return doc
}
