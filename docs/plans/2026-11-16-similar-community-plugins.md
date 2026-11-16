# Similar / competing DSH usage, quota, cost & context plugins — ecosystem report

Date: 2026-11-16
Author: ecosystem-researcher (read-only research; only file written is this report)
Target: `dsh-usage-plus` 0.5.3 (`D:\WorkSpace\qxcool\dsh-usage-plus`)

Purpose: inventory every nearby plugin in the DSH ecosystem (usage / quota / cost / statistics /
context meters), extract what `dsh-usage-plus` can learn, and separate (a) what we already do
better, (b) real gaps, (c) provider-quota endpoint discoveries, (d) market/packaging lessons.

Method: read-only. Sources inspected:

- Installed profile: `C:\Users\qxcoo\.dsh\profiles\desktop\package.json`, `node_modules\dsh-context`
  (0.85.1), local linked `dsh-our-free-model` (2.8.5).
- Install ledgers: `C:\Users\qxcoo\.dsh\profiles\desktop\.plugin-manager\logs\operation-*\pnpm.log`,
  `C:\Users\qxcoo\AppData\Roaming\@deepseek-ai\dsh-desktop\plugin-operations\operations.jsonl`.
- Local repos: `D:\WorkSpace\qxcool\{dsh-opencode-session, dsh-our-free-model, dsh-workflow-presets,
  multi-agent-memory}`.
- Public registries: https://dsh.pub (plugin pages, `plugins.json`, `develop-plugin.md`),
  https://dshfind.com (second registry), GitHub raw READMEs at the exact commits dsh.pub pins.
- `web_search` was not used (known 401); all web evidence is `web_fetch` on known URLs, hence quotes
  below carry the URL they came from.

---

## 0. Executive summary

There are **~30 community plugins in the "Usage & cost" niche** (dsh.pub counts 928 records for the
use case across its 15,026-record registry, of which only a handful are usage plugins; dshfind.com
tags `quota`/`usage` separately). The niche splits into four camps:

1. **Remote provider quota / plan windows** (our camp): `dsh-usage-plus` (us), `dsh-usage-dash`,
   `dsh-usage-mini`, `dsh-sidebar-quota-widget`, `dsh-quota-panel`, `dsh-usage-indicator`.
2. **Local ledger / analytics dashboards**: `dsh-usage-analytics`, `deepseek-usage`, `dsh-usage-info`,
   `dsh-usage-insights`, `dsh-usage-center`, `dsh-usage-dashboard-plus`.
3. **Composer / sidebar / floating cost widgets**: `dsh-usage-dock`, `dsh-usage-footer`,
   `dsh-usage-pill`, `dsh-usage-card`, `dsh-usage-balance(-v2)`, `dsh-usage-blance`,
   `dsh-usage-orb`, `dsh-account-balance`, `dsh-usage-meter(-harness)`.
4. **Context meters (adjacent, installed)**: `dsh-context` 0.85.1 (context dashboard + cost estimate),
   `dsh-usage-cost` (`usageTimeline` projection), `dsh-llm-pricing-guard` (compaction progress bar).

Headline: **no community plugin combines official *provider plan quotas* with *provider-account
billing truth*.** We already lead on multi-provider plan windows (14 routes), the composer strip,
the 26-week heatmap, alerting, export, CPAMC/Volcano sources, shared polling/cache and data-health.
The three genuinely new things in the wild are:

- **DeepSeek platform-account billing/usage APIs** (`/api/v0/usage/amount`, `/api/v0/usage/cost`,
  `/api/v0/users/get_user_summary`) reached with DSH's *own logged-in platform credential* — see
  `deepseek-usage` (section 3.3). Nobody else in the plan-quota camp reads official billing truth.
- **A generic "custom plan" HTTPS contract** so users can add any quota endpoint without a new
  adapter — see `dsh-usage-dash` (section 3.2).
- **Per-session CNY cost pill in the composer dock** — see `dsh-usage-dock` (section 3.6).

Plus two cheap correctness/quality lifts: **ghost-fork exclusion** for historical folding
(`dsh-usage-analytics`) and **TTFT / decode-speed / success-rate metrics** (`dsh-our-free-model`,
`dsh-context` Timing Stats).

---

## 1. What is installed in this profile (and what the ledgers say)

### 1.1 Profile composition

`C:\Users\qxcoo\.dsh\profiles\desktop\package.json`:

- dependencies: `dsh-context: 0.85.1`, `dsh-our-free-model: link:D:/WorkSpace/qxcool/dsh-our-free-model`,
  `dsh-usage-plus: link:D:/WorkSpace/qxcool/dsh-usage-plus`.
- `dsh.profile.bundles` (16): `@deepseek-ai/dsh-base`, `-web-app`, experimental voice-input /
  auto-review / inspector-profile / tool-worktree / cot-translation / terminal / session-search /
  badge-skill / ralph / forge bundles, `@deepseek-ai/dsh-personalized-recommendations`,
  `dsh-usage-plus`, `@deepseek-ai/dsh-experimental-plugin-market-bundle`, `dsh-context`.
- Note: `dsh-our-free-model` is a dependency but **not** in `bundles`; the desktop ledger shows it was
  installed 2026-11-15 and toggled off 2026-11-16, i.e. currently inactive. Its dashboard is still
  valuable as a reference implementation (section 4).

### 1.2 Install ledgers (installed-plugin history)

`C:\Users\qxcoo\.dsh\profiles\desktop\.plugin-manager\logs\operation-*\pnpm.log` (pnpm operations):
`@openviking/dsh-memory-plugin 0.5.33` (installed then removed), `dsh-context 0.82.0 → 0.82.1 →
0.82.2 → 0.85.1` (four install/update operations), `dsh-our-free-model 2.8.5` (local link).

`C:\Users\qxcoo\AppData\Roaming\@deepseek-ai\dsh-desktop\plugin-operations\operations.jsonl`
(32 lines, started/settled pairs): `dsh-experimental-forge-bundle` enable, `personalized-recommendations`
enable, `dsh-context` remove/install cycles (0.82.0→0.82.1→0.82.2→0.85.1), **`dsh-usage-plus 0.1.9`
enable/disable on 2026-11-06**, `@openviking/dsh-memory-plugin` enable/remove,
`dsh-experimental-plugin-market-bundle` enable (0.2.2-rc.1, 2026-11-10), `dsh-our-free-model 2.8.5`
install (2026-11-15) and disable (2026-11-16).

Takeaway: the only two third-party plugins with usage/statistics surfaces that this machine actually
ran are `dsh-context` (context + cost estimates) and `dsh-our-free-model` (usage board).

### 1.3 Market catalog caches on disk

- No `plugin-market` / `dsh.pub` catalog snapshot is persisted under `C:\Users\qxcoo\.dsh` (searched
  `*market*`, `*catalog*`, `*registry*`, `*plugins.json*` recursively, excluding
  `sessions/`, `session_projcache/`, `node_modules`). The market bundle's only local trace is the
  desktop `plugin-operations\operations.jsonl` above; the installed list is the profile
  `package.json` + `cordis.patch.yml`.
