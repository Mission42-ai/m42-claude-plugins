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
  /** Success rate for this workflow (0-100) */
  successRate: number;
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
  /** Success rate as percentage (0-100) for this period */
  successRate: number;
}

/**
 * Health status based on success rate
 */
export type HealthStatus = 'healthy' | 'warning' | 'critical';

/**
 * Trend direction for metrics
 */
export type TrendDirection = 'improving' | 'declining' | 'stable';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert for metrics needing attention
 */
export interface MetricAlert {
  /** The metric this alert applies to */
  metric: string;
  /** Severity of the alert */
  severity: AlertSeverity;
  /** Human-readable message */
  message: string;
}

/**
 * Insight types
 */
export type InsightType = 'success' | 'warning' | 'info' | 'recommendation';

/**
 * Actionable insight about sprint health
 */
export interface MetricInsight {
  /** Type of insight */
  type: InsightType;
  /** Human-readable message */
  message: string;
}

/**
 * Period-over-period comparison metrics
 */
export interface PeriodComparison {
  /** Change in success rate (percentage points) */
  successRateChange: number;
  /** Change in duration (percentage) */
  durationChange: number;
}

/**
 * Categorized metrics for organized display
 */
export interface MetricCategories {
  /** Velocity metrics (throughput, pace) */
  velocity: {
    sprintsPerDay: number;
    averageStepsPerSprint: number;
  };
  /** Quality metrics (success rate, reliability) */
  quality: {
    successRate: number;
    failureRate: number;
  };
  /** Efficiency metrics (time-based) */
  efficiency: {
    averageDuration: number;
    stepsPerHour: number;
  };
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
  // =========================================================================
  // BUG-004: Additional metrics for actionable insights
  // =========================================================================
  /** Health status based on success rate: healthy (>=80%), warning (50-79%), critical (<50%) */
  healthStatus: HealthStatus;
  /** Success rate trend direction based on recent data */
  successRateTrend: TrendDirection;
  /** Number of sprints with anomalous durations (>2 standard deviations) */
  durationAnomalies: number;
  /** Metrics organized by category for cleaner display */
  categories: MetricCategories;
  /** Period-over-period comparison (compares recent vs older data) */
  comparison: PeriodComparison;
  /** Alerts for metrics needing attention */
  alerts: MetricAlert[];
  /** Average steps completed per hour (efficiency metric) */
  averageStepsPerHour: number;
  /** Actionable insights about sprint health */
  insights: MetricInsight[];
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

