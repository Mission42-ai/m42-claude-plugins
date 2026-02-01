"use strict";
/**
 * Timing Tracker for Sprint Progress Estimation
 * Tracks historical phase durations and calculates estimates for remaining work
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimingTracker = exports.CONFIDENCE_THRESHOLDS = void 0;
exports.loadTimingHistory = loadTimingHistory;
exports.estimateRemainingTime = estimateRemainingTime;
exports.getPhaseEstimate = getPhaseEstimate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Confidence thresholds based on sample size
 */
exports.CONFIDENCE_THRESHOLDS = {
    low: 1, // 1-2 samples
    medium: 3, // 3-9 samples
    high: 10 // 10+ samples
};
/**
 * Default estimate when no historical data (5 minutes per phase)
 */
const DEFAULT_PHASE_ESTIMATE_MS = 5 * 60 * 1000;
// ============================================================================
// Timing Tracker Class
// ============================================================================
/**
 * TimingTracker manages historical timing data and calculates estimates
 */
class TimingTracker {
    sprintDir;
    sprintsBaseDir;
    timingFilePath;
    historyFilePath;
    timingStats = new Map();
    workflow = 'unknown';
    constructor(sprintDir) {
        this.sprintDir = sprintDir;
        this.sprintsBaseDir = path.dirname(sprintDir);
        this.timingFilePath = path.join(sprintDir, 'timing.jsonl');
        this.historyFilePath = path.join(this.sprintsBaseDir, '.timing-history.jsonl');
    }
    /**
     * Load timing history from all sprints and build statistics
     */
    loadTimingHistory() {
        this.timingStats.clear();
        const records = [];
        // Load from global history file first
        if (fs.existsSync(this.historyFilePath)) {
            const historyRecords = this.readJsonlFile(this.historyFilePath);
            records.push(...historyRecords);
        }
        // Also scan individual sprint timing files to catch recent data
        const sprintDirs = this.getSprintDirectories();
        for (const dir of sprintDirs) {
            const timingFile = path.join(dir, 'timing.jsonl');
            if (fs.existsSync(timingFile)) {
                const sprintRecords = this.readJsonlFile(timingFile);
                records.push(...sprintRecords);
            }
        }
        // Aggregate statistics
        this.calculateAverages(records);
    }
    /**
     * Calculate rolling averages per workflow/phase type
     */
    calculateAverages(records) {
        // Group by workflow + phaseId
        const groups = new Map();
        for (const record of records) {
            const key = `${record.workflow}:${record.phaseId}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(record);
        }
        // Calculate stats for each group
        for (const [key, groupRecords] of groups) {
            const [workflow, phaseId] = key.split(':');
            const durations = groupRecords.map(r => r.durationMs);
            const stats = {
                phaseId,
                workflow,
                sampleSize: durations.length,
                avgDurationMs: this.calculateMean(durations),
                minDurationMs: Math.min(...durations),
                maxDurationMs: Math.max(...durations),
                stdDevMs: this.calculateStdDev(durations),
            };
            this.timingStats.set(key, stats);
        }
    }
    /**
     * Get phase estimate based on historical data
     */
    getPhaseEstimate(phaseId, workflow) {
        const wf = workflow || this.workflow;
        const key = `${wf}:${phaseId}`;
        const stats = this.timingStats.get(key);
        // First-run case: no historical data
        if (!stats) {
            return {
                estimatedMs: DEFAULT_PHASE_ESTIMATE_MS,
                confidence: 'no-data',
                sampleSize: 0,
                basedOn: 'default estimate (no historical data)',
            };
        }
        return {
            estimatedMs: Math.round(stats.avgDurationMs),
            confidence: this.getConfidenceLevel(stats.sampleSize),
            sampleSize: stats.sampleSize,
            basedOn: `average of ${stats.sampleSize} past executions`,
        };
    }
    /**
     * Estimate remaining time for a sprint
     */
    estimateRemainingTime(progress) {
        // Extract workflow from progress if available
        this.workflow = progress.workflow || 'unknown';
        const phaseEstimates = new Map();
        let totalRemainingMs = 0;
        let minConfidence = 'high';
        let totalSampleSize = 0;
        let sampleCount = 0;
        // Iterate through all phases and calculate estimates
        const phases = progress.phases ?? [];
        for (const topPhase of phases) {
            if (topPhase.steps) {
                // For-each phase with steps
                for (const step of topPhase.steps) {
                    for (const subPhase of step.phases) {
                        const phasePath = `${topPhase.id} > ${step.id} > ${subPhase.id}`;
                        const info = this.calculatePhaseEstimateInfo(subPhase, subPhase.id);
                        phaseEstimates.set(phasePath, info);
                        if (subPhase.status === 'pending' || subPhase.status === 'in-progress') {
                            totalRemainingMs += info.estimatedMs;
                            if (this.compareConfidence(info.confidence, minConfidence) < 0) {
                                minConfidence = info.confidence;
                            }
                        }
                        totalSampleSize += info.sampleSize;
                        sampleCount++;
                    }
                }
            }
            else {
                // Simple phase without steps
                const phasePath = topPhase.id;
                const info = this.calculatePhaseEstimateInfo(topPhase, topPhase.id);
                phaseEstimates.set(phasePath, info);
                if (topPhase.status === 'pending' || topPhase.status === 'in-progress') {
                    totalRemainingMs += info.estimatedMs;
                    if (this.compareConfidence(info.confidence, minConfidence) < 0) {
                        minConfidence = info.confidence;
                    }
                }
                totalSampleSize += info.sampleSize;
                sampleCount++;
            }
        }
        // Determine overall confidence
        const avgSampleSize = sampleCount > 0 ? totalSampleSize / sampleCount : 0;
        const overallConfidence = avgSampleSize === 0 ? 'no-data' : this.getConfidenceLevel(avgSampleSize);
        // Calculate estimated completion time
        let estimatedCompletionTime = null;
        if (totalRemainingMs > 0) {
            const completionDate = new Date(Date.now() + totalRemainingMs);
            estimatedCompletionTime = completionDate.toISOString();
        }
        return {
            estimatedRemainingMs: totalRemainingMs,
            estimatedRemaining: this.formatDuration(totalRemainingMs),
            estimateConfidence: overallConfidence,
            estimatedCompletionTime,
            phaseEstimates,
        };
    }
    /**
     * Calculate estimate info for a single phase
     */
    calculatePhaseEstimateInfo(phase, phaseId) {
        const estimate = this.getPhaseEstimate(phaseId);
        // Calculate actual duration if phase is completed
        let actualMs;
        let actualFormatted;
        let variance;
        if (phase.status === 'completed' && phase['started-at'] && phase['completed-at']) {
            const startTime = new Date(phase['started-at']).getTime();
            const endTime = new Date(phase['completed-at']).getTime();
            actualMs = endTime - startTime;
            actualFormatted = this.formatDuration(actualMs);
            variance = actualMs - estimate.estimatedMs;
        }
        return {
            phaseId,
            estimatedMs: estimate.estimatedMs,
            estimatedFormatted: this.formatDuration(estimate.estimatedMs),
            actualMs,
            actualFormatted,
            variance,
            confidence: estimate.confidence,
            sampleSize: estimate.sampleSize,
        };
    }
    /**
     * Append a timing record to the sprint's timing.jsonl file
     */
    recordPhaseTiming(record) {
        const line = JSON.stringify(record) + '\n';
        fs.appendFileSync(this.timingFilePath, line);
    }
    /**
     * Aggregate timing data from sprint to global history
     * Call this when a sprint completes
     */
    aggregateToHistory() {
        if (!fs.existsSync(this.timingFilePath)) {
            return;
        }
        const records = this.readJsonlFile(this.timingFilePath);
        // Append to global history (avoiding duplicates by checking sprintId)
        const sprintId = path.basename(this.sprintDir);
        const existingHistory = fs.existsSync(this.historyFilePath)
            ? this.readJsonlFile(this.historyFilePath)
            : [];
        // Filter out records from this sprint that are already in history
        const existingKeys = new Set(existingHistory
            .filter(r => r.sprintId === sprintId)
            .map(r => `${r.phaseId}:${r.startTime}`));
        const newRecords = records.filter(r => {
            const key = `${r.phaseId}:${r.startTime}`;
            return !existingKeys.has(key);
        });
        if (newRecords.length > 0) {
            const lines = newRecords.map(r => JSON.stringify({ ...r, sprintId })).join('\n') + '\n';
            fs.appendFileSync(this.historyFilePath, lines);
        }
    }
    /**
     * Get timing statistics for a specific phase
     */
    getPhaseStats(phaseId, workflow) {
        const wf = workflow || this.workflow;
        const key = `${wf}:${phaseId}`;
        return this.timingStats.get(key) || null;
    }
    /**
     * Get all timing statistics
     */
    getAllStats() {
        return Array.from(this.timingStats.values());
    }
    // ============================================================================
    // Private Helpers
    // ============================================================================
    /**
     * Read a JSONL file and parse records
     */
    readJsonlFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim() !== '');
            const records = [];
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    if (this.isValidTimingRecord(parsed)) {
                        records.push(parsed);
                    }
                }
                catch {
                    // Skip corrupted lines
                    console.warn('[TimingTracker] Skipping corrupted line in JSONL');
                }
            }
            return records;
        }
        catch {
            return [];
        }
    }
    /**
     * Validate a timing record has required fields
     */
    isValidTimingRecord(obj) {
        if (typeof obj !== 'object' || obj === null)
            return false;
        const record = obj;
        return (typeof record.phaseId === 'string' &&
            typeof record.workflow === 'string' &&
            typeof record.startTime === 'string' &&
            typeof record.endTime === 'string' &&
            typeof record.durationMs === 'number');
    }
    /**
     * Get list of sprint directories
     */
    getSprintDirectories() {
        try {
            const entries = fs.readdirSync(this.sprintsBaseDir, { withFileTypes: true });
            return entries
                .filter(e => e.isDirectory() && !e.name.startsWith('.'))
                .map(e => path.join(this.sprintsBaseDir, e.name));
        }
        catch {
            return [];
        }
    }
    /**
     * Calculate mean of an array of numbers
     */
    calculateMean(values) {
        if (values.length === 0)
            return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    /**
     * Calculate standard deviation
     */
    calculateStdDev(values) {
        if (values.length < 2)
            return 0;
        const mean = this.calculateMean(values);
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return Math.sqrt(this.calculateMean(squaredDiffs));
    }
    /**
     * Get confidence level based on sample size
     */
    getConfidenceLevel(sampleSize) {
        if (sampleSize >= exports.CONFIDENCE_THRESHOLDS.high)
            return 'high';
        if (sampleSize >= exports.CONFIDENCE_THRESHOLDS.medium)
            return 'medium';
        return 'low';
    }
    /**
     * Compare confidence levels (-1 = a < b, 0 = equal, 1 = a > b)
     */
    compareConfidence(a, b) {
        const order = { 'no-data': 0, low: 1, medium: 2, high: 3 };
        return (order[a] || 0) - (order[b] || 0);
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
exports.TimingTracker = TimingTracker;
// ============================================================================
// Exported Functions
// ============================================================================
/**
 * Load timing history and return a TimingTracker instance
 */
function loadTimingHistory(sprintDir) {
    const tracker = new TimingTracker(sprintDir);
    tracker.loadTimingHistory();
    return tracker;
}
/**
 * Convenience function to estimate remaining time for a sprint
 */
function estimateRemainingTime(sprintDir, progress) {
    const tracker = loadTimingHistory(sprintDir);
    return tracker.estimateRemainingTime(progress);
}
/**
 * Convenience function to get phase estimate
 */
function getPhaseEstimate(sprintDir, phaseId, workflow) {
    const tracker = loadTimingHistory(sprintDir);
    return tracker.getPhaseEstimate(phaseId, workflow);
}
//# sourceMappingURL=timing-tracker.js.map