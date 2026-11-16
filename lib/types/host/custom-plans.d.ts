/**
 * Generic "custom plan" quota source: users can point the Host at an arbitrary
 * quota endpoint without waiting for a shipped provider adapter. The module is
 * deliberately transport-only and pure-to-the-edge so the service can store a
 * plain `ProviderSnapshotView`:
 *
 * 1. {@link parseCustomPlans} validates the user-supplied JSON config (from a
 *    settings string) and never throws — every bad field is reported per entry.
 * 2. {@link probeCustomPlan} GETs the endpoint under the Host's own trust
 *    rules: allow-listed/loopback hosts only, redirects refused, 8s timeout,
 *    secrets read from the Host environment and never echoed in errors.
 * 3. {@link normalizeCustomPlan} accepts the two payload shapes seen in the
 *    wild (opencode-style `usage` object and a `windows` array) and returns
 *    sorted `PlanWindowView`s.
 * 4. {@link customPlanSnapshot} shapes the probe result into the wire view the
 *    overview/Plans tab already renders.
 *
 * Header values may be literals or `${env:NAME}` references; the parser keeps
 * them unresolved and {@link resolveHeaders} fills them in host-side only.
 * @module @linxin666/dsh-usage-plus/host/custom-plans
 */
import type { PlanWindowView, ProviderSnapshotView } from '../core/types.ts';
/** Hard bounds that keep a user-supplied config small, bounded and safe. */
export declare const CUSTOM_PLAN_LIMITS: Readonly<{
    /** Maximum number of entries accepted from the JSON document. */
    readonly maxEntries: 12;
    /** Maximum number of `allowedHosts` entries per plan. */
    readonly maxAllowedHosts: 8;
    /** Maximum number of custom request headers per plan. */
    readonly maxHeaders: 16;
    /** Maximum number of normalized windows returned per probe. */
    readonly maxWindows: 8;
    /** Maximum `id` length (the id pattern itself allows 32). */
    readonly maxIdLength: 32;
    /** Maximum display-name length. */
    readonly maxNameLength: 64;
    /** Maximum absolute URL length. */
    readonly maxUrlLength: 2048;
    /** Maximum hostname length (DNS allows 253). */
    readonly maxHostLength: 253;
    /** Maximum header-name length. */
    readonly maxHeaderNameLength: 64;
    /** Maximum raw header-value length. */
    readonly maxHeaderValueLength: 1024;
    /** Maximum environment-variable name length. */
    readonly maxEnvNameLength: 64;
    /** Default probe timeout in milliseconds. */
    readonly timeoutMs: 8000;
}>;
/** Resolve one environment variable host-side; explorer for tests. */
export type CustomPlanEnvReader = (name: string) => string | undefined;
/** Typed, secret-free failure codes produced by parsing/probing. */
export type CustomPlanErrorCode = 
/** The request or its configured timeout was aborted. */
'timeout'
/** The transport rejected (DNS/TLS/connection reset/...). */
 | 'network'
/** A 3xx response was refused (no redirects are followed). */
 | 'redirect'
/** 401/403: the endpoint rejected the (never echoed) credential. */
 | 'auth'
/** Any other non-2xx response. */
 | 'http'
/** A 2xx body that is not valid JSON. */
 | 'invalid-json'
/** Valid JSON without one usable quota window. */
 | 'no-windows'
/** `tokenEnv` is configured but the host environment does not define it. */
 | 'missing-token'
/** A hand-built entry is structurally invalid. */
 | 'invalid-config'
/** A header name/value (or token value) failed the safety checks. */
 | 'unsafe-header'
/** URL is not absolute http(s), carries credentials/fragment, or too long. */
 | 'invalid-url'
/** URL host is neither loopback nor listed in `allowedHosts`. */
 | 'not-allowed';
