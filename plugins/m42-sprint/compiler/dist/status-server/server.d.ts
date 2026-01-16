/**
 * HTTP Server with SSE endpoint for Sprint Status updates
 * Serves the HTML page and streams real-time progress updates
 */
import type { ServerConfig } from './status-types.js';
/**
 * Status Server class
 * Manages HTTP server, SSE connections, and file watching
 */
export declare class StatusServer {
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
     * Serve the HTML page
     */
    private handlePageRequest;
    /**
     * Handle SSE connection
     */
    private handleSSERequest;
    /**
     * Handle JSON API request
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