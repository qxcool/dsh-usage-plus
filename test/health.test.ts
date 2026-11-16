/**
 * Data-health payload: ledger/storage stats, corrupt-file detection, backfill
 * state, probe health, and the guarantee that volatile probe instants do not
 * defeat the idle ETag/304 cache.
 */
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { emptyTotals, type ProviderSnapshotState, type UsageLedgerDocument } from '../src/core/types.ts'
import { foldUsage } from '../src/core/ledger.ts'
import { backfillStatePath } from '../src/host/backfill.ts'
import { jsonEtag } from '../src/host/http.ts'
import { UsageService, type UsageServiceOptions } from '../src/host/usage-service.ts'

const BASE_OPTIONS: UsageServiceOptions = {
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
  // These tests assert filesystem-derived health changes between immediate
  // reads, so the production 2s filesystem-fact TTL is disabled here.
  healthCacheTtlMs: 0,
}

interface HealthInternals {
  ledger: UsageLedgerDocument
  snapshots: Map<string, ProviderSnapshotState>
  probeAttemptAt: number | null
  probeSuccessAt: number | null
}

interface HealthHarness {
  service: UsageService
  internals: HealthInternals
  dir: string
}

function provider(overrides: Partial<ProviderSnapshotState> & { provider: string }): ProviderSnapshotState {
  return { displayName: overrides.provider, credential: 'env', supported: true, updatedAt: 1, ...overrides }
}

async function healthHarness(snapshots: ProviderSnapshotState[] = []): Promise<HealthHarness> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-usage-health-'))
  const routes = snapshots.map((snapshot) => ({ id: snapshot.provider, name: snapshot.displayName }))
  const ctx = {
    get: (name: string) => (name === 'llm' ? { listProviders: () => routes, listConfigurableProviders: () => [] } : undefined),
    on: () => () => {},
  } as unknown as Context
  const service = new UsageService(ctx, BASE_OPTIONS, dir)
  const internals = service as unknown as HealthInternals
  for (const snapshot of snapshots) internals.snapshots.set(snapshot.provider, snapshot)
  return { service, internals, dir }
}

async function close(harness: HealthHarness): Promise<void> {
  await harness.service.stop()
  await rm(harness.dir, { recursive: true, force: true })
}

function seedDay(internals: HealthInternals, dayKey: string, providerId: string): void {
  foldUsage(internals.ledger, new Date(dayKey + 'T12:00:00').getTime(), providerId, 'model-1', {
    ...emptyTotals(),
    inputTokens: 1,
    calls: 1,
  })
}

describe('jsonEtag health normalization', () => {
  const base = {
    updatedAt: 1,
    health: {
      storage: { label: '~/.dsh/dsh-usage-plus', bytes: 10, corruptFiles: [] },
      backfill: null,
      probes: { lastAttemptAt: 1, lastSuccessAt: 2, failing: [] },
    },
  }

  it('ignores the volatile probe instants', () => {
    expect(jsonEtag({ ...base, updatedAt: 9 })).toBe(jsonEtag(base))
    const moved = { ...base, health: { ...base.health, probes: { ...base.health.probes, lastAttemptAt: 999, lastSuccessAt: 998 } } }
    expect(jsonEtag(moved)).toBe(jsonEtag(base))
  })

  it('still changes when data health changes', () => {
    const failing = { ...base, health: { ...base.health, probes: { ...base.health.probes, failing: ['p'] } } }
    expect(jsonEtag(failing)).not.toBe(jsonEtag(base))
    const corrupt = { ...base, health: { ...base.health, storage: { ...base.health.storage, corruptFiles: ['usage-ledger.json.corrupt-1'] } } }
    expect(jsonEtag(corrupt)).not.toBe(jsonEtag(base))
    const bytes = { ...base, health: { ...base.health, storage: { ...base.health.storage, bytes: 11 } } }
    expect(jsonEtag(bytes)).not.toBe(jsonEtag(base))
    const backfill = { ...base, health: { ...base.health, backfill: { completedAt: 1, cutoff: 2, sessions: 3, events: 4 } } }
    expect(jsonEtag(backfill)).not.toBe(jsonEtag(base))
  })
})

