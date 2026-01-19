/**
 * HTTP Server with SSE endpoint for Sprint Status updates
 * Serves the HTML page and streams real-time progress updates
 */
import { EventEmitter } from 'events';
import type { ServerConfig } from './status-types.js';
/**
 * Events emitted by StatusServer
 */
export interface StatusServerEvents {
    ready: [];
    error: [error: Error];
    close: [];
}
/**
 * Status Server class
 * Manages HTTP server, SSE connections, and file watching
 */
export declare class StatusServer extends EventEmitter {
    private readonly config;
    private server;
    private watcher;
    private activityWatcher;
    private timingTracker;
    private clients;
    private keepAliveTimer;
    private lastProgress;
    private clientIdCounter;
    private progressFilePath;
    private activityFilePath;
    private isReady;
    /** Worktree context for this server instance (detected on startup) */
    private worktreeInfo;
    constructor(config: ServerConfig);
    /**
     * Start the HTTP server and file watcher
     */
    start(): Promise<void>;
    /**
     * Stop the server and clean up resources
     */
    stop(): Promise<void>;
    /**
     * Wait for the server to be ready to accept connections
     * Resolves immediately if already ready, otherwise waits for 'ready' event
     * @throws Error if server doesn't become ready within timeout (10 seconds)
     */
    waitForReady(): Promise<void>;
    /**
     * Get the server URL
     */
    getUrl(): string;
    /**
     * Get the number of connected clients
     */
    getClientCount(): number;
    /**
     * Handle incoming HTTP requests
     */
    private handleRequest;
    /**
     * Serve the HTML page (legacy - now redirects to dashboard or sprint detail)
     */
    private handlePageRequest;
    /**
     * Get the sprints directory path (parent of current sprint)
     */
    private getSprintsDir;
    /**
     * Get the current sprint ID from the sprint directory path
     */
    private getCurrentSprintId;
    /**
     * Serve the dashboard page with sprint list and metrics
     */
    private handleDashboardPageRequest;
    /**
     * Serve the sprint detail page for a specific sprint
     */
    private handleSprintDetailPageRequest;
    /**
     * Handle GET /api/sprints request
     * Returns list of sprints with optional pagination
     * Query params:
     *   - page: Page number (default: 1)
     *   - limit: Items per page (default: 20)
     *   - includeWorktree: Include worktree info (default: false)
     */
    private handleSprintsApiRequest;
    /**
     * Handle GET /api/metrics request
     * Returns aggregate metrics across all sprints
     */
    private handleMetricsApiRequest;
    /**
     * Handle GET /api/worktrees request
     * Returns list of all worktrees in the repository with their active sprints
     *
     * Response format:
     * {
     *   worktrees: [{
     *     name: string,        // "main" or worktree directory name
     *     branch: string,      // Current git branch
     *     commit: string,      // Current commit SHA (abbreviated)
     *     isMain: boolean,     // Whether this is the main worktree
     *     root: string,        // Absolute path to worktree root
     *     sprints: [{          // Sprints in this worktree (newest first)
     *       sprintId: string,
     *       status: string,
     *       startedAt: string | null,
     *       ...SprintSummary fields
     *     }]
     *   }],
     *   total: number,         // Total number of worktrees
     *   serverWorktree: {...}  // This server's worktree context
     * }
     */
    private handleWorktreesApiRequest;
    /**
     * Handle SSE connection
     */
    private handleSSERequest;
    /**
     * Handle JSON API request
     * Returns current sprint status with optional worktree context
     */
    private handleAPIRequest;
    /**
     * Get timing info for the current progress
     */
    private getTimingInfo;
    /**
     * Get available actions based on current sprint status
     */
    private getAvailableActions;
    /**
     * Handle GET /api/controls request
     * Returns available actions based on current sprint state
     */
    private handleControlsRequest;
    /**
     * Handle GET /api/timing request
     * Returns timing estimates and historical statistics for the sprint
     */
    private handleTimingRequest;
    /**
     * Handle POST /api/pause request
     * Creates .pause-requested signal file
     */
    private handlePauseRequest;
    /**
     * Handle POST /api/resume request
     * Creates .resume-requested signal file
     */
    private handleResumeRequest;
    /**
     * Handle POST /api/stop request
     * Creates .stop-requested signal file
     */
    private handleStopRequest;
    /**
     * Find a phase by its path (e.g., "execute-all > step-0 > plan")
     * Returns the location information including indices for updating
     */
    private findPhaseByPath;
    /**
     * Save progress to PROGRESS.yaml and trigger SSE broadcast
     */
    private saveProgress;
    /**
     * Handle POST /api/skip/:phaseId request
     * Marks the specified phase as "skipped" and advances to next phase
     */
    private handleSkipRequest;
    /**
     * Handle POST /api/retry/:phaseId request
     * Resets the specified phase to "pending" for re-execution
     */
    private handleRetryRequest;
    /**
     * Handle POST /api/force-retry/:phaseId request
     * Creates .force-retry-requested signal file to bypass backoff
     */
    private handleForceRetryRequest;
    /**
     * Get log file path from phase ID
     * Phase IDs use ' > ' as separator (e.g., "development > step-0 > context")
     * Log files use '-' as separator (e.g., "development-step-0-context.log")
     */
    private getLogFilePath;
    /**
     * Get list of all log files in the logs directory
     */
    private getLogFiles;
    /**
     * Handle GET /api/logs/:phaseId request
     * Returns the log content for a specific phase
     */
    private handleLogContentRequest;
    /**
     * Handle GET /api/logs/download/:phaseId request
     * Downloads a single log file
     */
    private handleLogDownloadRequest;
    /**
     * Handle GET /api/logs/download-all request
     * Downloads all logs as a gzipped tar archive
     */
    private handleDownloadAllLogs;
    /**
     * Advance the current pointer after skipping a phase
     */
    private advancePointerAfterSkip;
    /**
     * Set the current pointer to a specific phase for retry
     */
    private setPointerToPhase;
    /**
     * Update progress stats after modifying phase statuses
     */
    private updateProgressStats;
    /**
     * Send initial status to a newly connected client
     */
    private sendInitialStatus;
    /**
     * Handle progress file change
     */
    private handleProgressChange;
    /**
     * Load and parse PROGRESS.yaml
     */
    private loadProgress;
    /**
     * Send an SSE event to a specific client
     */
    private sendEvent;
    /**
     * Broadcast an event to all connected clients
     */
    private broadcast;
    /**
     * Broadcast keep-alive to all clients
     */
    private broadcastKeepAlive;
}
/**
 * Create and start a status server
 * Convenience function for common use case
 */
export declare function createStatusServer(config: ServerConfig): Promise<StatusServer>;
//# sourceMappingURL=server.d.ts.map