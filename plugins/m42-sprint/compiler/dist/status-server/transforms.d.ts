/**
 * Data transformation functions for converting CompiledProgress to StatusUpdate format
 * Used by the status server to send updates to connected browsers
 */
import type { CompiledProgress, CompiledTopPhase, PhaseStatus, StatusUpdate, CurrentTask, PhaseTreeNode, LogEntry, LogEntryType, DependencyGraph, GraphNodeStatusColor, StatusUpdateWithGraph } from './status-types.js';
/**
 * Compiled dependency node from PROGRESS.yaml
 * (matches scheduler types)
 */
interface CompiledDependencyNode {
    id: string;
    'depends-on': string[];
    'blocked-by': string[];
}
/**
 * Dependency graph structure in PROGRESS.yaml
 */
interface CompiledDependencyGraph {
    'phase-id': string;
    nodes: CompiledDependencyNode[];
}
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
 * Count total steps (leaf-level phases) for "Step X of Y" display
 * Returns the total number of leaf-level phases (sub-phases) across all steps
 */
export declare function countTotalSteps(progress: CompiledProgress): number;
/**
 * Build the complete phase tree from CompiledProgress
 * Uses the current pointer to infer step statuses when they haven't been
 * explicitly updated by the runtime (fixes BUG-001)
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
 * Check if a sprint is stale based on last-activity timestamp.
 * A sprint is stale if it's in-progress but the last-activity was > 15 minutes ago.
 */
export declare function isSprintStale(progress: CompiledProgress): boolean;
/**
 * Convert CompiledProgress to StatusUpdate format
 * This is the main entry point for transforming progress data for the UI
 */
export declare function toStatusUpdate(progress: CompiledProgress, includeRaw?: boolean, timingInfo?: TimingInfo): StatusUpdate;
/**
 * Map PhaseStatus to a visualization color
 */
export declare function statusToColor(status: PhaseStatus): GraphNodeStatusColor;
/**
 * Build dependency graph for a single for-each phase
 */
export declare function buildDependencyGraphForPhase(phase: CompiledTopPhase, depGraphs: CompiledDependencyGraph[], injectedStepIds: Set<string>): DependencyGraph | null;
/**
 * Build all dependency graphs from CompiledProgress
 * Returns an array of DependencyGraph objects for phases with dependencies
 */
export declare function buildDependencyGraphs(progress: CompiledProgress): DependencyGraph[];
/**
 * Extended version of toStatusUpdate that includes dependency graphs
 */
export declare function toStatusUpdateWithGraph(progress: CompiledProgress, includeRaw?: boolean, timingInfo?: TimingInfo): StatusUpdateWithGraph;
export {};
//# sourceMappingURL=transforms.d.ts.map