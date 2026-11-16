/**
 * Historical session backfill: the pure collection pass (route replay, boot
 * cutoff, retention filter, caps, corrupt sessions) and the service wiring
 * (fresh-ledger trigger, skip rules, state file, immediate flush).
 */
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BACKFILL_STATE_VERSION,
  backfillStatePath,
  collectBackfill,
  hasLedgerUsage,
  retentionCutoffKey,
  type BackfillState,
  type SessionQueryLike,
} from '../src/host/backfill.ts'
import { foldUsage, localDateKey } from '../src/core/ledger.ts'
import { emptyTotals, type UsageLedgerDocument } from '../src/core/types.ts'
import { UsageService, type UsageServiceOptions } from '../src/host/usage-service.ts'

const OPTIONS: UsageServiceOptions = {
  pollIntervalSec: 60,
  bubbleMode: 'off',
  retainDays: 182,
  cpamcEnabled: false,
  cpamcBaseURL: 'http://127.0.0.1:8317',
  cpamcManagementKeyEnv: 'CPAMC_MANAGEMENT_KEY',
  cpamcAllowedHosts: '',
  volcanoEnabled: false,
  volcanoAccessKeyEnv: 'VOLC_ACCESSKEY',
  volcanoSecretKeyEnv: 'VOLC_SECRETKEY',
}

/** Local noon `days` calendar days before today. */
function daysAgo(days: number): number {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(12, 0, 0, 0)
  return date.getTime()
}

type RawEvent = { type: string; time: number; data?: unknown }

function headerEvent(time: number, provider: string, model: string): RawEvent {
  return { type: 'request/header', time, data: { header: { config: { provider, model } } } }
}

function contextEvent(time: number, provider: string, model: string): RawEvent {
  return { type: 'request/context', time, data: { provider, model } }
}

function usageEvent(time: number, inputTokens = 100): RawEvent {
  return { type: 'assistant/message', time, data: { usage: { inputTokens, outputTokens: 10, cacheReadTokens: 5, cacheWriteTokens: 2, reasoningTokens: 1 } } }
}

interface FakeSession {
  id: string
  createdAt?: number
  events?: unknown
  throws?: boolean
}

interface FakeSessionQuery extends SessionQueryLike {
  listCalls: number
  readCalls: string[]
  throwOnList?: boolean
}

/** A sessionQuery double returning the given sessions in the given order. */
function fakeSessionQuery(sessions: FakeSession[]): FakeSessionQuery {
  const query: FakeSessionQuery = {
    listCalls: 0,
    readCalls: [],
    async listSessions(): Promise<unknown> {
      query.listCalls += 1
      if (query.throwOnList === true) throw new Error('session store unavailable')
      return sessions.map((session) => ({
        id: session.id,
        ...(session.createdAt !== undefined ? { header: { createdAt: session.createdAt } } : {}),
      }))
    },
    async readSession(sessionId: string): Promise<unknown> {
      query.readCalls.push(sessionId)
      const session = sessions.find((entry) => entry.id === sessionId)
      if (session?.throws === true) throw new Error('corrupt session')
      return { events: session?.events ?? [] }
    },
  }
  return query
}

