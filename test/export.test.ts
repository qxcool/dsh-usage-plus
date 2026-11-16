/**
 * Aggregate ledger export: CSV/JSON serialization contract and the
 * loopback-fenced `/export` route fences, defaults, headers, and escaping.
 */
import { describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { UsageLedgerDocument } from '../src/core/types.ts'
import { localDateKey } from '../src/core/ledger.ts'
import { emptyTotals } from '../src/core/types.ts'
import {
  EXPORT_CSV_HEADER,
  buildExportDocument,
  collectExportEntries,
  csvField,
  exportCsv,
  exportFilename,
  exportWindow,
  resolveExportDays,
  resolveExportFormat,
  type LedgerExportDocument,
} from '../src/host/export.ts'
import { makeUsageExportRoute } from '../src/host/routes.ts'
import type { UsageService } from '../src/host/usage-service.ts'

/** Local noon `days` calendar days before today. */
function totals(inputTokens: number, cost = 0) {
  return { ...emptyTotals(), inputTokens, outputTokens: 1, calls: 1, cost }
}

describe('export serialization', () => {
  const now = new Date(2026, 10, 16, 12, 0, 0).getTime()

  function ledger(): UsageLedgerDocument {
    return {
      version: 1,
      days: {
        '2026-11-15': {
          'provider-b': { 'model-2': totals(20) },
          'provider-a': { 'model-1': totals(10) },
        },
        '2026-11-16': {
          'provider-a': { 'model-1': totals(30, 0.5) },
        },
        '2026-01-01': {
          'provider-a': { 'model-1': totals(999) },
        },
      },
    }
  }

  it('sorts entries by date, provider, then model and filters the window', () => {
    const entries = collectExportEntries(ledger(), now, 30)
    expect(entries.map((entry) => `${entry.date}/${entry.provider}/${entry.model}`)).toEqual([
      '2026-11-15/provider-a/model-1',
      '2026-11-15/provider-b/model-2',
      '2026-11-16/provider-a/model-1',
    ])
    // The 2026-01-01 bucket is outside the 30-day window.
    expect(entries.some((entry) => entry.date === '2026-01-01')).toBe(false)
  })

  it('builds the versioned JSON document with a stable shape', () => {
    const document = buildExportDocument(ledger(), 30, now)
    expect(document).toMatchObject({ version: 1, exportedAt: now, days: 30 })
    expect(Array.isArray(document.entries)).toBe(true)
    expect(Object.keys(document.entries[0] ?? {})).toEqual(['date', 'provider', 'model', 'totals'])
    expect(Object.keys(document.entries[0]?.totals ?? {})).toEqual([
      'inputTokens',
      'outputTokens',
      'cacheReadTokens',
      'cacheWriteTokens',
      'reasoningTokens',
      'calls',
      'cost',
    ])
  })

  it('uses the exact CSV header and CRLF rows', () => {
    expect(EXPORT_CSV_HEADER).toBe('date,provider,model,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,reasoning_tokens,calls,cost')
    const csv = exportCsv(collectExportEntries(ledger(), now, 30))
    const lines = csv.split('\r\n').filter((line) => line !== '')
    expect(lines[0]).toBe(EXPORT_CSV_HEADER)
    expect(lines).toHaveLength(4) // header + 3 rows
    expect(lines[1]).toBe('2026-11-15,provider-a,model-1,10,1,0,0,0,1,0')
    expect(lines[3]).toBe('2026-11-16,provider-a,model-1,30,1,0,0,0,1,0.5')
  })

  it('quotes CSV fields containing commas, quotes, CR, or LF', () => {
    expect(csvField('plain')).toBe('plain')
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('a"b')).toBe('"a""b"')
    expect(csvField('a\nb')).toBe('"a\nb"')
    expect(csvField('a\rb')).toBe('"a\rb"')
    expect(csvField(7)).toBe('7')
    const entries = [{ date: '2026-11-16', provider: 'a,b', model: 'm"x', totals: totals(1) }]
    expect(exportCsv(entries)).toContain('2026-11-16,"a,b","m""x",1,')
  })

  it('resolves query values with the documented defaults and bounds', () => {
    expect(resolveExportDays(undefined)).toBe(182)
    expect(resolveExportDays('1')).toBe(1)
    expect(resolveExportDays('730')).toBe(730)
    expect(resolveExportDays(90)).toBe(90)
    expect(resolveExportDays('0')).toBeUndefined()
    expect(resolveExportDays('731')).toBeUndefined()
    expect(resolveExportDays('abc')).toBeUndefined()
    expect(resolveExportDays('1.5')).toBeUndefined()
    expect(resolveExportFormat('csv')).toBe('csv')
    expect(resolveExportFormat('json')).toBe('json')
    expect(resolveExportFormat('xml')).toBeUndefined()
    expect(resolveExportFormat(undefined)).toBeUndefined()
  })

  it('computes an inclusive local-day window and attachment filename', () => {
    expect(exportWindow(now, 7)).toEqual({ fromKey: '2026-11-10', toKey: '2026-11-16' })
    expect(exportWindow(now, 1)).toEqual({ fromKey: '2026-11-16', toKey: '2026-11-16' })
    expect(exportFilename(now, 'csv')).toBe('dsh-usage-2026-11-16.csv')
    expect(exportFilename(now, 'json')).toBe('dsh-usage-2026-11-16.json')
  })
})

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

