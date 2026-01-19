"use strict";
/**
 * HTTP Server with SSE endpoint for Sprint Status updates
 * Serves the HTML page and streams real-time progress updates
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusServer = void 0;
exports.createStatusServer = createStatusServer;
const events_1 = require("events");
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const zlib = __importStar(require("zlib"));
const watcher_js_1 = require("./watcher.js");
const activity_watcher_js_1 = require("./activity-watcher.js");
const transforms_js_1 = require("./transforms.js");
const page_js_1 = require("./page.js");
const timing_tracker_js_1 = require("./timing-tracker.js");
const sprint_scanner_js_1 = require("./sprint-scanner.js");
const metrics_aggregator_js_1 = require("./metrics-aggregator.js");
const dashboard_page_js_1 = require("./dashboard-page.js");
const worktree_js_1 = require("./worktree.js");
/**
 * Default configuration values
 */
const DEFAULT_KEEP_ALIVE_INTERVAL = 15000; // 15 seconds
const DEFAULT_PORT = 3100;
const DEFAULT_HOST = 'localhost';
/**
 * Default timeout for server ready signal in milliseconds
 */
const DEFAULT_READY_TIMEOUT = 10_000; // 10 seconds
/**
 * Status Server class
 * Manages HTTP server, SSE connections, and file watching
 */
