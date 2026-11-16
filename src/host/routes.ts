import type { IncomingMessage, ServerResponse } from 'node:http'
import { appendFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { ExternalCredentialTarget } from '../core/types.ts'
import { asJsonObject, readJsonBody, writeJson, writeText } from './http.ts'
import { isLoopbackRequest } from './loopback.ts'
import { exportCsv, exportFilename, resolveExportDays, resolveExportFormat } from './export.ts'
import { resolveRangeDays, type UsageService } from './usage-service.ts'
import { localDateKey } from '../core/ledger.ts'
import { dshHome } from '../dsh-home.ts'

export const USAGE_API_PREFIX = '/api/dsh-usage-plus'

/** Rotate the client-diagnostic NDJSON once it passes this size. */
const CLIENT_DIAG_MAX_BYTES = 256 * 1024

const FIXED_CREDENTIAL_TARGETS = new Set(['cpamc', 'volcano.ak', 'volcano.sk'])

/** Parsed query string of one request; an unparsable URL reads as no query. */
function requestQuery(req: IncomingMessage): URLSearchParams {
  try {
    return new URL(req.url ?? '/', 'http://localhost').searchParams
  } catch {
    return new URLSearchParams()
  }
}

/**
 * Whether an `If-None-Match` header names this ETag. Handles the list form,
 * weak validators (`W/"..."`), and the `*` wildcard.
 */
export function requestEtagMatches(ifNoneMatch: string, etag: string): boolean {
  return ifNoneMatch.split(',').some((candidate) => {
    const value = candidate.trim().replace(/^W\//i, '')
    return value === etag || value === '*'
  })
}

function parseCredentialTarget(raw: unknown): ExternalCredentialTarget | undefined {
  if (typeof raw !== 'string') return undefined
  if (FIXED_CREDENTIAL_TARGETS.has(raw)) return raw as ExternalCredentialTarget
  return undefined
}

/**
 * Loopback-fenced overview route: provider balances, plan quotas, and token
 * usage totals. Personal account data, so the loopback fence mirrors
 * dsh-perf's stats surface; the browser runs on the same machine.
 *
 * Conditional GET: the browser-strip poller revalidates with
 * `If-None-Match`, so an unchanged document costs a 304 instead of a full
 * body every cadence.
 */
export function makeUsageOverviewRoute(service: UsageService): WebRoute {
  return {
    kind: 'exact',
    path: USAGE_API_PREFIX + '/overview',
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' })
        return
      }
      // `?days=` selects the trend window; absent keeps the historical 30-day
      // default, and anything outside the accepted set is a client error.
      const days = resolveRangeDays(requestQuery(req).get('days') ?? undefined)
      if (days === undefined) {
        writeJson(res, 400, { ok: false, error: 'invalid days' })
        return
      }
      // The service caches the document and its ETag per data revision and
      // range window: a warm poll costs a cache lookup, and an unchanged
      // document can answer 304 without re-serializing the JSON body.
      const { document, etag } = await service.overviewPayload(days)
      const ifNoneMatch = req.headers['if-none-match']
      if (typeof ifNoneMatch === 'string' && requestEtagMatches(ifNoneMatch, etag)) {
        res.writeHead(304, { etag, 'cache-control': 'no-store' })
        res.end()
        return
      }
      writeJson(res, 200, document, { etag, 'cache-control': 'no-store' })
    },
  }
}

/**
 * Loopback-fenced aggregate export of the usage ledger.
 *
 * `GET /api/dsh-usage-plus/export?format=csv|json&days=N` where `days` is an
 * integer 1..730 (default 182). The payload is ledger aggregates only — no
 * credential, session-content, or provider-secret value is read. CSV uses the
 * fixed column contract and a CRLF body; JSON serves the versioned document.
 */
export function makeUsageExportRoute(service: UsageService): WebRoute {
  return {
    kind: 'exact',
    path: USAGE_API_PREFIX + '/export',
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' })
        return
      }
      if (req.method !== 'GET') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const query = requestQuery(req)
      const format = resolveExportFormat(query.get('format') ?? undefined)
      const days = resolveExportDays(query.get('days') ?? undefined)
      if (format === undefined || days === undefined) {
        writeJson(res, 400, { ok: false, error: 'invalid format or days' })
        return
      }
      const document = service.exportLedger(days)
      const headers = {
        'cache-control': 'no-store',
        'content-disposition': `attachment; filename="${exportFilename(document.exportedAt, format)}"`,
      }
      if (format === 'json') {
        writeJson(res, 200, document, headers)
        return
      }
      writeText(res, 200, exportCsv(document.entries), { ...headers, 'content-type': 'text/csv; charset=utf-8' })
    },
  }
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Loopback-fenced per-day drill-down used by the Overview heatmap. Returns the
 * ledger's provider/model rows for one local date (zeros for a day with no
 * usage); future or malformed dates are client errors.
 */
