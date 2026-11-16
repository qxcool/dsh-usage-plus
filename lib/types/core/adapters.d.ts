/**
 * Provider adapters: one entry per provider family this plugin can query for
 * a pay-as-you-go balance or a coding-plan quota. Adapters are pure — they
 * build an HTTP probe from a resolved credential and parse the response — so
 * the service stays transport-only and every endpoint detail lives here.
 *
 * All probes run host-side (Node fetch); API keys never reach the browser.
 * @module @linxin666/dsh-usage/core/adapters
 */
import type { CredentialKind, PlanWindowView } from './types.ts';
/** One HTTP probe the service executes verbatim. */
export interface ProbeSpec {
    url: string;
    headers: Record<string, string>;
    /** HTTP method; the service defaults to GET when omitted. */
    method?: 'GET' | 'POST';
}
/** Inputs an adapter may use to build a probe. */
export interface AdapterProbeContext {
    /** Resolved credential value: a raw API key, or an OAuth access token for the oauth-aware adapters. */
    apiKey: string;
    /** Provider account id riding a dedicated header, when the credential carries one (Codex). */
    accountId?: string;
    /**
     * The pi-ai OAuth grant's refresh token (for `github-copilot` this is the
     * GitHub token while the access token is the Copilot bearer). Host-only:
     * never crosses the wire.
     */
    refreshToken?: string;
}
/** Which resolved credential kind a probe half accepts. */
export type ProbeCredentialGate = 'oauth' | 'api-key' | 'any';
/** Whether one probe half may run with the resolved credential kind. */
export declare function probeHalfAllowed(gate: ProbeCredentialGate | undefined, credential: CredentialKind): boolean;
/** A parsed balance fact. */
export interface BalanceParse {
    currency: string;
    totalBalance: string;
}
/** A parsed plan-quota fact. */
export interface PlanParse {
    planName?: string;
    windows: PlanWindowView[];
}
/** One provider family's probing capability. */
export interface ProviderAdapter {
    /** Provider route keys this adapter serves. */
    ids: readonly string[];
    /**
     * The route id to keep when several live routes resolve to this adapter.
     * One adapter means one probe endpoint, so an alias must not be probed or
     * rendered twice; the preferred id is the one sessions and the composer
     * `current` route carry (the live registry id), not the catalog key.
     */
    preferredId?: string;
    /** Fallback display name when the LLM runtime has none. */
    displayName: string;
    balance?: {
        /** Credential kinds this half accepts; default `any`. */
        credential?: ProbeCredentialGate;
        build(context: AdapterProbeContext): ProbeSpec;
        parse(status: number, body: unknown): BalanceParse | undefined;
    };
    plan?: {
        /** Credential kinds this half accepts; default `any`. */
        credential?: ProbeCredentialGate;
        build(context: AdapterProbeContext): ProbeSpec;
        parse(status: number, body: unknown): PlanParse | undefined;
    };
}
/**
 * The adapter registry, in no particular order. Route keys come from the
 * pi-ai provider catalog plus the routes this deployment observed in user
 * configuration (`zenmux`).
 */
export declare const PROVIDER_ADAPTERS: readonly ProviderAdapter[];
/** Find the adapter serving a provider route key, if any. */
export declare function adapterFor(provider: string): ProviderAdapter | undefined;
/**
 * Keep one route per adapter when several live routes resolve to the same
 * probe endpoint (the `deepseek` catalog key and the `deepseek-official` live
 * route share the DeepSeek balance probe). The adapter's `preferredId` wins
 * regardless of registry order; otherwise the first occurrence wins. Routes
 * without an adapter are never collapsed. Pure: preserves input order of the
 * kept routes and returns a new array.
 */
export declare function dedupeProviderAliasRoutes<T extends {
    id: string;
}>(routes: readonly T[]): T[];
/**
 * Whether a provider route belongs to the official DeepSeek family: the only
 * family with a spend price book and a settings-section-owned env credential
 * (llm-deepseek) rather than a pi-ai profile. Drives the env fallback in
 * credential resolution and the fold-time cost stamping.
 */
export declare function isDeepSeekProviderRoute(provider: string): boolean;
/**
 * Best-effort human message from a provider error body, for the per-provider
 * error line. Never throws; truncated to one short sentence.
 */
export declare function providerErrorMessage(status: number, body: unknown): string;
//# sourceMappingURL=adapters.d.ts.map