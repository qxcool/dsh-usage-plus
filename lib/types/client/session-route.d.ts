/**
 * Read the model route selected *in each conversation* from the client's
 * session object layer. Session-scoped slots receive the standard `session`
 * hook (and `sessionId`); the session owns a durable `modelSelection`
 * projection whose wire view is `{ lastUsed, next }`, where `next`
 * (`pending ?? lastUsed`) is the provider/model the session's next request
 * will use. This lets the composer strip follow each conversation's own
 * selection instead of the host's global last-request route.
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
/** Minimal observable face the projections registry hands out. */
export interface SessionProjectionFace {
    getSnapshot: () => unknown;
    subscribe: (listener: () => void) => () => void;
}
/** Minimal structural surface of the client Session object layer. */
export interface SessionFaceLike {
    projections?: {
        faceOf?: (key: string) => unknown;
    };
}
/** The route the strip matches plans against. */
export interface SessionRoute {
    provider: string;
    model?: string;
}
/** Read the session's `modelSelection` projection face (undefined when absent). */
export declare function sessionSelectionFace(session: unknown): SessionProjectionFace | undefined;
/**
 * Normalize one projected selection state onto a plan route. The wire view
 * already ensures `next = pending ?? lastUsed`, so `next` is the session's
 * effective route whenever it exists; anything else falls through so the
 * caller can use the host's default.
 */
export declare function sessionRouteFrom(snapshot: unknown): {
    provider: string;
    model?: string;
} | undefined;
//# sourceMappingURL=session-route.d.ts.map