describe('overview health payload', () => {
  it('reports storage, backfill, and probe health from the plugin data dir', async () => {
    const harness = await healthHarness([
      provider({ provider: 'ok-provider', balance: { currency: 'CNY', totalBalance: '1.00', updatedAt: 1 } }),
      provider({ provider: 'failing-provider', planError: 'HTTP 401' }),
    ])
    try {
      seedDay(harness.internals, '2026-11-14', 'ok-provider')
      seedDay(harness.internals, '2026-11-16', 'ok-provider')
      const ledgerBytes = '{"version":1,"days":{}}'
      await writeFile(join(harness.dir, 'usage-ledger.json'), ledgerBytes, 'utf8')
      await writeFile(join(harness.dir, 'usage-ledger.json.corrupt-100'), 'bad', 'utf8')
      await writeFile(join(harness.dir, 'usage-ledger.json.corrupt-050'), 'bad', 'utf8')
      await writeFile(backfillStatePath(harness.dir), JSON.stringify({
        version: 1,
        completedAt: 111,
        cutoff: 222,
        sessions: 3,
        events: 4,
        truncated: true,
      }), 'utf8')
      harness.internals.probeAttemptAt = 1_000
      harness.internals.probeSuccessAt = 900

      const document = await harness.service.overview()
      const health = document.health
      expect(health?.storage).toMatchObject({
        label: '~/.dsh/dsh-usage-plus',
        bytes: Buffer.byteLength(ledgerBytes, 'utf8'),
        activeDays: 2,
        firstDay: '2026-11-14',
        lastDay: '2026-11-16',
        retentionDays: 182,
      })
      expect(health?.storage.corruptFiles).toEqual(['usage-ledger.json.corrupt-050', 'usage-ledger.json.corrupt-100'])
      expect(health?.backfill).toEqual({ completedAt: 111, cutoff: 222, sessions: 3, events: 4, truncated: true })
      expect(health?.probes).toEqual({ lastAttemptAt: 1_000, lastSuccessAt: 900, failing: ['failing-provider'] })

      // Payload stays display-safe: no absolute data-dir path leaks.
      expect(JSON.stringify(health)).not.toContain(harness.dir)
    } finally {
      await close(harness)
    }
  })

  it('reports null backfill/zero storage on a fresh directory', async () => {
    const harness = await healthHarness()
    try {
      const health = (await harness.service.overview()).health
      expect(health).toMatchObject({
        storage: { label: '~/.dsh/dsh-usage-plus', bytes: 0, activeDays: 0, firstDay: null, lastDay: null, corruptFiles: [] },
        backfill: null,
        probes: { lastAttemptAt: null, lastSuccessAt: null, failing: [] },
      })
    } finally {
      await close(harness)
    }
  })

  it('keeps the ETag stable across idle reads while health refreshes the probe instants', async () => {
    const harness = await healthHarness()
    try {
      seedDay(harness.internals, '2026-11-16', 'p')
      const first = await harness.service.overviewPayload()
      const etag = first.etag
      expect(first.document.health?.probes.lastAttemptAt).toBeNull()
      harness.internals.probeAttemptAt = 5_000
      harness.internals.probeSuccessAt = 4_500
      const second = await harness.service.overviewPayload()
      expect(second.document).toBe(first.document)
      expect(second.etag).toBe(etag)
      expect(second.document.health?.probes).toEqual({ lastAttemptAt: 5_000, lastSuccessAt: 4_500, failing: [] })
    } finally {
      await close(harness)
    }
  })

  it('rebuilds document and ETag when non-volatile health data appears between idle reads', async () => {
    const harness = await healthHarness()
    try {
      seedDay(harness.internals, '2026-11-16', 'p')
      const first = await harness.service.overviewPayload()
      expect(first.document.health?.storage.corruptFiles).toEqual([])
      await writeFile(join(harness.dir, 'usage-ledger.json.corrupt-123'), 'bad', 'utf8')
      const second = await harness.service.overviewPayload()
      expect(second.document).not.toBe(first.document)
      expect(second.etag).not.toBe(first.etag)
      expect(second.document.health?.storage.corruptFiles).toEqual(['usage-ledger.json.corrupt-123'])
    } finally {
      await close(harness)
    }
  })
})
