/**
 * Custom-plan form ↔ JSON bridge: parsing stored entries into form rows,
 * serializing back (preserving keys the form does not own), and duplicate-id
 * detection.
 */
import { describe, expect, it } from 'vitest'
import {
  duplicatePlanIds,
  parseCustomPlanRows,
  serializeCustomPlanRows,
  type CustomPlanFormRow,
} from '../src/client/custom-plans-form.ts'

function row(patch: Partial<CustomPlanFormRow> = {}): CustomPlanFormRow {
  return { raw: {}, id: '', name: '', url: '', allowedHosts: '', tokenEnv: '', headersText: '', ...patch }
}

describe('custom-plan form rows', () => {
  it('treats empty text as an empty list and rejects malformed documents', () => {
    expect(parseCustomPlanRows('')).toEqual({ rows: [] })
    expect(parseCustomPlanRows('   ')).toEqual({ rows: [] })
    expect(parseCustomPlanRows('not json')).toEqual({ rows: [], error: 'invalid-json' })
    expect(parseCustomPlanRows('{"id":"x"}')).toEqual({ rows: [], error: 'not-objects' })
    expect(parseCustomPlanRows('[1, "x"]')).toEqual({ rows: [], error: 'not-objects' })
    expect(parseCustomPlanRows('[]')).toEqual({ rows: [] })
  })

  it('maps stored fields, joins hosts and renders headers as lines', () => {
    const text = JSON.stringify([
      {
        id: 'my-plan',
        name: '我的套餐',
        url: 'https://quota.example.com/usage',
        allowedHosts: ['quota.example.com', 'api.example.com'],
        tokenEnv: 'MY_PLAN_TOKEN',
        headers: { 'x-tenant': '${env:MY_TENANT}', 'x-region': 'cn' },
        timeoutMs: 5000,
      },
    ])
    const { rows, error } = parseCustomPlanRows(text)
    expect(error).toBeUndefined()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'my-plan',
      name: '我的套餐',
      url: 'https://quota.example.com/usage',
      allowedHosts: 'quota.example.com, api.example.com',
      tokenEnv: 'MY_PLAN_TOKEN',
      headersText: 'x-tenant: ${env:MY_TENANT}\nx-region: cn',
    })
  })

  it('round-trips through the form and keeps keys the form does not own', () => {
    const text = JSON.stringify([{ id: 'a', name: 'A', url: 'https://a.example.com/q', headers: { 'x-a': '1' }, timeoutMs: 5000 }])
    const { rows } = parseCustomPlanRows(text)
    const edited = rows.map((entry) => ({ ...entry, name: 'A2', allowedHosts: 'a.example.com', tokenEnv: 'A_TOKEN' }))
    const output = serializeCustomPlanRows(edited)
    const parsed = JSON.parse(output) as Array<Record<string, unknown>>
    expect(parsed[0]).toMatchObject({
      id: 'a',
      name: 'A2',
      url: 'https://a.example.com/q',
      allowedHosts: ['a.example.com'],
      tokenEnv: 'A_TOKEN',
      headers: { 'x-a': '1' },
      timeoutMs: 5000,
    })
    // Serialized output is pretty-printed so the JSON view stays readable.
    expect(output).toContain('\n  ')
  })

  it('drops fields the form cleared instead of writing empty strings', () => {
    const rows = [row({ id: 'b', url: 'https://b.example.com/q', name: '', allowedHosts: '', tokenEnv: '', headersText: '' })]
    const parsed = JSON.parse(serializeCustomPlanRows(rows)) as Array<Record<string, unknown>>
    expect(parsed[0]).toEqual({ id: 'b', url: 'https://b.example.com/q' })
    expect(serializeCustomPlanRows([])).toBe('')
  })

  it('splits hosts on ASCII and full-width commas and parses header lines', () => {
    const rows = [row({ id: 'c', url: 'https://c.example.com/q', allowedHosts: 'one.example.com，two.example.com', headersText: 'x-1: v1\n\nx-2:v2\nflag' })]
    const parsed = JSON.parse(serializeCustomPlanRows(rows)) as Array<Record<string, unknown>>
    expect(parsed[0]).toMatchObject({
      allowedHosts: ['one.example.com', 'two.example.com'],
      headers: { 'x-1': 'v1', 'x-2': 'v2', flag: '' },
    })
  })

  it('reports duplicate ids and ignores blank ones', () => {
    const rows = [row({ id: 'dup' }), row({ id: 'dup' }), row({ id: '' }), row({ id: '' }), row({ id: 'ok' })]
    expect(duplicatePlanIds(rows)).toEqual(['dup'])
    expect(duplicatePlanIds([row({ id: '' })])).toEqual([])
  })
})
