/**
 * Resolve which provider snapshot should drive the composer plan strip.
 * Official model routes keep an exact id match; CPAMC / Volcano live under
 * synthetic ids (`cpamc:…`, `volcano:ark-plan`) and must be matched by the
 * current composer provider / model / baseURL.
 * @module dsh-usage-plus/core/plan-match
 */
import type { PlanView, PlanWindowView, ProviderSnapshotView, UsageOverviewView } from './types.ts';
/**
 * A route resolved outside the host's global `current` — typically the model
 * selected *in one conversation* (its durable `modelSelection` projection).
 * When present it takes precedence over `snapshot.current`.
 */
export interface PlanRouteOverride {
    provider: string;
    model?: string;
    /** pi-ai / provider baseURL for the override route, when the client knows one. */
    baseURL?: string;
}
/** Keep only percentage windows the UI knows how to render. */
export declare function planWindowsForDisplay(plan: PlanView | undefined): PlanWindowView[];
/** Stable 5h → week → month order for plan cards and the strip panel. */
export declare function orderedPlanWindows(plan: PlanView | undefined): PlanWindowView[];
/** Clone a provider row with display-only windows, or undefined when empty. */
export declare function withDisplayPlan(provider: ProviderSnapshotView | undefined): ProviderSnapshotView | undefined;
/** Volcano Ark / Doubao coding-plan routes (and their control-plane hosts). */
export declare function looksLikeVolcano(text: string): boolean;
/** CLI Proxy API management console / common local gateway endpoints. */
export declare function looksLikeCpamcGateway(text: string): boolean;
/** Provider ids that commonly front CPAMC-backed Codex / Kimi / Claude accounts. */
export declare function looksLikeCpamcProviderId(provider: string): boolean;
/** Map a composer route onto one of the CPAMC account families we probe. */
export declare function cpamcFamily(text: string): 'codex' | 'kimi' | 'claude' | undefined;
/**
 * Providers that belong on the Plans tab: real windows, or external sources
 * that only carry a probe error (so the user can see why CPAMC/Volcano is empty).
 */
export declare function planTabProviders(providers: ProviderSnapshotView[]): ProviderSnapshotView[];
/** Locale key for the plan source chip on the strip / plan cards. */
export declare function planSourceLabelKey(provider: ProviderSnapshotView): 'usage.plan.source.model' | 'usage.plan.source.cpamc' | 'usage.plan.source.volcano';
/**
 * Pick the plan snapshot for the current composer model.
 * Order: explicit route override (per-session selection) → exact provider id
 * → Volcano external source → CPAMC external source. The override lets the
 * strip follow the model selected in each conversation instead of the host's
 * global "last request seen" route.
 */
export declare function currentPlanProvider(snapshot: Pick<UsageOverviewView, 'current' | 'providers'> | null, override?: PlanRouteOverride): ProviderSnapshotView | undefined;
//# sourceMappingURL=plan-match.d.ts.map