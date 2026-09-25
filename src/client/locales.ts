/**
 * dsh-usage locale dictionaries (zh/en). The zh dictionary is the key source;
 * `en` mirrors its full key set (packages/AGENTS.md bilingual discipline).
 * @module @linxin666/dsh-usage/client/locales
 */

/** Dictionary namespace this package registers. */
export const NS = 'dsh-usage-plus'

/** Chinese copy. */
export const zh = {
  'usage.title': '使用统计',
  'usage.intro': '今日用量、套餐额度与外部数据源（CPAMC / 火山方舟）。',
  'usage.tab.usage': '概览',
  'usage.tab.plans': '套餐额度',
  'usage.tab.settings': '设置',
  'usage.refresh': '刷新',
  'usage.refreshing': '刷新中…',
  'usage.updated': '更新于 {time}',
  'usage.loading': '正在加载用量数据…',
  'usage.error': '加载失败：{error}',
  'usage.disabled': '插件已停用：在「插件 → 使用统计」中启用即可恢复。',
  'usage.current': '当前',
  'usage.today': '今日用量',
  'usage.today.cost': '今日消费',
  'usage.today.breakdown': '按提供方',
  'usage.hero.today': '今日消费',
  'usage.hero.month': '近 30 天消费',
  'usage.hero.tokens': '今日 Tokens',
  'usage.summary.today': '今日',
  'usage.summary.month': '近 30 天',
  'usage.summary.all': '累计',
  'usage.summary.cost': '费用',
  'usage.summary.tokens': 'Tokens',
  'usage.summary.calls': '调用',
  'usage.metric.month': '近 30 天',
  'usage.metric.avgCost': '平均成本',
  'usage.metric.avgCostHint': '按 {n} 次调用',
  'usage.metric.models': '{n} 个模型明细',
  'usage.peak.on': '高峰计价 ×2 · {time} 结束',
  'usage.peak.off': '空闲计价 · {time} 进入高峰',
  'usage.calls': '{n} 次调用',
  'usage.tokens.total': 'Tokens',
  'usage.tokens.input': '输入',
  'usage.tokens.output': '输出',
  'usage.tokens.cacheRead': '缓存读',
  'usage.tokens.cacheWrite': '缓存写',
  'usage.tokens.reasoning': '推理',
  'usage.tokens.calls': '调用',
  'usage.tokens.cacheHit': '缓存命中率',
  'usage.tokens.detail': '入 {input} · 出 {output}',
  'usage.tokens.cacheRatio': '{read} / {billed}',
  'usage.tokens.buckets': 'Token 分桶',
  'usage.expand': '展开模型',
  'usage.collapse': '收起',
  'usage.heatmap': '近 26 周活动',
  'usage.heatmap.weeks': '26 周 · 周一至周日',
  'usage.heatmap.empty': '暂无按日活动',
  'usage.heatmap.day': '{date} · {tokens} · {calls}{cost}',
  'usage.heatmap.less': '少',
  'usage.heatmap.more': '多',
  'usage.heatmap.dow.mon': '一',
  'usage.heatmap.dow.wed': '三',
  'usage.heatmap.dow.fri': '五',
  'usage.history': '按日历史',
  'usage.history.show': '展开最近 14 天',
  'usage.history.hide': '收起',
  'usage.history.empty': '暂无历史',
  'usage.trend': '近 30 天',
  'usage.trend.summary': '{tokens} · {calls}',
  'usage.noData': '暂无用量数据（统计自插件启用起）',
  'usage.balance': '账户余额',
  'usage.balance.empty': '暂无余额数据',
  'usage.balance.ok': '余额正常',
  'usage.balance.low': '余额偏低',
  'usage.balance.unsupported': '暂不支持余额查询',
  'usage.balance.noCredential': '未配置凭据',
  'usage.balance.noneConfigured': '没有已配置的提供方',
  'usage.balance.error': '查询失败',
  'usage.oauth': 'OAuth 凭据，不做余额查询',
  'usage.plan.preview': '当前套餐',
  'usage.plan.seeAll': '查看全部',
  'usage.plan.reset': '{date} 重置',
  'usage.plan.reset.soon': '即将重置',
  'usage.plan.reset.inHours': '{n} 小时后重置',
  'usage.plan.reset.inDays': '{n} 天后重置',
  'usage.plan.noPlan': '未检测到套餐数据',
  'usage.plan.noneConfigured': '没有已配置的套餐类 provider（如 Kimi、GLM、OpenCode Go、MiniMax、Codex 订阅）',
  'usage.plan.groupEmpty': '本组暂无数据',
  'usage.plan.groupCount': '{title}（{n}）',
  'usage.plan.windows.5h': '5 小时',
  'usage.plan.windows.5h.short': '5h',
  'usage.plan.windows.week': '每周',
  'usage.plan.windows.week.short': '周',
  'usage.plan.windows.month': '每月',
  'usage.plan.windows.month.short': '月',
  'usage.plan.group.models': '模型配置自动查询',
  'usage.plan.group.cpamc': 'CPAMC · CLI Proxy API 管理控制台',
  'usage.plan.group.volcano': '火山方舟',
  'usage.plan.source.model': '模型',
  'usage.plan.source.cpamc': 'CPAMC',
  'usage.plan.source.volcano': '火山',
  'usage.provider.error': '查询失败：{error}',
  'usage.errorListSeparator': '；',
  'usage.config.title': '插件设置',
  'usage.config.basic': '基础',
  'usage.config.display': '显示',
  'usage.config.external': '外部额度源',
  'usage.config.enabled': '启用插件',
  'usage.config.pollIntervalSec': '轮询间隔（秒）',
  'usage.config.bubbleMode': '悬浮气泡',
  'usage.config.bubbleMode.always': '常驻显示',
  'usage.config.bubbleMode.change': '仅变化时',
  'usage.config.bubbleMode.off': '关闭',
  'usage.config.cpamc': '启用 CPAMC 独立额度源',
  'usage.config.cpamcUrl': 'CPAMC 管理地址',
  'usage.config.cpamcUrl.placeholder': 'http://127.0.0.1:8317',
  'usage.config.cpamcUrl.invalid': '须为本机回环地址，或在 cpamcAllowedHosts 白名单内的主机（仅 origin，无路径），例如 http://127.0.0.1:8317。请勿填写聊天 API 网关。',
  'usage.config.cpamcToken': 'CPAMC Management Token',
  'usage.config.cpamcAllowedHosts': 'CPAMC 允许的 host（逗号分隔）',
  'usage.config.volcano': '启用火山方舟独立额度源',
  'usage.config.volcanoAk': '火山 Access Key (AK)',
  'usage.config.volcanoSk': '火山 Secret Key (SK)',
  'usage.config.secret.configured': '已配置',
  'usage.config.secret.missing': '未配置',
  'usage.config.secret.placeholder': '输入密钥后保存',
  'usage.config.secret.replace': '输入新密钥以覆盖',
  'usage.config.secret.save': '保存',
  'usage.config.secret.clear': '清除',
  'usage.config.externalHint': '密钥写入 DSH 凭据库（不明文落盘）。也可预先设置环境变量 CPAMC_MANAGEMENT_KEY、VOLC_ACCESSKEY、VOLC_SECRETKEY。CPAMC 仅允许本机 loopback 地址。',
  'usage.config.readonly': '当前配置为只读，请在宿主配置文件中修改。',
  'usage.config.save': '保存',
  'usage.config.saving': '保存中…',
  'usage.config.discard': '放弃',
  'usage.config.saveFailed': '保存失败，请重试。',
}

