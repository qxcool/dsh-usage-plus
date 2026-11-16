/**
 * models.dev price book behavior: catalog normalization into USD/1M rows,
 * conservative exact/canonical/short-name resolution with an explicit
 * confidence, mixed priced/unpriced USD estimate math, injectable fetch with
 * timeout/failure handling, and the atomic 24h on-disk cache. Every fixture is
 * local: no test hits the network or the user's data directory.
 */
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { summarizeDays } from '../src/core/ledger.ts'
import { emptyTotals, type UsageTokenTotals } from '../src/core/types.ts'
import {
  estimateUsd,
  fetchPriceBook,
  isPriceBookFresh,
  loadPriceBook,
  MODELS_DEV_TIMEOUT_MS,
  MODELS_DEV_URL,
  normalizeModelsDev,
  PRICE_BOOK_FILENAME,
  PRICE_BOOK_MAX_AGE_MS,
  PROVIDER_ALIASES,
  resolvePrice,
  savePriceBook,
  type FetchLike,
  type PriceBook,
} from '../src/core/pricing-book.ts'

/** Two providers / three models, including cache_read, cache_write and a shared canonical id. */
const MINI_CATALOG = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    models: {
      'deepseek-flash': {
        id: 'deepseek-flash',
        name: 'DeepSeek V4.1 Flash',
        canonical_model_id: 'deepseek/deepseek-v4.1-flash-1017',
        cost: { input: 0.15, output: 0.6, cache_read: 0.003 },
      },
      'deepseek-v4-flash': {
        id: 'deepseek-v4-flash',
        name: 'DeepSeek V4 Flash',
        canonical_model_id: 'deepseek/deepseek-v4.1-flash-1017',
        cost: { input: 0.15, output: 0.6, cache_read: 0.003 },
      },
    },
  },
  moonshotai: {
    id: 'moonshotai',
    name: 'Moonshot AI',
    models: {
      'kimi-k3': {
        id: 'kimi-k3',
        name: 'Kimi K3',
        canonical_model_id: 'moonshotai/kimi-k3',
        cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3 },
      },
    },
  },
}

/** Alias / canonical / short-name surface across the provider families the host routes. */
const ALIAS_CATALOG = {
  deepseek: {
    models: {
      'deepseek-flash': {
        id: 'deepseek-flash',
        canonical_model_id: 'deepseek/deepseek-v4.1-flash-1017',
        cost: { input: 0.15, output: 0.6, cache_read: 0.003 },
      },
    },
  },
  openai: {
    models: { 'gpt-5.1': { id: 'gpt-5.1', cost: { input: 1.25, output: 10, cache_read: 0.125 } } },
  },
  'github-copilot': {
    models: {
      'claude-opus-4.7': {
        id: 'claude-opus-4.7',
        canonical_model_id: 'anthropic/claude-opus-4-7',
        cost: { input: 5, output: 25, cache_read: 0.5, cache_write: 6.25 },
      },
    },
  },
  openrouter: {
    models: {
      'anthropic/claude-sonnet-4-5': {
        id: 'anthropic/claude-sonnet-4-5',
        cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
      },
    },
  },
  vercel: {
    models: {
      'mistral/mistral-large-3': {
        id: 'mistral/mistral-large-3',
        canonical_model_id: 'mistral/mistral-large-2512',
        cost: { input: 0.5, output: 1.5, cache_read: 0.05 },
      },
    },
  },
  moonshotai: {
    models: {
      'kimi-k3': {
        id: 'kimi-k3',
        canonical_model_id: 'moonshotai/kimi-k3',
        cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3 },
      },
    },
  },
  'moonshotai-cn': {
    models: {
      'kimi-k3': {
        id: 'kimi-k3',
        canonical_model_id: 'moonshotai/kimi-k3',
        cost: { input: 2.9879, output: 14.9395, cache_read: 0.2988, cache_write: 2.9879 },
      },
    },
  },
  zai: {
    models: { 'glm-4.5': { id: 'glm-4.5', cost: { input: 0.6, output: 2.2, cache_read: 0.11, cache_write: 0 } } },
  },
  zhipuai: {
    models: { 'glm-4.5': { id: 'glm-4.5', cost: { input: 0.6, output: 2.2, cache_read: 0.11, cache_write: 0 } } },
  },
}

