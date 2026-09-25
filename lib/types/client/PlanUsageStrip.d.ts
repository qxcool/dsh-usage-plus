import { type ReactNode } from 'react';
import type { UsageStoreInstance } from './usage-store.ts';
import { currentPlanProvider } from '../core/plan-match.ts';
export declare function reportDiag(kind: string, key: string): void;
/** Keyed projection hook from session-scope standard kit (`ui-session`). */
export type UseProjection = (key: string) => unknown;
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
 */
export declare function PlanUsageStrip(props: PlanUsageStripProps): ReactNode;
//# sourceMappingURL=PlanUsageStrip.d.ts.map