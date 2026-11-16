import { type ReactNode } from 'react';
import type { UsageStoreInstance } from './usage-store.ts';
import { currentPlanProvider } from '../core/plan-match.ts';
/**
 * Report a state change to the host diagnostic log. Identical `strip-state`
 * keys are throttled for five minutes (the strip re-renders on every shared
 * poll); error and registration kinds are always forwarded.
 */
export declare function reportDiag(kind: string, key: string): void;
/** Keyed projection hook from session-scope standard kit (`ui-session`). */
export type UseProjection = (key: string) => unknown;
/** Official `tokenUsage` projection fields we read (durable session totals). */
export interface SessionTokenUsage {
    uncachedInputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
}
/** Official `contextPressure` projection fields we read. */
export interface SessionContextPressure {
    /** Last provider prompt size (exact sample). */
    pressureTokens?: number;
    /** Pressure plus signed surface movement since the sample. */
    projectedTokens?: number;
    /** Route capacity, when the newest request carried one. */
    contextWindow?: number;
}
export interface PlanUsageStripProps {
    store: UsageStoreInstance;
    /**
     * Acquire the shared strip poller: returns a release function. All strip
     * instances share one interval + one set of document listeners in the
     * client entry (startStripPolling), so N open conversations never fan out
     * into N independent /overview pollers.
     */
    startStripPolling?: () => () => void;
    /**
     * Session-scope keyed projection hook. Returns the live projection value
     * (already subscribed). Official path for per-conversation modelSelection —
     * `useSession()` only yields the SessionSnapshot, which has no projections.
     */
    useProjection?: UseProjection;
    sessionId?: string;
}
export { currentPlanProvider };
/**
 * Compact plan-quota meter for `conversation.composer.dock`, seated on the
 * bottom strip beside official StatsPills and ContextMeter.
 *
 * The trigger stays a single quiet pill: a 16px ring for the tightest window
 * plus the per-window reading. The popover is the detailed view (per-window
 * bars, tone colours, reset copy) and explains that the ring tracks the
 * tightest window, so the arc and the numbers can never be misread.
 */
export declare function PlanUsageStrip(props: PlanUsageStripProps): ReactNode;
//# sourceMappingURL=PlanUsageStrip.d.ts.map