/**
 * Metrics Aggregator - Aggregate statistics across multiple sprints
 * Provides metrics for the sprint dashboard
 */
import type { SprintSummary } from './sprint-scanner.js';
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
/**
 * MetricsAggregator calculates aggregate statistics from sprint summaries
 */
export declare class MetricsAggregator {
    private readonly summaries;
    /**
     * Create a new MetricsAggregator
     * @param summaries Array of SprintSummary objects to aggregate
     */
    constructor(summaries: SprintSummary[]);
    /**
     * Calculate all aggregate metrics
     * @returns AggregateMetrics with all calculated values
     */
    aggregate(): AggregateMetrics;
    /**
     * Return empty metrics for when there are no sprints
     */
    private emptyMetrics;
    /**
     * Count sprints with a specific status
     */
    private countByStatus;
    /**
     * Count failed sprints (blocked, paused, needs-human)
     */
    private countFailedSprints;
    /**
     * Calculate average duration from completed sprints with timestamps
     */
    private calculateAverageDuration;
    /**
     * Calculate average steps per sprint
     */
    private calculateAverageSteps;
    /**
     * Calculate workflow usage statistics with per-workflow success rates
     */
    private calculateWorkflowStats;
    /**
     * Calculate daily trend data
     */
    private calculateDailyTrend;
    /**
     * Calculate weekly trend data
     */
    private calculateWeeklyTrend;
    /**
     * Extract YYYY-MM-DD date key from timestamp or sprint ID
     */
    private extractDateKey;
    /**
     * Convert date key (YYYY-MM-DD) to week key (YYYY-WXX)
     */
    private getWeekKey;
    /**
     * Check if status is considered failed
     */
    private isFailedStatus;
    /**
     * Calculate health status based on success rate
     * healthy: >= 80%, warning: 50-79%, critical: < 50%
     */
    private calculateHealthStatus;
    /**
     * Calculate success rate trend direction based on daily trend data
     */
    private calculateSuccessRateTrend;
    /**
     * Calculate success rate for a period from trend data
     */
    private calculatePeriodSuccessRate;
    /**
     * Detect duration anomalies using median-based threshold
     * A sprint is anomalous if its duration is > 3x the median duration
     */
    private calculateDurationAnomalies;
    /**
     * Calculate average steps per hour (efficiency metric)
     */
    private calculateStepsPerHour;
    /**
     * Calculate categorized metrics for organized display
     */
    private calculateCategories;
    /**
     * Calculate period-over-period comparison
     */
    private calculateComparison;
    /**
     * Get sprint durations for a set of date keys
     */
    private getSprintDurationsForPeriod;
    /**
     * Calculate alerts for metrics needing attention
     */
    private calculateAlerts;
    /**
     * Generate actionable insights about sprint health
     */
    private calculateInsights;
    /**
     * Format duration in milliseconds to human-readable string
     */
    private formatDuration;
}
/**
 * Convenience function to aggregate sprint metrics
 * @param summaries Array of SprintSummary objects
 * @returns Aggregated metrics
 */
export declare function aggregateMetrics(summaries: SprintSummary[]): AggregateMetrics;
//# sourceMappingURL=metrics-aggregator.d.ts.map