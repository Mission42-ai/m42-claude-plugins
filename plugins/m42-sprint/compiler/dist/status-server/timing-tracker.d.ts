/**
 * Timing Tracker for Sprint Progress Estimation
 * Tracks historical phase durations and calculates estimates for remaining work
 */
import type { CompiledProgress } from './status-types.js';
/**
 * Individual phase timing record (stored in JSONL)
 */
export interface PhaseTimingRecord {
    phaseId: string;
    workflow: string;
    startTime: string;
    endTime: string;
    durationMs: number;
    sprintId?: string;
}
/**
 * Aggregated timing statistics for a phase type
 */
export interface PhaseTimingStats {
    phaseId: string;
    workflow: string;
    sampleSize: number;
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    stdDevMs?: number;
}
/**
 * Estimate result with confidence
 */
export interface TimingEstimate {
    estimatedMs: number;
    confidence: 'low' | 'medium' | 'high' | 'no-data';
    sampleSize: number;
    basedOn: string;
}
/**
 * Extended sprint timing information for UI
 */
export interface SprintTimingInfo {
    estimatedRemainingMs: number;
    estimatedRemaining: string;
    estimateConfidence: 'low' | 'medium' | 'high' | 'no-data';
    estimatedCompletionTime: string | null;
    phaseEstimates: Map<string, PhaseEstimateInfo>;
}
/**
 * Per-phase estimate information
 */
export interface PhaseEstimateInfo {
    phaseId: string;
    estimatedMs: number;
    estimatedFormatted: string;
    actualMs?: number;
    actualFormatted?: string;
    variance?: number;
    confidence: 'low' | 'medium' | 'high' | 'no-data';
    sampleSize: number;
}
/**
 * Confidence thresholds based on sample size
 */
export declare const CONFIDENCE_THRESHOLDS: {
    readonly low: 1;
    readonly medium: 3;
    readonly high: 10;
};
/**
 * TimingTracker manages historical timing data and calculates estimates
 */
export declare class TimingTracker {
    private readonly sprintDir;
    private readonly sprintsBaseDir;
    private readonly timingFilePath;
    private readonly historyFilePath;
    private timingStats;
    private workflow;
    constructor(sprintDir: string);
    /**
     * Load timing history from all sprints and build statistics
     */
    loadTimingHistory(): void;
    /**
     * Calculate rolling averages per workflow/phase type
     */
    calculateAverages(records: PhaseTimingRecord[]): void;
    /**
     * Get phase estimate based on historical data
     */
    getPhaseEstimate(phaseId: string, workflow?: string): TimingEstimate;
    /**
     * Estimate remaining time for a sprint
     */
    estimateRemainingTime(progress: CompiledProgress): SprintTimingInfo;
    /**
     * Calculate estimate info for a single phase
     */
    private calculatePhaseEstimateInfo;
    /**
     * Append a timing record to the sprint's timing.jsonl file
     */
    recordPhaseTiming(record: PhaseTimingRecord): void;
    /**
     * Aggregate timing data from sprint to global history
     * Call this when a sprint completes
     */
    aggregateToHistory(): void;
    /**
     * Get timing statistics for a specific phase
     */
    getPhaseStats(phaseId: string, workflow?: string): PhaseTimingStats | null;
    /**
     * Get all timing statistics
     */
    getAllStats(): PhaseTimingStats[];
    /**
     * Read a JSONL file and parse records
     */
    private readJsonlFile;
    /**
     * Validate a timing record has required fields
     */
    private isValidTimingRecord;
    /**
     * Get list of sprint directories
     */
    private getSprintDirectories;
    /**
     * Calculate mean of an array of numbers
     */
    private calculateMean;
    /**
     * Calculate standard deviation
     */
    private calculateStdDev;
    /**
     * Get confidence level based on sample size
     */
    private getConfidenceLevel;
    /**
     * Compare confidence levels (-1 = a < b, 0 = equal, 1 = a > b)
     */
    private compareConfidence;
    /**
     * Format duration in milliseconds to human-readable string
     */
    private formatDuration;
}
/**
 * Load timing history and return a TimingTracker instance
 */
export declare function loadTimingHistory(sprintDir: string): TimingTracker;
/**
 * Convenience function to estimate remaining time for a sprint
 */
export declare function estimateRemainingTime(sprintDir: string, progress: CompiledProgress): SprintTimingInfo;
/**
 * Convenience function to get phase estimate
 */
export declare function getPhaseEstimate(sprintDir: string, phaseId: string, workflow?: string): TimingEstimate;
//# sourceMappingURL=timing-tracker.d.ts.map