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
     * Calculate workflow usage statistics with per-workflow success rates
     */
    calculateWorkflowStats() {
        const workflowData = new Map();
        for (const sprint of this.summaries) {
            const workflow = sprint.workflow || 'unknown';
            const data = workflowData.get(workflow) || { total: 0, completed: 0, failed: 0 };
            data.total++;
            if (sprint.status === 'completed') {
                data.completed++;
            }
            else if (this.isFailedStatus(sprint.status)) {
                data.failed++;
            }
            workflowData.set(workflow, data);
        }
        // Convert to array and calculate percentages + success rates
        const stats = [];
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
    // =========================================================================
    // BUG-004: Additional calculation methods for actionable metrics
    // =========================================================================
    /**
     * Calculate health status based on success rate
     * healthy: >= 80%, warning: 50-79%, critical: < 50%
     */
    calculateHealthStatus(successRate) {
        if (successRate >= 80)
            return 'healthy';
        if (successRate >= 50)
            return 'warning';
        return 'critical';
    }
    /**
     * Calculate success rate trend direction based on daily trend data
     */
    calculateSuccessRateTrend(dailyTrend) {
        if (dailyTrend.length < 2)
            return 'stable';
        // Compare recent half vs older half
        const midpoint = Math.floor(dailyTrend.length / 2);
        const olderHalf = dailyTrend.slice(0, midpoint);
        const recentHalf = dailyTrend.slice(midpoint);
        const olderRate = this.calculatePeriodSuccessRate(olderHalf);
        const recentRate = this.calculatePeriodSuccessRate(recentHalf);
        const diff = recentRate - olderRate;
        // Consider a 10% change as significant
        if (diff >= 10)
            return 'improving';
        if (diff <= -10)
            return 'declining';
        return 'stable';
    }
    /**
     * Calculate success rate for a period from trend data
     */
    calculatePeriodSuccessRate(trend) {
        let totalCompleted = 0;
        let totalFailed = 0;
        for (const point of trend) {
            totalCompleted += point.completed;
            totalFailed += point.failed;
        }
        const total = totalCompleted + totalFailed;
        if (total === 0)
            return 0;
        return Math.round((totalCompleted / total) * 100);
    }
    /**
     * Detect duration anomalies using median-based threshold
     * A sprint is anomalous if its duration is > 3x the median duration
     */
    calculateDurationAnomalies() {
        const durations = this.summaries
            .filter(s => s.status === 'completed' && s.startedAt && s.completedAt)
            .map(s => {
            const start = new Date(s.startedAt).getTime();
            const end = new Date(s.completedAt).getTime();
            return end - start;
        })
            .sort((a, b) => a - b);
        if (durations.length < 3)
            return 0;
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
    calculateStepsPerHour() {
        const completedWithTimes = this.summaries.filter(s => s.status === 'completed' && s.startedAt && s.completedAt && s.completedSteps > 0);
        if (completedWithTimes.length === 0)
            return 0;
        let totalSteps = 0;
        let totalHours = 0;
        for (const sprint of completedWithTimes) {
            const start = new Date(sprint.startedAt).getTime();
            const end = new Date(sprint.completedAt).getTime();
            const hours = (end - start) / (1000 * 60 * 60);
            if (hours > 0) {
                totalSteps += sprint.completedSteps;
                totalHours += hours;
            }
        }
        if (totalHours === 0)
            return 0;
        return Math.round((totalSteps / totalHours) * 10) / 10;
    }
    /**
     * Calculate categorized metrics for organized display
     */
    calculateCategories(successRate, avgDuration, avgSteps, stepsPerHour, totalSprints) {
        // Calculate sprints per day from daily trend
        const dayCount = new Set(this.summaries
            .map(s => this.extractDateKey(s.startedAt || s.sprintId))
            .filter(Boolean)).size;
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
    calculateComparison(dailyTrend) {
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
    getSprintDurationsForPeriod(dateKeys) {
        const dateSet = new Set(dateKeys);
        return this.summaries
            .filter(s => {
            const dateKey = this.extractDateKey(s.startedAt || s.sprintId);
            return dateKey && dateSet.has(dateKey) && s.status === 'completed' && s.startedAt && s.completedAt;
        })
            .map(s => {
            const start = new Date(s.startedAt).getTime();
            const end = new Date(s.completedAt).getTime();
            return end - start;
        });
    }
    /**
     * Calculate alerts for metrics needing attention
     */
    calculateAlerts(successRate, durationAnomalies) {
        const alerts = [];
        // Alert for low success rate
        if (successRate < 50) {
            alerts.push({
                metric: 'successRate',
                severity: 'critical',
                message: `Success rate is critically low at ${successRate}%`,
            });
        }
        else if (successRate < 80) {
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
    calculateInsights(successRate, trend, anomalies, inProgress) {
        const insights = [];
        // Success rate insight
        if (successRate >= 90) {
            insights.push({
                type: 'success',
                message: 'Excellent success rate - sprints are completing reliably',
            });
        }
        else if (successRate < 50) {
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
        }
        else if (trend === 'declining') {
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