class StatusServer extends events_1.EventEmitter {
    config;
    server = null;
    watcher = null;
    activityWatcher = null;
    timingTracker = null;
    clients = new Map();
    keepAliveTimer = null;
    lastProgress = null;
    clientIdCounter = 0;
    progressFilePath;
    activityFilePath;
    isReady = false;
    /** Worktree context for this server instance (detected on startup) */
    worktreeInfo = null;
    constructor(config) {
        super();
        this.config = {
            port: config.port ?? DEFAULT_PORT,
            host: config.host ?? DEFAULT_HOST,
            sprintDir: config.sprintDir,
            keepAliveInterval: config.keepAliveInterval ?? DEFAULT_KEEP_ALIVE_INTERVAL,
            debounceDelay: config.debounceDelay ?? 100,
        };
        this.progressFilePath = path.join(this.config.sprintDir, 'PROGRESS.yaml');
        this.activityFilePath = path.join(this.config.sprintDir, '.sprint-activity.jsonl');
    }
    /**
     * Start the HTTP server and file watcher
     */
    async start() {
        // Validate that PROGRESS.yaml exists
        if (!fs.existsSync(this.progressFilePath)) {
            throw new Error(`PROGRESS.yaml not found: ${this.progressFilePath}`);
        }
        // Detect worktree context for this server instance
        this.worktreeInfo = (0, worktree_js_1.detectWorktree)(this.config.sprintDir);
        // Create HTTP server
        this.server = http.createServer((req, res) => this.handleRequest(req, res));
        // Set up file watcher
        this.watcher = new watcher_js_1.ProgressWatcher(this.progressFilePath, {
            debounceDelay: this.config.debounceDelay,
        });
        this.watcher.on('change', () => {
            this.handleProgressChange();
        });
        this.watcher.on('error', (error) => {
            console.error('[StatusServer] Watcher error:', error.message);
        });
        this.watcher.start();
        // Set up activity watcher (does not require file to exist)
        this.activityWatcher = new activity_watcher_js_1.ActivityWatcher(this.activityFilePath, {
            debounceDelay: this.config.debounceDelay,
        });
        this.activityWatcher.on('activity', (event) => {
            this.broadcast('activity-event', event);
        });
        this.activityWatcher.on('error', (error) => {
            console.error('[StatusServer] Activity watcher error:', error.message);
        });
        this.activityWatcher.start();
        // Initialize timing tracker for progress estimation
        this.timingTracker = new timing_tracker_js_1.TimingTracker(this.config.sprintDir);
        this.timingTracker.loadTimingHistory();
        // Start keep-alive timer
        this.keepAliveTimer = setInterval(() => {
            this.broadcastKeepAlive();
        }, this.config.keepAliveInterval);
        // Start listening
        return new Promise((resolve, reject) => {
            this.server.on('error', (error) => {
                reject(error);
            });
            this.server.listen(this.config.port, this.config.host, () => {
                this.isReady = true;
                this.emit('ready');
                resolve();
            });
        });
    }
    /**
     * Stop the server and clean up resources
     */
    async stop() {
        // Stop keep-alive timer
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
        // Close all SSE connections
        for (const client of this.clients.values()) {
            client.response.end();
        }
        this.clients.clear();
        // Stop file watcher
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        // Stop activity watcher
        if (this.activityWatcher) {
            this.activityWatcher.close();
            this.activityWatcher = null;
        }
        // Close HTTP server
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    this.server = null;
                    resolve();
                });
            });
        }
    }
    /**
     * Wait for the server to be ready to accept connections
     * Resolves immediately if already ready, otherwise waits for 'ready' event
     * @throws Error if server doesn't become ready within timeout (10 seconds)
     */
    waitForReady() {
        const timeout = DEFAULT_READY_TIMEOUT;
        // If already ready, resolve immediately
        if (this.isReady) {
            return Promise.resolve();
        }
        // Wait for ready event with timeout
        return Promise.race([
            new Promise((resolve) => {
                this.once('ready', resolve);
            }),
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Server failed to start within ${timeout}ms timeout`));
                }, timeout);
            }),
        ]);
    }
    /**
     * Get the server URL
     */
    getUrl() {
        return `http://${this.config.host}:${this.config.port}`;
    }
    /**
     * Get the number of connected clients
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Handle incoming HTTP requests
     */
    handleRequest(req, res) {
        const url = req.url || '/';
        // Enable CORS for all requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        // Control endpoints that accept POST
        const controlEndpoints = ['/api/pause', '/api/resume', '/api/stop'];
        const isControlEndpoint = controlEndpoints.includes(url);
        // Check for skip/retry/force-retry endpoints with phaseId param
        const skipMatch = url.match(/^\/api\/skip\/(.+)$/);
        const retryMatch = url.match(/^\/api\/retry\/(.+)$/);
        const forceRetryMatch = url.match(/^\/api\/force-retry\/(.+)$/);
        const isPhaseActionEndpoint = skipMatch || retryMatch || forceRetryMatch;
        // Allow POST for control endpoints and phase action endpoints, GET for everything else
        if (isControlEndpoint || isPhaseActionEndpoint) {
            if (req.method !== 'POST') {
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Method Not Allowed', message: 'Use POST for this endpoint' }));
                return;
            }
        }
        else if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
            return;
        }
        // Handle phase action endpoints first (before switch)
        if (skipMatch) {
            const phaseId = decodeURIComponent(skipMatch[1]);
            this.handleSkipRequest(res, phaseId);
            return;
        }
        if (retryMatch) {
            const phaseId = decodeURIComponent(retryMatch[1]);
            this.handleRetryRequest(res, phaseId);
            return;
        }
        if (forceRetryMatch) {
            const phaseId = decodeURIComponent(forceRetryMatch[1]);
            this.handleForceRetryRequest(res, phaseId);
            return;
        }
        // Log endpoints (GET only)
        const logContentMatch = url.match(/^\/api\/logs\/([^/]+)$/);
        const logDownloadMatch = url.match(/^\/api\/logs\/download\/([^/]+)$/);
        if (logContentMatch && !url.includes('/download')) {
            const phaseId = decodeURIComponent(logContentMatch[1]);
            this.handleLogContentRequest(res, phaseId);
            return;
        }
        if (logDownloadMatch) {
            const phaseId = decodeURIComponent(logDownloadMatch[1]);
            this.handleLogDownloadRequest(res, phaseId);
            return;
        }
        if (url === '/api/logs/download-all') {
            this.handleDownloadAllLogs(res);
            return;
        }
        // Match sprint detail route: /sprint/:id
        const sprintDetailMatch = url.match(/^\/sprint\/([^/?]+)/);
        // Parse URL for query parameters
        const urlObj = new URL(url, `http://${this.config.host}:${this.config.port}`);
        switch (urlObj.pathname) {
            case '/':
            case '/dashboard':
                this.handleDashboardPageRequest(res);
                break;
            case '/events':
                this.handleSSERequest(req, res);
                break;
            case '/api/status':
                this.handleAPIRequest(res);
                break;
            case '/api/controls':
                this.handleControlsRequest(res);
                break;
            case '/api/timing':
                this.handleTimingRequest(res);
                break;
            case '/api/pause':
                this.handlePauseRequest(res);
                break;
            case '/api/resume':
                this.handleResumeRequest(res);
                break;
            case '/api/stop':
                this.handleStopRequest(res);
                break;
            case '/api/sprints':
                this.handleSprintsApiRequest(res, urlObj.searchParams);
                break;
            case '/api/metrics':
                this.handleMetricsApiRequest(res);
                break;
            default:
                // Handle dynamic routes
                if (sprintDetailMatch) {
                    const sprintId = decodeURIComponent(sprintDetailMatch[1]);
                    this.handleSprintDetailPageRequest(res, sprintId);
                }
                else {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                }
        }
    }
    /**
     * Serve the HTML page (legacy - now redirects to dashboard or sprint detail)
     */
    handlePageRequest(res) {
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
        });
        res.end((0, page_js_1.getPageHtml)());
    }
    /**
     * Get the sprints directory path (parent of current sprint)
     */
    getSprintsDir() {
        return path.dirname(this.config.sprintDir);
    }
    /**
     * Get the current sprint ID from the sprint directory path
     */
    getCurrentSprintId() {
        return path.basename(this.config.sprintDir);
    }
    /**
     * Serve the dashboard page with sprint list and metrics
     */
    handleDashboardPageRequest(res) {
        try {
            const sprintsDir = this.getSprintsDir();
            const scanner = new sprint_scanner_js_1.SprintScanner(sprintsDir);
            const sprints = scanner.scan();
            const aggregator = new metrics_aggregator_js_1.MetricsAggregator(sprints);
            const metrics = aggregator.aggregate();
            // Determine the active sprint (the one this server is monitoring)
            const currentSprintId = this.getCurrentSprintId();
            const activeSprint = sprints.find(s => s.sprintId === currentSprintId && s.status === 'in-progress')
                ? currentSprintId
                : null;
            const html = (0, dashboard_page_js_1.generateDashboardPage)(sprints, metrics, activeSprint);
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache',
            });
            res.end(html);
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<html><body><h1>Error loading dashboard</h1><p>${error instanceof Error ? error.message : String(error)}</p></body></html>`);
        }
    }
    /**
     * Serve the sprint detail page for a specific sprint
     */
    handleSprintDetailPageRequest(res, sprintId) {
        try {
            const sprintsDir = this.getSprintsDir();
            const scanner = new sprint_scanner_js_1.SprintScanner(sprintsDir);
            const sprint = scanner.getById(sprintId);
            if (!sprint) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Sprint not found', sprintId }));
                return;
            }
            // Get all sprints for the navigation switcher (last 10)
            const allSprints = scanner.scan();
            const navigation = {
                currentSprintId: sprintId,
                availableSprints: allSprints.slice(0, 10).map(s => ({
                    sprintId: s.sprintId,
                    status: s.status,
                })),
            };
            // Check if this is the currently monitored sprint
            const currentSprintId = this.getCurrentSprintId();
            if (sprintId === currentSprintId) {
                // Serve the live status page for the current sprint
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-cache',
                });
                res.end((0, page_js_1.getPageHtml)(navigation));
            }
            else {
                // For other sprints, show a static view (currently serve same page with note)
                // Future: could show read-only historical view
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-cache',
                });
                res.end((0, page_js_1.getPageHtml)(navigation));
            }
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Failed to load sprint',
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Handle GET /api/sprints request
     * Returns list of sprints with optional pagination
     * Query params:
     *   - page: Page number (default: 1)
     *   - limit: Items per page (default: 20)
     *   - includeWorktree: Include worktree info (default: false)
     */
    handleSprintsApiRequest(res, params) {
        try {
            const sprintsDir = this.getSprintsDir();
            const includeWorktreeInfo = params.get('includeWorktree') === 'true';
            const scanner = new sprint_scanner_js_1.SprintScanner(sprintsDir, { includeWorktreeInfo });
            const allSprints = scanner.scan();
            // Parse pagination parameters
            const page = parseInt(params.get('page') || '1', 10);
            const limit = parseInt(params.get('limit') || '20', 10);
            const offset = (page - 1) * limit;
            // Apply pagination
            const sprints = allSprints.slice(offset, offset + limit);
            // Build response with optional server worktree context
            const response = {
                sprints,
                total: allSprints.length,
                page,
                limit,
                hasMore: offset + limit < allSprints.length,
            };
            // Include server's worktree context for client awareness
            if (this.worktreeInfo) {
                response.serverWorktree = {
                    name: this.worktreeInfo.isMain ? 'main' : this.worktreeInfo.name,
                    branch: this.worktreeInfo.branch,
                    isMain: this.worktreeInfo.isMain,
                };
            }
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            });
            res.end(JSON.stringify(response, null, 2));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Failed to scan sprints',
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Handle GET /api/metrics request
     * Returns aggregate metrics across all sprints
     */
    handleMetricsApiRequest(res) {
        try {
            const sprintsDir = this.getSprintsDir();
            const scanner = new sprint_scanner_js_1.SprintScanner(sprintsDir);
            const sprints = scanner.scan();
            const aggregator = new metrics_aggregator_js_1.MetricsAggregator(sprints);
            const metrics = aggregator.aggregate();
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            });
            res.end(JSON.stringify(metrics, null, 2));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Failed to calculate metrics',
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Handle SSE connection
     */
    handleSSERequest(req, res) {
        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable buffering for nginx
        });
        // Generate unique client ID
        const clientId = `client-${++this.clientIdCounter}`;
        // Track this client
        const client = {
            id: clientId,
            response: res,
            connectedAt: new Date(),
        };
        this.clients.set(clientId, client);
        // Handle client disconnect
        req.on('close', () => {
            this.clients.delete(clientId);
        });
        // Send initial status update
        this.sendInitialStatus(client);
    }
    /**
     * Handle JSON API request
     * Returns current sprint status with optional worktree context
     */
    handleAPIRequest(res) {
        try {
            const progress = this.loadProgress();
            const timingInfo = this.getTimingInfo(progress);
            const statusUpdate = (0, transforms_js_1.toStatusUpdate)(progress, true, timingInfo);
            // Extend response with worktree context for parallel execution awareness
            const response = { ...statusUpdate };
            if (this.worktreeInfo) {
                response.worktree = {
                    name: this.worktreeInfo.isMain ? 'main' : this.worktreeInfo.name,
                    branch: this.worktreeInfo.branch,
                    commit: this.worktreeInfo.commit,
                    isMain: this.worktreeInfo.isMain,
                    root: this.worktreeInfo.root,
                };
            }
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            });
            res.end(JSON.stringify(response, null, 2));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Failed to load progress',
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Get timing info for the current progress
     */
    getTimingInfo(progress) {
        if (!this.timingTracker) {
            return undefined;
        }
        try {
            const timingData = this.timingTracker.estimateRemainingTime(progress);
            return {
                estimatedRemainingMs: timingData.estimatedRemainingMs,
                estimatedRemaining: timingData.estimatedRemaining,
                estimateConfidence: timingData.estimateConfidence,
                estimatedCompletionTime: timingData.estimatedCompletionTime,
            };
        }
        catch (error) {
            console.error('[StatusServer] Failed to calculate timing:', error);
            return undefined;
        }
    }
    /**
     * Get available actions based on current sprint status
     */
    getAvailableActions(status) {
        switch (status) {
            case 'in-progress':
                return ['pause', 'stop'];
            case 'paused':
                return ['resume', 'stop'];
            case 'blocked':
            case 'needs-human':
                return ['stop'];
            default:
                return [];
        }
    }
    /**
     * Handle GET /api/controls request
     * Returns available actions based on current sprint state
     */
    handleControlsRequest(res) {
        try {
            const progress = this.loadProgress();
            const availableActions = this.getAvailableActions(progress.status);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            });
            res.end(JSON.stringify({
                sprintStatus: progress.status,
                availableActions,
            }, null, 2));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Failed to load progress',
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Handle GET /api/timing request
     * Returns timing estimates and historical statistics for the sprint
     */
    handleTimingRequest(res) {
        try {
            const progress = this.loadProgress();
            // Reload timing history to get latest data
            if (this.timingTracker) {
                this.timingTracker.loadTimingHistory();
            }
            const timingInfo = this.timingTracker
                ? this.timingTracker.estimateRemainingTime(progress)
                : null;
            const stats = this.timingTracker
                ? this.timingTracker.getAllStats()
                : [];
            // Convert Map to object for JSON serialization
            const phaseEstimates = {};
            if (timingInfo?.phaseEstimates) {
                for (const [key, value] of timingInfo.phaseEstimates) {
                    phaseEstimates[key] = value;
                }
            }
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            });
            res.end(JSON.stringify({
                estimatedRemainingMs: timingInfo?.estimatedRemainingMs ?? 0,
                estimatedRemaining: timingInfo?.estimatedRemaining ?? 'unknown',
                estimateConfidence: timingInfo?.estimateConfidence ?? 'no-data',
                estimatedCompletionTime: timingInfo?.estimatedCompletionTime ?? null,
                phaseEstimates,
                historicalStats: stats,
            }, null, 2));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Failed to calculate timing estimates',
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Handle POST /api/pause request
     * Creates .pause-requested signal file
     */
    handlePauseRequest(res) {
        try {
            const progress = this.loadProgress();
            const availableActions = this.getAvailableActions(progress.status);
            if (!availableActions.includes('pause')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    action: 'pause',
                    error: `Cannot pause - sprint status is "${progress.status}"`,
                }));
                return;
            }
            const signalPath = path.join(this.config.sprintDir, '.pause-requested');
            fs.writeFileSync(signalPath, new Date().toISOString());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                action: 'pause',
                message: 'Pause requested - sprint will pause after current task',
            }));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                action: 'pause',
                error: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Handle POST /api/resume request
     * Creates .resume-requested signal file
     */
    handleResumeRequest(res) {
        try {
            const progress = this.loadProgress();
            const availableActions = this.getAvailableActions(progress.status);
            if (!availableActions.includes('resume')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    action: 'resume',
                    error: `Cannot resume - sprint status is "${progress.status}"`,
                }));
                return;
            }
            const signalPath = path.join(this.config.sprintDir, '.resume-requested');
            fs.writeFileSync(signalPath, new Date().toISOString());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                action: 'resume',
                message: 'Resume requested - sprint will resume execution',
            }));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                action: 'resume',
                error: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Handle POST /api/stop request
     * Creates .stop-requested signal file
     */
    handleStopRequest(res) {
        try {
            const progress = this.loadProgress();
            const availableActions = this.getAvailableActions(progress.status);
            if (!availableActions.includes('stop')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    action: 'stop',
                    error: `Cannot stop - sprint status is "${progress.status}"`,
                }));
                return;
            }
            const signalPath = path.join(this.config.sprintDir, '.stop-requested');
            fs.writeFileSync(signalPath, new Date().toISOString());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                action: 'stop',
                message: 'Stop requested - sprint will stop after current task',
            }));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                action: 'stop',
                error: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Find a phase by its path (e.g., "execute-all > step-0 > plan")
     * Returns the location information including indices for updating
     */
    findPhaseByPath(progress, phaseId) {
        const parts = phaseId.split(' > ').map(p => p.trim());
        if (parts.length === 0)
            return null;
        // Find top-level phase (Ralph mode has no phases)
        if (!progress.phases)
            return null;
        const phaseIndex = progress.phases.findIndex(p => p.id === parts[0]);
        if (phaseIndex === -1)
            return null;
        const phase = progress.phases[phaseIndex];
        // Single-level path (top phase only)
        if (parts.length === 1) {
            return { phase, phaseIndex };
        }
        // Check if phase has steps
        if (!phase.steps)
            return null;
        // Find step within phase
        const stepIndex = phase.steps.findIndex(s => s.id === parts[1]);
        if (stepIndex === -1)
            return null;
        const step = phase.steps[stepIndex];
        // Two-level path (phase > step)
        if (parts.length === 2) {
            return { phase, phaseIndex, step, stepIndex };
        }
        // Find sub-phase within step
        if (!step.phases)
            return null;
        const subPhaseIndex = step.phases.findIndex(sp => sp.id === parts[2]);
        if (subPhaseIndex === -1)
            return null;
        const subPhase = step.phases[subPhaseIndex];
        return { phase, phaseIndex, step, stepIndex, subPhase, subPhaseIndex };
    }
    /**
     * Save progress to PROGRESS.yaml and trigger SSE broadcast
     */
    saveProgress(progress) {
        const content = yaml.dump(progress, {
            lineWidth: -1,
            noRefs: true,
            quotingType: '"',
        });
        fs.writeFileSync(this.progressFilePath, content, 'utf-8');
        // Trigger update broadcast
        this.handleProgressChange();
    }
    /**
     * Handle POST /api/skip/:phaseId request
     * Marks the specified phase as "skipped" and advances to next phase
     */
    handleSkipRequest(res, phaseId) {
        try {
            const progress = this.loadProgress();
            const location = this.findPhaseByPath(progress, phaseId);
            if (!location) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    action: 'skip',
                    phaseId,
                    error: `Phase not found: "${phaseId}"`,
                }));
                return;
            }
            // Determine which item to skip
            const targetItem = location.subPhase || location.step || location.phase;
            const currentStatus = targetItem.status;
            // Only allow skipping phases that are blocked, in-progress, or pending
            if (!['blocked', 'in-progress', 'pending'].includes(currentStatus)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    action: 'skip',
                    phaseId,
                    error: `Cannot skip phase with status "${currentStatus}" - only blocked, in-progress, or pending phases can be skipped`,
                }));
                return;
            }
            // Mark as skipped
            targetItem.status = 'skipped';
            // If skipping a container (phase with steps, or step with sub-phases), skip all children
            if (location.subPhase) {
                // Skipping a sub-phase - no children to handle
            }
            else if (location.step) {
                // Skipping a step - mark all sub-phases as skipped
                if (location.step.phases) {
                    for (const subPhase of location.step.phases) {
                        if (subPhase.status === 'pending' || subPhase.status === 'in-progress' || subPhase.status === 'blocked') {
                            subPhase.status = 'skipped';
                        }
                    }
                }
            }
            else {
                // Skipping a top-level phase - mark all steps and sub-phases as skipped
                if (location.phase.steps) {
                    for (const step of location.phase.steps) {
                        if (step.status === 'pending' || step.status === 'in-progress' || step.status === 'blocked') {
                            step.status = 'skipped';
                            if (step.phases) {
                                for (const subPhase of step.phases) {
                                    if (subPhase.status === 'pending' || subPhase.status === 'in-progress' || subPhase.status === 'blocked') {
                                        subPhase.status = 'skipped';
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // Advance the current pointer to the next phase
            this.advancePointerAfterSkip(progress, location);
            // Update stats
            this.updateProgressStats(progress);
            // Save changes
            this.saveProgress(progress);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                action: 'skip',
                phaseId,
                message: `Phase "${phaseId}" has been skipped`,
            }));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                action: 'skip',
                phaseId,
                error: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Handle POST /api/retry/:phaseId request
     * Resets the specified phase to "pending" for re-execution
     */
    handleRetryRequest(res, phaseId) {
        try {
            const progress = this.loadProgress();
            const location = this.findPhaseByPath(progress, phaseId);
            if (!location) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    action: 'retry',
                    phaseId,
                    error: `Phase not found: "${phaseId}"`,
                }));
                return;
            }
            // Determine which item to retry
            const targetItem = location.subPhase || location.step || location.phase;
            const currentStatus = targetItem.status;
            // Only allow retrying failed or blocked phases
            if (currentStatus !== 'failed' && currentStatus !== 'blocked') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    action: 'retry',
                    phaseId,
                    error: `Cannot retry phase with status "${currentStatus}" - only failed or blocked phases can be retried`,
                }));
                return;
            }
            // Reset to pending
            targetItem.status = 'pending';
            // Clear error field, timing, and retry state but preserve partial work
            delete targetItem.error;
            delete targetItem['started-at'];
            delete targetItem['completed-at'];
            delete targetItem['next-retry-at'];
            delete targetItem['error-category'];
            // Increment retry count
            targetItem['retry-count'] = (targetItem['retry-count'] || 0) + 1;
            // Set the current pointer to this phase for re-execution
            this.setPointerToPhase(progress, location);
            // Update stats
            this.updateProgressStats(progress);
            // Save changes
            this.saveProgress(progress);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                action: 'retry',
                phaseId,
                message: `Phase "${phaseId}" has been queued for retry`,
            }));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                action: 'retry',
                phaseId,
                error: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Handle POST /api/force-retry/:phaseId request
     * Creates .force-retry-requested signal file to bypass backoff
     */
    handleForceRetryRequest(res, phaseId) {
        try {
            const progress = this.loadProgress();
            const location = this.findPhaseByPath(progress, phaseId);
            if (!location) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    action: 'force-retry',
                    phaseId,
                    error: `Phase not found: "${phaseId}"`,
                }));
                return;
            }
            // Determine which item to force retry
            const targetItem = location.subPhase || location.step || location.phase;
            // Force retry is only valid when there's a next-retry-at (in backoff wait)
            const nextRetryAt = targetItem['next-retry-at'];
            if (!nextRetryAt) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    action: 'force-retry',
                    phaseId,
                    error: `Phase is not in backoff wait state - use regular retry instead`,
                }));
                return;
            }
            // Create force-retry signal file
            const signalPath = path.join(this.config.sprintDir, '.force-retry-requested');
            const signalData = {
                phaseId,
                timestamp: new Date().toISOString(),
            };
            fs.writeFileSync(signalPath, JSON.stringify(signalData));
            // Clear the next-retry-at from PROGRESS.yaml to reflect immediate retry
            delete targetItem['next-retry-at'];
            this.saveProgress(progress);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                action: 'force-retry',
                phaseId,
                message: `Force retry initiated for "${phaseId}" - bypassing backoff`,
            }));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                action: 'force-retry',
                phaseId,
                error: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Get log file path from phase ID
     * Phase IDs use ' > ' as separator (e.g., "development > step-0 > context")
     * Log files use '-' as separator (e.g., "development-step-0-context.log")
     */
    getLogFilePath(phaseId) {
        // Convert phase ID to log filename format
        const sanitized = phaseId.replace(/ > /g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
        return path.join(this.config.sprintDir, 'logs', `${sanitized}.log`);
    }
    /**
     * Get list of all log files in the logs directory
     */
    getLogFiles() {
        const logsDir = path.join(this.config.sprintDir, 'logs');
        if (!fs.existsSync(logsDir)) {
            return [];
        }
        return fs.readdirSync(logsDir)
            .filter((file) => file.endsWith('.log'))
            .map((file) => path.join(logsDir, file));
    }
    /**
     * Handle GET /api/logs/:phaseId request
     * Returns the log content for a specific phase
     */
    handleLogContentRequest(res, phaseId) {
        try {
            const logPath = this.getLogFilePath(phaseId);
            if (!fs.existsSync(logPath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'Log not found',
                    phaseId,
                    path: logPath,
                }));
                return;
            }
            const content = fs.readFileSync(logPath, 'utf-8');
            res.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
            });
            res.end(content);
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Failed to read log',
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Handle GET /api/logs/download/:phaseId request
     * Downloads a single log file
     */
    handleLogDownloadRequest(res, phaseId) {
        try {
            const logPath = this.getLogFilePath(phaseId);
            if (!fs.existsSync(logPath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'Log not found',
                    phaseId,
                }));
                return;
            }
            const content = fs.readFileSync(logPath);
            const filename = path.basename(logPath);
            res.writeHead(200, {
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': content.length,
            });
            res.end(content);
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Failed to download log',
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Handle GET /api/logs/download-all request
     * Downloads all logs as a gzipped tar archive
     */
    handleDownloadAllLogs(res) {
        try {
            const logFiles = this.getLogFiles();
            if (logFiles.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'No logs found',
                    message: 'No log files exist in the logs directory',
                }));
                return;
            }
            // Create a simple archive format: JSON with all log contents
            // This avoids needing external tar/zip dependencies
            const archive = {};
            for (const logPath of logFiles) {
                const filename = path.basename(logPath);
                const content = fs.readFileSync(logPath, 'utf-8');
                archive[filename] = content;
            }
            const jsonData = JSON.stringify(archive, null, 2);
            const compressed = zlib.gzipSync(Buffer.from(jsonData, 'utf-8'));
            const sprintId = path.basename(this.config.sprintDir);
            const filename = `${sprintId}-logs.json.gz`;
            res.writeHead(200, {
                'Content-Type': 'application/gzip',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': compressed.length,
            });
            res.end(compressed);
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Failed to download logs',
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    /**
     * Advance the current pointer after skipping a phase
     */
    advancePointerAfterSkip(progress, location) {
        const current = progress.current;
        if (location.subPhase !== undefined && location.subPhaseIndex !== undefined) {
            // Skipped a sub-phase, try to move to next sub-phase
            const step = location.step;
            if (location.subPhaseIndex < step.phases.length - 1) {
                current['sub-phase'] = location.subPhaseIndex + 1;
            }
            else {
                // No more sub-phases, move to next step
                current['sub-phase'] = 0;
                if (location.stepIndex !== undefined && location.stepIndex < location.phase.steps.length - 1) {
                    current.step = location.stepIndex + 1;
                }
                else {
                    // No more steps, move to next phase
                    current.step = 0;
                    if (location.phaseIndex < (progress.phases?.length ?? 0) - 1) {
                        current.phase = location.phaseIndex + 1;
                    }
                }
            }
        }
        else if (location.step !== undefined && location.stepIndex !== undefined) {
            // Skipped a step, try to move to next step
            current['sub-phase'] = 0;
            if (location.stepIndex < location.phase.steps.length - 1) {
                current.step = location.stepIndex + 1;
            }
            else {
                // No more steps, move to next phase
                current.step = 0;
                if (location.phaseIndex < (progress.phases?.length ?? 0) - 1) {
                    current.phase = location.phaseIndex + 1;
                }
            }
        }
        else {
            // Skipped a top-level phase, move to next phase
            current.step = 0;
            current['sub-phase'] = 0;
            if (location.phaseIndex < (progress.phases?.length ?? 0) - 1) {
                current.phase = location.phaseIndex + 1;
            }
        }
    }
    /**
     * Set the current pointer to a specific phase for retry
     */
    setPointerToPhase(progress, location) {
        const current = progress.current;
        current.phase = location.phaseIndex;
        if (location.stepIndex !== undefined) {
            current.step = location.stepIndex;
        }
        else {
            current.step = location.phase.steps ? 0 : null;
        }
        if (location.subPhaseIndex !== undefined) {
            current['sub-phase'] = location.subPhaseIndex;
        }
        else if (location.step?.phases) {
            current['sub-phase'] = 0;
        }
        else {
            current['sub-phase'] = null;
        }
    }
    /**
     * Update progress stats after modifying phase statuses
     */
    updateProgressStats(progress) {
        let completedPhases = 0;
        let totalPhases = 0;
        for (const phase of progress.phases ?? []) {
            if (phase.steps) {
                for (const step of phase.steps) {
                    if (step.phases) {
                        for (const subPhase of step.phases) {
                            totalPhases++;
                            if (subPhase.status === 'completed' || subPhase.status === 'skipped') {
                                completedPhases++;
                            }
                        }
                    }
                    else {
                        totalPhases++;
                        if (step.status === 'completed' || step.status === 'skipped') {
                            completedPhases++;
                        }
                    }
                }
            }
            else {
                totalPhases++;
                if (phase.status === 'completed' || phase.status === 'skipped') {
                    completedPhases++;
                }
            }
        }
        progress.stats['total-phases'] = totalPhases;
        progress.stats['completed-phases'] = completedPhases;
    }
    /**
     * Send initial status to a newly connected client
     */
    sendInitialStatus(client) {
        try {
            const progress = this.loadProgress();
            this.lastProgress = progress;
            const timingInfo = this.getTimingInfo(progress);
            const statusUpdate = (0, transforms_js_1.toStatusUpdate)(progress, false, timingInfo);
            this.sendEvent(client, 'status-update', statusUpdate);
            // Send a log entry for connection
            const logEntry = (0, transforms_js_1.createLogEntry)('info', 'Connected to status server');
            this.sendEvent(client, 'log-entry', logEntry);
        }
        catch (error) {
            console.error('[StatusServer] Failed to send initial status:', error);
            // Send error log entry
            const logEntry = (0, transforms_js_1.createLogEntry)('error', `Failed to load progress: ${error instanceof Error ? error.message : String(error)}`);
            this.sendEvent(client, 'log-entry', logEntry);
        }
    }
    /**
     * Handle progress file change
     */
    handleProgressChange() {
        try {
            const progress = this.loadProgress();
            // Reload timing history to capture newly completed phases
            if (this.timingTracker) {
                this.timingTracker.loadTimingHistory();
            }
            const timingInfo = this.getTimingInfo(progress);
            const statusUpdate = (0, transforms_js_1.toStatusUpdate)(progress, false, timingInfo);
            // Generate log entries for status changes
            const logEntries = (0, transforms_js_1.generateDiffLogEntries)(this.lastProgress, progress);
            this.lastProgress = progress;
            // Broadcast status update to all clients
            this.broadcast('status-update', statusUpdate);
            // Broadcast log entries
            for (const entry of logEntries) {
                this.broadcast('log-entry', entry);
            }
        }
        catch (error) {
            console.error('[StatusServer] Failed to process progress change:', error);
            // Broadcast error log entry
            const logEntry = (0, transforms_js_1.createLogEntry)('error', `Failed to load progress: ${error instanceof Error ? error.message : String(error)}`);
            this.broadcast('log-entry', logEntry);
        }
    }
    /**
     * Load and parse PROGRESS.yaml
     */
    loadProgress() {
        const content = fs.readFileSync(this.progressFilePath, 'utf-8');
        const progress = yaml.load(content);
        if (!progress || typeof progress !== 'object') {
            throw new Error('Invalid PROGRESS.yaml format');
        }
        return progress;
    }
    /**
     * Send an SSE event to a specific client
     */
    sendEvent(client, type, data) {
        const event = {
            type: type,
            data: data,
            timestamp: new Date().toISOString(),
        };
        const message = `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
        try {
            client.response.write(message);
        }
        catch (error) {
            // Client may have disconnected
            this.clients.delete(client.id);
        }
    }
    /**
     * Broadcast an event to all connected clients
     */
    broadcast(type, data) {
        for (const client of this.clients.values()) {
            this.sendEvent(client, type, data);
        }
    }
    /**
     * Broadcast keep-alive to all clients
     */
    broadcastKeepAlive() {
        const event = {
            type: 'keep-alive',
            data: null,
            timestamp: new Date().toISOString(),
        };
        const message = `event: keep-alive\ndata: ${JSON.stringify(event)}\n\n`;
        for (const client of this.clients.values()) {
            try {
                client.response.write(message);
            }
            catch (error) {
                // Client may have disconnected
                this.clients.delete(client.id);
            }
        }
    }
}
exports.StatusServer = StatusServer;
/**
 * Create and start a status server
 * Convenience function for common use case
 */
async function createStatusServer(config) {
    const server = new StatusServer(config);
    await server.start();
    return server;
}
//# sourceMappingURL=server.js.map