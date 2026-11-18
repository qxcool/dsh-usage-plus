/**
 * Deterministic synthetic `UsageOverviewView` for the local visual preview
 * harness. Mirrors `src/core/types.ts` exactly so the real
 * `UsageSectionCard` / `PlanUsageStrip` render without a DSH host.
 *
 * Two variants:
 *   - `rich` (default): 3 providers (opencode-go current with 5h/week/month
 *     plan windows, deepseek with a CNY balance, kimi-coding with week/month
 *     windows), 182 ascending daily rows. Recent 2-3 weeks are dense, the
 *     older history thins out to isolated days with a deliberate 2-day outage,
 *     and the daily provider mix rotates so the trend card is not uniform.
 *   - `sparse`: a single unpriced provider with no plan windows at all, so the
 *     empty states render (quota card, plans tab, heatmap, balance inline).
 *
 * Everything is seeded, so two runs render identical pixels — except
 * `updatedAt`, which is wall-clock (the section's freshness dot compares it
 * with `Date.now()`; see `FixtureOptions.updatedAgoMs`).
 */
import type {
  ProviderSnapshotView,
  UsageAlert,
  UsageCostEstimate,
  UsageDaySummary,
  UsageHealth,
  UsageOverviewView,
  UsagePlatformView,
  UsageProviderSummary,
  UsageTokenTotals,
  UsageWindowSummary,
} from '../../src/core/types.ts'

const DAY_MS = 86_400_000

interface ModelSpec {
  model: string
  share: number
}

interface ProviderSpec {
  provider: string
  share: number
  models: ModelSpec[]
  /** Only the official DeepSeek route is priced (CNY); others stay 0 = unpriced. */
  priced: boolean
}

const PROVIDER_SPECS: ProviderSpec[] = [
  {
    provider: 'opencode-go',
    share: 0.78,
    models: [
      { model: 'claude-sonnet-4.5', share: 0.52 },
      { model: 'gpt-5.1-codex', share: 0.31 },
      { model: 'glm-4.6', share: 0.17 },
    ],
    priced: false,
  },
  {
    provider: 'deepseek',
    share: 0.17,
    models: [
      { model: 'deepseek-v4.1-flash', share: 0.72 },
      { model: 'deepseek-v4.1', share: 0.28 },
    ],
    priced: true,
  },
  {
    provider: 'kimi-coding',
    share: 0.05,
    models: [{ model: 'kimi-k2-0905', share: 1 }],
    priced: false,
  },
]

/**
 * Per-day provider mixes by token share, so some days are clearly
 * opencode-go-shaped and others lean DeepSeek or Kimi. Picked by roll.
 */
const PROVIDER_MIXES: Array<{ chance: number; weights: number[] }> = [
  { chance: 0.68, weights: [0.86, 0.11, 0.03] },
  { chance: 0.22, weights: [0.38, 0.56, 0.06] },
  { chance: 0.1, weights: [0.18, 0.12, 0.7] },
]

const DISPLAY_NAMES: Record<string, string> = {
  'opencode-go': 'OpenCode Go',
  deepseek: 'DeepSeek',
  'kimi-coding': 'Kimi Coding',
}

type Rng = () => number

/** Small deterministic LCG so the fixture never depends on Math.random. */
function makeRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function round(value: number): number {
  return Math.round(value)
}

