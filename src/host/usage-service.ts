/**
 * The dsh-usage host service: folds live session usage into the persistent
 * ledger, probes each configured provider's balance/coding-plan endpoint on
 * a poll cycle, and announces the current provider's status to the pet
 * bubble. Secrets stay in the host process; the browser only ever sees the
 * overview document.
 * @module @linxin666/dsh-usage/host/usage-service
 */

import { copyFile, mkdir, open, readdir, readFile, rename, stat, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { credentialKey, credentialRef } from '@deepseek-ai/dsh-credentials'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import { dshHome } from '../dsh-home.ts'
import { adapterFor, dedupeProviderAliasRoutes, isDeepSeekProviderRoute, probeHalfAllowed, providerErrorMessage } from '../core/adapters.ts'
import type { BalanceParse, PlanParse } from '../core/adapters.ts'
import { deepseekModelSpend, deepseekPeriodAt } from '../core/pricing.ts'
import { createLedgerDocument, deserializeLedger, foldUsage, ledgerDayKeys, localDateKey, pruneLedger, summarizeLedgerUsage, totalTokens } from '../core/ledger.ts'
import type { LedgerUsageSummary } from '../core/ledger.ts'
import { currentPlanProvider } from '../core/plan-match.ts'
import type { BalanceView, CredentialKind, ExternalCredentialStatus, ExternalCredentialTarget, PlanView, ProviderSnapshotState, ProviderSnapshotView, UsageAlert, UsageHealth, UsageLedgerDocument, UsageOverviewView, UsageTokenTotals } from '../core/types.ts'
import { emptyTotals } from '../core/types.ts'
import { alertKey, evaluateAlerts } from './alerts.ts'
import { probeCpamc, probeVolcano } from './external-sources.ts'
import { jsonEtag } from './http.ts'
import {
  BACKFILL_STATE_VERSION,
  backfillStatePath,
  collectBackfill,
  hasLedgerUsage,
  mergeLedgerDocuments,
  type BackfillState,
  type SessionQueryLike,
} from './backfill.ts'
import { buildExportDocument, type LedgerExportDocument } from './export.ts'

/** Source tag the plugin stamps onto pet announcements. */
export const USAGE_ANNOUNCE_SOURCE = 'dsh-usage-plus'

/** Per-route credential fact the probes run against. */
interface ResolvedCredential {
  kind: CredentialKind
  /** The probe secret: an API key, or an OAuth access token for oauth-aware adapters. */
  key?: string
  /** Provider account id riding a dedicated header, when the credential carries one. */
  accountId?: string
  /** pi-ai OAuth grant refresh token, for adapters that need the upstream token (Copilot). */
  refreshToken?: string
}

/** One live LLM provider route the service knows about. */
interface ProviderRoute {
  id: string
  displayName: string
}

/** Poll-loop and announce options; re-applied live on settings change. */
export interface UsageServiceOptions {
  pollIntervalSec: number
  bubbleMode: 'always' | 'change' | 'off'
  retainDays: number
  /** Master switch for threshold alerts (payload + pet bubble). Default true. */
  alertsEnabled?: boolean
  /** Today's priced spend (CNY) limit; 0/absent disables the daily-cost alert. */
  dailyCostLimitCny?: number
  /** Official plan-window percent that raises an alert; 0/absent disables it. */
  planAlertPercent?: number
  /** Known CNY balance at/below which an alert is raised; 0/absent disables it. */
  balanceAlertCny?: number
  /** Minutes between alert bubbles for the same episode key. Default 60. */
  alertCooldownMinutes?: number
  /**
   * Filesystem-fact health cache TTL in ms. Default 2000; tests set 0 to make
   * corrupt-file/backfill-status changes visible immediately.
   */
  healthCacheTtlMs?: number
  cpamcEnabled: boolean
  cpamcBaseURL: string
  cpamcManagementKeyEnv: string
  cpamcAllowedHosts: string
  volcanoEnabled: boolean
  volcanoAccessKeyEnv: string
  volcanoSecretKeyEnv: string
}

/** Display-safe label for the plugin data directory (never an absolute home path). */
const DATA_DIR_LABEL = '~/.dsh/dsh-usage-plus'

/** Fallback values for the optional alert options. */
const DEFAULT_ALERT_COOLDOWN_MINUTES = 60

/** Probe timeout per HTTP call. */
const PROBE_TIMEOUT_MS = 10_000

/**
 * Retry delays for a provider whose probe keeps failing, by consecutive
 * failure count and capped at the last entry. Without it a permanently
 * invalid credential (a 401) is re-probed every cycle forever. The current
 * route is exempt so a transient failure recovers at the normal cadence.
 */
const PROBE_BACKOFF_MS = [60_000, 300_000, 900_000] as const

/** Ledger flush debounce: coalesce a burst of folds into one write. */
const FLUSH_DEBOUNCE_MS = 3_000

/**
 * Minimum gap between two ledger writes. The ledger is a full-document
 * rewrite+fsync, so an active session (a fold every few seconds) would
 * otherwise rewrite the whole retained document up to ~20×/minute. The
 * debounce still applies as the lower bound; this only delays, never drops —
 * `stop()` always performs a final flush.
 */
const FLUSH_MIN_INTERVAL_MS = 20_000

/** How many days the per-provider trend bars aggregate by default. */
const TREND_DAYS = 30

/** Default overview trend window in local days (backward compatible). */
export const DEFAULT_RANGE_DAYS = TREND_DAYS

/** The only `days` values the overview route accepts (besides the default). */
export const ALLOWED_RANGE_DAYS = [7, 30, 90, 182] as const

/** How many daily rows the Codex-style heatmap receives (26 weeks). */
const HEATMAP_DAYS = 182

/** TTL for the provider route list: an llm-registry config scan, not data. */
const ROUTE_CACHE_TTL_MS = 5_000

/** TTL for the external credential flags: three credential-vault reads. */
const CREDENTIAL_STATUS_TTL_MS = 5_000
/** Data-health TTL: keeps stat/readdir/backfill reads off every warm poll. */
const HEALTH_CACHE_TTL_MS = 2_000

/** TTL for configEditor entry snapshots a document read depends on (baseURL). */
const CONFIG_CACHE_TTL_MS = 5_000

/** How many times one overview assembly retries when a mutation lands mid-await. */
const OVERVIEW_ASSEMBLY_ATTEMPTS = 2

/** The wire payload of one overview read: the cached document plus its ETag. */
export interface UsageOverviewPayload {
  document: UsageOverviewView
  etag: string
}

/** External sources the Settings page can test on demand. */
export type ExternalTestTarget = 'cpamc' | 'volcano'

/** Result of one external-source connection test (no secrets cross the wire). */
export interface UsageExternalTestResult {
  target: ExternalTestTarget
  ok: boolean
  latencyMs: number
  /** Accounts readable through CPAMC (one row per codex/kimi/claude auth file). */
  accounts?: number
  /** First few plan windows found by the test, for a concrete success message. */
  windows?: Array<{ key: string; percent?: number; resetsAt?: string }>
  /** Transport or validation error, already free of secret values. */
  error?: string
  /** Actionable configuration hint derived from the failure. */
  hint?: string
}

/** Currency symbols the bubble and section render inline; other codes render as `12.00 EUR`. */
const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = { CNY: '¥', USD: '$', EUR: '€', GBP: '£' }

/** Format a balance for display: symbol prefix when known, code suffix otherwise. */
export function formatMoney(currency: string, totalBalance: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()]
  if (symbol !== undefined) return symbol + totalBalance
  return `${totalBalance} ${currency.toUpperCase()}`
}

/**
 * Delay before the next probe of a provider that just failed that many times
 * in a row; 0 (probe normally next cycle) for a provider with no failures.
 */
export function probeBackoffDelayMs(failures: number): number {
  if (!Number.isFinite(failures) || failures <= 0) return 0
  const index = Math.min(Math.floor(failures) - 1, PROBE_BACKOFF_MS.length - 1)
  return PROBE_BACKOFF_MS[index] as number
}

/**
 * Delay before the next debounced ledger flush. The burst debounce is the
 * lower bound; a write that started less than the minimum interval ago pushes
 * the next one out so the full-document fsync rewrite cannot run continuously
 * during an active session. Pure: unit-tested directly, no timer involved.
 */
export function nextFlushDelayMs(nowMs: number, lastFlushAtMs: number): number {
  const floorWait = lastFlushAtMs + FLUSH_MIN_INTERVAL_MS - nowMs
  // Clamp to the floor itself: a backwards clock jump must not park the ledger
  // unflushed for the length of the jump (stop() still flushes regardless).
  return Math.max(FLUSH_DEBOUNCE_MS, Math.min(floorWait, FLUSH_MIN_INTERVAL_MS))
}

/**
 * Resolve the overview `days` query value: absent -> 30 (backward compatible),
 * one of `ALLOWED_RANGE_DAYS` -> itself, anything else -> undefined (the route
 * answers 400). Accepts the raw query string so the route and the service
 * share one validation rule.
 */
export function resolveRangeDays(value: unknown): number | undefined {
  if (value === undefined || value === null) return DEFAULT_RANGE_DAYS
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN
  return (ALLOWED_RANGE_DAYS as readonly number[]).includes(parsed) ? parsed : undefined
}

/**
 * Drop overview rows no surface renders: the wire document otherwise carries
 * every catalog provider the runtime knows (40+ empty rows ≈ 6 KiB per poll).
 * A row survives when it carries a fact (plan/balance/error), a configured
 * credential, a usage total, is the current route, or comes from an external
 * source. `supported`-only rows without any of those are pure catalog noise:
 * nothing in the browser half reads `supported`/`planSupported`.
 */
export function selectOverviewProviders(
  rows: readonly ProviderSnapshotView[],
  options: { usageProviders: ReadonlySet<string>; currentProvider?: string },
): ProviderSnapshotView[] {
  return rows.filter((row) =>
    row.plan !== undefined
    || row.balance !== undefined
    || row.error !== undefined
    || row.credential !== 'none'
    || (row.source !== undefined && row.source !== 'model')
    || (options.currentProvider !== undefined && row.provider === options.currentProvider)
    || options.usageProviders.has(row.provider))
}

