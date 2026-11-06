import { Context } from "@deepseek-ai/cordis";
import "react";
import { EngineStoreInstance } from "@deepseek-ai/dsh-client-store";
//#region src/core/types.d.ts
/**
 * Wire-facing view types shared by the dsh-usage host service, its HTTP
 * routes, and the browser section. Everything here crosses the wire as JSON
 * and must stay provider-agnostic: provider quirks are normalized inside the
 * core adapters, never here.
 * @module @linxin666/dsh-usage/core/types
 */
/** One disjoint token bucket total, aggregated over calls (billed input = input + cacheRead + cacheWrite). */
interface UsageTokenTotals {
  /** Uncached input tokens. */
  inputTokens: number;
  /** Output tokens (reasoning included). */
  outputTokens: number;
  /** Cache read tokens. */
  cacheReadTokens: number;
  /** Cache write tokens. */
  cacheWriteTokens: number;
  /** Reasoning tokens, when the provider reported them. */
  reasoningTokens: number;
  /** Provider calls that reported usage. */
  calls: number;
  /**
   * Spend estimate stamped at fold time, in the priced provider's billing
   * currency (currently DeepSeek official only, CNY); every other provider
   * stays 0 = unpriced, so the sum is never a mixed-currency total. Persisted
   * buckets recorded before a price-book change keep the old pricing.
   */
  cost: number;
}
/** One provider row of the day summary the overview serves. */
interface UsageProviderSummary {
  provider: string;
  totals: UsageTokenTotals;
  /** Per-model breakdown, heaviest by total tokens first, capped by the route. */
  models: Array<{
    model: string;
    totals: UsageTokenTotals;
  }>;
}
/** One day row of the trend the overview serves. */
interface UsageDaySummary {
  date: string;
  totals: UsageTokenTotals;
}
/** A balance fact normalized from a provider probe. */
interface BalanceView {
  /** ISO 4217 code the provider bills in (`CNY`, `USD`, ...). */
  currency: string;
  /** Spendable total formatted for display (no currency symbol). */
  totalBalance: string;
  /** Epoch ms of the successful probe. */
  updatedAt: number;
}
/** One quota window of a coding plan. */
interface PlanWindowView {
  /** Stable window key the UI localizes (`5h`, `week`, `month`, provider strings otherwise). */
  key: string;
  /** Provider-supplied window name, when it sends one. */
  name?: string;
  /** Used percent 0-100, when computable. */
  percent?: number;
  /** ISO 8601 reset instant, when the provider reports one. */
  resetsAt?: string;
}
/** A coding-plan quota fact normalized from a provider probe. */
interface PlanView {
  /** Plan tier name, when the provider reports one. */
  planName?: string;
  windows: PlanWindowView[];
  updatedAt: number;
}
/** How the credential backing one provider route was resolved. */
type CredentialKind = 'api-key' | 'env' | 'oauth' | 'none';
/** One aggregated usage window (the 30-day trend, or the whole retained ledger). */
interface UsageWindowSummary {
  from: string;
  to: string;
  totals: UsageTokenTotals;
  providers: UsageProviderSummary[];
}
/** One provider row of the overview snapshot. */
interface ProviderSnapshotView {
  /** Provider route key (`deepseek`, `kimi-coding`, custom routes, ...). */
  provider: string;
  /** Where quota data came from; model routes remain the default. */
  source?: 'model' | 'cpamc' | 'volcano' | 'custom';
  /** Display name from the LLM runtime, else the adapter's, else the route key. */
  displayName: string;
  credential: CredentialKind;
  /** Whether any balance/plan adapter exists for this route. */
  supported: boolean;
  /** A balance adapter exists for this route (the Usage tab's balance card). */
  balanceSupported?: boolean;
  /** A coding-plan adapter exists for this route — the Plans tab lists these only. */
  planSupported?: boolean;
  balance?: BalanceView;
  plan?: PlanView;
  /** Last probe failure, cleared on the next success. */
  error?: string;
  updatedAt?: number;
}
/** Write-only external secret slots (CPAMC management token, Volcano AK/SK). */
type ExternalCredentialTarget = 'cpamc' | 'volcano.ak' | 'volcano.sk';
/**
 * Whether each external secret is present in the credential store or process
 * env. Values themselves never cross the wire — only these booleans do.
 */
