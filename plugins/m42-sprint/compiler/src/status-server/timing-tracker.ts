/**
 * Timing Tracker for Sprint Progress Estimation
 * Tracks historical phase durations and calculates estimates for remaining work
 */

import * as fs from 'fs';
import * as path from 'path';

import type { CompiledProgress, CompiledTopPhase, CompiledStep, CompiledPhase } from './status-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Individual phase timing record (stored in JSONL)
 */
export interface PhaseTimingRecord {
  phaseId: string;      // e.g., "context", "implement", "verify"
  workflow: string;     // e.g., "standard-workflow", "step-workflow"
  startTime: string;    // ISO timestamp
  endTime: string;      // ISO timestamp
  durationMs: number;   // Duration in milliseconds
  sprintId?: string;    // Optional: which sprint this was from
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
  basedOn: string;  // Description of what the estimate is based on
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
  variance?: number;  // Actual - Estimated (negative means faster than expected)
  confidence: 'low' | 'medium' | 'high' | 'no-data';
  sampleSize: number;
}

/**
 * Confidence thresholds based on sample size
 */
export const CONFIDENCE_THRESHOLDS = {
  low: 1,      // 1-2 samples
  medium: 3,   // 3-9 samples
  high: 10     // 10+ samples
} as const;

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
export class TimingTracker {
  private readonly sprintDir: string;
  private readonly sprintsBaseDir: string;
  private readonly timingFilePath: string;
  private readonly historyFilePath: string;
  private timingStats: Map<string, PhaseTimingStats> = new Map();
  private workflow: string = 'unknown';

  constructor(sprintDir: string) {
    this.sprintDir = sprintDir;
    this.sprintsBaseDir = path.dirname(sprintDir);
    this.timingFilePath = path.join(sprintDir, 'timing.jsonl');
    this.historyFilePath = path.join(this.sprintsBaseDir, '.timing-history.jsonl');
  }

  /**
   * Load timing history from all sprints and build statistics
   */
  loadTimingHistory(): void {
    this.timingStats.clear();
    const records: PhaseTimingRecord[] = [];

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
  calculateAverages(records: PhaseTimingRecord[]): void {
    // Group by workflow + phaseId
    const groups = new Map<string, PhaseTimingRecord[]>();

    for (const record of records) {
      const key = `${record.workflow}:${record.phaseId}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    // Calculate stats for each group
    for (const [key, groupRecords] of groups) {
      const [workflow, phaseId] = key.split(':');
      const durations = groupRecords.map(r => r.durationMs);

      const stats: PhaseTimingStats = {
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
  getPhaseEstimate(phaseId: string, workflow?: string): TimingEstimate {
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
  estimateRemainingTime(progress: CompiledProgress): SprintTimingInfo {
    // Extract workflow from progress if available
    this.workflow = (progress as any).workflow || 'unknown';

    const phaseEstimates = new Map<string, PhaseEstimateInfo>();
    let totalRemainingMs = 0;
    let minConfidence: 'low' | 'medium' | 'high' | 'no-data' = 'high';
    let totalSampleSize = 0;
    let sampleCount = 0;

    // Iterate through all phases and calculate estimates
    for (const topPhase of progress.phases) {
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
      } else {
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
    let estimatedCompletionTime: string | null = null;
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
  private calculatePhaseEstimateInfo(
    phase: CompiledPhase | CompiledTopPhase,
    phaseId: string
  ): PhaseEstimateInfo {
    const estimate = this.getPhaseEstimate(phaseId);

    // Calculate actual duration if phase is completed
    let actualMs: number | undefined;
    let actualFormatted: string | undefined;
    let variance: number | undefined;

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
  recordPhaseTiming(record: PhaseTimingRecord): void {
    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(this.timingFilePath, line);
  }

  /**
   * Aggregate timing data from sprint to global history
   * Call this when a sprint completes
   */
  aggregateToHistory(): void {
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
    const existingKeys = new Set(
      existingHistory
        .filter(r => r.sprintId === sprintId)
        .map(r => `${r.phaseId}:${r.startTime}`)
    );

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
  getPhaseStats(phaseId: string, workflow?: string): PhaseTimingStats | null {
    const wf = workflow || this.workflow;
    const key = `${wf}:${phaseId}`;
    return this.timingStats.get(key) || null;
  }

  /**
   * Get all timing statistics
   */
  getAllStats(): PhaseTimingStats[] {
    return Array.from(this.timingStats.values());
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Read a JSONL file and parse records
   */
  private readJsonlFile(filePath: string): PhaseTimingRecord[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim() !== '');
      const records: PhaseTimingRecord[] = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (this.isValidTimingRecord(parsed)) {
            records.push(parsed);
          }
        } catch {
          // Skip corrupted lines
          console.warn('[TimingTracker] Skipping corrupted line in JSONL');
        }
      }

      return records;
    } catch {
      return [];
    }
  }

  /**
   * Validate a timing record has required fields
   */
  private isValidTimingRecord(obj: unknown): obj is PhaseTimingRecord {
    if (typeof obj !== 'object' || obj === null) return false;
    const record = obj as Record<string, unknown>;
    return (
      typeof record.phaseId === 'string' &&
      typeof record.workflow === 'string' &&
      typeof record.startTime === 'string' &&
      typeof record.endTime === 'string' &&
      typeof record.durationMs === 'number'
    );
  }

  /**
   * Get list of sprint directories
   */
  private getSprintDirectories(): string[] {
    try {
      const entries = fs.readdirSync(this.sprintsBaseDir, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(e => path.join(this.sprintsBaseDir, e.name));
    } catch {
      return [];
    }
  }

  /**
   * Calculate mean of an array of numbers
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(this.calculateMean(squaredDiffs));
  }

  /**
   * Get confidence level based on sample size
   */
  private getConfidenceLevel(sampleSize: number): 'low' | 'medium' | 'high' {
    if (sampleSize >= CONFIDENCE_THRESHOLDS.high) return 'high';
    if (sampleSize >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
    return 'low';
  }

  /**
   * Compare confidence levels (-1 = a < b, 0 = equal, 1 = a > b)
   */
  private compareConfidence(a: string, b: string): number {
    const order = { 'no-data': 0, low: 1, medium: 2, high: 3 };
    return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
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
 * Load timing history and return a TimingTracker instance
 */
export function loadTimingHistory(sprintDir: string): TimingTracker {
  const tracker = new TimingTracker(sprintDir);
  tracker.loadTimingHistory();
  return tracker;
}

/**
 * Convenience function to estimate remaining time for a sprint
 */
export function estimateRemainingTime(
  sprintDir: string,
  progress: CompiledProgress
): SprintTimingInfo {
  const tracker = loadTimingHistory(sprintDir);
  return tracker.estimateRemainingTime(progress);
}

/**
 * Convenience function to get phase estimate
 */
export function getPhaseEstimate(
  sprintDir: string,
  phaseId: string,
  workflow?: string
): TimingEstimate {
  const tracker = loadTimingHistory(sprintDir);
  return tracker.getPhaseEstimate(phaseId, workflow);
}