/** English mirror; every zh key present. */
export const en: Record<UsageKey, string> = {
  'usage.title': 'Usage Statistics',
  'usage.intro': 'Today’s usage, plan quotas, and external sources (CPAMC / Volcano).',
  'usage.tab.usage': 'Overview',
  'usage.tab.plans': 'Plan quotas',
  'usage.tab.settings': 'Settings',
  'usage.refresh': 'Refresh',
  'usage.refreshing': 'Refreshing…',
  'usage.updated': 'Updated {time}',
  'usage.loading': 'Loading usage data…',
  'usage.error': 'Failed to load: {error}',
  'usage.disabled': 'Plugin disabled. Re-enable it under Plugins → Usage Statistics.',
  'usage.current': 'Current',
  'usage.today': 'Today',
  'usage.today.cost': 'Today spend',
  'usage.today.breakdown': 'By provider',
  'usage.hero.today': 'Today spend',
  'usage.hero.month': '30-day spend',
  'usage.hero.tokens': 'Today tokens',
  'usage.summary.today': 'Today',
  'usage.summary.month': 'Last 30 days',
  'usage.summary.all': 'All time',
  'usage.summary.cost': 'Spend',
  'usage.summary.tokens': 'Tokens',
  'usage.summary.calls': 'Calls',
  'usage.metric.month': 'Last 30 days',
  'usage.metric.avgCost': 'Avg cost',
  'usage.metric.avgCostHint': 'across {n} calls',
  'usage.metric.models': '{n} model rows',
  'usage.peak.on': 'Peak pricing ×2 · ends {time}',
  'usage.peak.off': 'Off-peak pricing · peak returns {time}',
  'usage.calls': '{n} calls',
  'usage.tokens.total': 'Tokens',
  'usage.tokens.input': 'Input',
  'usage.tokens.output': 'Output',
  'usage.tokens.cacheRead': 'Cache read',
  'usage.tokens.cacheWrite': 'Cache write',
  'usage.tokens.reasoning': 'Reasoning',
  'usage.tokens.calls': 'Calls',
  'usage.tokens.cacheHit': 'Cache hit',
  'usage.tokens.detail': 'In {input} · Out {output}',
  'usage.tokens.cacheRatio': '{read} / {billed}',
  'usage.tokens.buckets': 'Token buckets',
  'usage.expand': 'Expand models',
  'usage.collapse': 'Collapse',
  'usage.heatmap': 'Last 26 weeks activity',
  'usage.heatmap.weeks': '26 weeks · Mon–Sun',
  'usage.heatmap.empty': 'No daily activity yet',
  'usage.heatmap.day': '{date} · {tokens} · {calls}{cost}',
  'usage.heatmap.less': 'Less',
  'usage.heatmap.more': 'More',
  'usage.heatmap.dow.mon': 'M',
  'usage.heatmap.dow.wed': 'W',
  'usage.heatmap.dow.fri': 'F',
  'usage.history': 'Daily history',
  'usage.history.show': 'Show last 14 days',
  'usage.history.hide': 'Hide',
  'usage.history.empty': 'No history yet',
  'usage.trend': 'Last 30 days',
  'usage.trend.summary': '{tokens} · {calls}',
  'usage.noData': 'No usage data yet (counting starts when the plugin is enabled)',
  'usage.balance': 'Balances',
  'usage.balance.empty': 'No balance data',
  'usage.balance.ok': 'Healthy',
  'usage.balance.low': 'Running low',
  'usage.balance.unsupported': 'Balance query not supported',
  'usage.balance.noCredential': 'No credential configured',
  'usage.balance.noneConfigured': 'No providers configured',
  'usage.balance.error': 'Query failed',
  'usage.oauth': 'OAuth credential, no balance query',
  'usage.plan.preview': 'Current plan',
  'usage.plan.seeAll': 'See all',
  'usage.plan.reset': 'resets {date}',
  'usage.plan.reset.soon': 'Resets soon',
  'usage.plan.reset.inHours': 'Resets in {n}h',
  'usage.plan.reset.inDays': 'Resets in {n}d',
  'usage.plan.noPlan': 'No plan data detected',
  'usage.plan.noneConfigured': 'No plan-capable provider configured (such as Kimi, GLM, OpenCode Go, MiniMax, Codex subscription)',
  'usage.plan.groupEmpty': 'Nothing in this group yet',
  'usage.plan.groupCount': '{title} ({n})',
  'usage.plan.windows.5h': '5 hours',
  'usage.plan.windows.5h.short': '5h',
  'usage.plan.windows.week': 'Weekly',
  'usage.plan.windows.week.short': 'Wk',
  'usage.plan.windows.month': 'Monthly',
  'usage.plan.windows.month.short': 'Mo',
  'usage.plan.group.models': 'Automatic model-provider queries',
  'usage.plan.group.cpamc': 'CPAMC · CLI Proxy API console',
  'usage.plan.group.volcano': 'Volcano Ark',
  'usage.plan.source.model': 'Model',
  'usage.plan.source.cpamc': 'CPAMC',
  'usage.plan.source.volcano': 'Volcano',
  'usage.provider.error': 'Query failed: {error}',
  'usage.errorListSeparator': '; ',
  'usage.config.title': 'Plugin settings',
  'usage.config.basic': 'Basics',
  'usage.config.display': 'Display',
  'usage.config.external': 'External quota sources',
  'usage.config.enabled': 'Enable plugin',
  'usage.config.pollIntervalSec': 'Poll interval (seconds)',
  'usage.config.bubbleMode': 'Floating bubble',
  'usage.config.bubbleMode.always': 'Always visible',
  'usage.config.bubbleMode.change': 'On change',
  'usage.config.bubbleMode.off': 'Off',
  'usage.config.cpamc': 'Enable the CPAMC quota source',
  'usage.config.cpamcUrl': 'CPAMC management URL',
  'usage.config.cpamcUrl.placeholder': 'http://127.0.0.1:8317',
  'usage.config.cpamcUrl.invalid': 'Must be a loopback origin or a host listed in cpamcAllowedHosts (no path), e.g. http://127.0.0.1:8317. Do not paste a chat API gateway URL.',
  'usage.config.cpamcToken': 'CPAMC management token',
  'usage.config.cpamcAllowedHosts': 'CPAMC allowed hosts (comma-separated)',
  'usage.config.volcano': 'Enable the Volcano Ark quota source',
  'usage.config.volcanoAk': 'Volcano Access Key (AK)',
  'usage.config.volcanoSk': 'Volcano Secret Key (SK)',
  'usage.config.secret.configured': 'Configured',
  'usage.config.secret.missing': 'Missing',
  'usage.config.secret.placeholder': 'Enter a secret, then save',
  'usage.config.secret.replace': 'Enter a new secret to replace',
  'usage.config.secret.save': 'Save',
  'usage.config.secret.clear': 'Clear',
  'usage.config.externalHint': 'Secrets are stored in the DSH credential vault (never written into config). You can also pre-set CPAMC_MANAGEMENT_KEY, VOLC_ACCESSKEY, and VOLC_SECRETKEY. CPAMC accepts loopback URLs only.',
  'usage.config.readonly': 'Settings are read-only. Edit the host config file instead.',
  'usage.config.save': 'Save',
  'usage.config.saving': 'Saving…',
  'usage.config.discard': 'Discard',
  'usage.config.saveFailed': 'Save failed. Please try again.',
}

