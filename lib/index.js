import z from "schemastery";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
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
* what dsh-pet and dsh-liangshen each used to implement locally.
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
* The adapter registry, in no particular order. Route keys come from the
* pi-ai provider catalog plus the routes this deployment observed in user
* configuration (`zenmux`).
*/
const PROVIDER_ADAPTERS = [
	DEEPSEEK,
	moonshotBalance("api.moonshot.cn", "CNY", ["moonshotai-cn"]),
	moonshotBalance("api.moonshot.ai", "USD", ["moonshotai"]),
	KIMI_CODING,
	glmPlan("open.bigmodel.cn", ["zai-coding-cn"]),
	glmPlan("api.z.ai", ["zai-coding"]),
	OPENCODE_GO,
	minimaxPlan("api.minimaxi.com", ["minimax-cn"]),
	minimaxPlan("api.minimax.io", ["minimax"]),
	OPENAI_CODEX,
	OPENROUTER,
	siliconFlow("api.siliconflow.cn", ["siliconflow", "siliconflow-cn"], "CNY"),
	siliconFlow("api.siliconflow.com", ["siliconflow-intl"], "USD"),
	ZENMUX
];
/** Find the adapter serving a provider route key, if any. */
function adapterFor(provider) {
	return PROVIDER_ADAPTERS.find((adapter) => adapter.ids.includes(provider));
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
//#region src/host/external-sources.ts
/**
* Independent quota sources which cannot be inferred from a normal model API key.
* CPAMC uses its management key; Volcano Ark uses an AK/SK signature pair.
* Portions of the protocol normalization are adapted from dsh-cost-meter (MIT).
*/
const timeout = () => AbortSignal.timeout(15e3);
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
function cpamcOrigin(raw) {
	try {
		const url = new URL(raw);
		if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return void 0;
		if (!(url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") || url.protocol !== "http:" && url.protocol !== "https:") return void 0;
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
	const origin = cpamcOrigin(options.baseURL);
	if (origin === void 0) return statusRow("CPAMC URL must be a loopback origin such as http://127.0.0.1:8317");
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
		return statusRow(error instanceof Error ? error.message : String(error));
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
			lastError = error instanceof Error ? error.message : String(error);
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
//#region src/core/custom-balance.ts
/**
* Pure helpers for custom HTTPS balance extract rules and header templates.
* @module dsh-usage-plus/core/custom-balance
*/
function getPath(root, path) {
	if (typeof path !== "string" || path.length === 0) return void 0;
	let current = root;
	for (const segment of path.split(".")) {
		if (current === null || current === void 0 || typeof current !== "object") return void 0;
		if (!Object.hasOwn(current, segment)) return void 0;
		current = current[segment];
	}
	return current;
}
function toStrictNumber$1(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
	if (typeof value === "string") {
		const text = value.trim();
		if (text.length > 0 && /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(text)) return Number(text);
	}
	return NaN;
}
/** Evaluate one extract rule against a JSON body. Exported for unit tests. */
function extractByRule(data, rule) {
	if (rule === null || rule === void 0) return null;
	if (typeof rule === "number" && Number.isFinite(rule)) return rule;
	if (typeof rule === "string") {
		const value = getPath(data, rule);
		const num = toStrictNumber$1(value);
		if (Number.isFinite(num)) return num;
		return typeof value === "string" ? value : null;
	}
	if (typeof rule === "object" && !Array.isArray(rule)) {
		const row = rule;
		const op = row.op;
		if (op === "subtract" && Array.isArray(row.paths)) {
			if (row.paths.length === 0) return null;
			const values = row.paths.map((path) => toStrictNumber$1(getPath(data, String(path))));
			if (!values.every(Number.isFinite)) return null;
			return values.reduce((acc, value) => acc - value);
		}
		if (op === "add" && Array.isArray(row.paths)) {
			const values = row.paths.map((path) => toStrictNumber$1(getPath(data, String(path))));
			if (!values.every(Number.isFinite)) return null;
			return values.reduce((acc, value) => acc + value, 0);
		}
		if (op === "divide" && typeof row.path === "string") {
			const value = toStrictNumber$1(getPath(data, row.path));
			const by = toStrictNumber$1(row.by);
			if (!Number.isFinite(value) || !Number.isFinite(by) || by === 0) return null;
			return value / by;
		}
		if (typeof row.path === "string") return extractByRule(data, row.path);
	}
	return null;
}
/** Collect `{{VAR}}` names from a headers JSON object string. */
function customBalanceCredentialVars(headersJson) {
	try {
		const parsed = JSON.parse(headersJson || "{}");
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];
		const names = /* @__PURE__ */ new Set();
		for (const value of Object.values(parsed)) {
			if (typeof value !== "string") continue;
			for (const match of value.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)) names.add(match[1]);
		}
		return [...names];
	} catch {
		return [];
	}
}
//#endregion
//#region src/host/custom-balance.ts
/**
* Custom HTTPS balance probe: user-configured URL + declarative extract rules.
* Portions adapted from dsh-cost-meter (MIT).
* @module dsh-usage-plus/host/custom-balance
*/
function toStrictNumber(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
	if (typeof value === "string") {
		const text = value.trim();
		if (text.length > 0 && /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(text)) return Number(text);
	}
	return NaN;
}
function parseExtractRule(raw) {
	const text = raw.trim();
	if (text === "") return null;
	if (text.startsWith("{") || text.startsWith("[")) try {
		return JSON.parse(text);
	} catch {
		return text;
	}
	return text;
}
function parseHeaders(raw) {
	try {
		const parsed = JSON.parse(raw || "{}");
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
		const out = {};
		for (const [key, value] of Object.entries(parsed)) if (typeof value === "string") out[key] = value;
		return out;
	} catch {
		return {};
	}
}
async function resolveTemplate(value, ctx) {
	const pattern = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
	let out = value;
	const names = [...value.matchAll(pattern)].map((match) => match[1]);
	const credentials = ctx.get?.("credentials");
	for (const name of names) {
		let resolved = "";
		try {
			const hit = await credentials?.resolve(credentialRef(name));
			if (typeof hit?.value === "string" && hit.value.trim() !== "") resolved = hit.value.trim();
		} catch {}
		if (resolved === "") resolved = String(process.env[name] ?? "").trim();
		out = out.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, "g"), () => resolved);
	}
	return out;
}
async function resolveHeaders(headers, ctx) {
	const out = {};
	for (const [key, value] of Object.entries(headers)) out[key] = await resolveTemplate(value, ctx);
	return out;
}
function formatRemaining(value) {
	if (Number.isInteger(value)) return String(value);
	return value.toFixed(4).replace(/\.?0+$/, "");
}
/** Probe one custom HTTPS balance endpoint into a provider snapshot row. */
async function probeCustomBalance(ctx, options) {
	if (!options.enabled) return [];
	const label = options.label.trim() || "Custom balance";
	const provider = "custom:http-balance";
	const fail = (error) => [{
		provider,
		displayName: label,
		credential: "env",
		supported: true,
		balanceSupported: true,
		source: "custom",
		balanceError: error,
		updatedAt: Date.now()
	}];
	if (!options.url.trim()) return fail("custom balance URL is required");
	let parsedUrl;
	try {
		parsedUrl = new URL(options.url.trim());
	} catch {
		return fail("custom balance URL is invalid");
	}
	if (parsedUrl.protocol !== "https:") return fail("custom balance URL must use https");
	const headersRaw = parseHeaders(options.headersJson);
	const usesCredentials = Object.values(headersRaw).some((value) => /\{\{\s*[A-Za-z_][A-Za-z0-9_]*\s*\}\}/.test(value));
	const host = parsedUrl.host.toLowerCase();
	const allowed = options.allowedHosts.split(",").map((item) => item.trim().toLowerCase()).filter((item) => item !== "");
	if (usesCredentials && allowed.length > 0 && !allowed.includes(host)) return fail(`host ${host} is not in allowedHosts`);
	try {
		const headers = await resolveHeaders(headersRaw, ctx);
		const method = (options.method || "GET").toUpperCase();
		const response = await fetch(parsedUrl.toString(), {
			method,
			headers: {
				accept: "application/json",
				...headers
			},
			redirect: "manual",
			signal: AbortSignal.timeout(15e3)
		});
		if (response.status >= 300 && response.status < 400) return fail("redirect refused");
		if (!response.ok) return fail(`HTTP ${response.status}`);
		const body = await response.json().catch(() => null);
		if (body === null) return fail("response is not JSON");
		const remaining = extractByRule(body, parseExtractRule(options.extractRemaining));
		const amount = typeof remaining === "number" ? remaining : toStrictNumber(remaining);
		if (!Number.isFinite(amount)) return fail("extract.remaining did not yield a number");
		return [{
			provider,
			displayName: label,
			credential: "env",
			supported: true,
			balanceSupported: true,
			source: "custom",
			balance: {
				currency: (options.currency || "USD").toUpperCase(),
				totalBalance: formatRemaining(amount),
				updatedAt: Date.now()
			},
			updatedAt: Date.now()
		}];
	} catch (error) {
		return fail(error instanceof Error ? error.message : String(error));
	}
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
/** Probe timeout per HTTP call. */
const PROBE_TIMEOUT_MS = 1e4;
/** Ledger flush debounce. */
const FLUSH_DEBOUNCE_MS = 3e3;
/** How many daily rows the Codex-style heatmap receives (26 weeks). */
const HEATMAP_DAYS = 182;
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
/**
* Read a foreign settings namespace's resolved value (the llm adapter
* profiles, the agent default model). Unregistered namespaces read as
* undefined; nothing here throws into the poll loop.
*/
function readNamespace(ctx, ns) {
	try {
		const settings = service(ctx, "settings");
		if (settings === void 0) return void 0;
		return settings.get(ns);
	} catch {
		return;
	}
}
var UsageService = class {
	ctx;
	options;
	persistDir;
	ledgerPath;
	snapshotsPath;
	ledger = createLedgerDocument();
	snapshots = /* @__PURE__ */ new Map();
	/** The official DeepSeek family's real-spend watch (see SpendWatch). */
	spendWatch;
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
	constructor(ctx, options) {
		this.ctx = ctx;
		this.options = options;
		this.persistDir = join(dshHome(), "dsh-usage-plus");
		this.ledgerPath = join(this.persistDir, "usage-ledger.json");
		this.snapshotsPath = join(this.persistDir, "provider-snapshots.json");
	}
	/** Start the listeners, load persisted state, and arm the first poll. */
	start() {
		this.sessionListenerDisposer = this.ctx.on("session/event", (session, event) => this.onSessionEvent(session, event));
		this.loadPersisted();
		this.rearmPoll(2e3);
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
		return this.flushLedger();
	}
	/** Re-apply options live (settings change); retention shrink prunes now. */
	applyOptions(options) {
		this.options = options;
		this.pruneIfNeeded();
	}
	/** Force one poll now (manual refresh route); joins an in-flight cycle. */
	async refresh() {
		await this.pollNow();
	}
	/** Assemble the overview document the browser section renders. */
	async overview() {
		this.syncCurrentFromComposer();
		const todayKey = localDateKey(Date.now());
		const routes = this.listProviderRoutes();
		const providers = [];
		for (const route of routes) {
			const adapter = adapterFor(route.id);
			const snapshot = this.snapshots.get(route.id);
			const error = snapshot?.balanceError ?? snapshot?.planError;
			providers.push({
				provider: route.id,
				source: "model",
				displayName: route.displayName || adapter?.displayName || route.id,
				credential: snapshot?.credential ?? "none",
				supported: adapter !== void 0 && (adapter.balance !== void 0 || adapter.plan !== void 0),
				...adapter?.balance !== void 0 ? { balanceSupported: true } : {},
				...adapter?.plan !== void 0 ? { planSupported: true } : {},
				...snapshot?.balance !== void 0 ? { balance: snapshot.balance } : {},
				...snapshot?.plan !== void 0 ? { plan: snapshot.plan } : {},
				...error !== void 0 ? { error } : {},
				...snapshot?.updatedAt !== void 0 ? { updatedAt: snapshot.updatedAt } : {}
			});
		}
		for (const snapshot of this.snapshots.values()) {
			if (snapshot.source !== "cpamc" && snapshot.source !== "volcano" && snapshot.source !== "custom") continue;
			const error = snapshot.balanceError ?? snapshot.planError;
			providers.push({
				...snapshot,
				...error !== void 0 ? { error } : {}
			});
		}
		providers.sort((a, b) => Number(b.supported) - Number(a.supported) || a.displayName.localeCompare(b.displayName));
		const allKeys = ledgerDayKeys(this.ledger);
		const heatmapKeys = allKeys.slice(-Math.min(HEATMAP_DAYS, this.options.retainDays));
		const rangeKeys = allKeys.slice(-30);
		const range = summarizeDays(rangeKeys.map((key) => this.ledger.days[key] ?? {}));
		const all = summarizeDays(allKeys.map((key) => this.ledger.days[key] ?? {}));
		const baseURL = this.current.provider !== void 0 ? this.piAiProfile(this.current.provider)?.baseURL : void 0;
		return {
			updatedAt: Date.now(),
			providers,
			current: {
				...this.current,
				...typeof baseURL === "string" && baseURL.trim() !== "" ? { baseURL: baseURL.trim() } : {}
			},
			externalCredentials: await this.externalCredentialStatus(),
			usage: {
				today: this.daySummary(todayKey),
				days: heatmapKeys.map((date) => {
					return {
						date,
						totals: this.daySummary(date).totals
					};
				}),
				range: {
					from: rangeKeys[0] ?? todayKey,
					to: rangeKeys[rangeKeys.length - 1] ?? todayKey,
					totals: range.totals,
					providers: range.providers
				},
				all: {
					from: allKeys[0] ?? todayKey,
					to: allKeys[allKeys.length - 1] ?? todayKey,
					totals: all.totals,
					providers: all.providers
				},
				...this.spendWatch !== void 0 && this.spendWatch.accruedCny > 0 ? { observedSpend: {
					cny: this.spendWatch.accruedCny,
					since: this.spendWatch.since
				} } : {}
			}
		};
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
			return { ok: true };
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error.message : "credential clear failed"
			};
		}
	}
	/** Configured/missing flags only — never the secret values. */
	async externalCredentialStatus() {
		const customVars = {};
		for (const name of customBalanceCredentialVars(this.options.customBalanceHeadersJson)) customVars[name] = await this.isEnvConfigured(name);
		return {
			cpamc: await this.isEnvConfigured(this.options.cpamcManagementKeyEnv),
			volcanoAk: await this.isEnvConfigured(this.options.volcanoAccessKeyEnv),
			volcanoSk: await this.isEnvConfigured(this.options.volcanoSecretKeyEnv),
			...Object.keys(customVars).length > 0 ? { customVars } : {}
		};
	}
	externalCredentialEnv(target) {
		if (target === "cpamc") return this.options.cpamcManagementKeyEnv;
		if (target === "volcano.ak") return this.options.volcanoAccessKeyEnv;
		if (target === "volcano.sk") return this.options.volcanoSecretKeyEnv;
		if (target.startsWith("customVar:")) {
			const name = target.slice(10);
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("invalid custom var name");
			return name;
		}
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
	/** One local day aggregated per provider. */
	daySummary(dateKey) {
		const { totals, providers } = summarizeDays([this.ledger.days[dateKey] ?? {}]);
		return {
			date: dateKey,
			totals,
			providers
		};
	}
	/** Today's ledger spend for one provider's adapter family (0 when unpriced). */
	familyCostToday(provider) {
		const family = adapterFor(provider);
		if (family === void 0) return 0;
		let cost = 0;
		for (const row of this.daySummary(localDateKey(Date.now())).providers) if (adapterFor(row.provider) === family) cost += row.totals.cost;
		return cost;
	}
	/** Today's ledger totals for one provider route (the exact id, not the family). */
	providerUsageToday(provider) {
		return this.daySummary(localDateKey(Date.now())).providers.find((entry) => entry.provider === provider)?.totals ?? emptyTotals();
	}
	/**
	* Accrue the official DeepSeek family's real spend from observed CNY
	* balance decreases; a balance rise is a top-up and never counts. The
	* family's route ids can alias one account, so the watch follows the
	* largest balance seen this cycle and accrues only decreases of that
	* series — a failed probe keeps the stale balance and accrues nothing
	* until the next success reports the whole drop at once.
	*/
	accrueDeepSeekSpend() {
		let balanceCny;
		for (const [id, snapshot] of this.snapshots) {
			if (!isDeepSeekProviderRoute(id)) continue;
			const balance = snapshot.balance;
			if (balance === void 0 || balance.currency.toUpperCase() !== "CNY") continue;
			const value = Number(balance.totalBalance);
			if (!Number.isFinite(value)) continue;
			balanceCny = balanceCny === void 0 ? value : Math.max(balanceCny, value);
		}
		if (balanceCny === void 0) return;
		const watch = this.spendWatch ?? {
			accruedCny: 0,
			since: Date.now()
		};
		if (watch.lastBalanceCny !== void 0 && balanceCny < watch.lastBalanceCny) watch.accruedCny += watch.lastBalanceCny - balanceCny;
		watch.lastBalanceCny = balanceCny;
		this.spendWatch = watch;
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
					this.current = {
						provider: config.provider,
						model: config.model,
						source: "live"
					};
				}
			} else if (event.type === "request/context") {
				const data = event.data;
				if (data.provider !== void 0) {
					this.sessionRoutes.set(session, {
						provider: data.provider,
						model: data.model ?? ""
					});
					this.current = {
						provider: data.provider,
						model: data.model,
						source: "live"
					};
				}
			} else if (event.type === "assistant/message") {
				const usage = event.data.usage;
				if (usage === void 0) return;
				const route = this.sessionRoutes.get(session);
				if (route === void 0 || route.provider === "") return;
				foldUsage(this.ledger, Date.now(), route.provider, route.model || "unknown", this.totalsFrom(usage, route.provider, route.model || "unknown", Date.now()));
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
		const selected = readNamespace(this.ctx, "agent-default-model");
		if (selected?.provider === void 0 || selected.provider === "") return;
		if (this.current.provider === selected.provider && this.current.model === selected.model) return;
		this.current = {
			provider: selected.provider,
			model: selected.model,
			source: "default"
		};
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
			if (rawLedger !== void 0) {
				const loaded = deserializeLedger(JSON.parse(rawLedger));
				for (const [dayKey, providers] of Object.entries(loaded.days)) {
					const atMs = (/* @__PURE__ */ new Date(dayKey + "T12:00:00")).getTime();
					for (const [provider, models] of Object.entries(providers)) for (const [model, totals] of Object.entries(models)) foldUsage(this.ledger, atMs, provider, model, totals);
				}
				pruneLedger(this.ledger, localDateKey(Date.now()), this.options.retainDays);
				this.lastPrune = {
					dayKey: localDateKey(Date.now()),
					retainDays: this.options.retainDays
				};
			}
			if (rawSnapshots !== void 0) {
				const parsed = JSON.parse(rawSnapshots);
				if (typeof parsed === "object" && parsed !== null && typeof parsed.providers === "object" && parsed.providers !== null) {
					for (const [provider, snapshot] of Object.entries(parsed.providers)) if (typeof snapshot === "object" && snapshot !== null && typeof snapshot.provider === "string") this.snapshots.set(provider, snapshot);
				}
				const watch = parsed.spendWatch;
				if (typeof watch === "object" && watch !== null && typeof watch.accruedCny === "number" && Number.isFinite(watch.accruedCny) && watch.accruedCny >= 0 && typeof watch.since === "number" && Number.isFinite(watch.since) && watch.since > 0) this.spendWatch = {
					accruedCny: watch.accruedCny,
					since: watch.since,
					...typeof watch.lastBalanceCny === "number" && Number.isFinite(watch.lastBalanceCny) ? { lastBalanceCny: watch.lastBalanceCny } : {}
				};
			}
		} catch {} finally {
			this.loaded = true;
		}
	}
	scheduleFlush() {
		if (this.flushTimer !== void 0 || this.disposed) return;
		this.flushTimer = setTimeout(() => {
			this.flushTimer = void 0;
			this.flushLedger();
		}, FLUSH_DEBOUNCE_MS);
	}
	/**
	* Queue one ledger flush behind the previous one. Debounce and stop-time
	* flushes serialize here, so two `writeJsonAtomic` calls can never run
	* concurrently on the same path.
	*/
	flushLedger() {
		const next = this.flushChain.then(() => this.writeLedgerOnce());
		this.flushChain = next.catch(() => {});
		return next;
	}
	async writeLedgerOnce() {
		if (!this.loaded) return;
		try {
			await mkdir(dirname(this.ledgerPath), { recursive: true });
			await writeJsonAtomic(this.ledgerPath, this.ledger);
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
		if (pruned > 0) this.scheduleFlush();
	}
	async persistSnapshots() {
		if (!this.loaded) return;
		try {
			await mkdir(dirname(this.snapshotsPath), { recursive: true });
			await writeJsonAtomic(this.snapshotsPath, {
				version: 1,
				providers: Object.fromEntries(this.snapshots),
				...this.spendWatch !== void 0 ? { spendWatch: this.spendWatch } : {}
			});
		} catch {}
	}
	rearmPoll(delayMs) {
		if (this.disposed) return;
		if (this.pollTimer !== void 0) clearTimeout(this.pollTimer);
		this.pollTimer = setTimeout(() => {
			this.pollTimer = void 0;
			this.pollNow().finally(() => this.rearmPoll(Math.max(30, this.options.pollIntervalSec) * 1e3));
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
				for (const route of routes) {
					if (this.disposed) return;
					seen.add(route.id);
					const adapter = adapterFor(route.id);
					if (adapter === void 0 || adapter.balance === void 0 && adapter.plan === void 0) continue;
					await this.probeRoute(route, adapter);
				}
				for (const id of [...this.snapshots.keys()]) if (!seen.has(id) && !id.startsWith("cpamc:") && !id.startsWith("volcano:") && !id.startsWith("custom:")) this.snapshots.delete(id);
				await this.probeExternalSources();
				if (this.disposed) return;
				this.accrueDeepSeekSpend();
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
	listProviderRoutes() {
		const routes = /* @__PURE__ */ new Map();
		const runtime = service(this.ctx, "llm");
		if (runtime !== void 0) try {
			for (const provider of runtime.listProviders()) if (provider.id !== "") routes.set(provider.id, provider.name);
			for (const provider of runtime.listConfigurableProviders()) if (!routes.has(provider.provider)) routes.set(provider.provider, provider.displayName);
		} catch {}
		return [...routes].map(([id, displayName]) => ({
			id,
			displayName
		}));
	}
	async probeRoute(route, adapter) {
		const credential = await this.resolveCredential(route.id);
		const previous = this.snapshots.get(route.id);
		if (credential.key === void 0) {
			this.snapshots.set(route.id, {
				provider: route.id,
				displayName: route.displayName || adapter.displayName,
				credential: credential.kind,
				supported: true,
				updatedAt: Date.now()
			});
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
			try {
				const spec = half.build({
					apiKey: credential.key,
					...credential.accountId !== void 0 ? { accountId: credential.accountId } : {}
				});
				const response = await fetch(spec.url, {
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
		this.snapshots.set(route.id, snapshot);
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
				const accountId = typeof payload.chatgpt_account_id === "string" && payload.chatgpt_account_id !== "" ? payload.chatgpt_account_id : void 0;
				if (access !== void 0) return {
					kind: "oauth",
					key: access,
					...accountId !== void 0 ? { accountId } : {}
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
		for (const id of [...this.snapshots.keys()]) if (id.startsWith("cpamc:") || id.startsWith("volcano:") || id.startsWith("custom:")) this.snapshots.delete(id);
		try {
			const rows = await probeCpamc({
				enabled: this.options.cpamcEnabled,
				baseURL: this.options.cpamcBaseURL,
				managementKey: await this.resolveEnv(this.options.cpamcManagementKeyEnv)
			});
			for (const row of rows) this.snapshots.set(row.provider, row);
		} catch {}
		try {
			const rows = await probeVolcano({
				enabled: this.options.volcanoEnabled,
				accessKeyId: await this.resolveEnv(this.options.volcanoAccessKeyEnv),
				secretAccessKey: await this.resolveEnv(this.options.volcanoSecretKeyEnv)
			});
			for (const row of rows) this.snapshots.set(row.provider, row);
		} catch {}
		try {
			const rows = await probeCustomBalance(this.ctx, {
				enabled: this.options.customBalanceEnabled,
				label: this.options.customBalanceLabel,
				currency: this.options.customBalanceCurrency,
				url: this.options.customBalanceUrl,
				method: this.options.customBalanceMethod,
				headersJson: this.options.customBalanceHeadersJson,
				extractRemaining: this.options.customBalanceExtractRemaining,
				allowedHosts: this.options.customBalanceAllowedHosts
			});
			for (const row of rows) this.snapshots.set(row.provider, row);
		} catch {}
	}
	/** The llm-pi-ai profile object for one provider route, when configured. */
	piAiProfile(provider) {
		return readNamespace(this.ctx, "llm-pi-ai")?.providers?.[provider];
	}
	/** The DeepSeek official adapter's credential reference name. */
	deepseekApiKeyEnv() {
		return readNamespace(this.ctx, "llm-deepseek")?.apiKeyEnv ?? "DEEPSEEK_API_KEY";
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
//#region src/host/http.ts
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
const FIXED_CREDENTIAL_TARGETS = /* @__PURE__ */ new Set([
	"cpamc",
	"volcano.ak",
	"volcano.sk"
]);
function parseCredentialTarget(raw) {
	if (typeof raw !== "string") return void 0;
	if (FIXED_CREDENTIAL_TARGETS.has(raw)) return raw;
	if (/^customVar:([A-Za-z_][A-Za-z0-9_]*)$/.exec(raw) !== null) return raw;
}
/**
* Loopback-fenced overview route: provider balances, plan quotas, and token
* usage totals. Personal account data, so the loopback fence mirrors
* dsh-perf's stats surface; the browser runs on the same machine.
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
			writeJson(res, 200, await service.overview(), { "cache-control": "no-store" });
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
//#endregion
//#region src/index.ts
const name = "dsh-usage-plus";
const inject = ["webServer"];
const USAGE_SETTINGS_NAMESPACE = "dsh-usage-plus";
const Config = z.object({
	enabled: z.boolean().default(true),
	pollIntervalSec: z.number().min(30).max(3600).default(60),
	bubbleMode: z.string().default("always"),
	retainDays: z.number().min(7).max(730).default(182),
	cpamcEnabled: z.boolean().default(false),
	cpamcBaseURL: z.string().default("http://127.0.0.1:8317"),
	cpamcManagementKeyEnv: z.string().default("CPAMC_MANAGEMENT_KEY"),
	volcanoEnabled: z.boolean().default(false),
	volcanoAccessKeyEnv: z.string().default("VOLC_ACCESSKEY"),
	volcanoSecretKeyEnv: z.string().default("VOLC_SECRETKEY"),
	customBalanceEnabled: z.boolean().default(false),
	customBalanceLabel: z.string().default("Custom balance"),
	customBalanceCurrency: z.string().default("USD"),
	customBalanceUrl: z.string().default(""),
	customBalanceMethod: z.string().default("GET"),
	customBalanceHeadersJson: z.string().default("{\"Authorization\":\"Bearer {{API_KEY}}\"}"),
	customBalanceExtractRemaining: z.string().default("data.total_available"),
	customBalanceAllowedHosts: z.string().default("")
});
function resolveConfig(config) {
	const bubbleMode = config?.bubbleMode === "change" || config?.bubbleMode === "off" ? config.bubbleMode : "always";
	return {
		enabled: config?.enabled ?? true,
		pollIntervalSec: typeof config?.pollIntervalSec === "number" ? config.pollIntervalSec : 60,
		bubbleMode,
		retainDays: typeof config?.retainDays === "number" ? config.retainDays : 182,
		cpamcEnabled: config?.cpamcEnabled ?? false,
		cpamcBaseURL: config?.cpamcBaseURL ?? "http://127.0.0.1:8317",
		cpamcManagementKeyEnv: config?.cpamcManagementKeyEnv ?? "CPAMC_MANAGEMENT_KEY",
		volcanoEnabled: config?.volcanoEnabled ?? false,
		volcanoAccessKeyEnv: config?.volcanoAccessKeyEnv ?? "VOLC_ACCESSKEY",
		volcanoSecretKeyEnv: config?.volcanoSecretKeyEnv ?? "VOLC_SECRETKEY",
		customBalanceEnabled: config?.customBalanceEnabled ?? false,
		customBalanceLabel: config?.customBalanceLabel ?? "Custom balance",
		customBalanceCurrency: config?.customBalanceCurrency ?? "USD",
		customBalanceUrl: config?.customBalanceUrl ?? "",
		customBalanceMethod: config?.customBalanceMethod ?? "GET",
		customBalanceHeadersJson: config?.customBalanceHeadersJson ?? "{\"Authorization\":\"Bearer {{API_KEY}}\"}",
		customBalanceExtractRemaining: config?.customBalanceExtractRemaining ?? "data.total_available",
		customBalanceAllowedHosts: config?.customBalanceAllowedHosts ?? ""
	};
}
const apply = mountOnce("dsh-usage-plus", (ctx, config) => {
	let source = () => config ?? {};
	let service;
	let pendingStop;
	let disposeRoutes;
	const rearm = () => {
		const value = resolveConfig(source());
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
					makeUsageCredentialsRoute(next)
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
		try {
			if (typeof settingsCtx.settings?.installSection === "function") settingsCtx.settings.installSection(ctx, USAGE_SETTINGS_NAMESPACE, Config, config ?? {}, {
				setSource: (next) => {
					source = next;
					rearm();
				},
				onChange: rearm
			});
			else if (typeof settingsCtx.settings?.register === "function") {
				const scope = settingsCtx.settings.register(USAGE_SETTINGS_NAMESPACE, Config, { base: config ?? {} });
				source = () => scope?.get?.() ?? config ?? {};
				scope?.watch?.(() => {
					rearm();
				});
				rearm();
			}
		} catch {}
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
export { Config, USAGE_SETTINGS_NAMESPACE, apply, inject, name, resolveConfig };

//# sourceMappingURL=index.js.map