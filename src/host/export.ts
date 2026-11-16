/**
 * Aggregate ledger export: flatten the per-day/per-provider/per-model ledger
 * document into the wire entries the export route serves as CSV or JSON.
 * Pure and deterministic; the route owns HTTP framing and the service owns the
 * ledger snapshot.
 * @module dsh-usage-plus/host/export
 */

import { localDateKey } from '../core/ledger.ts'
import type { UsageLedgerDocument, UsageTokenTotals } from '../core/types.ts'

/** Default export window in local days. */
export const EXPORT_DEFAULT_DAYS = 182

/** Smallest accepted export window. */
export const EXPORT_MIN_DAYS = 1

/** Largest accepted export window. */
export const EXPORT_MAX_DAYS = 730

/** CSV columns, in the exact wire order. */
export const EXPORT_CSV_COLUMNS = [
  'date',
  'provider',
  'model',
  'input_tokens',
  'output_tokens',
  'cache_read_tokens',
  'cache_write_tokens',
  'reasoning_tokens',
  'calls',
  'cost',
] as const

/** The CSV header line (no quoting needed for these plain field names). */
export const EXPORT_CSV_HEADER = EXPORT_CSV_COLUMNS.join(',')

/** One flattened ledger row. */
export interface LedgerExportEntry {
  date: string
  provider: string
  model: string
  totals: UsageTokenTotals
}

/** The JSON export document. */
export interface LedgerExportDocument {
  version: 1
  exportedAt: number
  days: number
  entries: LedgerExportEntry[]
}

/** An accepted export range in local date keys (inclusive). */
export interface ExportWindow {
  fromKey: string
  toKey: string
}

/**
 * Resolve the `days` query value for export: absent -> 182, integer 1..730 ->
 * itself, anything else -> undefined (route answers 400).
 */
export function resolveExportDays(value: unknown): number | undefined {
  if (value === undefined || value === null) return EXPORT_DEFAULT_DAYS
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN
  if (!Number.isInteger(parsed) || parsed < EXPORT_MIN_DAYS || parsed > EXPORT_MAX_DAYS) return undefined
  return parsed
}

/** Resolve the `format` query value; undefined means the route answers 400. */
export function resolveExportFormat(value: unknown): 'csv' | 'json' | undefined {
  return value === 'csv' || value === 'json' ? value : undefined
}

/** Inclusive local-date-key window for the last `days` days ending today. */
export function exportWindow(nowMs: number, days: number): ExportWindow {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : EXPORT_DEFAULT_DAYS
  const toKey = localDateKey(nowMs)
  const from = new Date(toKey + 'T00:00:00')
  from.setDate(from.getDate() - (safeDays - 1))
  return { fromKey: localDateKey(from.getTime()), toKey }
}

/** Copy a totals bucket into a plain, complete wire object. */
function copyTotals(totals: Readonly<UsageTokenTotals>): UsageTokenTotals {
  return {
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cacheReadTokens: totals.cacheReadTokens,
    cacheWriteTokens: totals.cacheWriteTokens,
    reasoningTokens: totals.reasoningTokens,
    calls: totals.calls,
    cost: totals.cost,
  }
}

/**
 * Flatten ledger buckets inside the last `days` local days into export rows,
 * sorted by date, then provider, then model. Only ledger aggregates are read:
 * no credential, session-content, or provider-secret value can appear here.
 */
export function collectExportEntries(ledger: Readonly<UsageLedgerDocument>, nowMs: number, days: number): LedgerExportEntry[] {
  const { fromKey, toKey } = exportWindow(nowMs, days)
  const entries: LedgerExportEntry[] = []
  for (const date of Object.keys(ledger.days).sort()) {
    if (date < fromKey || date > toKey) continue
    const day = ledger.days[date]
    if (typeof day !== 'object' || day === null) continue
    for (const provider of Object.keys(day).sort()) {
      const models = day[provider]
      if (typeof models !== 'object' || models === null) continue
      for (const model of Object.keys(models).sort()) {
        const totals = models[model]
        if (typeof totals !== 'object' || totals === null) continue
        entries.push({ date, provider, model, totals: copyTotals(totals) })
      }
    }
  }
  return entries
}

/** Build the JSON export document for a ledger snapshot. */
export function buildExportDocument(ledger: Readonly<UsageLedgerDocument>, days: number, nowMs: number = Date.now()): LedgerExportDocument {
  const safeDays = resolveExportDays(days) ?? EXPORT_DEFAULT_DAYS
  return {
    version: 1,
    exportedAt: nowMs,
    days: safeDays,
    entries: collectExportEntries(ledger, nowMs, safeDays),
  }
}

/**
 * Quote one CSV field when it contains a comma, quote, CR, or LF (RFC 4180:
 * quotes doubled). Numbers render as their shortest decimal form.
 */
export function csvField(value: string | number): string {
  const text = String(value)
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

/** Serialize export rows as CRLF-terminated CSV with the exact contract header. */
export function exportCsv(entries: readonly LedgerExportEntry[]): string {
  const lines: string[] = [EXPORT_CSV_HEADER]
  for (const entry of entries) {
    const totals = entry.totals
    lines.push([
      entry.date,
      entry.provider,
      entry.model,
      totals.inputTokens,
      totals.outputTokens,
      totals.cacheReadTokens,
      totals.cacheWriteTokens,
      totals.reasoningTokens,
      totals.calls,
      totals.cost,
    ].map(csvField).join(','))
  }
  return `${lines.join('\r\n')}\r\n`
}

/** Attachment filename for one export instant, e.g. `dsh-usage-2026-11-16.csv`. */
export function exportFilename(nowMs: number, extension: 'csv' | 'json'): string {
  return `dsh-usage-${localDateKey(nowMs)}.${extension}`
}
