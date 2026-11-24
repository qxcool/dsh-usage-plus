/**
 * Plugin update check: the running version, the latest published npm version,
 * and a semver "is newer" comparison. The client chip polls the
 * `/api/dsh-usage-plus/version` route, which serves this module's cached read;
 * the check itself follows dsh-context's shape — a small registry list
 * (npmjs + npmmirror fallback) tried in order, a 1h TTL on both successful and
 * failed reads (so a flaky network is not hammered), in-flight de-duplication,
 * and a per-fetch timeout. No release metadata beyond the version string is
 * kept: updating happens through DSH's plugin command, and the chip links to
 * the GitHub Releases page.
 * @module dsh-usage-plus/host/version
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Minimal response shape a fetch implementation must satisfy. */
export interface VersionFetchResponseLike {
  ok: boolean
  json(): Promise<unknown>
}

/** Injectable fetch: the global `fetch` satisfies this. */
export type VersionFetchLike = (url: string, init: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<VersionFetchResponseLike>

/** This package's npm name (the self-reference target of `readPackageVersion`). */
export const PACKAGE_NAME = 'dsh-usage-plus'

/**
 * Registry `/latest` documents tried in order; the npmmirror mirror keeps the
 * check usable inside networks that rate-limit or block npmjs.
 */
export const VERSION_REGISTRIES: readonly string[] = [
  'https://registry.npmjs.org/dsh-usage-plus/latest',
  'https://registry.npmmirror.com/dsh-usage-plus/latest',
]

/** Default timeout for one registry fetch. */
export const VERSION_TIMEOUT_MS = 8_000

/** How long one check result (success or failure) stays fresh. */
export const VERSION_TTL_MS = 60 * 60 * 1_000

/**
 * Minimal semver comparison for published release tags: `major.minor.patch`
 * with an optional `-alpha|-beta|rc[.N]` pre-release (a pre-release ranks
 * below the same release, `rc` above `beta` above `alpha`, and `N` orders
 * within one pre-release kind) and an ignored build suffix. Anything else
 * (nightlies, unknown tags) parses to null and never counts as newer.
 */
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)(?:\.(\d+))?)?(?:\+[0-9a-z.-]+)?$/i

/** Prerelease rank: alpha=1, beta=2, rc=3, release=4. */
function prereleaseRank(kind: string | undefined): number {
  if (kind === 'rc') return 3
  if (kind === 'beta') return 2
  if (kind === 'alpha') return 1
  return 4
}

/** One parsed version, or null for a tag the pattern does not accept. */
export function parseVersion(input: string): {
  major: number
  minor: number
  patch: number
  rank: number
  serial: number
} | null {
  const match = VERSION_PATTERN.exec(input.trim())
  if (match === null) return null
  const kind = match[4]?.toLowerCase()
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    rank: kind === undefined ? 4 : prereleaseRank(kind),
    serial: match[5] !== undefined ? Number(match[5]) : 0,
  }
}

/** Three-way semver comparison (release > rc > beta > alpha, then serial). */
export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (a === null || b === null) return 0
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  if (a.rank !== b.rank) return a.rank - b.rank
  return a.serial - b.serial
}

/** Whether `latest` is strictly newer than `current` (both must parse). */
export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0
}

/**
 * Read this package's own version from its `package.json` (Node self-reference
 * through the exports map, so it works both installed under node_modules and
 * from a source checkout). Undefined when unresolvable — the route then
 * reports `updateAvailable: null` instead of guessing.
 */
export function readPackageVersion(packageName: string = PACKAGE_NAME): string | undefined {
  try {
    const resolved = import.meta.resolve(`${packageName}/package.json`)
    const raw = readFileSync(fileURLToPath(resolved), 'utf8')
    const version = (JSON.parse(raw) as { version?: unknown }).version
    return typeof version === 'string' && version !== '' ? version : undefined
  } catch {
    return undefined
  }
}

/** One completed check, as the route serializes it (`value` omits when none). */
export interface VersionCheckRead {
  /** Latest published version, or null when no registry answered. */
  value: string | null
  /** True exactly when a registry answered with a usable version. */
  ready: boolean
  /** True after a cycle where every registry failed (stays fresh for the TTL). */
  failed: boolean
  /** Epoch ms of the last completed check cycle. */
  checkedAt: number
}

