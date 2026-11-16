# dsh-usage-plus

[中文](README.zh.md) | English

Independent DSH usage and official Plan-quota plugin (Host + Web UI). Requires DSH `>= 0.2.2-rc.3 < 0.3.0` and, for CLI/development, Node `>= 24.9.0`; older DSH releases are not supported. Optional UI surfaces activate only when the running DSH exposes the required capabilities.

[![dsh.pub registry status](https://dsh.pub/api/badges/qxcool/dsh-usage-plus.svg)](https://dsh.pub/en/plugins/dsh-usage-plus/)

- Reuses credentials already configured for DSH model providers.
- Shows real 5-hour, weekly, and monthly windows on `conversation.composer.dock` (alongside StatsPills / ContextMeter).
- Labels every Plugins-page number with its scope (`全设备` / `账号级` / `本会话`) so device-wide totals never read as session totals.
- Renders nothing when a provider exposes no official quota window.
- Keeps CPAMC and Volcano Ark as separate sources (plugin page → Settings).
- Overview includes a full 26-week Mon–Sun activity heatmap (ledger default 182 days).
- Keeps all secrets in the host process / credential vault.
- Shares one conditional-GET poller across the Plugins page and every composer strip; requests never overlap and a hidden tab pauses.
- Serves the overview from a per-revision host cache, so warm polls skip ledger aggregation and answer `304` from a cached ETag.
- Switches the usage window (7 / 30 / 90 / 182 days) on the overview and exports the aggregate ledger as CSV or JSON from the plugin page.
- Rebuilds an empty ledger from DSH session history on first install (bounded, retention-limited, marked in `backfill.json`; requires the session query service in the composition).
- Raises optional threshold alerts for today's priced spend, plan-window percentages and low CNY balances — in-page banners plus the existing pet bubble, de-duplicated by a configurable cooldown.
- Adds a data-health card in Settings: ledger coverage and size, retention, backfill state, probe freshness/failing providers, and preserved corrupt-file names.
- Reads official quota / balance endpoints for DeepSeek, Moonshot (CN/intl), Kimi For Coding, Anthropic Claude Pro/Max, GLM Coding Plan (CN/intl), OpenCode Go, MiniMax (CN/intl), Codex/ChatGPT, GitHub Copilot, OpenRouter, Vercel AI Gateway, SiliconFlow (CN/intl), ZenMux and NanoGPT.

## Provider coverage

| Provider route id(s) | Source | Fact |
|---|---|---|
| `deepseek` / `deepseek-official` | `api.deepseek.com/user/balance` | CNY balance |
| `moonshotai-cn` / `moonshotai` | Moonshot `/v1/users/me/balance` | CNY / USD balance |
| `kimi-coding` | Kimi For Coding usage API | 5-hour / weekly plan windows |
| `anthropic` | Claude Pro/Max OAuth usage (OAuth-only) | 5-hour / weekly windows |
| `zai` (`zai-coding` alias) / `zai-coding-cn` | GLM Coding Plan monitor API | plan windows |
| `opencode-go` | OpenCode Go usage API | rolling / weekly / monthly windows |
| `minimax-cn` / `minimax` | MiniMax coding-plan remains API | 5-hour / weekly windows |
| `openai-codex` | ChatGPT Codex usage (OAuth) | 5-hour / weekly windows |
| `github-copilot` | Copilot premium-request quota (OAuth) | monthly window |
| `openrouter` | OpenRouter credits API | USD balance |
| `vercel-ai-gateway` | Vercel AI Gateway credits API | USD balance |
| `siliconflow` / `siliconflow-cn` / `siliconflow-intl` | SiliconFlow user info | CNY / USD balance |
| `zenmux` | ZenMux PAYG balance API | USD balance |
| `nano-gpt` (hand-declared route) | NanoGPT check-balance API | USD balance |

CPAMC and Volcano Ark remain separate external sources configured in Settings. OAuth-only adapters (`anthropic`, `github-copilot`) are skipped — not error-reported — for API-key credentials; a route with no verified quota API shows no card or pill.

## Screenshots

### Composer plan strip (current model)

![Composer footer for an OpenCode Go route: turn/step counters, total tokens with cache hit rate, and the compact "额度 5h 63.5% · 周 78.2% · 月 18.4%" plan pill with an amber alert dot for a provider threshold alert](docs/screenshots/composer-plan-strip.png)

When the active model matches an official plan source, the composer dock shows a compact pill with the real 5-hour / weekly / monthly readings; the ring marks the tightest window. Open it for per-window bars, reset times, and the source chip (for example Volcano). Nothing is rendered when the remote API exposes no official window.

### Plugins → Installed plugins → dsh-usage-plus · Overview

![Usage overview (device-wide): a single-line threshold alert summary (daily spend, expandable for the rest) above a today hero figure with vs-yesterday comparator, 30-day / all-time / calls / average-cost stats, cache-hit ring, the 26-week Mon–Sun heatmap with weekday gutter, column-anchored month labels and active-day / peak facts, account-level quota rings, the provider trend over a selectable 7/30/90/182-day window, today's provider breakdown with token mix, and a collapsible per-day history](docs/screenshots/settings-overview.png)

The overview reads as one instrument panel: a hero figure for today, the 26-week heatmap as the main chart, account-level quota rings, and a provider ranking over a selectable 7 / 30 / 90 / 182-day window. Every figure is labelled with its scope (`全设备` / `账号级`); the balance line only lists real balances. Plan quotas, external sources and the aggregate CSV / JSON export live on the other tabs of the same plugin page.

### Settings · data export

![Settings tab with the 数据导出 card, the 告警 threshold group (enable switch, daily-cost limit, plan percent, low-balance amount, cooldown) and the 数据健康 card (ledger coverage/size, backfill state, probe freshness)](docs/screenshots/settings-export.png)

The aggregate ledger (daily × provider × model totals) exports as CSV or JSON for the selected window; files are generated locally and the download route is loopback-only.

## Install

Install into a DSH profile with the official plugin command (adds the dependency and appends the package to `dsh.profile.bundles` so `cordis.patch.yml` is applied):

```bash
dsh plugin --profile desktop add github:qxcool/dsh-usage-plus
# or from a local checkout:
# dsh plugin --profile desktop add ./
```

The GitHub form installs the committed `lib/` artifacts in this repository. The npm package may lag behind the GitHub release, so prefer the GitHub form when you want the current version. DSH `0.2.2-rc.3` or newer (below `0.3.0`) is required.

The package ships its own bundle patch (`id: usage-plus`, `name: dsh-usage-plus`).
If the older `@linxin666/dsh-usage` / `web-ui-usage` row is also present, disable it
in the profile patch to avoid duplicate UI.

Optional credential names are `CPAMC_MANAGEMENT_KEY`, `VOLC_ACCESSKEY`, and `VOLC_SECRETKEY`. Enable the matching source under **Plugins → Installed plugins → dsh-usage-plus → Settings**, then **Save**. Leaving the page discards an unsaved draft (official `plugins.bundle.config` contract).

## Model Experience

- Quota strip follows the **session** `modelSelection` projection (composer picker / `/model`). It does not fall through to another session’s or the global plan while this session already has a route.
- Windows are only shown when the remote Plan API returns real percentages; there is no local token estimate disguised as quota.
- Token ledger and balance cards stay on the Plugins page; they do not inject into the conversation transcript.

## Known Limitations

- Requires DSH `>= 0.2.2-rc.3 < 0.3.0`. Missing optional surfaces (`configForms`, `plugins.bundle.config`, `conversation.composer.dock`) are treated as unavailable capabilities instead of a startup failure.
- Historical backfill runs only when the ledger is empty and the composition mounts `sessionQuery`; an existing ledger is never re-counted.
- Alert episodes and pet-bubble cooldowns live in memory (a DSH restart starts a fresh episode); balance alerts compare CNY balances only, and the daily-cost alert counts priced routes (currently the official DeepSeek price book).
- Providers without an official Plan API show no strip and no fabricated windows.
- CPAMC accepts loopback origins (or hosts listed in `cpamcAllowedHosts`) only; management routes are read-only and reject redirects.
- Volcano Ark needs vaulted AK/SK (or `VOLC_ACCESSKEY` / `VOLC_SECRETKEY`); signing runs only in the Host process.
- Floating pet bubble announcements need a separate pet service in the profile; `bubbleMode: off` disables them.

## Performance

- **One shared poll loop.** The Plugins page and every composer strip share one in-flight overview read; burst triggers collapse into a trailing request, a manual refresh queues behind a read, and a hidden document pauses polling.
- **Cached host overview.** The host rebuilds the overview at most once per data revision; health filesystem facts ride a 2s TTL. Warm reads answer `304 Not Modified` from a cached ETag without re-aggregating the retained ledger.
- **One-pass aggregation.** The 26-week heatmap is built from one precomputed per-day table, and the all-time window skips the per-model rows the page never renders.
- **Quiet, cheap UI updates.** Bars change without animating layout (width transitions removed), the alert stack collapses to one summary line, and repeated per-card scope chips are replaced by one scope line, so a 10s poll repaints less chrome.

## Development

`pnpm typecheck`, `pnpm test`, and `pnpm build` cover the plugin. To review the Web UI without the authenticated DSH Web GUI, run `python scripts/preview/shot.py` and inspect the PNGs under `docs/screenshots/`; see [scripts/preview/README.md](scripts/preview/README.md).

## Accuracy

Plan UI and the composer strip only display windows returned by official remote APIs. Missing Plan API, missing percentages, or probe failures are never replaced with local estimates.

## License

Based on `@linxin666/dsh-usage` (Apache-2.0). CPAMC security constraints and Volcano signing behavior reference `dsh-cost-meter` (MIT). See [LICENSE](LICENSE).
