"use strict";
/**
 * Metrics Aggregator - Aggregate statistics across multiple sprints
 * Provides metrics for the sprint dashboard
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsAggregator = void 0;
exports.aggregateMetrics = aggregateMetrics;
// ============================================================================
// MetricsAggregator Class
// ============================================================================
/**
 * MetricsAggregator calculates aggregate statistics from sprint summaries
 */
class MetricsAggregator {
    summaries;
    /**
     * Create a new MetricsAggregator
     * @param summaries Array of SprintSummary objects to aggregate
     */
    constructor(summaries) {
        this.summaries = summaries;
    }
    /**
     * Calculate all aggregate metrics
     * @returns AggregateMetrics with all calculated values
     */
    aggregate() {
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
    emptyMetrics() {
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
    countByStatus(status) {
        return this.summaries.filter(s => s.status === status).length;
    }
    /**
     * Count failed sprints (blocked, paused, needs-human)
     */
    countFailedSprints() {
        const failedStatuses = ['blocked', 'paused', 'needs-human'];
        return this.summaries.filter(s => failedStatuses.includes(s.status)).length;
    }
    /**
     * Calculate average duration from completed sprints with timestamps
     */
    calculateAverageDuration() {
        const completedWithTimestamps = this.summaries.filter(s => s.status === 'completed' && s.startedAt && s.completedAt);
        if (completedWithTimestamps.length === 0) {
            return 0;
        }
        let totalMs = 0;
        for (const sprint of completedWithTimestamps) {
            const startTime = new Date(sprint.startedAt).getTime();
            const endTime = new Date(sprint.completedAt).getTime();
            totalMs += endTime - startTime;
        }
        return Math.round(totalMs / completedWithTimestamps.length);
    }
    /**
     * Calculate average steps per sprint
     */
    calculateAverageSteps() {
        if (this.summaries.length === 0) {
            return 0;
        }
        const totalSteps = this.summaries.reduce((sum, s) => sum + s.totalSteps, 0);
        return Math.round((totalSteps / this.summaries.length) * 10) / 10; // 1 decimal place
    }
    /**
     * Calculate workflow usage statistics
     */
    calculateWorkflowStats() {
        const counts = new Map();
        for (const sprint of this.summaries) {
            const workflow = sprint.workflow || 'unknown';
            counts.set(workflow, (counts.get(workflow) || 0) + 1);
        }
        // Convert to array and calculate percentages
        const stats = [];
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
    calculateDailyTrend() {
        const dailyData = new Map();
        for (const sprint of this.summaries) {
            const dateKey = this.extractDateKey(sprint.startedAt || sprint.sprintId);
            if (!dateKey)
                continue;
            const existing = dailyData.get(dateKey) || { count: 0, completed: 0, failed: 0 };
            existing.count++;
            if (sprint.status === 'completed') {
                existing.completed++;
            }
            else if (this.isFailedStatus(sprint.status)) {
                existing.failed++;
            }
            dailyData.set(dateKey, existing);
        }
        // Convert to array and sort by date
        const trend = [];
        for (const [dateKey, data] of dailyData) {
            trend.push({ dateKey, ...data });
        }
        trend.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
        return trend;
    }
    /**
     * Calculate weekly trend data
     */
    calculateWeeklyTrend() {
        const weeklyData = new Map();
        for (const sprint of this.summaries) {
            const dateKey = this.extractDateKey(sprint.startedAt || sprint.sprintId);
            if (!dateKey)
                continue;
            const weekKey = this.getWeekKey(dateKey);
            const existing = weeklyData.get(weekKey) || { count: 0, completed: 0, failed: 0 };
            existing.count++;
            if (sprint.status === 'completed') {
                existing.completed++;
            }
            else if (this.isFailedStatus(sprint.status)) {
                existing.failed++;
            }
            weeklyData.set(weekKey, existing);
        }
        // Convert to array and sort by week
        const trend = [];
        for (const [dateKey, data] of weeklyData) {
            trend.push({ dateKey, ...data });
        }
        trend.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
        return trend;
    }
    /**
     * Extract YYYY-MM-DD date key from timestamp or sprint ID
     */
    extractDateKey(timestampOrId) {
        if (!timestampOrId)
            return null;
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
        }
        catch {
            // Ignore parse errors
        }
        return null;
    }
    /**
     * Convert date key (YYYY-MM-DD) to week key (YYYY-WXX)
     */
    getWeekKey(dateKey) {
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
    isFailedStatus(status) {
        return status === 'blocked' || status === 'paused' || status === 'needs-human';
    }
    /**
     * Format duration in milliseconds to human-readable string
     */
    formatDuration(ms) {
        if (ms <= 0)
            return '0s';
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
exports.MetricsAggregator = MetricsAggregator;
// ============================================================================
// Exported Functions
// ============================================================================
/**
 * Convenience function to aggregate sprint metrics
 * @param summaries Array of SprintSummary objects
 * @returns Aggregated metrics
 */
function aggregateMetrics(summaries) {
    const aggregator = new MetricsAggregator(summaries);
    return aggregator.aggregate();
}
//# sourceMappingURL=metrics-aggregator.js.map