/**
 * Agent Watcher for agent monitor events
 * Watches .agent-events.jsonl file and tracks agent state for workflow visualization
 */
import { EventEmitter } from 'events';
import type { AgentEvent, AgentState, AgentMonitorState, AgentWatcherOptions } from './agent-types.js';
/**
 * Events emitted by AgentWatcher
 */
export interface AgentWatcherEvents {
    /** Emitted when an agent event is received */
    'agent-event': [event: AgentEvent, state: AgentState | null];
    /** Emitted when error occurs */
    error: [error: Error];
    /** Emitted when watcher is ready */
    ready: [];
    /** Emitted when watcher is closed */
    close: [];
}
/**
 * Watches .agent-events.jsonl and maintains live agent state
 *
 * Provides:
 * - Real-time agent event streaming
 * - Computed agent state (emotion, current tool, etc.)
 * - Step-to-agent mapping for workflow visualization
 * - Stale agent cleanup
 */
export declare class AgentWatcher extends EventEmitter {
    private readonly filePath;
    private readonly debounceDelay;
    private readonly staleTimeout;
    private watcher;
    private debounceTimer;
    private staleCleanupTimer;
    private isClosing;
    private lastPosition;
    private lastSize;
    /** Live agent state */
    private state;
    constructor(sprintDir: string, options?: AgentWatcherOptions);
    /**
     * Start watching the agent events file
     */
    start(): void;
    /**
     * Read initial content from file
     */
    private readInitialContent;
    /**
     * Handle file system events with debouncing
     */
    private handleFileEvent;
    /**
     * Process file change - read new content since last position
     */
    private processFileChange;
    /**
     * Parse a single JSONL line and update state
     */
    private parseLine;
    /**
     * Process an event and update agent state
     */
    private processEvent;
    /**
     * Handle agent spawn event
     */
    private handleSpawn;
    /**
     * Handle tool start event
     */
    private handleToolStart;
    /**
     * Handle tool end event
     */
    private handleToolEnd;
    /**
     * Handle agent complete event
     */
    private handleComplete;
    /**
     * Handle subagent spawn event
     */
    private handleSubagentSpawn;
    /**
     * Handle subagent complete event
     */
    private handleSubagentComplete;
    /**
     * Clean up stale agents (no activity for staleTimeout)
     */
    private cleanupStaleAgents;
    /**
     * Get current agent state
     */
    getState(): AgentMonitorState;
    /**
     * Get all active agents as array
     */
    getActiveAgents(): AgentState[];
    /**
     * Get agent by step ID
     */
    getAgentForStep(stepId: string): AgentState | null;
    /**
     * Stop watching and clean up resources
     */
    close(): void;
    /**
     * Get the path being watched
     */
    getFilePath(): string;
    /**
     * Check if the watcher is active
     */
    isWatching(): boolean;
}
//# sourceMappingURL=agent-watcher.d.ts.map