export type UsageKey = keyof typeof zh

/**
 * Active dictionary, picked by the document language at call time. The
 * section resolves its copy the same tiny way the pet's DOM-injected surface
 * does (the settings section has no framework locale seat of its own).
 */
export function dictionary(): Record<UsageKey, string> {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'zh'
  return lang.toLowerCase().startsWith('en') ? en : zh
}

/** Translate a key with optional `{name}` template params; missing keys degrade to the key. */
export function t(key: string, params?: Record<string, unknown>): string {
  let text: string = (dictionary() as Record<string, string>)[key] ?? key
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

/** Relative plan-window reset copy; falls back to absolute locale string. */
export function formatPlanReset(iso?: string): string {
  if (iso === undefined || iso === '') return '—'
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return '—'
  const delta = target - Date.now()
  if (delta <= 0) return t('usage.plan.reset.soon')
  const hours = Math.round(delta / 3_600_000)
  if (hours < 48) return t('usage.plan.reset.inHours', { n: Math.max(1, hours) })
  const days = Math.round(delta / 86_400_000)
  return t('usage.plan.reset.inDays', { n: Math.max(1, days) })
}

/** Same origin rule as host `cpamcOrigin` (no path/userinfo/query), plus the allowlist. */
export function isCpamcLoopbackUrl(raw: string, allowedHosts?: string): boolean {
  try {
    const url = new URL(raw)
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return false
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'
    const allowed = String(allowedHosts ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item !== '')
    if (!loopback && !allowed.includes(url.hostname.toLowerCase())) return false
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Map host probe errors to actionable UI copy when we recognize them. */
export function friendlyProbeError(error: string | undefined): string | undefined {
  if (error === undefined || error === '') return undefined
  if (/loopback/i.test(error)) return t('usage.config.cpamcUrl.invalid')
  return error
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-usage UI copy. */
    'dsh-usage-plus': UsageKey
  }
}
