/**
 * TypeScript interfaces for the Sprint Status Server
 * These types are used for real-time status updates via SSE
 */
import type { CompiledProgress, CompiledTopPhase, CompiledStep, CompiledPhase, PhaseStatus, SprintStatus } from '../types.js';
/**
 * Types of events sent over the SSE connection
 */
export type SSEEventType = 'status-update' | 'log-entry' | 'keep-alive';
/**
 * Generic SSE event wrapper
 */
export interface SSEEvent<T extends SSEEventType, D> {
    type: T;
    data: D;
    timestamp: string;
}
/**
 * A phase node in the UI tree representation
 */
export interface PhaseTreeNode {
    id: string;
    label: string;
    status: PhaseStatus;
    type: 'phase' | 'step' | 'sub-phase';
    depth: number;
    children?: PhaseTreeNode[];
    startedAt?: string;
    completedAt?: string;
    elapsed?: string;
    error?: string;
    /** Number of retry attempts made */
    'retry-count'?: number;
    /** ISO timestamp for next scheduled retry */
    'next-retry-at'?: string;
    /** Classified error category */
    'error-category'?: string;
}
/**
 * Current task information displayed prominently in the UI
 */
export interface CurrentTask {
    /** Full path to current position (e.g., "phase-1 > step-0 > implement") */
    path: string;
    /** The prompt being executed */
    prompt: string;
    /** ISO timestamp when task started */
    startedAt?: string;
    /** Elapsed time since start (human readable) */
    elapsed?: string;
}
/**
 * Sprint header information
 */
export interface SprintHeader {
    /** Sprint identifier */
    sprintId: string;
    /** Overall sprint status */
    status: SprintStatus;
    /** Progress percentage (0-100) */
    progressPercent: number;
    /** Completed phases count */
    completedPhases: number;
    /** Total phases count */
    totalPhases: number;
    /** Current iteration number (for retry loops) */
    currentIteration?: number;
    /** Maximum iterations allowed */
    maxIterations?: number;
    /** ISO timestamp when sprint started */
    startedAt?: string;
    /** Total elapsed time */
    elapsed?: string;
    /** Estimated milliseconds remaining */
    estimatedRemainingMs?: number;
    /** Formatted estimated time remaining */
    estimatedRemaining?: string;
    /** Confidence level of the estimate */
    estimateConfidence?: 'low' | 'medium' | 'high' | 'no-data';
    /** Estimated completion time (ISO) */
    estimatedCompletionTime?: string;
}
/**
 * Complete status update sent to clients
 */
export interface StatusUpdate {
    /** Sprint header with overall status */
    header: SprintHeader;
    /** Hierarchical phase tree for sidebar */
    phaseTree: PhaseTreeNode[];
    /** Current task being executed (if any) */
    currentTask: CurrentTask | null;
    /** Raw progress data for debugging */
    raw?: CompiledProgress;
}
/**
 * Type of log entry for styling
 */
export type LogEntryType = 'info' | 'start' | 'complete' | 'error' | 'warning' | 'skip';
/**
 * A log entry for the activity feed
 */
export interface LogEntry {
    /** Unique ID for this log entry */
    id: string;
    /** Type of log entry (for styling) */
    type: LogEntryType;
    /** Human-readable message */
    message: string;
    /** ISO timestamp */
    timestamp: string;
    /** Optional phase/step path context */
    context?: string;
}
/**
 * Configuration for the status server
 */
export interface ServerConfig {
    /** Port to listen on (default: 3100) */
    port: number;
    /** Host to bind to (default: localhost) */
    host: string;
    /** Path to sprint directory containing PROGRESS.yaml */
    sprintDir: string;
    /** Keep-alive interval in milliseconds (default: 15000) */
    keepAliveInterval?: number;
    /** File watcher debounce delay in milliseconds (default: 100) */
    debounceDelay?: number;
}
/**
 * Status update event
 */
export type StatusUpdateEvent = SSEEvent<'status-update', StatusUpdate>;
/**
 * Log entry event
 */
export type LogEntryEvent = SSEEvent<'log-entry', LogEntry>;
/**
 * Keep-alive event (empty payload)
 */
export type KeepAliveEvent = SSEEvent<'keep-alive', null>;
/**
 * Union of all SSE event types
 */
export type AnySSEEvent = StatusUpdateEvent | LogEntryEvent | KeepAliveEvent;
export type { CompiledProgress, CompiledTopPhase, CompiledStep, CompiledPhase, PhaseStatus, SprintStatus, };
//# sourceMappingURL=status-types.d.ts.map