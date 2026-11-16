# Official DSH stats / usage / context surfaces — audit & borrowables

Date: 2026-11-16 · Author: stats-researcher (read-only audit)
Repo: `D:\WorkSpace\qxcool\dsh-usage-plus` · Target DSH: `0.2.2-rc.3`

Purpose: study the official stats/usage/context packages shipped inside the DSH asar and the
installed third-party `dsh-context`, then extract concrete, prioritized ideas for
`dsh-usage-plus` (cross-provider token ledger + coding-plan quota + balances + alerts + CSV/JSON
export + 26-week heatmap + composer quota pill, mounted as a `plugins.bundle.config` page).

Everything below was read without modifying source or the profile; no build/restart was run.

## 0. Path conventions and how the asar was read

- `ASAR/` = `C:\Users\qxcoo\AppData\Local\Programs\DeepSeek Harness\resources\app.asar\dsh\node_modules\@deepseek-ai`
- `PROFILE/` = `C:\Users\qxcoo\.dsh\profiles\desktop\node_modules`
- `REPO/` = `D:\WorkSpace\qxcool\dsh-usage-plus`

The asar is a single archive; `read` resolves asar-prefixed paths directly. For bulk listing I
parsed the asar header in memory (file offsets in the header are relative to
`8 + headerSize`, not absolute — offsets in this document are byte positions inside a bundled
single-line `lib/*.js`, so they are approximate anchors, not line numbers).

## 1. What is actually mounted in this installation (verified)

| Fact | Evidence |
|---|---|
| `tokenMeter` + `session-projection` + `session-projection-cache` are mounted on the **host plane** in every profile | `ASAR/dsh-base/cordis.patch.yml:352-353` (`token-meter`), `:172-173` (`session-projection`), `:196-197` (cache) |
| `sessionStats` unit is mounted by the default Web app | `ASAR/dsh-web-app/cordis.patch.yml:96-99` |
| `tokenUsage` / `contextPressure` / `contextBreakdown` are always present in the default product because the meter is host-plane | `ASAR/dsh-web-app/cordis.patch.yml:569-575` (comment: "The token METER stays on the host plane") |
| The experimental **Statistics tab is mounted in this desktop profile** via the inspector bundle | `ASAR/dsh-experimental-inspector-profile/cordis.patch.yml:9-10`; `PROFILE/../package.json` lists `@deepseek-ai/dsh-experimental-inspector-profile` in `dsh.profile.bundles` |
| Default composer has official `activity` (order 0) and `usage` (order 1) pills, then the dock list, then `ContextMeter` | `ASAR/dsh-client-ui-chat/src/client/apply.ts:343-350`; `ASAR/dsh-client-ui-conversation/src/client/skeleton/InputBar.tsx:596-601` |
| Conversation view ids/orders: `chat` 0, `trajectory` 10, `stats` 40 | `ASAR/dsh-client-ui-chat/src/client/apply.ts:237-241`; `ASAR/dsh-client-ui-trajectory/src/client/index.ts:82-83`; `ASAR/dsh-experimental-client-ui-stats/src/client/index.ts:75-81` |
| `dsh-context` 0.85.1 is installed and active (bundle patch row) | `PROFILE/dsh-context/package.json:56-78`; `PROFILE/dsh-context/cordis.patch.yml` (`id: dsh-context`) |

Consequence for us: official per-session token/context numbers are already on screen in the
default product (composer pills + ring), and the full Statistics tab exists in this profile.
Anything we add for "per session / per turn" must be additive and clearly scoped, not a second
copy of those surfaces.

## 2. Surface audits

### 2.1 `dsh-experimental-client-ui-stats` — the Statistics tab

**What it shows.** One tab beside Chat/Trajectory: turns as rows, expandable into steps, with
context, output, cache-hit, first-token latency, model time, output speed, tool time, and a
total-time composition bar; optionally synthetic rows for request headers, prompts, retries,
compactions, approvals, prunes.
(`ASAR/dsh-experimental-client-ui-stats/README.md:12,49-74`)

**Data source / projection.** It registers **no service**; six `ConversationDefinition`s fold the
client event window into one view target `stats`, and the builder aggregates into
`StatsSnapshot.turns` (`src/client/index.ts:63-126`; `src/client/stats-snapshot-builder.ts:16-42`;
`src/client/stats-contract.ts:300-311`). Whole-session totals come from the host projections
`sessionStats` + `tokenUsage` via `useProjection` (`src/client/StatsView.tsx:65-68`;
`src/client/stats-totals.ts:13-40`), falling back to the loaded window and labelling the row
"Window total" vs "Whole-session total" (`src/client/StatsView.tsx:264-268`;
`src/client/locales.ts:298-310`).