/** Cost rows the normalizer must reject: missing, zero, and malformed numbers. */
const MALFORMED_CATALOG = {
  free: {
    models: {
      'zero-cost': { id: 'zero-cost', cost: { input: 0, output: 0, cache_read: 0 } },
      'missing-cost': { id: 'missing-cost' },
      'nan-cost': { id: 'nan-cost', cost: { input: Number.NaN, output: 1 } },
      'string-cost': { id: 'string-cost', cost: { input: '0.5', output: 1 } },
      'negative-cost': { id: 'negative-cost', cost: { input: -1, output: 1 } },
      'no-cache': { id: 'no-cache', cost: { input: 2, output: 4 } },
      'zero-cache': { id: 'zero-cache', cost: { input: 2, output: 4, cache_read: 0, cache_write: 0 } },
    },
  },
  broken: null,
  arrayProvider: [],
}

/** Short names that collide, one pair with equal prices and one pair with different prices. */
const AMBIGUOUS_CATALOG = {
  openrouter: {
    models: {
      'anthropic/dup-model': { id: 'anthropic/dup-model', cost: { input: 1, output: 2 } },
      'other/dup-model': { id: 'other/dup-model', cost: { input: 9, output: 9 } },
    },
  },
  zenmux: {
    models: {
      'anthropic/same-model': { id: 'anthropic/same-model', cost: { input: 1, output: 2 } },
      'other/same-model': { id: 'other/same-model', cost: { input: 1, output: 2 } },
    },
  },
}

/** One canonical model published by the direct provider and a reseller at different prices. */
const RESELLER_CATALOG = {
  openai: {
    models: { 'gpt-x': { id: 'gpt-x', canonical_model_id: 'openai/gpt-x', cost: { input: 1, output: 2 } } },
  },
  acme: {
    models: { 'gpt-x': { id: 'gpt-x', canonical_model_id: 'openai/gpt-x', cost: { input: 5, output: 9 } } },
  },
}

const FETCHED_AT = 1_700_000_000_000

/** Build a fetched book from a fixture catalog. */
function bookFrom(catalog: unknown, fetchedAt = FETCHED_AT): PriceBook {
  return { ...normalizeModelsDev(catalog), fetchedAt, source: 'models.dev' }
}

/** A named totals bucket folded from partial values. */
function totals(partial: Partial<UsageTokenTotals>): UsageTokenTotals {
  return { ...emptyTotals(), ...partial }
}