/** `VersionChecker` options; every dependency is injectable for tests. */
export interface VersionCheckerOptions {
  /** Fetch implementation (defaults to the global `fetch`). */
  fetchImpl?: VersionFetchLike
  /** Clock returning epoch ms (defaults to `Date.now`). */
  now?: () => number
  /** Result freshness window in ms (defaults to `VERSION_TTL_MS`). */
  ttlMs?: number
  /** Per-fetch timeout in ms (defaults to `VERSION_TIMEOUT_MS`). */
  timeoutMs?: number
  /** Registry `/latest` documents tried in order (defaults to `VERSION_REGISTRIES`). */
  registries?: readonly string[]
  /** The running version (defaults to `readPackageVersion()`). */
  currentVersion?: string | undefined
}

function emptyRead(): VersionCheckRead {
  return { value: null, ready: false, failed: false, checkedAt: 0 }
}

/**
 * Cached update checker. One in-flight cycle at a time; callers joining a
 * running cycle await the same promise. `check()` is the only entry point and
 * never throws — every failure collapses into a `failed` read that stays
 * cached for the TTL, so a broken network costs one attempt per hour.
 */
export class VersionChecker {
  private readonly fetchImpl: VersionFetchLike | undefined
  private readonly now: () => number
  private readonly ttlMs: number
  private readonly timeoutMs: number
  private readonly registries: readonly string[]
  private readonly currentVersion: string | undefined
  private read: VersionCheckRead = emptyRead()
  private inflight: Promise<void> | null = null
  private disposed = false

  constructor(options: VersionCheckerOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as VersionFetchLike | undefined)
    this.now = typeof options.now === 'function' ? options.now : Date.now
    this.ttlMs = typeof options.ttlMs === 'number' && Number.isFinite(options.ttlMs) && options.ttlMs > 0
      ? options.ttlMs
      : VERSION_TTL_MS
    this.timeoutMs = typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : VERSION_TIMEOUT_MS
    this.registries = Array.isArray(options.registries) && options.registries.length > 0
      ? options.registries
      : VERSION_REGISTRIES
    this.currentVersion = options.currentVersion !== undefined ? options.currentVersion : readPackageVersion()
  }

  /** The running version, when readable. */
  current(): string | undefined {
    return this.currentVersion
  }

  /** Whether the cached read is still inside the TTL window. */
  private fresh(): boolean {
    return this.read.checkedAt !== 0 && this.now() - this.read.checkedAt < this.ttlMs
  }

  /**
   * The latest cached read, running one check cycle first when stale.
   * Concurrent callers within one cycle share the same request; after dispose
   * the cached read is returned without any further network traffic.
   */
  async check(): Promise<VersionCheckRead> {
    if (this.disposed) return this.read
    if (this.inflight === null && !this.fresh()) {
      this.inflight = this.runCycle().finally(() => {
        this.inflight = null
      })
    }
    if (this.inflight !== null) await this.inflight
    return this.read
  }

  /** Stop serving checks; an in-flight cycle still completes and caches. */
  dispose(): void {
    this.disposed = true
  }

  /** Try every registry in order; the first usable version wins. */
  private async runCycle(): Promise<void> {
    if (typeof this.fetchImpl !== 'function') {
      this.read = { value: null, ready: false, failed: true, checkedAt: this.now() }
      return
    }
    for (const registry of this.registries) {
      try {
        const response = await this.fetchImpl(registry, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
        })
        const payload: unknown = response.ok ? await response.json() : null
        const version = (payload as { version?: unknown } | null)?.version
        if (typeof version !== 'string' || version === '' || parseVersion(version) === null) continue
        this.read = { value: version, ready: true, failed: false, checkedAt: this.now() }
        return
      } catch {
        // Try the next registry; a mirror fallback keeps restrictive networks usable.
      }
    }
    this.read = { value: null, ready: false, failed: true, checkedAt: this.now() }
  }
}
