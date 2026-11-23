/**
 * Generic gateway quota detection.
 *
 * A DSH route whose provider has no shipped adapter may still be an
 * OpenAI-compatible gateway (One API, New API, a self-hosted credit proxy, ...)
 * that exposes a standard balance endpoint. Instead of asking the user to hand
 * write a custom quota source for those, the Host probes the small set of
 * documented gateway endpoints derived from the configured `baseURL` and shows
 * the balance only when a real response shape was recognized.
 *
 * Every probe is read-only, GET-only, keyed by the route's own credential, and
 * never guesses a value: an absent/unrecognized body returns `undefined`.
 * @module dsh-usage-plus/core/gateways
 */
/** Inputs for one gateway detection pass. */
export interface GatewayDetectionInput {
    /** The route's configured pi-ai base URL (`https://gateway.example/v1`). */
    baseURL: string;
    /** The route's resolved credential (raw API key or env value). */
    apiKey: string;
}
/** A recognized gateway balance. */
export interface GatewayDetection {
    /** Stable probe id (`one-api`, `new-api`, `credits`). */
    id: string;
    /** Human label for the auto-detection chip. */
    name: string;
    /** ISO currency code; only currencies the endpoint states are returned. */
    currency: string;
    /** Balance as a decimal string, two fraction digits. */
    totalBalance: string;
}
/** One parsed HTTP response; `body` is `undefined` when it was not JSON. */
export interface GatewayHttpResponse {
    ok: boolean;
    status: number;
    body: unknown;
}
/** Injectable transport. Returning `undefined` is a transport failure. */
export type GatewayFetch = (url: string, init: {
    headers: Record<string, string>;
    signal?: AbortSignal;
}) => Promise<GatewayHttpResponse | undefined>;
/** Timings/seams for {@link detectGatewayQuota}. */
export interface GatewayDetectionOptions {
    /** Transport seam; defaults to the Host's global `fetch`. */
    fetch?: GatewayFetch;
    /** Per-request timeout in milliseconds. Default 8000. */
    timeoutMs?: number;
}
/** Render a finite amount as a two-decimal string, keeping sub-cent values meaningful. */
export declare function formatGatewayAmount(value: number): string;
/**
 * Detect a standard gateway balance endpoint for one configured route.
 *
 * Accepts any OpenAI-compatible `baseURL`; probes the documented dashboard/
 * credit endpoints in {@link PROBE_ORDER} and returns the first recognized
 * balance. Returns `undefined` when the host is a non-standard gateway (the
 * case that needs a custom quota source or a new adapter), or when the
 * credential does not authorize any of them. Never throws.
 */
export declare function detectGatewayQuota(input: GatewayDetectionInput, options?: GatewayDetectionOptions): Promise<GatewayDetection | undefined>;
//# sourceMappingURL=gateways.d.ts.map