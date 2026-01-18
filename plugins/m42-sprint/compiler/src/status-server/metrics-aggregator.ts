/**
 * Metrics Aggregator - Aggregate statistics across multiple sprints
 * Provides metrics for the sprint dashboard
 */

import type { SprintSummary } from './sprint-scanner.js';
import type { SprintStatus } from './status-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Workflow usage statistics
 */
export interface WorkflowStats {
  /** Workflow name */
  workflow: string;
  /** Number of sprints using this workflow */
  count: number;
  /** Percentage of total sprints */
  percentage: number;
}

/**
 * Trend data point for time-series visualization
 */
export interface TrendDataPoint {
  /** Date key (YYYY-MM-DD for daily, YYYY-WXX for weekly) */
  dateKey: string;
  /** Number of sprints in this period */
  count: number;
  /** Number of completed sprints */
  completed: number;
  /** Number of failed sprints */
  failed: number;
}

/**
 * Aggregated metrics across multiple sprints
 */
export interface AggregateMetrics {
  /** Total number of sprints analyzed */
  totalSprints: number;
  /** Number of completed sprints */
  completedSprints: number;
  /** Number of failed sprints */
  failedSprints: number;
  /** Number of in-progress sprints */
  inProgressSprints: number;
  /** Success rate as percentage (0-100) */
  successRate: number;
  /** Average sprint duration in milliseconds */
  averageDuration: number;
  /** Average sprint duration formatted as human-readable string */
  averageDurationFormatted: string;
  /** Average number of steps per sprint */
  averageStepsPerSprint: number;
  /** Workflow usage statistics sorted by frequency (most common first) */
  workflowStats: WorkflowStats[];
  /** Most common workflow name (or null if no workflows) */
  mostCommonWorkflow: string | null;
  /** Daily sprint trend data */
  dailyTrend: TrendDataPoint[];
  /** Weekly sprint trend data */
  weeklyTrend: TrendDataPoint[];
}

// ============================================================================
// MetricsAggregator Class
// ============================================================================

/**
 * MetricsAggregator calculates aggregate statistics from sprint summaries
 */
export class MetricsAggregator {
  private readonly summaries: SprintSummary[];

  /**
   * Create a new MetricsAggregator
   * @param summaries Array of SprintSummary objects to aggregate
   */
  constructor(summaries: SprintSummary[]) {
    this.summaries = summaries;
  }

