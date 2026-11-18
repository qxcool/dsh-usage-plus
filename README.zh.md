# dsh-usage-plus

[English](README.md) | 中文

独立的 DSH 用量与官方 Plan 额度插件（Host + Web UI）。要求 DSH `>= 0.2.2-rc.3 < 0.3.0`；CLI / 开发环境要求 Node `>= 24.9.0`，不支持更旧的 DSH。可选界面仅在运行中的 DSH 提供相应能力时启用。

[![dsh.pub 收录状态](https://dsh.pub/api/badges/qxcool/dsh-usage-plus.svg)](https://dsh.pub/zh/plugins/dsh-usage-plus/)

## 特性

- 自动复用 DSH 已配置模型的凭据，查询 DeepSeek、Moonshot（国内/国际）、Kimi Coding、Anthropic Claude Pro/Max、GLM Coding Plan（国内/国际）、OpenCode Go、MiniMax（国内/国际）、Codex/ChatGPT、GitHub Copilot、OpenRouter、Vercel AI Gateway、SiliconFlow（国内/国际）、ZenMux 与 NanoGPT 的官方余额/额度。
- 在 `conversation.composer.dock`（与官方轮次 / Token / ContextMeter 同行）显示当前模型的真实 5 小时、每周、每月额度；服务端没有返回官方额度窗口时完全不显示。
- 插件页每个数字都带口径徽标（`全设备` / `账号级` / `本会话`），设备级合计不会被误读成会话级数字。
- 额度条按「每个会话选择的模型」解析：读取该会话 `modelSelection` 投影（composer 模型位 / `/model` 切换立即生效）。尚未产生会话选择时才回退到宿主当前路由；**会话已选中模型时绝不再串到其它会话或全局套餐**。
- 在「插件 → 已安装插件 → dsh-usage-plus」页按“模型配置自动查询 / CPAMC / 火山方舟”分组展示（配置表单位于插件详情页，草稿需点保存）。
- CPAMC 只允许回环地址（或 `cpamcAllowedHosts` 白名单），固定调用只读管理路由并拒绝重定向。
- 火山方舟使用 `VOLC_ACCESSKEY` / `VOLC_SECRETKEY` 对官方 OpenAPI 做 HMAC-SHA256 签名。
- 密钥始终留在 DSH 宿主进程 / 凭据库，不发送到浏览器。
- 保留实时 Token 台账、余额与趋势；概览提供完整 26 周（周一至周日）活动热图；台账默认保留 182 天。
- 插件页与输入框额度条共用一条条件请求轮询：请求不重叠，页面隐藏即暂停。
- 宿主按数据版本缓存概览文档：热轮询不再重新聚合台账，并用缓存 ETag 直接返回 `304`。
- 概览支持 7 / 30 / 90 / 182 天窗口切换，并可从插件页把聚合台账导出为 CSV 或 JSON。
- 首次安装时若台账为空，会从 DSH 会话历史回填既有用量（有界、受保留期限制，写入 `backfill.json` 标记；需要宿主组合挂载 session query 服务）。
- 可选阈值告警：今日已计价消费、套餐窗口百分比、人民币余额过低；页面横幅 + 复用宠物气泡，按可配置冷却时间去重。
- 设置页数据健康卡：台账覆盖与体积、保留期、回填状态（含跳过的 fork 继承事件数）、探测新鲜度/失败提供方、保留的损坏文件记录。
- 通用**自定义额度源**：任何白名单内 HTTPS 端点只要返回额度 JSON 即可接入，无需新增适配器。
- 历史回填会跳过 fork 继承的事件前缀，避免分叉会话被重复计数。
- **官方平台对账**：复用 DSH 已登录的 DeepSeek 平台会话（无需粘贴 token、无需登录表单），在概览展示官方本月消费、本地台账金额、活跃日覆盖率与差异。
- **USD 参考估算**：用 models.dev 公开价目估算所选窗口美元成本，明确标注“参考”并与人民币台账分开；已定价/未定价数量如实显示。
- 26 周热图可交互：点某天打开当日明细（提供方/模型行、调用、人民币费用），可切换强度指标（Tokens / 调用 / 费用），未来日期禁用。
- 输入框额度弹层内新增「本会话」摘要：计费 Tokens、官方口径缓存命中、上下文占用，以及 DeepSeek 路由的会话费用估算。

## 截图

### 输入框额度条（当前模型）

![输入框底部状态行（OpenCode Go 路由）：轮次/步数、总 token 与缓存命中率，以及紧凑的「额度 5h 63.5% · 周 78.2% · 月 18.4%」额度胶囊；右上角琥珀色小圆点表示该提供方有阈值告警](docs/screenshots/composer-plan-strip.png)

当前模型命中套餐后，在 composer dock 状态条显示官方 5 小时 / 周 / 月额度的紧凑胶囊，环形标记当前主窗口（默认 5 小时；周/月达到晋级阈值时切换）；点开可看逐窗口进度条、重置时间、来源徽标（如「火山」），以及「本会话」区块：计费 Tokens、官方口径缓存命中、上下文占用（估算时显示 `~`）与 DeepSeek 路由的会话费用估算（其它路由显示 `—`，非零会话不会显示成 `¥0.00`）。无官方窗口时不渲染。

![打开后的额度弹层（OpenCode Go 路由）：逐窗口进度条与重置时间，下方「本会话」区块（计费 Tokens、缓存命中、上下文占用、会话费用）](docs/screenshots/composer-plan-strip-open.png)

### 插件 → 已安装插件 → dsh-usage-plus · 概览

![使用统计概览（全设备口径）：顶部单行阈值告警摘要（日消费，可展开其余告警），下方为今日主数字与较昨日对比、近 30 天 / 累计 / 调用 / 平均成本与 USD 参考行、缓存命中率环、官方平台对账条、26 周可点击热力图（含指标切换、活跃天数与峰值）、账号级额度环、提供方趋势、今日提供方明细与 Token 分桶，以及可展开的按日历史](docs/screenshots/settings-overview.png)

概览是一块仪表盘：今日主数字、作为主图的 26 周热力图、账号级额度环与可切换 7 / 30 / 90 / 182 天窗口的提供方排名。所有数字都带口径徽标（`全设备` / `账号级`），余额行只展示真实余额。「官方平台对账」条对比官方 DeepSeek 平台本月消费与本地台账，并给出覆盖率与差异；USD 行是来自 models.dev 的独立参考，带 `已定价 n/total`，未定价模型不会被静默算成 0。套餐额度、外部数据源与聚合台账的 CSV / JSON 导出在同页其它标签中。

### 概览 · 当日明细

![选中热图某天：26 周网格下方展开「当日明细」面板，列出合计与各提供方/模型的 Tokens、调用次数与人民币费用，并提供「关闭」；网格头部有 Tokens / 调用 / 费用 指标切换](docs/screenshots/overview-day-detail.png)

点击任意热图格子会从回环路由读取该日数据，并在网格下方展开紧凑面板：合计、提供方/模型行、调用次数与人民币费用（未定价提供方显示 `—`）。再次点击同一格或点「关闭」收起；未来日期禁用；指标切换只改变同一分位档位的着色。方向键 / Home / End 可移动选择，网格带 `role="grid"` 语义与逐格标签。

### 设置 · 数据导出与数据源

![设置页：「数据导出」卡片、「告警」阈值分组（启用开关、日消费上限、套餐阈值、余额阈值、冷却时间）、「外部额度源」分组（官方平台对账、USD 参考估算、CPAMC 开关/地址/允许 host/token 与「测试连接」、火山 AK/SK、自定义额度源 JSON 编辑器与逐条「测试连接」）与「数据健康」卡片（台账覆盖/体积、回填状态、探测新鲜度）](docs/screenshots/settings-export.png)

聚合台账（按日 × 提供方 × 模型合计）可按所选窗口导出为 CSV 或 JSON；文件在本机生成，下载路由仅允许回环地址。「官方平台对账」与「USD 参考估算」都可单独关闭（前者是控制台内部接口，后者需要联网取价目）；默认开启，不可用时静默降级。自定义额度源编辑器在失焦时把合法 JSON 格式化，并在内联显示被拒绝的字段，每条计划都有独立的「测试连接」。

## 自定义额度源

**设置 → 外部额度源 → 自定义额度源（JSON）** 接受一个 JSON 数组，每个端点都会成为「套餐额度」页的普通卡片，路由匹配时也会显示额度胶囊；不需要写适配器。

```json
[
  {
    "id": "my-plan",
    "name": "我的套餐",
    "url": "https://quota.example.com/usage",
    "allowedHosts": ["quota.example.com"],
    "tokenEnv": "MY_PLAN_TOKEN",
    "headers": { "x-tenant": "${env:MY_TENANT}" }
  }
]
```

| 字段 | 规则 |
|---|---|
| `id` | 必填，小写字母/数字/连字符，≤32 字符，唯一；路由 id 为 `custom:<id>`。 |
| `name` | 显示名，缺省用 id。 |
| `url` | 必填。绝对 URL，不含凭据/片段；除回环外必须是 **https**。 |
| `allowedHosts` | 远程主机必填：域名必须列在此处（回环不需要）。 |
| `tokenEnv` | 可选。存放 Bearer 密钥的环境变量名，只发往宿主，不回传浏览器。 |
| `headers` | 可选。安全 header 名（不允许 `host`、`content-length`、`connection`、`accept-encoding`、`authorization`）；值可写字面量或 `${env:NAME}`，仅在宿主侧解析。 |

支持两种返回形状（任选其一；未知标签跳过，缺失百分比不编造）：

```json
{ "usage": { "rolling": { "percent": 41, "resetsAt": "2026-11-17T02:00:00Z" },
             "weekly":  { "percent": 68 }, "monthly": { "percent": 22 } } }
```
```json
{ "windows": [ { "label": "5h", "percent": 41, "resetAt": 1763344800 },
               { "label": "week", "percent": 68 } ] }
```

百分比可写 0..100 或 0..1 小数；重置时间接受 epoch 秒/毫秒或 ISO 字符串；标签别名 `5h|rolling|session`、`weekly|week|7d`、`monthly|month|30d`。探测规则：8 秒超时、拒绝重定向、仅回环/白名单主机、最多 12 条，失败按条目返回类型化错误（并可逐个「测试连接」）。JSON 里被拒绝的字段会内联显示，例如 `#1 url: …`（见设置截图）；通过校验的条目还会各自显示一张卡片与「测试连接」。

## 官方平台对账与 USD 参考

**官方平台对账**把 DeepSeek 官方平台控制台的当月消费与本地台账对比。它复用 DSH 已保存的 DeepSeek 账号会话（`deepseek-account-platform/default` 或 `deepseekAccount.getPlatformSession()`），带控制台需要的客户端头发往 `platform.deepseek.com`，读取 `get_user_summary`（人民币钱包 / 累计消费）与 `usage/cost`（当月逐日消费）。展示三件事：

- `官方本月 ¥X · 本地 ¥Y`：本地只统计台账里的 DeepSeek 路由，保证两边描述同一笔钱；
- `覆盖 n%`：官方活跃日中有本地台账记录的比例，本地只采到一部分时一眼可见，而不是显得像账不平；
- `差异 ±¥D`：官方减本地。

该接口是控制台的**内部、未公开** API，因此全链路尽力而为：未登录 → 整条隐藏（不报错、不联网）；会话过期 → 一行灰色提示并可刷新重试；429/5xx 重试一次；10s 超时；任何情况都不抛出、不阻塞轮询。可在**设置 → 官方平台对账**关闭。归一化逻辑改编自 [DeepSeek-Usage](https://github.com/sdiwenchen-lang/DeepSeek-Usage)（MIT）。

**USD 参考估算**用公开的 [models.dev](https://models.dev/api.json) 价目估算所选窗口。价目为 `{缓存未命中输入, 缓存读取, 缓存写入, 输出}` 的美元/百万 Token；路由/模型匹配顺序是精确键 → 文档化的提供方别名表 → 价目表的 canonical model id → 模型短名，真正歧义时保持**未定价**而不是猜。界面显示 `≈$0.42 USD 参考 · 已定价 12/15 模型` 与 `另有 n 次调用未定价`，且永不与人民币相加。价目表原子写入 `pricing-book.json` 并缓存 24 小时，抓取失败时离线使用缓存。可在**设置 → USD 参考估算**关闭。

## 安装

按官方方式把本包加入 profile 的 bundle 层（会写入依赖并追加到 `dsh.profile.bundles`，从而应用包内 `cordis.patch.yml`）：

```bash
dsh plugin --profile desktop add github:qxcool/dsh-usage-plus
# 或从本地 checkout：
# dsh plugin --profile desktop add ./
```

GitHub 形式安装的是本仓库已提交的 `lib/` 构建产物；npm 包可能落后于 GitHub 版本，需要最新版时优先用 GitHub 形式。要求 DSH `0.2.2-rc.3` 或更新（低于 `0.3.0`）。

包内已自带 patch（`id: usage-plus`，`name: dsh-usage-plus`）。若 profile 里仍有旧的 `@linxin666/dsh-usage` / `web-ui-usage`，请在 profile 的 `cordis.patch.yml` 中将其 `disabled: true`，避免 UI 重复。

## 提供方覆盖

| 提供方路由 id | 数据来源 | 事实 |
|---|---|---|
| `deepseek` / `deepseek-official` | `api.deepseek.com/user/balance` | 人民币余额 |
| `moonshotai-cn` / `moonshotai` | Moonshot `/v1/users/me/balance` | 人民币 / 美元余额 |
| `kimi-coding` | Kimi For Coding 用量 API | 5 小时 / 周窗口 |
| `anthropic` | Claude Pro/Max OAuth 用量（仅 OAuth） | 5 小时 / 周窗口 |
| `zai`（`zai-coding` 别名）/ `zai-coding-cn` | GLM Coding Plan 监控 API | 套餐窗口 |
| `opencode-go` | OpenCode Go 用量 API | 滚动 / 周 / 月窗口 |
| `minimax-cn` / `minimax` | MiniMax coding-plan remains API | 5 小时 / 周窗口 |
| `openai-codex` | ChatGPT Codex 用量（OAuth） | 5 小时 / 周窗口 |
| `github-copilot` | Copilot premium 额度（OAuth） | 月窗口 |
| `openrouter` | OpenRouter credits API | 美元余额 |
| `vercel-ai-gateway` | Vercel AI Gateway credits API | 美元余额 |
| `siliconflow` / `siliconflow-cn` / `siliconflow-intl` | SiliconFlow 用户信息 | 人民币 / 美元余额 |
| `zenmux` | ZenMux PAYG 余额 API | 美元余额 |
| `nano-gpt`（需手工声明路由） | NanoGPT check-balance API | 美元余额 |

CPAMC 与火山方舟仍作为独立外部数据源在设置页配置。仅 OAuth 的适配器（`anthropic`、`github-copilot`）在 API Key 凭据下会直接跳过而不是报错；没有可验证额度 API 的路由不显示卡片或额度条。

## 外部数据源

普通模型 Provider 不需要重复配置密钥。CPAMC 与火山方舟是可选独立数据源，凭据可写入 DSH 凭据库或宿主环境变量（`CPAMC_MANAGEMENT_KEY`、`VOLC_ACCESSKEY`、`VOLC_SECRETKEY`）。

### CPAMC 配置

CPAMC（CLI Proxy API 管理端）用于读取 CPAMC 中已汇集的 **codex / kimi / claude** 账号额度。插件只读两个管理接口（`GET /v0/management/auth-files`、`POST /v0/management/api-call`），不会写入。

1. 在 DSH 宿主可访问的位置运行 CPAMC：本机为 `http://127.0.0.1:8317`；远程为 HTTPS origin，例如 `https://api.example.com`（不能带路径）。
2. 在 CPAMC 服务端开启 management key（控制台请求头 `x-management-key` 用的那个 key）。
3. 在「插件 → 已安装插件 → dsh-usage-plus → 设置 → 外部额度源」填写：
   - **启用 CPAMC 独立额度源**：打开；
   - **CPAMC 管理地址**：只填 origin（`http://127.0.0.1:8317` 或 `https://api.example.com`）；带 `/v0`、`/v1` 路径或聊天 API 网关地址会被拒绝；
   - **CPAMC 允许的 host**：仅远程需要，逗号分隔域名、不含协议和端口，例如 `api.example.com`；
   - **CPAMC Management Token**：management key，写入 DSH 凭据库（或预先设置 `CPAMC_MANAGEMENT_KEY`），不会回传浏览器。
4. 点击**保存**，再点新增的**测试连接**按钮：它会调用同样的只读管理接口，返回延迟、可读账号数与前几个额度窗口，失败时给出具体修复提示。
5. 也可用命令行验证：
   ```bash
   curl -fsS -H "x-management-key: $CPAMC_MANAGEMENT_KEY" \
     http://127.0.0.1:8317/v0/management/auth-files
   # 远程：
   curl -fsS -H "x-management-key: $CPAMC_MANAGEMENT_KEY" \
     https://api.example.com/v0/management/auth-files
   ```

| 测试结果 | 含义 / 处理 |
|---|---|
| `fetch failed (ECONNREFUSED)` | 该 origin 没有服务监听。启动本机 CPAMC，或把管理地址改成远程 origin 并把域名加入允许 host。 |
| `CPAMC HTTP 401/403` | Management Token 错误，或 CPAMC 服务端未开启 management key。 |
| `CPAMC redirect refused` | origin 发生重定向（常见 http→https 或反代）。直接填写最终 HTTPS origin。 |
| `URL must be a loopback origin …` | 管理地址含路径 / 协议拼写错误 / 主机不在允许 host 列表。 |
| `no quota accounts returned` | CPAMC 连通，但没有带可读额度接口的 codex / kimi / claude 账号。 |

只读取账号级套餐窗口；CPAMC 不提供余额，其它类型账号会被忽略。

## 模型体验（Model Experience）

- 额度条跟随**当前会话**的 `modelSelection`；会话已有路由时不会串用其它会话或全局套餐。
- composer 环形额度**默认显示 5 小时窗口**，因为它最先限制当前工作的会话；只有周/月额度达到**晋级阈值**（默认 100%，即真正用尽）时才替换显示——也可以在设置里调低（如 95%）更早切换。此时弹层把已满窗口标成危险色并显示「已满」；只是偏高的较长窗口保持自身警戒色，但不会抢走环形。
- 仅展示远端 Plan API 返回的真实窗口百分比，不用本地 Token 估算冒充额度。
- Token 台账与余额卡留在 Plugins 页，不注入对话正文。

## 已知限制（Known Limitations）

- 要求 DSH `>= 0.2.2-rc.3 < 0.3.0`；缺少 `configForms`、`plugins.bundle.config` 或 `conversation.composer.dock` 等可选能力时自动跳过对应界面，不影响 DSH 启动。
- 历史回填仅在台账为空且宿主组合挂载 `sessionQuery` 时执行；已有台账不会被重复计数。
- 回填会跳过 fork 继承的事件前缀（优先用 `readSession` 的 `inheritedEventCount`，缺省则跳过早于 fork `createdAt` 的事件），跳过数量会显示在数据健康卡。
- 自定义额度源的密钥只从宿主环境变量读取（`tokenEnv` / `${env:NAME}`），因此需要导出到 DSH 进程环境中，而不是保存在设置字段里。
- 升级后重新加载的客户端可能短暂运行在旧 Host 进程之上：此时告警字段会隐藏、旧设置仍可保存；重启 DSH 加载新 Host 后，健康信息、告警和新适配器才会生效。
- 告警事件与宠物气泡冷却保存在内存中（DSH 重启会重新开始一个事件）；余额告警只比较人民币余额，日消费告警只统计已计价路由（目前为 DeepSeek 官方价格表）。
- 官方平台对账依赖控制台内部 API，因此也依赖已登录的 DeepSeek 平台账号；可关闭或静默不可用，数字是官方账单事实而非本地采样。
- USD 估算只是**参考**，不是账单真值：models.dev 价目可能落后于实际发票，展示的是基础价（忽略阶梯 / 长上下文价），未定价模型只计数不估算。
- 会话人民币费用是单点价格估算（用当前 DeepSeek 峰/谷价套会话 Token 分桶）；官方会话投影没有逐次调用时间戳和模型拆分。
- 无官方 Plan API 的提供方不会显示额度条，也不会伪造窗口。
- CPAMC 仅允许回环（或白名单 host）；管理路由只读且拒绝重定向。
- 火山方舟需凭据库 AK/SK（或环境变量）；签名只在 Host 进程执行。
- 悬浮宠物气泡需 profile 中另有 pet 服务；`bubbleMode: off` 可关闭播报。

## 性能（Performance）

- **单条共享轮询。** 插件页与每个输入框额度条共用一次在途概览请求：突发触发合并为一次尾随请求，手动刷新排在进行中的读取之后，页面隐藏即暂停。
- **宿主缓存概览。** 每个数据版本最多重建一次；数据健康的文件系统事实带 2s TTL。热读取直接用缓存 ETag 返回 `304 Not Modified`，不再重新聚合保留期台账。
- **单遍聚合。** 26 周热图由一张预计算的按日表生成；累计窗口跳过页面不渲染的按模型明细。
- **安静、低开销的界面刷新。** 进度条不再动画布局宽度；告警收成单行摘要；重复的卡片口径徽标改为一行口径说明，10s 轮询重绘的装饰更少。
- **不占关键路径。** 官方平台读取（2 分钟 TTL）与 models.dev 价目（24 小时缓存）都在后台刷新，不拖慢轮询；当日明细是独立回环路由，只读台账中的某一天，不重新聚合整个窗口。

## 开发（Development）

`pnpm typecheck`、`pnpm test`、`pnpm build` 覆盖插件质量门禁。无需登录 DSH Web GUI 即可预览界面：运行 `python scripts/preview/shot.py`，查看 `docs/screenshots/` 下的 PNG；详见 [scripts/preview/README.md](scripts/preview/README.md)。

## 准确性原则

Plan 页面与 composer 额度条只展示远端官方接口真实返回的窗口。没有 Plan API、没有百分比或查询失败时，不用本地 Token 估算冒充额度。

## 致谢与许可

项目基于 `@linxin666/dsh-usage`（Apache-2.0）独立演进；CPAMC 安全边界与火山方舟签名协议参考 `dsh-cost-meter`（MIT）。详见 [LICENSE](LICENSE)。
