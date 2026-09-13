# dsh-usage-plus

[中文](README.zh.md) | English

An independent DSH usage and official Plan-quota plugin.

- Reuses credentials already configured for DSH model providers.
- Shows real 5-hour, weekly, and monthly windows under the conversation input.
- Renders nothing when a provider exposes no official quota window.
- Keeps CPAMC and Volcano Ark as separate sources.
- Keeps all secrets in the host process.

Install with `pnpm add dsh-usage-plus`, then add the bundled patch:

```yaml
- insert:
    - id: usage-plus
      name: dsh-usage-plus
```

Optional credential names are `CPAMC_MANAGEMENT_KEY`, `VOLC_ACCESSKEY`, and `VOLC_SECRETKEY`. See [README.zh.md](README.zh.md) for details.

Based on `@linxin666/dsh-usage` (Apache-2.0). CPAMC security constraints and Volcano signing behavior reference `dsh-cost-meter` (MIT).
