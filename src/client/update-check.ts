/**
 * Client-side plugin update check, following dsh-context's shape: one shared
 * module-level cache (1h for a successful read, 30s between retries), an
 * in-flight de-duplicated fetch of the host's `/api/dsh-usage-plus/version`
 * route, and a bounded retry loop per mount (5 attempts, 30s apart) so a
 * still-starting host converges without polling forever. The hook returns the
 * latest version string only when the host says it is strictly newer than the
 * running build; every other outcome (unknown, failed, up to date) reads as
 * "no chip".
 * @module dsh-usage-plus/client/update-check
 */

import { useEffect, useState } from 'react'
import { versionRequestPath } from './usage-api.ts'

/** Wire shape of GET /api/dsh-usage-plus/version → `value`. */
export interface UsageVersionValue {
  /** True exactly when a registry answered with a usable version. */
  ready: boolean
  /** True after a check cycle where every registry failed. */
  failed: boolean
  /** Epoch ms of the host's last completed check cycle. */
  checkedAt: number
  /** The running plugin version, when readable. */
  current: string | null
  /** Strictly-newer verdict; null when either side is unknown. */
  updateAvailable: boolean | null
  /** Latest published version, present only when known. */
  latest?: string
}

/** Hard ceiling for one version fetch; a stalled host must not pile up requests. */
const VERSION_FETCH_TIMEOUT_MS = 20_000

/** How long a successful client-side read stays fresh. */
const VERSION_FRESH_MS = 60 * 60 * 1_000

/** Retry cadence while the endpoint has nothing usable yet (bounded attempts). */
const VERSION_RETRY_MS = 30_000

/** Max mount-lifetime attempts before the loop gives up (dsh-context's budget). */
const VERSION_MAX_ATTEMPTS = 5

/** The GitHub Releases page the chip links to. */
export const RELEASES_URL = 'https://github.com/qxcool/dsh-usage-plus/releases/latest'

/** Shared module-level cache + in-flight slot (one fetch across chip mounts). */
let cache: { at: number; read: UsageVersionValue | null } = { at: 0, read: null }
let inflight: Promise<UsageVersionValue | null> | null = null

/**
 * Whether the cached read (success or failure) is still inside its freshness
 * window. A failure caches for the retry window, so a broken endpoint is
 * fetched at most once per cadence instead of once per mount.
 */
function cacheFresh(): boolean {
  if (cache.at === 0) return false
  const window = cache.read?.ready === true ? VERSION_FRESH_MS : VERSION_RETRY_MS
  return Date.now() - cache.at < window
}

/** One bounded fetch + structural validation of the version document. */
async function readVersion(): Promise<UsageVersionValue | null> {
  const response = await fetch(versionRequestPath(), {
    signal: AbortSignal.timeout(VERSION_FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error('usage /api/dsh-usage-plus/version failed: ' + response.status)
  const payload = (await response.json()) as { ok?: unknown; value?: unknown }
  if (payload?.ok !== true || typeof payload.value !== 'object' || payload.value === null) return null
  const value = payload.value as Record<string, unknown>
  if (
    typeof value.ready !== 'boolean'
    || typeof value.failed !== 'boolean'
    || typeof value.checkedAt !== 'number'
    || (value.current !== null && typeof value.current !== 'string')
    || !(value.updateAvailable === null || typeof value.updateAvailable === 'boolean')
  ) {
    return null
  }
  return value as unknown as UsageVersionValue
}

/**
 * The latest cached read, running one deduplicated fetch first when stale.
 * Never throws: any failure collapses into a null read cached for the retry
 * window, so the next attempt starts a fresh fetch instead of piling up.
 */
async function readVersionCached(): Promise<UsageVersionValue | null> {
  if (cacheFresh()) return cache.read
  if (inflight === null) {
    inflight = readVersion().then(
      (read) => {
        cache = { at: Date.now(), read }
        return read
      },
      () => {
        cache = { at: Date.now(), read: null }
        return null
      },
    ).finally(() => {
      inflight = null
    })
  }
  return inflight
}

/** Subscribers notified when the availability verdict changes. */
const listeners = new Set<() => void>()

/** Latest version with an update, or null; sticky across mounts via the cache. */
let latestUpdate: string | null = null

function setLatestUpdate(next: string | null): void {
  if (next === latestUpdate) return
  latestUpdate = next
  for (const listener of listeners) listener()
}

/** One mount-bounded attempt: resolve, schedule the next try while unknown. */
function attempt(live: { value: boolean }, schedule: (fn: () => void, ms: number) => void, remaining: number): void {
  void readVersionCached().then((read) => {
    if (!live.value) return
    if (read?.ready === true && read.updateAvailable === true && typeof read.latest === 'string' && read.latest !== '') {
      setLatestUpdate(read.latest)
      return
    }
    if (read?.ready === true) {
      setLatestUpdate(null)
      return
    }
    if (remaining > 0) {
      schedule(() => attempt(live, schedule, remaining - 1), VERSION_RETRY_MS)
    } else {
      setLatestUpdate(null)
    }
  })
}

/**
 * The latest version string when an update is available, else null. Each
 * mount runs its own bounded retry loop (canceled on unmount), while the
 * module-level cache de-duplicates the underlying fetches. Renders nothing
 * until a check lands, so the header never flickers a chip that cannot be
 * clicked yet.
 */
export function useUpdateAvailable(): string | null {
  const [latest, setLatest] = useState<string | null>(() => latestUpdate)
  useEffect(() => {
    const live = { value: true }
    let timer: number | undefined
    const listener = (): void => setLatest(latestUpdate)
    listeners.add(listener)
    attempt(live, (fn, ms) => {
      timer = window.setTimeout(fn, ms)
    }, VERSION_MAX_ATTEMPTS - 1)
    return () => {
      live.value = false
      if (timer !== undefined) window.clearTimeout(timer)
      listeners.delete(listener)
    }
  }, [])
  return latest
}
