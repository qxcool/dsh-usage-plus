/**
 * dsh-usage browser half — Plugins page (plugins.item) over the `usage-plus`
 * profile entry, plus the composer plan strip. Config reads/writes go through
 * `ctx.configForms` (DSH 0.1.7+); probing stays on the host.
 * @module dsh-usage-plus/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type UsageSettings } from './UsageSectionCard.tsx';
/**
 * Must match `USAGE_ENTRY_ID` / cordis.patch.yml `id: usage-plus`.
 * Host and client bundles compile separately, so this literal is duplicated.
 */
export declare const USAGE_ENTRY_ID = "usage-plus";
/**
 * Required services.
 * configForms: Host entry forms keyed by profile entry id
 * (@see @deepseek-ai/dsh-client-ui-settings README).
 */
export declare const inject: string[];
export type { UsageSectionProps, UsageSectionFace } from './UsageSectionCard.tsx';
export type { UsageUiState } from './usage-store.ts';
export type { UsageSettings };
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        /**
         * Composer bottom dock — below the input card, beside official StatsPills
         * and ContextMeter (DSH 0.1.7+ moved context/usage chrome here).
         */
        'conversation.composer.dock': {
            kind: 'list';
            scope: 'session';
        };
        /**
         * Official / third-party configuration page on the Plugins sidebar.
         * @see @deepseek-ai/dsh-client-ui-plugin-manager README — Configuration pages
         */
        'plugins.item': {
            kind: 'list';
            scope: 'root';
        };
    }
}
/**
 * Client plugin body: register dictionaries, the Plugins-page card (while the
 * Host serves `usage-plus`), and the composer plan strip.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map