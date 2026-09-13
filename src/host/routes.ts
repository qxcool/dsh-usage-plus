import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { ExternalCredentialTarget } from '../core/types.ts'
import { asJsonObject, readJsonBody, writeJson } from './http.ts'
import { isLoopbackRequest } from './loopback.ts'
import type { UsageService } from './usage-service.ts'

export const USAGE_API_PREFIX = '/api/dsh-usage-plus'

const FIXED_CREDENTIAL_TARGETS = new Set(['cpamc', 'volcano.ak', 'volcano.sk'])

function parseCredentialTarget(raw: unknown): ExternalCredentialTarget | undefined {
  if (typeof raw !== 'string') return undefined
  if (FIXED_CREDENTIAL_TARGETS.has(raw)) return raw as ExternalCredentialTarget
  const match = /^customVar:([A-Za-z_][A-Za-z0-9_]*)$/.exec(raw)
  if (match !== null) return raw as ExternalCredentialTarget
  return undefined
}

/**
 * Loopback-fenced overview route: provider balances, plan quotas, and token
 * usage totals. Personal account data, so the loopback fence mirrors
 * dsh-perf's stats surface; the browser runs on the same machine.
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
      writeJson(res, 200, await service.overview(), { 'cache-control': 'no-store' })
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
