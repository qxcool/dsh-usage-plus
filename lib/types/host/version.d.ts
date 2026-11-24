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
/** Minimal response shape a fetch implementation must satisfy. */
export interface VersionFetchResponseLike {
    ok: boolean;
    json(): Promise<unknown>;
}
/** Injectable fetch: the global `fetch` satisfies this. */
export type VersionFetchLike = (url: string, init: {
    headers?: Record<string, string>;
    signal?: AbortSignal;
}) => Promise<VersionFetchResponseLike>;
/** This package's npm name (the self-reference target of `readPackageVersion`). */
export declare const PACKAGE_NAME = "dsh-usage-plus";
/**
 * Registry `/latest` documents tried in order; the npmmirror mirror keeps the
 * check usable inside networks that rate-limit or block npmjs.
 */
export declare const VERSION_REGISTRIES: readonly string[];
/** Default timeout for one registry fetch. */
export declare const VERSION_TIMEOUT_MS = 8000;
/** How long one check result (success or failure) stays fresh. */
export declare const VERSION_TTL_MS: number;
/** One parsed version, or null for a tag the pattern does not accept. */
export declare function parseVersion(input: string): {
    major: number;
    minor: number;
    patch: number;
    rank: number;
    serial: number;
} | null;
/** Three-way semver comparison (release > rc > beta > alpha, then serial). */
export declare function compareVersions(left: string, right: string): number;
/** Whether `latest` is strictly newer than `current` (both must parse). */
export declare function isNewerVersion(latest: string, current: string): boolean;
/**
 * Read this package's own version from its `package.json` (Node self-reference
 * through the exports map, so it works both installed under node_modules and
 * from a source checkout). Undefined when unresolvable — the route then
 * reports `updateAvailable: null` instead of guessing.
 */
export declare function readPackageVersion(packageName?: string): string | undefined;
/** One completed check, as the route serializes it (`value` omits when none). */
export interface VersionCheckRead {
    /** Latest published version, or null when no registry answered. */
    value: string | null;
    /** True exactly when a registry answered with a usable version. */
    ready: boolean;
    /** True after a cycle where every registry failed (stays fresh for the TTL). */
    failed: boolean;
    /** Epoch ms of the last completed check cycle. */
    checkedAt: number;
}
/** `VersionChecker` options; every dependency is injectable for tests. */
export interface VersionCheckerOptions {
    /** Fetch implementation (defaults to the global `fetch`). */
    fetchImpl?: VersionFetchLike;
    /** Clock returning epoch ms (defaults to `Date.now`). */
    now?: () => number;
    /** Result freshness window in ms (defaults to `VERSION_TTL_MS`). */
    ttlMs?: number;
    /** Per-fetch timeout in ms (defaults to `VERSION_TIMEOUT_MS`). */
    timeoutMs?: number;
    /** Registry `/latest` documents tried in order (defaults to `VERSION_REGISTRIES`). */
    registries?: readonly string[];
    /** The running version (defaults to `readPackageVersion()`). */
    currentVersion?: string | undefined;
}
/**
 * Cached update checker. One in-flight cycle at a time; callers joining a
 * running cycle await the same promise. `check()` is the only entry point and
 * never throws — every failure collapses into a `failed` read that stays
 * cached for the TTL, so a broken network costs one attempt per hour.
 */
export declare class VersionChecker {
    private readonly fetchImpl;
    private readonly now;
    private readonly ttlMs;
    private readonly timeoutMs;
    private readonly registries;
    private readonly currentVersion;
    private read;
    private inflight;
    private disposed;
    constructor(options?: VersionCheckerOptions);
    /** The running version, when readable. */
    current(): string | undefined;
    /** Whether the cached read is still inside the TTL window. */
    private fresh;
    /**
     * The latest cached read, running one check cycle first when stale.
     * Concurrent callers within one cycle share the same request; after dispose
     * the cached read is returned without any further network traffic.
     */
    check(): Promise<VersionCheckRead>;
    /** Stop serving checks; an in-flight cycle still completes and caches. */
    dispose(): void;
    /** Try every registry in order; the first usable version wins. */
    private runCycle;
}
//# sourceMappingURL=version.d.ts.map