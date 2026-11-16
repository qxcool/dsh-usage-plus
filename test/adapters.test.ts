import { describe, expect, it } from 'vitest'
import {
  PROVIDER_ADAPTERS,
  adapterFor,
  dedupeProviderAliasRoutes,
  probeHalfAllowed,
  type ProviderAdapter,
} from '../src/core/adapters.ts'

/** Resolve an adapter, failing loudly (instead of a cryptic undefined) when missing. */
function adapter(id: string): ProviderAdapter {
  const found = adapterFor(id)
  if (found === undefined) throw new Error(`no adapter registered for ${id}`)
  return found
}

/** Resolve one plan probe half of an adapter. */
function half(id: string, kind: 'plan'): NonNullable<ProviderAdapter['plan']>
/** Resolve one balance probe half of an adapter. */
function half(id: string, kind: 'balance'): NonNullable<ProviderAdapter['balance']>
function half(id: string, kind: 'balance' | 'plan') {
  const probe = adapter(id)[kind]
  if (probe === undefined) throw new Error(`adapter ${id} has no ${kind} half`)
  return probe
}

const OAUTH = { apiKey: 'oauth-access-token', refreshToken: 'github-token' }
const API_KEY = { apiKey: 'raw-api-key' }

describe('adapter registry', () => {
  it('has no duplicate route id across adapters', () => {
    const ids = PROVIDER_ADAPTERS.flatMap((entry) => [...entry.ids])
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('resolves adapterFor for every registered id', () => {
    for (const entry of PROVIDER_ADAPTERS) {
      expect(entry.ids.length).toBeGreaterThan(0)
      for (const id of entry.ids) expect(adapterFor(id)).toBe(entry)
    }
  })

  it('keeps the existing adapters resolvable', () => {
    const existing = [
      'deepseek', 'deepseek-official', 'moonshotai', 'moonshotai-cn', 'kimi-coding',
      'opencode-go', 'minimax', 'minimax-cn', 'openai-codex', 'openrouter',
      'siliconflow', 'siliconflow-cn', 'siliconflow-intl', 'zenmux',
    ]
    for (const id of existing) expect(adapterFor(id)).toBeDefined()
    expect(adapterFor('not-a-provider')).toBeUndefined()
  })

  it('registers the five new/updated routes', () => {
    for (const id of ['anthropic', 'vercel-ai-gateway', 'github-copilot', 'nano-gpt', 'zai']) {
      expect(adapterFor(id)).toBeDefined()
    }
  })
})

describe('Z.AI route-id fix', () => {
  it('serves zai and the legacy zai-coding alias from one intl adapter', () => {
    const intl = adapter('zai')
    expect(adapter('zai-coding')).toBe(intl)
    expect(intl.ids).toEqual(['zai', 'zai-coding'])
    expect(intl.preferredId).toBe('zai')
    expect(intl.displayName).toBe('GLM Coding Plan')
  })

  it('leaves the CN adapter on its own endpoint', () => {
    const cn = adapter('zai-coding-cn')
    expect(cn).not.toBe(adapter('zai'))
    expect(cn.preferredId).toBeUndefined()
    expect(half('zai-coding-cn', 'plan').build(API_KEY)).toEqual({
      url: 'https://open.bigmodel.cn/api/monitor/usage/quota/limit',
      headers: { authorization: 'raw-api-key', 'accept-language': 'en-US,en' },
    })
  })

  it('dedupes zai vs zai-coding onto zai, regardless of order', () => {
    expect(dedupeProviderAliasRoutes([{ id: 'zai-coding' }, { id: 'zai' }]).map((route) => route.id)).toEqual(['zai'])
    expect(dedupeProviderAliasRoutes([{ id: 'zai' }, { id: 'zai-coding' }]).map((route) => route.id)).toEqual(['zai'])
    expect(dedupeProviderAliasRoutes([
      { id: 'deepseek' },
      { id: 'zai-coding' },
      { id: 'other-route' },
      { id: 'zai' },
    ]).map((route) => route.id)).toEqual(['deepseek', 'other-route', 'zai'])
  })

  it('parses the unchanged GLM quota sample', () => {
    const parsed = half('zai', 'plan').parse(200, {
      success: true,
      data: {
        level: 'max',
        limits: [
          { unit: 3, percentage: 12.5, nextResetTime: 1_800_000_000_000 },
          { unit: 6, percentage: 45, nextResetTime: 1_800_500_000_000 },
          { unit: 9, percentage: 999 },
        ],
      },
    })
    expect(parsed?.planName).toBe('max')
    expect(parsed?.windows.map((window) => window.key)).toEqual(['5h', 'week', 'unit-9'])
    expect(parsed?.windows[0]?.percent).toBe(12.5)
    expect(parsed?.windows[2]?.percent).toBe(100)
    expect(parsed?.windows[0]?.resetsAt).toBe('2027-01-15T08:00:00.000Z')
  })
})

describe('Anthropic subscription plan', () => {
  it('builds the OAuth usage probe with the required headers', () => {
    const plan = half('anthropic', 'plan')
    expect(plan.credential).toBe('oauth')
    expect(plan.build(OAUTH)).toEqual({
      url: 'https://api.anthropic.com/api/oauth/usage',
      headers: {
        authorization: 'Bearer oauth-access-token',
        'anthropic-beta': 'oauth-2025-04-20',
        'user-agent': 'claude-code/2.0.0',
        accept: 'application/json',
      },
    })
  })

  it('parses the real capture into 5h/week plus sonnet/opus extras', () => {
    const parsed = half('anthropic', 'plan').parse(200, {
      five_hour: { utilization: 33.0, resets_at: '2026-04-11T07:00:00.528743+00:00' },
      seven_day: { utilization: 13.0, resets_at: '2026-04-17T00:59:59.951713+00:00' },
      seven_day_opus: null,
      seven_day_sonnet: { utilization: 1.0, resets_at: '2026-04-16T03:00:00.951719+00:00' },
      extra_usage: { is_enabled: false, monthly_limit: null, used_credits: null, utilization: null },
    })
    expect(parsed?.planName).toBeUndefined()
    expect(parsed?.windows).toEqual([
      { key: '5h', percent: 33, resetsAt: '2026-04-11T07:00:00.528Z' },
      { key: 'week', percent: 13, resetsAt: '2026-04-17T00:59:59.951Z' },
      { key: 'week-sonnet', percent: 1, resetsAt: '2026-04-16T03:00:00.951Z' },
    ])
  })

  it('skips null windows and keeps percent 0 with no reset', () => {
    const parsed = half('anthropic', 'plan').parse(200, {
      five_hour: { utilization: 0, resets_at: null },
      seven_day: null,
      seven_day_sonnet: { utilization: null, resets_at: null },
      seven_day_opus: { utilization: 7, resets_at: '2026-04-16T03:00:00Z' },
      extra_usage: { is_enabled: true },
    })
    expect(parsed?.windows).toHaveLength(2)
    expect(parsed?.windows[0]).toEqual({ key: '5h', percent: 0 })
    expect(parsed?.windows[0]?.resetsAt).toBeUndefined()
    expect(parsed?.windows[1]?.key).toBe('week-opus')
    expect(parsed?.windows[1]?.percent).toBe(7)
  })

  it('clamps out-of-range utilization', () => {
    const parsed = half('anthropic', 'plan').parse(200, {
      five_hour: { utilization: 180 },
      seven_day: { utilization: -3 },
    })
    expect(parsed?.windows.map((window) => window.percent)).toEqual([100, 0])
  })

  it('returns undefined on error status and malformed bodies', () => {
    const plan = half('anthropic', 'plan')
    expect(plan.parse(401, {})).toBeUndefined()
    expect(plan.parse(429, { five_hour: { utilization: 5 } })).toBeUndefined()
    expect(plan.parse(200, null)).toBeUndefined()
    expect(plan.parse(200, 'not-json')).toBeUndefined()
    expect(plan.parse(200, {})).toBeUndefined()
    expect(plan.parse(200, { five_hour: null, seven_day: null })).toBeUndefined()
  })
})

describe('Vercel AI Gateway balance', () => {
  it('builds the Bearer credits probe', () => {
    const balance = half('vercel-ai-gateway', 'balance')
    expect(balance.credential).toBe('api-key')
    expect(balance.build(API_KEY)).toEqual({
      url: 'https://ai-gateway.vercel.sh/v1/credits',
      headers: { authorization: 'Bearer raw-api-key' },
    })
  })

  it('parses the official sample and ignores token_pass/total_used', () => {
    const parsed = half('vercel-ai-gateway', 'balance').parse(200, {
      balance: '95.50',
      token_pass: { remaining: '12.34', resets_at: '2026-12-01T00:00:00.000Z' },
      total_used: '4.50',
    })
    expect(parsed).toEqual({ currency: 'USD', totalBalance: '95.50' })
  })

  it('parses a null token_pass and numeric balances', () => {
    const balance = half('vercel-ai-gateway', 'balance')
    expect(balance.parse(200, { balance: '95.5', token_pass: null })).toEqual({ currency: 'USD', totalBalance: '95.50' })
    expect(balance.parse(200, { balance: 0 })).toEqual({ currency: 'USD', totalBalance: '0.00' })
  })

  it('returns undefined when balance is missing or invalid', () => {
    const balance = half('vercel-ai-gateway', 'balance')
    expect(balance.parse(200, { token_pass: null, total_used: '1.00' })).toBeUndefined()
    expect(balance.parse(200, { balance: 'not-a-number' })).toBeUndefined()
    expect(balance.parse(200, { balance: null })).toBeUndefined()
  })

  it('returns undefined on error status and malformed bodies', () => {
    const balance = half('vercel-ai-gateway', 'balance')
    expect(balance.parse(401, { balance: '95.50' })).toBeUndefined()
    expect(balance.parse(200, null)).toBeUndefined()
    expect(balance.parse(200, 'nope')).toBeUndefined()
  })
})

describe('GitHub Copilot plan', () => {
  const sample = {
    copilot_plan: 'business',
    quota_reset_date: '2026-11-01',
    quota_reset_date_utc: '2026-11-01T00:00:00.000Z',
    quota_snapshots: {
      chat: { unlimited: true, entitlement: 0, remaining: 0, percent_remaining: 100.0 },
      completions: { unlimited: true, entitlement: 0, remaining: 0, percent_remaining: 100.0 },
      premium_interactions: {
        unlimited: false,
        entitlement: 400000,
        remaining: 160587,
        percent_remaining: 40.1,
        credits_used: 239412,
        overage_permitted: true,
      },
    },
  }

  it('builds the probe with the forwarded GitHub token as a token header', () => {
    const plan = half('github-copilot', 'plan')
    expect(plan.credential).toBe('oauth')
    expect(plan.build(OAUTH)).toEqual({
      url: 'https://api.github.com/copilot_internal/user',
      headers: { authorization: 'token github-token', accept: 'application/json' },
    })
  })

  it('falls back to the resolved access token when no refresh token is forwarded', () => {
    expect(half('github-copilot', 'plan').build({ apiKey: 'copilot-bearer' })).toEqual({
      url: 'https://api.github.com/copilot_internal/user',
      headers: { authorization: 'token copilot-bearer', accept: 'application/json' },
    })
  })

  it('parses premium_interactions into a month window', () => {
    const parsed = half('github-copilot', 'plan').parse(200, sample)
    expect(parsed?.planName).toBe('business')
    expect(parsed?.windows).toHaveLength(1)
    expect(parsed?.windows[0]?.key).toBe('month')
    expect(parsed?.windows[0]?.percent).toBeCloseTo(59.9)
    expect(parsed?.windows[0]?.resetsAt).toBe('2026-11-01T00:00:00.000Z')
  })

  it('skips unlimited snapshots and clamps out-of-range percents', () => {
    const plan = half('github-copilot', 'plan')
    const high = plan.parse(200, {
      copilot_plan: 'individual',
      quota_snapshots: {
        chat: { unlimited: true, percent_remaining: 100 },
        premium_interactions: { unlimited: false, percent_remaining: -20 },
      },
    })
    expect(high?.windows).toHaveLength(1)
    expect(high?.windows[0]?.percent).toBe(100)
    expect(high?.windows[0]?.resetsAt).toBeUndefined()

    const low = plan.parse(200, {
      quota_snapshots: { premium_interactions: { unlimited: false, percent_remaining: 140 } },
    })
    expect(low?.windows[0]?.percent).toBe(0)
  })

  it('parses the legacy monthly_quotas / limited_user_quotas shape', () => {
    const parsed = half('github-copilot', 'plan').parse(200, {
      copilot_plan: 'individual',
      quota_reset_date_utc: '2026-11-01T00:00:00.000Z',
      monthly_quotas: { chat: 500, completions: 2000 },
      limited_user_quotas: { chat: 125, completions: 500 },
    })
    expect(parsed?.planName).toBe('individual')
    expect(parsed?.windows).toHaveLength(1)
    expect(parsed?.windows[0]?.key).toBe('month')
    expect(parsed?.windows[0]?.percent).toBe(75)
    expect(parsed?.windows[0]?.resetsAt).toBe('2026-11-01T00:00:00.000Z')
  })

  it('returns undefined when nothing usable is present', () => {
    const plan = half('github-copilot', 'plan')
    expect(plan.parse(200, { copilot_plan: 'business', quota_snapshots: { chat: { unlimited: true } } })).toBeUndefined()
    expect(plan.parse(200, { copilot_plan: 'business' })).toBeUndefined()
    expect(plan.parse(200, {})).toBeUndefined()
    expect(plan.parse(401, sample)).toBeUndefined()
    expect(plan.parse(200, 'nope')).toBeUndefined()
  })
})

describe('NanoGPT balance', () => {
  it('builds a POST x-api-key probe', () => {
    const balance = half('nano-gpt', 'balance')
    expect(balance.credential).toBe('api-key')
    expect(balance.build({ apiKey: 'nano-key' })).toEqual({
      url: 'https://nano-gpt.com/api/check-balance',
      method: 'POST',
      headers: { 'x-api-key': 'nano-key', accept: 'application/json' },
    })
  })

  it('parses usd_balance into USD and ignores nano_balance', () => {
    const parsed = half('nano-gpt', 'balance').parse(200, {
      usd_balance: '129.46956147',
      nano_balance: '26.71801147',
      nanoDepositAddress: 'nano_1example',
    })
    expect(parsed).toEqual({ currency: 'USD', totalBalance: '129.47' })
  })

  it('parses numeric balances', () => {
    const balance = half('nano-gpt', 'balance')
    expect(balance.parse(200, { usd_balance: 5 })).toEqual({ currency: 'USD', totalBalance: '5.00' })
    expect(balance.parse(200, { usd_balance: 0 })).toEqual({ currency: 'USD', totalBalance: '0.00' })
  })

  it('returns undefined for missing/invalid usd_balance', () => {
    const balance = half('nano-gpt', 'balance')
    expect(balance.parse(200, { nano_balance: '1.0' })).toBeUndefined()
    expect(balance.parse(200, { usd_balance: 'oops' })).toBeUndefined()
  })

  it('returns undefined on error status and malformed bodies', () => {
    const balance = half('nano-gpt', 'balance')
    expect(balance.parse(401, { usd_balance: '129.47' })).toBeUndefined()
    expect(balance.parse(200, null)).toBeUndefined()
    expect(balance.parse(200, 42)).toBeUndefined()
  })
})

describe('credential gates', () => {
  it('skips OAuth-only halves for API-key and env credentials', () => {
    expect(probeHalfAllowed(half('anthropic', 'plan').credential, 'oauth')).toBe(true)
    expect(probeHalfAllowed(half('anthropic', 'plan').credential, 'api-key')).toBe(false)
    expect(probeHalfAllowed(half('anthropic', 'plan').credential, 'env')).toBe(false)
    expect(probeHalfAllowed(half('github-copilot', 'plan').credential, 'api-key')).toBe(false)
  })

  it('skips API-key-only halves for OAuth and missing credentials', () => {
    expect(probeHalfAllowed(half('vercel-ai-gateway', 'balance').credential, 'api-key')).toBe(true)
    expect(probeHalfAllowed(half('vercel-ai-gateway', 'balance').credential, 'env')).toBe(true)
    expect(probeHalfAllowed(half('vercel-ai-gateway', 'balance').credential, 'oauth')).toBe(false)
    expect(probeHalfAllowed(half('vercel-ai-gateway', 'balance').credential, 'none')).toBe(false)
    expect(probeHalfAllowed(half('nano-gpt', 'balance').credential, 'api-key')).toBe(true)
  })

  it('keeps ungated halves open to every credential kind', () => {
    expect(probeHalfAllowed(undefined, 'none')).toBe(true)
    expect(probeHalfAllowed('any', 'oauth')).toBe(true)
    expect(half('deepseek', 'balance').credential).toBeUndefined()
  })
})
