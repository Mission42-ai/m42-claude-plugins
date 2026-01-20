/**
 * Data transformation functions for converting CompiledProgress to StatusUpdate format
 * Used by the status server to send updates to connected browsers
 */
import type { CompiledProgress, PhaseStatus, StatusUpdate, CurrentTask, PhaseTreeNode, LogEntry, LogEntryType, HookTaskStatus } from './status-types.js';
import type { HookTask } from '../types.js';
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
 * Count total and completed tasks for Ralph mode (dynamic-steps)
 */
export declare function countRalphTasks(progress: CompiledProgress): {
    total: number;
    completed: number;
};
/**
 * Count total and completed phases in the progress structure
 * Handles both standard mode (phases) and Ralph mode (dynamic-steps)
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
 * Uses the current pointer to infer step statuses when they haven't been
 * explicitly updated by the runtime (fixes BUG-001)
 */
export declare function buildPhaseTree(progress: CompiledProgress): PhaseTreeNode[];
/**
 * Build task tree for Ralph mode from dynamic-steps
 * Returns a flat list of task nodes (no hierarchy)
 */
export declare function buildRalphTaskTree(progress: CompiledProgress): PhaseTreeNode[];
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
 * Transform HookTask array to HookTaskStatus array for UI display
 * Groups by iteration and shows latest status for each hook
 */
export declare function transformHookTasks(hookTasks?: HookTask[]): HookTaskStatus[];
/**
 * Convert CompiledProgress to StatusUpdate format
 * This is the main entry point for transforming progress data for the UI
 * Handles both standard mode (phases) and Ralph mode (goal-driven with dynamic-steps)
 */
export declare function toStatusUpdate(progress: CompiledProgress, includeRaw?: boolean, timingInfo?: TimingInfo): StatusUpdate;
//# sourceMappingURL=transforms.d.ts.map