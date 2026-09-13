/**
 * dsh-usage locale dictionaries (zh/en). The zh dictionary is the key source;
 * `en` mirrors its full key set (packages/AGENTS.md bilingual discipline).
 * @module @linxin666/dsh-usage/client/locales
 */
/** Dictionary namespace this package registers. */
export declare const NS = "dsh-usage-plus";
/** Chinese copy. */
export declare const zh: {
    'usage.title': string;
    'usage.tab.usage': string;
    'usage.tab.plans': string;
    'usage.tab.bank': string;
    'usage.tab.settings': string;
    'usage.refresh': string;
    'usage.refreshing': string;
    'usage.updated': string;
    'usage.loading': string;
    'usage.error': string;
    'usage.disabled': string;
    'usage.current': string;
    'usage.today': string;
    'usage.today.cost': string;
    'usage.today.breakdown': string;
    'usage.hero.today': string;
    'usage.hero.month': string;
    'usage.hero.tokens': string;
    'usage.summary.today': string;
    'usage.summary.month': string;
    'usage.summary.all': string;
    'usage.summary.cost': string;
    'usage.summary.tokens': string;
    'usage.summary.calls': string;
    'usage.metric.month': string;
    'usage.metric.avgCost': string;
    'usage.metric.avgCostHint': string;
    'usage.metric.models': string;
    'usage.peak.on': string;
    'usage.peak.off': string;
    'usage.calls': string;
    'usage.tokens.total': string;
    'usage.tokens.input': string;
    'usage.tokens.output': string;
    'usage.tokens.cacheRead': string;
    'usage.tokens.cacheWrite': string;
    'usage.tokens.reasoning': string;
    'usage.tokens.calls': string;
    'usage.tokens.cacheHit': string;
    'usage.tokens.detail': string;
    'usage.tokens.cacheRatio': string;
    'usage.tokens.buckets': string;
    'usage.expand': string;
    'usage.collapse': string;
    'usage.heatmap': string;
    'usage.heatmap.weeks': string;
    'usage.heatmap.empty': string;
    'usage.heatmap.day': string;
    'usage.heatmap.less': string;
    'usage.heatmap.more': string;
    'usage.heatmap.dow.mon': string;
    'usage.heatmap.dow.wed': string;
    'usage.heatmap.dow.fri': string;
    'usage.history': string;
    'usage.history.empty': string;
    'usage.trend': string;
    'usage.trend.summary': string;
    'usage.noData': string;
    'usage.balance': string;
    'usage.balance.empty': string;
    'usage.balance.ok': string;
    'usage.balance.low': string;
    'usage.balance.unsupported': string;
    'usage.balance.noCredential': string;
    'usage.balance.noneConfigured': string;
    'usage.balance.error': string;
    'usage.oauth': string;
    'usage.plan.preview': string;
    'usage.plan.seeAll': string;
    'usage.plan.reset': string;
    'usage.plan.noPlan': string;
    'usage.plan.noneConfigured': string;
    'usage.plan.groupEmpty': string;
    'usage.plan.groupCount': string;
    'usage.plan.windows.5h': string;
    'usage.plan.windows.5h.short': string;
    'usage.plan.windows.week': string;
    'usage.plan.windows.week.short': string;
    'usage.plan.windows.month': string;
    'usage.plan.windows.month.short': string;
    'usage.plan.group.models': string;
    'usage.plan.group.cpamc': string;
    'usage.plan.group.volcano': string;
    'usage.plan.source.model': string;
    'usage.plan.source.cpamc': string;
    'usage.plan.source.volcano': string;
    'usage.provider.error': string;
    'usage.errorListSeparator': string;
    'usage.config.title': string;
    'usage.config.basic': string;
    'usage.config.display': string;
    'usage.config.external': string;
    'usage.config.enabled': string;
    'usage.config.pollIntervalSec': string;
    'usage.config.bubbleMode': string;
    'usage.config.bubbleMode.always': string;
    'usage.config.bubbleMode.change': string;
    'usage.config.bubbleMode.off': string;
    'usage.config.cpamc': string;
    'usage.config.cpamcUrl': string;
    'usage.config.cpamcToken': string;
    'usage.config.volcano': string;
    'usage.config.volcanoAk': string;
    'usage.config.volcanoSk': string;
    'usage.config.customBalance': string;
    'usage.config.customBalance.enabled': string;
    'usage.config.customBalance.label': string;
    'usage.config.customBalance.currency': string;
    'usage.config.customBalance.url': string;
    'usage.config.customBalance.method': string;
    'usage.config.customBalance.headers': string;
    'usage.config.customBalance.extract': string;
    'usage.config.customBalance.allowedHosts': string;
    'usage.config.customBalance.var': string;
    'usage.config.customBalance.hint': string;
    'usage.config.secret.configured': string;
    'usage.config.secret.missing': string;
    'usage.config.secret.placeholder': string;
    'usage.config.secret.replace': string;
    'usage.config.secret.save': string;
    'usage.config.secret.clear': string;
    'usage.config.externalHint': string;
    'usage.config.readonly': string;
    'usage.bank.title': string;
    'usage.bank.hint': string;
    'usage.bank.noUsage': string;
    'usage.bank.minted': string;
    'usage.bank.spend.observed': string;
    'usage.bank.spend.estimated': string;
    'usage.bank.window': string;
    'usage.bank.save': string;
    'usage.bank.share': string;
    'usage.bank.drawError': string;
};
/** English mirror; every zh key present. */
export declare const en: Record<UsageKey, string>;
export type UsageKey = keyof typeof zh;
/**
 * Active dictionary, picked by the document language at call time. The
 * section resolves its copy the same tiny way the pet's DOM-injected surface
 * does (the settings section has no framework locale seat of its own).
 */
export declare function dictionary(): Record<UsageKey, string>;
/** Translate a key with optional `{name}` template params; missing keys degrade to the key. */
export declare function t(key: string, params?: Record<string, unknown>): string;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** dsh-usage UI copy. */
        'dsh-usage-plus': UsageKey;
    }
}
//# sourceMappingURL=locales.d.ts.map