describe('collectBackfill', () => {
  const startedAt = Date.now()

  it('folds prior assistant usage with the replayed request route', async () => {
    const time = daysAgo(2)
    const query = fakeSessionQuery([{
      id: 's1',
      createdAt: time,
      events: [headerEvent(time, 'deepseek-official', 'deepseek-v4'), usageEvent(time, 100), usageEvent(time + 1, 50)],
    }])
    const result = await collectBackfill(query, { startedAt, retainDays: 182 })
    expect(result.ok).toBe(true)
    expect(result.sessions).toBe(1)
    expect(result.events).toBe(2)
    const bucket = result.ledger.days[localDateKey(time)]?.['deepseek-official']?.['deepseek-v4']
    expect(bucket?.inputTokens).toBe(150)
    expect(bucket?.outputTokens).toBe(20)
    expect(bucket?.calls).toBe(2)
    // DeepSeek routes are priced at the event instant.
    expect(bucket?.cost).toBeGreaterThan(0)
  })

  it('accepts the installed SessionRecord shape (id inside header)', async () => {
    const time = daysAgo(1)
    const query: SessionQueryLike = {
      async listSessions(): Promise<unknown> {
        return [{ header: { id: 'session-x', createdAt: time }, live: false, persisted: true }]
      },
      async readSession(sessionId: string): Promise<unknown> {
        expect(sessionId).toBe('session-x')
        return { events: [headerEvent(time, 'p', 'm'), usageEvent(time, 42)] }
      },
    }
    const result = await collectBackfill(query, { startedAt, retainDays: 182 })
    expect(result.sessions).toBe(1)
    expect(result.events).toBe(1)
    expect(result.ledger.days[localDateKey(time)]?.['p']?.['m']?.inputTokens).toBe(42)
  })

  it('replays request/context routes for non-DeepSeek providers', async () => {    const time = daysAgo(1)
    const query = fakeSessionQuery([{
      id: 's2',
      createdAt: time,
      events: [contextEvent(time, 'opencode-go', 'glm-5.3-flash'), usageEvent(time, 7)],
    }])
    const result = await collectBackfill(query, { startedAt, retainDays: 182 })
    const bucket = result.ledger.days[localDateKey(time)]?.['opencode-go']?.['glm-5.3-flash']
    expect(bucket?.inputTokens).toBe(7)
    expect(bucket?.cost).toBe(0)
  })

  it('excludes events at or after the boot cutoff', async () => {
    const time = daysAgo(1)
    const query = fakeSessionQuery([{
      id: 's3',
      createdAt: time,
      events: [headerEvent(time, 'p', 'm'), usageEvent(startedAt - 1), usageEvent(startedAt), usageEvent(startedAt + 5_000)],
    }])
    const result = await collectBackfill(query, { startedAt, retainDays: 182 })
    expect(result.events).toBe(1)
  })

  it('filters events older than the retention window', async () => {
    const now = daysAgo(0)
    const old = daysAgo(182 + 5)
    const recent = daysAgo(1)
    const query = fakeSessionQuery([{
      id: 's4',
      createdAt: recent,
      events: [headerEvent(old, 'p', 'm'), usageEvent(old, 111), usageEvent(recent, 22)],
    }])
    const result = await collectBackfill(query, { startedAt: now, retainDays: 182, nowMs: now })
    expect(result.events).toBe(1)
    expect(result.ledger.days[localDateKey(old)]).toBeUndefined()
    expect(result.ledger.days[localDateKey(recent)]?.['p']?.['m']?.inputTokens).toBe(22)
  })

  it('stops at the first session created before the retention window (newest-first list)', async () => {
    const query = fakeSessionQuery([
      { id: 'newer', createdAt: daysAgo(1), events: [headerEvent(daysAgo(1), 'p', 'm'), usageEvent(daysAgo(1))] },
      { id: 'older', createdAt: daysAgo(200), events: [usageEvent(daysAgo(200))] },
    ])
    const result = await collectBackfill(query, { startedAt, retainDays: 182, nowMs: daysAgo(0) })
    expect(query.readCalls).toEqual(['newer'])
    expect(result.events).toBe(1)
  })

  it('skips corrupt sessions and continues with the next one', async () => {
    const time = daysAgo(1)
    const query = fakeSessionQuery([
      { id: 'broken', createdAt: time, throws: true },
      { id: 'ok', createdAt: time, events: [headerEvent(time, 'p', 'm'), usageEvent(time)] },
    ])
    const result = await collectBackfill(query, { startedAt, retainDays: 182 })
    expect(result.ok).toBe(true)
    expect(query.readCalls).toEqual(['broken', 'ok'])
    expect(result.sessions).toBe(1)
    expect(result.events).toBe(1)
  })

  it('skips a session whose snapshot has no event array', async () => {
    const query = fakeSessionQuery([{ id: 'weird', createdAt: daysAgo(1), events: 'not-an-array' }])
    const result = await collectBackfill(query, { startedAt, retainDays: 182 })
    expect(result.ok).toBe(true)
    expect(result.sessions).toBe(0)
    expect(result.events).toBe(0)
  })

  it('honors the session and event caps', async () => {
    const time = daysAgo(1)
    const sessions = Array.from({ length: 3 }, (_, index) => ({
      id: `cap-${index}`,
      createdAt: time,
      events: [headerEvent(time, 'p', 'm'), usageEvent(time)],
    }))
    const cappedSessions = await collectBackfill(fakeSessionQuery(sessions), { startedAt, retainDays: 182, maxSessions: 1 })
    expect(cappedSessions.truncated).toBe(true)
    expect(cappedSessions.sessions).toBe(1)

    const cappedEvents = await collectBackfill(fakeSessionQuery([sessions[0] as FakeSession]), {
      startedAt,
      retainDays: 182,
      maxEvents: 2,
    })
    expect(cappedEvents.events).toBe(1)
    expect(cappedEvents.truncated).toBe(true)
  })

  it('returns ok=false when the session list cannot be read', async () => {
    const query = fakeSessionQuery([])
    query.throwOnList = true
    const result = await collectBackfill(query, { startedAt, retainDays: 182 })
    expect(result.ok).toBe(false)
    expect(result.events).toBe(0)
  })

  it('aborts when the owner reports disposal', async () => {
    const time = daysAgo(1)
    const query = fakeSessionQuery([{ id: 's', createdAt: time, events: [usageEvent(time)] }])
    const result = await collectBackfill(query, { startedAt, retainDays: 182, shouldAbort: () => true })
    expect(result.ok).toBe(false)
    expect(query.readCalls).toEqual([])
  })
})

