# Provider adapter research — next batch (2026-11-16)

Status: research report, read-only for `src/`. Owner: provider-researcher (task-16).
Target: extend `src/core/adapters.ts` with **more real, documented (or strongly evidenced)**
balance / coding-plan quota probes. No invented URLs, no guessed field names.

Repo state: `dsh-usage-plus@0.5.0`, DSH `0.2.2-rc.3`, installed pi-ai catalog
`@earendil-works/pi-ai@1.3.0`. Adapter registry: 14 adapters in
[`src/core/adapters.ts`](../../src/core/adapters.ts).

---

## 0. TL;DR — recommended batch

### Implement now (fixed host, existing credential plumbing)

| # | Adapter | Route id(s) | Probe | Kind | Effort | Confidence |
|---|---------|-------------|-------|------|--------|------------|
| 1 | **Anthropic subscription (Claude Pro/Max)** | `anthropic` | `GET https://api.anthropic.com/api/oauth/usage` (OAuth access token) | plan (5h/week) | **S** | community-documented, strongly evidenced (repo's own CPAMC path already parses it) |
| 2 | **Vercel AI Gateway credits** | `vercel-ai-gateway` | `GET https://ai-gateway.vercel.sh/v1/credits` (Bearer `AI_GATEWAY_API_KEY`) | balance (USD) | **S** | **official docs**, exact sample body |
| 3 | **Z.AI route-id bugfix** (not a new endpoint) | add `zai` to the existing GLM adapter | existing `GET https://api.z.ai/api/monitor/usage/quota/limit` | plan | **S** | installed catalog id; no new API |

### Implement next, gated on a small host seam (each listed with the exact plumbing)

| # | Adapter | Route id(s) | Blocker | Effort | Confidence |
|---|---------|-------------|---------|--------|------------|
| 4 | **GitHub Copilot premium quota** | `github-copilot` | pi-ai stores the **Copilot bearer** as `access` and the **GitHub token** as `refresh`; harness only forwards `access` (usage-service.ts:1430). Needs `refreshToken` in the probe context. | M | community-documented, sample bodies verified by multiple tools |
| 5 | **NanoGPT balance** | hand-declared route e.g. `nano-gpt` | probe must be **POST** with `x-api-key`; `ProbeSpec` is GET-only (usage-service.ts:1357). Needs `ProbeSpec.method`. | S | official docs, exact sample body |
| 6 | **Synthetic subscription quotas** | hand-declared route e.g. `synthetic` | endpoint documented, but a 2026-09 report says `/v2/quotas` now requires a dashboard session and rejects API keys — **must be live-verified before implementing**. Field names not published. | S after verification | documented endpoint, disputed auth |

### Not viable in this framework (documented separately in §4)

- Self-hosted gateways **need a configurable base URL**: One API (OpenAI-compatible
  billing routes, best gateway fit), LiteLLM (`/key/info`, needs master key),
  New API (`/api/user/self`, needs dashboard session).
- **Chutes** needs a user id/username path segment; **xAI** needs a Management Key +
  team id; **OpenAI org / Anthropic Admin usage APIs** need org admin credentials and
  report aggregates, not a balance.
- **OpenCode Zen** has no balance endpoint; **Together AI** has no API balance endpoint;
  Fireworks / DeepInfra / Mistral / Perplexity / iFlow / DashScope / Qianfan / Tencent /
  HF / NVIDIA / Groq / Cerebras / Baseten / meta / ant-ling / radius / typesafe could
  **not be verified** in this pass (see §4.3).

---

## 1. Method and environment notes

- The session's `web_search` tool is broken in this environment (upstream DeepSeek search
  credential returns HTTP 401). Research was done with:
  - direct `web_fetch` of vendor docs (official pages where reachable),
  - Brave/Bing HTML search results via `web_fetch` for secondary evidence,
  - GitHub raw source of open-source projects (LiteLLM, New API, One API, OpenAI OpenAPI),
  - the **installed DSH/pi-ai catalogs**, extracted from
    `C:\Users\qxcoo\AppData\Local\Programs\DeepSeek Harness\resources\app.asar` by reading
    the asar header and verifying each extracted file against its recorded SHA-256
    (results below are from `@earendil-works/pi-ai@1.3.0` inside that archive).
- Live route list observed from the running host
  (`GET http://127.0.0.1:9986/api/dsh-usage-plus/overview`) for this profile:
  `opencode-go`, `deepseek`, `deepseek-official`, `cpamc`, `deepseek-account`,
  `volcengine`, `volcano:ark-plan`.
- No DSH build/test/restart was performed. Only this file was written.

### 1.1 How routes and endpoints are discovered (facts the adapters rely on)

- A DSH model route id is either (a) an installed pi-ai catalog provider id, or
  (b) a hand-declared route key in `llm-pi-ai.providers` (lowercase hyphenated id).
  The llm registry only reports **configured** routes through
  `llm.listProviders()`; `listConfigurableProviders()` adds catalog entries.
  Adapter `ids` therefore have to match either the catalog id or the user's
  hand-declared route name.
