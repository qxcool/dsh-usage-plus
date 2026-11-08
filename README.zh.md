# dsh-usage-plus

[English](README.md) | 中文

独立的 DSH 用量与官方 Plan 额度插件（Host + Web UI）。不锁定 DSH 版本；可选界面仅在运行中的 DSH 提供相应能力时启用。

[![dsh.pub 收录状态](https://dsh.pub/api/badges/qxcool/dsh-usage-plus.svg)](https://dsh.pub/zh/plugins/dsh-usage-plus/)

## 特性

- 自动复用 DSH 已配置模型的凭据，查询 Kimi Coding、GLM Coding Plan、OpenCode Go、MiniMax Coding Plan 与 Codex/ChatGPT 订阅额度。
- 在 `conversation.composer.dock`（与官方轮次 / Token / ContextMeter 同行）显示当前模型的真实 5 小时、每周、每月额度；服务端没有返回官方额度窗口时完全不显示。
- 插件页每个数字都带口径徽标（`全设备` / `账号级` / `本会话`），设备级合计不会被误读成会话级数字。
- 额度条按「每个会话选择的模型」解析：读取该会话 `modelSelection` 投影（composer 模型位 / `/model` 切换立即生效）。尚未产生会话选择时才回退到宿主当前路由；**会话已选中模型时绝不再串到其它会话或全局套餐**。
- 在「插件 → 使用统计」页按“模型配置自动查询 / CPAMC / 火山方舟”分组展示（DSH 0.1.7+ 配置表单位于 Plugins 页，草稿需点保存）。
- CPAMC 只允许回环地址（或 `cpamcAllowedHosts` 白名单），固定调用只读管理路由并拒绝重定向。
- 火山方舟使用 `VOLC_ACCESSKEY` / `VOLC_SECRETKEY` 对官方 OpenAPI 做 HMAC-SHA256 签名。
- 密钥始终留在 DSH 宿主进程 / 凭据库，不发送到浏览器。
- 保留实时 Token 台账、余额与趋势；概览提供完整 26 周（周一至周日）活动热图；台账默认保留 182 天。
- 插件页与输入框额度条共用一条条件请求轮询：请求不重叠，页面隐藏即暂停。
- 宿主按数据版本缓存概览文档：热轮询不再重新聚合台账，并用缓存 ETag 直接返回 `304`。

## 截图

### 输入框额度条（当前模型）

![输入框底部状态行（OpenCode Go 路由）：轮次/步数、总 token 与缓存命中率，以及紧凑的「额度 5h 63.5% · 周 78.2% · 月 18.4%」额度胶囊](docs/screenshots/composer-plan-strip.png)

当前模型命中套餐后，在 composer dock 状态条显示官方 5 小时 / 周 / 月额度的紧凑胶囊，环形标记最紧窗口；点开可看逐窗口进度条、重置时间与来源徽标（如「火山」）。无官方窗口时不渲染。

### 插件 → 使用统计 · 概览

![使用统计概览（全设备口径）：今日主数字与较昨日对比、近 30 天 / 累计 / 调用 / 平均成本、缓存命中率环、26 周（周一至周日）活动热力图（星期栏、按列对齐的月份标签、活跃天数与峰值）、账号级额度环、近 30 天提供方趋势、今日提供方明细与 Token 分桶，以及可展开的按日历史](docs/screenshots/settings-overview.png)

概览是一块仪表盘：今日主数字、作为主图的 26 周热力图、账号级额度环与近 30 天提供方排名。所有数字都带口径徽标（`全设备` / `账号级`），余额行只展示真实余额；套餐额度与外部数据源在同页其它标签中配置。

## 安装

按官方方式把本包加入 profile 的 bundle 层（会写入依赖并追加到 `dsh.profile.bundles`，从而应用包内 `cordis.patch.yml`）：

```bash
dsh plugin --profile desktop add github:qxcool/dsh-usage-plus
# 或从本地 checkout：
# dsh plugin --profile desktop add ./
```

GitHub 形式安装的是本仓库已提交的 `lib/` 构建产物；npm 包可能落后于 GitHub 版本，需要最新版时优先用 GitHub 形式。

包内已自带 patch（`id: usage-plus`，`name: dsh-usage-plus`）。若 profile 里仍有旧的 `@linxin666/dsh-usage` / `web-ui-usage`，请在 profile 的 `cordis.patch.yml` 中将其 `disabled: true`，避免 UI 重复。

## 外部数据源

普通模型 Provider 不需要重复配置密钥。CPAMC 与火山方舟需要在 DSH 凭据库或宿主环境变量中保存：

- `CPAMC_MANAGEMENT_KEY`
- `VOLC_ACCESSKEY`
- `VOLC_SECRETKEY`

然后在「插件 → 使用统计 → 设置」中启用相应独立数据源并点击**保存**。离开页面会丢弃未保存草稿（官方 `plugins.item` 约定）。CPAMC 默认地址为 `http://127.0.0.1:8317`。

## 模型体验（Model Experience）

- 额度条跟随**当前会话**的 `modelSelection`；会话已有路由时不会串用其它会话或全局套餐。
- 仅展示远端 Plan API 返回的真实窗口百分比，不用本地 Token 估算冒充额度。
- Token 台账与余额卡留在 Plugins 页，不注入对话正文。

## 已知限制（Known Limitations）

- 不锁定 DSH Desktop / Harness 版本；缺少 `configForms`、`plugins.item` 或 `conversation.composer.dock` 等可选能力时自动跳过对应界面，不影响 DSH 启动。
- 无官方 Plan API 的提供方不会显示额度条，也不会伪造窗口。
- CPAMC 仅允许回环（或白名单 host）；管理路由只读且拒绝重定向。
- 火山方舟需凭据库 AK/SK（或环境变量）；签名只在 Host 进程执行。
- 悬浮宠物气泡需 profile 中另有 pet 服务；`bubbleMode: off` 可关闭播报。

## 性能（Performance）

- **单条共享轮询。** 插件页与每个输入框额度条共用一次在途概览请求：突发触发合并为一次尾随请求，手动刷新排在进行中的读取之后，页面隐藏即暂停。
- **宿主缓存概览。** 每个数据版本最多重建一次；热读取直接用缓存 ETag 返回 `304 Not Modified`，不再重新聚合保留期台账（182 天 / 2 提供方 × 3 模型的实测热路径开销约 0.02 ms，此前约 5 ms；冷路径组装耗时不变）。
- **单遍聚合。** 26 周热图由一张预计算的按日表生成；累计窗口跳过页面不渲染的按模型明细。

## 开发（Development）

`pnpm typecheck`、`pnpm test`、`pnpm build` 覆盖插件质量门禁。无需登录 DSH Web GUI 即可预览界面：运行 `python scripts/preview/shot.py`，查看 `docs/screenshots/` 下的 PNG；详见 [scripts/preview/README.md](scripts/preview/README.md)。

## 准确性原则

Plan 页面与 composer 额度条只展示远端官方接口真实返回的窗口。没有 Plan API、没有百分比或查询失败时，不用本地 Token 估算冒充额度。

## 致谢与许可

项目基于 `@linxin666/dsh-usage`（Apache-2.0）独立演进；CPAMC 安全边界与火山方舟签名协议参考 `dsh-cost-meter`（MIT）。详见 [LICENSE](LICENSE)。
