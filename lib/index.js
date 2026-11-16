import z from "@deepseek-ai/schemastery";
import { appendFile, copyFile, mkdir, open, readFile, readdir, rename, rm, stat, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { credentialKey, credentialRef } from "@deepseek-ai/dsh-credentials";
import { homedir } from "node:os";
import { isAbsolute as isAbsolute$1, join as join$1 } from "node:path/posix";
import { createHash, createHmac } from "node:crypto";
//#region src/mount-once.ts
/**
* Host single-instance guard shared by the plugin family. The family bundle
* (dsh-web-all / dsh-skins) namespaces every child row id (web-ui-*), so
* the loader accepts a standalone install of the same package side by side;
* without this guard the second instance would still re-register the same
* webserver routes, tools, settings namespaces, and system-prompt sections
* and fail the boot. mountOnce makes the second host apply a no-op for the
* lifetime of the first instance (the browser half is already deduped by
* package name in the client module host).
*
* Maintained locally in dsh-usage-plus (the historical
* scripts/sync-shared.mjs generator is not part of this repo).
*
* The registry rides a global symbol so two module instances of the same
* package (npm copy vs repository link) still share one verdict. cordis
* `ctx.effect` runs its callback immediately and treats the callback's
* return value as the fiber disposer, so the unmarker is returned, not run.
*/
const MOUNTED = Symbol.for("dsh-web.mounted-plugins");
function mountedSet() {
	const registry = globalThis;
	return registry[MOUNTED] ??= /* @__PURE__ */ new Set();
}
/**
* Wrap a cordis plugin apply so the package runs at most once per process.
* The first mount registers normally and unmarks when its fiber disposes;
* any later mount of the same package name is a no-op.
* @param packageName - npm package identity shared by every install source.
* @param fn - the original plugin apply.
* @returns an apply of the same shape.
*/
function mountOnce(packageName, fn) {
	return ((...args) => {
		const mounted = mountedSet();
		if (mounted.has(packageName)) return;
		mounted.add(packageName);
		args[0]?.effect?.(() => () => {
			mounted.delete(packageName);
		});
		return fn(...args);
	});
}
//#endregion
//#region src/dsh-home.ts
/**
* DSH_HOME resolution shared by the plugin family's Host halves: the
* environment override wins, the platform home fallback follows. Mirrors
* what dsh-pet and dsh-liangshen each used to implement locally. Maintained
* locally in dsh-usage-plus (the historical scripts/sync-shared.mjs
* generator is not part of this repo).
*/
/** Expand a leading ~ (or ~user) in a path, platform-style. */
function expandHome(path, home = homedir()) {
	const j = home.startsWith("/") ? join$1 : join;
	if (path === "~") return home;
	if (path.startsWith("~/") || path.startsWith("~\\")) return j(home, path.slice(2));
	return path;
}
/**
* Resolve the DSH home directory.
* @param env - process environment to read DSH_HOME from.
* @param home - platform home directory fallback (test seam).
* @returns the absolute DSH home path.
*/
function resolveDshHome(env = process.env, home = homedir()) {
	const isPosix = home.startsWith("/");
	const j = isPosix ? join$1 : join;
	const isAbs = isPosix ? isAbsolute$1 : isAbsolute;
	const raw = env.DSH_HOME;
	if (raw !== void 0 && raw.trim() !== "") {
		const expanded = expandHome(raw.trim(), home);
		return isAbs(expanded) ? expanded : j(process.cwd(), expanded);
	}
	return j(home, ".dsh");
}
/** Resolve the DSH home directory from the live environment. */
function dshHome() {
	return resolveDshHome();
}
//#endregion
//#region src/core/adapters.ts
/** Whether one probe half may run with the resolved credential kind. */
function probeHalfAllowed(gate, credential) {
	if (gate === void 0 || gate === "any") return true;
	if (gate === "oauth") return credential === "oauth";
	return credential === "api-key" || credential === "env";
}
/** Parse a string/number into a finite number, else undefined. */
function toNum(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : void 0;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : void 0;
	}
}
/** Read a string field that must be a non-empty string. */
function str(value) {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
/** Format a number to a fixed 2-decimal display string. */
function money(value) {
	return value.toFixed(2);
}
/** Millisecond epoch or ISO string → normalized ISO 8601, else undefined. */
function toIso(value) {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		const ms = value < 0xe8d4a51000 ? value * 1e3 : value;
		const date = new Date(ms);
		return Number.isNaN(date.getTime()) ? void 0 : date.toISOString();
	}
	const text = str(value);
	if (text === void 0) return void 0;
	if (/^\d+$/.test(text)) return toIso(Number(text));
	const date = new Date(text);
	return Number.isNaN(date.getTime()) ? void 0 : date.toISOString();
}
/** Used-percent helper guarding zero/absent limits. */
function usedPercent(used, limit) {
	const usedNum = toNum(used);
	const limitNum = toNum(limit);
	if (usedNum === void 0 || limitNum === void 0 || limitNum <= 0) return void 0;
	return Math.max(0, Math.min(100, usedNum / limitNum * 100));
}
/** Clamp a provider-reported percent into the renderable 0-100 range. */
function clampPercent(value) {
	return Math.max(0, Math.min(100, value));
}
function bearer(apiKey) {
	return { authorization: `Bearer ${apiKey}` };
}
/**
* The official pay-as-you-go balance. `deepseek` is the configurable-catalog
* route key; `deepseek-official` is the live provider route the llm-deepseek
* adapter registers (sessions and agent-default-model carry it), so both ids
* must resolve here or the current provider would never be probed.
*/
const DEEPSEEK = {
	ids: ["deepseek", "deepseek-official"],
	preferredId: "deepseek-official",
	displayName: "DeepSeek",
	balance: {
		build: ({ apiKey }) => ({
			url: "https://api.deepseek.com/user/balance",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const infos = body.balance_infos;
			if (!Array.isArray(infos) || infos.length === 0) return void 0;
			const first = infos[0];
			if (typeof first !== "object" || first === null) return void 0;
			const currency = str(first.currency);
			const total = str(first.total_balance);
			if (currency === void 0 || total === void 0) return void 0;
			return {
				currency,
				totalBalance: total
			};
		}
	}
};
/** Moonshot pay-as-you-go balance; CN bills in CNY, international in USD. */
function moonshotBalance(host, currency, ids) {
	return {
		ids,
		displayName: "Moonshot AI",
		balance: {
			build: ({ apiKey }) => ({
				url: `https://${host}/v1/users/me/balance`,
				headers: bearer(apiKey)
			}),
			parse: (status, body) => {
				if (status !== 200 || typeof body !== "object" || body === null) return void 0;
				const data = body.data;
				if (typeof data !== "object" || data === null) return void 0;
				const available = toNum(data.available_balance);
				if (available === void 0) return void 0;
				return {
					currency,
					totalBalance: money(available)
				};
			}
		}
	};
}
/** Kimi For Coding quota: top-level `usage` is the weekly summary, `limits[]` the per-window rows. */
const KIMI_CODING = {
	ids: ["kimi-coding"],
	displayName: "Kimi For Coding",
	plan: {
		build: ({ apiKey }) => ({
			url: "https://api.kimi.com/coding/v1/usages",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const root = body;
			const windows = [];
			const limits = root.limits;
			if (Array.isArray(limits)) for (const entry of limits) {
				if (typeof entry !== "object" || entry === null) continue;
				const detail = entry.detail;
				const window = entry.window;
				if (typeof detail !== "object" || detail === null) continue;
				const row = detail;
				const duration = typeof window === "object" && window !== null ? toNum(window.duration) : void 0;
				const unit = typeof window === "object" && window !== null ? str(window.timeUnit) : void 0;
				const key = duration === 300 && unit === "TIME_UNIT_MINUTE" ? "5h" : duration !== void 0 ? `w-${duration}` : "window";
				const percent = usedPercent(row.used, row.limit);
				windows.push({
					key,
					name: str(row.name),
					percent,
					resetsAt: toIso(row.resetTime)
				});
			}
			const usage = root.usage;
			if (typeof usage === "object" && usage !== null) {
				const weekly = usage;
				windows.push({
					key: "week",
					name: "Weekly",
					percent: usedPercent(weekly.used, weekly.limit),
					resetsAt: toIso(weekly.resetTime)
				});
			}
			if (windows.length === 0) return void 0;
			const user = root.user;
			const membership = typeof user === "object" && user !== null ? user.membership : void 0;
			return {
				planName: typeof membership === "object" && membership !== null ? str(membership.level) : void 0,
				windows
			};
		}
	}
};
/** GLM Coding Plan quota; auth is the RAW key without a Bearer prefix. */
function glmPlan(host, ids) {
	return {
		ids,
		displayName: "GLM Coding Plan",
		plan: {
			build: ({ apiKey }) => ({
				url: `https://${host}/api/monitor/usage/quota/limit`,
				headers: {
					authorization: apiKey,
					"accept-language": "en-US,en"
				}
			}),
			parse: (status, body) => {
				if (status !== 200 || typeof body !== "object" || body === null) return void 0;
				const root = body;
				if (root.success !== true) return void 0;
				const data = root.data;
				if (typeof data !== "object" || data === null) return void 0;
				const limits = data.limits;
				if (!Array.isArray(limits)) return void 0;
				const windows = [];
				for (const entry of limits) {
					if (typeof entry !== "object" || entry === null) continue;
					const row = entry;
					const unit = toNum(row.unit);
					const percent = toNum(row.percentage);
					windows.push({
						key: unit === 3 ? "5h" : unit === 6 ? "week" : unit !== void 0 ? `unit-${unit}` : "window",
						percent: percent === void 0 ? void 0 : Math.max(0, Math.min(100, percent)),
						resetsAt: toIso(row.nextResetTime)
					});
				}
				if (windows.length === 0) return void 0;
				return {
					planName: str(data.level),
					windows
				};
			}
		}
	};
}
/**
* The international GLM Coding Plan. `zai` is the live pi-ai catalog id; the
* legacy `zai-coding` is kept as a hand-declared alias so both routes resolve,
* and `preferredId` collapses both live routes onto this one probe/row.
*/
const GLM_INTL = {
	...glmPlan("api.z.ai", ["zai", "zai-coding"]),
	preferredId: "zai"
};
/** OpenCode Go quota: percent-only rolling/weekly/monthly windows. */
const OPENCODE_GO = {
	ids: ["opencode-go"],
	displayName: "OpenCode Go",
	plan: {
		build: ({ apiKey }) => ({
			url: "https://opencode.ai/zen/go/v1/usage",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const usage = body.usage;
			if (typeof usage !== "object" || usage === null) return void 0;
			const windows = [];
			for (const [field, key] of [
				["rolling", "5h"],
				["weekly", "week"],
				["monthly", "month"]
			]) {
				const entry = usage[field];
				if (typeof entry !== "object" || entry === null) continue;
				const row = entry;
				const percent = toNum(row.percent);
				windows.push({
					key,
					percent: percent === void 0 ? void 0 : Math.max(0, Math.min(100, percent)),
					resetsAt: percent === 0 ? void 0 : toIso(row.resetsAt)
				});
			}
			if (windows.length === 0) return void 0;
			return { windows };
		}
	}
};
/** MiniMax coding-plan remains: remaining-percent semantics, `general` model entry. */
function minimaxPlan(host, ids) {
	return {
		ids,
		displayName: "MiniMax Coding Plan",
		plan: {
			build: ({ apiKey }) => ({
				url: `https://${host}/v1/api/openplatform/coding_plan/remains`,
				headers: bearer(apiKey)
			}),
			parse: (status, body) => {
				if (status !== 200 || typeof body !== "object" || body === null) return void 0;
				const remains = body.model_remains;
				if (!Array.isArray(remains)) return void 0;
				const general = remains.find((entry) => typeof entry === "object" && entry !== null && entry.model_name === "general");
				if (typeof general !== "object" || general === null) return void 0;
				const row = general;
				const windows = [];
				const intervalRemaining = toNum(row.current_interval_remaining_percent);
				if (intervalRemaining !== void 0) windows.push({
					key: "5h",
					percent: Math.max(0, Math.min(100, 100 - intervalRemaining)),
					resetsAt: toIso(row.end_time)
				});
				if (row.current_weekly_status === 1) {
					const weeklyRemaining = toNum(row.current_weekly_remaining_percent);
					if (weeklyRemaining !== void 0) windows.push({
						key: "week",
						percent: Math.max(0, Math.min(100, 100 - weeklyRemaining)),
						resetsAt: toIso(row.weekly_end_time)
					});
				}
				if (windows.length === 0) return void 0;
				return { windows };
			}
		}
	};
}
const OPENROUTER = {
	ids: ["openrouter"],
	displayName: "OpenRouter",
	balance: {
		build: ({ apiKey }) => ({
			url: "https://openrouter.ai/api/v1/credits",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const data = body.data;
			if (typeof data !== "object" || data === null) return void 0;
			const credits = toNum(data.total_credits);
			const used = toNum(data.total_usage) ?? 0;
			if (credits === void 0) return void 0;
			return {
				currency: "USD",
				totalBalance: money(credits - used)
			};
		}
	}
};
/**
* Vercel AI Gateway prepaid credit balance, scoped to the key's team. The
* official API returns USD strings; `token_pass` has no total (no percent
* window) and `total_used` is lifetime spend, so both stay unparsed.
*/
const VERCEL_AI_GATEWAY = {
	ids: ["vercel-ai-gateway"],
	displayName: "Vercel AI Gateway",
	balance: {
		credential: "api-key",
		build: ({ apiKey }) => ({
			url: "https://ai-gateway.vercel.sh/v1/credits",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const balance = toNum(body.balance);
			if (balance === void 0) return void 0;
			return {
				currency: "USD",
				totalBalance: money(balance)
			};
		}
	}
};
function siliconFlow(host, ids, currency) {
	return {
		ids,
		displayName: "SiliconFlow",
		balance: {
			build: ({ apiKey }) => ({
				url: `https://${host}/v1/user/info`,
				headers: bearer(apiKey)
			}),
			parse: (status, body) => {
				if (status !== 200 || typeof body !== "object" || body === null) return void 0;
				const data = body.data;
				if (typeof data !== "object" || data === null) return void 0;
				const total = str(data.totalBalance);
				if (total === void 0) return void 0;
				return {
					currency,
					totalBalance: total
				};
			}
		}
	};
}
const ZENMUX = {
	ids: ["zenmux"],
	displayName: "ZenMux",
	balance: {
		build: ({ apiKey }) => ({
			url: "https://zenmux.ai/api/v1/management/payg/balance",
			headers: bearer(apiKey)
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const data = body.data;
			if (typeof data !== "object" || data === null) return void 0;
			const credits = toNum(data.total_credits);
			if (credits === void 0) return void 0;
			return {
				currency: "USD",
				totalBalance: money(credits)
			};
		}
	}
};
/**
* NanoGPT prepaid USD balance. The docs' check-balance endpoint is POST-only
* (no request body) and authenticates with `x-api-key`; `nano_balance` is a
* crypto-denominated amount (Nano/XNO), not USD, so it stays unparsed.
*/
const NANOGPT = {
	ids: ["nano-gpt"],
	displayName: "NanoGPT",
	balance: {
		credential: "api-key",
		build: ({ apiKey }) => ({
			url: "https://nano-gpt.com/api/check-balance",
			method: "POST",
			headers: {
				"x-api-key": apiKey,
				accept: "application/json"
			}
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const usd = toNum(body.usd_balance);
			if (usd === void 0) return void 0;
			return {
				currency: "USD",
				totalBalance: money(usd)
			};
		}
	}
};
/**
* OpenAI Codex (ChatGPT subscription) quota over the OAuth access token the
* pi-ai grant stores — the one plan adapter whose credential is an OAuth
* token rather than an API key. A 401 here means the stored access token has
* expired; it refreshes when the harness next runs a Codex request, so the
* error line tells the user to use Codex once and refresh.
*/
const OPENAI_CODEX = {
	ids: ["openai-codex"],
	displayName: "Codex (ChatGPT 订阅)",
	plan: {
		build: ({ apiKey, accountId }) => ({
			url: "https://chatgpt.com/backend-api/wham/usage",
			headers: {
				authorization: `Bearer ${apiKey}`,
				"user-agent": "codex-cli",
				accept: "application/json",
				...accountId !== void 0 ? { "chatgpt-account-id": accountId } : {}
			}
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const rateLimit = body.rate_limit;
			if (typeof rateLimit !== "object" || rateLimit === null) return void 0;
			const windows = [];
			const rows = rateLimit.primary_window !== void 0 || rateLimit.secondary_window !== void 0 ? [rateLimit.primary_window, rateLimit.secondary_window] : [];
			for (const entry of rows) {
				if (typeof entry !== "object" || entry === null) continue;
				const row = entry;
				const percent = toNum(row.used_percent);
				if (percent === void 0) continue;
				const seconds = toNum(row.limit_window_seconds);
				windows.push({
					key: codexWindowKey(seconds),
					percent: Math.max(0, Math.min(100, percent)),
					resetsAt: toIso(row.reset_at)
				});
			}
			if (windows.length === 0) return void 0;
			return { windows };
		}
	}
};
/** Map a Codex window length in seconds onto the shared window key vocabulary. */
function codexWindowKey(seconds) {
	if (seconds === void 0) return "window";
	if (seconds === 18e3) return "5h";
	if (seconds === 604800) return "week";
	if (seconds === 2592e3) return "month";
	const hours = seconds / 3600;
	return hours >= 24 ? `${Math.round(hours / 24)}_day` : `${Math.round(hours)}_hour`;
}
/**
* Anthropic subscription (Claude Pro/Max) windows over the pi-ai OAuth access
* token. The endpoint is the internal one Claude Code reports from, and the
* `claude-code/<version>` user-agent is load-bearing: without it the API
* rate-limits aggressively (persistent 429). OAuth-only — an API key has no
* subscription windows, so the half is gated rather than error-reported.
*/
const ANTHROPIC = {
	ids: ["anthropic"],
	displayName: "Anthropic (Claude Pro/Max)",
	plan: {
		credential: "oauth",
		build: ({ apiKey }) => ({
			url: "https://api.anthropic.com/api/oauth/usage",
			headers: {
				authorization: `Bearer ${apiKey}`,
				"anthropic-beta": "oauth-2025-04-20",
				"user-agent": "claude-code/2.0.0",
				accept: "application/json"
			}
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const root = body;
			const windows = [];
			for (const [field, key] of [
				["five_hour", "5h"],
				["seven_day", "week"],
				["seven_day_sonnet", "week-sonnet"],
				["seven_day_opus", "week-opus"]
			]) {
				const entry = root[field];
				if (typeof entry !== "object" || entry === null) continue;
				const row = entry;
				const percent = toNum(row.utilization);
				if (percent === void 0) continue;
				windows.push({
					key,
					percent: clampPercent(percent),
					resetsAt: toIso(row.resets_at)
				});
			}
			if (windows.length === 0) return void 0;
			return { windows };
		}
	}
};
/**
* GitHub Copilot premium-request quota. pi-ai's OAuth grant stores the GitHub
* token as `refresh` and the Copilot bearer as `access`; the
* `copilot_internal/user` route wants the GitHub token, which the host
* forwards as `refreshToken`. The route also accepts `Authorization: Bearer`,
* but `token` is the scheme VS Code/Copilot CLI use. A hand-declared route
* without a separate refresh token falls back to the resolved access token.
*/
const GITHUB_COPILOT = {
	ids: ["github-copilot"],
	displayName: "GitHub Copilot",
	plan: {
		credential: "oauth",
		build: ({ apiKey, refreshToken }) => ({
			url: "https://api.github.com/copilot_internal/user",
			headers: {
				authorization: `token ${refreshToken ?? apiKey}`,
				accept: "application/json"
			}
		}),
		parse: (status, body) => {
			if (status !== 200 || typeof body !== "object" || body === null) return void 0;
			const root = body;
			const resetsAt = toIso(root.quota_reset_date_utc);
			const windows = [];
			const snapshots = root.quota_snapshots;
			if (typeof snapshots === "object" && snapshots !== null) {
				const entries = snapshots;
				const keys = ["premium_interactions", ...Object.keys(entries).filter((key) => key !== "premium_interactions")];
				for (const key of keys) {
					const entry = entries[key];
					if (typeof entry !== "object" || entry === null) continue;
					const row = entry;
					if (row.unlimited === true) continue;
					const remaining = toNum(row.percent_remaining);
					if (remaining === void 0) continue;
					windows.push({
						key: "month",
						percent: clampPercent(100 - remaining),
						resetsAt
					});
					break;
				}
			}
			if (windows.length === 0) {
				const legacyPercent = legacyCopilotPercent(root);
				if (legacyPercent !== void 0) windows.push({
					key: "month",
					percent: legacyPercent,
					resetsAt
				});
			}
			if (windows.length === 0) return void 0;
			return {
				planName: str(root.copilot_plan),
				windows
			};
		}
	}
};
/**
* Legacy Copilot request-count shape: `monthly_quotas` is the entitlement and
* `limited_user_quotas` the remaining count for limited users, so the used
* percent is `100 - remaining / entitlement * 100`. Returns undefined when no
* pair is usable.
*/
function legacyCopilotPercent(root) {
	const totals = root.monthly_quotas;
	const remaining = root.limited_user_quotas;
	if (typeof totals !== "object" || totals === null) return void 0;
	if (typeof remaining !== "object" || remaining === null) return void 0;
	for (const key of [
		"premium_interactions",
		"chat",
		"completions"
	]) {
		const total = toNum(totals[key]);
		const left = toNum(remaining[key]);
		if (total === void 0 || left === void 0 || total <= 0) continue;
		return clampPercent(100 - left / total * 100);
	}
}
/**
* The adapter registry, in no particular order. Route keys come from the
* pi-ai provider catalog plus the routes this deployment observed in user
* configuration (`zenmux`).
*/
const PROVIDER_ADAPTERS = [
	DEEPSEEK,
	moonshotBalance("api.moonshot.cn", "CNY", ["moonshotai-cn"]),
	moonshotBalance("api.moonshot.ai", "USD", ["moonshotai"]),
	KIMI_CODING,
	ANTHROPIC,
	glmPlan("open.bigmodel.cn", ["zai-coding-cn"]),
	GLM_INTL,
	OPENCODE_GO,
	minimaxPlan("api.minimaxi.com", ["minimax-cn"]),
	minimaxPlan("api.minimax.io", ["minimax"]),
	OPENAI_CODEX,
	GITHUB_COPILOT,
	OPENROUTER,
	VERCEL_AI_GATEWAY,
	siliconFlow("api.siliconflow.cn", ["siliconflow", "siliconflow-cn"], "CNY"),
	siliconFlow("api.siliconflow.com", ["siliconflow-intl"], "USD"),
	ZENMUX,
	NANOGPT
];
/** Find the adapter serving a provider route key, if any. */
function adapterFor(provider) {
	return PROVIDER_ADAPTERS.find((adapter) => adapter.ids.includes(provider));
}
/**
* Keep one route per adapter when several live routes resolve to the same
* probe endpoint (the `deepseek` catalog key and the `deepseek-official` live
* route share the DeepSeek balance probe). The adapter's `preferredId` wins
* regardless of registry order; otherwise the first occurrence wins. Routes
* without an adapter are never collapsed. Pure: preserves input order of the
* kept routes and returns a new array.
*/
function dedupeProviderAliasRoutes(routes) {
	const keptIndex = /* @__PURE__ */ new Map();
	routes.forEach((route, index) => {
		const adapter = adapterFor(route.id);
		if (adapter === void 0) return;
		if (keptIndex.get(adapter) === void 0) {
			keptIndex.set(adapter, index);
			return;
		}
		if (adapter.preferredId === route.id) keptIndex.set(adapter, index);
	});
	return routes.filter((route, index) => {
		const adapter = adapterFor(route.id);
		return adapter === void 0 || keptIndex.get(adapter) === index;
	});
}
/**
* Whether a provider route belongs to the official DeepSeek family: the only
* family with a spend price book and a settings-section-owned env credential
* (llm-deepseek) rather than a pi-ai profile. Drives the env fallback in
* credential resolution and the fold-time cost stamping.
*/
function isDeepSeekProviderRoute(provider) {
	return adapterFor(provider) === DEEPSEEK;
}
/**
* Best-effort human message from a provider error body, for the per-provider
* error line. Never throws; truncated to one short sentence.
*/
function providerErrorMessage(status, body) {
	let message;
	if (typeof body === "object" && body !== null) {
		const root = body;
		const nested = typeof root.error === "object" && root.error !== null ? root.error : void 0;
		message = str(root.message) ?? str(root.msg) ?? (nested !== void 0 ? str(nested.message) : void 0);
	}
	return `HTTP ${status}${message === void 0 ? "" : `: ${message.slice(0, 120)}`}`;
}
//#endregion
//#region src/core/pricing-book.ts
/**
* models.dev price book: normalize the public catalog into USD-per-1M-token
* lookup rows, resolve one provider/model route to a row with an explicit
* confidence, and estimate a window's reference spend. This is deliberately
* separate from the DeepSeek CNY ledger cost in `pricing.ts`: the ledger keeps
* its own currency, and this module only ever answers in USD from the public
* catalog.
*
* Catalog shape (`https://models.dev/api.json`):
* `{ [providerId]: { id, name, models: { [modelKey]: { id, name,
* canonical_model_id?, cost?: { input, output, cache_read?, cache_write?,
* tiers?, context_over_200k? } } } } }` — costs are USD per 1M tokens. A
* missing or zero `cost.input`/`cost.output` means the model is not priced
* (no row), so a free/unknown model is counted as unpriced rather than
* silently estimated at $0. Tiered / long-context surcharge prices are
* ignored: the row is the catalog's base price, which makes the reference
* estimate conservative.
*
* Route → catalog provider aliases (`PROVIDER_ALIASES`) bridge route keys the
* host sees onto the catalog's provider ids. An exact `${provider}/${model}`
* row always wins; the alias list is only consulted afterwards:
* - `deepseek-official` → `deepseek`
* - `openai-codex`, `codex` → `openai`
* - `github` → `github-copilot` (the catalog spells the provider id out)
* - `vercel-ai-gateway` → `vercel`
* - `moonshot`, `kimi-coding` → `moonshotai`, then `moonshotai-cn`
* - `moonshotai-cn` → `moonshotai-cn`, then `moonshotai`
* - `zai-coding` → `zai`, then `zhipuai`
* - `zai-coding-cn` → `zhipuai`, then `zai`
* Every other route key is looked up as-is (the catalog's own provider id).
*
* Resolution precedence is exact, canonical id, then short model name. A
* canonical id prefers the route provider family's own catalog row (many
* resellers publish the same canonical model at different prices) and a
* canonical/short match only returns when every candidate row agrees on the
* price, so an ambiguous alias is an honest miss instead of a guess.
* @module @linxin666/dsh-usage/core/pricing-book
*/
/** Public models.dev catalog endpoint. */
const MODELS_DEV_URL = "https://models.dev/api.json";
/** Default timeout for one catalog fetch. */
const MODELS_DEV_TIMEOUT_MS = 8e3;
/** Price-book cache basename written by `savePriceBook`. */
const PRICE_BOOK_FILENAME = "pricing-book.json";
/** How long a cached price book stays fresh (24 hours). */
const PRICE_BOOK_MAX_AGE_MS = 864e5;
/**
* Route-key → models.dev provider id fallbacks, in precedence order. The exact
* route key is always tried first (see the module header for the table).
*/
const PROVIDER_ALIASES = {
	"deepseek-official": ["deepseek"],
	"openai-codex": ["openai"],
	codex: ["openai"],
	github: ["github-copilot"],
	"vercel-ai-gateway": ["vercel"],
	moonshot: ["moonshotai", "moonshotai-cn"],
	"kimi-coding": ["moonshotai", "moonshotai-cn"],
	"moonshotai-cn": ["moonshotai"],
	"zai-coding": ["zai", "zhipuai"],
	"zai-coding-cn": ["zhipuai", "zai"]
};
/** Prototype-free map so untrusted provider/model ids can never pollute objects. */
function safeMap() {
	return Object.create(null);
}
/** Own-property lookup that also works on a JSON-revived plain object. */
function ownLookup(map, key) {
	if (typeof map !== "object" || map === null) return void 0;
	return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : void 0;
}
/** Trimmed lowercase id, or '' for non-strings. */
function normalizeId(value) {
	return typeof value === "string" ? value.trim().toLowerCase() : "";
}
/** A finite number, or undefined. */
function finiteNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/** A finite positive price (a zero/missing input or output means unpriced). */
function positivePrice(value) {
	const price = finiteNumber(value);
	return price !== void 0 && price > 0 ? price : void 0;
}
/** A finite non-negative price (an explicit published zero is meaningful). */
function nonNegativePrice(value) {
	const price = finiteNumber(value);
	return price !== void 0 && price >= 0 ? price : void 0;
}
/** The short model name: the segment after the last `/` (whole id when there is none). */
function shortNameOf(modelKey) {
	const slash = modelKey.lastIndexOf("/");
	return slash === -1 ? modelKey : modelKey.slice(slash + 1);
}
/** The provider prefix of a normalized row key (provider ids never contain `/`). */
function providerOfRowKey(rowKey) {
	const slash = rowKey.indexOf("/");
	return slash === -1 ? rowKey : rowKey.slice(0, slash);
}
/** Append `value` to `map[key]`'s list once. */
function pushUnique(map, key, value) {
	const list = map[key] ?? (map[key] = []);
	if (!list.includes(value)) list.push(value);
}
/**
* Read one catalog `cost` object into a row. Missing/zero input or output, or
* any malformed number, yields no row (unpriced). `cache_read`/`cache_write`
* fall back to the cache-miss price when absent; an explicit published zero is
* kept.
*/
function readableCost(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const cost = value;
	const miss = positivePrice(cost.input);
	const out = positivePrice(cost.output);
	if (miss === void 0 || out === void 0) return void 0;
	const hit = nonNegativePrice(cost.cache_read);
	const write = nonNegativePrice(cost.cache_write);
	return {
		miss,
		hit: hit ?? miss,
		write: write ?? miss,
		out
	};
}
/**
* Normalize a models.dev catalog (untrusted JSON) into lookup tables. Unknown
* shapes resolve to empty tables; malformed provider/model/cost entries are
* dropped rather than thrown. Never throws.
*/
function normalizeModelsDev(json) {
	const rows = safeMap();
	const byShortName = safeMap();
	const byCanonical = safeMap();
	if (typeof json !== "object" || json === null || Array.isArray(json)) return {
		rows,
		byShortName,
		byCanonical
	};
	for (const [providerId, providerValue] of Object.entries(json)) {
		const providerKey = normalizeId(providerId);
		if (providerKey === "") continue;
		if (typeof providerValue !== "object" || providerValue === null) continue;
		const models = providerValue.models;
		if (typeof models !== "object" || models === null || Array.isArray(models)) continue;
		for (const [modelKeyRaw, modelValue] of Object.entries(models)) {
			if (typeof modelValue !== "object" || modelValue === null) continue;
			const model = modelValue;
			const row = readableCost(model.cost);
			if (row === void 0) continue;
			const modelKey = normalizeId(modelKeyRaw);
			if (modelKey === "") continue;
			const rowKey = `${providerKey}/${modelKey}`;
			rows[rowKey] = row;
			const modelId = normalizeId(model.id);
			if (modelId !== "" && modelId !== modelKey) rows[`${providerKey}/${modelId}`] = row;
			const canonicalId = normalizeId(model.canonical_model_id);
			if (canonicalId.includes("/")) pushUnique(byCanonical, canonicalId, rowKey);
			const aliasModelKeys = modelId !== "" && modelId !== modelKey ? [modelKey, modelId] : [modelKey];
			for (const key of aliasModelKeys) {
				const short = shortNameOf(key);
				if (short !== key) pushUnique(byShortName, short, rowKey);
			}
		}
	}
	return {
		rows,
		byShortName,
		byCanonical
	};
}
/** The route key plus its documented catalog provider aliases, deduplicated. */
function providerCandidates(providerKey) {
	const candidates = [providerKey];
	const seen = new Set(candidates);
	const aliases = PROVIDER_ALIASES[providerKey];
	if (Array.isArray(aliases)) for (const alias of aliases) {
		const normalized = normalizeId(alias);
		if (normalized !== "" && !seen.has(normalized)) {
			seen.add(normalized);
			candidates.push(normalized);
		}
	}
	return candidates;
}
/** Read the row at one normalized key, if present. */
function rowAt(book, key) {
	return ownLookup(book.rows, key);
}
/** Whether two rows publish the same four prices. */
function sameRow(left, right) {
	return left.miss === right.miss && left.hit === right.hit && left.write === right.write && left.out === right.out;
}
/**
* Resolve the row list to one price, only when every candidate row agrees.
* Returns undefined for an empty or ambiguous list (conservative by design).
*/
function consistentRow(book, rowKeys) {
	let first;
	for (const key of rowKeys) {
		const row = rowAt(book, key);
		if (row === void 0) continue;
		if (first === void 0) {
			first = {
				row,
				key
			};
			continue;
		}
		if (!sameRow(first.row, row)) return void 0;
	}
	if (first === void 0) return void 0;
	return {
		row: first.row,
		via: "canonical",
		confidence: "medium",
		key: first.key
	};
}
/** String-list lookup from a possibly JSON-revived table. */
function stringListAt(map, key) {
	const value = ownLookup(map, key);
	if (!Array.isArray(value)) return [];
	return value.filter((entry) => typeof entry === "string" && entry !== "");
}
/**
* Resolve one provider/model route to a catalog price. Precedence: exact
* `${provider}/${model}`, documented provider aliases, canonical model ids,
* then the short model name (provider-family scoped). Ambiguous canonical or
* short candidates miss instead of pricing a possibly different model. Never
* throws.
*/
function resolvePrice(book, provider, model) {
	try {
		if (book === null || book === void 0 || typeof book !== "object") return void 0;
		const providerKey = normalizeId(provider);
		const modelKey = normalizeId(model);
		if (providerKey === "" || modelKey === "") return void 0;
		const providers = providerCandidates(providerKey);
		const directKey = `${providerKey}/${modelKey}`;
		const direct = rowAt(book, directKey);
		if (direct !== void 0) return {
			row: direct,
			via: "exact",
			confidence: "high",
			key: directKey
		};
		for (const alias of providers.slice(1)) {
			const aliasKey = `${alias}/${modelKey}`;
			const row = rowAt(book, aliasKey);
			if (row !== void 0) return {
				row,
				via: "exact",
				confidence: "high",
				key: aliasKey
			};
		}
		const family = new Set(providers);
		const canonicalKeys = [];
		for (const candidate of providers) canonicalKeys.push(`${candidate}/${modelKey}`);
		if (modelKey.includes("/")) canonicalKeys.push(modelKey);
		for (const canonicalKey of canonicalKeys) {
			const rowKeys = stringListAt(book.byCanonical, canonicalKey);
			if (rowKeys.length === 0) continue;
			const familyRowKeys = rowKeys.filter((rowKey) => family.has(providerOfRowKey(rowKey)));
			const resolved = consistentRow(book, familyRowKeys.length > 0 ? familyRowKeys : rowKeys);
			if (resolved !== void 0) return resolved;
		}
		const resolved = consistentRow(book, stringListAt(book.byShortName, shortNameOf(modelKey)).filter((rowKey) => family.has(providerOfRowKey(rowKey))));
		if (resolved !== void 0) return {
			...resolved,
			via: "short",
			confidence: "medium"
		};
		return;
	} catch {
		return;
	}
}
/** A finite non-negative token/call count, else 0. */
function countOf(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
/** Coerce an untrusted totals bucket; malformed numbers become 0. */
function safeTotals(value) {
	if (typeof value !== "object" || value === null) return {
		calls: 0,
		input: 0,
		hit: 0,
		write: 0,
		out: 0
	};
	const totals = value;
	return {
		calls: countOf(totals.calls),
		input: countOf(totals.inputTokens),
		hit: countOf(totals.cacheReadTokens),
		write: countOf(totals.cacheWriteTokens),
		out: countOf(totals.outputTokens)
	};
}
/** One bucket's reference USD spend at a row's per-1M prices. */
function usdFor(totals, row) {
	return totals.input / 1e6 * row.miss + totals.hit / 1e6 * row.hit + totals.write / 1e6 * row.write + totals.out / 1e6 * row.out;
}
/** Round a USD amount to `digits` places (default 6 = micro-USD). */
function roundAmount$1(value, digits) {
	const factor = 10 ** (typeof digits === "number" && Number.isInteger(digits) && digits >= 0 && digits <= 12 ? digits : 6);
	return Math.round(value * factor) / factor;
}
/**
* Price one aggregated usage window against the book as a USD reference
* estimate. Pure and defensive: malformed summaries/rows never throw; only
* model rows with a resolved price contribute to `amount`, while every
* provider/model/call is still counted so the priced coverage is honest.
* Providers whose model list is missing or capped keep their un-attributed
* calls counted as unpriced. `amount` is omitted when nothing could be priced.
*/
function estimateUsd(summary, book, options) {
	let amount = 0;
	let pricedAny = false;
	let pricedCalls = 0;
	let totalCalls = 0;
	let pricedModels = 0;
	let totalModels = 0;
	try {
		const providerRows = typeof summary === "object" && summary !== null && Array.isArray(summary.providers) ? summary.providers : [];
		for (const providerRow of providerRows) {
			if (typeof providerRow !== "object" || providerRow === null) continue;
			const provider = typeof providerRow.provider === "string" ? providerRow.provider : "";
			const providerTotals = safeTotals(providerRow.totals);
			totalCalls += providerTotals.calls;
			const modelRows = Array.isArray(providerRow.models) ? providerRow.models : [];
			for (const modelRow of modelRows) {
				if (typeof modelRow !== "object" || modelRow === null) continue;
				totalModels += 1;
				const model = typeof modelRow.model === "string" ? modelRow.model : "";
				const totals = safeTotals(modelRow.totals);
				if (model === "") continue;
				const resolved = resolvePrice(book, provider, model);
				if (resolved === void 0) continue;
				pricedModels += 1;
				pricedCalls += totals.calls;
				amount += usdFor(totals, resolved.row);
				pricedAny = true;
			}
		}
	} catch {}
	const estimate = {
		currency: "USD",
		pricedCalls,
		totalCalls,
		pricedModels,
		totalModels,
		source: "models.dev"
	};
	if (pricedAny) estimate.amount = roundAmount$1(amount, options?.roundDigits);
	const fetchedAt = typeof book === "object" && book !== null ? finiteNumber(book.fetchedAt) : void 0;
	if (fetchedAt !== void 0) estimate.priceBookUpdatedAt = fetchedAt;
	return estimate;
}
/**
* Fetch and normalize the models.dev catalog. Returns undefined on any
* failure (network error, non-2xx, timeout, unparsable/non-object JSON) and
* never throws. The injected clock stamps `fetchedAt`.
*/
async function fetchPriceBook(options = {}) {
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== "function") return void 0;
	const timeoutMs = typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : MODELS_DEV_TIMEOUT_MS;
	const now = typeof options.now === "function" ? options.now : Date.now;
	const controller = new AbortController();
	let timer;
	try {
		const timeout = new Promise((resolve) => {
			timer = setTimeout(() => {
				controller.abort();
				resolve(void 0);
			}, timeoutMs);
		});
		const request = (async () => {
			const response = await fetchImpl(MODELS_DEV_URL, { signal: controller.signal });
			if (response === null || typeof response !== "object" || response.ok !== true) return void 0;
			const json = await response.json();
			if (typeof json !== "object" || json === null || Array.isArray(json)) return void 0;
			return normalizeModelsDev(json);
		})().catch(() => void 0);
		const normalized = await Promise.race([request, timeout]);
		if (normalized === void 0) return void 0;
		return {
			...normalized,
			fetchedAt: now(),
			source: "models.dev"
		};
	} catch {
		return;
	} finally {
		if (timer !== void 0) clearTimeout(timer);
	}
}
/**
* Whether a book is within `PRICE_BOOK_MAX_AGE_MS` of `now` (24h). Future
* timestamps within the window count as fresh (clock skew tolerance); a
* missing/invalid `fetchedAt` or non-finite `now` is never fresh.
*/
function isPriceBookFresh(book, now = Date.now()) {
	if (typeof book !== "object" || book === null) return false;
	const fetchedAt = finiteNumber(book.fetchedAt);
	if (fetchedAt === void 0 || !Number.isFinite(now)) return false;
	return Math.abs(now - fetchedAt) <= PRICE_BOOK_MAX_AGE_MS;
}
/** Revive one untrusted cache row; malformed/zero-price rows are dropped. */
function reviveRow(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const row = value;
	const miss = positivePrice(row.miss);
	const out = positivePrice(row.out);
	const hit = nonNegativePrice(row.hit);
	const write = nonNegativePrice(row.write);
	if (miss === void 0 || out === void 0 || hit === void 0 || write === void 0) return void 0;
	return {
		miss,
		hit,
		write,
		out
	};
}
/** Revive a string-list table, keeping only keys that resolve to a loaded row. */
function reviveStringListMap(value, rows) {
	const revived = safeMap();
	if (typeof value !== "object" || value === null || Array.isArray(value)) return revived;
	for (const [key, listValue] of Object.entries(value)) {
		if (!Array.isArray(listValue)) continue;
		const keys = [];
		for (const entry of listValue) {
			if (typeof entry !== "string" || entry === "") continue;
			if (ownLookup(rows, entry) === void 0) continue;
			if (!keys.includes(entry)) keys.push(entry);
		}
		if (keys.length > 0) revived[key] = keys;
	}
	return revived;
}
/** Revive an untrusted cache document; anything structurally invalid is undefined. */
function revivePriceBook(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const document = value;
	const fetchedAt = finiteNumber(document.fetchedAt);
	const rawRows = document.rows;
	if (fetchedAt === void 0 || typeof rawRows !== "object" || rawRows === null || Array.isArray(rawRows)) return void 0;
	const rows = safeMap();
	for (const [key, rowValue] of Object.entries(rawRows)) {
		const row = reviveRow(rowValue);
		if (row !== void 0) rows[key] = row;
	}
	return {
		fetchedAt,
		source: "models.dev",
		rows,
		byShortName: reviveStringListMap(document.byShortName, rows),
		byCanonical: reviveStringListMap(document.byCanonical, rows)
	};
}
/**
* Atomically write `<dir>/pricing-book.json` (temp file + fsync + rename), so
* a crash never leaves a half-written cache. Returns false on any failure and
* never throws.
*/
async function savePriceBook(dir, book) {
	if (typeof dir !== "string" || dir.trim() === "") return false;
	if (typeof book !== "object" || book === null) return false;
	const target = join(dir, PRICE_BOOK_FILENAME);
	const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
	try {
		await mkdir(dir, { recursive: true });
		const document = {
			version: 1,
			fetchedAt: book.fetchedAt,
			source: "models.dev",
			rows: book.rows,
			byShortName: book.byShortName,
			byCanonical: book.byCanonical
		};
		const handle = await open(temp, "w");
		try {
			await handle.writeFile(JSON.stringify(document), "utf8");
			await handle.sync();
		} finally {
			await handle.close();
		}
		await rename(temp, target);
		return true;
	} catch {
		await unlink(temp).catch(() => {});
		return false;
	}
}
/**
* Read `<dir>/pricing-book.json`. Returns undefined when the file is missing,
* unparsable, structurally invalid, or the directory is unusable; malformed
* rows are dropped. Never throws.
*/
async function loadPriceBook(dir) {
	if (typeof dir !== "string" || dir.trim() === "") return void 0;
	try {
		const raw = await readFile(join(dir, PRICE_BOOK_FILENAME), "utf8");
		return revivePriceBook(JSON.parse(raw));
	} catch {
		return;
	}
}
/** Endpoint for wallets + lifetime spend (all-time facts). */
const SUMMARY_PATH = "/api/v0/users/get_user_summary";
/** Endpoint for the requested month's per-day cost detail. */
const COST_PATH = "/api/v0/usage/cost";
/** Host credential record scope/id DSH's deepseek-account plugin writes. */
const PLATFORM_CREDENTIAL_SCOPE = "deepseek-account-platform";
const PLATFORM_CREDENTIAL_ID = "default";
/** Per-request timeout budget. */
const PLATFORM_TIMEOUT_MS = 1e4;
/** Small backoff before the single retry of a 429/5xx response. */
const PLATFORM_RETRY_DELAY_MS = 500;
/** Envelope codes the console uses for a signed-out/expired session. */
const AUTH_ERROR_CODES = /* @__PURE__ */ new Set([
	40001,
	40002,
	40003,
	401,
	403
]);
/** Marker message for a non-JSON upstream body (mapped to a display string). */
const INVALID_JSON_MESSAGE = "platform response was not valid JSON";
/** Best-effort typed service read: absent services resolve to undefined at runtime. */
function service$1(ctx, name) {
	try {
		return ctx.get(name);
	} catch {
		return;
	}
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonEmptyString(value) {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
/** Parse a JSON-string payload, else return the value unchanged. */
function unwrapJson(value) {
	if (typeof value !== "string") return value;
	const text = value.trim();
	if (text === "" || text[0] !== "{" && text[0] !== "[") return value;
	try {
		return JSON.parse(text);
	} catch {
		return value;
	}
}
/** Number from a number or numeric string (thousands separators tolerated). */
function numberValue(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : void 0;
	if (typeof value !== "string") return void 0;
	const text = value.trim().replace(/,/g, "");
	if (text === "") return void 0;
	const parsed = Number(text);
	return Number.isFinite(parsed) ? parsed : void 0;
}
/** Keep sums free of binary-float noise without truncating real precision. */
function roundAmount(value) {
	return Math.round(value * 1e6) / 1e6;
}
function pad2(value) {
	return String(value).padStart(2, "0");
}
function isValidDay(year, month, day) {
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
	if (month < 1 || month > 12 || day < 1) return false;
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function formatDay(year, month, day) {
	return isValidDay(year, month, day) ? `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}` : void 0;
}
/** Normalize one date-ish value to `YYYY-MM-DD`; bare day numbers need month/year. */
function resolveDayDate(value, year, month) {
	const parsed = unwrapJson(value);
	if (typeof parsed === "number") return resolveNumericDay(parsed, year, month);
	if (typeof parsed !== "string") return void 0;
	const text = parsed.trim();
	if (text === "") return void 0;
	const separated = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
	if (separated !== null) return formatDay(Number(separated[1]), Number(separated[2]), Number(separated[3]));
	const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
	if (compact !== null) return formatDay(Number(compact[1]), Number(compact[2]), Number(compact[3]));
	const numeric = Number(text);
	return Number.isFinite(numeric) ? resolveNumericDay(numeric, year, month) : void 0;
}
/** `1..31` reads as day-of-month inside the given month; larger values read as epoch. */
function resolveNumericDay(value, year, month) {
	if (!Number.isFinite(value)) return void 0;
	if (Number.isInteger(value) && value >= 1 && value <= 31) return year !== void 0 && month !== void 0 ? formatDay(year, month, value) : void 0;
	const millis = value >= 0xe8d4a51000 ? value : value >= 1e9 ? value * 1e3 : void 0;
	if (millis === void 0) return void 0;
	const date = new Date(millis);
	if (Number.isNaN(date.getTime())) return void 0;
	return formatDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
}
/** Strip the console envelope until the `biz_data` payload is reached. */
function platformBizData(payload) {
	let node = unwrapJson(payload);
	for (let depth = 0; depth < 3; depth += 1) {
		if (!isRecord(node)) return node;
		const next = unwrapJson(node.biz_data ?? node.bizData ?? node.data);
		if (next === void 0) return node;
		node = next;
	}
	return node;
}
const COST_NESTED_KEYS = [
	"biz_data",
	"bizData",
	"data",
	"days",
	"costs",
	"items",
	"list",
	"rows",
	"detail",
	"details"
];
const DATE_FIELD_KEYS = [
	"date",
	"date_str",
	"dateStr",
	"dayStr",
	"stat_date",
	"statDate",
	"biz_date",
	"bizDate",
	"timestamp",
	"time",
	"ts",
	"dt"
];
const COST_FIELD_KEYS = [
	"cost",
	"amount",
	"total",
	"value",
	"fee",
	"spend",
	"price"
];
function pickField(row, keys) {
	for (const key of keys) if (row[key] !== void 0) return row[key];
}
/** Read one `{date, cost}` row, tolerating field-name drift and bare day numbers. */
function readCostDay(row, month, year) {
	let date = resolveDayDate(pickField(row, DATE_FIELD_KEYS), year, month);
	if (date === void 0 && row.day !== void 0) {
		const rowYear = numberValue(row.year);
		const rowMonth = numberValue(row.month);
		date = resolveDayDate(row.day, rowYear !== void 0 ? rowYear : year, rowMonth !== void 0 ? rowMonth : month);
	}
	if (date === void 0) return void 0;
	const cost = numberValue(pickField(row, COST_FIELD_KEYS));
	if (cost === void 0) return void 0;
	return {
		date,
		cost
	};
}
/**
* Normalize the `/usage/cost` payload to sorted official day rows.
*
* Tolerates the console's envelope drift (`biz_data` object/array/JSON string),
* a bare array of day rows, and per-API-key rows carrying a `days` array.
* Duplicate dates are summed. When both `month` and `year` are supplied, days
* outside that calendar month are dropped (the console can return neighbours).
*/
function normalizePlatformCostDays(payload, options = {}) {
	const month = options.month;
	const year = options.year;
	const monthKey = month !== void 0 && year !== void 0 ? `${String(year).padStart(4, "0")}-${pad2(month)}` : void 0;
	const totals = /* @__PURE__ */ new Map();
	const visit = (node) => {
		const value = unwrapJson(node);
		if (Array.isArray(value)) {
			for (const item of value) visit(item);
			return;
		}
		if (!isRecord(value)) return;
		const day = readCostDay(value, month, year);
		if (day !== void 0) {
			totals.set(day.date, (totals.get(day.date) ?? 0) + day.cost);
			return;
		}
		for (const key of COST_NESTED_KEYS) if (value[key] !== void 0) visit(value[key]);
	};
	visit(payload);
	const days = [];
	for (const [date, cost] of totals) {
		if (monthKey !== void 0 && !date.startsWith(monthKey)) continue;
		days.push({
			date,
			cost: roundAmount(cost)
		});
	}
	days.sort((left, right) => left.date.localeCompare(right.date));
	return days;
}
/** Find the `total_costs` rows anywhere in the summary envelope. */
function findTotalCostRows(node) {
	if (Array.isArray(node)) {
		for (const item of node) {
			const nested = findTotalCostRows(item);
			if (nested.length > 0) return nested;
		}
		return [];
	}
	if (!isRecord(node)) return [];
	for (const key of [
		"total_costs",
		"totalCosts",
		"total_cost",
		"totalCost"
	]) {
		const value = unwrapJson(node[key]);
		if (value === void 0) continue;
		if (Array.isArray(value)) return value;
		if (isRecord(value)) return Object.entries(value).map(([currency, amount]) => isRecord(amount) ? {
			currency,
			...amount
		} : {
			currency,
			amount
		});
		return [value];
	}
	return [];
}
/**
* Normalize `get_user_summary` to the all-time CNY spend. Wallet balances are
* deliberately ignored: the reconcile strip only needs `total_costs`, and the
* balance card already reads DeepSeek's public `/user/balance` endpoint.
*/
function normalizePlatformSummary(payload) {
	const rows = findTotalCostRows(platformBizData(payload));
	let cumulative;
	for (const raw of rows) {
		const row = unwrapJson(raw);
		if (!isRecord(row)) {
			const amount = numberValue(row);
			if (amount !== void 0) cumulative = (cumulative ?? 0) + amount;
			continue;
		}
		const currency = (nonEmptyString(row.currency) ?? nonEmptyString(row.currency_code) ?? nonEmptyString(row.currencyCode) ?? "CNY").toUpperCase();
		if (currency !== "CNY" && currency !== "RMB") continue;
		const amount = numberValue(row.amount ?? row.total ?? row.value ?? row.cost);
		if (amount !== void 0) cumulative = (cumulative ?? 0) + amount;
	}
	return cumulative === void 0 ? {} : { cumulativeCost: roundAmount(cumulative) };
}
/** Normalize an origin string to a bare `scheme://host[:port]`. */
function normalizeOrigin(value) {
	const raw = nonEmptyString(value);
	if (raw === void 0) return void 0;
	try {
		const url = new URL(raw);
		if (url.protocol !== "http:" && url.protocol !== "https:") return void 0;
		if (url.username !== "" || url.password !== "") return void 0;
		if (url.search !== "" || url.hash !== "") return void 0;
		return url.origin;
	} catch {
		return;
	}
}
/**
* Resolve the host's platform grant: prefer the live `deepseekAccount` session,
* fall back to the stored `deepseek-account-platform/default` grant record.
* Returns undefined when neither source yields a token; never throws.
*/
async function resolvePlatformToken(ctx) {
	const account = service$1(ctx, "deepseekAccount");
	const getPlatformSession = account?.getPlatformSession;
	if (typeof getPlatformSession === "function") try {
		const session = await getPlatformSession.call(account);
		const token = isRecord(session) ? nonEmptyString(session.token) : void 0;
		if (token !== void 0) {
			const origin = isRecord(session) ? normalizeOrigin(session.origin) : void 0;
			return origin === void 0 ? { token } : {
				token,
				origin
			};
		}
	} catch {}
	const credentials = service$1(ctx, "credentials");
	const readRecord = credentials?.readRecord;
	if (typeof readRecord !== "function") return void 0;
	try {
		const record = await readRecord.call(credentials, credentialKey(PLATFORM_CREDENTIAL_SCOPE, PLATFORM_CREDENTIAL_ID));
		if (record?.kind !== "grant") return void 0;
		const payload = unwrapJson(record.payload);
		if (!isRecord(payload)) return void 0;
		const token = nonEmptyString(payload.token);
		if (token === void 0) return void 0;
		const origin = normalizeOrigin(payload.origin);
		return origin === void 0 ? { token } : {
			token,
			origin
		};
	} catch {
		return;
	}
}
/** Console request headers; the browser UA + app version keep the upstream from 429ing. */
function buildHeaders(token, origin, options) {
	return {
		accept: "application/json, text/plain, */*",
		"accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
		"x-dsh-auth-token": token,
		"user-agent": nonEmptyString(options.userAgent) ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		"x-app-version": nonEmptyString(options.appVersion) ?? "0.1.0",
		origin,
		referer: `${origin}/usage`
	};
}
/** Console envelope code, when the body carries one. */
function envelopeCode(payload) {
	const root = unwrapJson(payload);
	if (!isRecord(root)) return void 0;
	const error = unwrapJson(root.error);
	const raw = root.code ?? root.errno ?? (isRecord(error) ? error.code : void 0);
	if (raw === void 0 || raw === null || raw === "") return void 0;
	const code = Number(raw);
	return Number.isFinite(code) ? code : void 0;
}
var PlatformAuthError = class extends Error {
	constructor() {
		super("platform session expired");
		this.name = "PlatformAuthError";
	}
};
var PlatformHttpError = class extends Error {
	status;
	constructor(status) {
		super(`platform HTTP ${status}`);
		this.name = "PlatformHttpError";
		this.status = status;
	}
};
var PlatformApiError = class extends Error {
	code;
	constructor(code) {
		super(`platform API error ${code}`);
		this.name = "PlatformApiError";
		this.code = code;
	}
};
/** Short, credential-free display message for any fetch/normalize failure. */
function platformErrorMessage(error) {
	if (error instanceof PlatformAuthError) return "platform session expired";
	if (error instanceof PlatformHttpError) return `platform HTTP ${error.status}`;
	if (error instanceof PlatformApiError) return `platform API error ${error.code}`;
	if (error instanceof Error) {
		if (error.name === "TimeoutError" || error.name === "AbortError") return "platform request timed out";
		if (error.message === INVALID_JSON_MESSAGE) return "platform response was not valid JSON";
	}
	return "platform request failed";
}
function sleep(ms) {
	if (ms <= 0) return Promise.resolve();
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
/**
* GET one console endpoint as JSON, retrying a 429/5xx once. Auth failures and
* envelope auth codes are raised immediately (no retry); anything else is a
* typed error for the caller to degrade.
*/
async function requestJson(fetchImpl, url, headers, options) {
	const timeoutMs = options.timeoutMs !== void 0 && options.timeoutMs > 0 ? options.timeoutMs : PLATFORM_TIMEOUT_MS;
	const retryDelayMs = options.retryDelayMs !== void 0 ? Math.max(0, options.retryDelayMs) : PLATFORM_RETRY_DELAY_MS;
	let attempt = 0;
	for (;;) {
		const response = await fetchImpl(url, {
			method: "GET",
			headers,
			redirect: "manual",
			signal: AbortSignal.timeout(timeoutMs)
		});
		if ((response.status === 429 || response.status >= 500) && attempt === 0) {
			attempt = 1;
			await sleep(retryDelayMs);
			continue;
		}
		if (response.status === 401 || response.status === 403) throw new PlatformAuthError();
		if (!response.ok) throw new PlatformHttpError(response.status);
		let body;
		try {
			body = await response.json();
		} catch {
			throw new Error(INVALID_JSON_MESSAGE);
		}
		const code = envelopeCode(body);
		if (code !== void 0 && code !== 0 && code !== 200) {
			if (AUTH_ERROR_CODES.has(code)) throw new PlatformAuthError();
			throw new PlatformApiError(code);
		}
		return body;
	}
}
/** Resolve the local month the cost endpoint is queried for. */
function resolvePeriod(nowMs, options) {
	const local = new Date(nowMs);
	return {
		month: typeof options.month === "number" && Number.isInteger(options.month) && options.month >= 1 && options.month <= 12 ? options.month : local.getMonth() + 1,
		year: typeof options.year === "number" && Number.isInteger(options.year) && options.year >= 1970 && options.year <= 9999 ? options.year : local.getFullYear()
	};
}
/**
* Read the official DeepSeek platform month cost, lifetime cost and per-day
* month cost through the host's own platform grant.
*
* Never throws. Returns `unavailable` (no network call) when no grant is
* resolvable, `error` with a short message when the upstream rejects or
* misbehaves, and `ready` with official CNY facts otherwise. `localMonthCost`,
* `coverage` and `delta` are the integrating service's ledger facts, so they
* are intentionally not filled here.
*/
async function fetchPlatformUsage(ctx, options = {}) {
	const now = options.now ?? Date.now;
	const timestamp = () => now();
	const token = await resolvePlatformToken(ctx);
	if (token === void 0) return {
		status: "unavailable",
		currency: "CNY",
		updatedAt: timestamp()
	};
	const origin = normalizeOrigin(options.origin) ?? normalizeOrigin(token.origin) ?? "https://platform.deepseek.com";
	const period = resolvePeriod(timestamp(), options);
	const headers = buildHeaders(token.token, origin, options);
	const fetchImpl = options.fetch ?? globalThis.fetch;
	if (typeof fetchImpl !== "function") return {
		status: "error",
		currency: "CNY",
		updatedAt: timestamp(),
		error: "platform fetch is unavailable"
	};
	try {
		const summary = await requestJson(fetchImpl, `${origin}${SUMMARY_PATH}`, headers, options);
		const cost = await requestJson(fetchImpl, `${origin}${COST_PATH}?month=${String(period.month)}&year=${String(period.year)}`, headers, options);
		const facts = normalizePlatformSummary(summary);
		const days = normalizePlatformCostDays(cost, period);
		return {
			status: "ready",
			currency: "CNY",
			monthCost: roundAmount(days.reduce((total, day) => total + day.cost, 0)),
			...facts.cumulativeCost !== void 0 ? { cumulativeCost: facts.cumulativeCost } : {},
			days,
			updatedAt: timestamp()
		};
	} catch (error) {
		return {
			status: "error",
			currency: "CNY",
			updatedAt: timestamp(),
			error: platformErrorMessage(error)
		};
	}
}
//#endregion
//#region src/core/pricing.ts
/** The published peak windows: weekday 09:00-12:00 and 14:00-18:00. */
const PEAK_WINDOWS = [{
	from: 540,
	to: 720
}, {
	from: 840,
	to: 1080
}];
/** Beijing is UTC+8 year-round (no DST), so a fixed shift is exact. */
const BEIJING_UTC_OFFSET_MS = 288e5;
/** deepseek-flash (DeepSeek-V4.1-Flash), including the retired flash-class ids it now serves. */
const FLASH_PRICE = {
	cacheHit: {
		offPeak: .02,
		peak: .04
	},
	inputMiss: {
		offPeak: 1,
		peak: 2
	},
	output: {
		offPeak: 4,
		peak: 8
	}
};
/** deepseek-v4-pro (DeepSeek-V4-Pro-0813); superseded by the flash row at the retirement instant. */
const PRO_PRICE = {
	cacheHit: {
		offPeak: .15,
		peak: .3
	},
	inputMiss: {
		offPeak: 4.5,
		peak: 9
	},
	output: {
		offPeak: 13.5,
		peak: 27
	}
};
/**
* The instant DeepSeek starts serving `deepseek-v4-pro` requests from
* V4.1-Flash and billing the flash row: 2026-09-14 12:00 Beijing (UTC+8).
* Drop the pro row's time fence once V4.1 Pro ships with a published row.
*/
const V4_PRO_FOLDED_INTO_FLASH_AT_MS = Date.UTC(2026, 8, 14, 4, 0);
function withinWindow(minuteOfDay) {
	return PEAK_WINDOWS.find((window) => minuteOfDay >= window.from && minuteOfDay < window.to);
}
/**
* The DeepSeek billing period at `ms`, plus when it next flips. The clock is
* Beijing time regardless of the host timezone (UTC+8 has no DST, so a fixed
* shift is exact). `boundaryMs` is the instant the current period ends — the
* window's close while peaking, the next window's open otherwise.
*/
function deepseekPeriodAt(ms) {
	const shifted = new Date(ms + BEIJING_UTC_OFFSET_MS);
	const weekday = shifted.getUTCDay();
	const minuteOfDay = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
	const current = weekday >= 1 && weekday <= 5 ? withinWindow(minuteOfDay) : void 0;
	if (current !== void 0) return {
		peak: true,
		boundaryMs: ms + (current.to - minuteOfDay) * 6e4 - shifted.getUTCSeconds() * 1e3 - shifted.getUTCMilliseconds()
	};
	for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
		const day = new Date(ms + BEIJING_UTC_OFFSET_MS + dayOffset * 864e5);
		if (day.getUTCDay() < 1 || day.getUTCDay() > 5) continue;
		const realDayStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) - BEIJING_UTC_OFFSET_MS;
		for (const window of PEAK_WINDOWS) {
			if (dayOffset === 0 && window.from <= minuteOfDay) continue;
			return {
				peak: false,
				boundaryMs: realDayStart + window.from * 6e4
			};
		}
	}
	return {
		peak: false,
		boundaryMs: ms + 864e5
	};
}
/** The price row for a model id at `atMs`; unknown ids take the flash-class row (documented estimate). */
function priceFor(model, atMs) {
	return model.includes("v4-pro") && atMs < V4_PRO_FOLDED_INTO_FLASH_AT_MS ? PRO_PRICE : FLASH_PRICE;
}
/**
* Estimate one call's DeepSeek spend in CNY from its token totals, priced in
* the billing period at `atMs`. Uncatalogued model ids take the flash-class
* row; ids from other providers never reach this function (the service gates
* by route family). Rounded to micro-CNY so the ledger stays readable.
*/
function deepseekModelSpend(model, totals, atMs) {
	const price = priceFor(model, atMs);
	const column = deepseekPeriodAt(atMs).peak ? "peak" : "offPeak";
	const spend = (totals.cacheReadTokens * price.cacheHit[column] + (totals.inputTokens + totals.cacheWriteTokens) * price.inputMiss[column] + totals.outputTokens * price.output[column]) / 1e6;
	return Math.round(spend * 1e6) / 1e6;
}
//#endregion
//#region src/core/types.ts
/** A zeroed totals bucket. */
function emptyTotals() {
	return {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		reasoningTokens: 0,
		calls: 0,
		cost: 0
	};
}
/** Add `right` into `left` in place. */
function addTotals(left, right) {
	left.inputTokens += right.inputTokens;
	left.outputTokens += right.outputTokens;
	left.cacheReadTokens += right.cacheReadTokens;
	left.cacheWriteTokens += right.cacheWriteTokens;
	left.reasoningTokens += right.reasoningTokens;
	left.calls += right.calls;
	left.cost += right.cost;
	return left;
}
//#endregion
//#region src/core/ledger.ts
/**
* The usage ledger: a pure fold from session usage facts into a per-day,
* per-provider, per-model totals document, plus its JSON serialization.
* Host-side state lives only in the document; the service owns persistence.
* @module @linxin666/dsh-usage/core/ledger
*/
/** Local-date key (`YYYY-MM-DD`) for an epoch ms timestamp. */
function localDateKey(ms) {
	const date = new Date(ms);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}
/** An empty ledger document. */
function createLedgerDocument() {
	return {
		version: 1,
		days: {}
	};
}
/**
* Bucket keys come from untrusted directions (persisted JSON, provider and
* model ids out of session events), so they must never collide with
* `Object.prototype` plumbing: assigning `day['__proto__']` or reading
* `day['constructor']` would pollute every object in the host process.
*/
function isSafeBucketKey(key) {
	return key !== "__proto__" && key !== "constructor" && key !== "prototype";
}
/**
* Fold one usage report into the ledger in place. `provider` is the route key
* and `model` the provider-owned model id the step ran under. Reports keyed
* by prototype-plumbing names are dropped.
*/
function foldUsage(doc, atMs, provider, model, usage) {
	if (!isSafeBucketKey(provider) || !isSafeBucketKey(model)) return;
	if (usage.calls <= 0 && usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens <= 0) return;
	const dayKey = localDateKey(atMs);
	const day = doc.days[dayKey] ?? {};
	const models = day[provider] ?? {};
	const totals = models[model] ?? emptyTotals();
	addTotals(totals, usage);
	models[model] = totals;
	day[provider] = models;
	doc.days[dayKey] = day;
}
/** Total tokens of a bucket (billed input + output; reasoning is inside output). */
function totalTokens(totals) {
	return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens;
}
/**
* Aggregate whole per-day maps (each `provider -> model -> totals`) into the
* per-provider/per-model summary the overview serves for one day or a range:
* disjoint bucket sums per provider, per-model rows heaviest first, and the
* grand total. Pure: reads its inputs, allocates fresh buckets.
*/
function summarizeDays(days) {
	const merged = /* @__PURE__ */ new Map();
	for (const day of days) for (const [provider, models] of Object.entries(day)) {
		if (!isSafeBucketKey(provider) || typeof models !== "object" || models === null) continue;
		let modelMap = merged.get(provider);
		if (modelMap === void 0) {
			modelMap = /* @__PURE__ */ new Map();
			merged.set(provider, modelMap);
		}
		for (const [model, totals] of Object.entries(models)) {
			if (typeof totals !== "object" || totals === null) continue;
			const bucket = modelMap.get(model) ?? emptyTotals();
			addTotals(bucket, totals);
			modelMap.set(model, bucket);
		}
	}
	const providers = [];
	const totals = emptyTotals();
	for (const [provider, modelMap] of merged) {
		const providerTotals = emptyTotals();
		const modelRows = [...modelMap].map(([model, modelTotals]) => ({
			model,
			totals: modelTotals
		}));
		for (const row of modelRows) addTotals(providerTotals, row.totals);
		modelRows.sort((a, b) => totalTokens(b.totals) - totalTokens(a.totals));
		providers.push({
			provider,
			totals: providerTotals,
			models: modelRows.slice(0, 12)
		});
	}
	providers.sort((a, b) => totalTokens(b.totals) - totalTokens(a.totals));
	for (const row of providers) addTotals(totals, row.totals);
	return {
		totals,
		providers
	};
}
/**
* Aggregate whole per-day maps into per-provider totals and a grand total
* only. Same provider ordering as `summarizeDays` (heaviest by total tokens
* first, stable on first appearance), but no model rows are built or sorted:
* the overview's all-time window renders provider totals only, so the
* per-model breakdown would be dead weight that grows with retained history.
* Pure: reads its inputs, allocates fresh buckets.
*/
function summarizeProviderTotals(days) {
	const merged = /* @__PURE__ */ new Map();
	for (const day of days) for (const [provider, models] of Object.entries(day)) {
		if (!isSafeBucketKey(provider) || typeof models !== "object" || models === null) continue;
		const bucket = merged.get(provider) ?? emptyTotals();
		for (const totals of Object.values(models)) {
			if (typeof totals !== "object" || totals === null) continue;
			addTotals(bucket, totals);
		}
		merged.set(provider, bucket);
	}
	const providers = [...merged].map(([provider, totals]) => ({
		provider,
		totals
	}));
	providers.sort((a, b) => totalTokens(b.totals) - totalTokens(a.totals));
	const totals = emptyTotals();
	for (const row of providers) addTotals(totals, row.totals);
	return {
		totals,
		providers
	};
}
/**
* One total per requested local day. The heatmap needs per-day token totals
* for up to 182 days; walking each day's provider/model buckets once here is
* far cheaper than running the full `summarizeDays` per day (which allocates
* and sorts model rows the heatmap never reads). Days missing from the ledger
* resolve to a fresh zero bucket, like `summarizeDays([{}])`.
*/
function summarizeDayTotals(doc, dayKeys) {
	const totalsByDay = /* @__PURE__ */ new Map();
	for (const dateKey of dayKeys) {
		const bucket = emptyTotals();
		const day = doc.days[dateKey];
		if (day !== void 0) for (const [provider, models] of Object.entries(day)) {
			if (!isSafeBucketKey(provider) || typeof models !== "object" || models === null) continue;
			for (const modelTotals of Object.values(models)) {
				if (typeof modelTotals !== "object" || modelTotals === null) continue;
				addTotals(bucket, modelTotals);
			}
		}
		totalsByDay.set(dateKey, bucket);
	}
	return totalsByDay;
}
/**
* Aggregate the overview usage windows from a ledger document. The all-time
* window skips the per-model breakdown (`models: []` rows) exactly like the
* previous inline assembly, but without building model rows first.
*/
function summarizeLedgerUsage(doc, options) {
	const allKeys = ledgerDayKeys(doc);
	const heatmapKeys = allKeys.slice(-options.heatmapDays);
	const rangeKeys = allKeys.slice(-options.rangeDays);
	const range = summarizeDays(rangeKeys.map((key) => doc.days[key] ?? {}));
	const all = summarizeProviderTotals(allKeys.map((key) => doc.days[key] ?? {}));
	const today = summarizeDays([doc.days[options.todayKey] ?? {}]);
	const dayTotals = summarizeDayTotals(doc, heatmapKeys);
	const days = heatmapKeys.map((date) => ({
		date,
		totals: dayTotals.get(date) ?? emptyTotals()
	}));
	const usageProviders = /* @__PURE__ */ new Set();
	for (const row of today.providers) usageProviders.add(row.provider);
	for (const row of range.providers) usageProviders.add(row.provider);
	for (const row of all.providers) usageProviders.add(row.provider);
	return {
		todayKey: options.todayKey,
		allKeys,
		heatmapKeys,
		rangeKeys,
		days,
		today: {
			date: options.todayKey,
			totals: today.totals,
			providers: today.providers
		},
		range: {
			from: rangeKeys[0] ?? options.todayKey,
			to: rangeKeys[rangeKeys.length - 1] ?? options.todayKey,
			totals: range.totals,
			providers: range.providers
		},
		all: {
			from: allKeys[0] ?? options.todayKey,
			to: allKeys[allKeys.length - 1] ?? options.todayKey,
			totals: all.totals,
			providers: all.providers.map(({ provider, totals }) => ({
				provider,
				totals,
				models: []
			}))
		},
		usageProviders
	};
}
/** All local-date keys in the ledger, ascending. */
function ledgerDayKeys(doc) {
	return Object.keys(doc.days).sort();
}
/**
* Drop every day older than `retainDays` local days before `todayKey`, in
* place. Returns the number of pruned days.
*/
function pruneLedger(doc, todayKey, retainDays) {
	const cutoff = /* @__PURE__ */ new Date(todayKey + "T00:00:00");
	cutoff.setDate(cutoff.getDate() - retainDays);
	const cutoffKey = localDateKey(cutoff.getTime());
	let pruned = 0;
	for (const key of Object.keys(doc.days)) if (key < cutoffKey) {
		delete doc.days[key];
		pruned += 1;
	}
	return pruned;
}
function reviveTotals(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const source = value;
	const num = (key) => typeof source[key] === "number" && Number.isFinite(source[key]) ? source[key] : 0;
	return {
		inputTokens: num("inputTokens"),
		outputTokens: num("outputTokens"),
		cacheReadTokens: num("cacheReadTokens"),
		cacheWriteTokens: num("cacheWriteTokens"),
		reasoningTokens: num("reasoningTokens"),
		calls: num("calls"),
		cost: num("cost")
	};
}
/**
* Parse a ledger document from untrusted JSON: unknown shapes resolve to an
* empty document, malformed entries are dropped, numbers are coerced to
* finite values. Never throws.
*/
function deserializeLedger(value) {
	const doc = createLedgerDocument();
	if (typeof value !== "object" || value === null) return doc;
	const days = value.days;
	if (typeof days !== "object" || days === null) return doc;
	for (const [dateKey, providers] of Object.entries(days)) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || typeof providers !== "object" || providers === null) continue;
		const atMs = (/* @__PURE__ */ new Date(dateKey + "T12:00:00")).getTime();
		if (!Number.isFinite(atMs) || localDateKey(atMs) !== dateKey) continue;
		for (const [provider, models] of Object.entries(providers)) {
			if (typeof models !== "object" || models === null) continue;
			for (const [model, totals] of Object.entries(models)) {
				const revived = reviveTotals(totals);
				if (revived !== void 0) foldUsage(doc, atMs, provider, model, revived);
			}
		}
	}
	return doc;
}
//#endregion
//#region src/core/plan-match.ts
/** Windows the strip and ContextMeter-style meter expose. */
const DISPLAY_KEYS = /* @__PURE__ */ new Set([
	"5h",
	"week",
	"month"
]);
const WINDOW_ORDER = [
	"5h",
	"week",
	"month"
];
/** Keep only percentage windows the UI knows how to render. */
function planWindowsForDisplay(plan) {
	if (plan === void 0) return [];
	return plan.windows.filter((window) => DISPLAY_KEYS.has(window.key) && window.percent !== void 0);
}
/** Stable 5h → week → month order for plan cards and the strip panel. */
function orderedPlanWindows(plan) {
	return [...planWindowsForDisplay(plan)].sort((left, right) => {
		const leftIndex = WINDOW_ORDER.indexOf(left.key);
		const rightIndex = WINDOW_ORDER.indexOf(right.key);
		return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
	});
}
/** Clone a provider row with display-only windows, or undefined when empty. */
function withDisplayPlan(provider) {
	if (provider?.plan === void 0) return void 0;
	const windows = orderedPlanWindows(provider.plan);
	if (windows.length === 0) return void 0;
	return {
		...provider,
		plan: {
			...provider.plan,
			windows
		}
	};
}
function haystack(provider, model, baseURL) {
	return `${provider} ${model ?? ""} ${baseURL ?? ""}`.toLowerCase();
}
/** Volcano Ark / Doubao coding-plan routes (and their control-plane hosts). */
function looksLikeVolcano(text) {
	return /volc|ark|doubao|byteplus|火山|volces\.com|volcengineapi\.com/.test(text);
}
/** CLI Proxy API management console / common local gateway endpoints. */
function looksLikeCpamcGateway(text) {
	return /cliproxy|cli[-_]?proxy|cpamc|cli\s*proxy|127\.0\.0\.1:8317|localhost:8317|\[::1\]:8317|:8317\b/.test(text);
}
/** Provider ids that commonly front CPAMC-backed Codex / Kimi / Claude accounts. */
function looksLikeCpamcProviderId(provider) {
	const id = provider.toLowerCase();
	return /^(openai-codex|codex|kimi-coding|kimi|anthropic|claude)\b/.test(id) || /cliproxy|cli[-_]?proxy|cpamc/.test(id);
}
/** Map a composer route onto one of the CPAMC account families we probe. */
function cpamcFamily(text) {
	if (/codex|chatgpt|openai-codex|\bgpt-|\bo[1-4]\b/.test(text)) return "codex";
	if (/kimi|moonshot/.test(text)) return "kimi";
	if (/claude|anthropic/.test(text)) return "claude";
}
/**
* Pick the plan snapshot for the current composer model.
* Order: explicit route override (per-session selection) → exact provider id
* → Volcano external source → CPAMC external source. The override lets the
* strip follow the model selected in each conversation instead of the host's
* global "last request seen" route.
*/
function currentPlanProvider(snapshot, override) {
	if (snapshot === null) return void 0;
	const current = override !== void 0 ? {
		provider: override.provider,
		...override.model !== void 0 && override.model !== "" ? { model: override.model } : {},
		...override.baseURL !== void 0 ? { baseURL: override.baseURL } : {}
	} : snapshot.current;
	if (current.provider === void 0) return void 0;
	const providers = snapshot.providers;
	const exact = withDisplayPlan(providers.find((row) => row.provider === current.provider));
	if (exact !== void 0) return exact;
	const text = haystack(current.provider, current.model, current.baseURL ?? (current.provider === snapshot.current.provider ? snapshot.current.baseURL : void 0));
	if (looksLikeVolcano(text)) {
		const volcano = withDisplayPlan(providers.find((row) => row.source === "volcano"));
		if (volcano !== void 0) return volcano;
	}
	const cpamcRows = providers.filter((row) => row.source === "cpamc" && row.plan !== void 0);
	if (cpamcRows.length === 0) return void 0;
	const viaGateway = looksLikeCpamcGateway(text);
	const viaProviderId = looksLikeCpamcProviderId(current.provider);
	if (!viaGateway && !viaProviderId) return void 0;
	const family = cpamcFamily(text);
	if (family !== void 0) {
		const preferred = withDisplayPlan(cpamcRows.find((row) => row.provider.startsWith(`cpamc:${family}:`)));
		if (preferred !== void 0) return preferred;
	}
	for (const row of cpamcRows) {
		const hit = withDisplayPlan(row);
		if (hit !== void 0) return hit;
	}
}
//#endregion
//#region src/host/alerts.ts
/** Stable episode key: `kind:provider:window` (empty for absent dimensions). */
function alertKey(kind, provider, window) {
	return `${kind}:${provider ?? ""}:${window ?? ""}`;
}
function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}
/** Daily-cost alert candidate, or undefined when the threshold is off/unmet. */
function dailyCostAlert(todayCost, limitCny) {
	if (!isFiniteNumber(limitCny) || limitCny <= 0 || !isFiniteNumber(todayCost) || todayCost < limitCny * .8) return void 0;
	const severity = todayCost >= limitCny ? "critical" : "warning";
	return {
		kind: "daily-cost",
		severity,
		value: todayCost,
		threshold: limitCny,
		message: `Today's spend ${todayCost.toFixed(2)} CNY ${severity === "critical" ? "reached" : "is near"} the ${limitCny.toFixed(2)} CNY limit`
	};
}
/** Per-provider plan alert candidates, deduped to the tightest window. */
function planAlerts(providers, threshold) {
	if (!isFiniteNumber(threshold) || threshold <= 0) return [];
	const alerts = [];
	for (const provider of providers) {
		const windows = provider.plan?.windows;
		if (!Array.isArray(windows)) continue;
		let tightest;
		for (const window of windows) {
			if (typeof window?.percent !== "number" || !Number.isFinite(window.percent)) continue;
			if (tightest === void 0 || window.percent > tightest.percent) tightest = {
				key: window.key,
				percent: window.percent
			};
		}
		if (tightest === void 0 || tightest.percent < threshold) continue;
		const severity = tightest.percent >= 95 ? "critical" : "warning";
		alerts.push({
			kind: "plan-threshold",
			severity,
			provider: provider.provider,
			window: tightest.key,
			value: tightest.percent,
			threshold,
			message: `Plan window ${tightest.key} is at ${tightest.percent.toFixed(1)}% (alert threshold ${threshold}%)`
		});
	}
	return alerts;
}
/** Per-provider low-balance candidates (CNY balances only; the alert is CNY). */
function balanceAlerts(providers, threshold) {
	if (!isFiniteNumber(threshold) || threshold <= 0) return [];
	const alerts = [];
	for (const provider of providers) {
		const balance = provider.balance;
		if (balance === void 0 || typeof balance.currency !== "string" || balance.currency.toUpperCase() !== "CNY") continue;
		const amount = Number(balance.totalBalance);
		if (!Number.isFinite(amount) || amount > threshold) continue;
		const severity = amount <= threshold * .5 ? "critical" : "warning";
		alerts.push({
			kind: "balance-low",
			severity,
			provider: provider.provider,
			value: amount,
			threshold,
			message: `Balance ${amount.toFixed(2)} CNY is ${severity === "critical" ? "critically" : ""} low (threshold ${threshold.toFixed(2)} CNY)`
		});
	}
	return alerts;
}
/**
* Evaluate the current facts against the thresholds, updating `episodes` in
* place. Disabled alerts (master switch off, or every threshold 0) produce an
* empty list and clear the episode map so a later enable starts fresh.
*/
function evaluateAlerts(facts, thresholds, episodes, nowMs) {
	if (!thresholds.alertsEnabled) {
		episodes.clear();
		return {
			alerts: [],
			started: []
		};
	}
	const dailyLimit = thresholds.dailyCostLimitCny;
	const planThreshold = thresholds.planAlertPercent;
	const balanceThreshold = thresholds.balanceAlertCny;
	if (!(dailyLimit > 0) && !(planThreshold > 0) && !(balanceThreshold > 0)) {
		episodes.clear();
		return {
			alerts: [],
			started: []
		};
	}
	const candidates = [];
	const daily = dailyCostAlert(facts.todayCost, dailyLimit);
	if (daily !== void 0) candidates.push(daily);
	candidates.push(...planAlerts(facts.providers, planThreshold));
	candidates.push(...balanceAlerts(facts.providers, balanceThreshold));
	const alerts = [];
	const started = [];
	const activeKeys = /* @__PURE__ */ new Set();
	for (const candidate of candidates) {
		const key = alertKey(candidate.kind, candidate.provider, candidate.window);
		activeKeys.add(key);
		let since = episodes.get(key);
		const isNew = since === void 0;
		if (since === void 0) {
			since = nowMs;
			episodes.set(key, since);
		}
		const alert = {
			...candidate,
			since
		};
		alerts.push(alert);
		if (isNew) started.push(alert);
	}
	for (const key of [...episodes.keys()]) if (!activeKeys.has(key)) episodes.delete(key);
	return {
		alerts,
		started
	};
}
//#endregion
//#region src/host/external-sources.ts
/**
* Independent quota sources which cannot be inferred from a normal model API key.
* CPAMC uses its management key; Volcano Ark uses an AK/SK signature pair.
* Portions of the protocol normalization are adapted from dsh-cost-meter (MIT).
*/
const timeout = () => AbortSignal.timeout(15e3);
/**
* Human message for a failed `fetch`, including the underlying network code
* (ECONNREFUSED / ENOTFOUND / timeout / TLS). Node's bare "fetch failed" hides
* the cause, which is exactly what a CPAMC setup mistake needs to show.
*/
function describeExternalFetchError(error) {
	if (!(error instanceof Error)) return String(error);
	if (error.name === "TimeoutError" || error.name === "AbortError") return "request timed out";
	const cause = error.cause;
	const causeObject = typeof cause === "object" && cause !== null ? cause : void 0;
	const code = typeof causeObject?.code === "string" ? causeObject.code : void 0;
	const detail = code !== void 0 ? ` (${code})` : "";
	return `${error.message}${detail}`;
}
function clamp(value) {
	const number = Number(value);
	return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : void 0;
}
function iso(value) {
	const number = Number(value);
	const date = Number.isFinite(number) && number > 0 ? new Date(number < 0xe8d4a51000 ? number * 1e3 : number) : new Date(String(value ?? ""));
	return Number.isNaN(date.getTime()) ? void 0 : date.toISOString();
}
function listOf(payload) {
	if (Array.isArray(payload)) return payload;
	if (typeof payload !== "object" || payload === null) return [];
	const root = payload;
	for (const key of [
		"auth_files",
		"authFiles",
		"files",
		"accounts",
		"data"
	]) if (Array.isArray(root[key])) return root[key];
	return [];
}
function cpamcOrigin(raw, allowedHosts) {
	try {
		const url = new URL(raw);
		if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return void 0;
		if (url.protocol !== "http:" && url.protocol !== "https:") return void 0;
		const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
		const allowed = String(allowedHosts ?? "").split(",").map((item) => item.trim().toLowerCase()).filter((item) => item !== "");
		if (!isLoopback && !allowed.includes(url.hostname.toLowerCase())) return void 0;
		return url.origin;
	} catch {
		return;
	}
}
async function cpamcFetch(origin, path, key, init) {
	const response = await fetch(origin + path, {
		...init,
		redirect: "manual",
		signal: timeout(),
		headers: {
			accept: "application/json",
			"content-type": "application/json",
			"x-management-key": key,
			...init?.headers
		}
	});
	if (response.status >= 300 && response.status < 400) throw new Error("CPAMC redirect refused");
	if (!response.ok) throw new Error(`CPAMC HTTP ${response.status}`);
	return response.json();
}
function cpamcProvider(row) {
	const raw = String(row.provider ?? row.type ?? "").toLowerCase();
	if (raw.includes("codex")) return "codex";
	if (raw.includes("kimi")) return "kimi";
	if (raw.includes("claude") || raw.includes("anthropic")) return "claude";
}
function cpamcRequest(provider, account) {
	if (provider === "kimi") return {
		url: "https://api.kimi.com/coding/v1/usages",
		headers: { authorization: "Bearer $TOKEN$" }
	};
	if (provider === "claude") return {
		url: "https://api.anthropic.com/api/oauth/usage",
		headers: {
			authorization: "Bearer $TOKEN$",
			"anthropic-version": "2023-06-01"
		}
	};
	const accountId = String(account.chatgpt_account_id ?? account.chatgptAccountId ?? "");
	return {
		url: "https://chatgpt.com/backend-api/wham/usage",
		headers: {
			authorization: "Bearer $TOKEN$",
			...accountId ? { "chatgpt-account-id": accountId } : {}
		}
	};
}
function cpamcWindows(provider, body) {
	if (provider === "codex") return adapterFor("openai-codex")?.plan?.parse(200, body)?.windows ?? [];
	if (provider === "kimi") return adapterFor("kimi-coding")?.plan?.parse(200, body)?.windows ?? [];
	if (typeof body !== "object" || body === null) return [];
	const root = body;
	const windows = [];
	for (const [field, key] of [["five_hour", "5h"], ["seven_day", "week"]]) {
		const row = root[field];
		if (typeof row !== "object" || row === null) continue;
		const item = row;
		const percent = clamp(item.utilization ?? item.used_percent);
		if (percent !== void 0) windows.push({
			key,
			percent,
			resetsAt: iso(item.resets_at ?? item.reset_at)
		});
	}
	return windows;
}
/** Query supported accounts through CPAMC's fixed, read-only management routes. */
async function probeCpamc(options) {
	if (!options.enabled) return [];
	const statusRow = (error) => [{
		provider: "cpamc:status",
		displayName: "CPAMC · CLI Proxy API",
		credential: options.managementKey ? "env" : "none",
		supported: true,
		planSupported: true,
		source: "cpamc",
		planError: error,
		updatedAt: Date.now()
	}];
	if (!options.managementKey) return statusRow("missing management token");
	const origin = cpamcOrigin(options.baseURL, options.allowedHosts);
	if (origin === void 0) return statusRow("CPAMC URL must be a loopback origin or a host listed in cpamcAllowedHosts (e.g. http://127.0.0.1:8317)");
	try {
		const auth = await cpamcFetch(origin, "/v0/management/auth-files", options.managementKey);
		const output = [];
		let index = 0;
		for (const raw of listOf(auth).slice(0, 16)) {
			if (typeof raw !== "object" || raw === null) continue;
			const account = raw;
			const authIndex = String(account.auth_index ?? account.authIndex ?? "");
			const provider = cpamcProvider(account);
			if (!authIndex || provider === void 0) continue;
			const request = cpamcRequest(provider, account);
			const envelope = await cpamcFetch(origin, "/v0/management/api-call", options.managementKey, {
				method: "POST",
				body: JSON.stringify({
					auth_index: authIndex,
					method: "GET",
					url: request.url,
					header: request.headers
				})
			});
			if (typeof envelope !== "object" || envelope === null) continue;
			const wrapped = envelope;
			const status = Number(wrapped.status_code);
			if (status < 200 || status >= 300 || typeof wrapped.body !== "string") continue;
			let body;
			try {
				body = JSON.parse(wrapped.body);
			} catch {
				continue;
			}
			const windows = cpamcWindows(provider, body).filter((window) => window.percent !== void 0);
			if (windows.length === 0) continue;
			const label = String(account.email ?? account.label ?? `账号 ${index + 1}`);
			output.push({
				provider: `cpamc:${provider}:${index}`,
				displayName: `CPAMC · ${provider} · ${label.replace(/^(.).*(@.*)$/, "$1***$2")}`,
				credential: "env",
				supported: true,
				planSupported: true,
				source: "cpamc",
				plan: {
					windows,
					updatedAt: Date.now()
				},
				updatedAt: Date.now()
			});
			index += 1;
		}
		if (output.length === 0) return statusRow("no quota accounts returned by CPAMC");
		return output;
	} catch (error) {
		return statusRow(describeExternalFetchError(error));
	}
}
const VOLC_HOST = "open.volcengineapi.com";
const VOLC_ACTIONS = [
	"GetCodingPlanUsage",
	"GetAFPUsage",
	"GetUsageDetails",
	"GetPersonalPlan"
];
function sha(value) {
	return createHash("sha256").update(value, "utf8").digest("hex");
}
function hmac(key, value) {
	return createHmac("sha256", key).update(value, "utf8").digest();
}
function queryString(query) {
	return Object.keys(query).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`).join("&");
}
function volcHeaders(ak, sk, query) {
	const xDate = (/* @__PURE__ */ new Date()).toISOString().replace(/[:-]|\.\d{3}/g, "");
	const date = xDate.slice(0, 8);
	const bodySha = sha("");
	const signedHeaders = "host;x-content-sha256;x-date";
	const canonicalHeaders = `host:${VOLC_HOST}\nx-content-sha256:${bodySha}\nx-date:${xDate}`;
	const request = [
		"GET",
		"/",
		queryString(query),
		`${canonicalHeaders}\n`,
		signedHeaders,
		bodySha
	].join("\n");
	const scope = `${date}/cn-beijing/ark/request`;
	const toSign = [
		"HMAC-SHA256",
		xDate,
		scope,
		sha(request)
	].join("\n");
	const signature = hmac(hmac(hmac(hmac(sk, date), "cn-beijing"), "ark"), "request");
	const hex = createHmac("sha256", signature).update(toSign, "utf8").digest("hex");
	return {
		"x-date": xDate,
		"x-content-sha256": bodySha,
		host: VOLC_HOST,
		authorization: `HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=${signedHeaders}, Signature=${hex}`
	};
}
function volcKey(raw) {
	const original = String(raw ?? "");
	const value = original.toLowerCase().replace(/[^a-z0-9]/g, "");
	if (value === "5h" || value === "fivehour" || value === "fiveh" || value === "session" || value === "rolling" || value === "hour5" || value.includes("5h") || value.includes("fivehour") || value.includes("session") || original.includes("小时")) return "5h";
	if (value.includes("week") || value === "7d" || value === "seven" || original.includes("周")) return "week";
	if (value.includes("month") || value === "30d" || original.includes("月")) return "month";
}
function volcWindows(body) {
	if (typeof body !== "object" || body === null) return [];
	const root = body;
	const candidates = [
		root.Result,
		root.result,
		root.data?.Result,
		root.data?.result,
		root.data,
		root
	];
	const windows = [];
	const seen = /* @__PURE__ */ new Set();
	const push = (key, percent, resetsAt) => {
		if (percent === void 0 || seen.has(key)) return;
		seen.add(key);
		windows.push({
			key,
			percent,
			...resetsAt !== void 0 ? { resetsAt } : {}
		});
	};
	for (const candidate of candidates) {
		if (candidate === null || typeof candidate !== "object") continue;
		const node = candidate;
		const rows = node.QuotaUsage ?? node.quotaUsage ?? node.UsageDetails ?? node.usageDetails ?? node.periods ?? node.items ?? node.limits ?? node.quotas ?? node.windows;
		if (Array.isArray(rows)) for (const row of rows) {
			if (typeof row !== "object" || row === null) continue;
			const key = volcKey(row.Level ?? row.level ?? row.QuotaType ?? row.quotaType ?? row.Label ?? row.label ?? row.Period ?? row.period ?? row.Type ?? row.type ?? row.Name ?? row.name);
			if (key === void 0) continue;
			let percent = clamp(row.Percent ?? row.percent ?? row.percentage ?? row.UsedPercent ?? row.usedPercent);
			const total = Number(row.Total ?? row.total ?? row.Limit ?? row.limit ?? row.Cap ?? row.cap ?? row.Quota ?? row.quota);
			const used = Number(row.Used ?? row.used ?? row.Usage ?? row.usage ?? row.Consumed ?? row.consumed);
			const remain = Number(row.Remaining ?? row.remaining ?? row.Remain ?? row.remain);
			if (percent === void 0 && Number.isFinite(total) && total > 0 && Number.isFinite(used)) percent = clamp(used / total * 100);
			if (percent === void 0 && Number.isFinite(total) && total > 0 && Number.isFinite(remain)) percent = clamp((total - remain) / total * 100);
			push(key, percent, iso(row.ResetTimestamp ?? row.resetTimestamp ?? row.ResetTime ?? row.resetTime ?? row.resetAt ?? row.resets_at ?? row.NextResetTime ?? row.nextResetTime));
		}
		for (const [field, key] of [
			["fiveHour", "5h"],
			["session", "5h"],
			["weekly", "week"],
			["monthly", "month"]
		]) {
			const row = node[field];
			if (typeof row !== "object" || row === null) continue;
			const item = row;
			let percent = clamp(item.Percent ?? item.percent ?? item.percentage ?? item.utilization);
			const total = Number(item.Total ?? item.total ?? item.Limit ?? item.limit);
			const used = Number(item.Used ?? item.used ?? item.Usage ?? item.usage);
			if (percent === void 0 && Number.isFinite(total) && total > 0 && Number.isFinite(used)) percent = clamp(used / total * 100);
			push(key, percent, iso(item.ResetTimestamp ?? item.resetTimestamp ?? item.ResetTime ?? item.resetTime ?? item.resetAt ?? item.resets_at));
		}
		if (windows.length > 0) break;
	}
	if (Array.isArray(root.items)) for (const item of root.items) {
		if (typeof item !== "object" || item === null) continue;
		const row = item;
		if (!Array.isArray(row.periods)) continue;
		for (const period of row.periods) {
			if (typeof period !== "object" || period === null) continue;
			const key = volcKey(period.label ?? period.name ?? period.type);
			if (key === void 0) continue;
			push(key, clamp(period.percent), iso(period.reset_at ?? period.resetAt ?? period.resetTime));
		}
	}
	return windows;
}
/** Query Volcano Ark's official control-plane Plan endpoint using AK/SK HMAC. */
async function probeVolcano(options) {
	if (!options.enabled || !options.accessKeyId || !options.secretAccessKey) return [];
	let lastError = "no quota response";
	for (const action of VOLC_ACTIONS) {
		const query = {
			Action: action,
			Version: "2024-01-01"
		};
		try {
			const response = await fetch(`https://${VOLC_HOST}/?${queryString(query)}`, {
				headers: volcHeaders(options.accessKeyId, options.secretAccessKey, query),
				redirect: "manual",
				signal: timeout()
			});
			const body = await response.json().catch(() => void 0);
			if (!response.ok) {
				lastError = `HTTP ${response.status}`;
				continue;
			}
			const windows = volcWindows(body).filter((window) => window.percent !== void 0);
			if (windows.length === 0) {
				lastError = "unrecognized response shape";
				continue;
			}
			return [{
				provider: "volcano:ark-plan",
				displayName: "火山方舟 Coding Plan",
				credential: "env",
				supported: true,
				planSupported: true,
				source: "volcano",
				plan: {
					windows,
					updatedAt: Date.now()
				},
				updatedAt: Date.now()
			}];
		} catch (error) {
			lastError = describeExternalFetchError(error);
		}
	}
	return [{
		provider: "volcano:ark-plan",
		displayName: "火山方舟 Coding Plan",
		credential: "env",
		supported: true,
		planSupported: true,
		source: "volcano",
		planError: lastError,
		updatedAt: Date.now()
	}];
}
//#endregion
//#region src/host/http.ts
/**
* Shared JSON body/response helpers for the host route families: one strict
* bounded body reader, one lenient bounded body reader, one JSON object
* narrow, and one JSON writer. Previously these were copy-pasted across the
* package route files (routes.ts, update-routes.ts, mobile-api.ts, and each
* family's route module) with drifting contracts: body caps ranging 4 KiB to
* 1 MiB and four distinct overflow behaviors (reject, undefined, null, throw).
*
* This file is maintained locally in dsh-usage-plus (the historical
* scripts/sync-shared.mjs shared-source generator is not part of this repo).
* @module dsh-usage-plus/host/http
*/
/** Default body cap for readJsonBody: 64 KiB. */
const DEFAULT_JSON_BODY_MAX_BYTES = 65536;
/** Family-default JSON response headers; callers may append or override. */
const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"referrer-policy": "no-referrer"
};
/**
* Lenient bounded body reader: parse a request body as JSON, or null on an
* empty body, invalid JSON, or a body past maxBytes (default 64 KiB).
* Overflow destroys the request instead of draining the remainder (no drain
* call, matching the current repo-wide behavior); callers must not keep
* reading the request afterwards. With objectOnly, non-JSON-object payloads
* also yield null.
*/
async function readJsonBody(req, opts = {}) {
	const maxBytes = opts.maxBytes ?? DEFAULT_JSON_BODY_MAX_BYTES;
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > maxBytes) {
			req.destroy();
			return null;
		}
		chunks.push(buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (text === "") return null;
	try {
		const parsed = JSON.parse(text);
		if (opts.objectOnly && !isJsonObject(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}
/** Whether a value is a JSON object: typeof object, not null, not an array. */
function isJsonObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Narrow a value to a JSON object, or undefined when it is not one. */
function asJsonObject(value) {
	return isJsonObject(value) ? value : void 0;
}
/**
* Write one JSON response. Default headers are the family defaults
* (content-type and referrer-policy); caller headers are appended or
* override them.
*/
function writeJson(res, status, body, headers = {}) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		...JSON_HEADERS,
		...headers
	});
	res.end(payload);
}
/**
* Write one text response (CSV and other non-JSON bodies) with the family
* defaults; caller headers are appended or override them.
*/
function writeText(res, status, body, headers = {}) {
	res.writeHead(status, {
		...JSON_HEADERS,
		"content-type": "text/plain; charset=utf-8",
		...headers
	});
	res.end(body);
}
/**
* A strong ETag for one JSON document: SHA-1 over the document with its
* volatile fields normalized away, quoted for HTTP. Normalized today:
* - top-level `updatedAt` (assembly instant);
* - `health.probes.lastAttemptAt` / `lastSuccessAt` (probe-cycle instants that
*   move even when the probed facts — and therefore the revision — did not).
* Everything else in `health` (bytes, active days, backfill state, failing
* providers) is data, so a change there still changes the ETag. Documents that
* differ only in the volatile instants share an ETag, so a polling client
* revalidates with `If-None-Match` instead of re-downloading.
*/
function jsonEtag(document) {
	let stable = document;
	if (isJsonObject(document)) {
		stable = Object.hasOwn(document, "updatedAt") ? {
			...document,
			updatedAt: 0
		} : { ...document };
		const health = stable.health;
		if (isJsonObject(health) && isJsonObject(health.probes)) stable.health = {
			...health,
			probes: {
				...health.probes,
				lastAttemptAt: 0,
				lastSuccessAt: 0
			}
		};
	}
	return `"${createHash("sha1").update(JSON.stringify(stable)).digest("base64url")}"`;
}
//#endregion
//#region src/host/backfill.ts
/**
* Historical session backfill: rebuild the usage ledger from prior DSH
* sessions when the plugin starts with an empty ledger (fresh install, data-dir
* loss, or an upgrade from a version that predated the ledger). Reads the
* optional context-wide `ctx.sessionQuery` service — never the persistence
* files directly — and folds `assistant/message` usage exactly like the live
* `session/event` listener: the provider/model come from the preceding
* `request/header` / `request/context` events, and the DeepSeek spend estimate
* is stamped at the event's own timestamp.
*
* The pass is bounded (session and event caps, yields between sessions) and
* never throws; the caller merges the returned temporary ledger, flushes, and
* records the completion state itself.
* @module dsh-usage-plus/host/backfill
*/
/** File (inside the plugin data dir) recording a completed/declined backfill. */
const BACKFILL_STATE_FILE = "backfill.json";
/** Path of the backfill state file for one plugin data directory. */
function backfillStatePath(persistDir) {
	return join(persistDir, BACKFILL_STATE_FILE);
}
/**
* Whether a ledger document holds any usage bucket. An empty day map means a
* fresh install/data loss, which is the only case backfill may run in.
*/
function hasLedgerUsage(document) {
	for (const day of Object.values(document.days)) {
		if (typeof day !== "object" || day === null) continue;
		for (const models of Object.values(day)) {
			if (typeof models !== "object" || models === null) continue;
			if (Object.keys(models).length > 0) return true;
		}
	}
	return false;
}
/**
* First local-date key inside the retention window, matching
* `pruneLedger`'s cutoff: days strictly before it are pruned.
*/
function retentionCutoffKey(nowMs, retainDays) {
	const todayKey = localDateKey(nowMs);
	const cutoff = /* @__PURE__ */ new Date(todayKey + "T00:00:00");
	cutoff.setDate(cutoff.getDate() - retainDays);
	return localDateKey(cutoff.getTime());
}
/** Add every bucket of `source` into `target` in place. */
function mergeLedgerDocuments(target, source) {
	for (const [dayKey, providers] of Object.entries(source.days)) {
		const atMs = (/* @__PURE__ */ new Date(dayKey + "T12:00:00")).getTime();
		for (const [provider, models] of Object.entries(providers)) for (const [model, totals] of Object.entries(models)) foldUsage(target, atMs, provider, model, totals);
	}
}
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finiteNonNegative(value) {
	return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}
/** Normalize one historical provider usage report exactly like the live fold. */
function totalsFromHistoricalUsage(usage, provider, model, atMs) {
	const totals = emptyTotals();
	totals.inputTokens = finiteNonNegative(usage.inputTokens);
	totals.outputTokens = finiteNonNegative(usage.outputTokens);
	totals.cacheReadTokens = finiteNonNegative(usage.cacheReadTokens);
	totals.cacheWriteTokens = finiteNonNegative(usage.cacheWriteTokens);
	totals.reasoningTokens = finiteNonNegative(usage.reasoningTokens);
	totals.calls = 1;
	if (isDeepSeekProviderRoute(provider)) totals.cost = deepseekModelSpend(model, totals, atMs);
	return totals;
}
/** Track one session's provider/model attribution across its event log. */
function replaySession(events, ledger, options, counters) {
	let provider = "";
	let model = "";
	for (const raw of events) {
		if (counters.processed >= options.maxEvents) return false;
		counters.processed += 1;
		if (!isObject(raw)) continue;
		const type = raw.type;
		const time = raw.time;
		if (typeof type !== "string" || typeof time !== "number" || !Number.isFinite(time)) continue;
		const data = raw.data;
		if (type === "request/header") {
			const header = isObject(data) ? data.header : void 0;
			const config = isObject(header) ? header.config : void 0;
			if (isObject(config) && typeof config.provider === "string" && config.provider !== "") {
				provider = config.provider;
				model = typeof config.model === "string" ? config.model : "";
			}
			continue;
		}
		if (type === "request/context") {
			if (isObject(data) && typeof data.provider === "string" && data.provider !== "") {
				provider = data.provider;
				model = typeof data.model === "string" ? data.model : "";
			}
			continue;
		}
		if (type !== "assistant/message" || provider === "") continue;
		if (time >= options.startedAt) continue;
		if (localDateKey(time) < options.cutoffKey) continue;
		const usage = isObject(data) && isObject(data.usage) ? data.usage : void 0;
		if (usage === void 0) continue;
		foldUsage(ledger, time, provider, model || "unknown", totalsFromHistoricalUsage(usage, provider, model || "unknown", time));
		counters.events += 1;
	}
	return true;
}
/**
* Read prior sessions and fold their historical usage into a temporary ledger.
* Never throws: a missing/invalid session list yields `ok: false`, per-session
* read failures are skipped, and all work is bounded by the caps plus a yield
* between session batches.
*/
async function collectBackfill(sessionQuery, options) {
	const cutoffKey = retentionCutoffKey(options.nowMs ?? Date.now(), options.retainDays);
	const maxSessions = Math.max(1, options.maxSessions ?? 500);
	const maxEvents = Math.max(1, options.maxEvents ?? 1e5);
	const yieldEvery = Math.max(1, options.yieldEvery ?? 10);
	const ledger = createLedgerDocument();
	const counters = {
		events: 0,
		processed: 0
	};
	const result = {
		ok: false,
		ledger,
		sessions: 0,
		events: 0,
		processed: 0,
		cutoffKey,
		truncated: false
	};
	let listed;
	try {
		listed = await sessionQuery.listSessions();
	} catch {
		return result;
	}
	if (!Array.isArray(listed)) return {
		...result,
		ok: true
	};
	let sessionsRead = 0;
	for (const candidate of listed) {
		if (options.shouldAbort?.() === true) return result;
		if (sessionsRead >= maxSessions || counters.processed >= maxEvents) {
			result.truncated = true;
			break;
		}
		if (!isObject(candidate)) continue;
		const session = candidate;
		const header = isObject(session.header) ? session.header : void 0;
		const sessionId = typeof session.id === "string" && session.id !== "" ? session.id : header !== void 0 && typeof header.id === "string" ? header.id : "";
		if (sessionId === "") continue;
		const createdAt = header?.createdAt;
		if (typeof createdAt === "number" && Number.isFinite(createdAt) && localDateKey(createdAt) < cutoffKey) break;
		sessionsRead += 1;
		let snapshot;
		try {
			snapshot = await sessionQuery.readSession(sessionId);
		} catch {
			continue;
		}
		if (!isObject(snapshot) || !Array.isArray(snapshot.events)) continue;
		result.sessions += 1;
		if (!replaySession(snapshot.events, ledger, {
			startedAt: options.startedAt,
			cutoffKey,
			maxEvents
		}, counters)) {
			result.truncated = true;
			break;
		}
		if (sessionsRead % yieldEvery === 0) await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	}
	result.ok = options.shouldAbort?.() !== true;
	result.events = counters.events;
	result.processed = counters.processed;
	result.truncated = result.truncated || counters.processed >= maxEvents;
	return result;
}
/** The CSV header line (no quoting needed for these plain field names). */
const EXPORT_CSV_HEADER = [
	"date",
	"provider",
	"model",
	"input_tokens",
	"output_tokens",
	"cache_read_tokens",
	"cache_write_tokens",
	"reasoning_tokens",
	"calls",
	"cost"
].join(",");
/**
* Resolve the `days` query value for export: absent -> 182, integer 1..730 ->
* itself, anything else -> undefined (route answers 400).
*/
function resolveExportDays(value) {
	if (value === void 0 || value === null) return 182;
	const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 730) return void 0;
	return parsed;
}
/** Resolve the `format` query value; undefined means the route answers 400. */
function resolveExportFormat(value) {
	return value === "csv" || value === "json" ? value : void 0;
}
/** Inclusive local-date-key window for the last `days` days ending today. */
function exportWindow(nowMs, days) {
	const safeDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 182;
	const toKey = localDateKey(nowMs);
	const from = /* @__PURE__ */ new Date(toKey + "T00:00:00");
	from.setDate(from.getDate() - (safeDays - 1));
	return {
		fromKey: localDateKey(from.getTime()),
		toKey
	};
}
/** Copy a totals bucket into a plain, complete wire object. */
function copyTotals(totals) {
	return {
		inputTokens: totals.inputTokens,
		outputTokens: totals.outputTokens,
		cacheReadTokens: totals.cacheReadTokens,
		cacheWriteTokens: totals.cacheWriteTokens,
		reasoningTokens: totals.reasoningTokens,
		calls: totals.calls,
		cost: totals.cost
	};
}
/**
* Flatten ledger buckets inside the last `days` local days into export rows,
* sorted by date, then provider, then model. Only ledger aggregates are read:
* no credential, session-content, or provider-secret value can appear here.
*/
function collectExportEntries(ledger, nowMs, days) {
	const { fromKey, toKey } = exportWindow(nowMs, days);
	const entries = [];
	for (const date of Object.keys(ledger.days).sort()) {
		if (date < fromKey || date > toKey) continue;
		const day = ledger.days[date];
		if (typeof day !== "object" || day === null) continue;
		for (const provider of Object.keys(day).sort()) {
			const models = day[provider];
			if (typeof models !== "object" || models === null) continue;
			for (const model of Object.keys(models).sort()) {
				const totals = models[model];
				if (typeof totals !== "object" || totals === null) continue;
				entries.push({
					date,
					provider,
					model,
					totals: copyTotals(totals)
				});
			}
		}
	}
	return entries;
}
/** Build the JSON export document for a ledger snapshot. */
function buildExportDocument(ledger, days, nowMs = Date.now()) {
	const safeDays = resolveExportDays(days) ?? 182;
	return {
		version: 1,
		exportedAt: nowMs,
		days: safeDays,
		entries: collectExportEntries(ledger, nowMs, safeDays)
	};
}
/**
* Quote one CSV field when it contains a comma, quote, CR, or LF (RFC 4180:
* quotes doubled). Numbers render as their shortest decimal form.
*/
function csvField(value) {
	const text = String(value);
	if (!/[",\r\n]/.test(text)) return text;
	return `"${text.replace(/"/g, "\"\"")}"`;
}
/** Serialize export rows as CRLF-terminated CSV with the exact contract header. */
function exportCsv(entries) {
	const lines = [EXPORT_CSV_HEADER];
	for (const entry of entries) {
		const totals = entry.totals;
		lines.push([
			entry.date,
			entry.provider,
			entry.model,
			totals.inputTokens,
			totals.outputTokens,
			totals.cacheReadTokens,
			totals.cacheWriteTokens,
			totals.reasoningTokens,
			totals.calls,
			totals.cost
		].map(csvField).join(","));
	}
	return `${lines.join("\r\n")}\r\n`;
}
/** Attachment filename for one export instant, e.g. `dsh-usage-2026-11-16.csv`. */
function exportFilename(nowMs, extension) {
	return `dsh-usage-${localDateKey(nowMs)}.${extension}`;
}
//#endregion
//#region src/host/usage-service.ts
/**
* The dsh-usage host service: folds live session usage into the persistent
* ledger, probes each configured provider's balance/coding-plan endpoint on
* a poll cycle, and announces the current provider's status to the pet
* bubble. Secrets stay in the host process; the browser only ever sees the
* overview document.
* @module @linxin666/dsh-usage/host/usage-service
*/
/** Source tag the plugin stamps onto pet announcements. */
const USAGE_ANNOUNCE_SOURCE = "dsh-usage-plus";
/** Display-safe label for the plugin data directory (never an absolute home path). */
const DATA_DIR_LABEL = "~/.dsh/dsh-usage-plus";
/** Fallback values for the optional alert options. */
const DEFAULT_ALERT_COOLDOWN_MINUTES = 60;
/** Probe timeout per HTTP call. */
const PROBE_TIMEOUT_MS = 1e4;
/**
* Retry delays for a provider whose probe keeps failing, by consecutive
* failure count and capped at the last entry. Without it a permanently
* invalid credential (a 401) is re-probed every cycle forever. The current
* route is exempt so a transient failure recovers at the normal cadence.
*/
const PROBE_BACKOFF_MS = [
	6e4,
	3e5,
	9e5
];
/** Ledger flush debounce: coalesce a burst of folds into one write. */
const FLUSH_DEBOUNCE_MS = 3e3;
/**
* Minimum gap between two ledger writes. The ledger is a full-document
* rewrite+fsync, so an active session (a fold every few seconds) would
* otherwise rewrite the whole retained document up to ~20×/minute. The
* debounce still applies as the lower bound; this only delays, never drops —
* `stop()` always performs a final flush.
*/
const FLUSH_MIN_INTERVAL_MS = 2e4;
/** The only `days` values the overview route accepts (besides the default). */
const ALLOWED_RANGE_DAYS = [
	7,
	30,
	90,
	182
];
/** How many daily rows the Codex-style heatmap receives (26 weeks). */
const HEATMAP_DAYS = 182;
/** TTL for the provider route list: an llm-registry config scan, not data. */
const ROUTE_CACHE_TTL_MS = 5e3;
/** TTL for the external credential flags: three credential-vault reads. */
const CREDENTIAL_STATUS_TTL_MS = 5e3;
/** Data-health TTL: keeps stat/readdir/backfill reads off every warm poll. */
const HEALTH_CACHE_TTL_MS = 2e3;
const PLATFORM_TTL_MS = 12e4;
/** TTL for configEditor entry snapshots a document read depends on (baseURL). */
const CONFIG_CACHE_TTL_MS = 5e3;
/** How many times one overview assembly retries when a mutation lands mid-await. */
const OVERVIEW_ASSEMBLY_ATTEMPTS = 2;
/** Currency symbols the bubble and section render inline; other codes render as `12.00 EUR`. */
const CURRENCY_SYMBOLS = {
	CNY: "¥",
	USD: "$",
	EUR: "€",
	GBP: "£"
};
/** Format a balance for display: symbol prefix when known, code suffix otherwise. */
function formatMoney(currency, totalBalance) {
	const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()];
	if (symbol !== void 0) return symbol + totalBalance;
	return `${totalBalance} ${currency.toUpperCase()}`;
}
/**
* Delay before the next probe of a provider that just failed that many times
* in a row; 0 (probe normally next cycle) for a provider with no failures.
*/
function probeBackoffDelayMs(failures) {
	if (!Number.isFinite(failures) || failures <= 0) return 0;
	const index = Math.min(Math.floor(failures) - 1, PROBE_BACKOFF_MS.length - 1);
	return PROBE_BACKOFF_MS[index];
}
/**
* Delay before the next debounced ledger flush. The burst debounce is the
* lower bound; a write that started less than the minimum interval ago pushes
* the next one out so the full-document fsync rewrite cannot run continuously
* during an active session. Pure: unit-tested directly, no timer involved.
*/
function nextFlushDelayMs(nowMs, lastFlushAtMs) {
	const floorWait = lastFlushAtMs + FLUSH_MIN_INTERVAL_MS - nowMs;
	return Math.max(FLUSH_DEBOUNCE_MS, Math.min(floorWait, FLUSH_MIN_INTERVAL_MS));
}
/**
* Resolve the overview `days` query value: absent -> 30 (backward compatible),
* one of `ALLOWED_RANGE_DAYS` -> itself, anything else -> undefined (the route
* answers 400). Accepts the raw query string so the route and the service
* share one validation rule.
*/
function resolveRangeDays(value) {
	if (value === void 0 || value === null) return 30;
	const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
	return ALLOWED_RANGE_DAYS.includes(parsed) ? parsed : void 0;
}
/**
* Drop overview rows no surface renders: the wire document otherwise carries
* every catalog provider the runtime knows (40+ empty rows ≈ 6 KiB per poll).
* A row survives when it carries a fact (plan/balance/error), a configured
* credential, a usage total, is the current route, or comes from an external
* source. `supported`-only rows without any of those are pure catalog noise:
* nothing in the browser half reads `supported`/`planSupported`.
*/
function selectOverviewProviders(rows, options) {
	return rows.filter((row) => row.plan !== void 0 || row.balance !== void 0 || row.error !== void 0 || row.credential !== "none" || row.source !== void 0 && row.source !== "model" || options.currentProvider !== void 0 && row.provider === options.currentProvider || options.usageProviders.has(row.provider));
}
/** Map a used percent to the announcement tone. */
function planTone(percent) {
	if (percent >= 90) return "low";
	if (percent >= 70) return "warn";
	return "ok";
}
/**
* Build the raw pet announce payload for one provider snapshot, or
* undefined when nothing worth announcing exists. Pure: every payload this
* returns satisfies the pet's `parseAnnouncement` contract — plan
* announcements require a numeric percent, so percent-less windows never
* announce (the pet validator would silently drop them). A priced family
* (DeepSeek) with spend today announces a cost bubble first; balance-only
* families announce the balance; plan families announce their tightest
* percent window.
*/
function buildAnnouncement(snapshot, context) {
	const todayCost = context?.todayCost ?? 0;
	if (todayCost > 0) {
		const peak = context?.peak ?? false;
		const noteParts = [peak ? "高峰时段 计价×2" : "空闲时段 计价减半", ...snapshot.balance !== void 0 ? [`余额 ${formatMoney(snapshot.balance.currency, snapshot.balance.totalBalance)}`] : []];
		return {
			kind: "cost",
			title: snapshot.displayName,
			amount: `今日 ${formatMoney("CNY", todayCost.toFixed(2))}`,
			...noteParts.length > 0 ? { note: noteParts.join(" · ") } : {},
			tone: peak ? "warn" : "ok"
		};
	}
	if (snapshot.balance !== void 0) return {
		kind: "balance",
		title: snapshot.displayName,
		amount: formatMoney(snapshot.balance.currency, snapshot.balance.totalBalance),
		tone: "ok"
	};
	if (snapshot.plan === void 0) return void 0;
	const window = snapshot.plan.windows.filter((entry) => typeof entry.percent === "number").sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0];
	if (window === void 0 || window.percent === void 0) return void 0;
	return {
		kind: "plan",
		title: snapshot.displayName,
		percent: window.percent,
		...window.resetsAt !== void 0 ? { resetAt: window.resetsAt } : {},
		...snapshot.plan.planName !== void 0 ? { note: snapshot.plan.planName } : {},
		tone: planTone(window.percent)
	};
}
/**
* Compact token-count display for the usage fallback bubble: `9805`,
* `8.7万`, `1.2亿`. The host-authored bubble copy is zh (like every other
* line this service speaks), so the magnitudes follow the zh convention.
*/
function formatTokens(count) {
	const compact = (value) => {
		const rounded = Math.round(value * 10) / 10;
		return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
	};
	if (count >= 1e8) return compact(count / 1e8) + "亿";
	if (count >= 1e4) return compact(count / 1e4) + "万";
	return String(count);
}
/**
* The usage fallback for the session's provider: today's token consumption
* and call count, the one fact the ledger owns for every provider. Providers
* without a readable balance/plan endpoint (relay stations, local runtimes,
* token-plan vendors — and probeable providers whose probes are failing)
* would otherwise leave the pet bubble permanently silent even while their
* sessions run. Undefined when the provider has no usage today: a bubble
* about nothing is noise, not information. Pure; the payload satisfies the
* pet's `parseAnnouncement` contract.
*/
function buildLedgerAnnouncement(input) {
	const total = totalTokens(input.totals);
	if (input.totals.calls <= 0 || total <= 0) return void 0;
	return {
		kind: "cost",
		title: input.displayName,
		amount: `今日 ${formatTokens(total)} tokens`,
		note: `${input.totals.calls} 次调用`,
		tone: "ok"
	};
}
/** Best-effort typed service read: absent services resolve to undefined at runtime. */
function service(ctx, name) {
	try {
		return ctx.get(name);
	} catch {
		return;
	}
}
/**
* Atomic JSON write through a unique temp file + fsync + rename. The temp
* name is per-call so two overlapping flushes can never interleave into one
* temp file, and the fsync closes the rename-lands-but-bytes-are-not-durable
* window.
*/
async function writeJsonAtomic(path, value) {
	const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
	try {
		const handle = await open(temp, "w");
		try {
			await handle.writeFile(JSON.stringify(value, null, 1), "utf8");
			await handle.sync();
		} finally {
			await handle.close();
		}
		await rename(temp, path);
	} catch (error) {
		await unlink(temp).catch(() => {});
		throw error;
	}
}
/** Read a foreign Loader entry's live Config by its stable profile id.
*
* DSH 0.1.7 exposes `settings` as a forms API; it deliberately has no
* `settings.get(namespace)`. ConfigEditor is the host-side read seam for an
* active entry. Its fiber config can contain Volatile refs, so snapshot each
* top-level ref before consumers inspect it.
*/
function isVolatileRef$1(value) {
	return typeof value === "object" && value !== null && typeof value.get === "function";
}
function readEntryConfig(ctx, id) {
	try {
		const raw = service(ctx, "configEditor")?.configuration().find((row) => row.entry.options.id === id)?.entry.fiber?.config;
		if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
		const config = {};
		for (const [key, value] of Object.entries(raw)) config[key] = isVolatileRef$1(value) ? value.get() : value;
		return config;
	} catch {
		return;
	}
}
/**
* Replace one external source only after its complete probe result is ready.
* Never expose an empty CPAMC/Volcano interval to an overlapping browser
* `/overview` poll: a transient fetch failure retains the last known rows;
* an intentional disabled/status result still atomically replaces them.
*/
function replaceExternalSnapshots(snapshots, source, rows) {
	const prefix = `${source}:`;
	for (const id of [...snapshots.keys()]) if (id.startsWith(prefix)) snapshots.delete(id);
	for (const row of rows) snapshots.set(row.provider, row);
}
/** Balance facts equal, ignoring the volatile probe read timestamp. */
function sameBalanceFacts(left, right) {
	if (left === void 0 || right === void 0) return left === right;
	return left.currency === right.currency && left.totalBalance === right.totalBalance;
}
/** Plan facts equal, ignoring the volatile probe read timestamp (plan and windows). */
function samePlanFacts(left, right) {
	if (left === void 0 || right === void 0) return left === right;
	if (left.planName !== right.planName) return false;
	if (left.windows.length !== right.windows.length) return false;
	for (let index = 0; index < left.windows.length; index += 1) {
		const a = left.windows[index];
		const b = right.windows[index];
		if (a === void 0 || b === void 0) return a === b;
		if (a.key !== b.key || a.name !== b.name || a.percent !== b.percent || a.resetsAt !== b.resetsAt) return false;
	}
	return true;
}
/**
* Whether two snapshot states carry the same *facts*. Volatile probe read
* timestamps (`updatedAt` on the row, balance, and plan) are ignored: a
* provider that keeps returning identical facts must not rewrite the snapshot
* map, the persisted snapshots file, or the overview revision/ETag every
* poll. Extend this when a new wire fact is added to `ProviderSnapshotState`.
*/
function providerSnapshotFactsEqual(left, right) {
	return left.provider === right.provider && left.displayName === right.displayName && left.credential === right.credential && left.supported === right.supported && left.balanceSupported === right.balanceSupported && left.planSupported === right.planSupported && left.source === right.source && left.error === right.error && left.balanceError === right.balanceError && left.planError === right.planError && sameBalanceFacts(left.balance, right.balance) && samePlanFacts(left.plan, right.plan);
}
/** Structural equality for two configEditor entry snapshots (plain JSON data). */
function configsEqual(left, right) {
	if (left === right) return true;
	try {
		return JSON.stringify(left) === JSON.stringify(right);
	} catch {
		return false;
	}
}
/** Whether two provider route snapshots are identical, order included. */
function sameRoutes(left, right) {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		const a = left[index];
		const b = right[index];
		if (a.id !== b.id || a.displayName !== b.displayName) return false;
	}
	return true;
}
/**
* Non-volatile health signature: the health payload with the probe instants
* zeroed, so a changed data fact (bytes, corrupt files, backfill state,
* failing set) invalidates the cached document/ETag while a probe cycle alone
* does not.
*/
function healthCacheKey(health) {
	return JSON.stringify({
		...health,
		probes: {
			...health.probes,
			lastAttemptAt: null,
			lastSuccessAt: null
		}
	});
}
var UsageService = class {
	ctx;
	options;
	persistDir;
	ledgerPath;
	snapshotsPath;
	ledger = createLedgerDocument();
	snapshots = /* @__PURE__ */ new Map();
	/** Per-live-session route attribution (WeakMap: disposed sessions age out). */
	sessionRoutes = /* @__PURE__ */ new WeakMap();
	/** The most recent route seen this boot; the pet bubble follows it. */
	current = { source: "default" };
	sessionListenerDisposer;
	pollTimer;
	flushTimer;
	pollInFlight = false;
	/** The running poll cycle; manual refresh joins it instead of no-oping. */
	pollPromise;
	/** Serialized ledger flushes: overlapping debounce/stop flushes queue, never interleave. */
	flushChain = Promise.resolve();
	/** True once loadPersisted finished; nothing may overwrite the files before that. */
	loaded = false;
	disposed = false;
	lastSignature;
	/** Last prune guard: once per local day, and whenever retention shrinks. */
	lastPrune;
	/** Consecutive probe failures per provider; drives the retry backoff. */
	probeBackoff = /* @__PURE__ */ new Map();
	/** Last snapshots document written; an unchanged document is not rewritten. */
	lastPersistedSnapshots;
	/** Start instant of the last ledger write attempt; enforces the flush floor. */
	lastFlushAt = 0;
	/**
	* Bumped on every document-visible mutation: ledger fold, persisted merge,
	* prune, settings/retention change, composer/current change, probe result,
	* or a route/config/credential-flag change. The derived overview document
	* is served from cache until this moves.
	*/
	revision = 0;
	/** Bumped only by ledger mutations; the usage windows aggregate from it. */
	ledgerRevision = 0;
	/**
	* Derived overview documents, one per accepted range window, keyed by
	* `revision|dayKey`. Different `?days=` variants do not thrash each other;
	* a revision/day rollover replaces the whole map.
	*/
	overviewCache;
	/**
	* Aggregated usage windows, one per accepted range window, keyed by
	* `ledgerRevision|retainDays|dayKey`. The today/heatmap/all-time windows are
	* range-independent but cheap to rebuild per variant once per revision.
	*/
	usageCache;
	/** Provider route list TTL cache (the llm registry is a config scan). */
	routesCache;
	/** configEditor entry snapshots a document read depends on; TTL-cached. */
	entryConfigCache = /* @__PURE__ */ new Map();
	/** External credential-status TTL cache: three vault reads per assembly otherwise. */
	credentialStatusCache;
	/** Last credential flags observed before a cache invalidation; drives invalidation. */
	lastCredentialStatus;
	/** Dedupes overlapping credential-status reads. */
	credentialStatusInFlight;
	/** Invalidates in-flight credential-status reads that predate a credential write. */
	credentialStatusGeneration = 0;
	/** Short-TTL data-health cache: health costs filesystem reads, not per-poll work. */
	healthCache;
	/** Alert episodes: `kind:provider:window` → epoch ms the current episode started. */
	alertEpisodes = /* @__PURE__ */ new Map();
	/** Last pet bubble instant per alert key; enforces the configured cooldown. */
	alertBubbleAt = /* @__PURE__ */ new Map();
	/** Last probe attempt instant (any provider), surfaced in `health.probes`. */
	probeAttemptAt = null;
	/** Last successful probe instant, surfaced in `health.probes`. */
	probeSuccessAt = null;
	/** Official DeepSeek platform facts (best-effort, network-backed). */
	platformView;
	/** Signature of the last platform payload, so polls only bump on real change. */
	platformSignature;
	platformFetchedAt = 0;
	platformInFlight;
	/** models.dev catalog used for USD reference estimates. */
	priceBook;
	priceBookFetchedAt = 0;
	priceBookInFlight;
	/**
	* @param ctx - host context.
	* @param options - resolved plugin options.
	* @param persistDir - ledger/snapshot directory override (tests only; the
	*   live service always uses the DSH home). Kept as a narrow seam so
	*   persistence tests never write into the user's real data directory.
	*/
	constructor(ctx, options, persistDir = join(dshHome(), "dsh-usage-plus")) {
		this.ctx = ctx;
		this.options = options;
		this.persistDir = persistDir;
		this.ledgerPath = join(this.persistDir, "usage-ledger.json");
		this.snapshotsPath = join(this.persistDir, "provider-snapshots.json");
	}
	/** Start the listeners, load persisted state, and arm the first poll. */
	start() {
		const startedAt = Date.now();
		this.sessionListenerDisposer = this.ctx.on("session/event", (session, event) => this.onSessionEvent(session, event));
		this.loadPersisted().then(() => this.maybeBackfill(startedAt)).catch(() => {});
		this.rearmPoll(2e3);
		this.refreshPlatformTruth();
		this.refreshPriceBook();
	}
	/**
	* Stop timers and flush pending ledger writes. The returned promise
	* resolves after the final flush lands, so a successor instance (quick
	* disable → enable) can serialize its first load behind it.
	*/
	stop() {
		this.disposed = true;
		if (this.pollTimer !== void 0) clearTimeout(this.pollTimer);
		if (this.flushTimer !== void 0) clearTimeout(this.flushTimer);
		this.sessionListenerDisposer?.();
		this.overviewCache = void 0;
		this.usageCache = void 0;
		this.routesCache = void 0;
		this.entryConfigCache.clear();
		this.credentialStatusCache = void 0;
		this.healthCache = void 0;
		this.alertEpisodes.clear();
		this.alertBubbleAt.clear();
		this.platformView = void 0;
		this.platformSignature = void 0;
		this.platformInFlight = void 0;
		this.priceBook = void 0;
		this.priceBookInFlight = void 0;
		return this.flushLedger();
	}
	/** Re-apply options live (settings change); retention shrink prunes now. */
	applyOptions(options) {
		this.options = options;
		this.bumpRevision();
		this.invalidateCredentialStatus();
		this.healthCache = void 0;
		this.pruneIfNeeded();
	}
	/** Force one poll now (manual refresh route); joins an in-flight cycle. */
	async refresh() {
		await this.pollNow();
	}
	/**
	* Probe one external source now and report a structured, secret-free result
	* for the Settings "test connection" button. Never throws: transport errors
	* and configuration mistakes both come back as `ok: false` plus a hint.
	*/
	async testExternalSource(target) {
		const started = Date.now();
		try {
			if (target === "cpamc") {
				const rows = await probeCpamc({
					enabled: this.options.cpamcEnabled,
					baseURL: this.options.cpamcBaseURL,
					managementKey: await this.resolveEnv(this.options.cpamcManagementKeyEnv),
					allowedHosts: this.options.cpamcAllowedHosts
				});
				const latencyMs = Date.now() - started;
				if (rows.length === 0) return {
					target,
					ok: false,
					latencyMs,
					error: "CPAMC 未启用",
					hint: "先在下方勾选“启用 CPAMC 独立额度源”并保存，再测试。"
				};
				const first = rows[0];
				const error = first?.planError ?? first?.error;
				if (error !== void 0) return {
					target,
					ok: false,
					latencyMs,
					error,
					hint: this.cpamcTestHint(error)
				};
				return {
					target,
					ok: true,
					latencyMs,
					accounts: rows.length,
					windows: first?.plan?.windows.slice(0, 3) ?? []
				};
			}
			const rows = await probeVolcano({
				enabled: this.options.volcanoEnabled,
				accessKeyId: await this.resolveEnv(this.options.volcanoAccessKeyEnv),
				secretAccessKey: await this.resolveEnv(this.options.volcanoSecretKeyEnv)
			});
			const latencyMs = Date.now() - started;
			if (rows.length === 0) return {
				target,
				ok: false,
				latencyMs,
				error: "火山方舟未启用或未配置 AK/SK",
				hint: "启用火山方舟额度源并保存 AK/SK 后再测试。"
			};
			const first = rows[0];
			const error = first?.planError ?? first?.error;
			if (error !== void 0) return {
				target,
				ok: false,
				latencyMs,
				error,
				hint: this.volcanoTestHint(error)
			};
			return {
				target,
				ok: true,
				latencyMs,
				windows: first?.plan?.windows.slice(0, 3) ?? []
			};
		} catch (error) {
			return {
				target,
				ok: false,
				latencyMs: Date.now() - started,
				error: error instanceof Error ? error.message : String(error),
				hint: "检查外部额度源的地址、凭据与网络连通性。"
			};
		}
	}
	/** Actionable CPAMC hint for one probe failure message. */
	cpamcTestHint(error) {
		const text = error.toLowerCase();
		if (text.includes("missing management token")) return "填写 CPAMC Management Token（CPAMC 配置里的 management key），或设置环境变量 CPAMC_MANAGEMENT_KEY。";
		if (text.includes("url must be")) return "管理地址只填 origin（协议 + 主机 + 端口，不含 / 路径）；远程主机还必须加入“CPAMC 允许的 host”。";
		if (text.includes("401") || text.includes("403")) return "Management Token 不正确，或 CPAMC 没有开启 management key。";
		if (text.includes("no quota accounts")) return "CPAMC 已连通，但其中没有可读取配额接口的 codex / kimi / claude 账号（auth files）。";
		if (text.includes("econnrefused") || text.includes("enotfound") || text.includes("eai_again") || text.includes("timed out") || text.includes("fetch failed") || text.includes("cert")) {
			const allowed = String(this.options.cpamcAllowedHosts ?? "").split(",").map((host) => host.trim()).filter((host) => host !== "");
			return `无法连接 CPAMC：检查服务是否启动、管理地址是否只填 origin。${/^https?:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(?::\d+)?\/?$/i.test(this.options.cpamcBaseURL) && allowed.length > 0 ? `当前管理地址是回环地址但本机端口未监听；若 CPAMC 部署在 ${allowed[0]}，请把管理地址改为 https://${allowed[0]}。` : ""}`;
		}
		return "检查 CPAMC 管理地址、允许 host 与 management token。";
	}
	/** Actionable Volcano hint for one probe failure message. */
	volcanoTestHint(error) {
		const text = error.toLowerCase();
		if (text.includes("401") || text.includes("403")) return "AK/SK 不正确，或该密钥没有方舟控制面读取权限。";
		if (text.includes("econnrefused") || text.includes("enotfound") || text.includes("timed out") || text.includes("fetch failed")) return "无法连接火山方舟 OpenAPI，检查本机网络与代理设置。";
		return "检查 VOLC_ACCESSKEY / VOLC_SECRETKEY 是否完整、是否开通 Coding Plan。";
	}
	dayDetail(date) {
		const totals = emptyTotals();
		const providers = [];
		const day = this.ledger.days[date];
		if (day !== void 0) {
			for (const [provider, models] of Object.entries(day)) {
				const providerTotals = emptyTotals();
				const modelRows = [];
				for (const [model, modelTotals] of Object.entries(models)) {
					addTotals(providerTotals, modelTotals);
					modelRows.push({
						model,
						totals: modelTotals
					});
				}
				modelRows.sort((left, right) => totalTokens(right.totals) - totalTokens(left.totals));
				providers.push({
					provider,
					totals: providerTotals,
					models: modelRows
				});
				addTotals(totals, providerTotals);
			}
			providers.sort((left, right) => totalTokens(right.totals) - totalTokens(left.totals));
		}
		return {
			date,
			totals,
			providers
		};
	}
	/**
	* Refresh the official platform facts in the background. Network-backed and
	* fully best-effort: failure keeps the previous view (or none) and never
	* blocks a poll cycle.
	*/
	refreshPlatformTruth() {
		if (this.disposed || this.options.platformUsageEnabled !== true || this.platformInFlight !== void 0) return;
		if (Date.now() - this.platformFetchedAt < PLATFORM_TTL_MS) return;
		const fetcher = this.options.platformFetcher ?? ((ctx) => fetchPlatformUsage(ctx));
		this.platformInFlight = Promise.resolve().then(() => fetcher(this.ctx)).then((view) => {
			if (this.disposed) return;
			this.platformFetchedAt = Date.now();
			this.platformView = view;
			const signature = JSON.stringify({
				...view,
				updatedAt: 0
			});
			if (signature !== this.platformSignature) {
				this.platformSignature = signature;
				this.bumpRevision();
			}
		}).catch(() => {}).finally(() => {
			this.platformInFlight = void 0;
		});
	}
	/**
	* Load the cached models.dev price book and refresh it when stale. The fetch
	* is background-only so a slow catalog never delays a poll.
	*/
	refreshPriceBook() {
		if (this.disposed || this.options.costEstimateEnabled !== true || this.priceBookInFlight !== void 0) return;
		const fetcher = this.options.priceBookFetcher ?? (() => fetchPriceBook());
		this.priceBookInFlight = (async () => {
			if (this.priceBook === void 0) {
				if (this.options.priceBook !== void 0) {
					this.priceBook = this.options.priceBook;
					this.priceBookFetchedAt = this.options.priceBook.fetchedAt;
				} else {
					const loaded = await loadPriceBook(this.persistDir);
					if (this.disposed) return;
					if (loaded !== void 0) {
						this.priceBook = loaded;
						this.priceBookFetchedAt = loaded.fetchedAt;
						this.bumpRevision();
					}
				}
			}
			if (this.priceBook !== void 0 && isPriceBookFresh(this.priceBook)) return;
			const fetched = await fetcher();
			if (this.disposed || fetched === void 0) return;
			this.priceBook = fetched;
			this.priceBookFetchedAt = fetched.fetchedAt;
			this.bumpRevision();
			savePriceBook(this.persistDir, fetched);
		})().catch(() => {}).finally(() => {
			this.priceBookInFlight = void 0;
		});
	}
	/**
	* Attach the local-side compare facts to the official platform view: the
	* DeepSeek-only month cost from our ledger, coverage of official active days,
	* and the signed delta. Currencies stay CNY on both sides.
	*/
	enrichPlatformView(view) {
		const month = localDateKey(Date.now()).slice(0, 7);
		let localMonthCost = 0;
		const coveredDays = /* @__PURE__ */ new Set();
		for (const [date, dayProviders] of Object.entries(this.ledger.days)) {
			if (!date.startsWith(month)) continue;
			for (const [provider, models] of Object.entries(dayProviders)) {
				if (!isDeepSeekProviderRoute(provider)) continue;
				for (const totals of Object.values(models)) {
					localMonthCost += totals.cost;
					if (totals.calls > 0 || totalTokens(totals) > 0) coveredDays.add(date);
				}
			}
		}
		const officialDays = (view.days ?? []).filter((day) => day.cost > 0);
		const coverage = officialDays.length === 0 ? void 0 : officialDays.filter((day) => coveredDays.has(day.date)).length / officialDays.length;
		const enriched = {
			...view,
			localMonthCost: Math.round(localMonthCost * 100) / 100
		};
		if (coverage !== void 0) enriched.coverage = Math.round(coverage * 1e3) / 1e3;
		if (view.monthCost !== void 0) enriched.delta = Math.round((view.monthCost - localMonthCost) * 100) / 100;
		return enriched;
	}
	/**
	* Assemble the overview document the browser section renders.
	* @param days - trend window (one of `ALLOWED_RANGE_DAYS`); default 30.
	*/
	async overview(days) {
		return (await this.overviewPayload(days)).document;
	}
	/**
	* The overview document plus its strong ETag for one range window. A warm
	* request (same data revision and same window) answers from the derived
	* cache: no ledger re-summarization, no provider rebuild, and no SHA-1 over
	* the JSON — the GET route only needs the cached validator to answer 304.
	* `updatedAt` moves with each read but stays out of the ETag.
	*/
	async overviewPayload(days) {
		const rangeDays = resolveRangeDays(days) ?? 30;
		this.syncCurrentFromComposer();
		this.listProviderRoutes();
		if (this.current.provider !== void 0) this.piAiProfile(this.current.provider);
		for (let attempt = 0; attempt < OVERVIEW_ASSEMBLY_ATTEMPTS; attempt += 1) {
			const revision = this.revision;
			const dayKey = localDateKey(Date.now());
			const externalCredentials = await this.externalCredentialStatus();
			const health = await this.currentHealth();
			if (this.revision !== revision || localDateKey(Date.now()) !== dayKey) continue;
			const base = `${revision}|${dayKey}`;
			if (this.overviewCache?.base !== base) this.overviewCache = {
				base,
				documents: /* @__PURE__ */ new Map()
			};
			const healthSignature = healthCacheKey(health);
			const cached = this.overviewCache.documents.get(rangeDays);
			if (cached !== void 0 && cached.healthSignature === healthSignature) {
				cached.document.updatedAt = Date.now();
				cached.document.health = health;
				return {
					document: cached.document,
					etag: cached.etag
				};
			}
			const document = this.assembleOverview(this.usageSummary(rangeDays), externalCredentials, health);
			const etag = jsonEtag(document);
			if (this.revision === revision && this.overviewCache?.base === base) this.overviewCache.documents.set(rangeDays, {
				document,
				etag,
				healthSignature
			});
			return {
				document,
				etag
			};
		}
		const document = this.assembleOverview(this.usageSummary(rangeDays), await this.externalCredentialStatus(), await this.currentHealth());
		return {
			document,
			etag: jsonEtag(document)
		};
	}
	/**
	* The aggregate ledger export document for the last `days` local days
	* (1..730, default 182). Transport-free so the export route stays a thin
	* HTTP wrapper; the payload is ledger aggregates only — no secrets.
	*/
	exportLedger(days) {
		return buildExportDocument(this.ledger, days, Date.now());
	}
	/**
	* Build the wire document from an already-aggregated usage summary. Rows
	* and the provider keep-set (the exact ids the trend/today cards look up)
	* are computed once per revision. The returned `providers` array is freshly
	* sorted, so it never aliases the cached route list.
	*/
	assembleOverview(usage, externalCredentials, health) {
		const routes = this.listProviderRoutes();
		const rows = [];
		for (const route of routes) {
			const adapter = adapterFor(route.id);
			const snapshot = this.snapshots.get(route.id);
			const error = snapshot?.balanceError ?? snapshot?.planError;
			const credentialKind = snapshot?.credential ?? "none";
			const balanceSupported = adapter?.balance !== void 0 && probeHalfAllowed(adapter.balance.credential, credentialKind);
			const planSupported = adapter?.plan !== void 0 && probeHalfAllowed(adapter.plan.credential, credentialKind);
			rows.push({
				provider: route.id,
				source: "model",
				displayName: route.displayName || adapter?.displayName || route.id,
				credential: snapshot?.credential ?? "none",
				supported: balanceSupported || planSupported,
				...balanceSupported ? { balanceSupported: true } : {},
				...planSupported ? { planSupported: true } : {},
				...snapshot?.balance !== void 0 ? { balance: snapshot.balance } : {},
				...snapshot?.plan !== void 0 ? { plan: snapshot.plan } : {},
				...error !== void 0 ? { error } : {},
				...snapshot?.updatedAt !== void 0 ? { updatedAt: snapshot.updatedAt } : {}
			});
		}
		for (const snapshot of this.snapshots.values()) {
			if (snapshot.source !== "cpamc" && snapshot.source !== "volcano" && snapshot.source !== "custom") continue;
			const error = snapshot.balanceError ?? snapshot.planError;
			rows.push({
				...snapshot,
				...error !== void 0 ? { error } : {}
			});
		}
		const providers = selectOverviewProviders(rows, {
			usageProviders: usage.usageProviders,
			currentProvider: this.current.provider
		});
		providers.sort((a, b) => Number(b.supported) - Number(a.supported) || a.displayName.localeCompare(b.displayName));
		let alerts = [];
		try {
			const evaluation = evaluateAlerts({
				todayCost: usage.today.totals.cost,
				providers
			}, {
				alertsEnabled: this.options.alertsEnabled ?? true,
				dailyCostLimitCny: this.options.dailyCostLimitCny ?? 0,
				planAlertPercent: this.options.planAlertPercent ?? 0,
				balanceAlertCny: this.options.balanceAlertCny ?? 0
			}, this.alertEpisodes, Date.now());
			alerts = evaluation.alerts;
			for (const started of evaluation.started) this.announceAlert(started);
		} catch {
			alerts = [];
		}
		const baseURL = this.current.provider !== void 0 ? this.piAiProfile(this.current.provider)?.baseURL : void 0;
		const platform = this.platformView === void 0 ? void 0 : this.enrichPlatformView(this.platformView);
		const costEstimate = this.options.costEstimateEnabled === true && this.priceBook !== void 0 ? estimateUsd(usage.range, this.priceBook) : void 0;
		return {
			updatedAt: Date.now(),
			providers,
			alerts,
			health,
			...platform !== void 0 ? { platform } : {},
			...costEstimate !== void 0 ? { costEstimate } : {},
			current: {
				...this.current,
				...typeof baseURL === "string" && baseURL.trim() !== "" ? { baseURL: baseURL.trim() } : {}
			},
			externalCredentials,
			usage: {
				today: usage.today,
				days: usage.days,
				range: usage.range,
				all: usage.all
			}
		};
	}
	/**
	* Aggregate the usage windows for the current ledger revision, local day,
	* and range window. One pass over the retained ledger per revision/window;
	* warm polls (and the pet bubble's today lookup) reuse it.
	*/
	usageSummary(rangeDays = 30) {
		const ledgerRevision = this.ledgerRevision;
		const dayKey = localDateKey(Date.now());
		const retainDays = this.options.retainDays;
		const base = `${ledgerRevision}|${retainDays}|${dayKey}`;
		if (this.usageCache?.base !== base) this.usageCache = {
			base,
			summaries: /* @__PURE__ */ new Map()
		};
		const cached = this.usageCache.summaries.get(rangeDays);
		if (cached !== void 0) return cached;
		const usage = summarizeLedgerUsage(this.ledger, {
			todayKey: dayKey,
			heatmapDays: Math.min(HEATMAP_DAYS, retainDays),
			rangeDays
		});
		this.usageCache.summaries.set(rangeDays, usage);
		return usage;
	}
	/**
	* Data health. Filesystem-derived facts (ledger bytes, corrupt files,
	* backfill state) sit behind a short TTL so a warm overview poll performs no
	* I/O; the in-memory probe instants are cheap and refreshed on every read.
	*/
	async currentHealth() {
		const now = Date.now();
		const ttl = this.options.healthCacheTtlMs ?? HEALTH_CACHE_TTL_MS;
		let cached = this.healthCache;
		if (cached === void 0 || now - cached.at >= ttl) {
			cached = {
				at: Date.now(),
				value: await this.buildHealthFacts()
			};
			this.healthCache = cached;
		}
		const failing = [];
		for (const [id, snapshot] of this.snapshots) if (snapshot.balanceError !== void 0 || snapshot.planError !== void 0) failing.push(id);
		failing.sort();
		return {
			...cached.value,
			probes: {
				lastAttemptAt: this.probeAttemptAt,
				lastSuccessAt: this.probeSuccessAt,
				failing
			}
		};
	}
	/**
	* Filesystem/ledger facts for `currentHealth`: storage stats and backfill
	* state. Never throws: each file read is individually guarded. The volatile
	* probe instants are normalized out of the ETag (see `jsonEtag`).
	*/
	async buildHealthFacts() {
		try {
			let bytes = 0;
			try {
				bytes = (await stat(this.ledgerPath)).size;
			} catch {
				bytes = 0;
			}
			let corruptFiles = [];
			try {
				corruptFiles = (await readdir(this.persistDir)).filter((name) => name.startsWith("usage-ledger.json.corrupt-")).sort();
			} catch {
				corruptFiles = [];
			}
			const activeDays = [];
			for (const dayKey of ledgerDayKeys(this.ledger)) {
				const day = this.ledger.days[dayKey];
				if (day === void 0) continue;
				for (const models of Object.values(day)) if (typeof models === "object" && models !== null && Object.keys(models).length > 0) {
					activeDays.push(dayKey);
					break;
				}
			}
			const state = await this.readBackfillState();
			return {
				storage: {
					label: DATA_DIR_LABEL,
					bytes,
					activeDays: activeDays.length,
					firstDay: activeDays[0] ?? null,
					lastDay: activeDays[activeDays.length - 1] ?? null,
					retentionDays: this.options.retainDays,
					corruptFiles
				},
				backfill: state === void 0 ? null : {
					completedAt: state.completedAt,
					cutoff: state.cutoff,
					sessions: state.sessions,
					events: state.events,
					...state.truncated === true ? { truncated: true } : {}
				}
			};
		} catch {
			return {
				storage: {
					label: DATA_DIR_LABEL,
					bytes: 0,
					activeDays: 0,
					firstDay: null,
					lastDay: null,
					retentionDays: this.options.retainDays,
					corruptFiles: []
				},
				backfill: null
			};
		}
	}
	/**
	* Bubble one newly-started alert to the pet. Honors the bubble off switch,
	* the alert master switch, and the per-key cooldown; active alerts still
	* appear in the overview payload regardless of whether the bubble is
	* suppressed. Fully guarded: a missing/failing pet never breaks the overview.
	*/
	announceAlert(alert) {
		if (this.disposed || this.options.bubbleMode === "off") return;
		if ((this.options.alertsEnabled ?? true) === false) return;
		const now = Date.now();
		const cooldownMinutes = Math.max(0, this.options.alertCooldownMinutes ?? DEFAULT_ALERT_COOLDOWN_MINUTES);
		const last = this.alertBubbleAt.get(alertKey(alert.kind, alert.provider, alert.window));
		if (last !== void 0 && now - last < cooldownMinutes * 6e4) return;
		try {
			const pet = service(this.ctx, "pet");
			if (pet === void 0) return;
			const title = alert.provider !== void 0 ? this.routeDisplayName(alert.provider) : "dsh-usage-plus";
			const payload = alert.kind === "plan-threshold" ? {
				kind: "plan",
				title,
				percent: alert.value,
				tone: alert.severity === "critical" ? "low" : "warn"
			} : {
				kind: "cost",
				title,
				amount: alert.message,
				tone: alert.severity === "critical" ? "warn" : "ok"
			};
			const ttlMs = Math.min(72e5, this.options.pollIntervalSec * 2e3 + 3e4);
			this.alertBubbleAt.set(alertKey(alert.kind, alert.provider, alert.window), now);
			pet.announce({
				source: USAGE_ANNOUNCE_SOURCE,
				ttlMs,
				...payload
			});
		} catch {}
	}
	/** Mark a document-visible mutation: the next overview read rebuilds. */
	bumpRevision() {
		this.revision += 1;
	}
	/** Mark a ledger mutation: both the document and the usage windows rebuild. */
	bumpLedgerRevision() {
		this.ledgerRevision += 1;
		this.revision += 1;
	}
	/** Adopt a new current route, bumping the revision only when it changed. */
	setCurrent(next) {
		if (this.current.provider === next.provider && this.current.model === next.model && this.current.source === next.source) return;
		this.current = next;
		this.bumpRevision();
	}
	/**
	* Write-only: store one external secret in the DSH credential vault under
	* the configured env-var name. Never returns the value.
	*/
	async setExternalCredential(target, value) {
		const trimmed = value.trim();
		if (trimmed === "") return {
			ok: false,
			error: "empty credential"
		};
		let name;
		try {
			name = this.externalCredentialEnv(target);
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "invalid target"
			};
		}
		const credentials = service(this.ctx, "credentials");
		if (credentials === void 0) return {
			ok: false,
			error: "credential store unavailable"
		};
		try {
			await credentials.set(credentialRef(name), trimmed);
			this.invalidateCredentialStatus();
			this.bumpRevision();
			return { ok: true };
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "credential write failed"
			};
		}
	}
	/** Remove one external secret from the DSH credential vault. */
	async clearExternalCredential(target) {
		let name;
		try {
			name = this.externalCredentialEnv(target);
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "invalid target"
			};
		}
		const credentials = service(this.ctx, "credentials");
		if (credentials === void 0) return {
			ok: false,
			error: "credential store unavailable"
		};
		try {
			await credentials.unset(credentialRef(name));
			this.invalidateCredentialStatus();
			this.bumpRevision();
			return { ok: true };
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "credential clear failed"
			};
		}
	}
	/**
	* Configured/missing flags only — never the secret values. Short-TTL cached:
	* the document renders them and a 10s poll must not read the vault three
	* times per request. A changed flag bumps the revision so the next overview
	* rebuilds; credential writes and settings changes invalidate explicitly.
	*/
	async externalCredentialStatus() {
		const now = Date.now();
		const cached = this.credentialStatusCache;
		if (cached !== void 0 && now - cached.at < CREDENTIAL_STATUS_TTL_MS) return cached.value;
		if (this.credentialStatusInFlight !== void 0) return this.credentialStatusInFlight;
		const generation = this.credentialStatusGeneration;
		let pending;
		pending = this.readExternalCredentialStatus().then((value) => {
			if (generation === this.credentialStatusGeneration) {
				const previous = this.lastCredentialStatus;
				this.credentialStatusCache = {
					at: Date.now(),
					value
				};
				this.lastCredentialStatus = value;
				if (previous !== void 0 && (previous.cpamc !== value.cpamc || previous.volcanoAk !== value.volcanoAk || previous.volcanoSk !== value.volcanoSk)) this.bumpRevision();
			}
			return value;
		}).finally(() => {
			if (this.credentialStatusInFlight === pending) this.credentialStatusInFlight = void 0;
		});
		this.credentialStatusInFlight = pending;
		return pending;
	}
	/** Drop the cached flags after a credential write or env-name change. */
	invalidateCredentialStatus() {
		this.credentialStatusGeneration += 1;
		this.credentialStatusCache = void 0;
		this.credentialStatusInFlight = void 0;
	}
	/** The live (uncached) credential-status read: three vault describes. */
	async readExternalCredentialStatus() {
		return {
			cpamc: await this.isEnvConfigured(this.options.cpamcManagementKeyEnv),
			volcanoAk: await this.isEnvConfigured(this.options.volcanoAccessKeyEnv),
			volcanoSk: await this.isEnvConfigured(this.options.volcanoSecretKeyEnv)
		};
	}
	externalCredentialEnv(target) {
		if (target === "cpamc") return this.options.cpamcManagementKeyEnv;
		if (target === "volcano.ak") return this.options.volcanoAccessKeyEnv;
		if (target === "volcano.sk") return this.options.volcanoSecretKeyEnv;
		throw new Error("unknown credential target");
	}
	async isEnvConfigured(name) {
		const credentials = service(this.ctx, "credentials");
		try {
			if ((await credentials?.describe(credentialRef(name)))?.configured === true) return true;
		} catch {}
		const value = process.env[name];
		return typeof value === "string" && value.trim() !== "";
	}
	/** Today's ledger spend for one provider's adapter family (0 when unpriced). */
	familyCostToday(provider) {
		const family = adapterFor(provider);
		if (family === void 0) return 0;
		let cost = 0;
		for (const row of this.usageSummary().today.providers) if (adapterFor(row.provider) === family) cost += row.totals.cost;
		return cost;
	}
	/** Today's ledger totals for one provider route (the exact id, not the family). */
	providerUsageToday(provider) {
		return this.usageSummary().today.providers.find((entry) => entry.provider === provider)?.totals ?? emptyTotals();
	}
	/**
	* The display name for a route key: the LLM runtime's first, then the
	* adapter's, then the id itself — the snapshot may not exist for
	* adapter-less routes, yet the bubble still needs a legible title.
	*/
	routeDisplayName(provider) {
		return this.listProviderRoutes().find((entry) => entry.id === provider)?.displayName || adapterFor(provider)?.displayName || provider;
	}
	onSessionEvent(session, event) {
		try {
			if (event.type === "request/header") {
				const config = event.data.header?.config;
				if (config?.provider !== void 0) {
					this.sessionRoutes.set(session, {
						provider: config.provider,
						model: config.model ?? ""
					});
					this.setCurrent({
						provider: config.provider,
						model: config.model,
						source: "live"
					});
				}
			} else if (event.type === "request/context") {
				const data = event.data;
				if (data.provider !== void 0) {
					this.sessionRoutes.set(session, {
						provider: data.provider,
						model: data.model ?? ""
					});
					this.setCurrent({
						provider: data.provider,
						model: data.model,
						source: "live"
					});
				}
			} else if (event.type === "assistant/message") {
				const usage = event.data.usage;
				if (usage === void 0) return;
				const route = this.sessionRoutes.get(session);
				if (route === void 0 || route.provider === "") return;
				const now = Date.now();
				foldUsage(this.ledger, now, route.provider, route.model || "unknown", this.totalsFrom(usage, route.provider, route.model || "unknown", now));
				this.bumpLedgerRevision();
				this.scheduleFlush();
			}
		} catch {}
	}
	/**
	* Follow the composer model selector (`agent-default-model`). The strip
	* must update as soon as the user picks another provider/model, not only
	* when the next request/header event lands.
	*/
	syncCurrentFromComposer() {
		const selected = service(this.ctx, "agentDefaultModel")?.currentSelection() ?? readEntryConfig(this.ctx, "agent-default-model");
		if (selected?.provider === void 0 || selected.provider === "") return;
		if (this.current.provider === selected.provider && this.current.model === selected.model) return;
		this.setCurrent({
			provider: selected.provider,
			model: selected.model,
			source: "default"
		});
	}
	/**
	* Normalize a provider TokenUsage into the ledger bucket (one call). The
	* DeepSeek official family is priced at the fold instant (its billing
	* period is time-of-day); other families stay unpriced (cost 0).
	*/
	totalsFrom(usage, provider, model, atMs) {
		const totals = emptyTotals();
		totals.inputTokens = usage.inputTokens;
		totals.outputTokens = usage.outputTokens;
		totals.cacheReadTokens = usage.cacheReadTokens ?? 0;
		totals.cacheWriteTokens = usage.cacheWriteTokens ?? 0;
		totals.reasoningTokens = usage.reasoningTokens ?? 0;
		totals.calls = 1;
		if (isDeepSeekProviderRoute(provider)) totals.cost = deepseekModelSpend(model, totals, atMs);
		return totals;
	}
	async loadPersisted() {
		try {
			const [rawLedger, rawSnapshots] = await Promise.all([readFile(this.ledgerPath, "utf8").catch(() => void 0), readFile(this.snapshotsPath, "utf8").catch(() => void 0)]);
			if (rawLedger !== void 0) await this.mergePersistedLedger(rawLedger);
			if (rawSnapshots !== void 0) this.mergePersistedSnapshots(rawSnapshots);
		} catch {} finally {
			this.loaded = true;
		}
	}
	/**
	* Merge one persisted ledger file into the live document. The file is only
	* trusted after a shape check; an unreadable ledger is preserved beside the
	* live path as `<name>.corrupt-<epoch>` instead of being silently overwritten
	* by the next flush. Never throws.
	*/
	async mergePersistedLedger(raw) {
		let loaded;
		try {
			const parsed = JSON.parse(raw);
			if (typeof parsed !== "object" || parsed === null) throw new Error("unrecognized ledger document");
			const days = parsed.days;
			if (typeof days !== "object" || days === null || Array.isArray(days)) throw new Error("unrecognized ledger days");
			loaded = deserializeLedger(parsed);
		} catch {
			await this.preserveUnreadableLedger();
			return;
		}
		for (const [dayKey, providers] of Object.entries(loaded.days)) {
			const atMs = (/* @__PURE__ */ new Date(dayKey + "T12:00:00")).getTime();
			for (const [provider, models] of Object.entries(providers)) for (const [model, totals] of Object.entries(models)) foldUsage(this.ledger, atMs, provider, model, totals);
		}
		pruneLedger(this.ledger, localDateKey(Date.now()), this.options.retainDays);
		this.lastPrune = {
			dayKey: localDateKey(Date.now()),
			retainDays: this.options.retainDays
		};
		this.bumpLedgerRevision();
	}
	/**
	* Move an unreadable ledger aside so its bytes survive the next flush. A
	* locked or cross-device file falls back to a best-effort copy; preservation
	* failure must never block startup, so both failures are swallowed.
	*/
	async preserveUnreadableLedger() {
		const target = `${this.ledgerPath}.corrupt-${Date.now()}`;
		try {
			await rename(this.ledgerPath, target);
			return;
		} catch {}
		try {
			await copyFile(this.ledgerPath, target);
		} catch {}
	}
	mergePersistedSnapshots(raw) {
		const parsed = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null || typeof parsed.providers !== "object" || parsed.providers === null) return;
		let loadedSnapshots = false;
		for (const [provider, snapshot] of Object.entries(parsed.providers)) if (typeof snapshot === "object" && snapshot !== null && typeof snapshot.provider === "string") {
			this.snapshots.set(provider, snapshot);
			loadedSnapshots = true;
		}
		if (loadedSnapshots) this.bumpRevision();
	}
	/** Read the completion state; undefined when absent or unrecognized. */
	async readBackfillState() {
		try {
			const raw = await readFile(backfillStatePath(this.persistDir), "utf8");
			const parsed = JSON.parse(raw);
			if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return void 0;
			if (parsed.version !== 1) return void 0;
			return parsed;
		} catch {
			return;
		}
	}
	async writeBackfillState(state) {
		try {
			const path = backfillStatePath(this.persistDir);
			await mkdir(dirname(path), { recursive: true });
			await writeJsonAtomic(path, state);
			this.healthCache = void 0;
		} catch {}
	}
	/**
	* Rebuild the ledger from prior sessions after `loadPersisted()` resolves.
	*
	* Runs only when all of these hold: the optional `ctx.sessionQuery` service
	* is present, the in-memory ledger has no usage (fresh install or data-dir
	* loss), and no `backfill.json` completion state exists yet. Anything else is
	* a normal upgrade (non-empty ledger) and simply records the state once so
	* the empty-ledger check is not repeated on every boot. Never throws.
	*/
	async maybeBackfill(startedAt) {
		try {
			const sessionQuery = service(this.ctx, "sessionQuery");
			if (sessionQuery === void 0 || this.disposed) return;
			const state = await this.readBackfillState();
			if (hasLedgerUsage(this.ledger)) {
				if (state === void 0) await this.writeBackfillState({
					version: 1,
					completedAt: Date.now(),
					cutoff: startedAt,
					sessions: 0,
					events: 0
				});
				return;
			}
			if (state !== void 0) return;
			const result = await collectBackfill(sessionQuery, {
				startedAt,
				retainDays: this.options.retainDays,
				shouldAbort: () => this.disposed
			});
			if (this.disposed) return;
			if (!result.ok) {
				console.warn("[dsh-usage-plus] session backfill could not read prior sessions");
				return;
			}
			if (result.events > 0) {
				mergeLedgerDocuments(this.ledger, result.ledger);
				this.bumpLedgerRevision();
				await this.flushLedger();
			}
			await this.writeBackfillState({
				version: 1,
				completedAt: Date.now(),
				cutoff: startedAt,
				sessions: result.sessions,
				events: result.events,
				...result.truncated ? { truncated: true } : {}
			});
			console.info(`[dsh-usage-plus] session backfill: ${result.sessions} session(s), ${result.events} usage event(s)${result.truncated ? " (truncated by caps)" : ""}`);
		} catch (error) {
			console.warn("[dsh-usage-plus] session backfill failed:", error instanceof Error ? error.message : String(error));
		}
	}
	/**
	* Arm one debounced ledger flush. The delay is the burst debounce or the
	* remaining flush floor, whichever is later, so an active session cannot
	* rewrite the full ledger document on every 3 s window. Exactly one timer is
	* ever pending; folds that land while it runs are covered by the write that
	* follows (and reschedule afterwards when the write already started).
	*/
	scheduleFlush() {
		if (this.flushTimer !== void 0 || this.disposed) return;
		const delay = nextFlushDelayMs(Date.now(), this.lastFlushAt);
		this.flushTimer = setTimeout(() => {
			this.flushTimer = void 0;
			this.flushLedger();
		}, delay);
	}
	/**
	* Queue one ledger flush behind the previous one. Debounce and stop-time
	* flushes serialize here, so two `writeJsonAtomic` calls can never run
	* concurrently on the same path. `stop()` calls this directly, so the final
	* flush is never delayed by the floor.
	*/
	flushLedger() {
		const next = this.flushChain.then(() => this.writeLedgerOnce());
		this.flushChain = next.catch(() => {});
		return next;
	}
	async writeLedgerOnce() {
		if (!this.loaded) return;
		this.lastFlushAt = Date.now();
		try {
			await mkdir(dirname(this.ledgerPath), { recursive: true });
			await writeJsonAtomic(this.ledgerPath, this.ledger);
			this.healthCache = void 0;
		} catch {}
	}
	/**
	* Prune days past retention. Runs at most once per local day and whenever
	* `retainDays` shrinks — not only at startup, so long-lived processes and
	* live settings changes both honor retention.
	*/
	pruneIfNeeded() {
		const todayKey = localDateKey(Date.now());
		if (this.lastPrune?.dayKey === todayKey && this.lastPrune.retainDays === this.options.retainDays) return;
		const pruned = pruneLedger(this.ledger, todayKey, this.options.retainDays);
		this.lastPrune = {
			dayKey: todayKey,
			retainDays: this.options.retainDays
		};
		if (pruned > 0) {
			this.bumpLedgerRevision();
			this.scheduleFlush();
		}
	}
	async persistSnapshots() {
		if (!this.loaded) return;
		const providers = Object.fromEntries(this.snapshots);
		const signature = JSON.stringify(providers);
		if (signature === this.lastPersistedSnapshots) return;
		try {
			await mkdir(dirname(this.snapshotsPath), { recursive: true });
			await writeJsonAtomic(this.snapshotsPath, {
				version: 1,
				providers
			});
			this.lastPersistedSnapshots = signature;
		} catch {}
	}
	rearmPoll(delayMs) {
		if (this.disposed) return;
		if (this.pollTimer !== void 0) clearTimeout(this.pollTimer);
		this.pollTimer = setTimeout(() => {
			this.pollTimer = void 0;
			this.pollNow().catch(() => {}).finally(() => this.rearmPoll(Math.max(30, this.options.pollIntervalSec) * 1e3));
		}, delayMs);
	}
	/**
	* One poll cycle: enumerate routes, resolve credentials, probe, announce.
	* A call while a cycle is already running joins that cycle instead of
	* returning immediately, so a manual refresh always waits for real probes.
	*/
	pollNow() {
		if (this.pollInFlight) return this.pollPromise ?? Promise.resolve();
		if (this.disposed) return Promise.resolve();
		this.pollInFlight = true;
		const cycle = (async () => {
			try {
				this.pruneIfNeeded();
				const routes = this.listProviderRoutes();
				const seen = /* @__PURE__ */ new Set();
				const probeable = [];
				const now = Date.now();
				for (const route of routes) {
					if (this.disposed) return;
					seen.add(route.id);
					const adapter = adapterFor(route.id);
					if (adapter === void 0 || adapter.balance === void 0 && adapter.plan === void 0) continue;
					const backoff = this.probeBackoff.get(route.id);
					if (backoff !== void 0 && backoff.nextAt > now && route.id !== this.current.provider) continue;
					probeable.push({
						route,
						adapter
					});
				}
				const PROBE_CONCURRENCY = 3;
				for (let offset = 0; offset < probeable.length; offset += PROBE_CONCURRENCY) {
					if (this.disposed) return;
					const batch = probeable.slice(offset, offset + PROBE_CONCURRENCY);
					await Promise.all(batch.map(({ route, adapter }) => this.probeRoute(route, adapter)));
				}
				let droppedSnapshots = false;
				for (const id of [...this.snapshots.keys()]) if (!seen.has(id) && !id.startsWith("cpamc:") && !id.startsWith("volcano:") && !id.startsWith("custom:")) {
					this.snapshots.delete(id);
					droppedSnapshots = true;
				}
				if (droppedSnapshots) this.bumpRevision();
				await this.probeExternalSources();
				this.refreshPlatformTruth();
				this.refreshPriceBook();
				if (this.disposed) return;
				await this.persistSnapshots();
				this.announceCurrent();
			} finally {
				this.pollInFlight = false;
				this.pollPromise = void 0;
			}
		})();
		this.pollPromise = cycle;
		return cycle;
	}
	/**
	* The live LLM provider routes, short-TTL cached: the registry call walks
	* config, and every overview/poll/announce reads it. A registry change is
	* document-visible (provider rows), so it bumps the revision.
	*/
	listProviderRoutes() {
		const now = Date.now();
		const cached = this.routesCache;
		if (cached !== void 0 && now - cached.at < ROUTE_CACHE_TTL_MS) return cached.routes;
		const routes = this.readProviderRoutes();
		this.routesCache = {
			at: now,
			routes
		};
		if (cached !== void 0 && !sameRoutes(cached.routes, routes)) this.bumpRevision();
		return routes;
	}
	readProviderRoutes() {
		const routes = /* @__PURE__ */ new Map();
		const runtime = service(this.ctx, "llm");
		if (runtime !== void 0) try {
			for (const provider of runtime.listProviders()) if (provider.id !== "") routes.set(provider.id, provider.name);
			for (const provider of runtime.listConfigurableProviders()) if (!routes.has(provider.provider)) routes.set(provider.provider, provider.displayName);
		} catch {}
		return dedupeProviderAliasRoutes([...routes].map(([id, displayName]) => ({
			id,
			displayName
		})));
	}
	async probeRoute(route, adapter) {
		const credential = await this.resolveCredential(route.id);
		const previous = this.snapshots.get(route.id);
		if (credential.key === void 0) {
			const next = {
				provider: route.id,
				displayName: route.displayName || adapter.displayName,
				credential: credential.kind,
				supported: true,
				updatedAt: Date.now()
			};
			if (previous !== void 0 && providerSnapshotFactsEqual(previous, next)) return;
			this.snapshots.set(route.id, next);
			this.bumpRevision();
			return;
		}
		const snapshot = {
			provider: route.id,
			displayName: route.displayName || adapter.displayName,
			credential: credential.kind,
			supported: true,
			updatedAt: Date.now()
		};
		const runProbe = async (kind) => {
			const half = adapter[kind];
			if (half === void 0) return void 0;
			if (!probeHalfAllowed(half.credential, credential.kind)) return void 0;
			try {
				const spec = half.build({
					apiKey: credential.key,
					...credential.accountId !== void 0 ? { accountId: credential.accountId } : {},
					...credential.refreshToken !== void 0 ? { refreshToken: credential.refreshToken } : {}
				});
				const response = await fetch(spec.url, {
					method: spec.method ?? "GET",
					headers: spec.headers,
					signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
				});
				const body = await response.json().catch(() => void 0);
				if (!response.ok) throw new Error(providerErrorMessage(response.status, body));
				const parsed = half.parse(response.status, body);
				if (parsed === void 0) throw new Error("unrecognized response shape");
				const updatedAt = Date.now();
				if (kind === "balance") {
					const fact = parsed;
					return {
						currency: fact.currency,
						totalBalance: fact.totalBalance,
						updatedAt
					};
				}
				const plan = parsed;
				return {
					planName: plan.planName,
					windows: plan.windows,
					updatedAt
				};
			} catch (error) {
				const message = error instanceof Error ? error.message.slice(0, 200) : String(error);
				if (kind === "balance") snapshot.balanceError = message;
				else snapshot.planError = message;
				return;
			}
		};
		const balance = await runProbe("balance");
		if (balance !== void 0) snapshot.balance = balance;
		else if (previous?.balance !== void 0) snapshot.balance = previous.balance;
		const plan = await runProbe("plan");
		if (plan !== void 0) snapshot.plan = plan;
		else if (previous?.plan !== void 0) snapshot.plan = previous.plan;
		if (previous !== void 0 && providerSnapshotFactsEqual(previous, snapshot)) {
			this.recordProbeOutcome(route.id, snapshot.balanceError !== void 0 || snapshot.planError !== void 0);
			return;
		}
		this.snapshots.set(route.id, snapshot);
		this.bumpRevision();
		this.recordProbeOutcome(route.id, snapshot.balanceError !== void 0 || snapshot.planError !== void 0);
	}
	/** Advance or clear the retry backoff after one provider's probe run. */
	recordProbeOutcome(provider, failed) {
		this.probeAttemptAt = Date.now();
		if (!failed) {
			this.probeSuccessAt = this.probeAttemptAt;
			this.probeBackoff.delete(provider);
			return;
		}
		const failures = (this.probeBackoff.get(provider)?.failures ?? 0) + 1;
		this.probeBackoff.set(provider, {
			failures,
			nextAt: Date.now() + probeBackoffDelayMs(failures)
		});
	}
	/**
	* Resolve the credential backing one route: pi-ai credential records
	* first, then the profile's apiKeyEnv reference, then the DeepSeek
	* official adapter's env reference. OAuth grants hand their stored access
	* token to the oauth-aware adapters (Codex plan quota); a stale token
	* fails its probe with a 401 and refreshes the next time the harness
	* itself runs that provider.
	*/
	async resolveCredential(provider) {
		const credentials = service(this.ctx, "credentials");
		if (credentials === void 0) return { kind: "none" };
		try {
			const record = await credentials.readRecord(credentialKey("llm-pi-ai", provider));
			if (record?.kind === "api-key" && typeof record.key === "string" && record.key !== "") return {
				kind: "api-key",
				key: record.key
			};
			if (record?.kind === "grant" && typeof record.payload === "object" && record.payload !== null) {
				const payload = record.payload;
				const access = typeof payload.access === "string" && payload.access !== "" ? payload.access : void 0;
				const refreshToken = typeof payload.refresh === "string" && payload.refresh !== "" ? payload.refresh : void 0;
				const accountId = typeof payload.chatgpt_account_id === "string" && payload.chatgpt_account_id !== "" ? payload.chatgpt_account_id : void 0;
				if (access !== void 0) return {
					kind: "oauth",
					key: access,
					...accountId !== void 0 ? { accountId } : {},
					...refreshToken !== void 0 ? { refreshToken } : {}
				};
				return { kind: "oauth" };
			}
		} catch {}
		try {
			const envName = this.piAiProfile(provider)?.apiKeyEnv ?? (isDeepSeekProviderRoute(provider) ? this.deepseekApiKeyEnv() : void 0);
			if (typeof envName === "string" && envName !== "") {
				const resolved = await credentials.resolve(credentialRef(envName));
				if (resolved?.value !== void 0 && resolved.value !== "") return {
					kind: "env",
					key: resolved.value
				};
			}
		} catch {}
		return { kind: "none" };
	}
	async resolveEnv(name) {
		const credentials = service(this.ctx, "credentials");
		try {
			const hit = await credentials?.resolve(credentialRef(name));
			if (typeof hit?.value === "string" && hit.value.trim() !== "") return hit.value.trim();
		} catch {}
		const value = process.env[name];
		return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
	}
	async probeExternalSources() {
		try {
			const rows = await probeCpamc({
				enabled: this.options.cpamcEnabled,
				baseURL: this.options.cpamcBaseURL,
				managementKey: await this.resolveEnv(this.options.cpamcManagementKeyEnv),
				allowedHosts: this.options.cpamcAllowedHosts
			});
			this.replaceExternalSnapshotsChecked("cpamc", rows);
		} catch {}
		try {
			const rows = await probeVolcano({
				enabled: this.options.volcanoEnabled,
				accessKeyId: await this.resolveEnv(this.options.volcanoAccessKeyEnv),
				secretAccessKey: await this.resolveEnv(this.options.volcanoSecretKeyEnv)
			});
			this.replaceExternalSnapshotsChecked("volcano", rows);
		} catch {}
	}
	/**
	* Replace one external source's rows, bumping the revision only when the
	* facts actually changed. A disabled/idle source and an unchanged quota
	* response must not invalidate the cached overview (and its ETag) or rewrite
	* the snapshots file every poll; the probe read timestamps are ignored for
	* this comparison.
	*/
	replaceExternalSnapshotsChecked(source, rows) {
		const prefix = `${source}:`;
		const existing = [];
		for (const [id, snapshot] of this.snapshots) if (id.startsWith(prefix)) existing.push(snapshot);
		if (existing.length === 0 && rows.length === 0) return;
		if (existing.length === rows.length && existing.every((snapshot, index) => {
			const next = rows[index];
			return next !== void 0 && providerSnapshotFactsEqual(snapshot, next);
		})) return;
		replaceExternalSnapshots(this.snapshots, source, rows);
		this.bumpRevision();
	}
	/**
	* A configEditor entry snapshot, short-TTL cached. Config is part of the
	* document (the current route's baseURL), so a changed value bumps the
	* revision; the TTL keeps the config scan off the warm poll path.
	*/
	cachedEntryConfig(id) {
		const now = Date.now();
		const cached = this.entryConfigCache.get(id);
		if (cached !== void 0 && now - cached.at < CONFIG_CACHE_TTL_MS) return cached.config;
		const config = readEntryConfig(this.ctx, id);
		this.entryConfigCache.set(id, {
			at: now,
			config
		});
		if (cached !== void 0 && !configsEqual(cached.config, config)) this.bumpRevision();
		return config;
	}
	/** The llm-pi-ai profile object for one provider route, when configured. */
	piAiProfile(provider) {
		return this.cachedEntryConfig("llm-pi-ai")?.providers?.[provider];
	}
	/** The DeepSeek official adapter's credential reference name. */
	deepseekApiKeyEnv() {
		return this.cachedEntryConfig("llm-deepseek")?.apiKeyEnv ?? "DEEPSEEK_API_KEY";
	}
	/**
	* Announce the current provider's spend, balance, or plan usage to the pet.
	* In `change` mode only meaningful value changes re-announce; `off` skips.
	* The TTL rides the poll interval (bubble_mode `always` re-announces every
	* cycle, so a TTL of two cycles + margin keeps the bubble continuous
	* across polls; the pet contract caps the ceiling). A route id the
	* catalogs spell differently than the snapshot keys falls back to its
	* adapter family's snapshot. When the provider has no announceable probe
	* fact (no adapter, failing probes, percent-less windows) the bubble falls
	* back to the provider's today ledger usage, and with neither fact nor
	* usage it stays silent. Fully guarded: a malformed snapshot or a failing
	* pet service must never break the poll loop, and a disposed service never
	* announces.
	*/
	announceCurrent() {
		if (this.disposed || this.options.bubbleMode === "off") return;
		try {
			this.syncCurrentFromComposer();
			const provider = this.current.provider;
			if (provider === void 0) return;
			let snapshot = this.snapshots.get(provider);
			if (snapshot === void 0) {
				const family = adapterFor(provider);
				if (family !== void 0) {
					for (const [id, candidate] of this.snapshots) if (adapterFor(id) === family) {
						snapshot = candidate;
						break;
					}
				}
			}
			if (snapshot?.plan === void 0) {
				const baseURL = this.piAiProfile(provider)?.baseURL;
				const mapped = currentPlanProvider({
					current: {
						...this.current,
						...typeof baseURL === "string" && baseURL.trim() !== "" ? { baseURL: baseURL.trim() } : {}
					},
					providers: [...this.snapshots.values()]
				});
				if (mapped !== void 0) snapshot = mapped;
			}
			const displayName = snapshot?.displayName ?? this.routeDisplayName(provider);
			let announcement = snapshot !== void 0 ? buildAnnouncement(snapshot, {
				todayCost: this.familyCostToday(provider),
				peak: deepseekPeriodAt(Date.now()).peak
			}) : void 0;
			if (announcement === void 0) announcement = buildLedgerAnnouncement({
				displayName,
				totals: this.providerUsageToday(provider)
			});
			if (announcement === void 0) return;
			const signature = JSON.stringify(announcement);
			if (this.options.bubbleMode === "change" && signature === this.lastSignature) return;
			this.lastSignature = signature;
			const ttlMs = Math.min(72e5, this.options.pollIntervalSec * 2e3 + 3e4);
			service(this.ctx, "pet")?.announce({
				source: USAGE_ANNOUNCE_SOURCE,
				ttlMs,
				...announcement
			});
		} catch {}
	}
};
//#endregion
//#region src/host/loopback.ts
/** IPv4 127/8 predicate (four decimal octets, first == 127). */
function isIPv4Loopback(v4) {
	const parts = v4.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Whether a socket remote address names the loopback range (127/8, ::1, IPv4-mapped). */
function isLoopbackAddress(address) {
	if (address === void 0) return false;
	const normalized = address.toLowerCase();
	if (normalized === "::1") return true;
	if (normalized.startsWith("::ffff:")) return isIPv4Loopback(normalized.slice(7));
	return isIPv4Loopback(normalized);
}
/** Whether a normalized URL hostname names the loopback authority (localhost, [::1], 127/8). */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	return isIPv4Loopback(hostname);
}
/**
* Request-level trust fence: a loopback socket address AND a loopback Host
* header, plus browser same-origin markers. The socket address is
* authoritative; X-Forwarded-For is never trusted.
*/
function isLoopbackRequest(request) {
	if (!isLoopbackAddress(request.socket.remoteAddress)) return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL("http://" + host);
	} catch {
		return false;
	}
	if (!isLoopbackHostname(hostUrl.hostname)) return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