describe('backfill helpers', () => {
  it('detects usage buckets only when a model bucket exists', () => {
    const empty: UsageLedgerDocument = { version: 1, days: {} }
    expect(hasLedgerUsage(empty)).toBe(false)
    expect(hasLedgerUsage({ version: 1, days: { '2026-11-16': {} } })).toBe(false)
    const used: UsageLedgerDocument = { version: 1, days: { '2026-11-16': { p: { m: emptyTotals() } } } }
    expect(hasLedgerUsage(used)).toBe(true)
  })

  it('computes the same retention cutoff as pruneLedger', () => {
    const now = new Date(2026, 10, 16, 12, 0, 0).getTime()
    expect(retentionCutoffKey(now, 7)).toBe('2026-11-09')
    expect(retentionCutoffKey(now, 182)).toBe('2026-05-18')
  })
})

// ---------------------------------------------------------------------------
// Service wiring
// ---------------------------------------------------------------------------

interface BackfillInternals {
  ledger: UsageLedgerDocument
  loaded: boolean
  revision: number
  ledgerRevision: number
  loadPersisted(): Promise<void>
  maybeBackfill(startedAt: number): Promise<void>
}

function serviceContext(sessionQuery: SessionQueryLike | undefined): Context {
  return {
    get: (name: string) => (name === 'sessionQuery' ? sessionQuery : undefined),
    on: () => () => {},
  } as unknown as Context
}

function internalsOf(service: UsageService): BackfillInternals {
  return service as unknown as BackfillInternals
}

async function readState(dir: string): Promise<BackfillState | undefined> {
  try {
    return JSON.parse(await readFile(backfillStatePath(dir), 'utf8')) as BackfillState
  } catch {
    return undefined
  }
}

