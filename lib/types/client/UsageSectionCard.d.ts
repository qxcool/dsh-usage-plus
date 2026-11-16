/**
 * The usage statistics settings section: overview (today's usage, plan
 * quotas, trend), plan windows, and settings. Data comes from the host's
 * loopback-fenced /api/dsh-usage-plus/overview document; polling runs only
 * while the section is mounted and the tab is visible.
 *
 * The overview is a quiet instrument panel: one hero figure for today, a
 * compact comparator group, then the 26-week activity heatmap and the account
 * quota rings as the two rich moments. Every derived value is formatted from
 * the host document; the component invents no numbers.
 * @module dsh-usage-plus/client/UsageSectionCard
 */
import { type ReactNode } from 'react';
import type { UsageStoreInstance } from './usage-store.ts';
import type { ExternalCredentialTarget } from '../core/types.ts';
import { type UsageRangeDays } from './usage-api.ts';
/** The settings fields this section edits (staged Save via configForms.mutate). */
export interface UsageSettings {
    enabled?: boolean;
    pollIntervalSec?: number;
    bubbleMode?: string;
    /** Master switch for threshold alerts (Overview banner + strip warning dot). */
    alertsEnabled?: boolean;
    /** Today's priced spend limit in CNY; 0 disables the daily-cost alert. */
    dailyCostLimitCny?: number;
    /** Tightest official plan window percent that raises an alert; 0 disables it. */
    planAlertPercent?: number;
    /** Known provider balance (CNY) below which an alert is raised; 0 disables it. */
    balanceAlertCny?: number;
    /** Minutes before the same alert kind/provider/window may bubble again. */
    alertCooldownMinutes?: number;
    cpamcEnabled?: boolean;
    cpamcBaseURL?: string;
    cpamcManagementKeyEnv?: string;
    cpamcAllowedHosts?: string;
    volcanoEnabled?: boolean;
}
/**
 * Subset of `ctx.configForms.get(entryId)` used by this page.
 * @see @deepseek-ai/dsh-client-ui-settings — Configuration forms
 */
export interface UsageConfigForm {
    getSnapshot(): {
        status: string;
        value?: UsageSettings;
        writable: boolean;
        revision?: number;
    };
    subscribe(listener: () => void): () => void;
    set(field: keyof UsageSettings, value: unknown): Promise<boolean>;
    /** Atomic multi-field write (preferred for Save on the bundle configuration page). */
    mutate(ops: ReadonlyArray<{
        op: 'set';
        path: readonly string[];
        value: unknown;
    } | {
        op: 'unset';
        path: readonly string[];
    }>, expectedRevision?: number): Promise<boolean>;
}
/** The registration-side face the bundle configuration page injects. */
export interface UsageSectionFace {
    /** The section-local store (overview snapshot + lifecycle). */
    store: UsageStoreInstance;
    /** Fetch one overview now. */
    poll: () => void;
    /** Select the overview window; the shared poller repolls with the new range. */
    setRangeDays: (days: UsageRangeDays) => void;
    /** Force a host probe cycle now (resolves with the fresh overview). */
    refresh: () => void;
    /** Shared configuration form for the `usage-plus` profile entry. */
    settings: UsageConfigForm;
    /** Acquire the shared composer-strip poller (same lifecycle as the dock strip). */
    startStripPolling: () => () => void;
    /** Write one external secret into the host credential store (write-only). */
    setCredential: (target: ExternalCredentialTarget, value: string) => Promise<void>;
    /** Remove one external secret from the host credential store. */
    clearCredential: (target: ExternalCredentialTarget) => Promise<void>;
}
export interface UsageSectionProps extends UsageSectionFace {
    /**
     * Plugins page view discriminator (`PluginConfigViewProps.view`).
     * `summary` — one-liner under the card title; `page` — full form.
     */
    view?: 'summary' | 'page';
}
/** Compact token count: 12345 -> 12.3k, 1234567 -> 1.23M. */
export declare function formatTokens(value: number): string;
/** The section component; the slot merges the face into these props. */
export declare function UsageSectionCard(props: UsageSectionProps): ReactNode;
//# sourceMappingURL=UsageSectionCard.d.ts.map