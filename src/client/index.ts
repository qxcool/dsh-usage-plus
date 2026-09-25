/**
 * dsh-usage browser half — Plugins page (plugins.item) over the `usage-plus`
 * profile entry, plus the composer plan strip. Config reads/writes go through
 * `ctx.configForms` (DSH 0.1.7+); probing stays on the host.
 * @module dsh-usage-plus/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { createUsageStore, type UsageStoreInstance } from './usage-store.ts'
import { UsageSectionCard, type UsageConfigForm, type UsageSectionFace, type UsageSettings } from './UsageSectionCard.tsx'
import { PlanUsageStrip, reportDiag, type PlanUsageStripProps } from './PlanUsageStrip.tsx'
import { NS, en, zh } from './locales.ts'
import type { ExternalCredentialTarget, UsageOverviewView } from '../core/types.ts'

/**
 * Must match `USAGE_ENTRY_ID` / cordis.patch.yml `id: usage-plus`.
 * Host and client bundles compile separately, so this literal is duplicated.
 */
export const USAGE_ENTRY_ID = 'usage-plus'

/** The host usage API as the browser sees it (same-origin JSON endpoints). */
interface UsageHttpApi {
  overview(): Promise<UsageOverviewView>
  refresh(): Promise<UsageOverviewView>
  setCredential(target: ExternalCredentialTarget, value: string): Promise<UsageOverviewView>
  clearCredential(target: ExternalCredentialTarget): Promise<UsageOverviewView>
}

/** Hard ceiling for one usage API call; a stalled host must not pile up requests. */
const USAGE_FETCH_TIMEOUT_MS = 20_000

/** Plugins-page order among official / third-party item cards. */
const PAGE_ORDER = 40

async function usageFetch<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    ...(body !== undefined
      ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
    signal: AbortSignal.timeout(USAGE_FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error('usage ' + path + ' failed: ' + response.status)
  return (await response.json()) as T
}

async function credentialMutation(action: 'set' | 'clear', target: ExternalCredentialTarget, value?: string): Promise<UsageOverviewView> {
  const payload = await usageFetch<{ ok: boolean; overview?: UsageOverviewView }>(
    '/api/dsh-usage-plus/credentials',
    'POST',
    action === 'set' ? { action, target, value } : { action, target },
  )
  if (!payload.ok || payload.overview === undefined) throw new Error('usage credential mutation failed')
  return payload.overview
}

const usageApi: UsageHttpApi = {
  overview: () => usageFetch('/api/dsh-usage-plus/overview', 'GET'),
  refresh: () => usageFetch('/api/dsh-usage-plus/refresh', 'POST'),
  setCredential: (target, value) => credentialMutation('set', target, value),
  clearCredential: (target) => credentialMutation('clear', target),
}

/**
 * Required services.
 * configForms: Host entry forms keyed by profile entry id
 * (@see @deepseek-ai/dsh-client-ui-settings README).
 */
export const inject = ['slots', 'locale', 'connection', 'remote', 'configForms']

export type { UsageSectionProps, UsageSectionFace } from './UsageSectionCard.tsx'
export type { UsageUiState } from './usage-store.ts'
export type { UsageSettings }

// Fallback SlotMap rows when conversation package types are unavailable
// in the standalone SDK dependency set.
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * Composer bottom dock — below the input card, beside official StatsPills
     * and ContextMeter (DSH 0.1.7+ moved context/usage chrome here).
     */
    'conversation.composer.dock': {
      kind: 'list'
      scope: 'session'
    }
    /**
     * Official / third-party configuration page on the Plugins sidebar.
     * @see @deepseek-ai/dsh-client-ui-plugin-manager README — Configuration pages
     */
    'plugins.item': {
      kind: 'list'
      scope: 'root'
    }
  }
}