- Per-route configuration lives in the `llm-pi-ai` entry's `providers` dictionary:
  `apiKeyEnv`, optional `baseURL`, `api`, `models`, `displayName`. Example from this
  profile's `cordis.patch.yml` (PII-free):
  ```yaml
  - id: llm-pi-ai
    config:
      providers:
        cpamc:
          displayName: CPAMC
          apiKeyEnv: CPAMC_API_KEY
          api: openai-completions
          baseURL: https://api.ominisalesagent.com/v1
  ```
- `usage-service.ts` already reads that profile (`piAiProfile()` at
  `src/host/usage-service.ts:1515`) for `apiKeyEnv` and `baseURL`, and exposes the
  current route's `baseURL` on the overview wire document. **It does not pass
  `baseURL` into the probe context.**
- Installed catalog ids (`provider-data.generated.ts`, pi-ai 1.3.0) — full list:
  `amazon-bedrock, ant-ling, anthropic, azure, baseten, cerebras,
  cloudflare-ai-gateway, cloudflare-workers-ai, deepseek, fireworks, github-copilot,
  google, google-vertex, groq, huggingface, kimi-coding, meta, minimax, minimax-cn,
  mistral, moonshotai, moonshotai-cn, nvidia, openai, openai-codex, opencode,
  opencode-go, openrouter, qwen-token-plan, qwen-token-plan-cn,
  qwen-token-plan-individual, radius, together, typesafe, vercel-ai-gateway, xai,
  xiaomi, xiaomi-token-plan-ams, xiaomi-token-plan-cn, xiaomi-token-plan-sgp, zai,
  zai-coding-cn`.
- OAuth-capable catalog providers in pi-ai 1.3.0 (relevant for plan probes):
  `anthropic`, `github-copilot`, `kimi-coding`, `openai-codex`, `openrouter`, `xai`,
  `radius`, `meta`. The harness stores the grant at `llm-pi-ai/<provider id>` and
  `resolveCredential()` (`usage-service.ts:1419`) hands `payload.access` to adapters;
  only `payload.chatgpt_account_id` is forwarded as `accountId`.
- **Route-id gaps in the current registry** (found while checking the catalog):
  - GLM intl: catalog id is `zai`, adapter ids are `zai-coding` + CN's
    `zai-coding-cn`. `adapterFor('zai')` returns undefined ⇒ a `zai` route is never
    probed. `zai-coding` is not a current catalog id (legacy/hand-declared name).
  - `qwen-token-plan*` and `xiaomi-token-plan*` routes have no adapter and no verified
    usage endpoint yet.
  - `opencode` (OpenCode Zen) has no balance endpoint (existing `opencode-go` plan
    adapter only covers the Go plan).

---

## 2. Current adapter contract (what fits and what does not)

`src/core/adapters.ts:14-60`:

```ts
interface ProbeSpec { url: string; headers: Record<string, string> }
interface AdapterProbeContext { apiKey: string; accountId?: string }
interface ProviderAdapter {
  ids: readonly string[]
  preferredId?: string
  displayName: string
  balance?: { build(ctx): ProbeSpec; parse(status, body): BalanceParse | undefined }
  plan?:    { build(ctx): ProbeSpec; parse(status, body): PlanParse | undefined }
}
```

Host probe (`usage-service.ts:1352-1368`) does a **GET only**:
`fetch(spec.url, { headers: spec.headers, signal })`, JSON body, requires HTTP 2xx,
then `parse()`. 10 s timeout, 3-at-a-time concurrency, failure backoff
60 s → 300 s → 900 s. Plan windows display keys are `5h | week | month`
(`src/core/plan-match.ts:24-35`).

Consequences:

1. **Fixed-host, `Authorization`-header GET probes fit today.** Only credential
   `apiKey`/`accountId` are available.
2. **Configurable base URLs** (self-hosted gateways) cannot be probed: the context has
   no `baseURL`. The plumbing required is small and specified in §5.1.