function localKey(at: Date): string {
  const year = at.getFullYear()
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const day = String(at.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function zeroTotals(): UsageTokenTotals {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, calls: 0, cost: 0 }
}

function addInto(target: UsageTokenTotals, source: UsageTokenTotals): UsageTokenTotals {
  target.inputTokens += source.inputTokens
  target.outputTokens += source.outputTokens
  target.cacheReadTokens += source.cacheReadTokens
  target.cacheWriteTokens += source.cacheWriteTokens
  target.reasoningTokens += source.reasoningTokens
  target.calls += source.calls
  target.cost += source.cost
  return target
}

function totalOf(totals: UsageTokenTotals): number {
  return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens
}

/** Lazily-created accumulator for one provider key. */
function bucketFor(map: Map<string, UsageTokenTotals>, key: string): UsageTokenTotals {
  const existing = map.get(key)
  if (existing !== undefined) return existing
  const created = zeroTotals()
  map.set(key, created)
  return created
}

/**
 * How busy one day was, indexed from today (0 = today). The last two weeks are
 * dense, the rest decays hard, weekends dip, and a seeded share of older days
 * is empty — plus two forced consecutive idle days inside the last fortnight
 * so the heatmap has a visible gap rather than a uniform wall of cells.
 */
function dayActivity(ageDays: number, weekend: boolean, rng: Rng): number {
  if (ageDays === 9 || ageDays === 10) return 0
  let heat: number
  if (ageDays < 14) heat = 1.45
  else if (ageDays < 30) heat = 1
  else if (ageDays < 60) heat = 0.4
  else if (ageDays < 120) heat = 0.14
  else heat = 0.05
  heat *= 0.62 + rng() * 0.76
  if (weekend) heat *= 0.62
  const idleChance = ageDays < 14 ? 0 : ageDays < 30 ? 0.1 : ageDays < 60 ? 0.38 : ageDays < 120 ? 0.62 : 0.78
  if (rng() < idleChance) return 0
  // A rare one-off spike in old history: an isolated hot cell, not a trend.
  if (ageDays > 90 && rng() < 0.08) heat *= 10
  return heat
}

function pickMix(rng: Rng): number[] {
  let roll = rng()
  for (const mix of PROVIDER_MIXES) {
    if (roll < mix.chance) return mix.weights
    roll -= mix.chance
  }
  return PROVIDER_MIXES[0]!.weights
}

/** Split one day/provider token total into the four disjoint buckets. */
function bucketTotals(total: number, rng: Rng): UsageTokenTotals {
  const cacheShare = 0.84 + rng() * 0.04
  const inputShare = 0.075 + rng() * 0.015
  const writeShare = 0.004 + rng() * 0.002
  const cacheReadTokens = round(total * cacheShare)
  const inputTokens = round(total * inputShare)
  const cacheWriteTokens = round(total * writeShare)
  const outputTokens = Math.max(0, total - cacheReadTokens - inputTokens - cacheWriteTokens)
  const calls = Math.max(1, round(total / 185_000))
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reasoningTokens: round(outputTokens * 0.22),
    calls,
    cost: 0,
  }
}

/** DeepSeek flash-class spend estimate in CNY (the only priced route). */
function deepseekCost(totals: UsageTokenTotals): number {
  const spend = (totals.cacheReadTokens * 0.04
    + (totals.inputTokens + totals.cacheWriteTokens) * 2
    + totals.outputTokens * 8) / 1_000_000
  return Math.round(spend * 100) / 100
}

function splitByModel(totals: UsageTokenTotals, spec: ProviderSpec): Array<{ model: string; totals: UsageTokenTotals }> {
  const rows: Array<{ model: string; totals: UsageTokenTotals }> = []
  const assigned = zeroTotals()
  spec.models.forEach((model, index) => {
    const last = index === spec.models.length - 1
    const scale = last ? 1 : model.share
    const part: UsageTokenTotals = last
      ? {
          inputTokens: totals.inputTokens - assigned.inputTokens,
          outputTokens: totals.outputTokens - assigned.outputTokens,
          cacheReadTokens: totals.cacheReadTokens - assigned.cacheReadTokens,
          cacheWriteTokens: totals.cacheWriteTokens - assigned.cacheWriteTokens,
          reasoningTokens: totals.reasoningTokens - assigned.reasoningTokens,
          calls: totals.calls - assigned.calls,
          cost: Math.round((totals.cost - assigned.cost) * 100) / 100,
        }
      : {
          inputTokens: round(totals.inputTokens * scale),
          outputTokens: round(totals.outputTokens * scale),
          cacheReadTokens: round(totals.cacheReadTokens * scale),
          cacheWriteTokens: round(totals.cacheWriteTokens * scale),
          reasoningTokens: round(totals.reasoningTokens * scale),
          calls: round(totals.calls * scale),
          cost: Math.round(totals.cost * scale * 100) / 100,
        }
    addInto(assigned, part)
    rows.push({ model: model.model, totals: part })
  })
  return rows.sort((left, right) => totalOf(right.totals) - totalOf(left.totals))
}

function providerSummary(spec: ProviderSpec, totals: UsageTokenTotals): UsageProviderSummary {
  return { provider: spec.provider, totals, models: splitByModel(totals, spec) }
}

function windowSummary(from: string, to: string, specs: ProviderSpec[], perProvider: Map<string, UsageTokenTotals>): UsageWindowSummary {
  const providers = specs.map((spec) => providerSummary(spec, perProvider.get(spec.provider) ?? zeroTotals()))
  const totals = providers.reduce((acc, row) => addInto(acc, row.totals), zeroTotals())
  return { from, to, totals, providers }
}

