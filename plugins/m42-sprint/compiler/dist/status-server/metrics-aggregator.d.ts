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
     * Calculate workflow usage statistics
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