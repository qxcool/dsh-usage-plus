import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { mountOnce } from './mount-once.ts'
import { UsageService, type UsageServiceOptions } from './host/usage-service.ts'
import { makeUsageClientDiagRoute, makeUsageCredentialsRoute, makeUsageDayRoute, makeUsageExportRoute, makeUsageOverviewRoute, makeUsageRefreshRoute, makeUsageTestRoute } from './host/routes.ts'

export const name = 'dsh-usage-plus'
export const inject = ['webServer', 'configEditor']

/**
 * Profile entry id declared by `cordis.patch.yml`.
 * DSH 0.1.7+ addresses configuration forms by this id (not a settings namespace).
 * @see https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/settings.md
 */
export const USAGE_ENTRY_ID = 'usage-plus'

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Volatile-only Config commit on this fiber.
     * @see vendor/loader README — Volatile configuration
     */
    'loader/volatile-update'(paths: readonly string[]): void
  }
}

/** Plain config fields (after volatile refs are read via `.get()`). */
export interface Config {
  enabled?: boolean
  /** Provider probe cycle in seconds; 30-3600. */
  pollIntervalSec?: number
  /** Pet bubble mode: always (refreshes each poll), change (only on value change), off. */
  bubbleMode?: string
  /** Ledger retention in local days. */
  retainDays?: number
  /** Master switch for threshold alerts (in-page banner + optional pet bubble). */
  alertsEnabled?: boolean
  /** Today's priced spend limit in CNY; 0 disables the daily-cost alert. */
  dailyCostLimitCny?: number
  /** Tightest official plan window percent that raises an alert; 0 disables it. */
  planAlertPercent?: number
  /**
   * Percent a longer plan window must reach before it replaces the 5-hour
   * window in the composer ring. Default 100 (only a fully used window wins).
   */
  planPromotePercent?: number
  /** Known provider balance (CNY) below which an alert is raised; 0 disables it. */
  balanceAlertCny?: number
  /** Minutes before the same alert kind/provider/window may bubble again. */
  alertCooldownMinutes?: number
  /** Read official DeepSeek platform billing for the reconcile strip (internal API). */
  platformUsageEnabled?: boolean
  /** Estimate non-DeepSeek/global cost from the models.dev price book (USD reference). */
  costEstimateEnabled?: boolean
  /** JSON array of generic custom plan sources (`[{id,name,url,...}]`); empty disables. */
  customPlans?: string
  cpamcEnabled?: boolean
  cpamcBaseURL?: string
  cpamcManagementKeyEnv?: string
  /** Comma-separated hosts allowed as CPAMC management origins beyond loopback. */
  cpamcAllowedHosts?: string
  volcanoEnabled?: boolean
  volcanoAccessKeyEnv?: string
  volcanoSecretKeyEnv?: string
}

/**
 * Cordis Config schema for the `usage-plus` profile row.
 * Every user-editable field is `.volatile()` so DSH projects it into a form
 * and keeps a live reference the plugin reads with `.get()`.
 * @see @deepseek-ai/dsh-settings README — "Forms expose only volatile fields"
 */
export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  pollIntervalSec: z.number().min(30).max(3600).default(60).volatile(),
  bubbleMode: z.string().default('always').volatile(),
  retainDays: z.number().min(7).max(730).default(182).volatile(),
  alertsEnabled: z.boolean().default(true).volatile(),
  dailyCostLimitCny: z.number().min(0).max(1_000_000_000).default(0).volatile(),
  planAlertPercent: z.number().min(0).max(100).default(0).volatile(),
  planPromotePercent: z.number().min(1).max(100).default(100).volatile(),
  balanceAlertCny: z.number().min(0).max(1_000_000_000).default(0).volatile(),
  alertCooldownMinutes: z.number().min(1).max(1440).default(60).volatile(),
  platformUsageEnabled: z.boolean().default(true).volatile(),
  costEstimateEnabled: z.boolean().default(true).volatile(),
  customPlans: z.string().default('').volatile(),
  cpamcEnabled: z.boolean().default(false).volatile(),
  cpamcBaseURL: z.string().default('http://127.0.0.1:8317').volatile(),
  cpamcManagementKeyEnv: z.string().default('CPAMC_MANAGEMENT_KEY').volatile(),
  cpamcAllowedHosts: z.string().default('').volatile(),
  volcanoEnabled: z.boolean().default(false).volatile(),
  volcanoAccessKeyEnv: z.string().default('VOLC_ACCESSKEY').volatile(),
  volcanoSecretKeyEnv: z.string().default('VOLC_SECRETKEY').volatile(),
})

export interface ResolvedConfig extends UsageServiceOptions {
  enabled: boolean
  alertsEnabled: boolean
  dailyCostLimitCny: number
  planAlertPercent: number
  planPromotePercent: number
  balanceAlertCny: number
  alertCooldownMinutes: number
  platformUsageEnabled: boolean
  costEstimateEnabled: boolean
  customPlans: string
}

/** Shared cosmokit volatile-reference brand (Cordis re-exports the type only). */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')