function request(url: string, headers: Record<string, string> = {}, remoteAddress = '127.0.0.1'): IncomingMessage {
  return { url, socket: { remoteAddress }, headers, method: 'GET' } as unknown as IncomingMessage
}

function response(): { res: ServerResponse; status: () => number; headers: () => Record<string, unknown>; body: () => string } {
  const state = { status: 0, headers: {} as Record<string, unknown>, body: '' }
  const res = {
    writeHead(status: number, headers: Record<string, unknown>) {
      state.status = status
      state.headers = headers
      return res
    },
    end(body?: string) {
      state.body = body ?? ''
    },
  }
  return {
    res: res as unknown as ServerResponse,
    status: () => state.status,
    headers: () => state.headers,
    body: () => state.body,
  }
}

const fixedNow = new Date(2026, 10, 16, 12, 0, 0).getTime()

function exportDocument(): LedgerExportDocument {
  const ledger: UsageLedgerDocument = {
    version: 1,
    days: {
      [localDateKey(fixedNow)]: { 'provider,a': { 'model"x': totals(5, 0.25) } },
    },
  }
  return buildExportDocument(ledger, 182, fixedNow)
}

describe('export route', () => {
  const document = exportDocument()
  const calls: number[] = []
  const service = {
    exportLedger: (days: number) => {
      calls.push(days)
      return document
    },
  } as unknown as UsageService
  const route = makeUsageExportRoute(service)
  const loopback = { host: '127.0.0.1:53215' }

  it('fences non-loopback requests', async () => {
    const out = response()
    await route.handler(request('/api/dsh-usage-plus/export?format=csv', loopback, '203.0.113.7'), out.res)
    expect(out.status()).toBe(403)
    expect(calls).toHaveLength(0)
  })

  it('rejects non-GET methods', async () => {
    const out = response()
    const post = { ...request('/api/dsh-usage-plus/export?format=csv', loopback), method: 'POST' } as unknown as IncomingMessage
    await route.handler(post, out.res)
    expect(out.status()).toBe(405)
  })

  it('rejects a missing or unknown format and invalid days', async () => {
    for (const url of [
      '/api/dsh-usage-plus/export',
      '/api/dsh-usage-plus/export?format=xml',
      '/api/dsh-usage-plus/export?format=csv&days=0',
      '/api/dsh-usage-plus/export?format=csv&days=731',
      '/api/dsh-usage-plus/export?format=csv&days=abc',
      '/api/dsh-usage-plus/export?format=csv&days=1.5',
    ]) {
      const out = response()
      await route.handler(request(url, loopback), out.res)
      expect(out.status(), url).toBe(400)
    }
    expect(calls).toHaveLength(0)
  })

  it('serves CSV with the contract headers, CRLF rows and no-cache', async () => {
    calls.length = 0
    const out = response()
    await route.handler(request('/api/dsh-usage-plus/export?format=csv&days=30', loopback), out.res)
    expect(out.status()).toBe(200)
    expect(calls).toEqual([30])
    expect(out.headers()['content-type']).toBe('text/csv; charset=utf-8')
    expect(out.headers()['cache-control']).toBe('no-store')
    expect(out.headers()['content-disposition']).toBe('attachment; filename="dsh-usage-2026-11-16.csv"')
    const body = out.body()
    expect(body.startsWith(`${EXPORT_CSV_HEADER}\r\n`)).toBe(true)
    expect(body).toContain('2026-11-16,"provider,a","model""x",5,1,0,0,0,1,0.25')
    expect(body.endsWith('\r\n')).toBe(true)
  })

  it('serves JSON with the versioned document and no-cache', async () => {
    calls.length = 0
    const out = response()
    await route.handler(request('/api/dsh-usage-plus/export?format=json', loopback), out.res)
    expect(out.status()).toBe(200)
    // Absent days defaults to 182.
    expect(calls).toEqual([182])
    expect(out.headers()['cache-control']).toBe('no-store')
    expect(out.headers()['content-disposition']).toBe('attachment; filename="dsh-usage-2026-11-16.json"')
    expect(JSON.parse(out.body())).toEqual(document)
  })
})
