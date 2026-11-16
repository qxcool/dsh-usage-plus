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
  isSeeded?: boolean
  /** Exact installed `inheritedEventCount`; omit it to exercise the fallback. */
  inheritedEventCount?: number
  events?: unknown
  /** Omit the snapshot's own header to exercise the listed-record fallback. */
  omitSnapshotHeader?: boolean
  /** Return the snapshot header under the plain `header` key instead of `session`. */
  legacyHeaderKey?: boolean
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
        header: {
          id: session.id,
          ...(session.createdAt !== undefined ? { createdAt: session.createdAt } : {}),
          isSeeded: session.isSeeded === true,
        },
      }))
    },
    async readSession(sessionId: string): Promise<unknown> {
      query.readCalls.push(sessionId)
      const session = sessions.find((entry) => entry.id === sessionId)
      if (session?.throws === true) throw new Error('corrupt session')
      const snapshot: Record<string, unknown> = { events: session?.events ?? [] }
      if (session !== undefined && session.omitSnapshotHeader !== true) {
        snapshot[session.legacyHeaderKey === true ? 'header' : 'session'] = {
          id: session.id,
          ...(session.createdAt !== undefined ? { createdAt: session.createdAt } : {}),
          isSeeded: session.isSeeded === true,
        }
      }
      if (session?.inheritedEventCount !== undefined) snapshot.inheritedEventCount = session.inheritedEventCount
      return snapshot
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

  it('skips a fork inherited seed prefix so parent turns are not counted twice', async () => {
    const seedTime = daysAgo(2)
    const forkTime = daysAgo(1)
    const parentEvents: RawEvent[] = [
      headerEvent(seedTime, 'deepseek-official', 'deepseek-v4'),
      usageEvent(seedTime, 100),
      usageEvent(seedTime + 1, 50),
    ]
    const query = fakeSessionQuery([
      { id: 'parent', createdAt: seedTime, events: parentEvents },
      {
        id: 'fork',
        createdAt: forkTime,
        isSeeded: true,
        inheritedEventCount: 3,
        events: [...parentEvents, headerEvent(forkTime, 'deepseek-official', 'deepseek-v4'), usageEvent(forkTime, 200)],
      },
    ])
    const result = await collectBackfill(query, { startedAt, retainDays: 182 })
    // Parent folds its 2 turns; the fork folds only its 1 own turn (3 total, not 5).
    expect(result.ok).toBe(true)
    expect(result.sessions).toBe(2)
    expect(result.events).toBe(3)
    expect(result.forkEvents).toBe(2)
    expect(result.processed).toBe(8)
    const parentBucket = result.ledger.days[localDateKey(seedTime)]?.['deepseek-official']?.['deepseek-v4']
    expect(parentBucket?.inputTokens).toBe(150)
    expect(parentBucket?.calls).toBe(2)
    const forkBucket = result.ledger.days[localDateKey(forkTime)]?.['deepseek-official']?.['deepseek-v4']
    expect(forkBucket?.inputTokens).toBe(200)
    expect(forkBucket?.calls).toBe(1)
  })

  it('falls back to header createdAt when a seeded snapshot omits inheritedEventCount', async () => {
    const seedTime = daysAgo(3)
    const forkTime = daysAgo(1)
    const parentEvents: RawEvent[] = [
      headerEvent(seedTime, 'p', 'm'),
      usageEvent(seedTime, 10),
      usageEvent(seedTime + 1, 20),
    ]
    const query = fakeSessionQuery([
      { id: 'parent', createdAt: seedTime, events: parentEvents },
      {
        id: 'fork',
        createdAt: forkTime,
        isSeeded: true,
        // No inheritedEventCount: only header.isSeeded + createdAt identify the cut.
        events: [...parentEvents, headerEvent(forkTime, 'p', 'm'), usageEvent(forkTime, 40)],
      },
    ])
    const result = await collectBackfill(query, { startedAt, retainDays: 182 })
    expect(result.events).toBe(3)
    expect(result.forkEvents).toBe(2)
    expect(result.processed).toBe(8)
    expect(result.ledger.days[localDateKey(seedTime)]?.['p']?.['m']?.inputTokens).toBe(30)
    expect(result.ledger.days[localDateKey(forkTime)]?.['p']?.['m']?.inputTokens).toBe(40)
  })

  it('uses the listed record header when the seeded snapshot carries none', async () => {
    const seedTime = daysAgo(3)
    const forkTime = daysAgo(1)
    const parentEvents: RawEvent[] = [
      headerEvent(seedTime, 'p', 'm'),
      usageEvent(seedTime, 5),
      usageEvent(seedTime + 1, 6),
    ]
    const query = fakeSessionQuery([
      { id: 'parent', createdAt: seedTime, events: parentEvents },
      {
        id: 'fork',
        createdAt: forkTime,
        isSeeded: true,
        omitSnapshotHeader: true,
        events: [...parentEvents, headerEvent(forkTime, 'p', 'm'), usageEvent(forkTime, 7)],
      },
    ])
    const result = await collectBackfill(query, { startedAt, retainDays: 182 })
    expect(result.events).toBe(3)
    expect(result.forkEvents).toBe(2)
    expect(result.ledger.days[localDateKey(seedTime)]?.['p']?.['m']?.inputTokens).toBe(11)
    expect(result.ledger.days[localDateKey(forkTime)]?.['p']?.['m']?.inputTokens).toBe(7)
  })

  it('applies the exact inheritedEventCount by index rather than by event time', async () => {
    const seedTime = daysAgo(2)
    const forkTime = daysAgo(1)
    const query = fakeSessionQuery([{
      id: 'fork',
      createdAt: forkTime,
      isSeeded: true,
      inheritedEventCount: 2,
      legacyHeaderKey: true,
      events: [
        headerEvent(seedTime, 'p', 'm'),
        usageEvent(seedTime, 5),
        // After the exact cut this event is child-owned despite its inherited-looking time.
        usageEvent(seedTime + 1, 6),
        headerEvent(forkTime, 'p', 'm'),
        usageEvent(forkTime, 7),
      ],
    }])
    const result = await collectBackfill(query, { startedAt, retainDays: 182 })
    expect(result.events).toBe(2)
    expect(result.forkEvents).toBe(1)
    expect(result.ledger.days[localDateKey(seedTime)]?.['p']?.['m']?.inputTokens).toBe(6)
    expect(result.ledger.days[localDateKey(forkTime)]?.['p']?.['m']?.inputTokens).toBe(7)
  })

  it('folds every event for non-seeded sessions (absent or zero inheritedEventCount)', async () => {
    const time = daysAgo(1)
    const early = time - 1_000
    const events = [headerEvent(early, 'p', 'm'), usageEvent(early, 10), usageEvent(early + 1, 20)]
    const absent = await collectBackfill(fakeSessionQuery([{ id: 'plain', createdAt: time, events }]), { startedAt, retainDays: 182 })
    expect(absent.events).toBe(2)
    expect(absent.forkEvents).toBeUndefined()
    const zero = await collectBackfill(fakeSessionQuery([{ id: 'zero', createdAt: time, inheritedEventCount: 0, events }]), { startedAt, retainDays: 182 })
    expect(zero.events).toBe(2)
    expect(zero.forkEvents).toBeUndefined()
    // An explicit exact count of 0 wins over the seeded createdAt heuristic.
    const seededZero = await collectBackfill(fakeSessionQuery([{
      id: 'seeded-zero',
      createdAt: time,
      isSeeded: true,
      inheritedEventCount: 0,
      events,
    }]), { startedAt, retainDays: 182 })
    expect(seededZero.events).toBe(2)
    expect(seededZero.forkEvents).toBeUndefined()
  })

  it('keeps the event cap bounded while skipping an inherited prefix', async () => {
    const seedTime = daysAgo(2)
    const forkTime = daysAgo(1)
    const seedEvents: RawEvent[] = [headerEvent(seedTime, 'p', 'm'), usageEvent(seedTime, 10), usageEvent(seedTime + 1, 20)]
    const fork: FakeSession = {
      id: 'fork',
      createdAt: forkTime,
      isSeeded: true,
      inheritedEventCount: 3,
      events: [...seedEvents, headerEvent(forkTime, 'p', 'm'), usageEvent(forkTime, 30)],
    }
    const capped = await collectBackfill(fakeSessionQuery([fork]), { startedAt, retainDays: 182, maxEvents: 3 })
    expect(capped.truncated).toBe(true)
    expect(capped.sessions).toBe(1)
    expect(capped.processed).toBe(3)
    expect(capped.events).toBe(0)
    expect(capped.forkEvents).toBe(2)
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

  it('round-trips backfill state with and without optional forkEvents at version 1', () => {
    expect(BACKFILL_STATE_VERSION).toBe(1)
    const base: BackfillState = { version: BACKFILL_STATE_VERSION, completedAt: 1, cutoff: 2, sessions: 3, events: 4 }
    const without: BackfillState = { ...base }
    const withFork: BackfillState = { ...base, forkEvents: 2, truncated: true }
    const parsedWithout = JSON.parse(JSON.stringify(without)) as BackfillState
    const parsedWith = JSON.parse(JSON.stringify(withFork)) as BackfillState
    expect(parsedWithout).toEqual(without)
    expect(parsedWith).toEqual(withFork)
    expect(parsedWithout.forkEvents).toBeUndefined()
    expect(parsedWith.forkEvents).toBe(2)
    expect(parsedWith.version).toBe(BACKFILL_STATE_VERSION)
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

  it('accepts an existing completion state carrying optional forkEvents', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-backfill-state-fork-'))
    const query = fakeSessionQuery([{ id: 'prior', createdAt: daysAgo(1), events: [usageEvent(daysAgo(1))] }])
    const state: BackfillState = {
      version: BACKFILL_STATE_VERSION,
      completedAt: 1,
      cutoff: 2,
      sessions: 3,
      events: 4,
      forkEvents: 2,
    }
    await writeFile(backfillStatePath(dir), JSON.stringify(state), 'utf8')
    const service = new UsageService(serviceContext(query), OPTIONS, dir)
    const internals = internalsOf(service)
    try {
      await internals.loadPersisted()
      await internals.maybeBackfill(Date.now())
      expect(query.listCalls).toBe(0)
      expect(await readState(dir)).toEqual(state)
    } finally {
      await service.stop()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('rebuilds an empty ledger without folding a fork seed prefix twice', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-backfill-fork-'))
    const seedTime = daysAgo(2)
    const forkTime = daysAgo(1)
    const parentEvents: RawEvent[] = [
      headerEvent(seedTime, 'deepseek-official', 'deepseek-v4'),
      usageEvent(seedTime, 100),
      usageEvent(seedTime + 1, 50),
    ]
    const query = fakeSessionQuery([
      { id: 'parent', createdAt: seedTime, events: parentEvents },
      {
        id: 'fork',
        createdAt: forkTime,
        isSeeded: true,
        inheritedEventCount: 3,
        events: [...parentEvents, headerEvent(forkTime, 'deepseek-official', 'deepseek-v4'), usageEvent(forkTime, 200)],
      },
    ])
    const service = new UsageService(serviceContext(query), OPTIONS, dir)
    const internals = internalsOf(service)
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      await internals.loadPersisted()
      await internals.maybeBackfill(Date.now())
      // The parent's 2 turns plus the fork's single own turn, never 5.
      expect(internals.ledger.days[localDateKey(seedTime)]?.['deepseek-official']?.['deepseek-v4']?.inputTokens).toBe(150)
      expect(internals.ledger.days[localDateKey(forkTime)]?.['deepseek-official']?.['deepseek-v4']?.inputTokens).toBe(200)
      expect(await readState(dir)).toMatchObject({ version: BACKFILL_STATE_VERSION, sessions: 2, events: 3 })
    } finally {
      info.mockRestore()
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