**Mount point.** `ctx.slots.inject('conversation.view', … id: 'stats', order: 40, label thunk)`;
inject face builds a `WeakMap`-cached snapshot source and one in-flight `loadOlder` promise per
session binding (`src/client/index.ts:63-126`). Registered by the inspector profile bundle, not by
the default product (`README.md:101`).

**UX / layout.** Full-height table; sticky header at the scrollport top; fixed column widths
(13/15/13.5 + 7 numeric columns + 15.5% time) so measurement columns never get pushed out; an
IntersectionObserver tracks visible turn rows; a pinned footer toolbar with `Switch` toggles and a
`SegmentedControl` for context basis; totals row in `<tfoot>`; an empty state "No measurable step in
the current window." (`src/client/stats.module.css:5-77`; `src/client/StatsView.tsx:197-317`;
`src/client/StatsTable.tsx:34-55,968-999`).

**Loading / paging states.** Scroll to top (or one automatic page on first open when the
scrollport has layout) requests one older page; result is `grew | exhausted | retry`, and `retry`
exists because Chat/Trajectory may own the session's in-flight page. Failed pages render a
retry button instead of a silent no-op; the scroll position is compensated by the prepended height
so the reader's row stays put (`src/client/index.ts:66-120`; `src/client/StatsView.tsx:113-170`).

**Interactions.** Row click expands steps; step row opens an answer/detail accordion (Markdown via
the shared Chat primitive, 16 000-char cap); copy controls; context-delta switch (negative deltas
after compaction use the error colour); tool pills with fixed per-tool tones; prompt-image pill
with hover preview through the shared image cache; `start unknown` marker instead of guessed
values when a step's start is outside the loaded window (`README.md:65-74,103-110`;
`src/client/StatsTable.tsx:57-84,1001-1056`).

**Chart choices / performance techniques worth stealing.**
- Time bars use a **square-root scale** so short steps do not collapse into slivers; the longest
  visible member fills the bar (`src/client/stats-format.ts:145-157`).
- Turn bars are scaled against **only the turns currently visible** (IntersectionObserver), so a
  huge turn scrolled away does not flatten on-screen rows (`src/client/StatsView.tsx:78-82,173-191`).
- Token cells switch `K → M` at 10 million; one-decimal/s durations; `tabular-nums`; token cells
  carry an exact grouped number only in the tooltip (`src/client/stats-format.ts:16-79`;
  `src/client/stats.module.css:44`).
- Cache hit is **token-weighted across steps that reported usage**, never averaged per step
  (`README.md:71`; `src/client/stats-totals.ts:18-28`).
- The view reserves `--dsh-composer-height` bottom padding because the docked composer overlays it
  (`src/client/stats.module.css:5-15`).
- `stepCount` and row view state are kept in refs/maps keyed by turn/step so unexpanded rows
  allocate nothing (`src/client/StatsView.tsx:38-56`; `StatsTable.tsx:330-331`).

**What it does not have (our gap, not theirs).** Cross-provider quota/plan windows, balances,
alerts, export, cost (it shows tokens only), provider/model comparison across sessions, and any
persistent page outside a conversation. It has no cost-per-turn at all.

### 2.2 `dsh-session-stats` — the `sessionStats` projection

**What it is.** A pure host fold over the complete durable log exposing eight totals: `turns`,
`steps`, `llmMs`, `toolMs`, `ttftMs`, `ttftSteps`, `decodeMs`, `decodeTokens`
(`ASAR/dsh-session-stats/src/types.ts:24-41`). Counted on `step/end` (the lifecycle authority) so
failed/cancelled/max-tokens steps count; tool time pairs `tool/call → tool/result` by callId with
prototype-safe own-key checks; decode time needs both a first token and a valid usage report
(`src/projection.ts:106-207`; `README.md:39-50,79-87`).

**Delivery.** Registered on `ctx.sessionProjections` (`src/index.ts:20-30`), wire view is exactly
the eight totals, excluded from session-summary payloads (`src/types.ts:43-51`). It is live (event
fold) and durable (survives paging/compaction), no cost, no per-model attribution.

**Mount.** `ASAR/dsh-web-app/cordis.patch.yml:96-99`. Client namespace is a pure type re-export
(`src/client.ts`). Consumers: official composer Activity pill and the Statistics totals row.

**Borrowable.** Nothing to rebuild — consume it. Its "field names mirror the window fallback so
the two swap wholesale" pattern (`README.md:67-68`) is a good API-design rule for our own
views/exports (same shape for warm/diagnostic fallbacks).

### 2.3 `dsh-token-meter` — `tokenMeter`, `tokenUsage`, `contextPressure`, `contextBreakdown`

