import { EngineStoreInstance } from "@deepseek-ai/dsh-client-store";
import "react";
import { Context } from "@deepseek-ai/cordis";
import { SettingsScope, SettingsScopeSpec } from "@deepseek-ai/dsh-client-ui-settings/client";
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
/** Real spend observed from an official balance series rather than priced locally. */
interface ObservedSpendView {
  /** Accrued spend in the account currency (CNY for the DeepSeek official watch). */
  cny: number;
  /** Epoch ms of the first balance observation the accrual starts at. */
  since: number;
}
/** One provider row of the overview snapshot. */
interface ProviderSnapshotView {
  /** Provider route key (`deepseek`, `kimi-coding`, custom routes, ...). */
  provider: string;
  /** Where quota data came from; model routes remain the default. */
  source?: 'model' | 'cpamc' | 'volcano';
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
  };
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
     * aggregated per provider — the voucher's minted total. Optional for the
     * same older-host tolerance as `range`.
     */
    all?: UsageWindowSummary;
    /**
     * Real CNY spend of the official DeepSeek family, accrued from observed
     * decreases of the official balance (top-ups never count). Present once
     * a decrease has been observed; until then the section falls back to the
     * fold-time estimate.
     */
    observedSpend?: ObservedSpendView;
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
/** The settings fields this section edits (immediate-apply semantics). */
interface UsageSettings {
  enabled?: boolean;
  pollIntervalSec?: number;
  bubbleMode?: string;
  cpamcEnabled?: boolean;
  cpamcBaseURL?: string;
  cpamcManagementKeyEnv?: string;
  volcanoEnabled?: boolean;
  volcanoAccessKeyEnv?: string;
  volcanoSecretKeyEnv?: string;
}
/** The registration-side face the section's slot entry injects. */
interface UsageSectionFace {
  /** The section-local store (overview snapshot + lifecycle). */
  store: UsageStoreInstance;
  /** Fetch one overview now. */
  poll: () => void;
  /** Force a host probe cycle now (resolves with the fresh overview). */
  refresh: () => void;
  /** Whether a forced refresh is in flight (component-local state mirrors it). */
  settings: SettingsScope<UsageSettings>;
}
interface UsageSectionProps extends UsageSectionFace {
  /** Close the settings panel (the shell owns the open state). */
  close: () => void;
}
//#endregion
//#region src/client/index.d.ts
/** Required services. */
declare const inject: string[];
declare module '@deepseek-ai/cordis' {
  interface Context {
    /**
     * Optional rc.6 compatibility binder provided by dsh-web-settings;
     * absent when that group plugin is not installed, so callers fall back to
     * the official settings scope.
     */
    webUiSettings?: {
      bind<S>(spec: SettingsScopeSpec<S>): SettingsScope<S>;
    };
  }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'conversation.input.dock': {
      kind: 'list';
      scope: 'session-maybe';
    };
  }
}
/**
 * Client plugin body: register dictionaries and seat the settings section.
 * The overview poll loop and the store live with the section component's
 * mount cycle, so no background traffic exists while the page is closed.
 * @param ctx - client root context.
 */
declare function apply(ctx: Context): void;
//#endregion
export { type UsageSectionFace, type UsageSectionProps, type UsageSettings, type UsageUiState, apply, inject };
//# sourceMappingURL=client.d.ts.map