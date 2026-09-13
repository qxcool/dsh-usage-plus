import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import z from 'schemastery'
import { mountOnce } from './mount-once.ts'
import { UsageService, type UsageServiceOptions } from './host/usage-service.ts'
import { makeUsageOverviewRoute, makeUsageRefreshRoute } from './host/routes.ts'

export const name = 'dsh-usage-plus'
export const inject = ['webServer']
export const USAGE_SETTINGS_NAMESPACE = 'dsh-usage-plus' as SettingsNamespace

export interface Config {
  enabled?: boolean
  /** Provider probe cycle in seconds; 30-3600. */
  pollIntervalSec?: number
  /** Pet bubble mode: always (refreshes each poll), change (only on value change), off. */
  bubbleMode?: string
  /** Ledger retention in local days. */
  retainDays?: number
  cpamcEnabled?: boolean
  cpamcBaseURL?: string
  cpamcManagementKeyEnv?: string
  volcanoEnabled?: boolean
  volcanoAccessKeyEnv?: string
  volcanoSecretKeyEnv?: string
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  pollIntervalSec: z.number().min(30).max(3600).default(60),
  bubbleMode: z.string().default('always'),
  retainDays: z.number().min(7).max(730).default(180),
  cpamcEnabled: z.boolean().default(false),
  cpamcBaseURL: z.string().default('http://127.0.0.1:8317'),
  cpamcManagementKeyEnv: z.string().default('CPAMC_MANAGEMENT_KEY'),
  volcanoEnabled: z.boolean().default(false),
  volcanoAccessKeyEnv: z.string().default('VOLC_ACCESSKEY'),
  volcanoSecretKeyEnv: z.string().default('VOLC_SECRETKEY'),
})

export interface ResolvedConfig extends UsageServiceOptions {
  enabled: boolean
}

export function resolveConfig(config?: Config): ResolvedConfig {
  const bubbleMode = config?.bubbleMode === 'change' || config?.bubbleMode === 'off' ? config.bubbleMode : 'always'
  return {
    enabled: config?.enabled ?? true,
    pollIntervalSec: typeof config?.pollIntervalSec === 'number' ? config.pollIntervalSec : 60,
    bubbleMode,
    retainDays: typeof config?.retainDays === 'number' ? config.retainDays : 180,
    cpamcEnabled: config?.cpamcEnabled ?? false,
    cpamcBaseURL: config?.cpamcBaseURL ?? 'http://127.0.0.1:8317',
    cpamcManagementKeyEnv: config?.cpamcManagementKeyEnv ?? 'CPAMC_MANAGEMENT_KEY',
    volcanoEnabled: config?.volcanoEnabled ?? false,
    volcanoAccessKeyEnv: config?.volcanoAccessKeyEnv ?? 'VOLC_ACCESSKEY',
    volcanoSecretKeyEnv: config?.volcanoSecretKeyEnv ?? 'VOLC_SECRETKEY',
  }
}

export const apply = mountOnce('dsh-usage-plus', (ctx: Context, config?: Config): void => {
  let source: () => Config = () => config ?? {}
  let service: UsageService | undefined
  let pendingStop: Promise<void> | undefined
  let disposeRoutes: (() => void) | undefined

  const rearm = (): void => {
    const value = resolveConfig(source())
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
        // A disable may have landed while the predecessor's final flush was
        // still pending; only start if this instance is still the live one.
        if (service !== next) return
        next.start()
        const disposers = [makeUsageOverviewRoute(next), makeUsageRefreshRoute(next)]
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
      // Serialize the start behind a just-stopped predecessor: its final
      // ledger flush must land on disk before this instance loads the file.
      if (pendingStop !== undefined) pendingStop.then(begin, begin)
      else begin()
    } else {
      service.applyOptions(value)
    }
  }

  ctx.inject(['settings'], (settingsCtx) => {
    try {
      if (typeof settingsCtx.settings?.installSection === 'function') {
        settingsCtx.settings.installSection(ctx, USAGE_SETTINGS_NAMESPACE, Config, config ?? {}, {
          setSource: (next) => { source = next; rearm() },
          onChange: rearm,
        })
      } else if (typeof settingsCtx.settings?.register === 'function') {
        const scope = settingsCtx.settings.register(USAGE_SETTINGS_NAMESPACE, Config, { base: config ?? {} })
        source = () => scope?.get?.() ?? (config ?? {})
        scope?.watch?.(() => { rearm() })
        rearm()
      }
    } catch {
      // Defensive fallback against settings registration differences
    }
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