**Service API.** `ctx.tokenMeter.measure(session, requestHeader?)` returns a detached frozen
snapshot `{logRevision, baseline, surfaceDeltaTokens, totalTokens, surfaceTokens, nodes}`
(`ASAR/dsh-token-meter/src/index.ts:151-196`; `src/types.ts:22-53`); `estimateMessage(message)` is
the shared fixed heuristic; `contextPressure(session)` reads the latest provider prompt size +
route capacity synchronously (`src/index.ts:122-128`). It replays the durable log, is
deterministic, and reuses provider usage only when the canonical request envelope matches and its
total is no lower than the route-priced anchor (`README.md:43-46,84`).

**Three client projections + one host projection** are registered in `TokenMeter[Service.init]`
(`src/index.ts:103-115`):
- `tokenUsage` — durable cumulative `uncachedInputTokens / outputTokens / cacheReadTokens /
  cacheWriteTokens`, last-sample replacement inside one attempt, `llm/retry-started` closes the
  replacement slot (`src/usage-projection.ts:111-144`; `src/projection.ts:15-20`).
- `contextPressure` — `pressureTokens` (last provider prompt size), `projectedTokens` (pressure +
  signed surface movement since the sample, so compaction is visible immediately), optional
  `contextWindow` from the newest `request/context` (`src/usage-projection.ts:167-213`;
  `src/projection.ts:32-50`).
- `contextBreakdown` — heuristic `systemTokens / toolsTokens / messageTokens` composition, not a
  total; uses the same fixed estimator as `measure()` (`src/breakdown-projection.ts:144-184`;
  `src/projection.ts:61-68`).
- host-only `tokenMeasurement` — bounded recovery facts; state stays O(1) in message count via the
  shadow-price protocol for replacements (`src/surface-projection.ts:24-96`; `README.md:49-53`).
- `deriveTurnTokenUsage(events)` is a **browser-safe pure fold** producing exact per-attempt /
  whole-turn usage with optional cache, reasoning, and `routes: [{provider, model}]`
  (`src/turn-usage.ts:178-274`; `src/client.ts:8-9`). Any missing lifecycle boundary or
  contradictory exact total returns `undefined` instead of a partial number
  (`src/turn-usage.ts:169-178`).

**Heuristic.** 4 chars/token + per-block/role overhead (`src/estimate.ts:12-19,88-102`);
declared image pricing and exact file-handle text replace the heuristic only for routed requests
(`src/route-pricing.ts:32-76`).

**Mount.** Host plane (`ASAR/dsh-base/cordis.patch.yml:352-353`), so all three client projections
are `useProjection`-available to any session-scoped slot without additional plugins.

**Borrowable.** Read `tokenUsage` + `contextPressure`/`contextBreakdown` directly for a
"this session" summary (billed tokens, cache hit with the official denominator, context
occupancy). It is the cheapest way to make our dock pill/popover feel native. `deriveTurnTokenUsage`
is the only official exact per-turn accounting API — use it for export columns if we ever want
per-turn cost; do **not** build a new per-turn chat UI (official `TurnUsagePanel` already exists).

### 2.4 Official composer usage surfaces (nearest neighbors to our dock pill)

- **`StatsPills` (activity order 0, usage order 1)** — two `conversation.composer.dock` entries, each
  a compact pill; Compact mode keeps only speed / cache hit; Detailed opens a portaled stat dialog
  with `sessionStats`/`tokenUsage` rows. Session identity comes from settled-node memoization so
  streaming deltas do not repaint pills. Both read the durable projections and fall back to a
  window fold with identical field names (`ASAR/dsh-client-ui-chat/src/client/chat/StatsPills.tsx:24-39,53-84,108-120,162-170,251-348`).
- **`TurnUsagePanel`** — per completed turn: exact total, cache hit, input/cache-read/write/output,
  reasoning subset, `provider/model` routes, in a trigger-anchored dialog
  (`.../chat/TurnUsagePanel.tsx:31-110`). This is why per-turn stats are already covered.
- **`ContextMeter`** — a 14px ring + percentage below the composer, click-opens a portaled panel
  with the heuristic composition; renders nothing until both `projectedTokens` and
  `contextWindow` exist; ring geometry is viewBox 14, r=5.5, stroke-dasharray rotated −90°
  (`ASAR/dsh-client-ui-conversation/src/client/skeleton/ContextMeter.tsx:17-19,56-173`;
  percent math `src/client/context-occupancy.ts:15-25`).
- **Quota notice host** — frame-wide `shell.overlay` toast for `QUOTA`/`ACCOUNT_QUOTA` failures with
  a replaceable `shell.quota-notice` chain; a claiming entry can keep the notice open with a
  release function (`.../chat/QuotaNoticeHost.tsx:14-27`; `ASAR/dsh-client-ui-chat/README.md:72`).
- **Display-density preference** — `performanceUsage: detailed | compact`, live local adoption +
  Host reconciliation (`.../performance-usage.ts:9-34`; README:83-87). Settings row is in General.
- **Formatting conventions** — compact K/M with one decimal below 100; exact grouped integers in
  dialogs; cache-hit percentage that never rounds a partial hit to 100%
  (`.../chat/token-format.ts:9-30,67-98`).
