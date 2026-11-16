/**
 * Historical session backfill: rebuild the usage ledger from prior DSH
 * sessions when the plugin starts with an empty ledger (fresh install, data-dir
 * loss, or an upgrade from a version that predated the ledger). Reads the
 * optional context-wide `ctx.sessionQuery` service — never the persistence
 * files directly — and folds `assistant/message` usage exactly like the live
 * `session/event` listener: the provider/model come from the preceding
 * `request/header` / `request/context` events, and the DeepSeek spend estimate
 * is stamped at the event's own timestamp.
 *
 * The pass is bounded (session and event caps, yields between sessions) and
 * never throws; the caller merges the returned temporary ledger, flushes, and
 * records the completion state itself.
 * @module dsh-usage-plus/host/backfill
 */

import { join } from 'node:path'
import { isDeepSeekProviderRoute } from '../core/adapters.ts'
import { createLedgerDocument, foldUsage, localDateKey } from '../core/ledger.ts'
import { deepseekModelSpend } from '../core/pricing.ts'
import type { UsageLedgerDocument, UsageTokenTotals } from '../core/types.ts'
import { emptyTotals } from '../core/types.ts'

/** File (inside the plugin data dir) recording a completed/declined backfill. */
export const BACKFILL_STATE_FILE = 'backfill.json'

/** Hard cap on sessions inspected in one pass (newest first). */
export const MAX_BACKFILL_SESSIONS = 500

/** Hard cap on raw events inspected in one pass. */
export const MAX_BACKFILL_EVENTS = 100_000

/** Yield to the event loop after this many session reads. */
export const BACKFILL_YIELD_EVERY_SESSIONS = 10

/** Version of the `backfill.json` state document. */
export const BACKFILL_STATE_VERSION = 1

/**
 * The minimal `ctx.sessionQuery` surface backfill needs. Declared locally so
 * the Host half does not depend on the session-query package types; the
 * service is optional and may be absent from a composition.
 */
export interface SessionQueryLike {
  /** Every logical session, newest-first (created time). */
  listSessions(): Promise<unknown>
  /** The complete raw event log of one session. */
  readSession(sessionId: string): Promise<unknown>
}

/** One listed session record, as much as backfill reads (installed shape). */
interface SessionRecordLike {
  id?: string
  header?: { id?: string; createdAt?: number }
}

/** One raw session event, as much as backfill reads. */
interface SessionEventLike {
  type: string
  time: number
  data?: unknown
}

/** Completion state persisted as `<persistDir>/backfill.json`. */
export interface BackfillState {
  version: typeof BACKFILL_STATE_VERSION
  /** Epoch ms the pass finished (or was declined). */
  completedAt: number
  /** Epoch ms cutoff: only events strictly older than this were folded. */
  cutoff: number
  /** Sessions read successfully during the pass. */
  sessions: number
  /** `assistant/message` events folded into the ledger. */
  events: number
}

/** Options for one backfill collection pass. */
export interface BackfillOptions {
  /** Epoch ms captured before the pass; events at/after it belong to live folding. */
  startedAt: number
  /** Ledger retention in local days; older events are ignored. */
  retainDays: number
  /** "Now" for the retention cutoff (tests pass a fixed instant). */
  nowMs?: number
  maxSessions?: number
  maxEvents?: number
  yieldEvery?: number
  /** Return true when the owning service is disposed; aborts the pass. */
  shouldAbort?: () => boolean
}

/** Result of one backfill collection pass. */
export interface BackfillResult {
  /** False when the pass aborted or the session list could not be read. */
  ok: boolean
  /** Temporary ledger containing only the folded historical usage. */
  ledger: UsageLedgerDocument
  /** Sessions read successfully. */
  sessions: number
  /** `assistant/message` events folded into `ledger`. */
  events: number
  /** Raw events inspected (diagnostic; capped separately from `events`). */
  processed: number
  /** Local-date key `YYYY-MM-DD`; events older than it are ignored. */
  cutoffKey: string
  /** True when a session/event cap ended the pass early. */
  truncated: boolean
}

/** Path of the backfill state file for one plugin data directory. */
export function backfillStatePath(persistDir: string): string {
  return join(persistDir, BACKFILL_STATE_FILE)
}

/**
 * Whether a ledger document holds any usage bucket. An empty day map means a
 * fresh install/data loss, which is the only case backfill may run in.
 */
export function hasLedgerUsage(document: Readonly<UsageLedgerDocument>): boolean {
  for (const day of Object.values(document.days)) {
    if (typeof day !== 'object' || day === null) continue
    for (const models of Object.values(day)) {
      if (typeof models !== 'object' || models === null) continue
      if (Object.keys(models).length > 0) return true
    }
  }
  return false
}

/**
 * First local-date key inside the retention window, matching
 * `pruneLedger`'s cutoff: days strictly before it are pruned.
 */
export function retentionCutoffKey(nowMs: number, retainDays: number): string {
  const todayKey = localDateKey(nowMs)
  const cutoff = new Date(todayKey + 'T00:00:00')
  cutoff.setDate(cutoff.getDate() - retainDays)
  return localDateKey(cutoff.getTime())
}