describe('UsageService backfill wiring', () => {
  it('rebuilds an empty ledger, flushes it, and records the state file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-backfill-'))
    const time = daysAgo(2)
    const query = fakeSessionQuery([{
      id: 'prior',
      createdAt: time,
      events: [headerEvent(time, 'deepseek-official', 'deepseek-v4'), usageEvent(time, 321)],
    }])
    const service = new UsageService(serviceContext(query), OPTIONS, dir)
    const internals = internalsOf(service)
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      await internals.loadPersisted()
      const startedAt = Date.now()
      await internals.maybeBackfill(startedAt)

      expect(hasLedgerUsage(internals.ledger)).toBe(true)
      expect(internals.ledger.days[localDateKey(time)]?.['deepseek-official']?.['deepseek-v4']?.inputTokens).toBe(321)
      expect(internals.ledgerRevision).toBeGreaterThan(0)
      const state = await readState(dir)
      expect(state).toMatchObject({ version: BACKFILL_STATE_VERSION, cutoff: startedAt, sessions: 1, events: 1 })
      expect(typeof state?.completedAt).toBe('number')
      // The restored history was flushed immediately (not left to the floor).
      const persisted = JSON.parse(await readFile(join(dir, 'usage-ledger.json'), 'utf8')) as UsageLedgerDocument
      expect(persisted.days[localDateKey(time)]?.['deepseek-official']?.['deepseek-v4']?.inputTokens).toBe(321)
    } finally {
      info.mockRestore()
      await service.stop()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('leaves a non-empty ledger untouched and records the state once', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-backfill-skip-'))
    const query = fakeSessionQuery([{ id: 'prior', createdAt: daysAgo(1), events: [usageEvent(daysAgo(1))] }])
    const service = new UsageService(serviceContext(query), OPTIONS, dir)
    const internals = internalsOf(service)
    try {
      await internals.loadPersisted()
      foldUsage(internals.ledger, daysAgo(0), 'provider-a', 'model-1', { ...emptyTotals(), inputTokens: 9, calls: 1 })
      const before = JSON.stringify(internals.ledger)
      await internals.maybeBackfill(Date.now())
      expect(JSON.stringify(internals.ledger)).toBe(before)
      expect(query.listCalls).toBe(0)
      expect(await readState(dir)).toMatchObject({ version: BACKFILL_STATE_VERSION, sessions: 0, events: 0 })
      // No flush was triggered: there is no ledger file yet.
      expect((await readdir(dir)).includes('usage-ledger.json')).toBe(false)
    } finally {
      await service.stop()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('does nothing when a completion state already exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-backfill-state-'))
    const query = fakeSessionQuery([{ id: 'prior', createdAt: daysAgo(1), events: [usageEvent(daysAgo(1))] }])
    const state: BackfillState = { version: BACKFILL_STATE_VERSION, completedAt: 1, cutoff: 2, sessions: 3, events: 4 }
    await writeFile(backfillStatePath(dir), JSON.stringify(state), 'utf8')
    const service = new UsageService(serviceContext(query), OPTIONS, dir)
    const internals = internalsOf(service)
    try {
      await internals.loadPersisted()
      await internals.maybeBackfill(Date.now())
      expect(query.listCalls).toBe(0)
      expect(hasLedgerUsage(internals.ledger)).toBe(false)
      expect(await readState(dir)).toEqual(state)
    } finally {
      await service.stop()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('ignores a corrupt state file and reruns the pass', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-backfill-corrupt-'))
    const time = daysAgo(1)
    const query = fakeSessionQuery([{ id: 'prior', createdAt: time, events: [headerEvent(time, 'p', 'm'), usageEvent(time)] }])
    await writeFile(backfillStatePath(dir), '{not json', 'utf8')
    const service = new UsageService(serviceContext(query), OPTIONS, dir)
    const internals = internalsOf(service)
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      await internals.loadPersisted()
      await internals.maybeBackfill(Date.now())
      expect(query.listCalls).toBe(1)
      expect(await readState(dir)).toMatchObject({ version: BACKFILL_STATE_VERSION, sessions: 1, events: 1 })
    } finally {
      info.mockRestore()
      await service.stop()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('is a silent no-op without the optional sessionQuery service', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-backfill-absent-'))
    const service = new UsageService(serviceContext(undefined), OPTIONS, dir)
    const internals = internalsOf(service)
    try {
      await internals.loadPersisted()
      await internals.maybeBackfill(Date.now())
      expect(hasLedgerUsage(internals.ledger)).toBe(false)
      expect((await readdir(dir)).includes('backfill.json')).toBe(false)
    } finally {
      await service.stop()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('swallows a failing session list and does not record state', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-backfill-fail-'))
    const query = fakeSessionQuery([])
    query.throwOnList = true
    const service = new UsageService(serviceContext(query), OPTIONS, dir)
    const internals = internalsOf(service)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await internals.loadPersisted()
      await expect(internals.maybeBackfill(Date.now())).resolves.toBeUndefined()
      expect(warn).toHaveBeenCalled()
      expect((await readdir(dir)).includes('backfill.json')).toBe(false)
    } finally {
      warn.mockRestore()
      await service.stop()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('excludes events folded live after start (boot cutoff)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-backfill-cutoff-'))
    const time = daysAgo(1)
    const startedAt = Date.now()
    const query = fakeSessionQuery([{
      id: 'live',
      createdAt: time,
      events: [headerEvent(time, 'p', 'm'), usageEvent(startedAt + 1_000)],
    }])
    const service = new UsageService(serviceContext(query), OPTIONS, dir)
    const internals = internalsOf(service)
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      await internals.loadPersisted()
      await internals.maybeBackfill(startedAt)
      expect(hasLedgerUsage(internals.ledger)).toBe(false)
      expect(await readState(dir)).toMatchObject({ version: BACKFILL_STATE_VERSION, events: 0 })
    } finally {
      info.mockRestore()
      await service.stop()
      await rm(dir, { recursive: true, force: true })
    }
  })
})
