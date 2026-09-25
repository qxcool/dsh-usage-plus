/**
 * The usage statistics settings section: overview (today's usage, balances,
 * trend), plan quotas, and settings. Data comes from the host's
 * loopback-fenced /api/dsh-usage-plus/overview document; polling runs only
 * while the section is mounted and the tab is visible.
 * @module dsh-usage-plus/client/UsageSectionCard
 */
import { type ReactNode } from 'react';
import type { UsageStoreInstance } from './usage-store.ts';
import type { ExternalCredentialTarget } from '../core/types.ts';
/** The settings fields this section edits (staged Save via configForms.mutate). */
export interface UsageSettings {
    enabled?: boolean;
    pollIntervalSec?: number;
    bubbleMode?: string;
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
    /** Atomic multi-field write (preferred for Save on plugins.item pages). */
    mutate(ops: ReadonlyArray<{
        op: 'set';
        path: readonly string[];
        value: unknown;
    } | {
        op: 'unset';
        path: readonly string[];
    }>, expectedRevision?: number): Promise<boolean>;
}
/** The registration-side face the plugins.item slot injects. */
export interface UsageSectionFace {
    /** The section-local store (overview snapshot + lifecycle). */
    store: UsageStoreInstance;
    /** Fetch one overview now. */
    poll: () => void;
    /** Force a host probe cycle now (resolves with the fresh overview). */
    refresh: () => void;
    /** Shared configuration form for the `usage-plus` profile entry. */
    settings: UsageConfigForm;
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