/** Add every bucket of `source` into `target` in place. */
export function mergeLedgerDocuments(target: UsageLedgerDocument, source: Readonly<UsageLedgerDocument>): void {
  for (const [dayKey, providers] of Object.entries(source.days)) {
    const atMs = new Date(dayKey + 'T12:00:00').getTime()
    for (const [provider, models] of Object.entries(providers)) {
      for (const [model, totals] of Object.entries(models)) {
        foldUsage(target, atMs, provider, model, totals)
      }
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

/** Normalize one historical provider usage report exactly like the live fold. */
function totalsFromHistoricalUsage(usage: Record<string, unknown>, provider: string, model: string, atMs: number): UsageTokenTotals {
  const totals = emptyTotals()
  totals.inputTokens = finiteNonNegative(usage.inputTokens)
  totals.outputTokens = finiteNonNegative(usage.outputTokens)
  totals.cacheReadTokens = finiteNonNegative(usage.cacheReadTokens)
  totals.cacheWriteTokens = finiteNonNegative(usage.cacheWriteTokens)
  totals.reasoningTokens = finiteNonNegative(usage.reasoningTokens)
  totals.calls = 1
  if (isDeepSeekProviderRoute(provider)) totals.cost = deepseekModelSpend(model, totals, atMs)
  return totals
}

/** Track one session's provider/model attribution across its event log. */
function replaySession(
  events: readonly unknown[],
  ledger: UsageLedgerDocument,
  options: { startedAt: number; cutoffKey: string; maxEvents: number },
  counters: { events: number; processed: number },
): boolean {
  let provider = ''
  let model = ''
  for (const raw of events) {
    if (counters.processed >= options.maxEvents) return false
    counters.processed += 1
    if (!isObject(raw)) continue
    const type = raw.type
    const time = raw.time
    if (typeof type !== 'string' || typeof time !== 'number' || !Number.isFinite(time)) continue
    const data = raw.data

    if (type === 'request/header') {
      const header = isObject(data) ? data.header : undefined
      const config = isObject(header) ? header.config : undefined
      if (isObject(config) && typeof config.provider === 'string' && config.provider !== '') {
        provider = config.provider
        model = typeof config.model === 'string' ? config.model : ''
      }
      continue
    }
    if (type === 'request/context') {
      if (isObject(data) && typeof data.provider === 'string' && data.provider !== '') {
        provider = data.provider
        model = typeof data.model === 'string' ? data.model : ''
      }
      continue
    }
    if (type !== 'assistant/message' || provider === '') continue
    // The live listener already folded anything appended after the boot-cutoff;
    // folding it here too would double count.
    if (time >= options.startedAt) continue
    if (localDateKey(time) < options.cutoffKey) continue
    const usage = isObject(data) && isObject(data.usage) ? data.usage : undefined
    if (usage === undefined) continue
    foldUsage(ledger, time, provider, model || 'unknown', totalsFromHistoricalUsage(usage, provider, model || 'unknown', time))
    counters.events += 1
  }
  return true
}

/**
 * Read prior sessions and fold their historical usage into a temporary ledger.
 * Never throws: a missing/invalid session list yields `ok: false`, per-session
 * read failures are skipped, and all work is bounded by the caps plus a yield
 * between session batches.
 */
export async function collectBackfill(sessionQuery: SessionQueryLike, options: BackfillOptions): Promise<BackfillResult> {
  const nowMs = options.nowMs ?? Date.now()
  const cutoffKey = retentionCutoffKey(nowMs, options.retainDays)
  const maxSessions = Math.max(1, options.maxSessions ?? MAX_BACKFILL_SESSIONS)
  const maxEvents = Math.max(1, options.maxEvents ?? MAX_BACKFILL_EVENTS)
  const yieldEvery = Math.max(1, options.yieldEvery ?? BACKFILL_YIELD_EVERY_SESSIONS)
  const ledger = createLedgerDocument()
  const counters = { events: 0, processed: 0 }
  const result: BackfillResult = { ok: false, ledger, sessions: 0, events: 0, processed: 0, cutoffKey, truncated: false }

  let listed: unknown
  try {
    listed = await sessionQuery.listSessions()
  } catch {
    return result
  }
  if (!Array.isArray(listed)) return { ...result, ok: true }

  let sessionsRead = 0
  for (const candidate of listed) {
    if (options.shouldAbort?.() === true) return result
    if (sessionsRead >= maxSessions || counters.processed >= maxEvents) {
      result.truncated = true
      break
    }
    if (!isObject(candidate)) continue
    const session = candidate as unknown as SessionRecordLike
    const header = isObject(session.header) ? session.header : undefined
    // The installed `SessionRecord` carries the id inside `header.id`; a plain
    // `{id}` shape is also accepted for lightweight fakes/deployments.
    const sessionId = typeof session.id === 'string' && session.id !== ''
      ? session.id
      : header !== undefined && typeof header.id === 'string'
        ? header.id
        : ''
    if (sessionId === '') continue
    const createdAt = header?.createdAt
    // listSessions() is newest-first by creation: once a session predates the
    // retention window, every later one does too (cheap early stop).
    if (typeof createdAt === 'number' && Number.isFinite(createdAt) && localDateKey(createdAt) < cutoffKey) break
    sessionsRead += 1
    let snapshot: unknown
    try {
      snapshot = await sessionQuery.readSession(sessionId)
    } catch {
      // One unreadable session must not abort the pass.
      continue
    }
    if (!isObject(snapshot) || !Array.isArray(snapshot.events)) continue
    result.sessions += 1
    if (!replaySession(snapshot.events as readonly unknown[], ledger, { startedAt: options.startedAt, cutoffKey, maxEvents }, counters)) {
      result.truncated = true
      break
    }
    if (sessionsRead % yieldEvery === 0) await new Promise<void>((resolve) => { setTimeout(resolve, 0) })
  }
  result.ok = options.shouldAbort?.() !== true
  result.events = counters.events
  result.processed = counters.processed
  result.truncated = result.truncated || counters.processed >= maxEvents
  return result
}
