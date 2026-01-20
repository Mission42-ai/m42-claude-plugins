/**
 * TypeScript types for activity event streaming
 * Used by ActivityWatcher to parse and validate events from .sprint-activity.jsonl
 */
/**
 * Verbosity levels for filtering activity events
 * Each level includes events of lower levels:
 * - minimal: Only major milestones
 * - basic: File operations (Read, Write, Edit)
 * - detailed: All tool calls with parameters
 * - verbose: Full input/output data
 */
export type VerbosityLevel = 'minimal' | 'basic' | 'detailed' | 'verbose';
/**
 * Numeric ordering of verbosity levels for comparison
 */
export declare const VERBOSITY_ORDER: Record<VerbosityLevel, number>;
/**
 * Check if an event level should be shown at a given display level
 */
export declare function shouldShowAtLevel(eventLevel: VerbosityLevel, displayLevel: VerbosityLevel): boolean;
/**
 * Base activity event fields shared by all event types
 */
interface BaseActivityEvent {
    /** ISO-8601 timestamp */
    ts: string;
    /** Verbosity level this event belongs to */
    level: VerbosityLevel;
}
/**
 * Tool activity event - emitted when Claude uses a tool
 */
export interface ToolActivityEvent extends BaseActivityEvent {
    /** Event type */
    type: 'tool';
    /** Tool name (Read, Write, Bash, Edit, Grep, Glob, etc.) */
    tool: string;
    /** File path (for Read, Write, Edit operations) */
    file?: string;
    /** Additional parameters (for Bash commands, Grep patterns, etc.) */
    params?: string;
    /** Full tool input (verbose level only) */
    input?: unknown;
    /** Full tool response (verbose level only) */
    response?: unknown;
}
/**
 * Assistant activity event - emitted when Claude writes text
 */
export interface AssistantActivityEvent extends BaseActivityEvent {
    /** Event type */
    type: 'assistant';
    /** Tool field (empty string for assistant events, for compatibility) */
    tool?: string;
    /** Text content from assistant */
    text?: string;
    /** True if assistant is still typing/thinking */
    isThinking?: boolean;
}
/**
 * Activity event - discriminated union of tool and assistant events
 */
export type ActivityEvent = ToolActivityEvent | AssistantActivityEvent;
/**
 * Type guard to check if an object is a valid ActivityEvent
 */
export declare function isActivityEvent(obj: unknown): obj is ActivityEvent;
/**
 * Type guard for VerbosityLevel
 */
export declare function isVerbosityLevel(value: unknown): value is VerbosityLevel;
/**
 * Default number of activity lines to read from end of file
 * Used by both ActivityWatcher (for initial read) and StatusServer (for new client connections)
 */
export declare const DEFAULT_ACTIVITY_TAIL_LINES = 50;
/**
 * Options for ActivityWatcher
 */
export interface ActivityWatcherOptions {
    /** Debounce delay in milliseconds (default: 100) */
    debounceDelay?: number;
    /** Initial lines to read from end of file (default: DEFAULT_ACTIVITY_TAIL_LINES) */
    tailLines?: number;
}
/**
 * SSE event for activity updates
 */
export interface ActivityEventSSE {
    type: 'activity-event';
    data: ActivityEvent;
    timestamp: string;
}
export {};
//# sourceMappingURL=activity-types.d.ts.map