/**
 * Client plugin body: register dictionaries, the Plugins-page card (while the
 * Host serves `usage-plus`), and the composer plan strip.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    try {
      return ctx.locale.register(NS, { zh, en })
    } catch {
      return () => {}
    }
  }, 'dsh-usage-plus: dictionaries')

  // Shared form for the usage-plus profile entry (revision-fenced writes).
  const settingsForm = ctx.configForms.get(USAGE_ENTRY_ID) as UsageConfigForm

  const store: UsageStoreInstance = createUsageStore().create()

  let pollSeq = 0
  const poll = (): void => {
    const seq = pollSeq + 1
    pollSeq = seq
    usageApi.overview().then((snapshot) => {
      if (seq !== pollSeq) return
      store.actions.setSnapshot(snapshot)
    }, (error: unknown) => {
      if (seq !== pollSeq) return
      store.actions.setState('error', error instanceof Error ? error.message : String(error))
    })
  }
  const refresh = (): void => {
    const seq = pollSeq + 1
    pollSeq = seq
    usageApi.refresh().then((snapshot) => {
      pollSeq = seq
      store.actions.setSnapshot(snapshot)
    }, (error: unknown) => {
      if (seq !== pollSeq) return
      store.actions.setState('error', error instanceof Error ? error.message : String(error))
    })
  }

  const applyOverview = (snapshot: UsageOverviewView): void => {
    pollSeq += 1
    store.actions.setSnapshot(snapshot)
  }

  const setCredential = async (target: Parameters<UsageHttpApi['setCredential']>[0], value: string): Promise<void> => {
    applyOverview(await usageApi.setCredential(target, value))
  }

  const clearCredential = async (target: Parameters<UsageHttpApi['clearCredential']>[0]): Promise<void> => {
    applyOverview(await usageApi.clearCredential(target))
  }

  const face = (): UsageSectionFace => ({
    store,
    poll,
    refresh,
    settings: settingsForm,
    setCredential,
    clearCredential,
  })

  // Register the configuration page only while the Host serves this entry.
  // @see @deepseek-ai/dsh-client-ui-settings README — whileServed
  // @see @deepseek-ai/dsh-client-ui-plugin-manager README — plugins.item
  ctx.effect(() => ctx.configForms.whileServed([USAGE_ENTRY_ID], () => {
    try {
      return ctx.slots.inject('plugins.item', () => {
        try {
          const unregister = ctx.slots.register({
            name: 'plugins.item',
            id: USAGE_ENTRY_ID,
            order: PAGE_ORDER,
            label: () => ctx.locale.bind(NS)('usage.title'),
            locale: NS,
            inject: face,
          }, UsageSectionCard)
          return () => {
            unregister()
          }
        } catch (error) {
          console.error('[dsh-usage-plus] plugins.item registration failed:', error)
          return () => {}
        }
      })
    } catch (error) {
      console.error('[dsh-usage-plus] plugins.item inject failed:', error)
      return () => {}
    }
  }), 'dsh-usage-plus: plugins page')

  // Plan quota ring on the composer bottom dock (same row as official
  // StatsPills + ContextMeter). Do not seat on conversation.input.right —
  // that trailing seat is for model/send chrome and hides while activity runs.
  ctx.slots.inject('conversation.composer.dock', () => {
    try {
      const unregister = ctx.slots.register({
        name: 'conversation.composer.dock',
        id: 'dsh-usage-plus-plan-strip',
        // After chat StatsPills (order 0), before the built-in ContextMeter.
        order: 10,
        inject: (): PlanUsageStripProps => ({ store, poll }),
      }, PlanUsageStrip)
      console.info('[dsh-usage-plus] plan strip registered on conversation.composer.dock')
      reportDiag('registered', 'conversation.composer.dock')
      return () => {
        console.info('[dsh-usage-plus] plan strip unregistered from conversation.composer.dock')
        unregister()
      }
    } catch (error) {
      console.error('[dsh-usage-plus] plan strip registration failed on conversation.composer.dock:', error)
      reportDiag('registration-failed', `conversation.composer.dock: ${error instanceof Error ? error.message : String(error)}`)
      return () => {}
    }
  })
}
