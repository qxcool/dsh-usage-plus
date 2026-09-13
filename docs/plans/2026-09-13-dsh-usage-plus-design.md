# dsh-usage-plus 设计

## 目标

创建一个可独立安装、启用和卸载的 DSH 插件 `dsh-usage-plus`。插件保留原版使用统计、Provider 余额和 Plan 页面，并在输入框下方增加跟随当前模型切换的 5 小时/周/月额度条。

## 数据来源

- MiniMax、OpenCode Go、Kimi、GLM、Codex：使用官方只读额度接口。
- 火山方舟：使用 Coding Plan 管控面 AK/SK 签名接口。
- CPAMC：作为单独的 CLIProxyAPI 管理控制台数据源接入，只访问固定只读 Management API；Management Key 仅从 DSH 凭据库解析。
- 火山方舟：作为单独的数据源配置 AK/SK，不与普通模型 API Key 混用。
- NVIDIA、Xiaomi Token Plan、Agnes 等没有可验证官方 Plan/5 小时额度接口的 Provider 不显示额度，不提供本地估算。

## 架构

Host 层监听 `llm/stream` 并维护独立账本，Provider adapter 将不同官方响应归一化成 Plan 窗口。适配器优先从已有模型配置解析 Provider ID、Base URL 和凭据；CPAMC 与火山方舟使用各自独立配置。Client 层复用同一 overview store：设置页展示完整统计，`conversation.input.dock` 仅展示当前模型对应 Provider 的紧凑额度条。官方请求由 Host 缓存五分钟，Client 轮询只访问本地 DSH route。没有真实额度窗口时不渲染组件。

所有包名、bundle id、route、设置命名空间和数据目录均使用 `dsh-usage-plus`，避免与 `@linxin666/dsh-usage` 冲突。插件不依赖 `dsh-web-all` 或 `dsh-cost-meter`。

## 安全与失败处理

凭据不会发送到浏览器或写入账本。CPAMC 仅允许 loopback 或显式白名单主机，禁止重定向，并限制到固定管理路径。额度刷新失败时保留上次成功快照，在 UI 中显示简短错误；不会阻断模型调用和会话创建。

## 发布

项目作为独立 Git 仓库维护，包含构建产物、安装说明、许可证和 DSH bundle 元数据。验证通过后创建 GitHub 仓库，并准备插件市场可识别的描述与安装入口。
