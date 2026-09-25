/**
 * Read the model route selected *in each conversation* from the client's
 * session projection. Session-scoped slots receive `useProjection` from
 * ui-session (`keyedHooks.projection` → faceOf); the durable `modelSelection`
 * value is `{ lastUsed, next }` where `next = pending ?? lastUsed` is the
 * provider/model the session's next request will use.
 * @module dsh-usage-plus/client/session-route
 */
/** Structural shape of the projected model-selection view. */
export interface SessionSelectionView {
    lastUsed?: {
        provider?: string;
        model?: string;
    } | null;
    next?: {
        provider?: string;
        model?: string;
    } | null;
}
/** The route the strip matches plans against. */
export interface SessionRoute {
    provider: string;
    model?: string;
}
/**
 * Normalize one projected selection state onto a plan route. The wire view
 * already ensures `next = pending ?? lastUsed`, so `next` is the session's
 * effective route whenever it exists.
 */
export declare function sessionRouteFrom(snapshot: unknown): SessionRoute | undefined;
//# sourceMappingURL=session-route.d.ts.map