- `dsh-context` persists its own overview cache at
  `C:\Users\qxcoo\.dsh\storages\dsh-context\overview-cache.v1.json` (275,956 B, `format:1`,
  `savedAt`, `sessions[]` each with a `signature` of id+updatedAt+origin+session-log path+size+mtime and
  an `identity` block) — an incremental-cache design worth comparing with our per-revision cache.
- Public catalogs reachable over the network and used instead:
  - https://dsh.pub/plugins.json — machine index (`schemaVersion:1`, `totals.registry: 15026`,
    `totals.ecosystem: 504`, `searchFields: name/description/category/type/tools/uiSlots/profiles/source.repository`).
    A single fetch is ~>60 KB formatted and truncates in tooling; per-plugin pages are cheaper.
  - https://dsh.pub/ (homepage): 14,855 installable plugins, 13,815 with author summaries,
    "Usage & cost" use case = **928**.
  - https://dshfind.com/en/plugins/qxcool/dsh-usage-plus — second registry; our record there is
    **v0.1.1, updated 2026-11-08**; tags `#quota`, `#usage`, category topic `#dsh-category-usage`.
  - `plugins.json` also names the ecosystem index `https://dsh.tools/plugins` and the canonical
    GitHub topic `https://github.com/topics/dsh-plugin` (discovery-only, not compatibility).

---

## 2. Inventory: same/similar-functionality plugins

Versions/commits are what dsh.pub pinned at fetch time (2026-11-16). "Dup" = overlaps with what
`dsh-usage-plus` already ships.

### 2.1 Remote provider quota / plan windows (our niche)

| Plugin | Ver | Repo | What it shows | Data source | UI surface | Notes |
|---|---|---|---|---|---|---|
| **dsh-usage-plus** (us) | 0.5.3 local / **0.1.3 on dsh.pub** | qxcool/dsh-usage-plus | 14 provider plan windows/balances, device-wide ledger, 26-week heatmap, alerts, export | official quota APIs + CPAMC + Volcano + local ledger | composer dock strip + Plugins page tabs + Settings | registry record is 4 minor versions stale (see §7) |
| **dsh-usage-dash** | 0.1.6 | yanzoro926/dsh-usage-dash | remaining % per coding plan (OpenCode Go / Volcengine CodingPlan / DeepSeek balance / **custom plans**), reset countdown, DeepSeek peak dot | `GET https://opencode.ai/zen/go/v1/usage` (+ local `opencode.db` fallback), Volcano `GetCodingPlanUsage` via `arkcli usage plan`, `https://api.deepseek.com/user/balance`, user URL contract | sidebar-footer badge + overlay card | closest competitor on plan quotas; uses CLI helper instead of signing AK/SK; custom-plan JSON contract is the best idea here (§3.2) |
| **dsh-usage-mini** | 0.2.3 | teethyachi/dsh-usage-mini | tiny usage window: **Claude + Codex subscriptions + DeepSeek API only** | subscription usage endpoints | full-screen/window dashboard | strictly narrower provider set than us |
| **dsh-sidebar-quota-widget** (dshfind) | — | lakii2982 | sidebar 5h/7d subscription-quota **rings** for locally connected providers + DeepSeek balance on account row + macOS-style tooltips | local provider credentials | sidebar | ring-per-window idea; we already render a tightest-window ring in the composer pill |
| **dsh-quota-panel** (dshfind) | — | brittanistrehlowll-oss | provider quota/balance capsule bottom-left; "API Key only resolved on host, zero deps" | provider credentials | bottom-left capsule → full card | same trust stance as us (host-only secrets) |
| **dsh-usage-indicator** | 0.1.0 | TiferKing/dsh-usage-indicator | API-key **context headroom**, account balance, **estimated turns until compaction** | provider credential + local context metrics | sidebar indicator | "turns until compaction" forecast is a real UX idea (§5.6) |
| **dsh-usage-center** | — | (see dsh.pub) | native Settings page: daily provider usage, subscription quotas, API price estimates | mixed | settings page | "native settings section" placement is a packaging alternative to our plugin-page tabs |

### 2.2 Local ledger / analytics dashboards