function isVolatileRef(value: unknown): value is { get(): unknown } {
  return typeof value === 'object' && value !== null && VOLATILE_WRITE in value
}

/**
 * Snapshot loader Config (volatile refs or plain values) into a plain partial.
 * Presence-only: a ref currently holding `undefined` is dropped.
 */
export function plainConfigInput(input: Record<string, unknown> = {}): Config {
  const plain: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    const resolved = isVolatileRef(value) ? value.get() : value
    if (resolved !== undefined) plain[key] = resolved
  }
  return plain as Config
}

/** Validate and normalize entry config for the usage service. */
export function resolveConfig(input?: Record<string, unknown> | Config): ResolvedConfig {
  const config = plainConfigInput((input ?? {}) as Record<string, unknown>)
  const bubbleMode = config.bubbleMode === 'change' || config.bubbleMode === 'off' ? config.bubbleMode : 'always'
  return {
    enabled: config.enabled ?? true,
    pollIntervalSec: typeof config.pollIntervalSec === 'number' ? config.pollIntervalSec : 60,
    bubbleMode,
    retainDays: typeof config.retainDays === 'number' ? config.retainDays : 182,
    alertsEnabled: config.alertsEnabled ?? true,
    dailyCostLimitCny: typeof config.dailyCostLimitCny === 'number' ? config.dailyCostLimitCny : 0,
    planAlertPercent: typeof config.planAlertPercent === 'number' ? config.planAlertPercent : 0,
    planPromotePercent: typeof config.planPromotePercent === 'number' ? config.planPromotePercent : 100,
    balanceAlertCny: typeof config.balanceAlertCny === 'number' ? config.balanceAlertCny : 0,
    alertCooldownMinutes: typeof config.alertCooldownMinutes === 'number' ? config.alertCooldownMinutes : 60,
    platformUsageEnabled: config.platformUsageEnabled ?? true,
    costEstimateEnabled: config.costEstimateEnabled ?? true,
    customPlans: typeof config.customPlans === 'string' ? config.customPlans : '',
    cpamcEnabled: config.cpamcEnabled ?? false,
    cpamcBaseURL: config.cpamcBaseURL ?? 'http://127.0.0.1:8317',
    cpamcManagementKeyEnv: config.cpamcManagementKeyEnv ?? 'CPAMC_MANAGEMENT_KEY',
    cpamcAllowedHosts: config.cpamcAllowedHosts ?? '',
    volcanoEnabled: config.volcanoEnabled ?? false,
    volcanoAccessKeyEnv: config.volcanoAccessKeyEnv ?? 'VOLC_ACCESSKEY',
    volcanoSecretKeyEnv: config.volcanoSecretKeyEnv ?? 'VOLC_SECRETKEY',
  }
}

export const apply = mountOnce('dsh-usage-plus', (ctx: Context, input: Record<string, unknown> = {}): void => {
  let service: UsageService | undefined
  let pendingStop: Promise<void> | undefined
  let disposeRoutes: (() => void) | undefined
  let appliedSignature = JSON.stringify(plainConfigInput(input))

  const rearm = (): void => {
    const signature = JSON.stringify(plainConfigInput(input))
    // loader/volatile-update and describe-driven document-updated can re-fire
    // without a value change; skip no-ops so we do not bounce the poll loop.
    if (service !== undefined && signature === appliedSignature) return
    appliedSignature = signature
    const value = resolveConfig(input)
    if (!value.enabled) {
      pendingStop = service?.stop()
      service = undefined
      disposeRoutes?.()
      disposeRoutes = undefined
      return
    }
    if (service === undefined) {
      const next = new UsageService(ctx, value)
      service = next
      const begin = (): void => {
        if (service !== next) return
        next.start()
        const disposers = [makeUsageOverviewRoute(next), makeUsageRefreshRoute(next), makeUsageCredentialsRoute(next), makeUsageExportRoute(next), makeUsageTestRoute(next), makeUsageDayRoute(next), makeUsageClientDiagRoute()]
          .map((route) => ctx.webServer.register(route))
        disposeRoutes = () => {
          for (const dispose of disposers) {
            try {
              dispose()
            } catch {
              // Route fiber already gone during shutdown.
            }
          }
        }
      }
      if (pendingStop !== undefined) pendingStop.then(begin, begin)
      else begin()
    } else {
      service.applyOptions(value)
    }
  }

  // Custom Plugins page → disable auto-generated schema page for this fiber.
  // @see @deepseek-ai/dsh-settings README — configure({ auto: false }, owner)
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.effect(
      () => settingsCtx.settings.configure({ auto: false }, ctx.fiber),
      'dsh-usage-plus: page policy',
    )
  })

  // Volatile-only Config edits keep the fiber and emit loader/volatile-update
  // with changed paths; re-snapshot refs and apply.
  // @see vendor/loader README — Volatile configuration
  ctx.on('loader/volatile-update', () => {
    rearm()
  })

  ctx.effect(() => {
    rearm()
    return () => {
      disposeRoutes?.()
      void service?.stop()
      service = undefined
    }
  }, 'dsh-usage-plus: runtime')
})