/** Plan windows for the current route: 5h near two thirds, week warning, month fresh. */
function planProviders(now: number): ProviderSnapshotView[] {
  const stamp = now - 90_000
  // Reset instants are wall-clock: the UI prints relative copy ("2 小时后重置"),
  // so anchoring them to the pinned `now` would read "即将重置" forever once the
  // pinned date is in the past.
  const resetBase = Date.now()
  const at = (offsetMs: number): string => new Date(resetBase + offsetMs).toISOString()
  return [
    {
      provider: 'opencode-go',
      displayName: DISPLAY_NAMES['opencode-go']!,
      credential: 'api-key',
      supported: true,
      balanceSupported: false,
      planSupported: true,
      plan: {
        planName: 'Go 20',
        // Deliberately unsorted: the UI must order 5h -> week -> month itself.
        windows: [
          { key: 'month', percent: 18.4, resetsAt: at(17 * DAY_MS) },
          { key: '5h', percent: 63.5, resetsAt: at(2 * 3_600_000 + 24 * 60_000) },
          { key: 'week', percent: 78.2, resetsAt: at(3 * DAY_MS + 5 * 3_600_000) },
        ],
        updatedAt: stamp,
      },
      updatedAt: stamp,
    },
    {
      provider: 'deepseek',
      displayName: DISPLAY_NAMES.deepseek!,
      credential: 'api-key',
      supported: true,
      balanceSupported: true,
      balance: { currency: 'CNY', totalBalance: '23.17', updatedAt: stamp },
      updatedAt: stamp,
    },
    {
      provider: 'kimi-coding',
      displayName: DISPLAY_NAMES['kimi-coding']!,
      credential: 'oauth',
      supported: true,
      balanceSupported: false,
      planSupported: true,
      plan: {
        windows: [
          { key: 'week', percent: 46, resetsAt: at(4 * DAY_MS) },
          { key: 'month', percent: 22.5, resetsAt: at(19 * DAY_MS) },
        ],
        updatedAt: stamp,
      },
      updatedAt: stamp,
    },
  ]
}

/** The single-provider, no-plan-windows state (empty quota/plans/balance UI). */
function sparseProviders(now: number): ProviderSnapshotView[] {
  const stamp = now - 90_000
  return [
    {
      provider: 'deepseek',
      displayName: DISPLAY_NAMES.deepseek!,
      credential: 'api-key',
      supported: true,
      balanceSupported: true,
      planSupported: false,
      balance: { currency: 'CNY', totalBalance: '4.62', updatedAt: stamp },
      updatedAt: stamp,
    },
  ]
}

export interface FixtureOptions {
  /** How many daily rows to synthesize (ascending, today last). */
  days?: number
  seed?: number
  /** Fixed "now" so screenshots are reproducible across runs. */
  now?: number
  /** `rich` (3 providers, plan windows, 182 days) or `sparse` (one bare provider). */
  variant?: 'rich' | 'sparse'
  /**
   * Age of the document timestamp in ms. Left at 8 s so the section's
   * freshness dot (`Date.now() - updatedAt < 30 s`) renders as live in
   * screenshots; pass a value over 30 s to exercise the stale state.
   * Charts and day rows stay anchored to `now`, so only the header time moves.
   */
  updatedAgoMs?: number
  /** Render the v0.5.0 threshold alerts; defaults to on for `rich`, off for `sparse`. */
  alerts?: boolean
  /** Composer ring promotion threshold for a longer plan window; default 100. */
  planPromotePercent?: number
  /** Custom quota sources: `ready` (two probed plans), `errors` (config rejected). */
  customPlans?: 'none' | 'ready' | 'errors'
  /**
   * Data-health fixture: `ready` (clean), `warning` (truncated backfill, a
   * failing probe and a preserved corrupt file) or `missing` (older Host that
   * omits `overview.health`).
   */
  health?: 'ready' | 'warning' | 'missing'
  /** Official platform reconcile fixture. Defaults to `ready` for `rich`. */
  platform?: 'ready' | 'error' | 'unavailable' | 'none'
  /** USD reference estimate fixture. Defaults to `priced` for `rich`. */
  costEstimate?: 'priced' | 'unpriced' | 'none'
}

