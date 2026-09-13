# dsh-usage-plus

[中文](README.zh.md) | English

An independent DSH usage and official Plan-quota plugin.

- Reuses credentials already configured for DSH model providers.
- Shows real 5-hour, weekly, and monthly windows under the conversation input.
- Renders nothing when a provider exposes no official quota window.
- Keeps CPAMC and Volcano Ark as separate sources.
- Overview includes a full 26-week Mon–Sun activity heatmap (ledger default 182 days).
- Optional custom HTTPS balance probe with declarative extract rules and vaulted `{{VAR}}` secrets.
- Keeps all secrets in the host process.

## Screenshots

### Composer plan strip (current model)

![Composer plan strip for Volcano Ark Coding Plan: 5h / week / month percents with reset times; the circular ring beside the model picker mirrors the 5h window](docs/screenshots/composer-plan-strip.png)

When the active model matches an official plan source, the conversation input shows real 5-hour / weekly / monthly windows. Hover for reset times and the source chip (for example Volcano). Nothing is rendered when the remote API exposes no official window.

### Settings → Usage · Overview

![Settings Usage overview: today / 30-day / all-time tokens and calls, token buckets, per-provider breakdown, account balance, and plan-quota entry](docs/screenshots/settings-overview.png)

The overview summarizes today and the last 30 days, cache hit rate, token buckets, and per-provider totals. The balance card only lists real balances. Plan quotas, Token Bank, and external sources live on the other tabs of the same settings page.

Install into a DSH profile with the official plugin command (this adds the dependency
and appends the package to `dsh.profile.bundles` so `cordis.patch.yml` is applied):

```bash
dsh plugin --profile desktop add ./
# or from npm / Git:
# dsh plugin --profile desktop add dsh-usage-plus
```

The package ships its own bundle patch (`id: usage-plus`, `name: dsh-usage-plus`).
If the older `@linxin666/dsh-usage` / `web-ui-usage` row is also present, disable it
in the profile patch to avoid duplicate UI.

Optional credential names are `CPAMC_MANAGEMENT_KEY`, `VOLC_ACCESSKEY`, and `VOLC_SECRETKEY`. See [README.zh.md](README.zh.md) for details.

Based on `@linxin666/dsh-usage` (Apache-2.0). CPAMC security constraints and Volcano signing behavior reference `dsh-cost-meter` (MIT).