  /**
   * Calculate all aggregate metrics
   * @returns AggregateMetrics with all calculated values
   */
  aggregate(): AggregateMetrics {
    const totalSprints = this.summaries.length;

    // Handle empty array case
    if (totalSprints === 0) {
      return this.emptyMetrics();
    }

    // Count sprints by status
    const completedSprints = this.countByStatus('completed');
    const inProgressSprints = this.countByStatus('in-progress');
    const failedSprints = this.countFailedSprints();

    // Calculate success rate (completed / (completed + failed))
    const finishedSprints = completedSprints + failedSprints;
    const successRate = finishedSprints > 0
      ? Math.round((completedSprints / finishedSprints) * 100)
      : 0;

    // Calculate average duration (from completed sprints only)
    const avgDuration = this.calculateAverageDuration();

    // Calculate average steps per sprint
    const avgSteps = this.calculateAverageSteps();

    // Calculate workflow statistics
    const workflowStats = this.calculateWorkflowStats();
    const mostCommonWorkflow = workflowStats.length > 0 ? workflowStats[0].workflow : null;

    // Calculate trend data
    const dailyTrend = this.calculateDailyTrend();
    const weeklyTrend = this.calculateWeeklyTrend();

    return {
      totalSprints,
      completedSprints,
      failedSprints,
      inProgressSprints,
      successRate,
      averageDuration: avgDuration,
      averageDurationFormatted: this.formatDuration(avgDuration),
      averageStepsPerSprint: avgSteps,
      workflowStats,
      mostCommonWorkflow,
      dailyTrend,
      weeklyTrend,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Return empty metrics for when there are no sprints
   */
  private emptyMetrics(): AggregateMetrics {
    return {
      totalSprints: 0,
      completedSprints: 0,
      failedSprints: 0,
      inProgressSprints: 0,
      successRate: 0,
      averageDuration: 0,
      averageDurationFormatted: '0s',
      averageStepsPerSprint: 0,
      workflowStats: [],
      mostCommonWorkflow: null,
      dailyTrend: [],
      weeklyTrend: [],
    };
  }

  /**
   * Count sprints with a specific status
   */
  private countByStatus(status: SprintStatus): number {
    return this.summaries.filter(s => s.status === status).length;
  }

  /**
   * Count failed sprints (blocked, paused, needs-human)
   */
  private countFailedSprints(): number {
    const failedStatuses: SprintStatus[] = ['blocked', 'paused', 'needs-human'];
    return this.summaries.filter(s => failedStatuses.includes(s.status)).length;
  }

  /**
   * Calculate average duration from completed sprints with timestamps
   */
  private calculateAverageDuration(): number {
    const completedWithTimestamps = this.summaries.filter(s =>
      s.status === 'completed' && s.startedAt && s.completedAt
    );

    if (completedWithTimestamps.length === 0) {
      return 0;
    }

    let totalMs = 0;
    for (const sprint of completedWithTimestamps) {
      const startTime = new Date(sprint.startedAt!).getTime();
      const endTime = new Date(sprint.completedAt!).getTime();
      totalMs += endTime - startTime;
    }

    return Math.round(totalMs / completedWithTimestamps.length);
  }

  /**
   * Calculate average steps per sprint
   */
  private calculateAverageSteps(): number {
    if (this.summaries.length === 0) {
      return 0;
    }

    const totalSteps = this.summaries.reduce((sum, s) => sum + s.totalSteps, 0);
    return Math.round((totalSteps / this.summaries.length) * 10) / 10; // 1 decimal place
  }

  /**
   * Calculate workflow usage statistics
   */
  private calculateWorkflowStats(): WorkflowStats[] {
    const counts = new Map<string, number>();

    for (const sprint of this.summaries) {
      const workflow = sprint.workflow || 'unknown';
      counts.set(workflow, (counts.get(workflow) || 0) + 1);
    }

    // Convert to array and calculate percentages
    const stats: WorkflowStats[] = [];
    for (const [workflow, count] of counts) {
      stats.push({
        workflow,
        count,
        percentage: Math.round((count / this.summaries.length) * 100),
      });
    }

    // Sort by count descending
    stats.sort((a, b) => b.count - a.count);

    return stats;
  }

  /**
   * Calculate daily trend data
   */
  private calculateDailyTrend(): TrendDataPoint[] {
    const dailyData = new Map<string, { count: number; completed: number; failed: number }>();

    for (const sprint of this.summaries) {
      const dateKey = this.extractDateKey(sprint.startedAt || sprint.sprintId);
      if (!dateKey) continue;

      const existing = dailyData.get(dateKey) || { count: 0, completed: 0, failed: 0 };
      existing.count++;

      if (sprint.status === 'completed') {
        existing.completed++;
      } else if (this.isFailedStatus(sprint.status)) {
        existing.failed++;
      }

      dailyData.set(dateKey, existing);
    }

    // Convert to array and sort by date
    const trend: TrendDataPoint[] = [];
    for (const [dateKey, data] of dailyData) {
      trend.push({ dateKey, ...data });
    }

    trend.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    return trend;
  }

  /**
   * Calculate weekly trend data
   */
  private calculateWeeklyTrend(): TrendDataPoint[] {
    const weeklyData = new Map<string, { count: number; completed: number; failed: number }>();

    for (const sprint of this.summaries) {
      const dateKey = this.extractDateKey(sprint.startedAt || sprint.sprintId);
      if (!dateKey) continue;

      const weekKey = this.getWeekKey(dateKey);
      const existing = weeklyData.get(weekKey) || { count: 0, completed: 0, failed: 0 };
      existing.count++;

      if (sprint.status === 'completed') {
        existing.completed++;
      } else if (this.isFailedStatus(sprint.status)) {
        existing.failed++;
      }

      weeklyData.set(weekKey, existing);
    }

    // Convert to array and sort by week
    const trend: TrendDataPoint[] = [];
    for (const [dateKey, data] of weeklyData) {
      trend.push({ dateKey, ...data });
    }

    trend.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    return trend;
  }

  /**
   * Extract YYYY-MM-DD date key from timestamp or sprint ID
   */
  private extractDateKey(timestampOrId: string | null): string | null {
    if (!timestampOrId) return null;

    // Try to extract date from sprint ID (format: YYYY-MM-DD_name)
    const sprintIdMatch = timestampOrId.match(/^(\d{4}-\d{2}-\d{2})/);
    if (sprintIdMatch) {
      return sprintIdMatch[1];
    }

    // Try to parse as ISO timestamp
    try {
      const date = new Date(timestampOrId);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Ignore parse errors
    }

    return null;
  }

  /**
   * Convert date key (YYYY-MM-DD) to week key (YYYY-WXX)
   */
  private getWeekKey(dateKey: string): string {
    const date = new Date(dateKey);
    const year = date.getFullYear();

    // Calculate ISO week number
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  /**
   * Check if status is considered failed
   */
  private isFailedStatus(status: SprintStatus): boolean {
    return status === 'blocked' || status === 'paused' || status === 'needs-human';
  }

  /**
   * Format duration in milliseconds to human-readable string
   */
  private formatDuration(ms: number): string {
    if (ms <= 0) return '0s';

    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Convenience function to aggregate sprint metrics
 * @param summaries Array of SprintSummary objects
 * @returns Aggregated metrics
 */
export function aggregateMetrics(summaries: SprintSummary[]): AggregateMetrics {
  const aggregator = new MetricsAggregator(summaries);
  return aggregator.aggregate();
}