/** Build the whole overview the section and the strip both consume. */
export function buildOverview(options: FixtureOptions = {}): UsageOverviewView {
  const variant = options.variant ?? 'rich'
  const days = options.days ?? 182
  const seed = options.seed ?? 20261108
  const now = options.now ?? Date.now()
  const updatedAgoMs = options.updatedAgoMs ?? 8_000
  const rng = makeRng(seed)
  const specs = variant === 'sparse' ? PROVIDER_SPECS.slice(1, 2) : PROVIDER_SPECS

  const today = new Date(now)
  const dayRows: UsageDaySummary[] = []
  const perProviderAll = new Map<string, UsageTokenTotals>()
  const perProviderRange = new Map<string, UsageTokenTotals>()
  const perProviderToday = new Map<string, UsageTokenTotals>()
  const dateKeys: string[] = []

  for (let index = 0; index < days; index += 1) {
    const ageDays = days - 1 - index
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ageDays)
    const key = localKey(date)
    const weekday = date.getDay()
    const activity = variant === 'sparse'
      ? (ageDays === 0 ? 0.5 : ageDays === 2 ? 0.12 : ageDays === 5 ? 0.06 : 0)
      : dayActivity(ageDays, weekday === 0 || weekday === 6, rng)
    const dayTotalTokens = round(activity * (34_000_000 + rng() * 14_000_000))
    const mix = variant === 'sparse' ? [1] : pickMix(rng)

    const dayTotals = zeroTotals()
    specs.forEach((spec, specIndex) => {
      const jitter = 0.88 + rng() * 0.24
      const tokens = dayTotalTokens === 0 ? 0 : round(dayTotalTokens * (mix[specIndex] ?? 0) * jitter)
      const totals = tokens === 0 ? zeroTotals() : bucketTotals(tokens, rng)
      if (spec.priced) totals.cost = deepseekCost(totals)
      addInto(dayTotals, totals)
      if (tokens > 0) {
        addInto(bucketFor(perProviderAll, spec.provider), totals)
        if (ageDays < 30) addInto(bucketFor(perProviderRange, spec.provider), totals)
        if (ageDays === 0) addInto(bucketFor(perProviderToday, spec.provider), totals)
      }
    })
    dayRows.push({ date: key, totals: dayTotals })
    dateKeys.push(key)
  }

  const todayRows = specs
    .map((spec) => providerSummary(spec, perProviderToday.get(spec.provider) ?? zeroTotals()))
    .filter((row) => row.totals.calls > 0)
    .sort((left, right) => totalOf(right.totals) - totalOf(left.totals))
  const todayTotals = todayRows.reduce((acc, row) => addInto(acc, row.totals), zeroTotals())

  const rangeFrom = dateKeys[Math.max(0, dateKeys.length - 30)]!
  const allFrom = dateKeys[0]!
  const todayKey = dateKeys[dateKeys.length - 1]!

  const showAlerts = options.alerts ?? variant !== 'sparse'
  const alerts: UsageAlert[] = showAlerts
    ? [
      {
        kind: 'daily-cost',
        severity: 'critical',
        value: 12.4,
        threshold: 10,
        since: now - 35 * 60_000,
        message: "Today's spend ¥12.40 reached the ¥10.00 limit",
      },
      {
        kind: 'plan-threshold',
        severity: 'warning',
        provider: 'opencode-go',
        window: 'week',
        value: 78,
        threshold: 70,
        since: now - 2 * 60 * 60_000,
        message: 'opencode-go week at 78% (threshold 70%)',
      },
      {
        kind: 'balance-low',
        severity: 'warning',
        provider: 'deepseek',
        value: 23.17,
        threshold: 50,
        since: now - 6 * 60 * 60_000,
        message: 'deepseek balance ¥23.17 below ¥50.00',
      },
    ]
    : []

  const healthMode = options.health ?? 'ready'
  // Health freshness is relative to render time (like `updatedAt`), not the
  // synthetic chart anchor, so relative labels stay truthful in screenshots.
  const wallNow = Date.now()
  const activeDays = dayRows.filter((row) => totalOf(row.totals) > 0).length
  const health: UsageHealth | undefined = healthMode === 'missing'
    ? undefined
    : {
      storage: {
        label: '~/.dsh/dsh-usage-plus',
        bytes: 2_411_724,
        activeDays,
        firstDay: dateKeys[0] ?? null,
        lastDay: todayKey,
        retentionDays: days,
        corruptFiles: healthMode === 'warning' ? ['usage.json.corrupt-1763000000'] : [],
      },
      backfill: {
        completedAt: wallNow - 3 * 60 * 60_000,
        cutoff: wallNow - 180 * DAY_MS,
        sessions: 128,
        events: 8_412,
        ...(healthMode === 'warning' ? { truncated: true } : {}),
      },
      probes: {
        lastAttemptAt: wallNow - 20_000,
        lastSuccessAt: wallNow - 25_000,
        failing: healthMode === 'warning' ? ['kimi-coding'] : [],
      },
    }

  const platformMode = options.platform ?? (variant === 'rich' ? 'ready' : 'none')
  const platform: UsagePlatformView | undefined = platformMode === 'none' || platformMode === 'unavailable'
    ? (platformMode === 'unavailable' ? { status: 'unavailable', currency: 'CNY', updatedAt: wallNow } : undefined)
    : platformMode === 'error'
      ? {
        status: 'error',
        currency: 'CNY',
        updatedAt: wallNow,
        error: 'platform API returned 401 (re-login in DeepSeek web)',
      }
      : {
        status: 'ready',
        currency: 'CNY',
        monthCost: 128.42,
        cumulativeCost: 1_842.9,
        localMonthCost: 119.87,
        coverage: 0.86,
        delta: 8.55,
        days: dateKeys.slice(-30).map((date, index) => ({ date, cost: (index + 1) * 0.42 })),
        updatedAt: wallNow - 60_000,
      }

  const estimateMode = options.costEstimate ?? (variant === 'rich' ? 'priced' : 'none')
  const costEstimate: UsageCostEstimate | undefined = estimateMode === 'none'
    ? undefined
    : {
      currency: 'USD',
      source: 'models.dev',
      priceBookUpdatedAt: wallNow - 3_600_000,
      totalCalls: estimateMode === 'priced' ? 6_270 : 6_270,
      totalModels: 15,
      ...(estimateMode === 'priced'
        ? { amount: 0.42, pricedCalls: 6_234, pricedModels: 12 }
        : { pricedCalls: 0, pricedModels: 0 }),
    }

  const customPlanErrors = options.customPlans === 'errors'
    ? [{ index: 0, id: 'bad-plan', field: 'url', message: 'url must be an absolute https URL (http is allowed for loopback only)' }]
    : []
  const baseProviders = variant === 'sparse' ? sparseProviders(now) : planProviders(now)
  const customProviders: ProviderSnapshotView[] = options.customPlans === 'ready'
    ? [
        {
          provider: 'custom:my-plan',
          source: 'custom',
          displayName: '内部额度网关',
          credential: 'env',
          supported: true,
          planSupported: true,
          plan: { windows: [{ key: '5h', percent: 41, resetsAt: new Date(Date.now() + 3_600_000).toISOString() }, { key: 'week', percent: 68 }], updatedAt: now - 120_000 },
          updatedAt: now - 120_000,
        },
        {
          provider: 'custom:lite-plan',
          source: 'custom',
          displayName: 'Lite Plan',
          credential: 'env',
          supported: true,
          planSupported: true,
          error: 'custom plan rejected the request (401/403)',
          updatedAt: now - 120_000,
        },
      ]
    : []
  return {
    // Wall-clock on purpose: the header freshness dot is relative to render time.
    updatedAt: Date.now() - updatedAgoMs,
    current: variant === 'sparse'
      ? { provider: 'deepseek', model: 'deepseek-v4.1-flash', source: 'default' }
      : { provider: 'opencode-go', model: 'claude-sonnet-4.5', source: 'live' },
    providers: [...baseProviders, ...customProviders],
    externalCredentials: variant === 'sparse'
      ? { cpamc: false, volcanoAk: false, volcanoSk: false }
      : { cpamc: true, volcanoAk: false, volcanoSk: false },
    ...(alerts.length > 0 ? { alerts } : {}),
    ...(health === undefined ? {} : { health }),
    ...(platform === undefined ? {} : { platform }),
    ...(costEstimate === undefined ? {} : { costEstimate }),
    ...(customPlanErrors.length > 0 ? { customPlanErrors } : {}),
    planPromotePercent: options.planPromotePercent ?? 100,
    usage: {
      today: { date: todayKey, totals: todayTotals, providers: todayRows },
      days: dayRows,
      range: windowSummary(rangeFrom, todayKey, specs, perProviderRange),
      all: windowSummary(allFrom, todayKey, specs, perProviderAll),
    },
  }
}
