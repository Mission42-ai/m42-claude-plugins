/**
 * Progress Chart Module for Sprint PDF Generation
 *
 * Generates SVG-based visual charts for sprint progress visualization:
 * - Pie/Donut charts for status distribution
 * - Progress bars for completion tracking
 * - Timeline charts for phase duration visualization
 */

import type { PhaseStatus } from '../types.js';

// ============================================================================
// Types/Interfaces
// ============================================================================

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

// ============================================================================
// Color Palette
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  completed: '#2E7D32',
  'in-progress': '#1565C0',
  inProgress: '#1565C0',
  pending: '#757575',
  failed: '#C62828',
  blocked: '#E65100',
  skipped: '#9E9E9E',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats a value as a percentage label
 */
export function formatChartLabel(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

/**
 * Converts polar coordinates to cartesian for SVG arc calculations
 */
function polarToCartesian(cx: number, cy: number, radius: number, angleDegrees: number): { x: number; y: number } {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRadians),
    y: cy + radius * Math.sin(angleRadians),
  };
}

/**
 * Generates SVG arc path for pie chart segment
 */
function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return ['M', cx, cy, 'L', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y, 'Z'].join(' ');
}

// ============================================================================
// Chart Generation Functions
// ============================================================================

/**
 * Creates a progress chart from sprint data
 *
 * @param data - Chart data with counts by status
 * @param options - Chart rendering options
 * @returns SVG string
 */
export function createProgressChart(data: ChartData, options: ChartOptions = {}): string {
  const type = options.type || 'pie';

  if (type === 'bar') {
    return createProgressBar(data, options);
  }

  // Default to pie chart
  const segments = dataToSegments(data);
  return createPieChart(segments, options);
}

/**
 * Segment definition for building chart segments from ChartData
 */
interface SegmentDefinition {
  key: keyof Omit<ChartData, 'total'>;
  color: string;
  label: string;
}

/**
 * Ordered list of status segments for chart rendering
 */
const SEGMENT_DEFINITIONS: SegmentDefinition[] = [
  { key: 'completed', color: STATUS_COLORS.completed, label: 'Completed' },
  { key: 'inProgress', color: STATUS_COLORS.inProgress, label: 'In Progress' },
  { key: 'pending', color: STATUS_COLORS.pending, label: 'Pending' },
  { key: 'failed', color: STATUS_COLORS.failed, label: 'Failed' },
  { key: 'blocked', color: STATUS_COLORS.blocked, label: 'Blocked' },
  { key: 'skipped', color: STATUS_COLORS.skipped, label: 'Skipped' },
];

/**
 * Converts ChartData to ChartSegment array, filtering out zero values
 */
function dataToSegments(data: ChartData): ChartSegment[] {
  return SEGMENT_DEFINITIONS
    .filter(def => data[def.key] > 0)
    .map(def => ({ value: data[def.key], color: def.color, label: def.label }));
}

/**
 * Creates a pie/donut chart from segments
 *
 * @param segments - Chart segments with values, colors, and labels
 * @param options - Chart rendering options
 * @returns SVG string
 */
