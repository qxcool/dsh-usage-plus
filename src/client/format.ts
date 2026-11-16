/**
 * Number formatting shared by the page and the composer summary.
 *
 * Conventions follow the official surfaces: compact K/M/B with one decimal
 * below 100 (12345 -> 12.3k, 1234567 -> 1.2M), exact grouped integers for
 * dialogs/titles, cache-hit percentages that never round a partial hit up to
 * 100%, and explicit currency labels so CNY and USD are never mixed.
 * @module @linxin666/dsh-usage/client/format
 */

/** Compact token count in the official K/M conventions. */
export function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value < 1000) return String(Math.round(value))
  let scaled = value / 1000
  let suffix = 'k'
  if (value >= 999_950) {
    scaled = value / 1_000_000
    suffix = 'M'
  }
  if (value >= 999_950_000) {
    scaled = value / 1_000_000_000
    suffix = 'B'
  }
  return `${scaled >= 100 ? String(Math.round(scaled)) : scaled.toFixed(1).replace(/\.0$/, '')}${suffix}`
}

/** Exact grouped integer for dialogs/titles (official convention). */
export function formatExact(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString()
}

/** Formatted CNY spend estimate. */
export function formatCost(cost: number): string {
  return '¥' + cost.toFixed(2)
}

/**
 * CNY reading that never invents a zero for an unpriced day: calls but no
 * priced bucket renders `—`; sub-cent spend renders `<¥0.01`.
 */
export function formatCny(cost: number, calls: number): string {
  if (!Number.isFinite(cost) || cost <= 0) return calls > 0 ? '—' : '¥0.00'
  if (cost < 0.01) return '<¥0.01'
  return formatCost(cost)
}

/** USD reference estimate; the currency label stays explicit. */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '<$0.01'
  if (amount >= 100) return '$' + amount.toFixed(0)
  return '$' + amount.toFixed(2)
}

/**
 * Cache-hit reading with the official denominator (input + cacheRead +
 * cacheWrite). A partial hit never rounds up to 100%: the value is floored to
 * 0.1%, and 100% appears only when every billed token hit cache.
 */
export function cacheHitText(cacheRead: number, billed: number): string {
  if (billed <= 0) return '—'
  if (cacheRead >= billed) return '100%'
  const percent = Math.max(0, (cacheRead / billed) * 100)
  const floored = Math.floor(percent * 10) / 10
  return `${floored.toFixed(1)}%`
}
