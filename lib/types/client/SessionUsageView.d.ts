/**
 * Conversation-scoped usage view ("用量"): the current session's own token
 * totals plus the quota windows of the model it uses. It sits beside the
 * built-in Chat / Trajectory views and third-party Context / Team views, so
 * session numbers stay where session numbers belong; the Plugins page keeps
 * the device-wide ledger and configuration.
 *
 * Session totals come from the host's in-memory per-session fold (the durable
 * ledger is device-wide, not session-keyed); quota windows come from the
 * shared overview poller.
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