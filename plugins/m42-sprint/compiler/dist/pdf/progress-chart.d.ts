/**
 * Progress Chart Module for Sprint PDF Generation
 *
 * Generates SVG-based visual charts for sprint progress visualization:
 * - Pie/Donut charts for status distribution
 * - Progress bars for completion tracking
 * - Timeline charts for phase duration visualization
 */
import type { PhaseStatus } from '../types.js';
/**
 * Input data for charts - counts by status category
 */
export interface ChartData {
    completed: number;
    pending: number;
    failed: number;
    inProgress: number;
    blocked: number;
    skipped: number;
    total: number;
}
/**
 * Configuration options for chart rendering
 */
export interface ChartOptions {
    width?: number;
    height?: number;
    showLegend?: boolean;
    showLabels?: boolean;
    type?: 'pie' | 'bar' | 'timeline';
}
/**
 * Individual segment in pie/bar charts
 */
export interface ChartSegment {
    value: number;
    color: string;
    label: string;
}
/**
 * Entry for timeline visualization
 */
export interface TimelineEntry {
    id: string;
    label: string;
    startTime: string;
    endTime: string;
    status: PhaseStatus;
}
/**
 * Formats a value as a percentage label
 */
export declare function formatChartLabel(value: number, total: number): string;
/**
 * Creates a progress chart from sprint data
 *
 * @param data - Chart data with counts by status
 * @param options - Chart rendering options
 * @returns SVG string
 */
export declare function createProgressChart(data: ChartData, options?: ChartOptions): string;
/**
 * Creates a pie/donut chart from segments
 *
 * @param segments - Chart segments with values, colors, and labels
 * @param options - Chart rendering options
 * @returns SVG string
 */
export declare function createPieChart(segments: ChartSegment[], options?: ChartOptions): string;
/**
 * Creates a horizontal progress bar chart
 *
 * @param data - Chart data with counts by status
 * @param options - Chart rendering options
 * @returns SVG string
 */
export declare function createProgressBar(data: ChartData, options?: ChartOptions): string;
/**
 * Creates a timeline chart from phase entries
 *
 * @param entries - Timeline entries with timestamps
 * @param options - Chart rendering options
 * @returns SVG string
 */
export declare function createTimelineChart(entries: TimelineEntry[], options?: ChartOptions): string;
//# sourceMappingURL=progress-chart.d.ts.map