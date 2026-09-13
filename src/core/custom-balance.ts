/**
 * Pure helpers for custom HTTPS balance extract rules and header templates.
 * @module dsh-usage-plus/core/custom-balance
 */

function getPath(root: unknown, path: string): unknown {
  if (typeof path !== 'string' || path.length === 0) return undefined
  let current: unknown = root
  for (const segment of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    if (!Object.hasOwn(current, segment)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function toStrictNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN
  if (typeof value === 'string') {
    const text = value.trim()
    if (text.length > 0 && /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(text)) return Number(text)
  }
  return Number.NaN
}

/** Evaluate one extract rule against a JSON body. Exported for unit tests. */
export function extractByRule(data: unknown, rule: unknown): number | string | null {
  if (rule === null || rule === undefined) return null
  if (typeof rule === 'number' && Number.isFinite(rule)) return rule
  if (typeof rule === 'string') {
    const value = getPath(data, rule)
    const num = toStrictNumber(value)
    if (Number.isFinite(num)) return num
    return typeof value === 'string' ? value : null
  }
  if (typeof rule === 'object' && !Array.isArray(rule)) {
    const row = rule as Record<string, unknown>
    const op = row.op
    if (op === 'subtract' && Array.isArray(row.paths)) {
      if (row.paths.length === 0) return null
      const values = row.paths.map((path) => toStrictNumber(getPath(data, String(path))))
      if (!values.every(Number.isFinite)) return null
      return values.reduce((acc, value) => acc - value)
    }
    if (op === 'add' && Array.isArray(row.paths)) {
      const values = row.paths.map((path) => toStrictNumber(getPath(data, String(path))))
      if (!values.every(Number.isFinite)) return null
      return values.reduce((acc, value) => acc + value, 0)
    }
    if (op === 'divide' && typeof row.path === 'string') {
      const value = toStrictNumber(getPath(data, row.path))
      const by = toStrictNumber(row.by)
      if (!Number.isFinite(value) || !Number.isFinite(by) || by === 0) return null
      return value / by
    }
    if (typeof row.path === 'string') return extractByRule(data, row.path)
  }
  return null
}

/** Collect `{{VAR}}` names from a headers JSON object string. */
export function customBalanceCredentialVars(headersJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(headersJson || '{}')
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return []
    const names = new Set<string>()
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (typeof value !== 'string') continue
      for (const match of value.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)) names.add(match[1])
    }
    return [...names]
  } catch {
    return []
  }
}