- **Dock contract** — list slot, session scope, ordered by `order`; a replacement registers the
  same id+order with lower priority; entries get the session standard kit (`useProjection`, `t`)
  and carry `data-composer-stat` on their root
  (`ASAR/dsh-client-ui-conversation/src/client/contract/slots.ts:315,639-646`;
  `ASAR/dsh-client-ui-chat/README.md:85`; `InputBar.tsx:596-601`).

### 2.5 `dsh-client-product-analytics` — no usage UI

Desktop-only telemetry: product events through the OTel exporter, no Web collection, no user-facing
control, no usage widgets (`ASAR/dsh-client-product-analytics/README.md:12,24-28`;
`src/client/index.ts:17-63`). Nothing to borrow visually. Its "capture/report failures must not
interrupt interaction" rule is worth imitating for our probe/alert side effects, nothing more.

### 2.6 Installed `dsh-context` 0.85.1 — the closest prior art (and our biggest overlap)

**Surfaces.** (a) Context Insights page as a first-level center panel; (b) Context tab per
conversation plus right-sidebar panel; (c) Fleet tab; (d) `/context` modal; (e) Preferences card
on its Plugins bundle page (`PROFILE/dsh-context/README_en.md:16-20,62-78,81-103,211-227`).

**Mount points (concrete).**
- Insights page: `slots.register({name:'main', key:'dsh-context'})` **plus**
  `sidebar.panellist` entry `id:'dsh-context', order:20` (bundled `lib/client.js` @ ~508605).
- Context tab: `conversation.view` `id:'context'`; Fleet tab: `conversation.view`
  `id:'fleet', order:30` (@ ~738848).
- Settings card: `configForms.get(...)` + `whileServed` → `plugins.bundle.config`, with
  `pluginNavigation.openBundle('dsh-context')` as a guarded jump (@ ~923007, ~303878).
- View landing trick: writes `localStorage['dsh.conversation.<sessionId>'].view` then
  `uiWorkspace.openSession` (@ ~303638-303878).

**Data.** It reads the **official** `contextPressure` / `contextBreakdown` / `tokenUsage`
projections for head numbers (same values as the composer ring), and adds its own host-side
`contextTimeline` projection (state version 42, `summary:false`, `detailRev` invalidation) plus a
separate daily `contextActivity` ledger projection for the insights page
(@ ~305465, ~514171; `PROFILE/dsh-context/lib/index.js` @ ~83088, ~117241).

**Insights page UX.** KPI band (active/priced sessions, billed tokens, estimated cost, cache hit,
turns, tool runs, active time), a 7-day token+cost paired bar chart, an **8-week** activity
heatmap (metric toggle tokens/sessions, click a day to filter sessions and scope the tally cards),
skill/tool/command tallies that double as filters, an aggregate composition ring, and searchable /
sortable / workspace-grouped session cards that jump into the session
(`README_en.md:62-78,114-134`).

**Cost pipeline (the interesting part).**
- Fetches `https://models.dev/api.json` (8 s timeout) into a price book with versioning and a
  30 s retry floor on failure (`lib/index.js` @ ~92048).
- Price rows are `{hit, miss, write, out}` USD/1M derived from `models.dev` `cost.{input, output,
  cache_read, cache_write}` with `canonical_model_id` aliasing; a route→canonical mapping carries
  `via` and `confidence: high|medium|low` (`lib/index.js` @ ~64286-71875).
- Billing period is split `peak/off`; peak = Beijing weekday 09:00-12:00 & 14:00-18:00, DeepSeek
  at 2× (`lib/index.js` @ ~36317; `lib/client.js` @ ~3586).
- Aggregation returns `{usd, ready, faces[], misses[]}` so the UI can say "priced n/total sessions"
  and list unpriced routes instead of showing a silent zero (`lib/client.js` @ ~71875, locale
  `ov.kpi.pricedSub`). CNY display uses a fixed 0.15 USD/CNY conversion (`stats.costTipCny`).
- Fold/backfill UX: "Computing projections n/total", stalled count, and a `POST
  /api/dsh-context/backfill` retry with exponential backoff (≈1.2 s doubling, max 10 tries, 15 s cap)
  while the fold is starting/folding (`lib/client.js` @ ~34382, ~450807).

**Bounds / caching.** Checkpoints only a compact per-session summary into the projection cache;
heavy per-event detail is refolded from the durable log on demand and capped (steps 1500, turns
300, events 400, surface nodes 2000, archive 400, file ops 400, commands 400)
(`README_en.md:233-235`).

**What it means for us.** `dsh-context` already covers per-session context composition, an 8-week
token/cost heatmap, models.dev cost estimates, and a very mature cross-session insights page. Our
differentiators remain: **cross-provider plan/quota/balance facts with official API sources**,
**threshold alerts**, **CSV/JSON export of the aggregate ledger**, **26-week ledger heatmap**, and
**the composer plan pill**. We should borrow its *honesty and performance patterns*, not rebuild
its context dashboards.