3. **POST probes** cannot be expressed: `ProbeSpec` needs `method?` (§5.2).
4. **OAuth credentials other than the access token** (Copilot's GitHub token) cannot be
   reached: `resolveCredential` must forward more of the pi-ai grant payload (§5.3).
5. **OAuth-only endpoints probed with API keys** would emit a permanent 401 error line.
   Recommended adapter flag `credential: 'oauth' | 'api-key' | 'any'` so the host skips
   a half instead of recording a misleading error (§5.4).
6. New hosts must be added to `package.json` → `dshhub.permissions.network`
   (currently `api.anthropic.com` and `ai-gateway.vercel.sh` are missing).

---

## 3. Candidate dossiers — implementable with the current contract

### 3.1 Anthropic subscription quota (`anthropic`) — **recommended, S**

- **Route id**: `anthropic` (pi-ai catalog; defaultBaseURL `https://api.anthropic.com`,
  `ZAI`-style OAuth only — do not derive the usage host from a configured baseURL).
- **Credential**: pi-ai OAuth grant "Anthropic (Claude Pro/Max)"
  (`{ type: 'oauth', access, refresh, expires }`). `resolveCredential()` already returns
  `kind: 'oauth'`, `key: access` for it, so **no host plumbing is needed**. API-key
  users have no subscription windows and must be skipped, not error-reported.
- **Probe**:
  ```
  GET https://api.anthropic.com/api/oauth/usage
  authorization: Bearer <oauth access token>
  anthropic-beta: oauth-2025-04-20
  user-agent: claude-code/<version>
  accept: application/json
  ```
  `user-agent` is not cosmetic: without it the endpoint rate-limits aggressively
  (persistent 429s); a `claude-code/...` UA gets a much larger bucket.
- **Sample body** (real-world capture; percentages are 0–100 "used"):
  ```json
  {
    "five_hour": { "utilization": 33.0, "resets_at": "2026-04-11T07:00:00.528743+00:00" },
    "seven_day": { "utilization": 13.0, "resets_at": "2026-04-17T00:59:59.951713+00:00" },
    "seven_day_opus": null,
    "seven_day_sonnet": { "utilization": 1.0, "resets_at": "2026-04-16T03:00:00.951719+00:00" },
    "extra_usage": { "is_enabled": false, "monthly_limit": null, "used_credits": null, "utilization": null }
  }
  ```
- **Field mapping**: `five_hour.utilization` → `{ key: '5h', percent }`;
  `seven_day.utilization` → `{ key: 'week', percent }`; optional
  `seven_day_sonnet` / `seven_day_opus` → extra windows (`week-sonnet`, `week-opus`;
  the strip filters to `5h|week|month`, the plan card still shows them);
  `resetsAt = toIso(window.resets_at)`; a `null`/absent window is skipped (idle 5h
  windows legitimately return `five_hour: { utilization: 0, resets_at: null }` or
  `five_hour: null`); `planName` unknown (leave undefined); `extra_usage` is not a
  confirmed CV/currency fact — ignore in v1.
- **Confidence**: undocumented internal endpoint, but independently reproduced by many
  tools (Claude Code statusline/usage monitors) and this repo's CPAMC path already
  calls exactly this URL with those headers (`src/host/external-sources.ts:88`).
  Endpoint existence confirmed live (unauthenticated request returns
  `401 x-api-key header is required`, i.e. the route exists).
- **Risk / ToS**: OAuth-token use outside Claude Code is contested; Anthropic's
  consumer credential-use policy is cited by downstream projects as a possible ToS
  issue. Mitigate: read-only GET, no token logging, honour 429/backoff (already
  generic 60 s → 900 s). The `/api/oauth/usage` endpoint is also rate-limited
  (community reports 429 with a 60 s+ window); the default 60 s poll is borderline —
  consider not probing this adapter more often than the poll interval and relying on
  the existing backoff.
- **Tests**: build asserts URL/Bearer/beta/UA; parse: full sample; `five_hour: null`;
  `resets_at: null`; missing `seven_day_sonnet`; utilization as integer; extra
  unknown fields tolerated.
- **Network allowlist**: add `https://api.anthropic.com`.

### 3.2 Vercel AI Gateway credits (`vercel-ai-gateway`) — **recommended, S**

- **Route id**: `vercel-ai-gateway` (pi-ai catalog; defaultBaseURL
  `https://ai-gateway.vercel.sh`; env `AI_GATEWAY_API_KEY`).
- **Credential**: AI Gateway API key, `Authorization: Bearer <AI_GATEWAY_API_KEY>`
  (team inferred from the key). Resolved by existing `apiKeyEnv`/vault path.
- **Probe**: `GET https://ai-gateway.vercel.sh/v1/credits`
  header `authorization: Bearer <key>`.
- **Sample body (official docs, 2026-09-11)**:
  ```json
  {
    "balance": "95.50",
    "token_pass": { "remaining": "12.34", "resets_at": "2026-12-01T00:00:00.000Z" },
    "total_used": "4.50"
  }
  ```
  `token_pass` is `null` when the team has no active Token Pass.
- **Field mapping**: `balance` is a **USD string** → `{ currency: 'USD',
  totalBalance: money(toNum(balance)) }`. Ignore `total_used` (lifetime spend is not a
  window). `token_pass` has no total so no percent window: do not invent one; if a
  future model renders raw credit, it is optional.
- **Confidence**: official REST API reference; exact sample JSON and field table.
- **Risk**: balance is **team-scoped** (one key = one team), not per-user; docs say
  Hobby/Pro-trial plans may not use spend-report endpoints, but `/v1/credits` is the
  auth-only endpoint. Low risk.
- **Tests**: sample with `token_pass` object and `null`; numeric-looking strings;
  missing `balance` → `undefined`; 401 → thrown by host.
- **Network allowlist**: add `https://ai-gateway.vercel.sh`.

### 3.3 Z.AI route-id fix (existing GLM adapter) — **recommended, S**

- Installed catalog ids: `zai` (`https://api.z.ai/api/coding/paas/v4`, env `ZAI_API_KEY`)
  and `zai-coding-cn` (`https://open.bigmodel.cn/api/coding/paas/v4`, env
  `ZAI_CODING_CN_API_KEY`).
- Current code:
  ```ts
  glmPlan('open.bigmodel.cn', ['zai-coding-cn']),   // matches catalog: ok
  glmPlan('api.z.ai', ['zai-coding']),              // catalog id is `zai`: BUG
  ```
  Effect: on a `zai` route the GLM coding-plan quota is never probed (no snapshot, no
  plan card, no strip). Fix without touching the endpoint:
  ```ts
  { ...glmPlan('api.z.ai', ['zai', 'zai-coding']), preferredId: 'zai' }
  ```
  Keep the legacy `zai-coding` alias so hand-declared routes keep working;
  `preferredId: 'zai'` keeps `dedupeProviderAliasRoutes` collapsing both live routes
  to one probe/row.
- **Tests**: `adapterFor('zai')` returns the intl GLM adapter; dedupe keeps `zai` when
  both `zai` and `zai-coding` routes exist; parse sample unchanged.
- **Risk**: none (no new network host).

---

## 4. Candidates that do not fit the current contract (with the exact gap)

### 4.1 GitHub Copilot premium-request quota (`github-copilot`) — M, needs token plumbing

- **Route id**: `github-copilot` (pi-ai catalog; defaultBaseURL
  `https://api.individual.githubcopilot.com`; OAuth `isSubscription: true`).
- **Probe**: `GET https://api.github.com/copilot_internal/user`
  header `authorization: token <github-oauth-token>` (a `gh auth token` / GitHub OAuth
  token; endpoint needs no specific OAuth scope; `Authorization: Bearer` is also
  accepted by the same route). `accept: application/json` and any reasonable UA work.
- **Sample body** (verified by two independent tools, 2026-09/10):
  ```json
  {
    "copilot_plan": "business",
    "token_based_billing": true,
    "quota_reset_date": "2026-11-01",
    "quota_reset_date_utc": "2026-11-01T00:00:00.000Z",
    "quota_snapshots": {
      "chat": { "unlimited": true, "entitlement": 0, "remaining": 0, "percent_remaining": 100.0 },
      "completions": { "unlimited": true, "entitlement": 0, "remaining": 0, "percent_remaining": 100.0 },
      "premium_interactions": {
        "unlimited": false,
        "entitlement": 400000,
        "remaining": 160587,
        "percent_remaining": 40.1,
        "credits_used": 239412,
        "overage_permitted": true,
        "overage_count": 0,
        "token_based_billing": true
      }
    }
  }
  ```
  Older accounts expose `monthly_quotas` + `limited_user_quotas`
  (`{ chat, completions }`, request counts) instead of `quota_snapshots`; both shapes
  are handled by downstream tools.
- **Mapping**: for each non-unlimited snapshot (`premium_interactions` primarily,
  `chat`/`completions` usually unlimited): `percent = 100 - percent_remaining`
  (clamped), `key: 'month'`, `resetsAt = quota_reset_date_utc`;
  `planName = copilot_plan` (e.g. `business`, `enterprise`).
- **Blocker (the real one)**: pi-ai's Copilot OAuth payload is
  `{ type: 'oauth', refresh: <github token>, access: <copilot bearer>, expires,
     enterpriseUrl, availableModelIds }`. The harness forwards only `access`
  (`usage-service.ts:1430-1436`), so the adapter would receive the **Copilot bearer**
  and `api.github.com/copilot_internal/user` would 401. Fix: forward `payload.refresh`
  as a new context field and use it for this adapter (§5.3). For GitHub Enterprise
  Server the host of `/copilot_internal/user` is not `api.github.com` — unverified.
- **Alternative that needs no new code**: CPAMC / CLI Proxy API already probes Codex,
  Kimi and Claude accounts through the management API (`external-sources.ts:86-107`);
  Copilot accounts behind CPAMC are not covered there either, so an adapter is the only
  path.
- **Risk**: internal undocumented endpoint (used by VS Code / Copilot CLI), may change;
  read-only; token-type trap documented above. Effort M (plumbing + adapter + tests).

### 4.2 NanoGPT balance — S after a one-line method extension

- **Probe** (official docs):
  ```
  POST https://nano-gpt.com/api/check-balance
  x-api-key: <api key>
  accept: application/json
  ```
  (Some clients pass `Authorization: Bearer <key>`; the docs page shows `x-api-key`.
  No request body.)
- **Sample body (official docs)**:
  ```json
  {
    "usd_balance": "129.46956147",
    "nano_balance": "26.71801147",
    "nanoDepositAddress": "nano_1gx385nnj7rw67hsksa3pyxwnfr48zu13t35ncjmtnqb9zdebtjhh7ahks34"
  }
  ```
- **Mapping**: `usd_balance` → `{ currency: 'USD', totalBalance: money(value) }`.
  `nano_balance` is a crypto-denominated balance (Nano/XNO) and is not USD —
  leave it out (marked unknown).
- **Blockers**: (1) `ProbeSpec` has no method ⇒ add `method?: 'GET' | 'POST'`
  (§5.2); (2) there is **no pi-ai catalog route** for NanoGPT, so the user must
  declare a gateway route in `llm-pi-ai.providers` (e.g. id `nano-gpt`,
  `api: openai-completions`, `baseURL: https://nano-gpt.com/api/v1`) and the adapter
  ids must match the chosen convention (`['nano-gpt']`). Document the convention.
- **Risk**: low; official docs. Route-id friction is the main UX cost.

### 4.3 Synthetic subscription quotas — documented endpoint, disputed auth, verify first

- **Probe (docs)**: `GET https://api.synthetic.new/v2/quotas`, `Authorization: Bearer
  <SYNTHETIC_API_KEY>`. Docs state the request does not count against subscription
  limits.
- **Fields unknown**: the docs page is client-rendered and could not be captured here;
  a VS Code tracker shows categories like `energy requests: 470 / 600`, hourly search
  quotas with reset timestamps — the JSON names are **not confirmed**, so do not
  guess them.
- **Auth dispute**: a 2026-09 report says `/v2/quotas` now requires a Clerk dashboard
  session and rejects API keys (401 "Invalid API Key") while `/v1/chat/completions`
  still works with the key. This may be account- or version-dependent.
- **Decision**: verify with one live key (one `curl`) before writing the adapter. If
  it returns quota JSON, capture the body and implement as a plan adapter; otherwise
  drop. There is no catalog route, so a hand-declared route key would be needed too.

---

## 5. Host plumbing needed for the rest (design, no code changed)

### 5.1 Configurable base URL for gateway routes (`baseURL` in probe context)

- `usage-service.ts` already reads it: `piAiProfile(route.id)?.baseURL`
  (`usage-service.ts:1515`, used at :680 and :1563). Adapter plumbing:
  ```ts
  // adapters.ts
  interface AdapterProbeContext { apiKey: string; accountId?: string; baseURL?: string }
  // usage-service.ts probeRoute()
  const spec = half.build({ apiKey, accountId, ...(profile?.baseURL ? { baseURL: profile.baseURL } : {}) })
  ```
- Rules: treat `baseURL` as an origin+prefix (`https://host/gateway`), strip trailing
  `/`, append the vendor path; do not require it for fixed-host adapters; if missing,
  the gateway adapter returns undefined so the row reports no probe rather than
  probing a guessed host.
- Enables, in increasing effort:

**One API (`one-api`) — best gateway fit, M.** Token-auth OpenAI-compatible billing
routes (verified in upstream source):
```
GET {base}/dashboard/billing/subscription     -> {"object":"billing_subscription","has_payment_method":true,
                                                  "soft_limit_usd":<remain+used><,"hard_limit_usd":...>,
                                                  "system_hard_limit_usd":...,"access_until":<unix>}
GET {base}/dashboard/billing/usage            -> {"object":"list","total_usage":<used*100>}  // cents
```
`Authorization: Bearer <one-api token>` (`TokenAuth` middleware). Balance =
`hard_limit_usd - total_usage/100` in USD **only when the instance has
`DisplayInCurrencyEnabled`** (otherwise values are raw quota units, currency unknown
→ skip). Paths exist with and without the `/v1` prefix. One API only: current New API
no longer exposes these routes (verified against its router sources).

**LiteLLM proxy (`litellm`) — M, privileged credential.** Documented:
`GET {base}/key/info?key=<virtual-key>` with `Authorization: Bearer <master key>` →
`{"key":"...","info":{"token":"sk-...","spend":0.0001065,"max_budget":<USD|null>,
"budget_duration":...,"budget_reset_at":...,"key_alias":...,"models":[...],
"expires":...}}`; `GET {base}/user/info?user_id=<id>` with master key returns the user
row (`spend`, `max_budget`, `budget_reset_at`, keys). Balance only exists when
`max_budget != null` (= `max_budget - spend`); otherwise only spend is available, which
is not a balance. Needs the **master key** (privileged — must be a separate opt-in
secret, not the route key) and a key/`user_id` to query. Virtual-key self-lookup
without the master key is **unverified**. High config/security cost → defer.

**New API (`new-api`) — M, session problem.** `GET {base}/api/user/self` →
`{"success":true,"data":{"quota":<int>,"used_quota":<int>,"request_count":<int>,
"aff_quota":...}}`; quota units are converted with `GET {base}/api/status`
(`quota_per_unit`, `quota_display_type`). Auth: dashboard session or personal access
token — but the upstream router puts `/self` under `UserAuth()` and its access-token
layer has dashboard-session-only route scopes (`AUTH_SESSION_REQUIRED`), so an
API-key-only probe is not reliable. Would need a session cookie → do not pursue as a
key probe.

### 5.2 `ProbeSpec.method` (for NanoGPT and similar POST probes)

```ts
interface ProbeSpec { url: string; headers: Record<string, string>; method?: 'GET' | 'POST' }
// usage-service.ts: fetch(spec.url, { method: spec.method ?? 'GET', headers, signal })
```
One-line host change + type; no body support needed for NanoGPT.

### 5.3 Forward the pi-ai OAuth `refresh` (GitHub token) to probes

```ts
// resolveCredential(), grant branch
return { kind: 'oauth', key: access, ...(refresh ? { refreshToken: refresh } : {}), ...(accountId ? { accountId } : {}) }
// AdapterProbeContext: refreshToken?: string
```
Needed by Copilot; safe because the value never leaves the host process.

### 5.4 Adapter credential gate (avoid misleading 401 rows)

Add `credential?: 'oauth' | 'api-key' | 'any'` (default `'any'`) to each probe half.
In `probeRoute()`, skip a half when `adapter[kind].credential === 'oauth' &&
credential.kind !== 'oauth'` (and vice versa) — the row then reports
`balanceSupported`/`planSupported` only. Anthropic and Copilot are `oauth`; Vercel and
NanoGPT are `api-key`; everything existing stays `any`.

### 5.5 Extra per-route identifiers (Chutes user id, xAI team id)

`AdapterProbeContext.accountId` exists but is only populated from
`payload.chatgpt_account_id`. For Chutes/xAI a configurable per-route id is needed
(plugin setting like `probeAccountIds: { "chutes": "<user id>", "xai": "default" }` or
an optional `accountId` field accepted in `llm-pi-ai.providers.<id>` — the latter is a
DSH config-schema change and out of scope here). Proposed later; do not build these
adapters until the id can be supplied.

### 5.6 Network allowlist

`package.json` → `dshhub.permissions.network` must include the host of every new
fixed probe: `https://api.anthropic.com`, `https://ai-gateway.vercel.sh`. Gateway
probes with a user-supplied base URL should be treated as user-configured endpoints
(documented in the plugin README/permissions UI), not added statically.

---

## 6. Providers investigated and **excluded** (with reasons)

| Provider | Route id (catalog) | Finding | Confidence |
|---|---|---|---|
| OpenCode Zen | `opencode` | No balance endpoint. The only usage endpoint (`/zen/go/v1/usage`) is the **Go plan** window API already used by `opencode-go`; upstream issue asks for a Zen balance API and confirms quota tools still scrape the billing page. Exclude. | verified (upstream issue + current adapter) |
| Together AI | `together` | Prepaid credits are hard-stop billing, but **no balance/usage API** is exposed to the API key (docs only describe Console billing; community states no SDK endpoint). Exclude. | docs + community |
| Chutes | *(no catalog route)* | Documented `GET https://api.chutes.ai/users/{user_id_or_username}/balance` (API key or Bearer) exists, but needs the user id/username in the path — no field for it in the probe context, and `GET /users/me` is reported to require a login JWT rather than a `cpk_` key. Needs account-id plumbing + hand-declared route. Defer. | official docs + community |
| xAI | `xai` | Management API has documented billing endpoints, e.g. `GET https://management-api.x.ai/v1/billing/teams/{team_id}/prepaid/balance` and `POST /v1/billing/teams/{team_id}/usage`, but they require a **Management Key** (console.x.ai, billing read permission) plus a team id — not the inference key / pi-ai OAuth grant. SuperGrok subscription quota has no documented endpoint. Defer (separate credential target). | official docs |
| Fireworks | `fireworks` | Admin API exists in docs; a billing/credit endpoint could not be verified in this pass. Unknown — do not invent. | unverified |
| DeepInfra | *(hand-declared)* | No public balance/usage endpoint found. Unknown. | unverified |
| Mistral | `mistral` | No public balance/usage API found (Console only). Unknown. | unverified |
| Perplexity | *(hand-declared)* | No balance/quota API; usage is dashboard-only. Exclude. | community |
| iFlow | *(hand-declared)* | Could not verify any balance/usage endpoint. Unknown. | unverified |
| Alibaba DashScope / Qwen | `qwen-token-plan*` | Control-plane usage requires Alibaba Cloud AK/SK signed requests; the token-plan routes exist in the catalog but no usage endpoint is documented for them in a form this adapter can call with an API key. Marked **high-value unknown**; needs vendor-doc research (Model Studio / MaaS) before implementing. | unverified |
| Xiaomi MiMo token plans | `xiaomi-token-plan-*` | Same as above: catalog routes exist (`token-plan-{cn,sgp,ams}.xiaomimimo.com`), no documented usage endpoint found. Unknown. | unverified |
| Baidu Qianfan / Tencent Hunyuan | — | Billing usage APIs are AK/SK signed control-plane calls (same shape as the existing Volcano source, `external-sources.ts:166-283`) — not a per-route API-key probe. Would be a new external source, not an adapter. | architecture-level |
| HuggingFace / NVIDIA / Groq / Cerebras / Baseten / meta / ant-ling / radius / typesafe / cloudflare / azure / bedrock / google / vertex | catalog ids | No public per-key balance endpoint found; several are OAuth/cloud-credential-based. Exclude from adapter work. | unverified |
| Kimi / Moonshot / DeepSeek / MiniMax / GLM / OpenRouter / SiliconFlow / ZenMux / Codex | — | Already implemented. Kimi Coding OAuth users work through the existing Bearer probe because `resolveCredential` hands the grant's access token to every adapter; OpenRouter OAuth likewise. No change needed, but a smoke test with an OAuth credential would be worthwhile. | implemented |

### 6.1 Enterprise org usage APIs — not adapters

- **OpenAI**: `GET https://api.openai.com/v1/organization/costs` and
  `GET /v1/organization/usage/{completions,embeddings,...}` require an
  **Admin API key** (`Authorization: Bearer sk-admin-...`, `AdminApiKeyAuth` in the
  official OpenAPI spec) plus `start_time`/`end_time` query parameters; they return
  bucketed aggregates (costs/usage), not a current balance. A single inference key
  cannot call them. If wanted later, it fits the existing **external source** pattern
  (like CPAMC/Volcano): admin key + org id stored as a separate credential, rendered
  as day/month windows, never as a per-route balance.
- **Anthropic**: legacy Usage and Cost API
  `GET /v1/organizations/usage_report/messages`, `/v1/organizations/cost_report`
  (plus the newer Usage and Cost Analytics API and Spend Limits API) require an
  **Admin API key**, an OAuth token with `org:admin`, or an unscoped org key; they are
  not available to claude.ai Team/individual accounts; they return historical
  aggregates, not a balance. Same external-source pattern; not a per-route adapter.

---

## 7. Implementation checklist for the recommended batch

Order matters: 3 is a one-file bugfix, 1 and 2 are new fixed-host adapters.

1. **`zai` route-id fix** (`src/core/adapters.ts` only)
   - `glmPlan('api.z.ai', ['zai', 'zai-coding'])` with `preferredId: 'zai'`.
   - Tests: `adapterFor('zai')` defined; dedupe prefers `zai`; existing CN parse unchanged.
2. **Anthropic plan adapter** (`ids: ['anthropic']`, `plan`, `credential: 'oauth'`)
   - Build: fixed URL + Bearer + `anthropic-beta: oauth-2025-04-20` +
     `user-agent: claude-code/<pinned version>`.
   - Parse exactly as §3.1; never throw; `undefined` on missing/unrecognized body.
   - Tests: both real-style bodies, `five_hour: null`, `resets_at: null`, extra windows.
3. **Vercel AI Gateway balance adapter** (`ids: ['vercel-ai-gateway']`, `balance`)
   - Build: fixed URL + Bearer. Parse `balance` string → USD 2dp.
   - Tests: sample, `token_pass: null`, numeric string, missing balance.
4. (Gated) **Copilot plan adapter** after forwarding `refreshToken`; `ids:
   ['github-copilot']`, `credential: 'oauth'`; parse `quota_snapshots` primary shape and
   the legacy `monthly_quotas`/`limited_user_quotas` shape if cheap.
5. (Gated) **NanoGPT balance adapter** after `ProbeSpec.method`; `ids: ['nano-gpt']`,
   `credential: 'api-key'`; document the required hand-declared route in the README
   provider table.
6. Any of the above that add a fixed host must also update
   `package.json` → `dshhub.permissions.network`.

Display names (host falls back to `adapter.displayName`): `Anthropic (Claude Pro/Max)`,
`Vercel AI Gateway`, `GitHub Copilot`, `NanoGPT`. All plan adapters should leave
`planName` undefined unless a documented field exists (Copilot has `copilot_plan`).

---

## 8. Open questions / unknowns (explicit)

1. Anthropic: exact `user-agent` version string that avoids rate limiting (any
   `claude-code/<version>` seems accepted); whether `seven_day_oauth_apps` /
   other new windows exist on some plans; whether `extra_usage` can be surfaced.
2. Copilot: GitHub Enterprise Server host for `/copilot_internal/user`; whether the
   Copilot bearer may replace the GitHub token on newer accounts (currently no).
3. NanoGPT: whether `nano_balance` is a USD-equivalent or a crypto amount (docs don't
   say); whether GET works in addition to POST.
4. Synthetic: whether `/v2/quotas` still accepts API keys; exact response field names
   (must be captured from a live response).
5. Chutes: exact JSON of `/users/{id}/balance` and whether a key without a login JWT
   can call `/users/me`.
6. Fireworks/DeepInfra/Mistral/iFlow/Qwen token plan/Xiaomi token plan: any
   API-key-accessible usage endpoint — needs vendor-doc research (partly Chinese docs)
   before any code.
7. Whether DSH's installed pi-ai catalog adds more plan providers in a future release
   (the catalog is generated; route ids can appear/disappear between versions, which is
   why adapter `ids` should be based on the catalog ids and aliases kept).

---

## 9. Sources

Installed artifacts:
- `@earendil-works/pi-ai@1.3.0` inside DSH `app.asar`:
  `dist/providers/all.js`, `dist/providers/provider-data.generated.ts`,
  `dist/providers/{anthropic,github-copilot,xai,openrouter,kimi-coding,openai-codex,
  zai,zai-coding-cn,qwen-token-plan*,xiaomi-token-plan*}.js`,
  `dist/auth/oauth/{anthropic,github-copilot,xai,openai-codex,kimi-coding}.js`.
- `@deepseek-ai/dsh-llm-pi-ai` README + `src/provider-data*.ts` (route config surface:
  `providers.<id>.apiKeyEnv/baseURL`, OAuth store `llm-pi-ai/<provider id>`).
- This repo: `src/core/adapters.ts`, `src/core/plan-match.ts`,
  `src/host/usage-service.ts` (`resolveCredential`, `piAiProfile`, `probeRoute`),
  `src/host/external-sources.ts`, `package.json`.

External (fetched 2026-11-16):
- Anthropic OAuth usage endpoint, sample body/headers:
  <https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/issues/202>;
  corroborated by <https://therolle.com/posts/2026/building-claude-code-statusline/>,
  <https://github.com/Fazalkadivar21/agent-usage-ring>,
  <https://ianlpaterson.com/blog/tracking-claude-codex-gemini-quotas-from-one-script/>;
  rate-limit/ToS discussion:
  <https://github.com/anthropics/claude-code/issues/31637>,
  <https://github.com/jarrodwatts/claude-hud/issues/287>.
  Live: `GET https://api.anthropic.com/api/oauth/usage` → 401 "x-api-key header is
  required" (endpoint exists).
- Vercel AI Gateway: official reference
  <https://vercel.com/docs/ai-gateway/sdks-and-apis/rest-api> (sample body and field
  table for `GET /v1/credits`); corroborating client:
  <https://github.com/kunchenguid/quota-axi/issues/291>.
