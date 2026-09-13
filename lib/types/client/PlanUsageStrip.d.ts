import { type ReactNode } from 'react';
import type { UsageStoreInstance } from './usage-store.ts';
import type { ProviderSnapshotView, UsageOverviewView } from '../core/types.ts';
export interface PlanUsageStripProps {
    store: UsageStoreInstance;
    poll: () => void;
}
export declare function currentPlanProvider(snapshot: UsageOverviewView | null): ProviderSnapshotView | undefined;
/** Compact official quota strip under the conversation input. No real plan window means no UI. */
export declare function PlanUsageStrip(props: PlanUsageStripProps): ReactNode;
//# sourceMappingURL=PlanUsageStrip.d.ts.map