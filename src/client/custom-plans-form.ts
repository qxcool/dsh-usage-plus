/**
 * Form ↔ JSON bridge for the custom-plan editor.
 *
 * The persisted value stays the JSON array the Host parses, so the form and the
 * raw editor are two views of the same setting. A form row keeps the original
 * object and only patches the fields the form owns, so unknown keys an advanced
 * user typed into the JSON are preserved on round-trip.
 * @module dsh-usage-plus/client/custom-plans-form
 */

/** Fields the form edits; everything else in the object is preserved verbatim. */
export interface CustomPlanFormRow {
  /** Original object, kept so unedited keys survive the round trip. */
  raw: Record<string, unknown>
  id: string
  name: string
  url: string
  /** Comma-separated hostnames for the wire format. */
  allowedHosts: string
  tokenEnv: string
  /** `name: value` lines; a header value may be a `${env:NAME}` reference. */
  headersText: string
}

/** Why the JSON text could not be turned into form rows. */
export type CustomPlanFormParseError = 'invalid-json' | 'not-objects'

/** Rows plus an optional parse error for the current JSON text. */
export interface CustomPlanFormParseResult {
  rows: CustomPlanFormRow[]
  error?: CustomPlanFormParseError
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Render a stored object as editable rows; undefined for unusable entries. */
function rowFromRaw(raw: unknown): CustomPlanFormRow | undefined {
  if (!isRecord(raw)) return undefined
  const headers = isRecord(raw.headers) ? raw.headers : {}
  const headerLines = Object.entries(headers)
    .filter(([, value]) => typeof value === 'string')
    .map(([name, value]) => `${name}: ${value as string}`)
  const hosts = Array.isArray(raw.allowedHosts)
    ? raw.allowedHosts.filter((host): host is string => typeof host === 'string').join(', ')
    : typeof raw.allowedHosts === 'string'
      ? raw.allowedHosts
      : ''
  return {
    raw,
    id: typeof raw.id === 'string' ? raw.id : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    url: typeof raw.url === 'string' ? raw.url : '',
    allowedHosts: hosts,
    tokenEnv: typeof raw.tokenEnv === 'string' ? raw.tokenEnv : '',
    headersText: headerLines.join('\n'),
  }
}

/**
 * Parse the editor's JSON text into rows. An empty document is a valid empty
 * array; anything else must be an array of objects.
 */
export function parseCustomPlanRows(text: string): CustomPlanFormParseResult {
  const trimmed = text.trim()
  if (trimmed === '') return { rows: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { rows: [], error: 'invalid-json' }
  }
  if (!Array.isArray(parsed)) return { rows: [], error: 'not-objects' }
  const rows: CustomPlanFormRow[] = []
  for (const entry of parsed) {
    const row = rowFromRaw(entry)
    if (row !== undefined) rows.push(row)
  }
  return { rows, error: parsed.length > rows.length ? 'not-objects' : undefined }
}

/** Turn one header line into its pair, or undefined for a blank line. */
function headerPair(line: string): [string, string] | undefined {
  const trimmed = line.trim()
  if (trimmed === '') return undefined
  const colon = trimmed.indexOf(':')
  if (colon <= 0) return [trimmed, '']
  return [trimmed.slice(0, colon).trim(), trimmed.slice(colon + 1).trim()]
}

/** Serialize rows back into the persisted JSON document (2-space indented). */
export function serializeCustomPlanRows(rows: readonly CustomPlanFormRow[]): string {
  if (rows.length === 0) return ''
  const entries = rows.map((row) => {
    const entry: Record<string, unknown> = { ...row.raw }
    if (row.id.trim() !== '') entry.id = row.id.trim()
    else delete entry.id
    if (row.name.trim() !== '') entry.name = row.name.trim()
    else delete entry.name
    if (row.url.trim() !== '') entry.url = row.url.trim()
    else delete entry.url
    const hosts = row.allowedHosts.split(/[,，]/).map((host) => host.trim()).filter((host) => host !== '')
    if (hosts.length > 0) entry.allowedHosts = hosts
    else delete entry.allowedHosts
    if (row.tokenEnv.trim() !== '') entry.tokenEnv = row.tokenEnv.trim()
    else delete entry.tokenEnv
    const headers: Record<string, string> = {}
    for (const line of row.headersText.split('\n')) {
      const pair = headerPair(line)
      if (pair !== undefined) headers[pair[0]] = pair[1]
    }
    if (Object.keys(headers).length > 0) entry.headers = headers
    else delete entry.headers
    return entry
  })
  return JSON.stringify(entries, null, 2)
}

/** Duplicate ids present in the rows (empty ids excluded). */
export function duplicatePlanIds(rows: readonly CustomPlanFormRow[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const row of rows) {
    const id = row.id.trim()
    if (id === '') continue
    if (seen.has(id)) duplicates.add(id)
    else seen.add(id)
  }
  return [...duplicates]
}