/** Run a cache test against a fresh temp directory, always removing it afterwards. */
async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-pricing-book-'))
  try {
    await run(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('normalizeModelsDev', () => {
  it('normalizes the mini catalog into USD per-1M rows with cache fallbacks', () => {
    const normalized = normalizeModelsDev(MINI_CATALOG)
    expect(Object.keys(normalized.rows).sort()).toEqual([
      'deepseek/deepseek-flash',
      'deepseek/deepseek-v4-flash',
      'moonshotai/kimi-k3',
    ])
    // cache_read present, cache_write absent → write falls back to the miss price.
    expect(normalized.rows['deepseek/deepseek-flash']).toEqual({ miss: 0.15, hit: 0.003, write: 0.15, out: 0.6 })
    expect(normalized.rows['moonshotai/kimi-k3']).toEqual({ miss: 3, hit: 0.3, write: 3, out: 15 })
  })

  it('records canonical ids and namespaced short names as lookup tables', () => {
    const normalized = normalizeModelsDev(ALIAS_CATALOG)
    expect(normalized.byCanonical['deepseek/deepseek-v4.1-flash-1017']).toEqual(['deepseek/deepseek-flash'])
    expect(normalized.byCanonical['anthropic/claude-opus-4-7']).toEqual(['github-copilot/claude-opus-4.7'])
    expect(normalized.byShortName['claude-sonnet-4-5']).toEqual(['openrouter/anthropic/claude-sonnet-4-5'])
    expect(normalized.byShortName['mistral-large-3']).toEqual(['vercel/mistral/mistral-large-3'])
    // Plain provider-local ids are already exact, so they add no short-name entry.
    expect(normalized.byShortName['kimi-k3']).toBeUndefined()
  })

  it('drops missing, zero and malformed cost rows instead of pricing them', () => {
    const normalized = normalizeModelsDev(MALFORMED_CATALOG)
    expect(Object.keys(normalized.rows).sort()).toEqual(['free/no-cache', 'free/zero-cache'])
    expect(normalized.rows['free/no-cache']).toEqual({ miss: 2, hit: 2, write: 2, out: 4 })
  })

  it('keeps an explicitly published zero cache price', () => {
    const normalized = normalizeModelsDev(MALFORMED_CATALOG)
    expect(normalized.rows['free/zero-cache']).toEqual({ miss: 2, hit: 0, write: 0, out: 4 })
  })

  it('survives non-object providers and invalid root shapes', () => {
    expect(Object.keys(normalizeModelsDev(MALFORMED_CATALOG).rows)).toHaveLength(2)
    for (const invalid of [undefined, null, 'nope', 42, [], true]) {
      const normalized = normalizeModelsDev(invalid)
      expect(Object.keys(normalized.rows)).toEqual([])
      expect(Object.keys(normalized.byShortName)).toEqual([])
      expect(Object.keys(normalized.byCanonical)).toEqual([])
    }
  })
})

describe('resolvePrice', () => {
  const lookups = normalizeModelsDev(MINI_CATALOG)
  const aliasLookups = normalizeModelsDev(ALIAS_CATALOG)

  it('matches an exact provider/model key case-insensitively with high confidence', () => {
    const resolved = resolvePrice(lookups, 'DeepSeek', 'DeepSeek-Flash')
    expect(resolved).toEqual({
      row: { miss: 0.15, hit: 0.003, write: 0.15, out: 0.6 },
      via: 'exact',
      confidence: 'high',
      key: 'deepseek/deepseek-flash',
    })
  })

  it('resolves documented provider aliases to the catalog provider', () => {
    expect(PROVIDER_ALIASES['deepseek-official']).toEqual(['deepseek'])
    expect(resolvePrice(lookups, 'deepseek-official', 'deepseek-flash')?.key).toBe('deepseek/deepseek-flash')
    expect(resolvePrice(aliasLookups, 'openai-codex', 'gpt-5.1')?.row.miss).toBe(1.25)
    expect(resolvePrice(aliasLookups, 'github', 'claude-opus-4.7')?.key).toBe('github-copilot/claude-opus-4.7')
    expect(resolvePrice(aliasLookups, 'vercel-ai-gateway', 'mistral/mistral-large-3')?.key).toBe('vercel/mistral/mistral-large-3')
    expect(resolvePrice(aliasLookups, 'zai-coding', 'glm-4.5')?.row.write).toBe(0)
  })

  it('resolves the moonshot family without crossing regional price rows', () => {
    // Mini catalog only has the international row, so the CN route falls back to it.
    expect(resolvePrice(lookups, 'moonshotai-cn', 'kimi-k3')?.row.miss).toBe(3)
    expect(resolvePrice(lookups, 'kimi-coding', 'kimi-k3')?.row.miss).toBe(3)
    // With both regional rows present the exact CN key wins.
    expect(resolvePrice(aliasLookups, 'moonshotai-cn', 'kimi-k3')?.row.miss).toBe(2.9879)
    expect(resolvePrice(aliasLookups, 'moonshot', 'kimi-k3')?.row.miss).toBe(3)
  })

  it('resolves canonical model ids with medium confidence', () => {
    const resolved = resolvePrice(aliasLookups, 'deepseek', 'deepseek/deepseek-v4.1-flash-1017')
    expect(resolved?.via).toBe('canonical')
    expect(resolved?.confidence).toBe('medium')
    expect(resolved?.row).toEqual({ miss: 0.15, hit: 0.003, write: 0.15, out: 0.6 })
  })

  it('resolves a fully qualified canonical route model across providers', () => {
    const resolved = resolvePrice(aliasLookups, 'github-copilot', 'anthropic/claude-opus-4-7')
    expect(resolved?.via).toBe('canonical')
    expect(resolved?.key).toBe('github-copilot/claude-opus-4.7')
    expect(resolved?.row).toEqual({ miss: 5, hit: 0.5, write: 6.25, out: 25 })
  })

  it('resolves a namespaced short model name only inside the same provider family', () => {
    const resolved = resolvePrice(aliasLookups, 'openrouter', 'claude-sonnet-4-5')
    expect(resolved?.via).toBe('short')
    expect(resolved?.confidence).toBe('medium')
    expect(resolved?.key).toBe('openrouter/anthropic/claude-sonnet-4-5')
    expect(resolved?.row.miss).toBe(3)
    // The fully qualified id still takes the exact path.
    expect(resolvePrice(aliasLookups, 'openrouter', 'anthropic/claude-sonnet-4-5')?.via).toBe('exact')
  })

  it('misses conservatively across providers and unknown ids', () => {
    expect(resolvePrice(aliasLookups, 'openrouter', 'gpt-5.1')).toBeUndefined()
    expect(resolvePrice(aliasLookups, 'deepseek', 'kimi-k3')).toBeUndefined()
    expect(resolvePrice(aliasLookups, 'nobody', 'deepseek-flash')).toBeUndefined()
    expect(resolvePrice(lookups, '', 'deepseek-flash')).toBeUndefined()
    expect(resolvePrice(lookups, 'deepseek', '')).toBeUndefined()
    expect(resolvePrice(undefined, 'deepseek', 'deepseek-flash')).toBeUndefined()
    expect(resolvePrice(null, 'deepseek', 'deepseek-flash')).toBeUndefined()
  })

  it('misses an ambiguous canonical id instead of guessing a regional price', () => {
    // Both moonshot rows claim the same canonical id at different prices.
    expect(resolvePrice(aliasLookups, 'moonshot', 'moonshotai/kimi-k3')).toBeUndefined()
  })

  it("prefers the route family's own canonical row over a reseller conflict", () => {
    const reseller = normalizeModelsDev(RESELLER_CATALOG)
    const resolved = resolvePrice(reseller, 'acme', 'openai/gpt-x')
    expect(resolved?.via).toBe('canonical')
    expect(resolved?.key).toBe('acme/gpt-x')
    expect(resolved?.row).toEqual({ miss: 5, hit: 5, write: 5, out: 9 })
    // A provider outside both families still cannot pick between the two prices.
    expect(resolvePrice(reseller, 'other', 'openai/gpt-x')).toBeUndefined()
  })

  it('accepts agreeing short-name rows and rejects disagreeing ones', () => {
    const ambiguous = normalizeModelsDev(AMBIGUOUS_CATALOG)
    expect(resolvePrice(ambiguous, 'openrouter', 'dup-model')).toBeUndefined()
    const resolved = resolvePrice(ambiguous, 'zenmux', 'same-model')
    expect(resolved?.via).toBe('short')
    expect(resolved?.row).toEqual({ miss: 1, hit: 1, write: 1, out: 2 })
  })
})

describe('estimateUsd', () => {
  const book = bookFrom(MINI_CATALOG)

  it('prices priced model rows and counts unpriced calls/models honestly', () => {
    const priced = totals({ inputTokens: 1_000_000, cacheReadTokens: 2_000_000, cacheWriteTokens: 3_000_000, outputTokens: 4_000_000, calls: 5 })
    const unpriced = totals({ inputTokens: 1_000_000, outputTokens: 1_000_000, calls: 2 })
    const estimate = estimateUsd(
      {
        providers: [
          { provider: 'deepseek', totals: priced, models: [{ model: 'deepseek-flash', totals: priced }] },
          { provider: 'acme', totals: unpriced, models: [{ model: 'mystery-model', totals: unpriced }] },
        ],
      },
      book,
    )
    // 1M*mess .15 + 2M*cache .003 + 3M*write .15 + 4M*out .6 = 3.006 USD.
    expect(estimate.amount).toBe(3.006)
    expect(estimate.currency).toBe('USD')
    expect(estimate.source).toBe('models.dev')
    expect(estimate.priceBookUpdatedAt).toBe(FETCHED_AT)
    expect(estimate.pricedCalls).toBe(5)
    expect(estimate.totalCalls).toBe(7)
    expect(estimate.pricedModels).toBe(1)
    expect(estimate.totalModels).toBe(2)
  })

  it('accepts the ledger summarizeDays window shape directly', () => {
    const bucket = totals({ inputTokens: 2_000_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 500_000, outputTokens: 1_000_000, calls: 3 })
    const summary = summarizeDays([{ deepseek: { 'deepseek-flash': bucket } }])
    const estimate = estimateUsd(summary, book)
    // 2M*.15 + 1M*.003 + 0.5M*.15 + 1M*.6 = 0.978 USD.
    expect(estimate.amount).toBe(0.978)
    expect(estimate.pricedCalls).toBe(3)
    expect(estimate.totalCalls).toBe(3)
    expect(estimate.pricedModels).toBe(1)
    expect(estimate.totalModels).toBe(1)
  })

  it('omits the amount when no model row can be priced', () => {
    const bucket = totals({ inputTokens: 1_000, outputTokens: 1_000, calls: 1 })
    const result = estimateUsd({ providers: [{ provider: 'deepseek', totals: bucket, models: [] }] }, undefined)
    expect(result.amount).toBeUndefined()
    expect(result.pricedModels).toBe(0)
    expect(result.pricedCalls).toBe(0)
    expect(result.totalCalls).toBe(1)
    expect(result.totalModels).toBe(0)
    expect(result.priceBookUpdatedAt).toBeUndefined()
  })

  it('keeps model rows the summary capped as unpriced rather than double counting', () => {
    const listed = totals({ inputTokens: 1_000_000, outputTokens: 0, calls: 2 })
    const providerTotals = totals({ inputTokens: 2_000_000, outputTokens: 1_000_000, calls: 5 })
    const estimate = estimateUsd(
      { providers: [{ provider: 'deepseek', totals: providerTotals, models: [{ model: 'deepseek-flash', totals: listed }] }] },
      book,
    )
    expect(estimate.pricedCalls).toBe(2)
    expect(estimate.totalCalls).toBe(5)
    expect(estimate.pricedModels).toBe(1)
    expect(estimate.totalModels).toBe(1)
    expect(estimate.amount).toBe(0.15)
  })

  it('never throws on malformed numbers or malformed summaries', () => {
    const malformed = totals({
      inputTokens: Number.NaN,
      outputTokens: Number.POSITIVE_INFINITY,
      cacheReadTokens: -5,
      cacheWriteTokens: '12' as unknown as number,
      calls: Number.NaN,
    })
    const result = estimateUsd(
      { providers: [{ provider: 'deepseek', totals: malformed, models: [{ model: 'deepseek-flash', totals: malformed }] }] },
      book,
    )
    expect(result.amount).toBe(0)
    expect(result.totalCalls).toBe(0)
    expect(result.totalModels).toBe(1)
    expect(estimateUsd({} as unknown as Parameters<typeof estimateUsd>[0], book).totalCalls).toBe(0)
    expect(estimateUsd(undefined, undefined)).toEqual({
      currency: 'USD',
      pricedCalls: 0,
      totalCalls: 0,
      pricedModels: 0,
      totalModels: 0,
      source: 'models.dev',
    })
  })

  it('rounds the amount at the requested precision', () => {
    const bucket = totals({ inputTokens: 1, calls: 1 })
    expect(estimateUsd({ providers: [{ provider: 'deepseek', totals: bucket, models: [{ model: 'deepseek-flash', totals: bucket }] }] }, book).amount).toBe(0)
    const precise = estimateUsd(
      { providers: [{ provider: 'deepseek', totals: bucket, models: [{ model: 'deepseek-flash', totals: bucket }] }] },
      book,
      { roundDigits: 9 },
    )
    expect(precise.amount).toBeCloseTo(1.5e-7, 12)
  })
})

describe('fetchPriceBook', () => {
  it('fetches, normalizes and stamps the injected clock', async () => {
    const seen: { url: string; signal?: AbortSignal; initKeys: string[] } = { url: '', initKeys: [] }
    const fetchImpl: FetchLike = (url, init) => {
      seen.url = url
      seen.signal = init.signal
      seen.initKeys = Object.keys(init)
      return Promise.resolve({ ok: true, json: async () => MINI_CATALOG })
    }
    const fetched = await fetchPriceBook({ fetchImpl, now: () => 42 })
    expect(seen.url).toBe(MODELS_DEV_URL)
    expect(seen.signal).toBeInstanceOf(AbortSignal)
    // The request carries no headers/tokens: the catalog is public.
    expect(seen.initKeys).toEqual(['signal'])
    expect(fetched?.fetchedAt).toBe(42)
    expect(fetched?.source).toBe('models.dev')
    expect(fetched?.rows['deepseek/deepseek-flash'].out).toBe(0.6)
  })

  it('returns undefined on a non-2xx response', async () => {
    const fetched = await fetchPriceBook({ fetchImpl: async () => ({ ok: false, json: async () => MINI_CATALOG }) })
    expect(fetched).toBeUndefined()
  })

  it('returns undefined when the transport throws', async () => {
    const fetched = await fetchPriceBook({
      fetchImpl: async () => {
        throw new Error('network down')
      },
    })
    expect(fetched).toBeUndefined()
  })

  it('returns undefined when the body is unparsable or not a catalog object', async () => {
    const throwingJson = await fetchPriceBook({
      fetchImpl: async () => ({
        ok: true,
        json: async () => {
          throw new Error('bad json')
        },
      }),
    })
    expect(throwingJson).toBeUndefined()
    const arrayBody = await fetchPriceBook({ fetchImpl: async () => ({ ok: true, json: async () => [] }) })
    expect(arrayBody).toBeUndefined()
  })

  it('times out a stalled fetch and never throws', async () => {
    const started = Date.now()
    const fetched = await fetchPriceBook({
      fetchImpl: () =>
        new Promise(() => {
          // Never settles; the module's own timeout must win.
        }),
      timeoutMs: 10,
    })
    expect(fetched).toBeUndefined()
    expect(Date.now() - started).toBeLessThan(2_000)
  })
})

describe('price-book cache', () => {
  it('writes and reads the cache atomically with a versioned document', async () => {
    await withTempDir(async (dir) => {
      const book = bookFrom(MINI_CATALOG)
      await expect(savePriceBook(dir, book)).resolves.toBe(true)
      const names = await readdir(dir)
      expect(names).toEqual([PRICE_BOOK_FILENAME])
      const document = JSON.parse(await readFile(join(dir, PRICE_BOOK_FILENAME), 'utf8'))
      expect(document.version).toBe(1)
      expect(document.source).toBe('models.dev')
      const loaded = await loadPriceBook(dir)
      expect(loaded?.fetchedAt).toBe(FETCHED_AT)
      expect(loaded?.rows['deepseek/deepseek-flash']).toEqual({ miss: 0.15, hit: 0.003, write: 0.15, out: 0.6 })
      expect(loaded?.byCanonical['deepseek/deepseek-v4.1-flash-1017']).toEqual(['deepseek/deepseek-flash', 'deepseek/deepseek-v4-flash'])
    })
  })

  it('replaces an older cache with the newest book', async () => {
    await withTempDir(async (dir) => {
      await savePriceBook(dir, bookFrom(MINI_CATALOG, 1))
      await savePriceBook(dir, bookFrom(MINI_CATALOG, 2))
      expect((await loadPriceBook(dir))?.fetchedAt).toBe(2)
    })
  })

  it('returns undefined for a corrupt or structurally invalid cache', async () => {
    await withTempDir(async (dir) => {
      expect(await loadPriceBook(dir)).toBeUndefined()
      await writeFile(join(dir, PRICE_BOOK_FILENAME), '{not json', 'utf8')
      expect(await loadPriceBook(dir)).toBeUndefined()
      await writeFile(join(dir, PRICE_BOOK_FILENAME), JSON.stringify({ version: 1, fetchedAt: 'nope', rows: {} }), 'utf8')
      expect(await loadPriceBook(dir)).toBeUndefined()
    })
  })

  it('drops malformed cached rows and dangling lookup keys on load', async () => {
    await withTempDir(async (dir) => {
      const document = {
        version: 1,
        fetchedAt: FETCHED_AT,
        source: 'models.dev',
        rows: {
          'a/b': { miss: 1, hit: 0, write: 1, out: 2 },
          'bad/x': { miss: 0, hit: 0, write: 0, out: 0 },
          'bad/y': 'nope',
        },
        byShortName: { short: ['a/b', 'bad/x'] },
        byCanonical: { 'a/b': ['a/b'] },
      }
      await writeFile(join(dir, PRICE_BOOK_FILENAME), JSON.stringify(document), 'utf8')
      const loaded = await loadPriceBook(dir)
      expect(Object.keys(loaded?.rows ?? {})).toEqual(['a/b'])
      expect(loaded?.byShortName['short']).toEqual(['a/b'])
      expect(loaded?.byCanonical['a/b']).toEqual(['a/b'])
    })
  })

  it('returns false instead of throwing when the directory cannot be written', async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, 'not-a-directory')
      await writeFile(file, 'x', 'utf8')
      expect(await savePriceBook(file, bookFrom(MINI_CATALOG))).toBe(false)
      expect(await savePriceBook('', bookFrom(MINI_CATALOG))).toBe(false)
    })
  })
})

