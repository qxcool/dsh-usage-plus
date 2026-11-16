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
- Reconciles **official DeepSeek platform billing** with the local ledger (month spend, active-day coverage, signed delta) using the account session DSH already holds — no token pasting, no login form.
- Estimates the selected window in **USD** from the public models.dev price book, labelled as a reference and never mixed with the CNY ledger; priced/unpriced coverage is explicit.
- Makes the 26-week heatmap a control: click a day for its provider/model detail, switch the intensity metric (tokens / calls / cost), and future days are disabled.
- Shows a **this-session** summary inside the composer quota popover (billed tokens, official cache hit, context occupancy, and an estimated DeepSeek CNY session cost).
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

When the active model matches an official plan source, the composer dock shows a compact pill with the real 5-hour / weekly / monthly readings; the ring marks the tightest window. Open it for per-window bars, reset times, the source chip (for example Volcano), and a **本会话** block: billed tokens, cache hit on the official denominator, context occupancy (`~` when projected), and an estimated CNY session cost for DeepSeek routes (`—` elsewhere; never `¥0.00` for a non-zero session). Nothing is rendered when the remote API exposes no official window.

![Open quota popover for an OpenCode Go route: per-window bars with reset times plus the 本会话 block (计费 Tokens, 缓存命中, 上下文占用, 会话费用)](docs/screenshots/composer-plan-strip-open.png)

### Plugins → Installed plugins → dsh-usage-plus · Overview