### 2.7 Other packages scanned (no additional usage UI)

338 official `@deepseek-ai` packages were enumerated; matches for
`*usage*|*cost*|*quota*|*stats*|*meter*|*analytics*|*context*` are only the four audited above plus
`dsh-harness-dev-context`, `dsh-time-context`, `dsh-tmux-context` (prompt/context providers, no
usage UI) and `dsh-client-ui-context-menu` (unrelated). A content scan of every bundled `lib/*.js`
for `contextPressure|tokenUsage|sessionStats|contextBreakdown` found consumers only in:
`dsh-api-remotes`, `dsh-api-session-controller` (RPC projectors), `dsh-client-ui-chat`
(pills/turn usage), `dsh-client-ui-conversation` (ContextMeter), `dsh-client-ui-subagent`,
`dsh-experimental-client-ui-stats`, `dsh-session-stats`, `dsh-token-meter`, `dsh-tool-cordis`,
`dsh-client-ui-plugin-market` (pricing/usage display in the market), `dsh-client-ui-schedule` and
`dsh-client-ui-attachment` (token estimates), `dsh-experimental-inspector` devtools. No package
besides `dsh-context` shows cross-provider quota or balances.

## 3. Integration opportunities (concrete sketches)

### 3.1 "This session" card from official projections (S/M)
Our dock strip is a session-scoped list entry, so the standard kit already gives it
`useProjection` and `sessionId` (our own code treats them as optional for tests:
`REPO/src/client/PlanUsageStrip.tsx:37-56,144-151`). Inside the existing plan popover, add a muted
"this session" section:

```tsx
const usage = useProjection?.('tokenUsage') as TokenUsageProjection | undefined
const pressure = useProjection?.('contextPressure') as ContextPressureProjection | undefined
// billed input = uncached + cacheRead + cacheWrite (same math as official pills)
const cached = usage && billedInput > 0 ? formatCacheHit(usage.cacheReadTokens, billedInput) : null
const occupancy = pressure?.projectedTokens && pressure.contextWindow
  ? Math.min(100, Math.round(pressure.projectedTokens / pressure.contextWindow * 100)) : null
```

Render it only when the keys exist (they do in this profile, but guard anyway). Keep it a summary
inside the plan popover — not a second pill — so we do not duplicate `StatsPills`/`ContextMeter`.
A long-term version could show "cost of this session so far" once §3.4 lands.

### 3.2 Link to the official Statistics tab (S)
Capability-detect the view, then land the user on it:

```ts
const views = ctx.slots.entries?.('conversation.view') ?? []           // dsh-context's pattern
const hasStats = views.some(e => JSON.parse(String((e as any)?.options))?.id === 'stats')
if (hasStats) {
  // app-internal but stable in 0.2.2: per-session Conversation store key
  const key = `dsh.conversation.${sessionId}`
  const stored = JSON.parse(localStorage.getItem(key) ?? '{}')
  localStorage.setItem(key, JSON.stringify({ ...stored, view: 'stats' }))
  ctx.get('uiWorkspace')?.openSession?.(sessionId)                      // same fallback dsh-context uses
}
```

Evidence: view id/order `ASAR/dsh-experimental-client-ui-stats/src/client/index.ts:75-81`; store
key format and preferences `ASAR/dsh-client-ui-conversation/src/client/stores.ts:8,47,63-73`;
the localStorage+`openSession` jump is how `dsh-context` lands on its own conversation view
(`PROFILE/dsh-context/lib/client.js` @ ~303638-303878). Risk: the localStorage key is app-internal,
so wrap in try/catch, hide the action when `stats` is absent, and never require it. A session
picker (most recent sessions from `ctx.sessions`/`sessions.list`) is needed because our page is not
session-scoped.

### 3.3 Cache / latency / freshness metrics (S)
We already have an ETag + 304 protocol and per-revision host cache (`REPO/src/client/index.ts:36-59,
88-108,180-258`; README Performance). Expose them honestly, borrowing dsh-context's fold-progress
pattern: "overview rebuilt X s ago", "last probe / failing providers" (we have health), and during
first-install backfill show `n/total sessions` + a stalled count + auto-rebuild retry with backoff
(`PROFILE/dsh-context/lib/client.js` @ ~34382, ~450807). This makes our health card feel like an
official progress surface instead of a static reference table.

### 3.4 Cost-per-turn / per-provider-per-model cost (M)
- **Per-turn**: consume `deriveTurnTokenUsage(events)` from `dsh-token-meter/client`
  (`ASAR/dsh-token-meter/src/client.ts:8-9`; `src/turn-usage.ts:178-274`) and price the returned
  buckets. Offer it as **export columns / optional session drill on our page**, not a new chat UI
  (official `TurnUsagePanel` already owns the in-chat disclosure).