/** Map a used percent to the announcement tone. */
export function planTone(percent: number): 'ok' | 'warn' | 'low' {
  if (percent >= 90) return 'low'
  if (percent >= 70) return 'warn'
  return 'ok'
}

/** Announcement context the service computes per poll: today's family spend and the DeepSeek period. */
export interface AnnounceContext {
  /** Today's ledger spend for the announced provider's family (CNY; 0 = unpriced). */
  todayCost?: number
  /** Whether DeepSeek peak pricing is in effect right now. */
  peak?: boolean
}

/**
 * Build the raw pet announce payload for one provider snapshot, or
 * undefined when nothing worth announcing exists. Pure: every payload this
 * returns satisfies the pet's `parseAnnouncement` contract — plan
 * announcements require a numeric percent, so percent-less windows never
 * announce (the pet validator would silently drop them). A priced family
 * (DeepSeek) with spend today announces a cost bubble first; balance-only
 * families announce the balance; plan families announce their tightest
 * percent window.
 */
export function buildAnnouncement(
  snapshot: Pick<ProviderSnapshotView, 'displayName' | 'balance' | 'plan'>,
  context?: AnnounceContext,
): Record<string, unknown> | undefined {
  const todayCost = context?.todayCost ?? 0
  if (todayCost > 0) {
    const peak = context?.peak ?? false
    const noteParts = [
      peak ? '高峰时段 计价×2' : '空闲时段 计价减半',
      ...(snapshot.balance !== undefined ? [`余额 ${formatMoney(snapshot.balance.currency, snapshot.balance.totalBalance)}`] : []),
    ]
    return {
      kind: 'cost',
      title: snapshot.displayName,
      amount: `今日 ${formatMoney('CNY', todayCost.toFixed(2))}`,
      ...(noteParts.length > 0 ? { note: noteParts.join(' · ') } : {}),
      tone: peak ? 'warn' : 'ok',
    }
  }
  if (snapshot.balance !== undefined) {
    return {
      kind: 'balance',
      title: snapshot.displayName,
      amount: formatMoney(snapshot.balance.currency, snapshot.balance.totalBalance),
      tone: 'ok',
    }
  }
  if (snapshot.plan === undefined) return undefined
  const window = snapshot.plan.windows
    .filter((entry) => typeof entry.percent === 'number')
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0]
  if (window === undefined || window.percent === undefined) return undefined
  return {
    kind: 'plan',
    title: snapshot.displayName,
    percent: window.percent,
    ...(window.resetsAt !== undefined ? { resetAt: window.resetsAt } : {}),
    ...(snapshot.plan.planName !== undefined ? { note: snapshot.plan.planName } : {}),
    tone: planTone(window.percent),
  }
}

/**
 * Compact token-count display for the usage fallback bubble: `9805`,
 * `8.7万`, `1.2亿`. The host-authored bubble copy is zh (like every other
 * line this service speaks), so the magnitudes follow the zh convention.
 */
export function formatTokens(count: number): string {
  const compact = (value: number): string => {
    const rounded = Math.round(value * 10) / 10
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  }
  if (count >= 1e8) return compact(count / 1e8) + '亿'
  if (count >= 1e4) return compact(count / 1e4) + '万'
  return String(count)
}

/**
 * The usage fallback for the session's provider: today's token consumption
 * and call count, the one fact the ledger owns for every provider. Providers
 * without a readable balance/plan endpoint (relay stations, local runtimes,
 * token-plan vendors — and probeable providers whose probes are failing)
 * would otherwise leave the pet bubble permanently silent even while their
 * sessions run. Undefined when the provider has no usage today: a bubble
 * about nothing is noise, not information. Pure; the payload satisfies the
 * pet's `parseAnnouncement` contract.
 */
export function buildLedgerAnnouncement(input: { displayName: string; totals: UsageTokenTotals }): Record<string, unknown> | undefined {
  const total = totalTokens(input.totals)
  if (input.totals.calls <= 0 || total <= 0) return undefined
  return {
    kind: 'cost',
    title: input.displayName,
    amount: `今日 ${formatTokens(total)} tokens`,
    note: `${input.totals.calls} 次调用`,
    tone: 'ok',
  }
}

/** Best-effort typed service read: absent services resolve to undefined at runtime. */
function service<T>(ctx: Context, name: string): T | undefined {
  try {
    return (ctx as unknown as { get(name: string): unknown }).get(name) as T | undefined
  } catch {
    return undefined
  }
}

/**
 * Atomic JSON write through a unique temp file + fsync + rename. The temp
 * name is per-call so two overlapping flushes can never interleave into one
 * temp file, and the fsync closes the rename-lands-but-bytes-are-not-durable
 * window.
 */