export function createPieChart(segments: ChartSegment[], options: ChartOptions = {}): string {
  const width = options.width || 200;
  const height = options.height || 200;
  const showLegend = options.showLegend !== false;
  const showLabels = options.showLabels !== false;

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 10;

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // Handle empty data
  if (total === 0 || segments.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height + (showLegend ? 60 : 0)}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#E0E0E0" />
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#757575">No data</text>
</svg>`;
  }

  // Handle single segment (full circle)
  if (segments.length === 1) {
    const segment = segments[0];
    let legendSvg = '';
    if (showLegend) {
      legendSvg = renderLegend(segments, total, width, height, showLabels);
    }
    return `<svg viewBox="0 0 ${width} ${height + (showLegend ? 60 : 0)}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${segment.color}" />
${legendSvg}</svg>`;
  }

  // Generate pie segments
  let currentAngle = 0;
  const paths: string[] = [];

  for (const segment of segments) {
    const segmentAngle = (segment.value / total) * 360;
    const path = describeArc(cx, cy, radius, currentAngle, currentAngle + segmentAngle);
    paths.push(`  <path d="${path}" fill="${segment.color}" />`);
    currentAngle += segmentAngle;
  }

  let legendSvg = '';
  if (showLegend) {
    legendSvg = renderLegend(segments, total, width, height, showLabels);
  }

  return `<svg viewBox="0 0 ${width} ${height + (showLegend ? 60 : 0)}" xmlns="http://www.w3.org/2000/svg">
${paths.join('\n')}
${legendSvg}</svg>`;
}

/**
 * Renders legend section for charts
 */
function renderLegend(segments: ChartSegment[], total: number, width: number, chartHeight: number, showLabels: boolean): string {
  const legendY = chartHeight + 10;
  const itemWidth = width / Math.min(segments.length, 3);
  const items: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = col * itemWidth + 5;
    const y = legendY + row * 20;

    const labelText = showLabels
      ? `${segment.label} (${segment.value})`
      : segment.label;

    items.push(`  <rect x="${x}" y="${y}" width="12" height="12" fill="${segment.color}" />`);
    items.push(`  <text x="${x + 16}" y="${y + 10}" font-size="10" fill="#333">${labelText}</text>`);
  }

  return items.join('\n');
}

/**
 * Creates a horizontal progress bar chart
 *
 * @param data - Chart data with counts by status
 * @param options - Chart rendering options
 * @returns SVG string
 */
export function createProgressBar(data: ChartData, options: ChartOptions = {}): string {
  const width = options.width || 400;
  const height = options.height || 40;
  const showLabels = options.showLabels !== false;
  const showLegend = options.showLegend !== false;

  const barHeight = 30;
  const barY = 5;

  const total = data.total || (data.completed + data.pending + data.failed + data.inProgress + data.blocked + data.skipped);

  // Handle empty data
  if (total === 0) {
    return `<svg viewBox="0 0 ${width} ${height + (showLegend ? 40 : 0)}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="${barY}" width="${width}" height="${barHeight}" fill="#E0E0E0" rx="4" />
  <text x="${width / 2}" y="${barY + barHeight / 2 + 4}" text-anchor="middle" font-size="12" fill="#757575">No data</text>
</svg>`;
  }

  const segments = dataToSegments(data);

  const rects: string[] = [];
  const labels: string[] = [];
  let x = 0;

  for (const segment of segments) {
    const segmentWidth = (segment.value / total) * width;
    rects.push(`  <rect x="${x}" y="${barY}" width="${segmentWidth}" height="${barHeight}" fill="${segment.color}" />`);

    // Add percentage label if segment is wide enough
    if (showLabels && segmentWidth > 30) {
      const percentage = Math.round((segment.value / total) * 100);
      labels.push(`  <text x="${x + segmentWidth / 2}" y="${barY + barHeight / 2 + 4}" text-anchor="middle" font-size="10" fill="white">${percentage}%</text>`);
    }

    x += segmentWidth;
  }

  let legendSvg = '';
  if (showLegend) {
    legendSvg = renderBarLegend(segments, total, width, height);
  }

  return `<svg viewBox="0 0 ${width} ${height + (showLegend ? 40 : 0)}" xmlns="http://www.w3.org/2000/svg">
${rects.join('\n')}
${labels.join('\n')}
${legendSvg}</svg>`;
}

/**
 * Renders legend for progress bar
 */
function renderBarLegend(segments: Array<{ value: number; color: string; label: string }>, total: number, width: number, barHeight: number): string {
  const legendY = barHeight + 10;
  const itemWidth = width / Math.min(segments.length, 4);
  const items: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const x = i * itemWidth + 5;

    items.push(`  <rect x="${x}" y="${legendY}" width="10" height="10" fill="${segment.color}" />`);
    items.push(`  <text x="${x + 14}" y="${legendY + 9}" font-size="9" fill="#333">${segment.label} (${segment.value})</text>`);
  }

  return items.join('\n');
}

/**
 * Creates a timeline chart from phase entries
 *
 * @param entries - Timeline entries with timestamps
 * @param options - Chart rendering options
 * @returns SVG string
 */
export function createTimelineChart(entries: TimelineEntry[], options: ChartOptions = {}): string {
  const width = options.width || 400;
  const rowHeight = 25;
  const labelWidth = 100;
  const barStartX = labelWidth + 10;
  const barWidth = width - barStartX - 10;

  // Handle empty entries
  if (entries.length === 0) {
    return `<svg viewBox="0 0 ${width} 50" xmlns="http://www.w3.org/2000/svg">
  <text x="${width / 2}" y="25" text-anchor="middle" font-size="12" fill="#757575">No timeline data</text>
</svg>`;
  }

  const height = entries.length * rowHeight + 20;

  // Calculate time range
  const startTimes = entries.map(e => new Date(e.startTime).getTime());
  const endTimes = entries.map(e => new Date(e.endTime).getTime());
  const minTime = Math.min(...startTimes);
  const maxTime = Math.max(...endTimes);
  const timeRange = maxTime - minTime || 1; // Avoid division by zero

  const bars: string[] = [];
  const labels: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const y = i * rowHeight + 10;

    // Label
    labels.push(`  <text x="5" y="${y + 15}" font-size="10" fill="#333">${entry.label}</text>`);

    // Bar
    const startOffset = new Date(entry.startTime).getTime() - minTime;
    const duration = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
    const barX = barStartX + (startOffset / timeRange) * barWidth;
    const barW = Math.max((duration / timeRange) * barWidth, 5); // Minimum width of 5
    const color = STATUS_COLORS[entry.status] || STATUS_COLORS.pending;

    bars.push(`  <rect x="${barX}" y="${y}" width="${barW}" height="20" fill="${color}" rx="3" />`);
  }

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
${labels.join('\n')}
${bars.join('\n')}
</svg>`;
}
