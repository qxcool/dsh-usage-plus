import { type ReactNode } from 'react';
import type { UsageStoreInstance } from './usage-store.ts';
import { currentPlanProvider } from '../core/plan-match.ts';
export interface PlanUsageStripProps {
    store: UsageStoreInstance;
    poll: () => void;
}
export { currentPlanProvider };
/**
 * Compact plan-quota meter for `conversation.input.right`, styled like the
 * official ContextMeter (ring + %) beside the model / send controls.
 */
export declare function PlanUsageStrip(props: PlanUsageStripProps): ReactNode;
//# sourceMappingURL=PlanUsageStrip.d.ts.map