import { type ReactNode } from 'react';
import type { UsageStoreInstance } from './usage-store.ts';
import { currentPlanProvider } from '../core/plan-match.ts';
import { type SessionFaceLike } from './session-route.ts';
export interface PlanUsageStripProps {
    store: UsageStoreInstance;
    poll: () => void;
    /**
     * Standard session-scope props. The renderer's `session-maybe` source
     * suite injects them automatically: the active conversation's session
     * object (via a uSES hook, `undefined` when no session is mounted) and
     * that session's id.
     */
    useSession?: () => SessionFaceLike | undefined;
    sessionId?: string;
}
export { currentPlanProvider };
/**
 * Compact plan-quota meter for `conversation.input.right`, styled like the
 * official ContextMeter (ring + %) beside the model / send controls.
 */
export declare function PlanUsageStrip(props: PlanUsageStripProps): ReactNode;
//# sourceMappingURL=PlanUsageStrip.d.ts.map