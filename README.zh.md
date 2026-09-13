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

## 安装

```bash
pnpm add dsh-usage-plus
```

```yaml
- insert:
    - id: usage-plus
      name: dsh-usage-plus
```

## 外部数据源

普通模型 Provider 不需要重复配置密钥。CPAMC 与火山方舟需要在 DSH 凭据库或宿主环境变量中保存：

- `CPAMC_MANAGEMENT_KEY`
- `VOLC_ACCESSKEY`
- `VOLC_SECRETKEY`

然后在“设置 → 使用统计 → 设置”中启用相应独立数据源。CPAMC 默认地址为 `http://127.0.0.1:8317`。

## 准确性原则

Plan 页面与输入框额度条只展示远端官方接口真实返回的窗口。没有 Plan API、没有百分比或查询失败时，不用本地 Token 估算冒充额度。

## 致谢与许可

项目基于 `@linxin666/dsh-usage`（Apache-2.0）独立演进；CPAMC 安全边界与火山方舟签名协议参考 `dsh-cost-meter`（MIT）。详见 [LICENSE](LICENSE)。