export function makeUsageDayRoute(service: UsageService): WebRoute {
  return {
    kind: 'exact',
    path: USAGE_API_PREFIX + '/day',
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' })
        return
      }
      if (req.method !== 'GET') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const date = requestQuery(req).get('date') ?? ''
      if (!DATE_KEY.test(date)) {
        writeJson(res, 400, { ok: false, error: 'invalid date' })
        return
      }
      const detail = service.dayDetail(date)
      if (detail.date > localDateKey(Date.now())) {
        writeJson(res, 400, { ok: false, error: 'future date' })
        return
      }
      writeJson(res, 200, detail, { 'cache-control': 'no-store' })
    },
  }
}

/**
 * Loopback-fenced external-source connection test used by the Settings
 * "test connection" button. Returns only probe facts and hints; no secret
 * value ever crosses the wire.
 */
export function makeUsageTestRoute(service: UsageService): WebRoute {
  return {
    kind: 'exact',
    path: USAGE_API_PREFIX + '/test',
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const body = asJsonObject(await readJsonBody(req, { objectOnly: true, maxBytes: 4 * 1024 }))
      const target = body?.target === 'cpamc' || body?.target === 'volcano' || body?.target === 'custom' ? body.target : undefined
      const planId = target === 'custom' && typeof body?.id === 'string' && /^[a-z0-9][a-z0-9-]{0,31}$/.test(body.id) ? body.id : undefined
      if (body === undefined || target === undefined) {
        writeJson(res, 400, { ok: false, error: 'invalid target' })
        return
      }
      if (target === 'custom' && body?.id !== undefined && planId === undefined) {
        writeJson(res, 400, { ok: false, error: 'invalid plan id' })
        return
      }
      const result = await service.testExternalSource(target, planId)
      writeJson(res, 200, result, { 'cache-control': 'no-store' })
    },
  }
}

/**
 * Loopback-fenced manual refresh: forces one probe cycle now and answers
 * with the fresh overview.
 */
export function makeUsageRefreshRoute(service: UsageService): WebRoute {
  return {
    kind: 'exact',
    path: USAGE_API_PREFIX + '/refresh',
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      try {
        await service.refresh()
      } catch (error) {
        writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : 'refresh failed' })
        return
      }
      writeJson(res, 200, await service.overview(), { 'cache-control': 'no-store' })
    },
  }
}

/**
 * Loopback-fenced write-only credential route for CPAMC management token and
 * Volcano AK/SK. Secrets land in the DSH credential store and never come back
 * on the wire — only ok/error plus a refreshed overview.
 */
export function makeUsageCredentialsRoute(service: UsageService): WebRoute {
  return {
    kind: 'exact',
    path: USAGE_API_PREFIX + '/credentials',
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const body = asJsonObject(await readJsonBody(req, { objectOnly: true, maxBytes: 8 * 1024 }))
      if (body === undefined) {
        writeJson(res, 400, { ok: false, error: 'invalid body' })
        return
      }
      const action = body.action === 'clear' ? 'clear' : body.action === 'set' ? 'set' : undefined
      const target = parseCredentialTarget(body.target)
      if (action === undefined || target === undefined) {
        writeJson(res, 400, { ok: false, error: 'invalid action or target' })
        return
      }
      const result = action === 'set'
        ? await service.setExternalCredential(target, typeof body.value === 'string' ? body.value : '')
        : await service.clearExternalCredential(target)
      if (!result.ok) {
        writeJson(res, 400, result)
        return
      }
      try {
        await service.refresh()
      } catch {
        // Credential write succeeded; a probe failure must not undo it.
      }
      writeJson(res, 200, { ok: true, overview: await service.overview() }, { 'cache-control': 'no-store' })
    },
  }
}

/**
 * Loopback-fenced client-side diagnostics: the browser half appends one
 * NDJSON line per strip mount/state change so the failure point of the
 * quota meter is observable from the host filesystem (desktop shells may
 * have no devtools). Bounded to keep the file meaningful.
 */
export function makeUsageClientDiagRoute(): WebRoute {
  const path = USAGE_API_PREFIX + '/client-diag'
  return {
    kind: 'exact',
    path,
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const body = asJsonObject(await readJsonBody(req, { objectOnly: true, maxBytes: 2 * 1024 }))
      if (body === undefined) {
        writeJson(res, 400, { ok: false, error: 'invalid body' })
        return
      }
      const line = `${JSON.stringify({ ts: Date.now(), ...body })}\n`
      const file = join(dshHome(), 'dsh-usage-plus', 'client-diag.ndjson')
      try {
        // Bound the file: a long-running host must not accumulate diagnostics
        // without limit. Start a fresh file once the current one is full.
        const info = await stat(file)
        if (info.size > CLIENT_DIAG_MAX_BYTES) await rm(file, { force: true })
      } catch {
        // Missing file on the first write is the normal case.
      }
      try {
        await appendFile(file, line, 'utf8')
      } catch {
        // Diagnostics must never break the API surface.
      }
      writeJson(res, 200, { ok: true })
    },
  }
}
