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
     * Get available actions based on current sprint status
     */
    private getAvailableActions;
    /**
     * Handle GET /api/controls request
     * Returns available actions based on current sprint state
     */
    private handleControlsRequest;
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