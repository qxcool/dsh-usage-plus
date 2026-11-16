/**
 * Ledger persistence and calendar-day behavior: corrupt-file preservation,
 * the persisted-merge path, retention pruning across midnight/month
 * boundaries, and window aggregation anchored on an explicit `todayKey`
 * (fixed dates, so no fake clock is needed).
 */
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLedgerDocument, foldUsage, ledgerDayKeys, localDateKey, pruneLedger, summarizeLedgerUsage } from '../src/core/ledger.ts'
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

/** Minimal host context: this suite never touches live services. */
function context(): Context {
  return { get: () => undefined, on: () => () => {} } as unknown as Context
}

interface LedgerInternals {
  ledger: UsageLedgerDocument
  loaded: boolean
  revision: number
  ledgerRevision: number
  loadPersisted(): Promise<void>
}

function internalsOf(service: UsageService): LedgerInternals {
  return service as unknown as LedgerInternals
}

/** Fold one call under `provider/model` at local noon of the given date. */
function foldAt(document: UsageLedgerDocument, year: number, monthIndex: number, day: number, inputTokens: number): void {
  foldUsage(document, new Date(year, monthIndex, day, 12, 0, 0).getTime(), 'provider-a', 'model-1', {
    ...emptyTotals(),
    inputTokens,
    calls: 1,
  })
}

describe('corrupt ledger preservation', () => {
  it('moves an unparsable ledger aside instead of silently overwriting it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-corrupt-'))
    try {
      const corruptBytes = '{not json'
      await writeFile(join(dir, 'usage-ledger.json'), corruptBytes, 'utf8')
      const service = new UsageService(context(), OPTIONS, dir)
      const internals = internalsOf(service)
      await internals.loadPersisted()

      expect(internals.loaded).toBe(true)
      expect(ledgerDayKeys(internals.ledger)).toEqual([])
      const names = await readdir(dir)
      const preserved = names.find((name) => name.startsWith('usage-ledger.json.corrupt-'))
      expect(preserved).toBeDefined()
      expect(await readFile(join(dir, preserved as string), 'utf8')).toBe(corruptBytes)

      // The final flush writes a fresh ledger; the preserved copy survives.
      await service.stop()
      const afterFlush = await readdir(dir)
      expect(afterFlush).toContain('usage-ledger.json')
      expect(afterFlush).toContain(preserved)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('preserves valid JSON that is not a ledger document', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-shape-'))
    try {
      await writeFile(join(dir, 'usage-ledger.json'), '{"version":1}', 'utf8')
      const service = new UsageService(context(), OPTIONS, dir)
      const internals = internalsOf(service)
      await internals.loadPersisted()
      expect(ledgerDayKeys(internals.ledger)).toEqual([])
      const names = await readdir(dir)
      expect(names.some((name) => name.startsWith('usage-ledger.json.corrupt-'))).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('persisted ledger merge', () => {
  it('merges a readable ledger and prunes days past retention', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-merge-'))
    try {
      const todayKey = localDateKey(Date.now())
      const persisted = createLedgerDocument()
      foldUsage(persisted, new Date(todayKey + 'T12:00:00').getTime(), 'provider-a', 'model-1', { ...emptyTotals(), inputTokens: 5, calls: 1 })
      foldUsage(persisted, new Date('2000-01-01T12:00:00').getTime(), 'provider-a', 'model-1', { ...emptyTotals(), inputTokens: 9, calls: 1 })
      await writeFile(join(dir, 'usage-ledger.json'), JSON.stringify(persisted), 'utf8')

      const service = new UsageService(context(), OPTIONS, dir)
      const internals = internalsOf(service)
      await internals.loadPersisted()
      expect(ledgerDayKeys(internals.ledger)).toEqual([todayKey])
      expect(internals.ledger.days[todayKey]?.['provider-a']?.['model-1']?.inputTokens).toBe(5)
      expect(internals.ledgerRevision).toBeGreaterThan(0)
      expect((await readdir(dir)).some((name) => name.startsWith('usage-ledger.json.corrupt-'))).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('calendar day boundaries and retention', () => {
  it('keys days by the host-local calendar date across midnight', () => {
    expect(localDateKey(new Date(2026, 10, 16, 23, 59, 59, 999).getTime())).toBe('2026-11-16')
    expect(localDateKey(new Date(2026, 10, 17, 0, 0, 0, 0).getTime())).toBe('2026-11-17')
    expect(localDateKey(new Date(2026, 11, 31, 23, 30, 0).getTime())).toBe('2026-12-31')
  })

  it('prunes strictly older days and keeps the retention cutoff day', () => {
    const document = createLedgerDocument()
    for (const key of ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10']) document.days[key] = {}
    // retainDays 7 before 2026-11-16 → cutoff 2026-11-09 (inclusive).
    expect(pruneLedger(document, '2026-11-16', 7)).toBe(2)
    expect(Object.keys(document.days).sort()).toEqual(['2026-11-09', '2026-11-10'])
  })

  it('walks the retention cutoff across a month boundary', () => {
    const document = createLedgerDocument()
    for (const key of ['2026-10-31', '2026-11-01']) document.days[key] = {}
    expect(pruneLedger(document, '2026-11-30', 30)).toBe(0)
    expect(pruneLedger(document, '2026-11-30', 29)).toBe(1)
    expect(Object.keys(document.days)).toEqual(['2026-11-01'])
  })

  it('moves today and the heatmap tail when the local day rolls over', () => {
    const document = createLedgerDocument()
    foldAt(document, 2026, 10, 14, 10)
    foldAt(document, 2026, 10, 15, 20)

    const beforeMidnight = summarizeLedgerUsage(document, { todayKey: '2026-11-15', heatmapDays: 182, rangeDays: 30 })
    expect(beforeMidnight.today.date).toBe('2026-11-15')
    expect(beforeMidnight.today.totals.calls).toBe(1)
    expect(beforeMidnight.today.totals.inputTokens).toBe(20)
    expect(beforeMidnight.days[beforeMidnight.days.length - 1]?.date).toBe('2026-11-15')

    foldAt(document, 2026, 10, 16, 30)
    const afterMidnight = summarizeLedgerUsage(document, { todayKey: '2026-11-16', heatmapDays: 182, rangeDays: 30 })
    expect(afterMidnight.today.date).toBe('2026-11-16')
    expect(afterMidnight.today.totals.calls).toBe(1)
    expect(afterMidnight.today.totals.inputTokens).toBe(30)
    expect(afterMidnight.days[afterMidnight.days.length - 1]?.date).toBe('2026-11-16')
    expect(afterMidnight.all.totals.calls).toBe(3)
    expect(afterMidnight.all.totals.inputTokens).toBe(60)
  })
})
