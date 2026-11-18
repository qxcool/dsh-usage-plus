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
/** A window at or past 100% blocks further usage until it resets. */
export declare function isPlanWindowFull(window: PlanWindowView | undefined): boolean;
/**
 * The window whose reading should be featured in the composer strip.
 *
 * Windows measure different periods, so "highest percent" is not comparable:
 * a monthly window at 70% is normal while the 5-hour window still has room.
 * The shortest window is the one that throttles a working session soonest, so
 * it stays primary; a longer window replaces it only once it reaches the
 * configured promotion percent (100 by default — i.e. actually full, since a
 * full window blocks all usage regardless of the shorter window). Among
 * multiple qualifying windows the shortest (week before month) is featured.
 *
 * @param windows - display-ordered windows (`orderedPlanWindows`).
 * @param promotePercent - percent a longer window must reach to take over; 1-100.
 * @returns the featured window, or undefined when there is none.
 */
export declare function featuredPlanWindow(windows: readonly PlanWindowView[], promotePercent?: number): PlanWindowView | undefined;
/** Normalize a promotion threshold: integers 1-100, 100 when unusable. */
export declare function clampPromotePercent(value: unknown): number;
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