![Usage overview (device-wide): a single-line threshold alert summary (daily spend, expandable for the rest) above a today hero figure with vs-yesterday comparator, 30-day / all-time / calls / average-cost stats with a USD reference line, cache-hit ring, the official platform reconcile strip, the 26-week Mon–Sun clickable heatmap with metric toggle and active-day / peak facts, account-level quota rings, the provider trend over a selectable 7/30/90/182-day window, today's provider breakdown with token mix, and a collapsible per-day history](docs/screenshots/settings-overview.png)

The overview reads as one instrument panel: a hero figure for today, the 26-week heatmap as the main chart, account-level quota rings, and a provider ranking over a selectable 7 / 30 / 90 / 182-day window. Every figure is labelled with its scope (`全设备` / `账号级`); the balance line only lists real balances. The **官方平台对账** strip compares the official DeepSeek platform month spend with the local ledger and states its coverage and delta; the USD line is a separately labelled reference from models.dev, with `已定价 n/total` so an unpriced model is visible instead of silently zero. Plan quotas, external sources and the aggregate CSV / JSON export live on the other tabs of the same plugin page.

### Overview · day detail

![Selected heatmap day: the 当日明细 panel under the 26-week grid listing totals plus per-provider/per-model tokens, calls and CNY cost, with 关闭 and the Tokens / 调用 / 费用 metric toggle in the grid header](docs/screenshots/overview-day-detail.png)

Clicking any heatmap cell fetches that local day from a loopback-only route and opens a compact panel under the grid: totals, provider and model rows, calls, and CNY cost (`—` when a provider is unpriced). Clicking the same cell again or 关闭 clears it; future dates are disabled; the metric toggle re-levels the same quartile buckets. Arrow keys / Home / End move the selection, and the grid exposes `role="grid"` semantics with per-cell labels.

### Settings · data export and sources

![Settings tab with the 数据导出 card, the 告警 threshold group (enable switch, daily-cost limit, plan percent, low-balance amount, cooldown), the 外部额度源 group (官方平台对账, USD 参考估算, CPAMC enabled/url/allowed hosts/token with 测试连接, Volcano keys) and the 数据健康 card (ledger coverage/size, backfill state, probe freshness)](docs/screenshots/settings-export.png)

The aggregate ledger (daily × provider × model totals) exports as CSV or JSON for the selected window; files are generated locally and the download route is loopback-only. `官方平台对账` and `USD 参考估算` can each be switched off (the platform read is an internal console API and the USD book is a network fetch); both default on, and both degrade silently when unavailable.

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

## CPAMC setup

CPAMC (CLI Proxy API management console) is an optional external source: it exposes account-level quota for the **codex / kimi / claude** auth files already pooled in CPAMC. The plugin reads only two management routes (`GET /v0/management/auth-files` and `POST /v0/management/api-call`) and never writes.

1. **Run CPAMC** where the DSH host can reach it:
   - local: `http://127.0.0.1:8317` (the CPAMC default port);
   - remote: an HTTPS origin such as `https://api.example.com` (no path).
2. **Enable its management API/key** in the CPAMC server config (the key the console sends as `x-management-key`).
3. Fill **Settings → 外部额度源 → CPAMC**:
   - **启用 CPAMC 独立额度源** — switch it on;
   - **CPAMC 管理地址** — origin only (`http://127.0.0.1:8317` or `https://api.example.com`). A URL with a path (/v0, /v1) or a chat-completions gateway is rejected;
   - **CPAMC 允许的 host** — remote only: comma-separated hostnames without scheme or port, e.g. `api.example.com`. Loopback never needs it;
   - **CPAMC Management Token** — the management key. It is written to the DSH credential vault (or pre-set `CPAMC_MANAGEMENT_KEY`), never returned to the browser.
4. **Save**, then press **测试连接**. The button calls the same read-only management routes and reports latency, the number of readable accounts and the first plan windows — or a concrete failure hint.
5. Verify from a shell when needed:
   ```bash
   curl -fsS -H "x-management-key: $CPAMC_MANAGEMENT_KEY" \
     http://127.0.0.1:8317/v0/management/auth-files
   # remote:
   curl -fsS -H "x-management-key: $CPAMC_MANAGEMENT_KEY" \
     https://api.example.com/v0/management/auth-files
   ```

| Test result | Meaning / fix |
|---|---|
| `fetch failed (ECONNREFUSED)` | Nothing is listening on that origin. Start CPAMC locally, or set the management URL to the remote origin and add its hostname to 允许的 host. |
| `CPAMC HTTP 401/403` | The management token is wrong or the server has management key disabled. |
| `CPAMC redirect refused` | The origin redirects (often http→https or a reverse proxy). Use the final HTTPS origin directly. |
| `URL must be a loopback origin …` | The management URL has a path, scheme typo, or a host not in 允许的 host. |
| `no quota accounts returned` | CPAMC is reachable but has no codex / kimi / claude auth file with a readable quota endpoint. |

Only account-level plan windows are read; CPAMC does not provide a balance and other provider accounts are ignored.

## Official platform reconcile and USD reference

**官方平台对账** compares the official DeepSeek platform console month spend with the local ledger. It reuses the DeepSeek account session DSH already holds (`deepseek-account-platform/default`, or `deepseekAccount.getPlatformSession()`), sends it to `platform.deepseek.com` with the same client headers the console expects, and reads `get_user_summary` (CNY wallet / lifetime spend) plus `usage/cost` (per-day spend for the current month). It adds:

- `official month ¥X · local ¥Y` — the local side counts only DeepSeek routes from the ledger, so the two sides describe the same money;
- `coverage n%` — the share of official active days that have local ledger rows, so a partial local sample is visible instead of looking like a discrepancy;
- `delta ±¥D` — official minus local.

This endpoint is the console's **internal, undocumented** API. It is best-effort by design: no signed-in session → the strip is hidden (no error, no network); an expired session → a muted one-line message with a refresh hint; a 429/5xx gets one retry; the call times out at 10s; nothing ever throws or blocks a poll. Disable it with **Settings → 官方平台对账**. Normalization is adapted from [DeepSeek-Usage](https://github.com/sdiwenchen-lang/DeepSeek-Usage) (MIT).

**USD 参考估算** prices the selected window from the public [models.dev](https://models.dev/api.json) catalog. Rows are `{cache-miss input, cache-read, cache-write, output}` USD per 1M tokens; route/model matching is exact first, then a documented provider alias table, then the catalog's canonical model id, then the short model name — and a genuine ambiguity stays **unpriced** instead of guessing. The line reads `≈$0.42 USD 参考 · 已定价 12/15 模型` plus `另有 n 次调用未定价`, and is never summed with CNY. The catalog is cached atomically in `pricing-book.json` for 24h and used offline when the fetch fails. Disable it with **Settings → USD 参考估算**.

## Model Experience

- Quota strip follows the **session** `modelSelection` projection (composer picker / `/model`). It does not fall through to another session’s or the global plan while this session already has a route.
- Windows are only shown when the remote Plan API returns real percentages; there is no local token estimate disguised as quota.
- Token ledger and balance cards stay on the Plugins page; they do not inject into the conversation transcript.

## Known Limitations

- Requires DSH `>= 0.2.2-rc.3 < 0.3.0`. Missing optional surfaces (`configForms`, `plugins.bundle.config`, `conversation.composer.dock`) are treated as unavailable capabilities instead of a startup failure.
- Historical backfill runs only when the ledger is empty and the composition mounts `sessionQuery`; an existing ledger is never re-counted.
- After an upgrade, a reloaded client can briefly run against an older Host process. Alert fields are then hidden and legacy settings still save; restart DSH to load the new Host (health, alerts and the new adapters need it).
- Alert episodes and pet-bubble cooldowns live in memory (a DSH restart starts a fresh episode); balance alerts compare CNY balances only, and the daily-cost alert counts priced routes (currently the official DeepSeek price book).
- The official platform reconcile depends on an internal console API and therefore on a signed-in DeepSeek platform account; it can be disabled or stay silently unavailable, and its figures are official billing facts rather than a measured sample.
- The USD estimate is a **reference**, not billing truth: models.dev prices can lag a provider's real invoice, list prices are base (tiered / long-context prices are ignored), and unpriced models are counted rather than approximated.
- The per-session CNY cost is a single-price-point estimate (current DeepSeek peak/off-peak rate applied to the session's token buckets); the session projection carries no per-call timestamps or model split.
- Providers without an official Plan API show no strip and no fabricated windows.
- CPAMC accepts loopback origins (or hosts listed in `cpamcAllowedHosts`) only; management routes are read-only and reject redirects.
- Volcano Ark needs vaulted AK/SK (or `VOLC_ACCESSKEY` / `VOLC_SECRETKEY`); signing runs only in the Host process.
- Floating pet bubble announcements need a separate pet service in the profile; `bubbleMode: off` disables them.

## Performance

- **One shared poll loop.** The Plugins page and every composer strip share one in-flight overview read; burst triggers collapse into a trailing request, a manual refresh queues behind a read, and a hidden document pauses polling.
- **Cached host overview.** The host rebuilds the overview at most once per data revision; health filesystem facts ride a 2s TTL. Warm reads answer `304 Not Modified` from a cached ETag without re-aggregating the retained ledger.
- **One-pass aggregation.** The 26-week heatmap is built from one precomputed per-day table, and the all-time window skips the per-model rows the page never renders.
- **Quiet, cheap UI updates.** Bars change without animating layout (width transitions removed), the alert stack collapses to one summary line, and repeated per-card scope chips are replaced by one scope line, so a 10s poll repaints less chrome.
- **Off the critical path.** The official platform read (2 min TTL) and the models.dev catalog (24h cache) refresh in the background and never delay a poll cycle; the per-day drill-down is a separate loopback route that reads one ledger day instead of re-aggregating a window.

## Development

`pnpm typecheck`, `pnpm test`, and `pnpm build` cover the plugin. To review the Web UI without the authenticated DSH Web GUI, run `python scripts/preview/shot.py` and inspect the PNGs under `docs/screenshots/`; see [scripts/preview/README.md](scripts/preview/README.md).

## Accuracy

Plan UI and the composer strip only display windows returned by official remote APIs. Missing Plan API, missing percentages, or probe failures are never replaced with local estimates.

## License

Based on `@linxin666/dsh-usage` (Apache-2.0). CPAMC security constraints and Volcano signing behavior reference `dsh-cost-meter` (MIT). See [LICENSE](LICENSE).
