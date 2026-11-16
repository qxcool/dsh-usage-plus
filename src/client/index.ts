/**
 * dsh-usage browser half — bundle configuration page (`plugins.bundle.config`)
 * over the `usage-plus` profile entry, plus the composer plan strip. Config
 * reads/writes go through `ctx.configForms`; probing stays on the host.
 * @module dsh-usage-plus/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Types-only: merges the Plugins-page slot contract (`plugins.bundle.config` and
// its `PluginConfigViewProps` owner props) into SlotMap.
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { createUsageStore, type UsageStoreInstance } from './usage-store.ts'
import { UsageSectionCard, type UsageConfigForm, type UsageSectionFace, type UsageSettings } from './UsageSectionCard.tsx'
import { PlanUsageStrip, reportDiag, type PlanUsageStripProps } from './PlanUsageStrip.tsx'
import { NS, en, zh } from './locales.ts'
import { overviewRequestPath, type UsageRangeDays } from './usage-api.ts'
import type { ExternalCredentialTarget, UsageOverviewView } from '../core/types.ts'

/**
 * Must match `USAGE_ENTRY_ID` / cordis.patch.yml `id: usage-plus`.
 * Host and client bundles compile separately, so this literal is duplicated.
 */
export const USAGE_ENTRY_ID = 'usage-plus'

/** The host usage API as the browser sees it (same-origin JSON endpoints). */
interface UsageHttpApi {
  refresh(): Promise<UsageOverviewView>
  setCredential(target: ExternalCredentialTarget, value: string): Promise<UsageOverviewView>
  clearCredential(target: ExternalCredentialTarget): Promise<UsageOverviewView>
}

/** One revalidating overview read: a 304 keeps the snapshot already rendered. */
type OverviewPollResult =
  | { notModified: true }
  | { notModified: false; snapshot: UsageOverviewView; etag?: string }

/** Hard ceiling for one usage API call; a stalled host must not pile up requests. */
const USAGE_FETCH_TIMEOUT_MS = 20_000

/** Package name; also the key of the bundle's `plugins.bundle.config` page. */
const PACKAGE_NAME = 'dsh-usage-plus'

/** Composer-strip poll cadence (one shared interval for every strip). */
const STRIP_POLL_MS = 30_000

/** Collapse a burst of composer interactions into one trailing poll. */
const STRIP_INTERACTION_DEBOUNCE_MS = 250

/**
 * Collapse a burst of poll triggers (strip mount, tab refocus, composer
 * interaction) into one request. The overview poller is shared by the Plugins
 * section and every composer strip, so without this window a route change
 * would fan out into several identical conditional GETs.
 */
const POLL_DEDUPE_MS = 750

/** Document visibility, guarded for non-DOM (SSR/test) execution. */
function isDocumentVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

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

/**
 * Read the overview for one window, revalidating with the previous ETag so an
 * unchanged document answers 304 instead of a full body on every poll. The
 * caller resets the ETag when the window changes (the Host's ETag is per
 * variant).
 */
async function fetchOverview(ifNoneMatch: string | undefined, days: UsageRangeDays): Promise<OverviewPollResult> {
  const response = await fetch(overviewRequestPath(days), {
    method: 'GET',
    ...(ifNoneMatch === undefined ? {} : { headers: { 'if-none-match': ifNoneMatch } }),
    signal: AbortSignal.timeout(USAGE_FETCH_TIMEOUT_MS),
  })
  if (response.status === 304) return { notModified: true }
  if (!response.ok) throw new Error('usage /api/dsh-usage-plus/overview failed: ' + response.status)
  const etag = response.headers.get('etag')
  return {
    notModified: false,
    snapshot: (await response.json()) as UsageOverviewView,
    ...(etag === null ? {} : { etag }),
  }
}

const usageApi: UsageHttpApi = {
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

// SlotMap row for the composer dock, whose owning Web UI package
// (`dsh-client-ui-conversation`) is not a devDependency of this standalone SDK
// project. The Plugins-page rows (the bundle configuration page and the other
// detail slots) come from the installed
// `@deepseek-ai/dsh-client-ui-plugin-manager/client` type import above, so this
// file declares only the missing dock slot.
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * Composer bottom dock — below the input card, beside official StatsPills
     * and ContextMeter.
     */
    'conversation.composer.dock': {
      kind: 'list'
      scope: 'session'
    }
  }
}

