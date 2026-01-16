/**
 * Data transformation functions for converting CompiledProgress to StatusUpdate format
 * Used by the status server to send updates to connected browsers
 */
import type { CompiledProgress, PhaseStatus, StatusUpdate, CurrentTask, PhaseTreeNode, LogEntry, LogEntryType } from './status-types.js';
/**
 * Timing information passed to toStatusUpdate
 */
export interface TimingInfo {
    estimatedRemainingMs: number;
    estimatedRemaining: string;
    estimateConfidence: 'low' | 'medium' | 'high' | 'no-data';
    estimatedCompletionTime: string | null;
}
/**
 * Format an ISO timestamp to a human-readable relative time
 * e.g., "2 minutes ago", "just now", "1 hour ago"
 */
export declare function formatRelativeTime(isoTimestamp: string): string;
/**
 * Format an ISO timestamp to a display time (HH:MM:SS)
 */
export declare function formatDisplayTime(isoTimestamp: string): string;
/**
 * Calculate elapsed time between two ISO timestamps
 * Returns human-readable format like "1m 30s" or "2h 15m"
 */
export declare function calculateElapsed(startIso: string, endIso?: string): string;
/**
 * Count total and completed phases in the progress structure
 */
export declare function countPhases(progress: CompiledProgress): {
    total: number;
    completed: number;
};
/**
 * Calculate progress percentage (0-100)
 */
export declare function calculateProgressPercent(progress: CompiledProgress): number;
/**
 * Build the complete phase tree from CompiledProgress
 */
export declare function buildPhaseTree(progress: CompiledProgress): PhaseTreeNode[];
/**
 * Extract the current task from the progress pointer
 */
export declare function extractCurrentTask(progress: CompiledProgress): CurrentTask | null;
/**
 * Create a log entry for a status change
 */
export declare function createLogEntry(type: LogEntryType, message: string, context?: string, timestamp?: string): LogEntry;
/**
 * Create a log entry from a phase status change
 */
export declare function createStatusLogEntry(status: PhaseStatus, phasePath: string, timestamp?: string): LogEntry;
/**
 * Compare two progress states and generate log entries for changes
 * This is useful for detecting status transitions
 */
export declare function generateDiffLogEntries(oldProgress: CompiledProgress | null, newProgress: CompiledProgress): LogEntry[];
/**
 * Convert CompiledProgress to StatusUpdate format
 * This is the main entry point for transforming progress data for the UI
 */
export declare function toStatusUpdate(progress: CompiledProgress, includeRaw?: boolean, timingInfo?: TimingInfo): StatusUpdate;
//# sourceMappingURL=transforms.d.ts.map