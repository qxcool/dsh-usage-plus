/**
 * Conversation-scoped usage view ("用量"): the current session's own token
 * totals, per-model split, cost, and the quota windows of the model it used.
 *
 * It deliberately does NOT repeat per-turn detail: the built-in Trajectory and
 * session-statistics views already own turn/step/timing tables, and the
 * Context view owns prompt composition. This view answers the other question —
 * "what did this conversation cost against which quota" — so it stays a
 * two-card surface: 计费口径 + 账号额度.
 * @module dsh-usage-plus/client/SessionUsageView
 */
import { type ReactNode } from 'react';
import type { UsageStoreInstance } from './usage-store.ts';
export interface SessionUsageViewProps {
    /** Injected by the `conversation.view` slot for this session. */
    sessionId: string;
    store: UsageStoreInstance;
}
/** The "用量" Conversation View body. */
export declare function SessionUsageView(props: SessionUsageViewProps): ReactNode;
//# sourceMappingURL=SessionUsageView.d.ts.map