/**
 * Client plugin body: register dictionaries, the bundle's configuration page,
 * and the composer plan strip.
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

  // The bundle configuration page registers unconditionally so its dashboard is
  // always reachable, but the settings form only writes while the Host still
  // serves the `usage-plus` entry.
  let formServed = false
  ctx.effect(() => ctx.configForms.whileServed([USAGE_ENTRY_ID], (served) => {
    formServed = served.has(USAGE_ENTRY_ID)
    return () => {
      formServed = false
    }
  }), 'dsh-usage-plus: served form')

  const settings: UsageConfigForm = {
    getSnapshot: () => settingsForm.getSnapshot(),
    subscribe: (listener) => settingsForm.subscribe(listener),
    set: (field, value) => (formServed ? settingsForm.set(field, value) : Promise.resolve(false)),
    mutate: (ops, expectedRevision) => (formServed ? settingsForm.mutate(ops, expectedRevision) : Promise.resolve(false)),
  }

  const store: UsageStoreInstance = createUsageStore().create()

  let disposed = false
  /** Bumped on every started read; older in-flight results are dropped. */
  let pollSeq = 0
  /** Last ETag served for the overview; `undefined` forces a full read. */
  let overviewEtag: string | undefined
  /** The one in-flight fetch: concurrent pollers join it instead of fanning out. */
  let inFlight: Promise<void> | undefined
  /** Work requested while a fetch was in flight; one trailing refresh wins over a poll. */
  let pending: 'poll' | 'refresh' | undefined
  /** Start instant of the last fetch; a burst of triggers inside this window is one request. */
  let lastFetchStartAt = 0

  const setError = (seq: number, error: unknown): void => {
    if (seq !== pollSeq) return
    store.actions.setState('error', error instanceof Error ? error.message : String(error))
  }

  /** Release the in-flight slot and run the single queued request, if any. */
  const settle = (): void => {
    inFlight = undefined
    if (disposed || pending === undefined) return
    const next = pending
    pending = undefined
    if (next === 'refresh') startRefresh()
    else if (isDocumentVisible()) startPoll(true)
  }

  /**
   * Start one overview read unless a read is already running (then queue one
   * trailing poll) or a burst just fired (then drop it). `force` bypasses the
   * burst window for a trailing/queued poll.
   */
  function startPoll(force = false): void {
    if (disposed) return
    if (inFlight !== undefined) {
      if (pending !== 'refresh') pending = 'poll'
      return
    }
    const now = Date.now()
    if (!force && now - lastFetchStartAt < POLL_DEDUPE_MS) return
    lastFetchStartAt = now
    const seq = ++pollSeq
    // Read the window at request time: the shared strip poller and the
    // section poller both follow whatever the store currently selects.
    const days = store.getSnapshot().rangeDays
    inFlight = fetchOverview(overviewEtag, days).then((result) => {
      if (seq !== pollSeq) return
      if (result.notModified) {
        // Data is still current; only a stale error state needs clearing.
        if (store.getSnapshot().status !== 'ready') store.actions.setState('ready', null)
        return
      }
      if (result.etag !== undefined) overviewEtag = result.etag
      store.actions.setSnapshot(result.snapshot)
    }, (error: unknown) => setError(seq, error)).finally(settle)
  }

  /**
   * Start one forced host refresh (`POST /refresh`) and apply its snapshot.
   * A refresh requested during a read queues behind it so two request kinds
   * never race on the same store.
   */
  function startRefresh(): void {
    if (disposed) return
    if (inFlight !== undefined) {
      pending = 'refresh'
      return
    }
    lastFetchStartAt = Date.now()
    const seq = ++pollSeq
    inFlight = usageApi.refresh().then((snapshot) => {
      if (seq !== pollSeq) return
      // The document may have changed; a pre-refresh ETag must not be trusted.
      overviewEtag = undefined
      store.actions.setSnapshot(snapshot)
    }, (error: unknown) => setError(seq, error)).finally(settle)
  }

  const poll = (): void => startPoll()
  const refresh = (): void => startRefresh()

  /**
   * Switch the overview window: store the choice, drop the ETag of the
   * previous variant, and force one read. An in-flight read for the old window
   * is invalidated (`pollSeq`) so its response cannot paint over the new one;
   * its settle hook then starts the queued forced poll with the new range.
   */
  const setRangeDays = (days: UsageRangeDays): void => {
    if (days === store.getSnapshot().rangeDays) return
    store.actions.setRangeDays(days)
    overviewEtag = undefined
    pollSeq += 1
    startPoll(true)
  }

  const applyOverview = (snapshot: UsageOverviewView): void => {
    pollSeq += 1
    overviewEtag = undefined
    store.actions.setSnapshot(snapshot)
  }

  // Shared composer-strip poller: one interval + one set of document
  // listeners across every live PlanUsageStrip instance. Each mounted strip
  // acquires the poller on mount and releases on unmount; timers and
  // listeners live only while at least one strip is mounted, so N open
  // conversations never fan out into N independent /overview pollers.
  let stripRefs = 0
  let stripTimer: number | undefined
  let interactionTimer: number | undefined
  const onVisible = (): void => {
    if (isDocumentVisible()) poll()
  }
  const onComposerInteract = (event: Event): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('[data-slot="conversation.composer"], [data-slot="conversation.input"], [data-slot="conversation.composer.dock"]') === null) return
    // A model pick fires pointerup + change, and clicking around the composer
    // fires many more: collapse the burst into one trailing poll.
    if (interactionTimer !== undefined) window.clearTimeout(interactionTimer)
    interactionTimer = window.setTimeout(() => {
      interactionTimer = undefined
      if (isDocumentVisible()) poll()
    }, STRIP_INTERACTION_DEBOUNCE_MS)
  }
  const startStripPolling = (): (() => void) => {
    stripRefs += 1
    if (stripRefs === 1) {
      stripTimer = window.setInterval(() => {
        if (isDocumentVisible()) poll()
      }, STRIP_POLL_MS)
      document.addEventListener('visibilitychange', onVisible)
      document.addEventListener('pointerup', onComposerInteract, true)
      document.addEventListener('change', onComposerInteract, true)
    }
    // Immediate refresh for the newly mounted strip (interval first fires
    // after one cadence otherwise); the shared poller dedupes a burst of
    // mounts and joins an already running read.
    if (isDocumentVisible()) poll()
    return () => {
      stripRefs -= 1
      if (stripRefs === 0 && stripTimer !== undefined) {
        window.clearInterval(stripTimer)
        stripTimer = undefined
        if (interactionTimer !== undefined) {
          window.clearTimeout(interactionTimer)
          interactionTimer = undefined
        }
        document.removeEventListener('visibilitychange', onVisible)
        document.removeEventListener('pointerup', onComposerInteract, true)
        document.removeEventListener('change', onComposerInteract, true)
      }
    }
  }

  // Stop scheduling new reads when the client plugin unloads. Slot teardown
  // releases the interval/listeners; this only closes the request slot so a
  // late plugin load cannot inherit a queued poll.
  ctx.effect(() => () => {
    disposed = true
    pending = undefined
  }, 'dsh-usage-plus: polling')

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
    setRangeDays,
    settings,
    setCredential,
    clearCredential,
    startStripPolling,
  })

  // Bundle configuration page (DSH 0.2.2): the Plugins page renders the keyed
  // `plugins.bundle.config` slot on this bundle's detail page, between the
  // description and the rows. The page draws its own title, icon, and crumb,
  // so the component starts with the route identity and owns both the
  // dashboard and the settings form.
  ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => {
    try {
      const unregister = ctx.slots.register({
        name: 'plugins.bundle.config',
        key: PACKAGE_NAME,
        inject: face,
      }, UsageSectionCard)
      return () => {
        unregister()
      }
    } catch (error) {
      console.error('[dsh-usage-plus] plugins.bundle.config registration failed:', error)
      return () => {}
    }
  }), 'dsh-usage-plus: bundle config')

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
        inject: (): PlanUsageStripProps => ({ store, startStripPolling }),
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
