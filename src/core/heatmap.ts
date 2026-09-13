/**
 * Build a Codex-style 26-week (Mon–Sun) activity grid from daily usage rows.
 * @module dsh-usage-plus/core/heatmap
 */

import type { UsageDaySummary, UsageTokenTotals } from './types.ts'
import { emptyTotals } from './types.ts'

export const HEATMAP_WEEKS = 26

export interface HeatmapCell {
  date: string
  totals: UsageTokenTotals
  tokens: number
  /** 0 empty … 4 hottest. */
  level: 0 | 1 | 2 | 3 | 4
  isToday: boolean
}

export interface HeatmapGrid {
  cells: HeatmapCell[]
  /** One label per week column (often empty except month changes). */
  monthLabels: string[]
}

function localDateKey(at: Date): string {
  const year = at.getFullYear()
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const day = String(at.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfLocalDay(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate())
}

function totalTokens(totals: UsageTokenTotals): number {
  return totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens + totals.outputTokens
}

function levelOf(tokens: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (tokens <= 0 || max <= 0) return 0
  const ratio = tokens / max
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

/**
 * Pad daily rows into a fixed 26×7 Mon→Sun column-major grid ending on the
 * current week's Sunday (or today when today is Sunday).
 */
export function buildHeatmapGrid(days: UsageDaySummary[], nowMs: number = Date.now()): HeatmapGrid {
  const byDate = new Map(days.map((day) => [day.date, day.totals]))
  const today = startOfLocalDay(new Date(nowMs))
  const todayKey = localDateKey(today)
  const weekdayMon0 = (today.getDay() + 6) % 7
  const weekEnd = new Date(today)
  weekEnd.setDate(today.getDate() + (6 - weekdayMon0))

  const cells: HeatmapCell[] = []
  const monthLabels: string[] = []
  let lastMonth = -1
  const tokenValues: number[] = []

  for (let week = HEATMAP_WEEKS - 1; week >= 0; week -= 1) {
    for (let dow = 0; dow < 7; dow += 1) {
      const date = new Date(weekEnd)
      date.setDate(weekEnd.getDate() - (week * 7 + (6 - dow)))
      const key = localDateKey(date)
      const totals = byDate.get(key) ?? emptyTotals()
      const tokens = totalTokens(totals)
      tokenValues.push(tokens)
      cells.push({ date: key, totals, tokens, level: 0, isToday: key === todayKey })
    }
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekEnd.getDate() - (week * 7 + 6))
    const month = weekStart.getMonth()
    monthLabels.push(month !== lastMonth ? weekStart.toLocaleString(undefined, { month: 'short' }) : '')
    lastMonth = month
  }

  const max = Math.max(1, ...tokenValues)
  for (const cell of cells) cell.level = levelOf(cell.tokens, max)
  return { cells, monthLabels }
}