    // BUG-004: Calculate additional actionable metrics
    const healthStatus = this.calculateHealthStatus(successRate);
    const successRateTrend = this.calculateSuccessRateTrend(dailyTrend);
    const durationAnomalies = this.calculateDurationAnomalies();
    const averageStepsPerHour = this.calculateStepsPerHour();
    const categories = this.calculateCategories(successRate, avgDuration, avgSteps, averageStepsPerHour, totalSprints);
    const comparison = this.calculateComparison(dailyTrend);
    const alerts = this.calculateAlerts(successRate, durationAnomalies);
    const insights = this.calculateInsights(successRate, successRateTrend, durationAnomalies, inProgressSprints);

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
      // BUG-004: Additional actionable metrics
      healthStatus,
      successRateTrend,
      durationAnomalies,
      categories,
      comparison,
      alerts,
      averageStepsPerHour,
      insights,
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
      // BUG-004: Additional actionable metrics
      healthStatus: 'healthy',
      successRateTrend: 'stable',
      durationAnomalies: 0,
      categories: {
        velocity: { sprintsPerDay: 0, averageStepsPerSprint: 0 },
        quality: { successRate: 0, failureRate: 0 },
        efficiency: { averageDuration: 0, stepsPerHour: 0 },
      },
      comparison: { successRateChange: 0, durationChange: 0 },
      alerts: [],
      averageStepsPerHour: 0,
      insights: [],
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
   * Calculate workflow usage statistics with per-workflow success rates
   */
  private calculateWorkflowStats(): WorkflowStats[] {
    const workflowData = new Map<string, { total: number; completed: number; failed: number }>();

    for (const sprint of this.summaries) {
      const workflow = sprint.workflow || 'unknown';
      const data = workflowData.get(workflow) || { total: 0, completed: 0, failed: 0 };
      data.total++;

      if (sprint.status === 'completed') {
        data.completed++;
      } else if (this.isFailedStatus(sprint.status)) {
        data.failed++;
      }

      workflowData.set(workflow, data);
    }

    // Convert to array and calculate percentages + success rates
    const stats: WorkflowStats[] = [];
    for (const [workflow, data] of workflowData) {
      const finished = data.completed + data.failed;
      const successRate = finished > 0
        ? Math.round((data.completed / finished) * 100)
        : 0;

      stats.push({
        workflow,
        count: data.total,
        percentage: Math.round((data.total / this.summaries.length) * 100),
        successRate,
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
      const finished = data.completed + data.failed;
      const successRate = finished > 0
        ? Math.round((data.completed / finished) * 100)
        : 0;
      trend.push({ dateKey, ...data, successRate });
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
      const finished = data.completed + data.failed;
      const successRate = finished > 0
        ? Math.round((data.completed / finished) * 100)
        : 0;
      trend.push({ dateKey, ...data, successRate });
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

  // =========================================================================
  // BUG-004: Additional calculation methods for actionable metrics
  // =========================================================================

  /**
   * Calculate health status based on success rate
   * healthy: >= 80%, warning: 50-79%, critical: < 50%
   */
  private calculateHealthStatus(successRate: number): HealthStatus {
    if (successRate >= 80) return 'healthy';
    if (successRate >= 50) return 'warning';
    return 'critical';
  }

  /**
   * Calculate success rate trend direction based on daily trend data
   */
  private calculateSuccessRateTrend(dailyTrend: TrendDataPoint[]): TrendDirection {
    if (dailyTrend.length < 2) return 'stable';

    // Compare recent half vs older half
    const midpoint = Math.floor(dailyTrend.length / 2);
    const olderHalf = dailyTrend.slice(0, midpoint);
    const recentHalf = dailyTrend.slice(midpoint);

    const olderRate = this.calculatePeriodSuccessRate(olderHalf);
    const recentRate = this.calculatePeriodSuccessRate(recentHalf);

    const diff = recentRate - olderRate;

    // Consider a 10% change as significant
    if (diff >= 10) return 'improving';
    if (diff <= -10) return 'declining';
    return 'stable';
  }

  /**
   * Calculate success rate for a period from trend data
   */
  private calculatePeriodSuccessRate(trend: TrendDataPoint[]): number {
    let totalCompleted = 0;
    let totalFailed = 0;

    for (const point of trend) {
      totalCompleted += point.completed;
      totalFailed += point.failed;
    }

    const total = totalCompleted + totalFailed;
    if (total === 0) return 0;
    return Math.round((totalCompleted / total) * 100);
  }

  /**
   * Detect duration anomalies using median-based threshold
   * A sprint is anomalous if its duration is > 3x the median duration
   */
  private calculateDurationAnomalies(): number {
    const durations = this.summaries
      .filter(s => s.status === 'completed' && s.startedAt && s.completedAt)
      .map(s => {
        const start = new Date(s.startedAt!).getTime();
        const end = new Date(s.completedAt!).getTime();
        return end - start;
      })
      .sort((a, b) => a - b);

    if (durations.length < 3) return 0;

    // Calculate median
    const midIndex = Math.floor(durations.length / 2);
    const median = durations.length % 2 === 0
      ? (durations[midIndex - 1] + durations[midIndex]) / 2
      : durations[midIndex];

    // Count anomalies: durations > 3x median are anomalous
    // This is a simple heuristic that works well for sprint durations
    const threshold = median * 3;
    return durations.filter(d => d > threshold).length;
  }

  /**
   * Calculate average steps per hour (efficiency metric)
   */
  private calculateStepsPerHour(): number {
    const completedWithTimes = this.summaries.filter(
      s => s.status === 'completed' && s.startedAt && s.completedAt && s.completedSteps > 0
    );

    if (completedWithTimes.length === 0) return 0;

    let totalSteps = 0;
    let totalHours = 0;

    for (const sprint of completedWithTimes) {
      const start = new Date(sprint.startedAt!).getTime();
      const end = new Date(sprint.completedAt!).getTime();
      const hours = (end - start) / (1000 * 60 * 60);

      if (hours > 0) {
        totalSteps += sprint.completedSteps;
        totalHours += hours;
      }
    }

    if (totalHours === 0) return 0;
    return Math.round((totalSteps / totalHours) * 10) / 10;
  }

  /**
   * Calculate categorized metrics for organized display
   */
  private calculateCategories(
    successRate: number,
    avgDuration: number,
    avgSteps: number,
    stepsPerHour: number,
    totalSprints: number
  ): MetricCategories {
    // Calculate sprints per day from daily trend
    const dayCount = new Set(
      this.summaries
        .map(s => this.extractDateKey(s.startedAt || s.sprintId))
        .filter(Boolean)
    ).size;
    const sprintsPerDay = dayCount > 0
      ? Math.round((totalSprints / dayCount) * 10) / 10
      : 0;

    return {
      velocity: {
        sprintsPerDay,
        averageStepsPerSprint: avgSteps,
      },
      quality: {
        successRate,
        failureRate: 100 - successRate,
      },
      efficiency: {
        averageDuration: avgDuration,
        stepsPerHour,
      },
    };
  }

  /**
   * Calculate period-over-period comparison
   */
  private calculateComparison(dailyTrend: TrendDataPoint[]): PeriodComparison {
    if (dailyTrend.length < 2) {
      return { successRateChange: 0, durationChange: 0 };
    }

    // Split into two periods
    const midpoint = Math.floor(dailyTrend.length / 2);
    const olderPeriod = dailyTrend.slice(0, midpoint);
    const recentPeriod = dailyTrend.slice(midpoint);

    const olderRate = this.calculatePeriodSuccessRate(olderPeriod);
    const recentRate = this.calculatePeriodSuccessRate(recentPeriod);

    // Calculate duration change by comparing sprints from each period
    const olderDurations = this.getSprintDurationsForPeriod(olderPeriod.map(p => p.dateKey));
    const recentDurations = this.getSprintDurationsForPeriod(recentPeriod.map(p => p.dateKey));

    let durationChange = 0;
    if (olderDurations.length > 0 && recentDurations.length > 0) {
      const olderAvg = olderDurations.reduce((a, b) => a + b, 0) / olderDurations.length;
      const recentAvg = recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length;

      if (olderAvg > 0) {
        durationChange = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
      }
    }

    return {
      successRateChange: recentRate - olderRate,
      durationChange,
    };
  }

  /**
   * Get sprint durations for a set of date keys
   */
  private getSprintDurationsForPeriod(dateKeys: string[]): number[] {
    const dateSet = new Set(dateKeys);
    return this.summaries
      .filter(s => {
        const dateKey = this.extractDateKey(s.startedAt || s.sprintId);
        return dateKey && dateSet.has(dateKey) && s.status === 'completed' && s.startedAt && s.completedAt;
      })
      .map(s => {
        const start = new Date(s.startedAt!).getTime();
        const end = new Date(s.completedAt!).getTime();
        return end - start;
      });
  }

  /**
   * Calculate alerts for metrics needing attention
   */
  private calculateAlerts(successRate: number, durationAnomalies: number): MetricAlert[] {
    const alerts: MetricAlert[] = [];

    // Alert for low success rate
    if (successRate < 50) {
      alerts.push({
        metric: 'successRate',
        severity: 'critical',
        message: `Success rate is critically low at ${successRate}%`,
      });
    } else if (successRate < 80) {
      alerts.push({
        metric: 'successRate',
        severity: 'warning',
        message: `Success rate is below target at ${successRate}%`,
      });
    }

    // Alert for duration anomalies
    if (durationAnomalies > 0) {
      alerts.push({
        metric: 'duration',
        severity: durationAnomalies > 2 ? 'warning' : 'info',
        message: `${durationAnomalies} sprint(s) had unusually long duration`,
      });
    }

    return alerts;
  }

  /**
   * Generate actionable insights about sprint health
   */
  private calculateInsights(
    successRate: number,
    trend: TrendDirection,
    anomalies: number,
    inProgress: number
  ): MetricInsight[] {
    const insights: MetricInsight[] = [];

    // Success rate insight
    if (successRate >= 90) {
      insights.push({
        type: 'success',
        message: 'Excellent success rate - sprints are completing reliably',
      });
    } else if (successRate < 50) {
      insights.push({
        type: 'warning',
        message: 'Low success rate - investigate common failure causes',
      });
    }

    // Trend insight
    if (trend === 'improving') {
      insights.push({
        type: 'success',
        message: 'Success rate is improving over time',
      });
    } else if (trend === 'declining') {
      insights.push({
        type: 'warning',
        message: 'Success rate is declining - consider process review',
      });
    }

    // Anomaly insight
    if (anomalies > 0) {
      insights.push({
        type: 'info',
        message: `${anomalies} sprint(s) had unusual duration - may indicate blockers`,
      });
    }

    // In-progress insight
    if (inProgress > 0) {
      insights.push({
        type: 'info',
        message: `${inProgress} sprint(s) currently in progress`,
      });
    }

    // Ensure at least one insight
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        message: 'Sprint metrics are within normal ranges',
      });
    }

    return insights;
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
