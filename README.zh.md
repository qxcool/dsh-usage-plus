# dsh-usage-plus

[English](README.md) | 中文

独立的 DSH 用量与官方 Plan 额度插件。

## 特性

- 自动复用 DSH 已配置模型的凭据，查询 Kimi Coding、GLM Coding Plan、OpenCode Go、MiniMax Coding Plan 与 Codex/ChatGPT 订阅额度。
- 在会话输入框下显示当前模型的真实 5 小时、每周、每月额度；服务端没有返回官方额度窗口时完全不显示。
- 设置页按“模型配置自动查询 / CPAMC / 火山方舟”分组展示。
- CPAMC 只允许回环地址，固定调用只读管理路由并拒绝重定向。
- 火山方舟使用 `VOLC_ACCESSKEY` / `VOLC_SECRETKEY` 对官方 OpenAPI 做 HMAC-SHA256 签名。
- 密钥始终留在 DSH 宿主进程，不发送到浏览器。
- 保留原 dsh-usage 的实时 Token 台账、余额、趋势和宠物气泡能力。
- 概览页提供完整 26 周（周一至周日）活动热图；台账默认保留 182 天。
- 可选「自定义 HTTP 余额」：HTTPS 查询 + 声明式提取规则，密钥通过 `{{VAR}}` 写入凭据库。

## 截图

### 输入框额度条（当前模型）

![输入框下方的火山方舟 Coding Plan 额度浮层：5 小时 / 每周 / 每月百分比与重置时间，旁侧环形进度与模型选择器同步显示 5h 用量](docs/screenshots/composer-plan-strip.png)

当前模型命中套餐后，在会话输入框旁显示官方 5 小时 / 周 / 月额度；悬停可看重置时间与来源徽标（如「火山」）。无官方窗口时不渲染。

### 设置 → 使用统计 · 概览

![设置页使用统计概览：今日 / 近 30 天 / 累计 Token 与调用、分桶、按提供方明细、账户余额与套餐入口](docs/screenshots/settings-overview.png)

概览汇总今日与近 30 天用量、缓存命中、Token 分桶与按提供方明细；余额卡只展示真实余额；套餐额度、Token 银行与外部数据源在同页其它标签中配置。

## 安装

按官方方式把本包加入 profile 的 bundle 层（会写入依赖并追加到 `dsh.profile.bundles`，从而应用包内 `cordis.patch.yml`）：

```bash
dsh plugin --profile desktop add ./
# 或从 npm / Git：
# dsh plugin --profile desktop add dsh-usage-plus
```

包内已自带 patch（`id: usage-plus`，`name: dsh-usage-plus`）。若 profile 里仍有旧的 `@linxin666/dsh-usage` / `web-ui-usage`，请在 profile 的 `cordis.patch.yml` 中将其 `disabled: true`，避免 UI 重复。

## 外部数据源

普通模型 Provider 不需要重复配置密钥。CPAMC 与火山方舟需要在 DSH 凭据库或宿主环境变量中保存：

- `CPAMC_MANAGEMENT_KEY`
- `VOLC_ACCESSKEY`
- `VOLC_SECRETKEY`

然后在“设置 → 使用统计 → 设置”中启用相应独立数据源。CPAMC 默认地址为 `http://127.0.0.1:8317`。

自定义 HTTP 余额同样在设置页配置（URL / 请求头 / 提取规则 / allowedHosts）。请求头里的 `{{API_KEY}}` 等变量会自动出现对应密钥输入框。目标域名还需加入本包 `package.json` → `dshhub.permissions.network`。

## 准确性原则

Plan 页面与输入框额度条只展示远端官方接口真实返回的窗口。没有 Plan API、没有百分比或查询失败时，不用本地 Token 估算冒充额度。

## 致谢与许可

项目基于 `@linxin666/dsh-usage`（Apache-2.0）独立演进；CPAMC 安全边界与火山方舟签名协议参考 `dsh-cost-meter`（MIT）。详见 [LICENSE](LICENSE)。