- **Per-provider/per-model estimate**: replace/next to our DeepSeek-only CNY `cost`
  (`REPO/src/core/types.ts:10-30`; `REPO/src/core/pricing.ts:30-68`) with a general book:
  models.dev catalog → `{hit, miss, write, out}` USD/1M, route→canonical alias map with
  `via`/`confidence`, peak/off buckets for DeepSeek, and a `priced issues/total` disclosure
  (`PROFILE/dsh-context/lib/index.js` @ ~92048, ~36318, ~64286-71875; README_en:99,234).
  Keep CNY for DeepSeek plan budgeting and render USD for the rest; never sum mixed currencies into
  one number (we already never mix: `REPO/src/core/types.ts:24-29`). Show "unpriced" chips for
  routes outside the catalog rather than zero cost.
- Risk: network dependency on models.dev, model-id drift, and overlap with dsh-context if both are
  installed. Mitigate with a curated alias table, cached catalog, explicit "estimate" labels, and
  keeping the ledger's stamped at-fold costs (already the case) for replay stability.

### 3.5 Context pressure / budget visuals (S, page-only)
If we add a "current model context budget" card to our page (useful next to plan windows), copy the
official ring geometry and honesty rules: ring 14 px viewBox r=5.5 rotated −90°, percent =
`projectedTokens/contextWindow` clamped to 100, composition bar width proportional to the heuristic
breakdown, `~` before estimated figures, and "render nothing until both pressure and capacity
exist" (`ASAR/dsh-client-ui-conversation/src/client/skeleton/ContextMeter.tsx:17-19,56-173`;
`src/client/context-occupancy.ts:15-25`). **Do not** add another composer ring — the official one is
already there.

### 3.6 Native-feel checklist (S each)
- Numeric formatting: reuse K/M switch at 10 M, one-decimal durations, `tabular-nums`, exact
  grouped integers in tooltips/dialogs (`ASAR/dsh-experimental-client-ui-stats/src/client/stats-format.ts:16-79`;
  `ASAR/dsh-client-ui-chat/src/client/chat/token-format.ts:9-30`). Cache-hit percentages must not
  round a partial hit to 100% (official uses a binary-search exact rounding helper,
  `token-format.ts:32-98`); our `cacheHitRate`/`percentText` are simple — worth upgrading.
- Dialogs/popovers: trigger-anchored via CSS anchor names, portaled to `document.body`, close on
  Escape + outside pointerdown **and** capture-phase click, one dialog at a time
  (`ASAR/dsh-client-ui-chat/src/client/chat/stat-dialog.ts:21-55`; the official
  `ContextMeter` uses the same pattern). Our manual outside-pointer handler in
  `REPO/src/client/PlanUsageStrip.tsx:160-188` should adopt the shared primitive
  (`useDismissOnOutsidePointer`) for identical behavior.
- Tooltips only when the label is clipped (`onlyWhenClipped`), disabled while a dialog is open.
- Empty states: short, factual, action-implying ("No measurable step in the current window.",
  "No activity yet — daily usage appears after sessions make model requests") rather than "No data".
- Scope/chip vocabulary: every number labelled with its scope; `—` for unreported; "Window total" vs
  "Whole-session total"; `start unknown` instead of guesses (`ASAR/dsh-experimental-client-ui-stats/README.md:69,73`;
  `src/client/locales.ts:298-310`).
- Accessibility: dock triggers use `aria-haspopup="dialog"`, `aria-expanded`, `aria-label` carrying
  the full reading, `role="dialog"` panels (`StatsPills.tsx:208-222`; `ContextMeter.tsx:101-133`).
  Our heatmap cells are `<span title>` only (`REPO/src/client/UsageSectionCard.tsx:620-635`) — add a
  table/`role="grid"` + per-cell `aria-label`, and make the day-click filter keyboard reachable.
- i18n: official ships 8 locales; we ship zh/en (`REPO/src/client/locales.ts`). Adopting the same
  language set (copy from official locale files where wording overlaps) is mostly mechanical.
- Telemetry/`data-*`: our cards already carry `data-dsh-part`; follow the dock convention
  (`data-composer-stat`-equivalent) for e2e hooks and keep `aria-live` on alerts
  (`REPO/src/client/UsageSectionCard.tsx:1037`).

## 4. Prioritized borrowables for `dsh-usage-plus`

P0 = do next · P1 = worth a batch once P0 lands · P2 = opportunistic / only if the surface is kept.