| Plugin | Ver | Repo | What it shows | Data source | UI surface | Notes |
|---|---|---|---|---|---|---|
| **dsh-usage-analytics** | 1.0.0 | 2327644800/dsh-usage-analytics | token totals (input/cache/output/reasoning), contribution heatmap, token trend (daily/weekly/**hourly**), token mix, model share, reasoning-effort/tool/skill/plugin rankings, streaks/insights | `ctx.sessionPersistence` (event logs) | `sidebar.footer.action` entry + `shell.overlay` full-screen | **ghost-fork detection**, raw-vs-new token convention, incremental `agg.json`, `?force=1` (§3.4) |
| **deepseek-usage** | 0.1.0 | sdiwenchen-lang/DeepSeek-Usage | official DeepSeek balance + cumulative spend + per-day per-model usage/cost, calendar heatmap, **official vs local reconcile** | **platform.deepseek.com internal APIs via DSH's platform credential** | sidebar entry → centered panel | biggest endpoint discovery (§3.3); also 42-model USD pricing snapshot + FX |
| **dsh-usage-info** | — | (see dsh.pub) | local per-model requests + tokens by day/month | local session logs | section under Settings → Plugins | no cost, no quota |
| **dsh-usage-insights** | — | (see dsh.pub) | request/token/cost estimates for official + third-party routes, UI mirrors DeepSeek's own usage page | local + official | Settings "用量查询" | mimic-official-layout idea |
| **dsh-usage-dashboard-plus** | — | (see dsh.pub) | balance + today's spend sidebar widget, full per-session dashboard (call log, per-model, cache rate, CSV), **external vision-call accounting** via JSONL usage log | `usageDashboard` session projection + JSONL | sidebar widget + `/api/dsh-usage` | out-of-session call accounting is a gap for us (§5.7) |
| **dsh-usage-cost** | — | (see dsh.pub) | per-step timestamped API usage timeline + peak/off-peak cost readout for DeepSeek V4 Pro | `usageTimeline` projection | panel | projection-based per-step timeline |

### 2.3 Composer / sidebar / floating cost widgets

| Plugin | Ver | Repo | What it shows | Data source | UI surface | Notes |
|---|---|---|---|---|---|---|
| **dsh-usage-dock** | 0.4.0 | aliensweety/dsh-usage-dock | **per-session CNY cost pill** riding the official stats row; expands to 4 token buckets + "both tariff bounds" | session usage projection | composer dock (portal, does not replace official row) | best composer-dock competitor (§3.6) |
| **dsh-usage-footer** | — | (see dsh.pub) | floating usage/cost button → hover panel: balance, peak/off-peak bracket, cost estimate, session tokens, today's spend; General-settings on/off | loopback `GET /usage-status` | floating button | toggle lives in General settings |
| **dsh-usage-pill** | — | (see dsh.pub) | session tokens, DeepSeek reference cost, balance, per-model expand, customizable bottom pill | session + balance | composer bottom pill | customization of the pill |
| **dsh-usage-card** | 0.1.0 | kazma258/dsh-usage-card | 7d/30d tokens + spend + remaining balance, official/estimate/none badge | platform `userToken` page data, or local `tokenUsage` estimate | sidebar above Settings (rail icon when collapsed) | refresh matrix + TTL cache (§3.5) |
| **dsh-usage-balance** / **-v2** | — | (see dsh.pub) | sidebar label row → glass card (runtime, tokens, est. cost, official balance, peak/off-peak); v2 adds bottom bar + per-workspace cumulative | local + balance | sidebar + bottom bar | workspace grouping idea |
| **dsh-usage-blance** | — | (see dsh.pub) | billing strip under the dialog: month spend, month daily average, yesterday, today, balance; userToken control panel | platform userToken | below-composer strip | competitor to our composer strip, narrower (DeepSeek only) |
| **dsh-usage-orb** | 0.2.2 | zhifeiNi/dsh-usage-orb | floating panel: per-request event-stream accounting, cache economics, peak/off-peak cost, tool & compaction diagnostics | session events | floating orb | documents "web-search LLM calls not counted (explicitly shown)" |
| **dsh-account-balance** (dshfind) | — | StarRob1n | floating ball: signed-in account balance (OAuth), live pricing, **today's price curve**, token-consumption estimate | OAuth account | floating ball | price-curve visualization |
| **dsh-usage-meter** / **-harness** | — | (see dsh.pub) | real-time tokens/cost/real balance next to the chat input | provider credential | near composer | same slot as our strip |
| **@feiyang666/dsh-usage-plugin** | — | (see dsh.pub) | per-call token/cache stats, peak/off-peak billing, balance, **CSV/JSON/PNG export with custom destination**, persistent storage, host+web single package | mixed | panel | PNG share-card export is a gap (§5.8) |

### 2.4 Context meters (adjacent)

| Plugin | Ver | Repo | What it shows | Data source | UI surface |
|---|---|---|---|---|---|
| **dsh-context** (installed) | 0.85.1 | bowenliang123/dsh-context | full context lifecycle: Insights page (7-day usage chart, 8-week heatmap, composition ring, session cards), Context tab (stats/composition/trend/browser/events/file activity/commands), Fleet tab (agent network), right-sidebar panel, `/context` modal, preferences card | `contextTimeline`/`contextHeaders`/`contextActivity` session projections + `contextPressure`/`contextBreakdown` token-meter projections; cost from models.dev list prices | sidebar page / conversation tab / sidebar panel / command |
| **dsh-llm-pricing-guard** | — | (see dsh.pub) | fixes missing `imageRequestPricing` that crashes `/compact`, adds a context-compression progress bar | adapter metadata + context | composer/inline |
| **dsh-context cost model** (in `dsh-context`) | — | — | DeepSeek-only peak/off-peak: listed rates are off-peak, peak bills at 2×; hover shows per-1M rates | models.dev prices | `?` tooltip on cost card |

### 2.5 Adjacent plumbing (no usage UI, but relevant)

- **dsh-opencode-session 0.1.5** (`D:\WorkSpace\qxcool\dsh-opencode-session`, MIT): host-only plugin that
  patches `llm/stream` + `globalThis.fetch` to attach a stable per-conversation `x-opencode-session`
  header for OpenCode / OpenCode Go routes (fixes `400 MissingSessionID`, keeps prompt-cache
  affinity). Not usage data — but it is the maintenance home of the same OpenCode routes our
  `opencode-go` plan adapter reads, and its `debugFile` JSONL per-call trace is a useful pattern for
  quota-probe diagnostics.
- **dsh-rate-limiter** (`@xidong-ai/dsh-rate-limiter`): per-provider token-bucket throttling, queues
  instead of failing — the "quota-aware behaviour" end of our niche.
- **dsh-usage-guard** (`@goodandready/dsh-usage-guard`): turns a malformed / non-numeric token-usage
  sample into 0 before the harness sums it, so a broken session log can never fold to `NaN`.
- **deepseek-peak-blocker** / **@local/deepseek-peak-indicator**: peak-hour gating (confirmation
  modal / banner / status panel, `/bypass`, `/status`) and a countdown popover — the "proactive"
  version of the peak pill we already render (`src/client/UsageSectionCard.tsx:1988`,
  `src/core/pricing.ts`).

Excluded after inspection (no usage/quota/cost/stats/context surface):
`D:\WorkSpace\qxcool\multi-agent-memory` (shared-memory hub), `dsh-workflow-presets` (prompt presets),
`dsh-opencode-session` itself (plumbing, kept as adjacent only); `eco-platform` mentioned in the task
does not exist under `D:\WorkSpace\qxcool`.

---

## 3. Deep dives (most instructive)

### 3.1 `dsh-context` 0.85.1 — installed context dashboard (adjacent, but the strongest UX reference)

Local: `C:\Users\qxcoo\.dsh\profiles\desktop\node_modules\dsh-context` (`lib/index.js` 191 KB,
`lib/client.js` 971 KB, `lib/index.d.ts` 15 KB, 8 locale files, `icon.svg`, `cordis.patch.yml`).
Repo: https://github.com/bowenliang123/dsh-context (Apache-2.0).

- **What it shows** (README_en.md): a "Context Insights" first-level sidebar page — KPI band
  (sessions active, billed tokens, estimated cost, cache-hit rate, turns, tool runs, active time),
  7-day token/cost bar pairs, 8-week activity heatmap (click a day to filter), skill/tool/command
  rankings, composition ring, filterable session cards that jump into the session. Then per-session
  Context tab cards: Context Stats (cost from models.dev prices with a `?` hover), Token Stats
  (System Prompt / Tool Schemas / User Messages / Injected / Skill Injections / Tool Calls /
  Reasoning / Answers, cache-hit rate in the corner), Timing Stats (TTFT / gen / tool / overhead),
  Current Context (six-color stacked bar against the model window with two hatched
  auto-compaction reserve masks), Context Trend (per-request bars, Step/Turn, Total/Delta, ✂ marks
  compactions/prunes, Overview ribbon), Context Browser (per-element token + actual content, tool
  source chips, Raw/Markdown toggles, DNA mode with `#position`), Context Events (inject / compact /
  prune / switch / mode with producer + net token delta), File Activity, Command Executions.
  Fleet tab = live agent network, cross-agent timeline, teamwork tasks, event inspection. Also a
  `/context` slash command modal and a Preferences card (placement, range, granularity, trend mode,
  sort defaults, **system-prompt prefix/suffix**).
- **Data source**: its own session projections (`contextTimeline`, `contextHeaders`,
  `contextActivity`, declared in `lib/index.d.ts:132-143`), heavy folding in a worker thread
  (`startFoldWorkerChannel`, `lib/index.js` around line 32), headline occupancy read from the same
  official `contextPressure` / `contextBreakdown` projections the composer context ring uses
  (README "Good to know"). Cost is an estimate from models.dev list prices, with DeepSeek peak = 2×
  off-peak (`SessionCostUsage`, `CostPriceFace.confidence`, `lib/index.d.ts:271-297, 407-415`).
  There is a `PlatformBalance`/`PlatformBalanceEntry` shape (`lib/index.d.ts:490-499`) — it also reads
  the DeepSeek platform balance.
- **Caching/performance**: only a compact per-session summary goes into dsh's projection cache;
  heavy details refold from the durable log on demand; bounded detail views (1500 steps, 300 turns,
  400 events, 2000 surface nodes, 400 archive nodes, 400 file ops, 400 commands — README "Cache
  footprint"). On-disk overview cache is incremental (signature = session id + updatedAt + origin +
  log path + size + mtime), see §1.3.
- **UX/packaging**: screenshots per feature (`docs/*.png`), a social-preview image, a 4-minute
  Bilibili walkthrough, 8 localized READMEs, npm-version + GitHub-stars + dshfind badges, staff
  endorsement quote, install via the Add-plugin wizard screenshot, "no build step, no restart",
  a documented compatibility matrix, a pricing-mapping doc.
- **Tests/docs**: `vitest` + coverage in the repo (`package.json`), `README_*.md` per locale.
- **Borrow**: (1) session-card list with composition ring + jump-to-session; (2) pair
  ≈estimated composition with provider-exact billed totals and say so; (3) Timing Stats
  (TTFT/speed/tool-busy) — we have no latency at all; (4) bounded views + archive reconstruction for
  very long ledgers; (5) "per-view toggles never overwrite stored defaults" discipline; (6) the
  market-presentation checklist. **Differentiate**: dsh-context has *no remote quota*, no provider
  plan windows, no alerts, no cross-provider balance, no export; its cost is an estimate, ours are
  real API readings where available.

### 3.2 `dsh-usage-dash` 0.1.6 — closest competitor on plan quotas (and the best borrowable contract)

Repo: https://github.com/yanzoro926/dsh-usage-dash (MIT), pinned `416ceac4b9`.
README: raw.githubusercontent.com/yanzoro926/dsh-usage-dash/416ceac4b9959713a91e19091eb6eedf668f1a4a/README.md

- **Shows**: sidebar-footer badge, two lines per plan, **remaining** percentage
  (`Go 额度 / 5h: 80% wk: 90% 30d: 95%`), collapsed to a circular "tightest window remaining" ring;
  click → overlay card with per-plan columns, progress bars, reset countdown, ⚙ settings entry.
  Colors: ≤10% red, ≤40% orange; auto-refresh 60 s. A **DeepSeek peak/off-peak dot** next to the
  DeepSeek title (off-peak green, peak orange; peak = 09:00–12:00 and 14:00–18:00 Beijing, off-peak
  half price "official pricing page wording"), refreshed every 30 s.
- **Sources**: OpenCode Go `GET https://opencode.ai/zen/go/v1/usage` (primary) with local
  `opencode.db` estimate fallback, auto-using `~/.local/share/opencode/auth.json`; Volcengine
  CodingPlan `GetCodingPlanUsage` via the `arkcli usage plan` CLI (recommends
  `npm i -g @volcengine/cli` → `ve login` → `arkcli auth login` for STS auto-renew, fallback
  `@volcengine/ark-cli`); DeepSeek `GET https://api.deepseek.com/user/balance` (they claim same
  source as the platform usage page); **custom plans = any URL returning standard JSON**.
- **Custom-plan contract** (the borrowable): two accepted shapes —
  `{usage:{rolling:{percent,resetsAt},weekly:{...},monthly:{...}}}` (opencode style) or
  `{windows:[{label,percent,resetAt}]}`; `percent` is *used* 0–100 and the UI converts to remaining;
  `label` aliases `5h/rolling/rolling5h`, `weekly/week/wk`, `monthly/month/30d`, `session`; optional
  `Authorization: Bearer <token>`; config stored `0600` at
  `~/.dsh/storages/dsh-usage-dash-custom.json`; display prefs in browser `localStorage`.
- **Security**: `/usage-dash/api/*` routes enforce a loopback Host fence + same-origin marker
  (DNS-rebinding defence), tokens never returned to the browser (sanitized).
- **Release**: tag-driven GitHub Actions → npm.
- **Borrow**: the custom-plan JSON contract (lets us support arbitrary providers without shipping an
  adapter, reusing our existing allowed-host/redirect/loopback rules); remaining-vs-used display
  option; threshold color rules (`≤10%`/`≤40%`); a ⚙ shortcut from the badge into this plugin's
  Settings. **Differentiate**: no device-wide ledger, no heatmap, no alerts, no export, no per-model
  attribution, CLI dependency for Volcano (we sign AK/SK directly), no multi-account CPAMC.

### 3.3 `deepseek-usage` 0.1.0 — official DeepSeek platform billing truth (endpoint discovery)

Repo: https://github.com/sdiwenchen-lang/DeepSeek-Usage (MIT), pinned `0cba805f94`.
Page (full README): https://dsh.pub/en/plugins/deepseek-usage/

- **What it shows**: centered panel opened from a sidebar "用量" entry. Totals (balance, cumulative
  spend official), usage trend (spend / request count / tokens; per-model stacked bars; request and
  token trend lines), **usage calendar** (current month heatmap, 5 levels, month paging), filters
  (today/yesterday/7d/30d/this month/last month + model multi-select), and a **reconcile strip**
  comparing official vs local coverage/deltas with explicit caveats. Local mode aggregates every
  provider on this machine, with a 42-model USD pricing snapshot (4 buckets: cache-hit / cache-miss
  input / cache-write / output, USD→CNY 6.7 editable in-panel).
- **Data source (the important part)** — no login form, no user-supplied token:
  ```
  records["deepseek-account-platform/default"].payload.token   // kind: "grant"
  x-dsh-auth-token: <that token>          // plus browser UA and x-app-version, else 429
  GET https://platform.deepseek.com/api/v0/users/get_user_summary      // balance + cumulative spend
  GET https://platform.deepseek.com/api/v0/usage/amount?month=&year=   // per-day per-model usage
  GET https://platform.deepseek.com/api/v0/usage/cost?month=&year=     // cost detail
  ```
  It also notes the official usage page's hour view is same-origin `usage/by_api_key` and that
  today-by-hour is month-fragmented client-side ("抓包确认, 非公开 API" — internal, unsupported).
- **Local fold**: via host `sessionPersistence` `list()` → `open(id,'read')` → `read(0)`, no zstd
  decoding in-plugin (multi-frame append breaks `zlib.zstdDecompressSync`), no tokenizer. Buckets
  are mutually exclusive; `reasoningTokens` is a subset of output (not re-added); same
  `(turn, step)` final `assistant/message` **replaces** chunk samples; provider/model from
  `message.source` with `request/header` fallback and `unknown` last.
- **Own endpoints** (all loopback, double-checked peer socket + Host header, 403 otherwise):
  `/api/deepseek-usage/{pricing,status,summary,official,local,reconcile,panel.css}`; official ranges
  accept `range=` or `from=&to=` (max 800 days), month-sliced, future days zero-filled without
  upstream calls, TTL + in-flight dedup.
- **Engineering lessons**: client bundle has a **100 KB budget** (measured 102,340 B) so the ~90 KB
  panel CSS is served by its own route and injected as a `<link>`; client bundle may only export
  `apply`/`inject` (a `default` export hangs the host fiber and breaks web startup); `inject` only
  lists services truly required, optional ones probed via `ctx.get()`; upstream field names are
  centralized in `FIELD_MAP` because they drift; each range's official month slices are cached with
  TTL.
- **Borrow**: the platform-account adapter (huge); the official-vs-local reconcile with coverage %
  and honest caveats; per-model pricing editors; the size-budget/pitfall list. **Differentiate**: it
  has **no plan windows/quota for coding plans**, DeepSeek-only, no alerts/export, and it relies on
  an internal unsupported API (we would degrade silently and keep API-key balance as the fallback).

### 3.4 `dsh-usage-analytics` 1.0.0 — ledger analytics + ghost-fork correctness

Repo: https://github.com/2327644800/dsh-usage-analytics (Apache-2.0), pinned `7095dc1bc3`.
README: raw.githubusercontent.com/2327644800/dsh-usage-analytics/7095dc1bc3f136cdb86fbb2ad3fcdbe068d31878/README.md

- **Shows**: full-screen dashboard from a sidebar "Usage" entry — token totals (input/cache-hit/
  output/reasoning), session activity, GitHub-style contribution heatmap, token trend
  (daily/weekly/**hourly**), token mix, model-share ranking, reasoning-effort / tool / skill /
  dynamic-plugin rankings, streaks and insights; period pills Today/24h/7/30/90/All that every chart
  follows.
- **Architecture**: `ctx.sessionPersistence` → pure `lib/aggregate.js` fold → `lib/store.js`
  incremental cache (per-session revision diffing, resumable `readFrom(fromSeq)`, atomic JSON at
  `<DSH_HOME>/usage-analytics/agg.json`, `CACHE_VERSION` bump for migration) → host
  `GET /api/dsh-usage-analytics/stats` (`?force=1` full rescan) → client bundle on
  `sidebar.footer.action` + `shell.overlay` slots.
- **Notable UX/correctness**: **ghost-fork detection** — a forked session whose whole usage predates
  its creation is a copied seed and is excluded, so duplicated logs never inflate totals; raw-vs-new
  token separation (provider console counts cache reads as input; it shows the raw number but keeps
  "new tokens" distinct); `stale: true` when serving cache; failure isolation (worst case a stale
  snapshot); documented limitations (no cost table, skill tokens unattributable, session duration =
  first/last event span, deletion does not shrink cached aggregates, last-write-wins).
- **Borrow**: ghost-fork exclusion for our history backfill/ledger (we rebuild from session history
  on first install — forked sessions could double-count); hourly buckets; `?force=1` + stale flag;
  honest "who counts what" documentation. **Differentiate**: no cost at all, no remote quotas, no
  alerts, no export.

### 3.5 `dsh-usage-card` 0.1.0 — small sidebar card, excellent refresh semantics

Repo: https://github.com/kazma258/dsh-usage-card (MIT), pinned `ff1f1b21b6`.
README: raw.githubusercontent.com/kazma258/dsh-usage-card/ff1f1b21b6880949e9adccb2724f46f8a9c49229/README.md

- **Shows**: sidebar card above Settings: 7d/30d tokens + spend + remaining balance. A badge cycles
  **官方 / 估算 / 无数据** (official / estimate / no data). When the sidebar is collapsed it becomes a
  rail icon; clicking opens the token settings.
- **Sources**: official-ish `platform.deepseek.com` daily data via a pasted platform `userToken`
  (`JSON.parse(localStorage.getItem('userToken')).value`, or `DEEPSEEK_PLATFORM_TOKEN`), falling back
  to local `tokenUsage` aggregation with configurable `estimatePrices`
  (`inputUncached/cacheRead/cacheWrite/output`, USD per 1M) and currency options. Platform has no
  7d/30d window parameter, so it sums the in-window `YYYY-MM-DD` rows. Expired token codes
  40002/40003 fall back to estimate.
- **Refresh matrix** (worth copying): current session `updatedAt` change; `running` true→false then
  ~2.5–3 s; 60 s timer; window focus; manual refresh; once on mount. Host cache: balance 60 s, usage
  120 s; `turn/end` invalidates the usage cache (`invalidateOnTurnEnd`, default on).
- **Tests/dev**: `node --check` on libs + `test/aggregate.test.mjs`; committed `lib/` so Git install
  needs no `prepare`; config keys documented one by one.
- **Borrow**: the refresh matrix and TTLs (compare with our single conditional-GET poller);
  official-vs-estimate badge (we deliberately never estimate — keep that as a differentiator but
  consider a "no official source" empty state); rail-collapse behaviour. **Differentiate**: DeepSeek
  only, no plan windows, no heatmap/ledger, requires pasting a platform token (we should prefer the
  DSH platform credential, like `deepseek-usage`).

### 3.6 `dsh-usage-dock` 0.4.0 — the composer-dock competitor

Repo: https://github.com/aliensweety/dsh-usage-dock (MIT), pinned `fdc6342919`.
Page: https://dsh.pub/en/plugins/dsh-usage-dock/

- **Shows**: a per-session **CNY cost pill** in the composer dock, portal-ed into the official stats
  row (it explicitly does not move/re-style the official row, and falls back to its own row if that
  row is absent — uninstall removes it cleanly). Expanding shows the four token buckets and **both
  tariff bounds** (peak vs off-peak), because the session may have crossed a boundary.
- **Documented rules worth borrowing as QA cases**: fail-safe — renders `null` when the projection is
  missing, buckets are all zero, or the route isn't `deepseek-official`; money formatting never
  prints `¥0.00` for a non-zero cost; `¥` only on the icon (numbers stay bare), panel/tooltip keep it;
  cache-hit rate = `cacheRead / (uncachedInput + cacheRead + cacheWrite)` (same denominator as the
  official `cacheHitPercent`, never rounding a miss up to 100%); no timers, so a pill can be briefly
  stale across a tariff boundary (documented limitation); zh/en chosen from `navigator` because it
  does not use the locale seat; no React bundled (host-injected virtual `react`).
- **Borrow**: per-session CNY cost + tariff-bound display in the composer dock (our strip shows plan
  windows + tokens but no money); the portal-not-replace discipline; the "never show ¥0.00" and
  cache-denominator rules; documenting known staleness rather than hiding it.
  **Differentiate**: cost only (no balance/quota), DeepSeek-only, no ledger/export/alerts.

### 3.7 `dsh-usage-dashboard-plus` / `dsh-usage-orb` / `@feiyang666/dsh-usage-plugin` — the rest of the field

- **dsh-usage-dashboard-plus** (dsh.pub summary): balance + today's spend sidebar widget; full
  per-session dashboard via a `usageDashboard` **session projection** (call log, per-model stats,
  cache rate, CSV export); `/api/dsh-usage` route; **external vision-call accounting** via a JSONL
  usage log (model calls that never enter session usage); merged from `dsh-stats-dashboard`.
  Borrow: out-of-session call accounting; projection-based per-session view (vs our ledger).
- **dsh-usage-orb** 0.2.2 (zhifeiNi, MIT): floating panel with per-request event-stream accounting,
  cache economics, peak/off-peak cost and tool/compaction diagnostics; explicitly reports "web-search
  LLM calls not counted" and silently degrades balance to usage-only. Borrow: the honesty banner for
  known-uncounted call classes; compaction diagnostics.
- **@feiyang666/dsh-usage-plugin** (dsh.pub summary): per-call token/cache stats, peak/off-peak
  billing, balance, **CSV/JSON/PNG export with custom destination**, persistent local storage, host +
  web in one npm `dsh.bundle`. Borrow: PNG share-card export; "custom export destination" (our export
  is loopback download only).
- **dsh-usage-billing** 0.9.5 (940842546, MIT): billing with **pre/post 2026-08-17 repricing** peak /
  off-peak price books, main summary panel, session-level details, charts. We already implement
  current DeepSeek peak/off-peak CNY pricing (`src/core/pricing.ts:1-118`, peak weeks
  Mon–Fri 09:00–12:00 / 14:00–18:00 Beijing, off-peak half price, plus a `peakPill` in
  `src/client/UsageSectionCard.tsx:1988` and locales `usage.peak.on/off`). The only residual idea is
  **price-book epochs**: bill old calls with the price in force at their time instead of today's
  book (we currently stamp per-call spend at fold time; worth checking whether a historical reprice
  would change totals).
- **dsh-usage-footer**, **dsh-usage-pill**, **dsh-usage-balance(-v2)**, **dsh-usage-blance**,
  **dsh-usage-meter(-harness)**, **dsh-account-balance**, **dsh-quota-panel**,
  **dsh-sidebar-quota-widget**, **dsh-usage-mini**, **dsh-usage-center**, **dsh-usage-info**,
  **dsh-usage-insights**, **dsh-usage-dashboard**, **dsh-usage-cost**: variations of the same three
  ideas (balance/usage surface near the composer or sidebar, subscription-window rings, a local
  stats page). None of them combines plan windows + provider billing + device ledger + alerts +
  export the way we do; several are DeepSeek-only.

---

## 4. Local repo `dsh-our-free-model` 2.8.5 — the best local UX reference for metrics we lack

`D:\WorkSpace\qxcool\dsh-our-free-model` (MIT, linked into the profile; currently disabled).
README (`README.md` lines 63, 75–76, 96, 337–345, 361–382, 505) plus state file
`C:\Users\qxcoo\.dsh\our-free-model\stats.json` (v3).

- **Usage board (数据看板)**: today/all-time tokens, average generation speed, cache-hit rate, success
  rate, account perspective, model performance table, recent-request overview; **17-week token
  heatmap**, total curve (tokens / requests, all vs per-model), speed mini-chart, per-model table.
- **Per-request log (运行日志)**: per request — outcome, elapsed, **TTFT**, speed, token split, failure
  reason on hover. "Physical requests vs logical turns are counted separately" (README line 505).
- **Stats shape** (`stats.json`): per day → per model → `{input, output, reasoning, cacheRead, calls,
  failed, ttftMs, ttftSamples, decodeMs, decodeTokens}` — a compact, exactly-the-right-granularity
  model for a host-side cache (compare our `usage-ledger.json` at
  `C:\Users\qxcoo\.dsh\dsh-usage-plus\usage-ledger.json`, 7,921 B).
- **Token-saver accounting**: before/after bytes, saved bytes, saved ratio, compressed blocks, and
  which stats rows back it — an "efficiency" card rather than a usage card.
- **Borrow**: TTFT + decode speed + success rate; the per-request log table; physical-vs-logical
  request separation; an efficiency/savings card. **Differentiate**: it is a gateway dashboard for
  its own proxy lanes, not multi-provider quota.

`dsh-opencode-session` (`D:\WorkSpace\qxcool\dsh-opencode-session`, v0.1.5, host-only): not a usage
plugin. Useful context: it owns the OpenCode `x-opencode-session` header / prompt-cache-affinity
plumbing for the same routes our `opencode-go` quota adapter reads, and its `debugJsonlFile` option
(`{"ts","provider","model","session","header","value"}` per call) is a pattern for tracing quota
probes without polluting logs.

`multi-agent-memory` and `dsh-workflow-presets` were inspected and excluded: no usage/quota/cost/
stats/context-meter surface.

---

## 5. Findings by flag

### (a) Duplicates — things we already do better (do not rebuild)

1. **Multi-provider plan windows**: we cover 14 route families incl. OAuth-only (Anthropic, Codex,
   Copilot) and intl/CN variants; competitors cover ≤4 each (`dsh-usage-dash`: OpenCode Go, Volcano,
   DeepSeek, custom; `dsh-usage-mini`: Claude, Codex, DeepSeek).
2. **Composer strip**: we render plan windows + tightest-window ring + amber alert dot + token/cache
   counters; `dsh-usage-dock` renders cost only; others use sidebar/bottom bars.
3. **26-week Mon–Sun heatmap, selectable 7/30/90/182-day window, provider breakdown, CSV/JSON
   export, threshold alerts (daily spend / plan % / low balance), data-health card, backfill from
   session history**: no competitor combines these (analytics has heatmap but no cost; context has
   cost but no quota/export/alerts).
4. **External sources with real signing**: CPAMC management routes and Volcano Ark AK/SK signing
   in-host; `dsh-usage-dash` shells out to `arkcli` for Volcano instead.
5. **Secrets/trust model**: credentials stay host-side, loopback-only download route, redirect
   refusal, allowed-host list — all competitors assert the same, nobody shows more.
6. **Peak/off-peak pricing**: we already ship the DeepSeek peak clock + ×2/½ pricing + pill
   (`src/core/pricing.ts`, `UsageSectionCard.tsx:1988`); `dsh-usage-billing`/`dsh-usage-footer`/
   `dsh-usage-dash`/`dsh-usage-cost` also do it, so it is table stakes now rather than a novelty.

### (b) Features we lack (real gaps, ordered by value)

1. **Official DeepSeek platform billing/usage truth** (balance + cumulative spend + per-day per-model
   usage + cost) read from DSH's logged-in platform credential — `deepseek-usage` §3.3. We only read
   `api.deepseek.com/user/balance` for DeepSeek; no platform usage/cost, no official-vs-local reconcile.
2. **Per-session cost in the composer dock** (CNY pill + 4 buckets + peak/off-peak bounds) —
   `dsh-usage-dock` §3.6. We show plan windows and tokens, not money, per session.
3. **User-defined plan sources** ("custom plan": any HTTPS JSON with 2 accepted shapes) —
   `dsh-usage-dash` §3.2. We have a hand-declared nano-gpt route; this generalizes it.
4. **Ghost-fork exclusion** in history backfill/ledger — `dsh-usage-analytics` §3.4. Our backfill
   rebuilds from session history and may double-count forked copies.
5. **Latency/efficiency metrics**: TTFT, decode tokens/s, success/failure rate, per-request log —
   `dsh-our-free-model` §4, `dsh-context` Timing Stats §3.1, `dsh-usage-orb` cache economics.
6. **Forecast UX**: "estimated turns until compaction" (`dsh-usage-indicator`), reset countdown in
   badge (`dsh-usage-dash`), peak-hour gating (`deepseek-peak-blocker`, `deepseek-peak-indicator`).
7. **Out-of-session accounting**: vision/image and web-search calls that never enter session usage —
   `dsh-usage-dashboard-plus`, `dsh-usage-orb` (which at least labels them "not counted").
8. **Shareable image export**: PNG card with custom destination — `@feiyang666/dsh-usage-plugin`.
9. **Hourly buckets** in the local ledger — `dsh-usage-analytics`; ours is daily.
10. **Robustness guards**: NaN-safe folding of malformed usage samples (`dsh-usage-guard`);
    `FIELD_MAP`-style upstream field mapping + 429/UA handling (`deepseek-usage`).

### (c) Provider quota / billing endpoint discoveries (most actionable)

1. **DeepSeek platform account (via DSH credential, no paste)** — `deepseek-usage`:
   - credential record `deepseek-account-platform/default`, `payload.token`, `kind: "grant"`;
   - header `x-dsh-auth-token` (+ browser UA and `x-app-version`, else 429);
   - `GET https://platform.deepseek.com/api/v0/users/get_user_summary` (balance + cumulative spend);
   - `GET https://platform.deepseek.com/api/v0/usage/amount?month=&year=` (per-day per-model usage);
   - `GET https://platform.deepseek.com/api/v0/usage/cost?month=&year=` (cost detail);
   - official usage page uses same-origin `usage/by_api_key` (hour granularity);
   - internal/unsupported API → must degrade silently and keep API-key balance as fallback.
2. **DeepSeek platform daily usage via user `userToken`** — `dsh-usage-card`: same platform data,
   token pasted from `localStorage.userToken` / `DEEPSEEK_PLATFORM_TOKEN`; no server-side 7/30-day
   window, so sum `YYYY-MM-DD` rows; expiry codes 40002/40003. (Inferior auth path; use 1.)
3. **OpenCode Go usage** — `dsh-usage-dash`: `GET https://opencode.ai/zen/go/v1/usage`, plus local
   `opencode.db` estimate fallback and `~/.local/share/opencode/auth.json` key discovery. We already
   read the OpenCode Go usage API; confirm we hit the same `/zen/go/v1/usage` shape and consider the
   local-DB fallback for offline/failed probes.
4. **Volcengine CodingPlan** — `dsh-usage-dash`: documented as official OpenAPI
   `GetCodingPlanUsage` (they invoke `arkcli usage plan`); we already sign Volcano requests with
   AK/SK in-host, which is stronger — keep, but note their STS-refresh advice for long-lived keys.
5. **Custom plan contract** (any provider) — `dsh-usage-dash` §3.2: opencode-style `usage.rolling/
   weekly/monthly.percent` or flat `windows[{label,percent,resetAt}]`, label aliases, optional
   `Bearer` token, used-percent 0–100. Directly reusable as our "custom HTTPS plan" adapter.
6. **DeepSeek peak windows** (cross-checked in three plugins + our own code): peak = Beijing
   Mon–Fri 09:00–12:00 and 14:00–18:00, off-peak = half price. Our `src/core/pricing.ts:8-10,30`
   already matches; no change needed.
7. **MiniMax credits** — dshfind's `dsh-connect-minimaxcode` shows "credit balance plus expiring
   credits in the composer and plugin page" using non-public client APIs; we already have a MiniMax
   coding-plan remains adapter, so this is only a reminder that expiry/credit detail exists upstream.

### (d) Market / packaging lessons

1. **Our registry records are stale.** dsh.pub pins `v0.1.3` at commit `fe0d006d9a`
   (https://dsh.pub/en/plugins/dsh-usage-plus/): the page still shows the old summary and old
   "Known limitations" ("DSH versions are not pinned", `plugins.item`), while the repo is 0.5.3.
   dshfind.com is staler still (`v0.1.1`, updated 2026-11-08). dsh.pub's own guidance says the
   first-version submission flow "cannot overwrite an existing repository/package-path coordinate",
   so confirm the supported update path (re-submit/registry refresh) before assuming refresh is
   automatic — treat this as a release-checklist item.
2. **Discovery is driven by the capability graph.** dsh.pub's per-plugin "Related by capability" list
   is how competitors surface (our page lists `dsh-usage-meter-harness`, `dsh-usage-mini`,
   `dsh-usage-monitor`, `dsh-usage-orb`, `dsh-usage-pill`, `@feiyang666/dsh-usage-plugin`).
   Categories + `dshhub.categories/surfaces/permissions` + icon + summary quality are what place a
   plugin in that graph; dshfind additionally indexes `#quota`/`#usage` tags and
   `#dsh-category-usage`. Keep `dshhub` metadata current (`package.json` already has
   `displayName/summary/categories["用量","Web UI","观测"]/surfaces["host","web"]/permissions.network`).
3. **Detail-page quality bar (dsh-context sets it)**: localized READMEs (it ships 8), feature
   screenshots per card, a social-preview image, a video walkthrough, npm/stars/dshfind badges,
   compatibility matrix, a "why it's good" narrative and staff-endorsement quote. We have a solid
   README with 3 screenshots + `docs/preview.svg` + a dsh.pub-registry badge; the cheapest
   upgrades are a social-preview image and per-surface screenshots (composer strip / plan tab /
   data health), plus listing the plugin on dshfind (badge 440×200 card endpoint
   `https://dshfind.com/api/card/qxcool/dsh-usage-plus`).
4. **Install story**: dsh-pub pinned install is `npx dshpub add qxcool/dsh-usage-plus --ref <sha>`
   (page) vs our README's `dsh plugin --profile desktop add github:...`; dsh-context advertises
   "no build step, no restart" and shows the Add-plugin wizard screenshot. Document both forms and
   the exact commit that the registry pins.
5. **Trust language sells in this niche**: every registry page repeats "listing is not a review or
   security audit" and the strongest local plugins advertise loopback-only routes, host-side keys and
   zero deps. Our README already does this; keep it prominent in the market summary (short
   `summary` field currently emphasizes features, not the trust model).
6. **npm presence matters for the "Add plugin" wizard**: dsh-context and several competitors are on
   npm (`dsh plugin --profile web add dsh-context`), while we lean on Git installs ("npm package may
   lag"). A publish-on-tag workflow (as `dsh-usage-dash` has) would make us installable by name.

---

## 6. Prioritized top borrowables (for `dsh-usage-plus`)

Ranked by value × effort. Effort S/M/L, risk per item.

1. **Official DeepSeek platform billing source (host adapter) + reconcile card** — L, medium risk.
   *Why*: only plugin (`deepseek-usage`) that reads official billing truth, and it does it with DSH's
   own platform credential (no user token paste); closes the "is our local ledger right?" question
   and adds per-day/per-model official usage + cumulative spend next to our balance.
   *Sketch*: host-only `providers/deepseek-platform.ts` behind a Settings toggle; read
   `credentials` record `deepseek-account-platform/default`, send `x-dsh-auth-token` + UA +
   `x-app-version`; month-sliced TTL cache + in-flight dedup; `FIELD_MAP`; silent degrade to the
   existing `api.deepseek.com/user/balance`; surface as a "官方账单 vs 本地台账" coverage strip
   (allowance %, delta, caveats) on the Plugins page; never send the token to the browser; document
   "internal API, may break" like `deepseek-usage` does. Test with fixtures, not live calls.
2. **Per-session CNY cost pill in the composer dock** — S/M, low risk.
   *Why*: the one thing `dsh-usage-dock` has that our strip does not; we already own the price book
   (`src/core/pricing.ts`), the session token facts and the dock slot.
   *Sketch*: mount in `conversation.composer.dock` next to the plan pill (portal, keep the official
   stats row untouched), compute four buckets + spend from the session projection, show the current
   tariff bound and note the other bound in the expanded panel; render `null` on empty/unknown
   routes; never print `¥0.00` for non-zero spend; recompute on rerender (no timers) and document
   the tariff-boundary staleness; add i18n keys + a threshold a11y label.
3. **Generic "custom plan" source** — M, medium security risk.
   *Why*: unbounded provider coverage without an adapter per provider; dsh-usage-dash proves the
   contract is small. Reuse our CPAMC allow-host/redirect/loopback rules.
   *Sketch*: Settings → 自定义额度源 (name, HTTPS origin/URL, optional Bearer token in the vault);
   accept the two JSON shapes and label aliases from §3.2, plus a strict schema + size/time limit;
   convert used→remaining for display; a "测试连接" that shows latency + parsed windows (mirror our
   CPAMC test card); store config in `storages` with the token in credentials; render custom windows
   on the plugin page and (only when the active route matches the declared route id) in the strip.
4. **Ghost-fork-safe backfill + raw-vs-new token split** — S/M, low risk.
   *Why*: our first-install backfill walks session history; forked sessions that only copied a seed
   can double-count (analytics explicitly detects this). Also align the device totals with provider
   consoles by exposing "raw (incl. cache reads)" vs "new tokens".
   *Sketch*: when reading a session snapshot, skip a forked session whose usage window ends before
   its own creation time (or whose events are all pre-creation); record the rule in
   `backfill.json`/health; add a "新 token / 含缓存" toggle or dual line in the overview; regression
   test with two fixture sessions (parent + never-run fork).
5. **Latency & efficiency card: TTFT, decode speed, success rate** — M, medium risk.
   *Why*: three independent plugins expose it (`dsh-our-free-model` per-request log, `dsh-context`
   Timing Stats, `dsh-usage-orb`); our ledger is tokens-only, so we cannot answer "is it slow?".
   *Sketch*: derive TTFT/gen time from session request/header + assistant chunk events during the
   same fold (extend the per-day table with `ttftMs`, `ttftSamples`, `decodeTokens`, `decodeMs`,
   `calls`, `failed` — the exact shape `dsh-our-free-model` uses); show speed/success on the overview
   and per-model table; mark samples as sampled; no provider API calls.
6. **Forecast UX**: "turns until compaction/plan exhaustion" + reset countdown in the plan pill —
   M, medium risk (heuristics). *Why*: `dsh-usage-indicator`, `dsh-usage-dash`, deepseek-peak-* all
   ship some forecast/countdown; ours shows static percentages. *Sketch*: rolling burn rate from the
   ledger (tokens/turn, %/hour) → "按当前速度，5 小时窗口约剩 N 小时"; context headroom from the
   official context projections (only when available). Label as estimate and render nothing when
   the sample is too small.
7. **Exports**: PNG share card (S/M) and out-of-session usage accounting (M). PNG: render the
   existing overview to a canvas (or a hand-drawn SVG card) behind a loopback download route, reusing
   the CSV/JSON download fence. Out-of-session: accept an opt-in JSONL usage log (vision/image calls)
   and label it as a separate source, never mixing it into the ledger silently.
8. **Robustness batch** (S each): NaN/negative guard on usage samples at fold boundaries (borrow
   `dsh-usage-guard`'s stance), `FIELD_MAP` centralization for the new deepseek-platform adapter,
   upstream UA/`x-app-version`/429 backoff, and the bundle/CSS size-budget note from
   `deepseek-usage` (keep client bundle lean; CSS can be served separately if it ever grows).

---

## 7. Files, paths and URLs used

Local (read-only):

- `C:\Users\qxcoo\.dsh\profiles\desktop\package.json` — deps + bundles.
- `C:\Users\qxcoo\.dsh\profiles\desktop\.plugin-manager\logs\operation-*\pnpm.log` — install/update history.
- `C:\Users\qxcoo\AppData\Roaming\@deepseek-ai\dsh-desktop\plugin-operations\operations.jsonl` — desktop enable/install ledger.
- `C:\Users\qxcoo\.dsh\profiles\desktop\node_modules\dsh-context\` — `package.json`, `cordis.patch.yml`,
  `lib/index.d.ts`, `lib/index.js`, `README_en.md`, `locale\*.json`.
- `C:\Users\qxcoo\.dsh\storages\dsh-context\overview-cache.v1.json` — incremental overview cache.
- `C:\Users\qxcoo\.dsh\dsh-usage-plus\{usage-ledger.json, backfill.json, provider-snapshots.json}`.
- `D:\WorkSpace\qxcool\dsh-our-free-model\{package.json, README.md}`,
  `C:\Users\qxcoo\.dsh\our-free-model\stats.json`.
- `D:\WorkSpace\qxcool\dsh-opencode-session\{package.json, README.md, lib\index.js, tests\test.mjs}`.
- `D:\WorkSpace\qxcool\dsh-usage-plus\src\core\pricing.ts`, `src\client\UsageSectionCard.tsx`,
  `src\client\locales.ts`, `src\client\PlanUsageStrip.tsx`, `src\client\index.ts`,
  `src\host\usage-service.ts`.
- `D:\WorkSpace\qxcool\multi-agent-memory`, `D:\WorkSpace\qxcool\dsh-workflow-presets` — inspected, excluded.

Public:

- Registry pages: https://dsh.pub/en/plugins/dsh-usage-plus/, `/dsh-usage-dash/`, `/dsh-usage-dock/`,
  `/dsh-usage-mini/`, `/dsh-usage-indicator/`, `/dsh-usage-orb/`, `/dsh-usage-analytics/`,
  `/dsh-usage/`, `/dsh-usage-billing/`, `/dsh-usage-card/`, `/deepseek-usage/`.
- Index: https://dsh.pub/plugins.json, https://dsh.pub/ , https://dsh.pub/develop-plugin.md
- Second registry: https://dshfind.com/en/plugins/qxcool/dsh-usage-plus
- Pinned READMEs: raw.githubusercontent.com/{kazma258/dsh-usage-card, 2327644800/dsh-usage-analytics,
  yanzoro926/dsh-usage-dash, aliensweety/dsh-usage-dock, sdiwenchen-lang/DeepSeek-Usage}/{commit}/README.md
- Local upstream repos: https://github.com/bowenliang123/dsh-context,
  https://github.com/qxcool/dsh-usage-plus

Not verified / limitations of this report: exact feature parity of the ~20 one-line entrants comes
from dsh.pub summaries, not source review; dsh.pub/plugins.json was too large to enumerate in one
fetch (format truncated at ~119 KB by tooling), so per-plugin pages were used instead; GitHub topic
listing (`https://github.com/topics/dsh-plugin`) timed out and was replaced by dsh.pub's
capability graph; dshfind.com data for our plugin is stale (independent of us).