async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`
  try {
    const handle = await open(temp, 'w')
    try {
      await handle.writeFile(JSON.stringify(value, null, 1), 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temp, path)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

/** Read a foreign Loader entry's live Config by its stable profile id.
 *
 * DSH 0.1.7 exposes `settings` as a forms API; it deliberately has no
 * `settings.get(namespace)`. ConfigEditor is the host-side read seam for an
 * active entry. Its fiber config can contain Volatile refs, so snapshot each
 * top-level ref before consumers inspect it.
 */
function isVolatileRef(value: unknown): value is { get(): unknown } {
  return typeof value === 'object' && value !== null
    && typeof (value as { get?: unknown }).get === 'function'
}

export function readEntryConfig(ctx: Context, id: string): Record<string, unknown> | undefined {
  try {
    const editor = service<{
      configuration(): Array<{
        entry: { options: { id: string }; fiber?: { config?: unknown } }
      }>
    }>(ctx, 'configEditor')
    const raw = editor?.configuration().find((row) => row.entry.options.id === id)?.entry.fiber?.config
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
    const config: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(raw)) {
      config[key] = isVolatileRef(value) ? value.get() : value
    }
    return config
  } catch {
    return undefined
  }
}

/**
 * Replace one external source only after its complete probe result is ready.
 * Never expose an empty CPAMC/Volcano interval to an overlapping browser
 * `/overview` poll: a transient fetch failure retains the last known rows;
 * an intentional disabled/status result still atomically replaces them.
 */
export function replaceExternalSnapshots(
  snapshots: Map<string, ProviderSnapshotState>,
  source: 'cpamc' | 'volcano',
  rows: readonly ProviderSnapshotState[],
): void {
  const prefix = `${source}:`
  for (const id of [...snapshots.keys()]) {
    if (id.startsWith(prefix)) snapshots.delete(id)
  }
  for (const row of rows) snapshots.set(row.provider, row)
}

/** Balance facts equal, ignoring the volatile probe read timestamp. */
function sameBalanceFacts(left: BalanceView | undefined, right: BalanceView | undefined): boolean {
  if (left === undefined || right === undefined) return left === right
  return left.currency === right.currency && left.totalBalance === right.totalBalance
}

/** Plan facts equal, ignoring the volatile probe read timestamp (plan and windows). */
function samePlanFacts(left: PlanView | undefined, right: PlanView | undefined): boolean {
  if (left === undefined || right === undefined) return left === right
  if (left.planName !== right.planName) return false
  if (left.windows.length !== right.windows.length) return false
  for (let index = 0; index < left.windows.length; index += 1) {
    const a = left.windows[index]
    const b = right.windows[index]
    if (a === undefined || b === undefined) return a === b
    if (a.key !== b.key || a.name !== b.name || a.percent !== b.percent || a.resetsAt !== b.resetsAt) return false
  }
  return true
}

/**
 * Whether two snapshot states carry the same *facts*. Volatile probe read
 * timestamps (`updatedAt` on the row, balance, and plan) are ignored: a
 * provider that keeps returning identical facts must not rewrite the snapshot
 * map, the persisted snapshots file, or the overview revision/ETag every
 * poll. Extend this when a new wire fact is added to `ProviderSnapshotState`.
 */
export function providerSnapshotFactsEqual(left: ProviderSnapshotState, right: ProviderSnapshotState): boolean {
  return left.provider === right.provider
    && left.displayName === right.displayName
    && left.credential === right.credential
    && left.supported === right.supported
    && left.balanceSupported === right.balanceSupported
    && left.planSupported === right.planSupported
    && left.source === right.source
    && left.error === right.error
    && left.balanceError === right.balanceError
    && left.planError === right.planError
    && sameBalanceFacts(left.balance, right.balance)
    && samePlanFacts(left.plan, right.plan)
}

/** Structural equality for two configEditor entry snapshots (plain JSON data). */
function configsEqual(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean {
  if (left === right) return true
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return false
  }
}

/** Whether two provider route snapshots are identical, order included. */
function sameRoutes(left: readonly ProviderRoute[], right: readonly ProviderRoute[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] as ProviderRoute
    const b = right[index] as ProviderRoute
    if (a.id !== b.id || a.displayName !== b.displayName) return false
  }
  return true
}

/**
 * Non-volatile health signature: the health payload with the probe instants
 * zeroed, so a changed data fact (bytes, corrupt files, backfill state,
 * failing set) invalidates the cached document/ETag while a probe cycle alone
 * does not.
 */
function healthCacheKey(health: UsageHealth): string {
  return JSON.stringify({
    ...health,
    probes: { ...health.probes, lastAttemptAt: null, lastSuccessAt: null },
  })
}

export class UsageService {
  private readonly ctx: Context
  private options: UsageServiceOptions
  private readonly persistDir: string
  private readonly ledgerPath: string
  private readonly snapshotsPath: string

  private ledger: UsageLedgerDocument = createLedgerDocument()
  private readonly snapshots = new Map<string, ProviderSnapshotState>()
  /** Per-live-session route attribution (WeakMap: disposed sessions age out). */
  private readonly sessionRoutes = new WeakMap<Session, { provider: string; model: string }>()
  /** The most recent route seen this boot; the pet bubble follows it. */
  private current: { provider?: string; model?: string; source: 'live' | 'default' } = { source: 'default' }

  private sessionListenerDisposer: (() => void) | undefined
  private pollTimer: ReturnType<typeof setTimeout> | undefined
  private flushTimer: ReturnType<typeof setTimeout> | undefined
  private pollInFlight = false
  /** The running poll cycle; manual refresh joins it instead of no-oping. */
  private pollPromise: Promise<void> | undefined
  /** Serialized ledger flushes: overlapping debounce/stop flushes queue, never interleave. */
  private flushChain: Promise<void> = Promise.resolve()
  /** True once loadPersisted finished; nothing may overwrite the files before that. */
  private loaded = false
  private disposed = false
  private lastSignature: string | undefined
  /** Last prune guard: once per local day, and whenever retention shrinks. */
  private lastPrune: { dayKey: string; retainDays: number } | undefined
  /** Consecutive probe failures per provider; drives the retry backoff. */
  private readonly probeBackoff = new Map<string, { failures: number; nextAt: number }>()
  /** Last snapshots document written; an unchanged document is not rewritten. */
  private lastPersistedSnapshots: string | undefined
  /** Start instant of the last ledger write attempt; enforces the flush floor. */
  private lastFlushAt = 0

  /**
   * Bumped on every document-visible mutation: ledger fold, persisted merge,
   * prune, settings/retention change, composer/current change, probe result,
   * or a route/config/credential-flag change. The derived overview document
   * is served from cache until this moves.
   */
  private revision = 0
  /** Bumped only by ledger mutations; the usage windows aggregate from it. */
  private ledgerRevision = 0
  /**
   * Derived overview documents, one per accepted range window, keyed by
   * `revision|dayKey`. Different `?days=` variants do not thrash each other;
   * a revision/day rollover replaces the whole map.
   */
  private overviewCache: { base: string; documents: Map<number, { document: UsageOverviewView; etag: string; healthSignature: string }> } | undefined
  /**
   * Aggregated usage windows, one per accepted range window, keyed by
   * `ledgerRevision|retainDays|dayKey`. The today/heatmap/all-time windows are
   * range-independent but cheap to rebuild per variant once per revision.
   */
  private usageCache: { base: string; summaries: Map<number, LedgerUsageSummary> } | undefined
  /** Provider route list TTL cache (the llm registry is a config scan). */
  private routesCache: { at: number; routes: ProviderRoute[] } | undefined
  /** configEditor entry snapshots a document read depends on; TTL-cached. */
  private readonly entryConfigCache = new Map<string, { at: number; config: Record<string, unknown> | undefined }>()
  /** External credential-status TTL cache: three vault reads per assembly otherwise. */
  private credentialStatusCache: { at: number; value: ExternalCredentialStatus } | undefined
  /** Last credential flags observed before a cache invalidation; drives invalidation. */
  private lastCredentialStatus: ExternalCredentialStatus | undefined
  /** Dedupes overlapping credential-status reads. */
  private credentialStatusInFlight: Promise<ExternalCredentialStatus> | undefined
  /** Invalidates in-flight credential-status reads that predate a credential write. */
  private credentialStatusGeneration = 0
  /** Short-TTL data-health cache: health costs filesystem reads, not per-poll work. */
  private healthCache: { at: number; value: Omit<UsageHealth, 'probes'> } | undefined
  /** Alert episodes: `kind:provider:window` → epoch ms the current episode started. */
  private readonly alertEpisodes = new Map<string, number>()
  /** Last pet bubble instant per alert key; enforces the configured cooldown. */
  private readonly alertBubbleAt = new Map<string, number>()
  /** Last probe attempt instant (any provider), surfaced in `health.probes`. */
  private probeAttemptAt: number | null = null
  /** Last successful probe instant, surfaced in `health.probes`. */
  private probeSuccessAt: number | null = null

  /**
   * @param ctx - host context.
   * @param options - resolved plugin options.
   * @param persistDir - ledger/snapshot directory override (tests only; the
   *   live service always uses the DSH home). Kept as a narrow seam so
   *   persistence tests never write into the user's real data directory.
   */
  constructor(ctx: Context, options: UsageServiceOptions, persistDir: string = join(dshHome(), 'dsh-usage-plus')) {
    this.ctx = ctx
    this.options = options
    this.persistDir = persistDir
    this.ledgerPath = join(this.persistDir, 'usage-ledger.json')
    this.snapshotsPath = join(this.persistDir, 'provider-snapshots.json')
  }

  /** Start the listeners, load persisted state, and arm the first poll. */
  start(): void {
    // Capture the live-fold cutoff before the event listener exists: anything
    // the listener folds afterwards was appended at/after this instant, so the
    // historical backfill (events strictly older) can never double count it.
    const startedAt = Date.now()
    this.sessionListenerDisposer = this.ctx.on('session/event', (session, event) => this.onSessionEvent(session, event))
    void this.loadPersisted()
      .then(() => this.maybeBackfill(startedAt))
      .catch(() => {
        // loadPersisted and maybeBackfill both swallow their own failures.
      })
    this.rearmPoll(2_000)
  }

  /**
   * Stop timers and flush pending ledger writes. The returned promise
   * resolves after the final flush lands, so a successor instance (quick
   * disable → enable) can serialize its first load behind it.
   */
  stop(): Promise<void> {
    this.disposed = true
    if (this.pollTimer !== undefined) clearTimeout(this.pollTimer)
    if (this.flushTimer !== undefined) clearTimeout(this.flushTimer)
    this.sessionListenerDisposer?.()
    // Release the derived document/caches; a successor instance rebuilds.
    this.overviewCache = undefined
    this.usageCache = undefined
    this.routesCache = undefined
    this.entryConfigCache.clear()
    this.credentialStatusCache = undefined
    this.healthCache = undefined
    this.alertEpisodes.clear()
    this.alertBubbleAt.clear()
    return this.flushLedger()
  }

  /** Re-apply options live (settings change); retention shrink prunes now. */
  applyOptions(options: UsageServiceOptions): void {
    this.options = options
    // Every option is document-visible: retention resizes the windows, the
    // external env names change the status flags, and the poll cadence rides
    // the pet TTL. Invalidate once, then prune immediately on a shrink.
    this.bumpRevision()
    this.invalidateCredentialStatus()
    this.healthCache = undefined
    this.pruneIfNeeded()
  }

  /** Force one poll now (manual refresh route); joins an in-flight cycle. */
  async refresh(): Promise<void> {
    await this.pollNow()
  }

  /**
   * Probe one external source now and report a structured, secret-free result
   * for the Settings "test connection" button. Never throws: transport errors
   * and configuration mistakes both come back as `ok: false` plus a hint.
   */
  async testExternalSource(target: ExternalTestTarget): Promise<UsageExternalTestResult> {
    const started = Date.now()
    try {
      if (target === 'cpamc') {
        const rows = await probeCpamc({
          enabled: this.options.cpamcEnabled,
          baseURL: this.options.cpamcBaseURL,
          managementKey: await this.resolveEnv(this.options.cpamcManagementKeyEnv),
          allowedHosts: this.options.cpamcAllowedHosts,
        })
        const latencyMs = Date.now() - started
        if (rows.length === 0) {
          return { target, ok: false, latencyMs, error: 'CPAMC 未启用', hint: '先在下方勾选“启用 CPAMC 独立额度源”并保存，再测试。' }
        }
        const first = rows[0]
        const error = first?.planError ?? first?.error
        if (error !== undefined) {
          return { target, ok: false, latencyMs, error, hint: this.cpamcTestHint(error) }
        }
        return { target, ok: true, latencyMs, accounts: rows.length, windows: first?.plan?.windows.slice(0, 3) ?? [] }
      }
      const rows = await probeVolcano({
        enabled: this.options.volcanoEnabled,
        accessKeyId: await this.resolveEnv(this.options.volcanoAccessKeyEnv),
        secretAccessKey: await this.resolveEnv(this.options.volcanoSecretKeyEnv),
      })
      const latencyMs = Date.now() - started
      if (rows.length === 0) {
        return { target, ok: false, latencyMs, error: '火山方舟未启用或未配置 AK/SK', hint: '启用火山方舟额度源并保存 AK/SK 后再测试。' }
      }
      const first = rows[0]
      const error = first?.planError ?? first?.error
      if (error !== undefined) {
        return { target, ok: false, latencyMs, error, hint: this.volcanoTestHint(error) }
      }
      return { target, ok: true, latencyMs, windows: first?.plan?.windows.slice(0, 3) ?? [] }
    } catch (error) {
      return {
        target,
        ok: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
        hint: '检查外部额度源的地址、凭据与网络连通性。',
      }
    }
  }

  /** Actionable CPAMC hint for one probe failure message. */
  private cpamcTestHint(error: string): string {
    const text = error.toLowerCase()
    if (text.includes('missing management token')) {
      return '填写 CPAMC Management Token（CPAMC 配置里的 management key），或设置环境变量 CPAMC_MANAGEMENT_KEY。'
    }
    if (text.includes('url must be')) {
      return '管理地址只填 origin（协议 + 主机 + 端口，不含 / 路径）；远程主机还必须加入“CPAMC 允许的 host”。'
    }
    if (text.includes('401') || text.includes('403')) {
      return 'Management Token 不正确，或 CPAMC 没有开启 management key。'
    }
    if (text.includes('no quota accounts')) {
      return 'CPAMC 已连通，但其中没有可读取配额接口的 codex / kimi / claude 账号（auth files）。'
    }
    if (text.includes('econnrefused') || text.includes('enotfound') || text.includes('eai_again')
      || text.includes('timed out') || text.includes('fetch failed') || text.includes('cert')) {
      const allowed = String(this.options.cpamcAllowedHosts ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter((host) => host !== '')
      const loopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(?::\d+)?\/?$/i.test(this.options.cpamcBaseURL)
      const suggestion = loopback && allowed.length > 0
        ? `当前管理地址是回环地址但本机端口未监听；若 CPAMC 部署在 ${allowed[0]}，请把管理地址改为 https://${allowed[0]}。`
        : ''
      return `无法连接 CPAMC：检查服务是否启动、管理地址是否只填 origin。${suggestion}`
    }
    return '检查 CPAMC 管理地址、允许 host 与 management token。'
  }

  /** Actionable Volcano hint for one probe failure message. */
  private volcanoTestHint(error: string): string {
    const text = error.toLowerCase()
    if (text.includes('401') || text.includes('403')) return 'AK/SK 不正确，或该密钥没有方舟控制面读取权限。'
    if (text.includes('econnrefused') || text.includes('enotfound') || text.includes('timed out') || text.includes('fetch failed')) {
      return '无法连接火山方舟 OpenAPI，检查本机网络与代理设置。'
    }
    return '检查 VOLC_ACCESSKEY / VOLC_SECRETKEY 是否完整、是否开通 Coding Plan。'
  }

  /**
   * Assemble the overview document the browser section renders.
   * @param days - trend window (one of `ALLOWED_RANGE_DAYS`); default 30.
   */
  async overview(days?: number): Promise<UsageOverviewView> {
    return (await this.overviewPayload(days)).document
  }

  /**
   * The overview document plus its strong ETag for one range window. A warm
   * request (same data revision and same window) answers from the derived
   * cache: no ledger re-summarization, no provider rebuild, and no SHA-1 over
   * the JSON — the GET route only needs the cached validator to answer 304.
   * `updatedAt` moves with each read but stays out of the ETag.
   */
  async overviewPayload(days?: number): Promise<UsageOverviewPayload> {
    const rangeDays = resolveRangeDays(days) ?? DEFAULT_RANGE_DAYS
    // Always re-sync to the composer selection first: switching the model
    // selector updates the strip without waiting for the next request, and a
    // change must invalidate the cache before the lookup below.
    this.syncCurrentFromComposer()
    // The route list and the current route's baseURL are part of the document;
    // both ride short TTLs, and a change bumps the revision (invalidating).
    this.listProviderRoutes()
    if (this.current.provider !== undefined) this.piAiProfile(this.current.provider)
    for (let attempt = 0; attempt < OVERVIEW_ASSEMBLY_ATTEMPTS; attempt += 1) {
      const revision = this.revision
      const dayKey = localDateKey(Date.now())
      // The credential flags ride a short TTL; a changed value bumps the
      // revision, and a fold/probe landing during the await is caught by the
      // re-check below: never cache a document built on stale state.
      const externalCredentials = await this.externalCredentialStatus()
      // Health is refreshed behind a short TTL (file bytes / corrupt files /
      // backfill state): a warm 10s poll must not stat/readdir/readFile on
      // every request, while its volatile probe instants stay normalized out
      // of the ETag.
      const health = await this.currentHealth()
      if (this.revision !== revision || localDateKey(Date.now()) !== dayKey) continue
      const base = `${revision}|${dayKey}`
      if (this.overviewCache?.base !== base) this.overviewCache = { base, documents: new Map() }
      // One cache slot per range window: switching 7/30/90/182 does not evict
      // the other variants, so a range toggle stays cheap. The health signature
      // (probe instants excluded) must also match: data-health facts changing
      // between reads rebuild the document and its ETag.
      const healthSignature = healthCacheKey(health)
      const cached = this.overviewCache.documents.get(rangeDays)
      if (cached !== undefined && cached.healthSignature === healthSignature) {
        cached.document.updatedAt = Date.now()
        cached.document.health = health
        return { document: cached.document, etag: cached.etag }
      }
      const document = this.assembleOverview(this.usageSummary(rangeDays), externalCredentials, health)
      const etag = jsonEtag(document)
      if (this.revision === revision && this.overviewCache?.base === base) {
        this.overviewCache.documents.set(rangeDays, { document, etag, healthSignature })
      }
      return { document, etag }
    }
    // A fold or probe landed mid-await both times: answer with a consistent
    // document, but do not cache it under a moving revision.
    const document = this.assembleOverview(this.usageSummary(rangeDays), await this.externalCredentialStatus(), await this.currentHealth())
    return { document, etag: jsonEtag(document) }
  }

  /**
   * The aggregate ledger export document for the last `days` local days
   * (1..730, default 182). Transport-free so the export route stays a thin
   * HTTP wrapper; the payload is ledger aggregates only — no secrets.
   */
  exportLedger(days: number): LedgerExportDocument {
    return buildExportDocument(this.ledger, days, Date.now())
  }

  /**
   * Build the wire document from an already-aggregated usage summary. Rows
   * and the provider keep-set (the exact ids the trend/today cards look up)
   * are computed once per revision. The returned `providers` array is freshly
   * sorted, so it never aliases the cached route list.
   */
  private assembleOverview(usage: LedgerUsageSummary, externalCredentials: ExternalCredentialStatus, health: UsageHealth): UsageOverviewView {
    const routes = this.listProviderRoutes()
    const rows: ProviderSnapshotView[] = []
    for (const route of routes) {
      const adapter = adapterFor(route.id)
      const snapshot = this.snapshots.get(route.id)
      const error = snapshot?.balanceError ?? snapshot?.planError
      // Credential-gated halves are advertised as unsupported until the resolved
      // credential kind matches, so an API-key user does not get a plan card
      // for an OAuth-only subscription endpoint.
      const credentialKind = snapshot?.credential ?? 'none'
      const balanceSupported = adapter?.balance !== undefined && probeHalfAllowed(adapter.balance.credential, credentialKind)
      const planSupported = adapter?.plan !== undefined && probeHalfAllowed(adapter.plan.credential, credentialKind)
      rows.push({
        provider: route.id,
        source: 'model',
        displayName: route.displayName || adapter?.displayName || route.id,
        credential: snapshot?.credential ?? 'none',
        supported: balanceSupported || planSupported,
        ...(balanceSupported ? { balanceSupported: true } : {}),
        ...(planSupported ? { planSupported: true } : {}),
        ...(snapshot?.balance !== undefined ? { balance: snapshot.balance } : {}),
        ...(snapshot?.plan !== undefined ? { plan: snapshot.plan } : {}),
        ...(error !== undefined ? { error } : {}),
        ...(snapshot?.updatedAt !== undefined ? { updatedAt: snapshot.updatedAt } : {}),
      })
    }
    for (const snapshot of this.snapshots.values()) {
      if (snapshot.source !== 'cpamc' && snapshot.source !== 'volcano' && snapshot.source !== 'custom') continue
      const error = snapshot.balanceError ?? snapshot.planError
      rows.push({ ...snapshot, ...(error !== undefined ? { error } : {}) })
    }
    const providers = selectOverviewProviders(rows, {
      usageProviders: usage.usageProviders,
      currentProvider: this.current.provider,
    })
    providers.sort((a, b) => Number(b.supported) - Number(a.supported) || a.displayName.localeCompare(b.displayName))
    // Alert evaluation also advances episode state and bubbles the alerts that
    // just started; it is fully guarded so a malformed fact never breaks the
    // overview. Cached documents keep the alerts computed at assembly time —
    // alert-driving facts are part of the revision, so the cache entry is
    // already invalid when they change.
    let alerts: UsageAlert[] = []
    try {
      const evaluation = evaluateAlerts(
        { todayCost: usage.today.totals.cost, providers },
        {
          alertsEnabled: this.options.alertsEnabled ?? true,
          dailyCostLimitCny: this.options.dailyCostLimitCny ?? 0,
          planAlertPercent: this.options.planAlertPercent ?? 0,
          balanceAlertCny: this.options.balanceAlertCny ?? 0,
        },
        this.alertEpisodes,
        Date.now(),
      )
      alerts = evaluation.alerts
      for (const started of evaluation.started) this.announceAlert(started)
    } catch {
      alerts = []
    }
    const baseURL = this.current.provider !== undefined ? this.piAiProfile(this.current.provider)?.baseURL : undefined
    return {
      updatedAt: Date.now(),
      providers,
      alerts,
      health,
      current: {
        ...this.current,
        ...(typeof baseURL === 'string' && baseURL.trim() !== '' ? { baseURL: baseURL.trim() } : {}),
      },
      externalCredentials,
      usage: {
        today: usage.today,
        days: usage.days,
        range: usage.range,
        all: usage.all,
      },
    }
  }

  /**
   * Aggregate the usage windows for the current ledger revision, local day,
   * and range window. One pass over the retained ledger per revision/window;
   * warm polls (and the pet bubble's today lookup) reuse it.
   */
  private usageSummary(rangeDays: number = DEFAULT_RANGE_DAYS): LedgerUsageSummary {
    const ledgerRevision = this.ledgerRevision
    const dayKey = localDateKey(Date.now())
    const retainDays = this.options.retainDays
    const base = `${ledgerRevision}|${retainDays}|${dayKey}`
    if (this.usageCache?.base !== base) this.usageCache = { base, summaries: new Map() }
    const cached = this.usageCache.summaries.get(rangeDays)
    if (cached !== undefined) return cached
    const usage = summarizeLedgerUsage(this.ledger, {
      todayKey: dayKey,
      heatmapDays: Math.min(HEATMAP_DAYS, retainDays),
      rangeDays,
    })
    this.usageCache.summaries.set(rangeDays, usage)
    return usage
  }

  // ------------------------------------------------------------------
  // Data health
  // ------------------------------------------------------------------

  /**
   * Data health. Filesystem-derived facts (ledger bytes, corrupt files,
   * backfill state) sit behind a short TTL so a warm overview poll performs no
   * I/O; the in-memory probe instants are cheap and refreshed on every read.
   */
  private async currentHealth(): Promise<UsageHealth> {
    const now = Date.now()
    const ttl = this.options.healthCacheTtlMs ?? HEALTH_CACHE_TTL_MS
    let cached = this.healthCache
    if (cached === undefined || now - cached.at >= ttl) {
      cached = { at: Date.now(), value: await this.buildHealthFacts() }
      this.healthCache = cached
    }
    const failing: string[] = []
    for (const [id, snapshot] of this.snapshots) {
      if (snapshot.balanceError !== undefined || snapshot.planError !== undefined) failing.push(id)
    }
    failing.sort()
    return {
      ...cached.value,
      probes: {
        lastAttemptAt: this.probeAttemptAt,
        lastSuccessAt: this.probeSuccessAt,
        failing,
      },
    }
  }

  /**
   * Filesystem/ledger facts for `currentHealth`: storage stats and backfill
   * state. Never throws: each file read is individually guarded. The volatile
   * probe instants are normalized out of the ETag (see `jsonEtag`).
   */
  private async buildHealthFacts(): Promise<Omit<UsageHealth, 'probes'>> {
    try {
      let bytes = 0
      try {
        bytes = (await stat(this.ledgerPath)).size
      } catch {
        bytes = 0
      }
      let corruptFiles: string[] = []
      try {
        corruptFiles = (await readdir(this.persistDir))
          .filter((name) => name.startsWith('usage-ledger.json.corrupt-'))
          .sort()
      } catch {
        corruptFiles = []
      }
      const activeDays: string[] = []
      for (const dayKey of ledgerDayKeys(this.ledger)) {
        const day = this.ledger.days[dayKey]
        if (day === undefined) continue
        for (const models of Object.values(day)) {
          if (typeof models === 'object' && models !== null && Object.keys(models).length > 0) {
            activeDays.push(dayKey)
            break
          }
        }
      }
      const state = await this.readBackfillState()
      return {
        storage: {
          label: DATA_DIR_LABEL,
          bytes,
          activeDays: activeDays.length,
          firstDay: activeDays[0] ?? null,
          lastDay: activeDays[activeDays.length - 1] ?? null,
          retentionDays: this.options.retainDays,
          corruptFiles,
        },
        backfill: state === undefined
          ? null
          : {
              completedAt: state.completedAt,
              cutoff: state.cutoff,
              sessions: state.sessions,
              events: state.events,
              ...(state.truncated === true ? { truncated: true } : {}),
            },
      }
    } catch {
      return {
        storage: {
          label: DATA_DIR_LABEL,
          bytes: 0,
          activeDays: 0,
          firstDay: null,
          lastDay: null,
          retentionDays: this.options.retainDays,
          corruptFiles: [],
        },
        backfill: null,
      }
    }
  }

  // ------------------------------------------------------------------
  // Threshold alert bubbles
  // ------------------------------------------------------------------

  /**
   * Bubble one newly-started alert to the pet. Honors the bubble off switch,
   * the alert master switch, and the per-key cooldown; active alerts still
   * appear in the overview payload regardless of whether the bubble is
   * suppressed. Fully guarded: a missing/failing pet never breaks the overview.
   */
  private announceAlert(alert: UsageAlert): void {
    if (this.disposed || this.options.bubbleMode === 'off') return
    if ((this.options.alertsEnabled ?? true) === false) return
    const now = Date.now()
    const cooldownMinutes = Math.max(0, this.options.alertCooldownMinutes ?? DEFAULT_ALERT_COOLDOWN_MINUTES)
    const last = this.alertBubbleAt.get(alertKey(alert.kind, alert.provider, alert.window))
    if (last !== undefined && now - last < cooldownMinutes * 60_000) return
    try {
      const pet = service<{ announce(input: Record<string, unknown>): void }>(this.ctx, 'pet')
      if (pet === undefined) return
      const title = alert.provider !== undefined ? this.routeDisplayName(alert.provider) : 'dsh-usage-plus'
      const payload: Record<string, unknown> = alert.kind === 'plan-threshold'
        ? { kind: 'plan', title, percent: alert.value, tone: alert.severity === 'critical' ? 'low' : 'warn' }
        : { kind: 'cost', title, amount: alert.message, tone: alert.severity === 'critical' ? 'warn' : 'ok' }
      const ttlMs = Math.min(7_200_000, this.options.pollIntervalSec * 2_000 + 30_000)
      this.alertBubbleAt.set(alertKey(alert.kind, alert.provider, alert.window), now)
      pet.announce({ source: USAGE_ANNOUNCE_SOURCE, ttlMs, ...payload })
    } catch {
      // A missing or failing pet service must never break the overview.
    }
  }

  /** Mark a document-visible mutation: the next overview read rebuilds. */
  private bumpRevision(): void {    this.revision += 1
  }

  /** Mark a ledger mutation: both the document and the usage windows rebuild. */
  private bumpLedgerRevision(): void {
    this.ledgerRevision += 1
    this.revision += 1
  }

  /** Adopt a new current route, bumping the revision only when it changed. */
  private setCurrent(next: { provider?: string; model?: string; source: 'live' | 'default' }): void {
    if (
      this.current.provider === next.provider
      && this.current.model === next.model
      && this.current.source === next.source
    ) {
      return
    }
    this.current = next
    this.bumpRevision()
  }

  /**
   * Write-only: store one external secret in the DSH credential vault under
   * the configured env-var name. Never returns the value.
   */
  async setExternalCredential(target: ExternalCredentialTarget, value: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const trimmed = value.trim()
    if (trimmed === '') return { ok: false, error: 'empty credential' }
    let name: string
    try {
      name = this.externalCredentialEnv(target)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'invalid target' }
    }
    const credentials = service<{ set(ref: unknown, value: string): Promise<void> }>(this.ctx, 'credentials')
    if (credentials === undefined) return { ok: false, error: 'credential store unavailable' }
    try {
      await credentials.set(credentialRef(name), trimmed)
      // The status flags are document-visible: fetch fresh on the next read.
      this.invalidateCredentialStatus()
      this.bumpRevision()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'credential write failed' }
    }
  }

  /** Remove one external secret from the DSH credential vault. */
  async clearExternalCredential(target: ExternalCredentialTarget): Promise<{ ok: true } | { ok: false; error: string }> {
    let name: string
    try {
      name = this.externalCredentialEnv(target)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'invalid target' }
    }
    const credentials = service<{ unset(ref: unknown): Promise<void> }>(this.ctx, 'credentials')
    if (credentials === undefined) return { ok: false, error: 'credential store unavailable' }
    try {
      await credentials.unset(credentialRef(name))
      // The status flags are document-visible: fetch fresh on the next read.
      this.invalidateCredentialStatus()
      this.bumpRevision()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'credential clear failed' }
    }
  }

  /**
   * Configured/missing flags only — never the secret values. Short-TTL cached:
   * the document renders them and a 10s poll must not read the vault three
   * times per request. A changed flag bumps the revision so the next overview
   * rebuilds; credential writes and settings changes invalidate explicitly.
   */
  async externalCredentialStatus(): Promise<ExternalCredentialStatus> {
    const now = Date.now()
    const cached = this.credentialStatusCache
    if (cached !== undefined && now - cached.at < CREDENTIAL_STATUS_TTL_MS) return cached.value
    if (this.credentialStatusInFlight !== undefined) return this.credentialStatusInFlight
    const generation = this.credentialStatusGeneration
    let pending!: Promise<ExternalCredentialStatus>
    pending = this.readExternalCredentialStatus()
      .then((value) => {
        // A credential write landed while this read was in flight: its result
        // is already stale, so it must not populate the cache.
        if (generation === this.credentialStatusGeneration) {
          const previous = this.lastCredentialStatus
          this.credentialStatusCache = { at: Date.now(), value }
          this.lastCredentialStatus = value
          if (
            previous !== undefined
            && (previous.cpamc !== value.cpamc || previous.volcanoAk !== value.volcanoAk || previous.volcanoSk !== value.volcanoSk)
          ) {
            this.bumpRevision()
          }
        }
        return value
      })
      .finally(() => {
        if (this.credentialStatusInFlight === pending) this.credentialStatusInFlight = undefined
      })
    this.credentialStatusInFlight = pending
    return pending
  }

  /** Drop the cached flags after a credential write or env-name change. */
  private invalidateCredentialStatus(): void {
    this.credentialStatusGeneration += 1
    this.credentialStatusCache = undefined
    // Do not hand a pre-write in-flight read to the next caller.
    this.credentialStatusInFlight = undefined
  }

  /** The live (uncached) credential-status read: three vault describes. */
  private async readExternalCredentialStatus(): Promise<ExternalCredentialStatus> {
    return {
      cpamc: await this.isEnvConfigured(this.options.cpamcManagementKeyEnv),
      volcanoAk: await this.isEnvConfigured(this.options.volcanoAccessKeyEnv),
      volcanoSk: await this.isEnvConfigured(this.options.volcanoSecretKeyEnv),
    }
  }

  private externalCredentialEnv(target: ExternalCredentialTarget): string {
    if (target === 'cpamc') return this.options.cpamcManagementKeyEnv
    if (target === 'volcano.ak') return this.options.volcanoAccessKeyEnv
    if (target === 'volcano.sk') return this.options.volcanoSecretKeyEnv
    throw new Error('unknown credential target')
  }

  private async isEnvConfigured(name: string): Promise<boolean> {
    const credentials = service<{ describe(ref: unknown): Promise<{ configured?: boolean } | undefined> }>(this.ctx, 'credentials')
    try {
      const info = await credentials?.describe(credentialRef(name))
      if (info?.configured === true) return true
    } catch {
      // Malformed describe reads as absent; fall through to process.env.
    }
    const value = process.env[name]
    return typeof value === 'string' && value.trim() !== ''
  }

  /** Today's ledger spend for one provider's adapter family (0 when unpriced). */
  private familyCostToday(provider: string): number {
    const family = adapterFor(provider)
    if (family === undefined) return 0
    let cost = 0
    for (const row of this.usageSummary().today.providers) {
      if (adapterFor(row.provider) === family) cost += row.totals.cost
    }
    return cost
  }

  /** Today's ledger totals for one provider route (the exact id, not the family). */
  private providerUsageToday(provider: string): UsageTokenTotals {
    const row = this.usageSummary().today.providers.find((entry) => entry.provider === provider)
    return row?.totals ?? emptyTotals()
  }

  /**
   * The display name for a route key: the LLM runtime's first, then the
   * adapter's, then the id itself — the snapshot may not exist for
   * adapter-less routes, yet the bubble still needs a legible title.
   */
  private routeDisplayName(provider: string): string {
    const route = this.listProviderRoutes().find((entry) => entry.id === provider)
    return route?.displayName || adapterFor(provider)?.displayName || provider
  }

  // ------------------------------------------------------------------
  // Session usage fold
  // ------------------------------------------------------------------

  private onSessionEvent(session: Session, event: SessionEvent): void {
    try {
      if (event.type === 'request/header') {
        const config = (event.data as { header?: { config?: { provider?: string; model?: string } } }).header?.config
        if (config?.provider !== undefined) {
          this.sessionRoutes.set(session, { provider: config.provider, model: config.model ?? '' })
          this.setCurrent({ provider: config.provider, model: config.model, source: 'live' })
        }
      } else if (event.type === 'request/context') {
        const data = event.data as { provider?: string; model?: string }
        if (data.provider !== undefined) {
          this.sessionRoutes.set(session, { provider: data.provider, model: data.model ?? '' })
          this.setCurrent({ provider: data.provider, model: data.model, source: 'live' })
        }
      } else if (event.type === 'assistant/message') {
        const usage = (event.data as { usage?: TokenUsage }).usage
        if (usage === undefined) return
        const route = this.sessionRoutes.get(session)
        if (route === undefined || route.provider === '') return
        const now = Date.now()
        foldUsage(this.ledger, now, route.provider, route.model || 'unknown', this.totalsFrom(usage, route.provider, route.model || 'unknown', now))
        this.bumpLedgerRevision()
        this.scheduleFlush()
      }
    } catch {
      // A malformed event must never break the session loop.
    }
  }

  /**
   * Follow the composer model selector (`agent-default-model`). The strip
   * must update as soon as the user picks another provider/model, not only
   * when the next request/header event lands.
   */
  private syncCurrentFromComposer(): void {
    const selected = service<{ currentSelection(): { provider?: string; model?: string } }>(this.ctx, 'agentDefaultModel')?.currentSelection()
      ?? (readEntryConfig(this.ctx, 'agent-default-model') as { provider?: string; model?: string } | undefined)
    if (selected?.provider === undefined || selected.provider === '') return
    // Same route already tracked: keep its `live` source, do not bounce it
    // back to `default` just because the composer agrees with it.
    if (this.current.provider === selected.provider && this.current.model === selected.model) return
    this.setCurrent({ provider: selected.provider, model: selected.model, source: 'default' })
  }

  /**
   * Normalize a provider TokenUsage into the ledger bucket (one call). The
   * DeepSeek official family is priced at the fold instant (its billing
   * period is time-of-day); other families stay unpriced (cost 0).
   */
  private totalsFrom(usage: TokenUsage, provider: string, model: string, atMs: number): UsageTokenTotals {
    const totals = emptyTotals()
    totals.inputTokens = usage.inputTokens
    totals.outputTokens = usage.outputTokens
    totals.cacheReadTokens = usage.cacheReadTokens ?? 0
    totals.cacheWriteTokens = usage.cacheWriteTokens ?? 0
    totals.reasoningTokens = usage.reasoningTokens ?? 0
    totals.calls = 1
    if (isDeepSeekProviderRoute(provider)) totals.cost = deepseekModelSpend(model, totals, atMs)
    return totals
  }

  // ------------------------------------------------------------------
  // Persistence
  // ------------------------------------------------------------------

  private async loadPersisted(): Promise<void> {
    try {
      const [rawLedger, rawSnapshots] = await Promise.all([
        readFile(this.ledgerPath, 'utf8').catch(() => undefined),
        readFile(this.snapshotsPath, 'utf8').catch(() => undefined),
      ])
      if (rawLedger !== undefined) await this.mergePersistedLedger(rawLedger)
      if (rawSnapshots !== undefined) this.mergePersistedSnapshots(rawSnapshots)
    } catch {
      // Corrupt or unreadable state starts fresh; the next flush rewrites it.
    } finally {
      // Only now may flushes overwrite the persisted files.
      this.loaded = true
    }
  }

  /**
   * Merge one persisted ledger file into the live document. The file is only
   * trusted after a shape check; an unreadable ledger is preserved beside the
   * live path as `<name>.corrupt-<epoch>` instead of being silently overwritten
   * by the next flush. Never throws.
   */
  private async mergePersistedLedger(raw: string): Promise<void> {
    let loaded: UsageLedgerDocument
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) throw new Error('unrecognized ledger document')
      const days = (parsed as { days?: unknown }).days
      if (typeof days !== 'object' || days === null || Array.isArray(days)) throw new Error('unrecognized ledger days')
      loaded = deserializeLedger(parsed)
    } catch {
      await this.preserveUnreadableLedger()
      return
    }
    // Merge into (never replace) the live document: folds that landed during
    // the read window must survive the load.
    for (const [dayKey, providers] of Object.entries(loaded.days)) {
      const atMs = new Date(dayKey + 'T12:00:00').getTime()
      for (const [provider, models] of Object.entries(providers)) {
        for (const [model, totals] of Object.entries(models)) {
          foldUsage(this.ledger, atMs, provider, model, totals)
        }
      }
    }
    pruneLedger(this.ledger, localDateKey(Date.now()), this.options.retainDays)
    this.lastPrune = { dayKey: localDateKey(Date.now()), retainDays: this.options.retainDays }
    // Merged (and possibly pruned) history is document-visible: a cached
    // overview assembled during the read window must be rebuilt.
    this.bumpLedgerRevision()
  }

  /**
   * Move an unreadable ledger aside so its bytes survive the next flush. A
   * locked or cross-device file falls back to a best-effort copy; preservation
   * failure must never block startup, so both failures are swallowed.
   */
  private async preserveUnreadableLedger(): Promise<void> {
    const target = `${this.ledgerPath}.corrupt-${Date.now()}`
    try {
      await rename(this.ledgerPath, target)
      return
    } catch {
      // Fall through to a copy: rename can fail for a locked source.
    }
    try {
      await copyFile(this.ledgerPath, target)
    } catch {
      // Best-effort only.
    }
  }

  private mergePersistedSnapshots(raw: string): void {
    const parsed = JSON.parse(raw) as { providers?: Record<string, ProviderSnapshotState> }
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.providers !== 'object' || parsed.providers === null) return
    let loadedSnapshots = false
    for (const [provider, snapshot] of Object.entries(parsed.providers)) {
      if (typeof snapshot === 'object' && snapshot !== null && typeof snapshot.provider === 'string') {
        this.snapshots.set(provider, snapshot)
        loadedSnapshots = true
      }
    }
    if (loadedSnapshots) this.bumpRevision()
  }

  // ------------------------------------------------------------------
  // Historical session backfill
  // ------------------------------------------------------------------

  /** Read the completion state; undefined when absent or unrecognized. */
  private async readBackfillState(): Promise<BackfillState | undefined> {
    try {
      const raw = await readFile(backfillStatePath(this.persistDir), 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
      if ((parsed as { version?: unknown }).version !== BACKFILL_STATE_VERSION) return undefined
      return parsed as BackfillState
    } catch {
      return undefined
    }
  }

  private async writeBackfillState(state: BackfillState): Promise<void> {
    try {
      const path = backfillStatePath(this.persistDir)
      await mkdir(dirname(path), { recursive: true })
      await writeJsonAtomic(path, state)
      // A fresh backfill state is health-visible immediately.
      this.healthCache = undefined
    } catch {
      // Best-effort: a state write failure only means the check may repeat.
    }
  }

  /**
   * Rebuild the ledger from prior sessions after `loadPersisted()` resolves.
   *
   * Runs only when all of these hold: the optional `ctx.sessionQuery` service
   * is present, the in-memory ledger has no usage (fresh install or data-dir
   * loss), and no `backfill.json` completion state exists yet. Anything else is
   * a normal upgrade (non-empty ledger) and simply records the state once so
   * the empty-ledger check is not repeated on every boot. Never throws.
   */
  private async maybeBackfill(startedAt: number): Promise<void> {
    try {
      const sessionQuery = service<SessionQueryLike>(this.ctx, 'sessionQuery')
      // No session-query service: nothing to read. Do not record state, so a
      // later composition that mounts the service can still recover history.
      if (sessionQuery === undefined || this.disposed) return
      const state = await this.readBackfillState()
      const hasUsage = hasLedgerUsage(this.ledger)
      if (hasUsage) {
        if (state === undefined) {
          await this.writeBackfillState({
            version: BACKFILL_STATE_VERSION,
            completedAt: Date.now(),
            cutoff: startedAt,
            sessions: 0,
            events: 0,
          })
        }
        return
      }
      if (state !== undefined) return
      const result = await collectBackfill(sessionQuery, {
        startedAt,
        retainDays: this.options.retainDays,
        shouldAbort: () => this.disposed,
      })
      if (this.disposed) return
      if (!result.ok) {
        console.warn('[dsh-usage-plus] session backfill could not read prior sessions')
        return
      }
      if (result.events > 0) {
        mergeLedgerDocuments(this.ledger, result.ledger)
        this.bumpLedgerRevision()
        // Flush immediately: the restored history must survive an early exit.
        await this.flushLedger()
      }
      await this.writeBackfillState({
        version: BACKFILL_STATE_VERSION,
        completedAt: Date.now(),
        cutoff: startedAt,
        sessions: result.sessions,
        events: result.events,
        ...(result.truncated ? { truncated: true } : {}),
      })
      console.info(`[dsh-usage-plus] session backfill: ${result.sessions} session(s), ${result.events} usage event(s)${result.truncated ? ' (truncated by caps)' : ''}`)
    } catch (error) {
      console.warn('[dsh-usage-plus] session backfill failed:', error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Arm one debounced ledger flush. The delay is the burst debounce or the
   * remaining flush floor, whichever is later, so an active session cannot
   * rewrite the full ledger document on every 3 s window. Exactly one timer is
   * ever pending; folds that land while it runs are covered by the write that
   * follows (and reschedule afterwards when the write already started).
   */
  private scheduleFlush(): void {
    if (this.flushTimer !== undefined || this.disposed) return
    const delay = nextFlushDelayMs(Date.now(), this.lastFlushAt)
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      void this.flushLedger()
    }, delay)
  }

  /**
   * Queue one ledger flush behind the previous one. Debounce and stop-time
   * flushes serialize here, so two `writeJsonAtomic` calls can never run
   * concurrently on the same path. `stop()` calls this directly, so the final
   * flush is never delayed by the floor.
   */
  private flushLedger(): Promise<void> {
    const next = this.flushChain.then(() => this.writeLedgerOnce())
    this.flushChain = next.catch(() => {})
    return next
  }

  private async writeLedgerOnce(): Promise<void> {
    // Never overwrite the persisted file before it has been loaded: a flush
    // racing the load window would otherwise clobber history with a partial
    // document.
    if (!this.loaded) return
    // Record the attempt instant (not the completion): the floor spaces write
    // starts apart even when a slow fsync lets the next timer fire meanwhile.
    this.lastFlushAt = Date.now()

    try {
      await mkdir(dirname(this.ledgerPath), { recursive: true })
      await writeJsonAtomic(this.ledgerPath, this.ledger)
      // The ledger byte size moved: let the next health read refresh it.
      this.healthCache = undefined
    } catch {
      // Persistence failures degrade silently; the in-memory ledger keeps counting.
    }
  }

  /**
   * Prune days past retention. Runs at most once per local day and whenever
   * `retainDays` shrinks — not only at startup, so long-lived processes and
   * live settings changes both honor retention.
   */
  private pruneIfNeeded(): void {
    const todayKey = localDateKey(Date.now())
    if (this.lastPrune?.dayKey === todayKey && this.lastPrune.retainDays === this.options.retainDays) return
    const pruned = pruneLedger(this.ledger, todayKey, this.options.retainDays)
    this.lastPrune = { dayKey: todayKey, retainDays: this.options.retainDays }
    if (pruned > 0) {
      // Pruned days are document-visible (windows, usage providers).
      this.bumpLedgerRevision()
      this.scheduleFlush()
    }
  }

  private async persistSnapshots(): Promise<void> {
    if (!this.loaded) return
    // Unchanged facts (a provider backing off, an idle cycle) need no write.
    const providers = Object.fromEntries(this.snapshots)
    const signature = JSON.stringify(providers)
    if (signature === this.lastPersistedSnapshots) return
    try {
      await mkdir(dirname(this.snapshotsPath), { recursive: true })
      await writeJsonAtomic(this.snapshotsPath, { version: 1, providers })
      this.lastPersistedSnapshots = signature
    } catch {
      // Same silent degradation as the ledger.
    }
  }

  // ------------------------------------------------------------------
  // Poll loop
  // ------------------------------------------------------------------

  private rearmPoll(delayMs: number): void {
    if (this.disposed) return
    if (this.pollTimer !== undefined) clearTimeout(this.pollTimer)
    this.pollTimer = setTimeout(() => {
      this.pollTimer = undefined
      // A rejected cycle must never surface as an unhandled rejection: DSH is
      // fail-loud and exits the host process on one. The cycle itself stays
      // rejecting so a manual refresh can still report the failure.
      void this.pollNow()
        .catch(() => {
          // Degrade silently, like the rest of this service; the next poll retries.
        })
        .finally(() => this.rearmPoll(Math.max(30, this.options.pollIntervalSec) * 1000))
    }, delayMs)
  }

  /**
   * One poll cycle: enumerate routes, resolve credentials, probe, announce.
   * A call while a cycle is already running joins that cycle instead of
   * returning immediately, so a manual refresh always waits for real probes.
   */
  pollNow(): Promise<void> {
    if (this.pollInFlight) return this.pollPromise ?? Promise.resolve()
    if (this.disposed) return Promise.resolve()
    this.pollInFlight = true
    const cycle = (async () => {
      try {
        this.pruneIfNeeded()
        const routes = this.listProviderRoutes()
        const seen = new Set<string>()
        // Probe in bounded-concurrency batches instead of one-by-one: a slow
        // provider (up to 2 × PROBE_TIMEOUT_MS per route) must not stretch
        // the whole cycle past the 60s default poll interval. probeRoute only
        // writes its own snapshot key, so batches can run in parallel safely.
        const probeable: Array<{ route: ProviderRoute; adapter: NonNullable<ReturnType<typeof adapterFor>> }> = []
        const now = Date.now()
        for (const route of routes) {
          // Bail out of a cycle that outlived the service.
          if (this.disposed) return
          // `seen` keeps a skipped provider's retained snapshot alive.
          seen.add(route.id)
          const adapter = adapterFor(route.id)
          if (adapter === undefined || (adapter.balance === undefined && adapter.plan === undefined)) continue
          // Skip a provider backing off after failures, except the current
          // route: its operator is watching this one and a transient failure
          // should recover at the normal cadence.
          const backoff = this.probeBackoff.get(route.id)
          if (backoff !== undefined && backoff.nextAt > now && route.id !== this.current.provider) continue
          probeable.push({ route, adapter })
        }
        const PROBE_CONCURRENCY = 3
        for (let offset = 0; offset < probeable.length; offset += PROBE_CONCURRENCY) {
          if (this.disposed) return
          const batch = probeable.slice(offset, offset + PROBE_CONCURRENCY)
          await Promise.all(batch.map(({ route, adapter }) => this.probeRoute(route, adapter)))
        }
        let droppedSnapshots = false
        for (const id of [...this.snapshots.keys()]) {
          if (!seen.has(id) && !id.startsWith('cpamc:') && !id.startsWith('volcano:') && !id.startsWith('custom:')) {
            this.snapshots.delete(id)
            droppedSnapshots = true
          }
        }
        if (droppedSnapshots) this.bumpRevision()
        await this.probeExternalSources()
        if (this.disposed) return
        await this.persistSnapshots()
        this.announceCurrent()
      } finally {
        this.pollInFlight = false
        this.pollPromise = undefined
      }
    })()
    this.pollPromise = cycle
    return cycle
  }

  /**
   * The live LLM provider routes, short-TTL cached: the registry call walks
   * config, and every overview/poll/announce reads it. A registry change is
   * document-visible (provider rows), so it bumps the revision.
   */
  private listProviderRoutes(): ProviderRoute[] {
    const now = Date.now()
    const cached = this.routesCache
    if (cached !== undefined && now - cached.at < ROUTE_CACHE_TTL_MS) return cached.routes
    const routes = this.readProviderRoutes()
    this.routesCache = { at: now, routes }
    // The first read has no document to invalidate yet; later changes do.
    if (cached !== undefined && !sameRoutes(cached.routes, routes)) this.bumpRevision()
    return routes
  }

  private readProviderRoutes(): ProviderRoute[] {
    const routes = new Map<string, string>()
    const runtime = service<{ listProviders(): Array<{ id: string; name: string }>; listConfigurableProviders(): Array<{ provider: string; displayName: string }> }>(this.ctx, 'llm')
    if (runtime !== undefined) {
      try {
        for (const provider of runtime.listProviders()) {
          if (provider.id !== '') routes.set(provider.id, provider.name)
        }
        for (const provider of runtime.listConfigurableProviders()) {
          if (!routes.has(provider.provider)) routes.set(provider.provider, provider.displayName)
        }
      } catch {
        // Registry hiccups degrade to an empty list; the next poll retries.
      }
    }
    // One provider adapter means one probe endpoint, one snapshot, one row:
    // the DeepSeek catalog key and live route must not be probed twice a cycle.
    return dedupeProviderAliasRoutes([...routes].map(([id, displayName]) => ({ id, displayName })))
  }

  private async probeRoute(route: ProviderRoute, adapter: NonNullable<ReturnType<typeof adapterFor>>): Promise<void> {
    const credential = await this.resolveCredential(route.id)
    const previous = this.snapshots.get(route.id)
    if (credential.key === undefined) {
      // Nothing to probe with (oauth grant, no credential): retained facts
      // would never refresh again, so the row resets to its credential
      // state instead of presenting stale data as current.
      const next: ProviderSnapshotState = {
        provider: route.id,
        displayName: route.displayName || adapter.displayName,
        credential: credential.kind,
        supported: true,
        updatedAt: Date.now(),
      }
      // An unchanged credential state is not a data change: keep the previous
      // object so the snapshots file, overview revision, and ETag stay put.
      if (previous !== undefined && providerSnapshotFactsEqual(previous, next)) return
      this.snapshots.set(route.id, next)
      this.bumpRevision()
      return
    }
    const snapshot: ProviderSnapshotState = {
      provider: route.id,
      displayName: route.displayName || adapter.displayName,
      credential: credential.kind,
      supported: true,
      updatedAt: Date.now(),
    }
    const runProbe = async (kind: 'balance' | 'plan'): Promise<BalanceView | PlanView | undefined> => {
      const half = adapter[kind]
      if (half === undefined) return undefined
      // An OAuth-only endpoint probed with an API key would only produce a
      // misleading 401 line; skip the half instead (supported flags follow).
      if (!probeHalfAllowed(half.credential, credential.kind)) return undefined
      try {
        const spec = half.build({
          apiKey: credential.key as string,
          ...(credential.accountId !== undefined ? { accountId: credential.accountId } : {}),
          ...(credential.refreshToken !== undefined ? { refreshToken: credential.refreshToken } : {}),
        })
        const response = await fetch(spec.url, {
          method: spec.method ?? 'GET',
          headers: spec.headers,
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        })
        const body: unknown = await response.json().catch(() => undefined)
        if (!response.ok) throw new Error(providerErrorMessage(response.status, body))
        const parsed = half.parse(response.status, body)
        if (parsed === undefined) throw new Error('unrecognized response shape')
        const updatedAt = Date.now()
        if (kind === 'balance') {
          const fact = parsed as BalanceParse
          return { currency: fact.currency, totalBalance: fact.totalBalance, updatedAt }
        }
        const plan = parsed as PlanParse
        return { planName: plan.planName, windows: plan.windows, updatedAt }
      } catch (error) {
        // Per-fact error slot: a success in the other probe half can no
        // longer clear this failure (and a stale fact always carries the
        // error line explaining why it is stale).
        const message = error instanceof Error ? error.message.slice(0, 200) : String(error)
        if (kind === 'balance') snapshot.balanceError = message
        else snapshot.planError = message
        return undefined
      }
    }
    const balance = await runProbe('balance')
    // A failed probe keeps the previous fact visible (stale but useful).
    if (balance !== undefined) snapshot.balance = balance as BalanceView
    else if (previous?.balance !== undefined) snapshot.balance = previous.balance
    const plan = await runProbe('plan')
    if (plan !== undefined) snapshot.plan = plan as PlanView
    else if (previous?.plan !== undefined) snapshot.plan = previous.plan
    if (previous !== undefined && providerSnapshotFactsEqual(previous, snapshot)) {
      // Identical facts (only the probe read stamps moved): keep the previous
      // object so the snapshot file and the revision-derived ETag stay stable.
      // Backoff still advances — a repeated failure must keep backing off.
      this.recordProbeOutcome(route.id, snapshot.balanceError !== undefined || snapshot.planError !== undefined)
      return
    }
    this.snapshots.set(route.id, snapshot)
    this.bumpRevision()
    // One half failing is enough to back this provider off; a success in
    // either half clears the counter (the other half may legitimately have
    // no adapter at all).
    this.recordProbeOutcome(route.id, snapshot.balanceError !== undefined || snapshot.planError !== undefined)
  }

  /** Advance or clear the retry backoff after one provider's probe run. */
  private recordProbeOutcome(provider: string, failed: boolean): void {
    this.probeAttemptAt = Date.now()
    if (!failed) {
      this.probeSuccessAt = this.probeAttemptAt
      this.probeBackoff.delete(provider)
      return
    }
    const failures = (this.probeBackoff.get(provider)?.failures ?? 0) + 1
    this.probeBackoff.set(provider, { failures, nextAt: Date.now() + probeBackoffDelayMs(failures) })
  }

  /**
   * Resolve the credential backing one route: pi-ai credential records
   * first, then the profile's apiKeyEnv reference, then the DeepSeek
   * official adapter's env reference. OAuth grants hand their stored access
   * token to the oauth-aware adapters (Codex plan quota); a stale token
   * fails its probe with a 401 and refreshes the next time the harness
   * itself runs that provider.
   */
  private async resolveCredential(provider: string): Promise<ResolvedCredential> {
    const credentials = service<{
      readRecord(key: unknown): Promise<{ kind: string; key?: string; env?: Record<string, string>; payload?: unknown } | undefined>
      resolve(ref: unknown): Promise<{ value: string } | undefined>
    }>(this.ctx, 'credentials')
    if (credentials === undefined) return { kind: 'none' }
    try {
      const record = await credentials.readRecord(credentialKey('llm-pi-ai', provider))
      if (record?.kind === 'api-key' && typeof record.key === 'string' && record.key !== '') {
        return { kind: 'api-key', key: record.key }
      }
      if (record?.kind === 'grant' && typeof record.payload === 'object' && record.payload !== null) {
        // pi-ai stores its OAuth credential verbatim: { type: 'oauth', access, refresh, expires, ... }.
        const payload = record.payload as Record<string, unknown>
        const access = typeof payload.access === 'string' && payload.access !== '' ? payload.access : undefined
        const refreshToken = typeof payload.refresh === 'string' && payload.refresh !== '' ? payload.refresh : undefined
        const accountId = typeof payload.chatgpt_account_id === 'string' && payload.chatgpt_account_id !== '' ? payload.chatgpt_account_id : undefined
        if (access !== undefined) {
          return {
            kind: 'oauth',
            key: access,
            ...(accountId !== undefined ? { accountId } : {}),
            ...(refreshToken !== undefined ? { refreshToken } : {}),
          }
        }
        return { kind: 'oauth' }
      }
    } catch {
      // Invalid record ids read as absent.
    }
    try {
      const profile = this.piAiProfile(provider)
      const envName = profile?.apiKeyEnv ?? (isDeepSeekProviderRoute(provider) ? this.deepseekApiKeyEnv() : undefined)
      if (typeof envName === 'string' && envName !== '') {
        const resolved = await credentials.resolve(credentialRef(envName))
        if (resolved?.value !== undefined && resolved.value !== '') return { kind: 'env', key: resolved.value }
      }
    } catch {
      // Malformed references read as absent.
    }
    return { kind: 'none' }
  }

  private async resolveEnv(name: string): Promise<string | undefined> {
    const credentials = service<{ resolve(ref: unknown): Promise<{ value: string } | undefined> }>(this.ctx, 'credentials')
    try {
      const hit = await credentials?.resolve(credentialRef(name))
      if (typeof hit?.value === 'string' && hit.value.trim() !== '') return hit.value.trim()
    } catch {}
    const value = process.env[name]
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
  }

  private async probeExternalSources(): Promise<void> {
    try {
      const rows = await probeCpamc({ enabled: this.options.cpamcEnabled, baseURL: this.options.cpamcBaseURL, managementKey: await this.resolveEnv(this.options.cpamcManagementKeyEnv), allowedHosts: this.options.cpamcAllowedHosts })
      this.replaceExternalSnapshotsChecked('cpamc', rows)
    } catch {}
    try {
      const rows = await probeVolcano({ enabled: this.options.volcanoEnabled, accessKeyId: await this.resolveEnv(this.options.volcanoAccessKeyEnv), secretAccessKey: await this.resolveEnv(this.options.volcanoSecretKeyEnv) })
      this.replaceExternalSnapshotsChecked('volcano', rows)
    } catch {}
  }

  /**
   * Replace one external source's rows, bumping the revision only when the
   * facts actually changed. A disabled/idle source and an unchanged quota
   * response must not invalidate the cached overview (and its ETag) or rewrite
   * the snapshots file every poll; the probe read timestamps are ignored for
   * this comparison.
   */
  private replaceExternalSnapshotsChecked(source: 'cpamc' | 'volcano', rows: readonly ProviderSnapshotState[]): void {
    const prefix = `${source}:`
    const existing: ProviderSnapshotState[] = []
    for (const [id, snapshot] of this.snapshots) {
      if (id.startsWith(prefix)) existing.push(snapshot)
    }
    if (existing.length === 0 && rows.length === 0) return
    const unchanged = existing.length === rows.length
      && existing.every((snapshot, index) => {
        const next = rows[index]
        return next !== undefined && providerSnapshotFactsEqual(snapshot, next)
      })
    if (unchanged) return
    replaceExternalSnapshots(this.snapshots, source, rows)
    this.bumpRevision()
  }

  /**
   * A configEditor entry snapshot, short-TTL cached. Config is part of the
   * document (the current route's baseURL), so a changed value bumps the
   * revision; the TTL keeps the config scan off the warm poll path.
   */
  private cachedEntryConfig(id: string): Record<string, unknown> | undefined {
    const now = Date.now()
    const cached = this.entryConfigCache.get(id)
    if (cached !== undefined && now - cached.at < CONFIG_CACHE_TTL_MS) return cached.config
    const config = readEntryConfig(this.ctx, id)
    this.entryConfigCache.set(id, { at: now, config })
    if (cached !== undefined && !configsEqual(cached.config, config)) this.bumpRevision()
    return config
  }

  /** The llm-pi-ai profile object for one provider route, when configured. */
  private piAiProfile(provider: string): { apiKeyEnv?: string; baseURL?: string } | undefined {
    const section = this.cachedEntryConfig('llm-pi-ai') as { providers?: Record<string, { apiKeyEnv?: string; baseURL?: string }> } | undefined
    return section?.providers?.[provider]
  }

  /** The DeepSeek official adapter's credential reference name. */
  private deepseekApiKeyEnv(): string {
    const section = this.cachedEntryConfig('llm-deepseek') as { apiKeyEnv?: string } | undefined
    return section?.apiKeyEnv ?? 'DEEPSEEK_API_KEY'
  }

  // ------------------------------------------------------------------
  // Pet bubble
  // ------------------------------------------------------------------

  /**
   * Announce the current provider's spend, balance, or plan usage to the pet.
   * In `change` mode only meaningful value changes re-announce; `off` skips.
   * The TTL rides the poll interval (bubble_mode `always` re-announces every
   * cycle, so a TTL of two cycles + margin keeps the bubble continuous
   * across polls; the pet contract caps the ceiling). A route id the
   * catalogs spell differently than the snapshot keys falls back to its
   * adapter family's snapshot. When the provider has no announceable probe
   * fact (no adapter, failing probes, percent-less windows) the bubble falls
   * back to the provider's today ledger usage, and with neither fact nor
   * usage it stays silent. Fully guarded: a malformed snapshot or a failing
   * pet service must never break the poll loop, and a disposed service never
   * announces.
   */
  private announceCurrent(): void {
    if (this.disposed || this.options.bubbleMode === 'off') return
    try {
      this.syncCurrentFromComposer()
      const provider = this.current.provider
      if (provider === undefined) return
      let snapshot = this.snapshots.get(provider)
      if (snapshot === undefined) {
        const family = adapterFor(provider)
        if (family !== undefined) {
          for (const [id, candidate] of this.snapshots) {
            if (adapterFor(id) === family) {
              snapshot = candidate
              break
            }
          }
        }
      }
      if (snapshot?.plan === undefined) {
        const baseURL = this.piAiProfile(provider)?.baseURL
        const mapped = currentPlanProvider({
          current: {
            ...this.current,
            ...(typeof baseURL === 'string' && baseURL.trim() !== '' ? { baseURL: baseURL.trim() } : {}),
          },
          providers: [...this.snapshots.values()],
        })
        if (mapped !== undefined) snapshot = mapped
      }
      const displayName = snapshot?.displayName ?? this.routeDisplayName(provider)
      let announcement = snapshot !== undefined
        ? buildAnnouncement(snapshot, {
            todayCost: this.familyCostToday(provider),
            peak: deepseekPeriodAt(Date.now()).peak,
          })
        : undefined
      // No probeable fact for the session's provider (no adapter at all,
      // failing probes, or percent-less windows): the bubble still follows
      // the provider with the one fact the ledger owns — today's usage.
      if (announcement === undefined) {
        announcement = buildLedgerAnnouncement({ displayName, totals: this.providerUsageToday(provider) })
      }
      if (announcement === undefined) return
      const signature = JSON.stringify(announcement)
      if (this.options.bubbleMode === 'change' && signature === this.lastSignature) return
      this.lastSignature = signature
      const ttlMs = Math.min(7_200_000, this.options.pollIntervalSec * 2_000 + 30_000)
      const pet = service<{ announce(input: Record<string, unknown>): void }>(this.ctx, 'pet')
      pet?.announce({ source: USAGE_ANNOUNCE_SOURCE, ttlMs, ...announcement })
    } catch {
      // A missing or failing pet service must never break the poll loop.
    }
  }
}
