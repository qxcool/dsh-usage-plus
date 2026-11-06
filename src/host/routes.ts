import type { IncomingMessage, ServerResponse } from 'node:http'
import { appendFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { ExternalCredentialTarget } from '../core/types.ts'
import { asJsonObject, jsonEtag, readJsonBody, writeJson } from './http.ts'
import { isLoopbackRequest } from './loopback.ts'
import type { UsageService } from './usage-service.ts'
import { dshHome } from '../dsh-home.ts'

export const USAGE_API_PREFIX = '/api/dsh-usage-plus'

/** Rotate the client-diagnostic NDJSON once it passes this size. */
const CLIENT_DIAG_MAX_BYTES = 256 * 1024

const FIXED_CREDENTIAL_TARGETS = new Set(['cpamc', 'volcano.ak', 'volcano.sk'])

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
      const document = await service.overview()
      const etag = jsonEtag(document)
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