| # | Pri | Item | Why | Concrete sketch | Effort | Risk | Duplicate? |
|---|---|---|---|---|---|---|---|
| 1 | P0 | Heatmap as navigation + metric honesty | Our main chart is currently display-only; click-to-filter is the single highest-value interaction pattern from dsh-context and needs no new data | Click a cell → set `selectedDay` in store; Range/History/Provider cards filter to that day (or open a day drawer); mark future days distinctly; optional metric toggle (tokens / cost / calls) via `SegmentedControl`; keep quartile levels (0.25/0.5/0.75) — same as dsh-context `Ql` | S | Low | No |
| 2 | P0 | models.dev-based per-provider/model cost estimate with priced/unpriced honesty | Our ledger only prices DeepSeek CNY (`REPO/src/core/pricing.ts:30-68`); cross-provider cost is the missing number on the ledger page and for export | Host price book: catalog fetch + cache + version; bucket rows `{hit,miss,write,out}` per provider/model with peak/off split for DeepSeek; alias map with `via`/`confidence`; aggregate `{usd, ready, faces, misses}`; UI shows "priced n/total" and unpriced chips; never mix CNY/USD | M | Medium: network, alias drift, dual-pricing overlap with dsh-context | Partial (dsh-context) — but export/ledger home is ours |
| 3 | P0 | "This session" summary inside the plan popover from `useProjection` | Free, live, exact official numbers; makes the dock pill native and answers "how much did this conversation cost/use" without building a session table | Read `tokenUsage` + `contextPressure`; render billed tokens, cache hit (official denominator), context occupancy; guard `undefined`; optional session cost once #2 lands; keep it inside the popover, no new pill | S | Low (projection keys always mounted host-plane; still guard) | No (additive; explicit non-duplication) |
| 4 | P0 | Link to official Statistics tab (+ session picker) | Users who want per-turn/per-step detail should land on the official tab instead of us building one | Capability-detect `conversation.view` id `stats`; pick session from `sessions.list`; write `dsh.conversation.<id>.view='stats'`; `uiWorkspace.openSession`; hide quietly when absent or on error | S | Low-Medium: localStorage contract is internal | No (complementary) |
| 5 | P0 | Backfill/rebuild progress + auto-retry (dsh-context fold pattern) | Our first-install backfill and host rebuild currently show only a finished state in health; a live progress card is the official-feeling version | Expose `{phase: starting|folding|done, done, total, stalled}` in overview/health; while starting/folding, client re-POSTs the rebuild endpoint with exponential backoff (≈1.2 s doubling, 10 tries, 15 s cap); show "stalled n" | S/M | Low | No |
| 6 | P1 | Cache-hit & number-formatting honesty | Our `cacheHitRate`/`percentText` are simple percentage helpers; official never rounds a partial cache hit to 100% and distinguishes K/M/exact | Port the official exact rounding helper + K/M switch + grouped integers (copy from `ASAR/dsh-client-ui-chat/src/client/chat/token-format.ts:32-98` and stats `stats-format.ts:16-79`); apply to page, strip, CSV | S | Low | No |
| 7 | P1 | Shared dialog/popover primitives + accessibility | Our popover hand-rolls outside-close/clamp; official pattern is consistent across dock, and aria wiring is a gap in our pill/heatmap | Use `useDismissOnOutsidePointer`, portaled panel, CSS anchor, Escape/outside close, focus return; `aria-haspopup`/`aria-expanded`; heatmap `role="grid"` + aria labels; tooltip `onlyWhenClipped` | S | Low | No |
| 8 | P1 | Compact / detailed density preference for our page | Official `performanceUsage` shows the pattern: immediate local adoption, Host reconciliation; our page always renders full detail | Add `displayDensity: compact|detailed` to `usage-plus` Config form; compact hides model rows/legend/secondary facts; store adopts accepted Host value via `configForms` (pattern: `ASAR/dsh-client-ui-chat/src/client/performance-usage.ts:9-34`) | S/M | Low | No |
| 9 | P1 | Context-budget card on our page (not composer) | Ties plan quotas to "how close is the context window"; uses official projections/heuristics so numbers match the ring | Read `contextPressure`/`contextBreakdown` in a page card scoped to the current route (if we can obtain a session; otherwise defer to strip popover); ring + stacked bar; `~` estimates; nothing until pressure+capacity both exist | S/M | Medium: page is not session-scoped, needs a chosen session | Partial (composer ring) — restrict to page |
| 10 | P1 | Per-turn cost in export/drill only | Per-turn usage is officially owned in chat; cost-per-turn is genuinely missing and our ledger is the natural home | Backfill/backfill-events already read session history; for export, fold `deriveTurnTokenUsage` per turn and price with #2; expose as CSV columns (`turn`, `provider`, `model`, tokens, cost) and an optional session drill — no chat UI | M | Medium: history traversal cost; exactness gates (`undefined` when unprovable) | No (export only) |
| 11 | P1 | i18n to the official locale set | Native feel; official packages all ship zh/en/ja/de/es/fr/pt/ru | Extend `REPO/src/client/locales.ts` with 6 more dictionaries; reuse official copy for shared vocabulary (quota, cache hit, context, turns/steps) | M | Low | No |
| 12 | P2 | Persistent first-class entry for the ledger page (`main` + `sidebar.panellist`) | Our page is buried in Plugins → bundle page; dsh-context shows how to add a real center page + sidebar entry with guarded settings jump | Register `slots.register({name:'main', key:'usage-plus'})` and `sidebar.panellist` entry; guarded `pluginNavigation.openBundle('usage-plus')` from the page header | L | Medium: new surface, navigation ownership, i18n | No |
| 13 | P2 | Quota/rate-limit notice chain (`shell.overlay` + `shell.quota-notice`) | If a provider probe or session hits quota, official chokepoint exists for consistent toasts; our alerts currently stay in-page/pet bubble | Register a `shell.quota-notice` entry owning our quota codes; fall back to the official Toast; use `keepOpen()` release semantics | M | Medium: slot ownership semantics, unknown codes | Partial (official generic toast) |
| 14 | P2 | Capability detection helper (`ctx.slots.entries`) | Avoid console-error registrations and dead links on profiles without our slots | Tiny helper `hasSlot(name, id)` + `hasProjection(useProjection, key)` used by dock/page/Stats link | S | Low | No |