interface ExternalCredentialStatus {
  cpamc: boolean;
  volcanoAk: boolean;
  volcanoSk: boolean;
}
/** The overview the browser section renders. */
interface UsageOverviewView {
  updatedAt: number;
  providers: ProviderSnapshotView[];
  /** The provider the pet bubble and the header highlight; `source` says how it was picked. */
  current: {
    provider?: string;
    model?: string;
    /** `live` — last request seen this boot; `default` — the agent default model. */
    source: 'live' | 'default';
    /**
     * Optional pi-ai / provider baseURL for the current route. The strip uses
     * this to bind Volcano / CPAMC external plans when the provider id itself
     * is a custom route name.
     */
    baseURL?: string;
  };
  /**
   * Configured/missing flags for CPAMC + Volcano secrets. Optional so an
   * older host document still renders the settings form without status chips.
   */
  externalCredentials?: ExternalCredentialStatus;
  usage: {
    today: {
      date: string;
      totals: UsageTokenTotals;
      providers: UsageProviderSummary[];
    };
    /** Last N local days ascending, including today. */
    days: UsageDaySummary[];
    /**
     * The same window aggregated per provider and model — the trend card's
     * bar-chart data. Optional so an older host document still renders.
     */
    range?: UsageWindowSummary;
    /**
     * The whole retained ledger (up to `retainDays`, today included)
     * aggregated per provider — the overview's all-time totals. Optional for
     * the same older-host tolerance as `range`.
     */
    all?: UsageWindowSummary;
  };
}
//#endregion
//#region src/client/usage-store.d.ts
/** Section UI state as consumers see it. */
interface UsageUiState {
  /** Latest host overview; null before the first successful fetch. */
  snapshot: UsageOverviewView | null;
  /** Fetch lifecycle. */
  status: 'loading' | 'ready' | 'error';
  /** Transport error message, when any. */
  error: string | null;
}
/** Store write set. */
type UsageUiActions = {
  /** Replace the overview (poll result). */
  setSnapshot: (draft: UsageUiState, snapshot: UsageOverviewView) => void;
  /** Mark the fetch lifecycle. */
  setState: (draft: UsageUiState, status: UsageUiState['status'], error: string | null) => void;
};
type UsageStoreInstance = EngineStoreInstance<UsageUiState, UsageUiActions>;
//#endregion
//#region src/client/UsageSectionCard.d.ts
/** The settings fields this section edits (staged Save via configForms.mutate). */
interface UsageSettings {
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
interface UsageConfigForm {
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
interface UsageSectionFace {
  /** The section-local store (overview snapshot + lifecycle). */
  store: UsageStoreInstance;
  /** Fetch one overview now. */
  poll: () => void;
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
interface UsageSectionProps extends UsageSectionFace {
  /**
   * Plugins page view discriminator (`PluginConfigViewProps.view`).
   * `summary` — one-liner under the card title; `page` — full form.
   */
  view?: 'summary' | 'page';
}
//#endregion
//#region src/client/index.d.ts
/**
 * Must match `USAGE_ENTRY_ID` / cordis.patch.yml `id: usage-plus`.
 * Host and client bundles compile separately, so this literal is duplicated.
 */
declare const USAGE_ENTRY_ID = "usage-plus";
/**
 * Required services.
 * configForms: Host entry forms keyed by profile entry id
 * (@see @deepseek-ai/dsh-client-ui-settings README).
 */
declare const inject: string[];
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
    /**
     * Conversation body views (对话 / 轨迹 / 上下文 / 编队 / 统计 …). The plugin
     * contributes 用量 here so session-scoped numbers sit with the other
     * session surfaces instead of the device-wide Plugins page.
     */
    'conversation.view': {
      kind: 'list';
      scope: 'session';
    };
  }
}
/**
 * Client plugin body: register dictionaries, the Plugins-page card (while the
 * Host serves `usage-plus`), and the composer plan strip.
 */
declare function apply(ctx: Context): void;
//#endregion
export { USAGE_ENTRY_ID, type UsageSectionFace, type UsageSectionProps, type UsageSettings, type UsageUiState, apply, inject };