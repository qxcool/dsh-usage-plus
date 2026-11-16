/**
 * Aggregate ledger export: flatten the per-day/per-provider/per-model ledger
 * document into the wire entries the export route serves as CSV or JSON.
 * Pure and deterministic; the route owns HTTP framing and the service owns the
 * ledger snapshot.
 * @module dsh-usage-plus/host/export
 */
import type { UsageLedgerDocument, UsageTokenTotals } from '../core/types.ts';
/** Default export window in local days. */
export declare const EXPORT_DEFAULT_DAYS = 182;
/** Smallest accepted export window. */
export declare const EXPORT_MIN_DAYS = 1;
/** Largest accepted export window. */
export declare const EXPORT_MAX_DAYS = 730;
/** CSV columns, in the exact wire order. */
export declare const EXPORT_CSV_COLUMNS: readonly ["date", "provider", "model", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "reasoning_tokens", "calls", "cost"];
/** The CSV header line (no quoting needed for these plain field names). */
export declare const EXPORT_CSV_HEADER: string;
/** One flattened ledger row. */
export interface LedgerExportEntry {
    date: string;
    provider: string;
    model: string;
    totals: UsageTokenTotals;
}
/** The JSON export document. */
export interface LedgerExportDocument {
    version: 1;
    exportedAt: number;
    days: number;
    entries: LedgerExportEntry[];
}
/** An accepted export range in local date keys (inclusive). */
export interface ExportWindow {
    fromKey: string;
    toKey: string;
}
/**
 * Resolve the `days` query value for export: absent -> 182, integer 1..730 ->
 * itself, anything else -> undefined (route answers 400).
 */
export declare function resolveExportDays(value: unknown): number | undefined;
/** Resolve the `format` query value; undefined means the route answers 400. */
export declare function resolveExportFormat(value: unknown): 'csv' | 'json' | undefined;
/** Inclusive local-date-key window for the last `days` days ending today. */
export declare function exportWindow(nowMs: number, days: number): ExportWindow;
/**
 * Flatten ledger buckets inside the last `days` local days into export rows,
 * sorted by date, then provider, then model. Only ledger aggregates are read:
 * no credential, session-content, or provider-secret value can appear here.
 */
export declare function collectExportEntries(ledger: Readonly<UsageLedgerDocument>, nowMs: number, days: number): LedgerExportEntry[];
/** Build the JSON export document for a ledger snapshot. */
export declare function buildExportDocument(ledger: Readonly<UsageLedgerDocument>, days: number, nowMs?: number): LedgerExportDocument;
/**
 * Quote one CSV field when it contains a comma, quote, CR, or LF (RFC 4180:
 * quotes doubled). Numbers render as their shortest decimal form.
 */
export declare function csvField(value: string | number): string;
/** Serialize export rows as CRLF-terminated CSV with the exact contract header. */
export declare function exportCsv(entries: readonly LedgerExportEntry[]): string;
/** Attachment filename for one export instant, e.g. `dsh-usage-2026-11-16.csv`. */
export declare function exportFilename(nowMs: number, extension: 'csv' | 'json'): string;
//# sourceMappingURL=export.d.ts.map