/** A typed probe/config failure. Messages never contain secret values. */
export declare class CustomPlanError extends Error {
    readonly code: CustomPlanErrorCode;
    readonly status?: number;
    constructor(code: CustomPlanErrorCode, message: string, status?: number);
}
/** One validated custom plan. Headers stay unresolved until probed. */
export interface CustomPlanEntry {
    /** URL-safe unique id (`/^[a-z0-9][a-z0-9-]{0,31}$/`). */
    id: string;
    /** Display name; falls back to the id. */
    name: string;
    /** Normalized absolute endpoint URL. */
    url: string;
    /** URL hostname (lowercased, no port). */
    host: string;
    /** Extra hosts allowed besides loopback, lowercased. */
    allowedHosts: string[];
    /** Environment variable holding the bearer token, when configured. */
    tokenEnv?: string;
    /** Unresolved request headers (literal or `${env:NAME}` values). */
    headers: Record<string, string>;
    /** Resolve `${env:NAME}` header values; unresolved references drop the header. */
    resolveHeaders(getEnv: CustomPlanEnvReader): Record<string, string>;
    /** Optional free-form label from the config document (kept for forward compat). */
    label?: string;
}
/** One config-validation problem. `index -1` means the whole document. */
export interface CustomPlanConfigError {
    /** 0-based entry index, or -1 for a document-level error. */
    index: number;
    /** Entry id when the id itself parsed far enough to identify the entry. */
    id?: string;
    /** Field path (`id`, `url`, `headers.x-tenant`, ...) or `document`/`entry`. */
    field: string;
    /** Secret-free human message. */
    message: string;
}
/** Result of {@link parseCustomPlans}; bad entries are dropped, never thrown. */
export interface CustomPlansParseResult {
    entries: CustomPlanEntry[];
    errors: CustomPlanConfigError[];
}
/** Options for {@link probeCustomPlan}; every seam is injectable for tests. */
export interface CustomPlanProbeOptions {
    /** Fetch implementation; defaults to the global `fetch`. */
    fetch?: typeof fetch;
    /** Optional caller abort signal, combined with the timeout. */
    signal?: AbortSignal;
    /** Per-request timeout in ms; defaults to {@link CUSTOM_PLAN_LIMITS.timeoutMs}. */
    timeoutMs?: number;
    /** Environment reader for `tokenEnv` + `${env:NAME}` headers; defaults to `process.env`. */
    env?: CustomPlanEnvReader;
    /** Clock; defaults to `Date.now`. */
    now?: () => number;
}
/** Successful probe: normalized plan windows. */
export interface CustomPlanProbeSuccess {
    ok: true;
    /** HTTP status of the accepted response. */
    status: number;
    /** Normalized windows (always at least one). */
    windows: PlanWindowView[];
    /** Probe completion instant (epoch ms). */
    updatedAt: number;
}
/** Failed probe: a typed, secret-free error. */
export interface CustomPlanProbeFailure {
    ok: false;
    error: CustomPlanError;
}
/** Probe outcome; callers branch on `ok`. */
export type CustomPlanProbeResult = CustomPlanProbeSuccess | CustomPlanProbeFailure;
/**
 * Normalize a custom-plan probe payload into sorted plan windows.
 *
 * Accepts the two shapes seen in the wild:
 * - `{usage:{rolling|weekly|monthly|session:{percent, resetsAt}}}`
 * - `{windows:[{label, percent, resetAt?, resetsAt?}]}` (also `windows: {...}`)
 * and, as a fallback, a flat window map at the root or a bare window array.
 * `percent` may be 0..1 (fraction) or 0..100 and is clamped; `resetsAt`/`resetAt`
 * may be epoch seconds/milliseconds or an ISO string. Unknown labels are kept
 * when they carry a percent (with a slugged key and the raw label as `name`);
 * unusable windows are silently skipped. Returns undefined when none parse.
 */
export declare function normalizeCustomPlan(payload: unknown): PlanWindowView[] | undefined;
/**
 * Resolve `${env:NAME}` references in a header map.
 *
 * Only that exact syntax is substituted. Headers whose referenced variable is
 * unset (or whose reader throws) are dropped instead of being sent half-filled;
 * resolved values that smuggle control characters are dropped too. Literal
 * values are returned unchanged. Never throws.
 */
export declare function resolveHeaders(headers: Readonly<Record<string, string>>, getEnv: CustomPlanEnvReader): Record<string, string>;
/**
 * Parse and validate the user-supplied custom-plan config.
 *
 * Accepts a JSON string, an already-parsed array, or `undefined`/`null`/an
 * empty string (feature off). Strict per-field validation collects every
 * problem instead of throwing; entries with errors are dropped so the service
 * can show them and keep serving the rest. Duplicate ids reject the later entry.
 */
export declare function parseCustomPlans(json: unknown): CustomPlansParseResult;
/**
 * GET one custom plan endpoint and normalize its quota windows.
 *
 * Safety invariants (the same rules the external sources follow): only
 * loopback/allow-listed hosts, redirects refused, an 8s default timeout, and
 * secrets (`tokenEnv` bearer token and `${env:NAME}` headers) live only in the
 * Host request. Never throws: every failure degrades to a typed
 * {@link CustomPlanError} whose message contains no secret values.
 */
export declare function probeCustomPlan(entry: CustomPlanEntry, opts?: CustomPlanProbeOptions): Promise<CustomPlanProbeResult>;
/**
 * Shape a successful probe into the wire snapshot the service stores.
 *
 * Returns `provider: 'custom:<id>'`, `source: 'custom'`, the entry's display
 * name, `credential: 'env'`, `planSupported: true`, and a copied `plan`
 * (`windows` + `updatedAt`); nothing is mutated.
 */
export declare function customPlanSnapshot(entry: CustomPlanEntry, windows: readonly PlanWindowView[], atMs: number): ProviderSnapshotView;
/**
 * Friendly, secret-free display message for any custom-plan failure.
 *
 * Handles {@link CustomPlanError}, timeout/abort errors, network errors (with
 * the transport code appended, matching the external-source convention), and
 * serialized `{code, message}` objects; anything else degrades to a generic
 * message. Never throws and never echoes credentials.
 */
export declare function describeCustomPlanError(error: unknown): string;
//# sourceMappingURL=custom-plans.d.ts.map