describe('isPriceBookFresh', () => {
  it('accepts books within the 24h window, including small clock skew', () => {
    const now = 1_000_000
    expect(isPriceBookFresh({ fetchedAt: now }, now)).toBe(true)
    expect(isPriceBookFresh({ fetchedAt: now - PRICE_BOOK_MAX_AGE_MS }, now)).toBe(true)
    expect(isPriceBookFresh({ fetchedAt: now + 5_000 }, now)).toBe(true)
  })

  it('rejects stale, missing or malformed books', () => {
    const now = 1_000_000
    expect(isPriceBookFresh({ fetchedAt: now - PRICE_BOOK_MAX_AGE_MS - 1 }, now)).toBe(false)
    expect(isPriceBookFresh(undefined, now)).toBe(false)
    expect(isPriceBookFresh(null, now)).toBe(false)
    expect(isPriceBookFresh({}, now)).toBe(false)
    expect(isPriceBookFresh({ fetchedAt: Number.NaN }, now)).toBe(false)
    expect(isPriceBookFresh({ fetchedAt: 'yesterday' }, now)).toBe(false)
  })

  it('exposes the documented models.dev constants', () => {
    expect(MODELS_DEV_URL).toBe('https://models.dev/api.json')
    expect(MODELS_DEV_TIMEOUT_MS).toBe(8_000)
    expect(PRICE_BOOK_FILENAME).toBe('pricing-book.json')
    expect(PRICE_BOOK_MAX_AGE_MS).toBe(86_400_000)
  })
})