- GitHub Copilot quota: sample bodies
  <https://github.com/rbstp/collie/issues/608>,
  <https://github.com/getpaseo/paseo/issues/8478>,
  <https://github.com/SimonBarnett/bobiverse/issues/5172>; endpoint usage and token
  type <https://github.com/xpepper/copilot-powerline/issues/55>,
  <https://openusage.sh/docs/providers/copilot/>.
- NanoGPT: <https://docs.nano-gpt.com/api-reference/endpoint/check-balance>;
  POST-only confirmation <https://github.com/yetone/magpie/issues/2368>.
- Synthetic: <https://dev.synthetic.new/docs/synthetic/quotas>,
  <https://dev.synthetic.new/docs/api/overview>; API-key rejection report
  <https://github.com/slkiser/opencode-quota/issues/276>.
- Chutes: <https://chutes.ai/docs/api-reference/users> (admin balance lookup);
  `/users/me` behaviour <https://skills.lc/Jarydyd/chutes/jarydyd-chutes-plugins-chutes-ai-skills-chutes-ai-skill-md>.
- OpenCode Zen: no balance API <https://github.com/anomalyco/opencode/issues/10448>;
  Go usage endpoint already implemented.
- Together AI: <https://docs.together.ai/docs/billing-credits> (no API balance
  endpoint mentioned).
