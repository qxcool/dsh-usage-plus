/**
 * Build a Codex-style 26-week (Mon–Sun) activity grid from daily usage rows.
 * @module dsh-usage-plus/core/heatmap
 */
import type { UsageDaySummary, UsageTokenTotals } from './types.ts';
export declare const HEATMAP_WEEKS = 26;
export interface HeatmapCell {
    date: string;
    totals: UsageTokenTotals;
    tokens: number;
    /** 0 empty … 4 hottest. */
    level: 0 | 1 | 2 | 3 | 4;
    isToday: boolean;
}
export interface HeatmapGrid {
    cells: HeatmapCell[];
    /** One label per week column (often empty except month changes). */
    monthLabels: string[];
}
/**
 * Pad daily rows into a fixed 26×7 Mon→Sun column-major grid ending on the
 * current week's Sunday (or today when today is Sunday).
 */
export declare function buildHeatmapGrid(days: UsageDaySummary[], nowMs?: number): HeatmapGrid;
//# sourceMappingURL=heatmap.d.ts.map