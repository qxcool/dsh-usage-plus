/**
 * Resolve which provider snapshot should drive the composer plan strip.
 * Official model routes keep an exact id match; CPAMC / Volcano live under
 * synthetic ids (`cpamc:…`, `volcano:ark-plan`) and must be matched by the
 * current composer provider / model / baseURL.
 * @module dsh-usage-plus/core/plan-match
 */

import type { PlanView, PlanWindowView, ProviderSnapshotView, UsageOverviewView } from './types.ts'

/** Windows the strip and ContextMeter-style meter expose. */
const DISPLAY_KEYS = new Set(['5h', 'week', 'month'])
const WINDOW_ORDER = ['5h', 'week', 'month'] as const

/** Keep only percentage windows the UI knows how to render. */
export function planWindowsForDisplay(plan: PlanView | undefined): PlanWindowView[] {
  if (plan === undefined) return []
  return plan.windows.filter((window) => DISPLAY_KEYS.has(window.key) && window.percent !== undefined)
}

/** Stable 5h → week → month order for plan cards and the strip panel. */
export function orderedPlanWindows(plan: PlanView | undefined): PlanWindowView[] {
  const windows = planWindowsForDisplay(plan)
  return [...windows].sort((left, right) => {
    const leftIndex = WINDOW_ORDER.indexOf(left.key as typeof WINDOW_ORDER[number])
    const rightIndex = WINDOW_ORDER.indexOf(right.key as typeof WINDOW_ORDER[number])
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex)
  })
}

/** Clone a provider row with display-only windows, or undefined when empty. */
export function withDisplayPlan(provider: ProviderSnapshotView | undefined): ProviderSnapshotView | undefined {
  if (provider?.plan === undefined) return undefined
  const windows = orderedPlanWindows(provider.plan)
  if (windows.length === 0) return undefined
  return { ...provider, plan: { ...provider.plan, windows } }
}

function haystack(provider: string, model?: string, baseURL?: string): string {
  return `${provider} ${model ?? ''} ${baseURL ?? ''}`.toLowerCase()
}

/** Volcano Ark / Doubao coding-plan routes (and their control-plane hosts). */
export function looksLikeVolcano(text: string): boolean {
  return /volc|ark|doubao|byteplus|火山|volces\.com|volcengineapi\.com/.test(text)
}

/** CLI Proxy API management console / common local gateway endpoints. */
export function looksLikeCpamcGateway(text: string): boolean {
  return /cliproxy|cli[-_]?proxy|cpamc|cli\s*proxy|127\.0\.0\.1:8317|localhost:8317|\[::1\]:8317|:8317\b/.test(text)
}

/** Provider ids that commonly front CPAMC-backed Codex / Kimi / Claude accounts. */
export function looksLikeCpamcProviderId(provider: string): boolean {
  const id = provider.toLowerCase()
  return /^(openai-codex|codex|kimi-coding|kimi|anthropic|claude)\b/.test(id)
    || /cliproxy|cli[-_]?proxy|cpamc/.test(id)
}

/** Map a composer route onto one of the CPAMC account families we probe. */
export function cpamcFamily(text: string): 'codex' | 'kimi' | 'claude' | undefined {
  if (/codex|chatgpt|openai-codex|\bgpt-|\bo[1-4]\b/.test(text)) return 'codex'
  if (/kimi|moonshot/.test(text)) return 'kimi'
  if (/claude|anthropic/.test(text)) return 'claude'
  return undefined
}

/**
 * Providers that belong on the Plans tab: real windows, or external sources
 * that only carry a probe error (so the user can see why CPAMC/Volcano is empty).
 */
export function planTabProviders(providers: ProviderSnapshotView[]): ProviderSnapshotView[] {
  return providers.filter((provider) => {
    if (provider.plan !== undefined && provider.plan.windows.some((window) => window.percent !== undefined)) return true
    if ((provider.source === 'cpamc' || provider.source === 'volcano') && provider.error !== undefined) return true
    return false
  })
}

/** Locale key for the plan source chip on the strip / plan cards. */
export function planSourceLabelKey(provider: ProviderSnapshotView): 'usage.plan.source.model' | 'usage.plan.source.cpamc' | 'usage.plan.source.volcano' {
  if (provider.source === 'cpamc') return 'usage.plan.source.cpamc'
  if (provider.source === 'volcano') return 'usage.plan.source.volcano'
  return 'usage.plan.source.model'
}

/**
 * Pick the plan snapshot for the current composer model.
 * Order: exact provider id → Volcano external source → CPAMC external source.
 */
export function currentPlanProvider(
  snapshot: Pick<UsageOverviewView, 'current' | 'providers'> | null,
): ProviderSnapshotView | undefined {
  if (snapshot === null || snapshot.current.provider === undefined) return undefined
  const providers = snapshot.providers
  const exact = withDisplayPlan(providers.find((row) => row.provider === snapshot.current.provider))
  if (exact !== undefined) return exact

  const text = haystack(snapshot.current.provider, snapshot.current.model, snapshot.current.baseURL)

  if (looksLikeVolcano(text)) {
    const volcano = withDisplayPlan(providers.find((row) => row.source === 'volcano'))
    if (volcano !== undefined) return volcano
  }

  const cpamcRows = providers.filter((row) => row.source === 'cpamc' && row.plan !== undefined)
  if (cpamcRows.length === 0) return undefined

  const viaGateway = looksLikeCpamcGateway(text)
  const viaProviderId = looksLikeCpamcProviderId(snapshot.current.provider)
  if (!viaGateway && !viaProviderId) return undefined

  const family = cpamcFamily(text)
  if (family !== undefined) {
    const preferred = withDisplayPlan(cpamcRows.find((row) => row.provider.startsWith(`cpamc:${family}:`)))
    if (preferred !== undefined) return preferred
  }

  for (const row of cpamcRows) {
    const hit = withDisplayPlan(row)
    if (hit !== undefined) return hit
  }

  return undefined
}