- LiteLLM: <https://docs.litellm.ai/docs/proxy/virtual_keys> (`/key/info` sample),
  <https://docs.litellm.ai/docs/proxy/users>; source
  `litellm/proxy/management_endpoints/{key_management_endpoints,internal_user_endpoints}.py`
  (response keys `spend`, `max_budget`, `budget_duration`, `budget_reset_at`,
  `key_alias`; `/user/info` admin/master-key example).
- New API: docs <https://docs.newapi.pro/en/docs/api/management/user-management/user-self-get>;
  source `controller/user.go` (`buildSelfUserData` fields), `router/api-router.go`
  (`/self` under `UserAuth()`), `middleware/auth.go` (access-token route scopes).
- One API: source `router/dashboard.go` and `controller/billing.go`
  (`/dashboard/billing/subscription`, `/v1/dashboard/billing/subscription`,
  `/dashboard/billing/usage`; `soft_limit_usd`/`hard_limit_usd`/`total_usage`).
- xAI: <https://docs.x.ai/developers/rest-api-reference/management/billing>
  (Management API billing; management key + team id).
- OpenAI org usage/costs: official OpenAPI
  <https://github.com/openai/openai-openapi> (`/organization/costs`,
  `/organization/usage/*`, `AdminApiKeyAuth`).
- Anthropic admin usage/cost:
  <https://platform.claude.com/docs/en/manage-claude/usage-cost-api>
  (`/v1/organizations/usage_report/messages`, `/v1/organizations/cost_report`,
  Admin API key / `org:admin` OAuth / org-scoped key).