**Explicitly do not build** (official already covers; rebuilding would duplicate and drift):
per-session/per-turn stats table (Statistics tab), composer stats row (StatsPills + ContextMeter),
per-turn token disclosure in chat (TurnUsagePanel), latency/TTFT/tokens-per-second (Stats tab +
activity pill), context composition browser/trend (dsh-context Context tab), context stopwatch
notices. Our charter stays: cross-provider ledger + plan/quota/balance facts + alerts + export +
heatmap + pill.

## 5. Evidence index (files read)

| Area | Key files |
|---|---|
| Stats tab | `ASAR/dsh-experimental-client-ui-stats/README.md`, `src/client/index.ts`, `StatsView.tsx`, `StatsTable.tsx`, `stats-contract.ts`, `stats-totals.ts`, `stats-usage.ts`, `stats-format.ts`, `stats-snapshot-builder.ts`, `stats-definition.ts`, `stats.module.css`, `src/client/locales.ts` |
| sessionStats | `ASAR/dsh-session-stats/README.md`, `src/index.ts`, `src/projection.ts`, `src/types.ts`, `src/client.ts` |
| token meter | `ASAR/dsh-token-meter/README.md`, `src/index.ts`, `src/types.ts`, `src/client.ts`, `src/projection.ts`, `src/usage-projection.ts`, `src/breakdown-projection.ts`, `src/surface-projection.ts`, `src/route-pricing.ts`, `src/estimate.ts`, `src/turn-usage.ts` |
| Official composer | `ASAR/dsh-client-ui-chat/src/client/chat/{StatsPills,TurnUsagePanel,QuotaNoticeHost,stat-dialog,token-format}.tsx/ts`, `src/client/performance-usage.ts`, `src/client/apply.ts`, `README.md`; `ASAR/dsh-client-ui-conversation/src/client/skeleton/{ContextMeter,InputBar}.tsx`, `src/client/context-occupancy.ts`, `src/client/stores.ts`, `src/client/contract/slots.ts` |
| product analytics | `ASAR/dsh-client-product-analytics/README.md`, `src/client/index.ts`, `src/events.ts` |
| dsh-context | `PROFILE/dsh-context/package.json`, `README_en.md`, `cordis.patch.yml`, `lib/client.js` (bundled; byte anchors above), `lib/index.js` (host: models.dev catalog, `contextTimeline` projection, backfill route) |
| Composition | `ASAR/dsh-base/cordis.patch.yml`, `ASAR/dsh-web-app/cordis.patch.yml`, `ASAR/dsh-experimental-inspector-profile/cordis.patch.yml`, desktop profile `package.json`/`cordis.patch.yml` |
| Our surfaces | `REPO/src/client/index.ts`, `PlanUsageStrip.tsx`, `usage-store.ts`, `UsageSectionCard.tsx`, `REPO/src/core/{types,pricing,heatmap}.ts`, `REPO/README.md`, `REPO/docs/plans/2026-09-13-dsh-usage-plus-design.md` |

## 6. Open questions

1. Does the `dsh.conversation.<sessionId>` store key stay stable across DSH 0.2.x? The Stats-tab
   link should degrade silently if it changes; a future official `uiConversation` "openView" API
   would replace it.
2. Should our page price in USD (models.dev) or keep CNY for budget parity with DeepSeek plan
   windows? Recommended: CNY for DeepSeek budget/alerts, USD estimates for other providers, never
   summed together.
3. If `dsh-context` is co-installed, duplicated cost estimates could disagree (its models.dev
   snapshot vs ours). Recommend a single visible "estimate source + as-of" label and accepting
   small differences, or deferring to its numbers when present.