//#endregion
//#region src/host/routes.ts
const USAGE_API_PREFIX = "/api/dsh-usage-plus";
/** Rotate the client-diagnostic NDJSON once it passes this size. */
const CLIENT_DIAG_MAX_BYTES = 262144;
const FIXED_CREDENTIAL_TARGETS = /* @__PURE__ */ new Set([
	"cpamc",
	"volcano.ak",
	"volcano.sk"
]);
/** Parsed query string of one request; an unparsable URL reads as no query. */
function requestQuery(req) {
	try {
		return new URL(req.url ?? "/", "http://localhost").searchParams;
	} catch {
		return new URLSearchParams();
	}
}
/**
* Whether an `If-None-Match` header names this ETag. Handles the list form,
* weak validators (`W/"..."`), and the `*` wildcard.
*/
function requestEtagMatches(ifNoneMatch, etag) {
	return ifNoneMatch.split(",").some((candidate) => {
		const value = candidate.trim().replace(/^W\//i, "");
		return value === etag || value === "*";
	});
}
function parseCredentialTarget(raw) {
	if (typeof raw !== "string") return void 0;
	if (FIXED_CREDENTIAL_TARGETS.has(raw)) return raw;
}
/**
* Loopback-fenced overview route: provider balances, plan quotas, and token
* usage totals. Personal account data, so the loopback fence mirrors
* dsh-perf's stats surface; the browser runs on the same machine.
*
* Conditional GET: the browser-strip poller revalidates with
* `If-None-Match`, so an unchanged document costs a 304 instead of a full
* body every cadence.
*/
function makeUsageOverviewRoute(service) {
	return {
		kind: "exact",
		path: USAGE_API_PREFIX + "/overview",
		handler: async (req, res) => {
			if (!isLoopbackRequest(req)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden: loopback-only"
				});
				return;
			}
			const days = resolveRangeDays(requestQuery(req).get("days") ?? void 0);
			if (days === void 0) {
				writeJson(res, 400, {
					ok: false,
					error: "invalid days"
				});
				return;
			}
			const { document, etag } = await service.overviewPayload(days);
			const ifNoneMatch = req.headers["if-none-match"];
			if (typeof ifNoneMatch === "string" && requestEtagMatches(ifNoneMatch, etag)) {
				res.writeHead(304, {
					etag,
					"cache-control": "no-store"
				});
				res.end();
				return;
			}
			writeJson(res, 200, document, {
				etag,
				"cache-control": "no-store"
			});
		}
	};
}
/**
* Loopback-fenced aggregate export of the usage ledger.
*
* `GET /api/dsh-usage-plus/export?format=csv|json&days=N` where `days` is an
* integer 1..730 (default 182). The payload is ledger aggregates only — no
* credential, session-content, or provider-secret value is read. CSV uses the
* fixed column contract and a CRLF body; JSON serves the versioned document.
*/
function makeUsageExportRoute(service) {
	return {
		kind: "exact",
		path: USAGE_API_PREFIX + "/export",
		handler: async (req, res) => {
			if (!isLoopbackRequest(req)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden: loopback-only"
				});
				return;
			}
			if (req.method !== "GET") {
				writeJson(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				return;
			}
			const query = requestQuery(req);
			const format = resolveExportFormat(query.get("format") ?? void 0);
			const days = resolveExportDays(query.get("days") ?? void 0);
			if (format === void 0 || days === void 0) {
				writeJson(res, 400, {
					ok: false,
					error: "invalid format or days"
				});
				return;
			}
			const document = service.exportLedger(days);
			const headers = {
				"cache-control": "no-store",
				"content-disposition": `attachment; filename="${exportFilename(document.exportedAt, format)}"`
			};
			if (format === "json") {
				writeJson(res, 200, document, headers);
				return;
			}
			writeText(res, 200, exportCsv(document.entries), {
				...headers,
				"content-type": "text/csv; charset=utf-8"
			});
		}
	};
}
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
/**
* Loopback-fenced per-day drill-down used by the Overview heatmap. Returns the
* ledger's provider/model rows for one local date (zeros for a day with no
* usage); future or malformed dates are client errors.
*/
function makeUsageDayRoute(service) {
	return {
		kind: "exact",
		path: USAGE_API_PREFIX + "/day",
		handler: async (req, res) => {
			if (!isLoopbackRequest(req)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden: loopback-only"
				});
				return;
			}
			if (req.method !== "GET") {
				writeJson(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				return;
			}
			const date = requestQuery(req).get("date") ?? "";
			if (!DATE_KEY.test(date)) {
				writeJson(res, 400, {
					ok: false,
					error: "invalid date"
				});
				return;
			}
			const detail = service.dayDetail(date);
			if (detail.date > localDateKey(Date.now())) {
				writeJson(res, 400, {
					ok: false,
					error: "future date"
				});
				return;
			}
			writeJson(res, 200, detail, { "cache-control": "no-store" });
		}
	};
}
/**
* Loopback-fenced external-source connection test used by the Settings
* "test connection" button. Returns only probe facts and hints; no secret
* value ever crosses the wire.
*/
function makeUsageTestRoute(service) {
	return {
		kind: "exact",
		path: USAGE_API_PREFIX + "/test",
		handler: async (req, res) => {
			if (!isLoopbackRequest(req)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden: loopback-only"
				});
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				return;
			}
			const body = asJsonObject(await readJsonBody(req, {
				objectOnly: true,
				maxBytes: 4096
			}));
			const target = body?.target === "cpamc" || body?.target === "volcano" ? body.target : void 0;
			if (body === void 0 || target === void 0) {
				writeJson(res, 400, {
					ok: false,
					error: "invalid target"
				});
				return;
			}
			writeJson(res, 200, await service.testExternalSource(target), { "cache-control": "no-store" });
		}
	};
}
/**
* Loopback-fenced manual refresh: forces one probe cycle now and answers
* with the fresh overview.
*/
function makeUsageRefreshRoute(service) {
	return {
		kind: "exact",
		path: USAGE_API_PREFIX + "/refresh",
		handler: async (req, res) => {
			if (!isLoopbackRequest(req)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden: loopback-only"
				});
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				return;
			}
			try {
				await service.refresh();
			} catch (error) {
				writeJson(res, 500, {
					ok: false,
					error: error instanceof Error ? error.message : "refresh failed"
				});
				return;
			}
			writeJson(res, 200, await service.overview(), { "cache-control": "no-store" });
		}
	};
}
/**
* Loopback-fenced write-only credential route for CPAMC management token and
* Volcano AK/SK. Secrets land in the DSH credential store and never come back
* on the wire — only ok/error plus a refreshed overview.
*/
function makeUsageCredentialsRoute(service) {
	return {
		kind: "exact",
		path: USAGE_API_PREFIX + "/credentials",
		handler: async (req, res) => {
			if (!isLoopbackRequest(req)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden: loopback-only"
				});
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				return;
			}
			const body = asJsonObject(await readJsonBody(req, {
				objectOnly: true,
				maxBytes: 8192
			}));
			if (body === void 0) {
				writeJson(res, 400, {
					ok: false,
					error: "invalid body"
				});
				return;
			}
			const action = body.action === "clear" ? "clear" : body.action === "set" ? "set" : void 0;
			const target = parseCredentialTarget(body.target);
			if (action === void 0 || target === void 0) {
				writeJson(res, 400, {
					ok: false,
					error: "invalid action or target"
				});
				return;
			}
			const result = action === "set" ? await service.setExternalCredential(target, typeof body.value === "string" ? body.value : "") : await service.clearExternalCredential(target);
			if (!result.ok) {
				writeJson(res, 400, result);
				return;
			}
			try {
				await service.refresh();
			} catch {}
			writeJson(res, 200, {
				ok: true,
				overview: await service.overview()
			}, { "cache-control": "no-store" });
		}
	};
}
/**
* Loopback-fenced client-side diagnostics: the browser half appends one
* NDJSON line per strip mount/state change so the failure point of the
* quota meter is observable from the host filesystem (desktop shells may
* have no devtools). Bounded to keep the file meaningful.
*/
function makeUsageClientDiagRoute() {
	return {
		kind: "exact",
		path: USAGE_API_PREFIX + "/client-diag",
		handler: async (req, res) => {
			if (!isLoopbackRequest(req)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden: loopback-only"
				});
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				return;
			}
			const body = asJsonObject(await readJsonBody(req, {
				objectOnly: true,
				maxBytes: 2048
			}));
			if (body === void 0) {
				writeJson(res, 400, {
					ok: false,
					error: "invalid body"
				});
				return;
			}
			const line = `${JSON.stringify({
				ts: Date.now(),
				...body
			})}\n`;
			const file = join(dshHome(), "dsh-usage-plus", "client-diag.ndjson");
			try {
				if ((await stat(file)).size > CLIENT_DIAG_MAX_BYTES) await rm(file, { force: true });
			} catch {}
			try {
				await appendFile(file, line, "utf8");
			} catch {}
			writeJson(res, 200, { ok: true });
		}
	};
}
//#endregion
//#region src/index.ts
const name = "dsh-usage-plus";
const inject = ["webServer", "configEditor"];
/**
* Profile entry id declared by `cordis.patch.yml`.
* DSH 0.1.7+ addresses configuration forms by this id (not a settings namespace).
* @see https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/settings.md
*/
const USAGE_ENTRY_ID = "usage-plus";
/**
* Cordis Config schema for the `usage-plus` profile row.
* Every user-editable field is `.volatile()` so DSH projects it into a form
* and keeps a live reference the plugin reads with `.get()`.
* @see @deepseek-ai/dsh-settings README — "Forms expose only volatile fields"
*/
const Config = z.object({
	enabled: z.boolean().default(true).volatile(),
	pollIntervalSec: z.number().min(30).max(3600).default(60).volatile(),
	bubbleMode: z.string().default("always").volatile(),
	retainDays: z.number().min(7).max(730).default(182).volatile(),
	alertsEnabled: z.boolean().default(true).volatile(),
	dailyCostLimitCny: z.number().min(0).max(1e9).default(0).volatile(),
	planAlertPercent: z.number().min(0).max(100).default(0).volatile(),
	balanceAlertCny: z.number().min(0).max(1e9).default(0).volatile(),
	alertCooldownMinutes: z.number().min(1).max(1440).default(60).volatile(),
	platformUsageEnabled: z.boolean().default(true).volatile(),
	costEstimateEnabled: z.boolean().default(true).volatile(),
	cpamcEnabled: z.boolean().default(false).volatile(),
	cpamcBaseURL: z.string().default("http://127.0.0.1:8317").volatile(),
	cpamcManagementKeyEnv: z.string().default("CPAMC_MANAGEMENT_KEY").volatile(),
	cpamcAllowedHosts: z.string().default("").volatile(),
	volcanoEnabled: z.boolean().default(false).volatile(),
	volcanoAccessKeyEnv: z.string().default("VOLC_ACCESSKEY").volatile(),
	volcanoSecretKeyEnv: z.string().default("VOLC_SECRETKEY").volatile()
});
/** Shared cosmokit volatile-reference brand (Cordis re-exports the type only). */
const VOLATILE_WRITE = Symbol.for("cosmokit.volatile.write");
function isVolatileRef(value) {
	return typeof value === "object" && value !== null && VOLATILE_WRITE in value;
}
/**
* Snapshot loader Config (volatile refs or plain values) into a plain partial.
* Presence-only: a ref currently holding `undefined` is dropped.
*/
function plainConfigInput(input = {}) {
	const plain = {};
	for (const [key, value] of Object.entries(input)) {
		const resolved = isVolatileRef(value) ? value.get() : value;
		if (resolved !== void 0) plain[key] = resolved;
	}
	return plain;
}
/** Validate and normalize entry config for the usage service. */
function resolveConfig(input) {
	const config = plainConfigInput(input ?? {});
	const bubbleMode = config.bubbleMode === "change" || config.bubbleMode === "off" ? config.bubbleMode : "always";
	return {
		enabled: config.enabled ?? true,
		pollIntervalSec: typeof config.pollIntervalSec === "number" ? config.pollIntervalSec : 60,
		bubbleMode,
		retainDays: typeof config.retainDays === "number" ? config.retainDays : 182,
		alertsEnabled: config.alertsEnabled ?? true,
		dailyCostLimitCny: typeof config.dailyCostLimitCny === "number" ? config.dailyCostLimitCny : 0,
		planAlertPercent: typeof config.planAlertPercent === "number" ? config.planAlertPercent : 0,
		balanceAlertCny: typeof config.balanceAlertCny === "number" ? config.balanceAlertCny : 0,
		alertCooldownMinutes: typeof config.alertCooldownMinutes === "number" ? config.alertCooldownMinutes : 60,
		platformUsageEnabled: config.platformUsageEnabled ?? true,
		costEstimateEnabled: config.costEstimateEnabled ?? true,
		cpamcEnabled: config.cpamcEnabled ?? false,
		cpamcBaseURL: config.cpamcBaseURL ?? "http://127.0.0.1:8317",
		cpamcManagementKeyEnv: config.cpamcManagementKeyEnv ?? "CPAMC_MANAGEMENT_KEY",
		cpamcAllowedHosts: config.cpamcAllowedHosts ?? "",
		volcanoEnabled: config.volcanoEnabled ?? false,
		volcanoAccessKeyEnv: config.volcanoAccessKeyEnv ?? "VOLC_ACCESSKEY",
		volcanoSecretKeyEnv: config.volcanoSecretKeyEnv ?? "VOLC_SECRETKEY"
	};
}
const apply = mountOnce("dsh-usage-plus", (ctx, input = {}) => {
	let service;
	let pendingStop;
	let disposeRoutes;
	let appliedSignature = JSON.stringify(plainConfigInput(input));
	const rearm = () => {
		const signature = JSON.stringify(plainConfigInput(input));
		if (service !== void 0 && signature === appliedSignature) return;
		appliedSignature = signature;
		const value = resolveConfig(input);
		if (!value.enabled) {
			pendingStop = service?.stop();
			service = void 0;
			disposeRoutes?.();
			disposeRoutes = void 0;
			return;
		}
		if (service === void 0) {
			const next = new UsageService(ctx, value);
			service = next;
			const begin = () => {
				if (service !== next) return;
				next.start();
				const disposers = [
					makeUsageOverviewRoute(next),
					makeUsageRefreshRoute(next),
					makeUsageCredentialsRoute(next),
					makeUsageExportRoute(next),
					makeUsageTestRoute(next),
					makeUsageDayRoute(next),
					makeUsageClientDiagRoute()
				].map((route) => ctx.webServer.register(route));
				disposeRoutes = () => {
					for (const dispose of disposers) try {
						dispose();
					} catch {}
				};
			};
			if (pendingStop !== void 0) pendingStop.then(begin, begin);
			else begin();
		} else service.applyOptions(value);
	};
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber), "dsh-usage-plus: page policy");
	});
	ctx.on("loader/volatile-update", () => {
		rearm();
	});
	ctx.effect(() => {
		rearm();
		return () => {
			disposeRoutes?.();
			service?.stop();
			service = void 0;
		};
	}, "dsh-usage-plus: runtime");
});
//#endregion
export { Config, USAGE_ENTRY_ID, apply, inject, name, plainConfigInput, resolveConfig };

//# sourceMappingURL=index.js.map