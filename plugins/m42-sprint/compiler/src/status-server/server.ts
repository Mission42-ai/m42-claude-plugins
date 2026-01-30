/**
 * HTTP Server with SSE endpoint for Sprint Status updates
 * Serves the HTML page and streams real-time progress updates
 */

import { EventEmitter } from 'events';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as zlib from 'zlib';

import type {
  ServerConfig,
  StatusUpdate,
  LogEntry,
  AnySSEEvent,
  CompiledProgress,
  CompiledTopPhase,
  CompiledStep,
  CompiledPhase,
  PhaseStatus,
} from './status-types.js';
import { isActivityEvent, DEFAULT_ACTIVITY_TAIL_LINES, type ActivityEvent } from './activity-types.js';
import type { AgentEvent, AgentState, AgentUpdatePayload } from './agent-types.js';
import { ProgressWatcher } from './watcher.js';
import { ActivityWatcher } from './activity-watcher.js';
import { TranscriptionWatcher } from './transcription-watcher.js';
import { AgentWatcher } from './agent-watcher.js';
import { toStatusUpdate, generateDiffLogEntries, createLogEntry, isSprintStale, type TimingInfo } from './transforms.js';
import { getPageHtml, type SprintNavigation } from './page.js';
import { TimingTracker } from './timing-tracker.js';
import { SprintScanner, type SprintSummary } from './sprint-scanner.js';
import { MetricsAggregator, type AggregateMetrics } from './metrics-aggregator.js';
import { generateDashboardPage } from './dashboard-page.js';
import { detectWorktree, listWorktrees, type WorktreeInfo } from './worktree.js';
import { generateOperatorQueuePage } from './operator-queue-page.js';
import {
  toOperatorQueueData,
  applyManualDecision,
  type BacklogFile,
  type QueuedRequest,
  type ManualDecision,
} from './operator-queue-transforms.js';

/**
 * Response type for phase actions (skip/retry)
 */
interface PhaseActionResponse {
  success: boolean;
  action: 'skip' | 'retry';
  phaseId: string;
  message?: string;
  error?: string;
}

/**
 * Result of finding a phase by path
 */
interface PhaseLocation {
  phase: CompiledTopPhase;
  phaseIndex: number;
  step?: CompiledStep;
  stepIndex?: number;
  subPhase?: CompiledPhase;
  subPhaseIndex?: number;
}

/**
 * Connected SSE client
 */
interface SSEClient {
  id: string;
  response: http.ServerResponse;
  connectedAt: Date;
}

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
 * Signal file names used for inter-process communication
 * These files are created by API calls and read by the sprint runner
 */
const SIGNAL_FILES = {
  PAUSE: '.pause-requested',
  RESUME: '.resume-requested',
  STOP: '.stop-requested',
  FORCE_RETRY: '.force-retry-requested',
} as const;

/**
 * Validate pagination parameters from query string
 * Returns validated page/limit or an error message
 *
 * Constraints:
 * - page: must be a positive integer (>= 1)
 * - limit: must be between 1 and 100 (prevents excessive memory usage)
 *
 * Fixes: BUG-011 (negative page), BUG-014 (page=0), BUG-015 (non-numeric), BUG-016 (negative limit)
 */
function validatePagination(params: URLSearchParams): { page: number; limit: number } | { error: string } {
  const pageStr = params.get('page') || '1';
  const limitStr = params.get('limit') || '20';

  const page = parseInt(pageStr, 10);
  const limit = parseInt(limitStr, 10);

  if (isNaN(page) || page < 1) return { error: 'page must be a positive integer' };
  if (isNaN(limit) || limit < 1 || limit > 100) return { error: 'limit must be between 1 and 100' };

  return { page, limit };
}

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
export class StatusServer extends EventEmitter {
  private readonly config: Required<ServerConfig>;
  private server: http.Server | null = null;
  private watcher: ProgressWatcher | null = null;
  private activityWatcher: ActivityWatcher | null = null;
  private transcriptionWatcher: TranscriptionWatcher | null = null;
  private agentWatcher: AgentWatcher | null = null;
  private timingTracker: TimingTracker | null = null;
  private clients: Map<string, SSEClient> = new Map();
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private lastProgress: CompiledProgress | null = null;
  private clientIdCounter = 0;
  private progressFilePath: string;
  private activityFilePath: string;
  private isReady = false;
  /** Worktree context for this server instance (detected on startup) */
  private worktreeInfo: WorktreeInfo | null = null;

  constructor(config: ServerConfig) {
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
  async start(): Promise<void> {
    // Validate that PROGRESS.yaml exists
    if (!fs.existsSync(this.progressFilePath)) {
      throw new Error(`PROGRESS.yaml not found: ${this.progressFilePath}`);
    }

    // Clean up any leftover signal files from crashed sprints
    this.cleanupSignalFiles();

    // Detect worktree context for this server instance
    this.worktreeInfo = detectWorktree(this.config.sprintDir);

    // Create HTTP server
    this.server = http.createServer((req, res) => this.handleRequest(req, res));

    // Set up file watcher
    this.watcher = new ProgressWatcher(this.progressFilePath, {
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
    this.activityWatcher = new ActivityWatcher(this.activityFilePath, {
      debounceDelay: this.config.debounceDelay,
    });

    this.activityWatcher.on('activity', (event: ActivityEvent) => {
      this.broadcast('activity-event', event);
    });

    this.activityWatcher.on('error', (error) => {
      console.error('[StatusServer] Activity watcher error:', error.message);
    });

    this.activityWatcher.start();

    // Set up transcription watcher (reads activity from NDJSON transcription files)
    const transcriptionsDir = path.join(this.config.sprintDir, 'transcriptions');
    this.transcriptionWatcher = new TranscriptionWatcher(transcriptionsDir, {
      debounceDelay: this.config.debounceDelay,
    });

    this.transcriptionWatcher.on('activity', (event: ActivityEvent) => {
      this.broadcast('activity-event', event);
    });

    this.transcriptionWatcher.on('error', (error) => {
      console.error('[StatusServer] Transcription watcher error:', error.message);
    });

    this.transcriptionWatcher.start();

    // Set up agent watcher (tracks Claude agents for workflow visualization)
    this.agentWatcher = new AgentWatcher(this.config.sprintDir, {
      debounceDelay: this.config.debounceDelay,
    });

    this.agentWatcher.on('agent-event', (event: AgentEvent, agentState: AgentState | null) => {
      const payload: AgentUpdatePayload = {
        event,
        agentState: agentState ?? undefined,
        allAgents: this.agentWatcher?.getActiveAgents(),
      };
      this.broadcast('agent-event', payload);
    });

    this.agentWatcher.on('error', (error) => {
      console.error('[StatusServer] Agent watcher error:', error.message);
    });

    this.agentWatcher.start();

    // Initialize timing tracker for progress estimation
    this.timingTracker = new TimingTracker(this.config.sprintDir);
    this.timingTracker.loadTimingHistory();

    // Start keep-alive timer
    this.keepAliveTimer = setInterval(() => {
      this.broadcastKeepAlive();
    }, this.config.keepAliveInterval);

    // Start listening
    return new Promise((resolve, reject) => {
      this.server!.on('error', (error) => {
        reject(error);
      });

      this.server!.listen(this.config.port, this.config.host, () => {
        this.isReady = true;
        this.emit('ready');
        resolve();
      });
    });
  }

  /**
   * Stop the server and clean up resources
   */
  async stop(): Promise<void> {
    // Clean up signal files
    this.cleanupSignalFiles();

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

    // Stop transcription watcher
    if (this.transcriptionWatcher) {
      this.transcriptionWatcher.close();
      this.transcriptionWatcher = null;
    }

    // Stop agent watcher
    if (this.agentWatcher) {
      this.agentWatcher.close();
      this.agentWatcher = null;
    }

    // Close HTTP server
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
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
  waitForReady(): Promise<void> {
    const timeout = DEFAULT_READY_TIMEOUT;
    // If already ready, resolve immediately
    if (this.isReady) {
      return Promise.resolve();
    }

    // Wait for ready event with timeout
    return Promise.race([
      new Promise<void>((resolve) => {
        this.once('ready', resolve);
      }),
      new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Server failed to start within ${timeout}ms timeout`));
        }, timeout);
      }),
    ]);
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
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
    // Check for sprint resume endpoint: /api/sprint/:id/resume
    const sprintResumeMatch = url.match(/^\/api\/sprint\/([^/]+)\/resume$/);
    // Check for operator queue decide endpoint: /api/sprint/:id/operator-queue/:reqId/decide
    const operatorDecideMatch = url.match(/^\/api\/sprint\/([^/]+)\/operator-queue\/([^/]+)\/decide$/);
    const isPhaseActionEndpoint = skipMatch || retryMatch || forceRetryMatch || sprintResumeMatch || operatorDecideMatch;

    // Allow POST for control endpoints and phase action endpoints, GET for everything else
    if (isControlEndpoint || isPhaseActionEndpoint) {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed', message: 'Use POST for this endpoint' }));
        return;
      }
    } else if (req.method !== 'GET') {
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

    if (sprintResumeMatch) {
      const sprintId = decodeURIComponent(sprintResumeMatch[1]);
      this.handleSprintResumeRequest(req, res, sprintId);
      return;
    }

    if (operatorDecideMatch) {
      const sprintId = decodeURIComponent(operatorDecideMatch[1]);
      const requestId = decodeURIComponent(operatorDecideMatch[2]);
      this.handleOperatorDecideRequest(req, res, sprintId, requestId);
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
    // Match operator queue page: /sprint/:id/operator
    const operatorQueuePageMatch = url.match(/^\/sprint\/([^/]+)\/operator$/);
    // Match operator queue API: /api/sprint/:id/operator-queue
    const operatorQueueApiMatch = url.match(/^\/api\/sprint\/([^/]+)\/operator-queue$/);

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
      case '/api/worktrees':
        this.handleWorktreesApiRequest(res);
        break;
      default:
        // Handle dynamic routes
        if (operatorQueuePageMatch) {
          const sprintId = decodeURIComponent(operatorQueuePageMatch[1]);
          this.handleOperatorQueuePageRequest(res, sprintId);
        } else if (operatorQueueApiMatch) {
          const sprintId = decodeURIComponent(operatorQueueApiMatch[1]);
          this.handleOperatorQueueApiRequest(res, sprintId);
        } else if (sprintDetailMatch) {
          const sprintId = decodeURIComponent(sprintDetailMatch[1]);
          this.handleSprintDetailPageRequest(res, sprintId);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
    }
  }

  /**
   * Serve the HTML page (legacy - now redirects to dashboard or sprint detail)
   */
  private handlePageRequest(res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(getPageHtml());
  }

  /**
   * Get the sprints directory path (parent of current sprint)
   */
  private getSprintsDir(): string {
    return path.dirname(this.config.sprintDir);
  }

  /**
   * Get the current sprint ID from the sprint directory path
   */
  private getCurrentSprintId(): string {
    return path.basename(this.config.sprintDir);
  }

  /**
   * Serve the dashboard page with sprint list and metrics
   */
  private handleDashboardPageRequest(res: http.ServerResponse): void {
    try {
      const sprintsDir = this.getSprintsDir();
      const scanner = new SprintScanner(sprintsDir, { includeWorktreeInfo: true });
      const sprints = scanner.scan();

      const aggregator = new MetricsAggregator(sprints);
      const metrics = aggregator.aggregate();

      // Determine the active sprint (the one this server is monitoring)
      const currentSprintId = this.getCurrentSprintId();
      const activeSprint = sprints.find(s => s.sprintId === currentSprintId && s.status === 'in-progress')
        ? currentSprintId
        : null;

      const html = generateDashboardPage(sprints, metrics, activeSprint);

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(html);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<html><body><h1>Error loading dashboard</h1><p>${error instanceof Error ? error.message : String(error)}</p></body></html>`);
    }
  }

  /**
   * Serve the sprint detail page for a specific sprint
   */
  private handleSprintDetailPageRequest(res: http.ServerResponse, sprintId: string): void {
    try {
      const sprintsDir = this.getSprintsDir();
      const scanner = new SprintScanner(sprintsDir);
      const sprint = scanner.getById(sprintId);

      if (!sprint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sprint not found', sprintId }));
        return;
      }

      // Get all sprints for the navigation switcher (last 10)
      const allSprints = scanner.scan();
      const navigation: SprintNavigation = {
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
        res.end(getPageHtml(navigation));
      } else {
        // For other sprints, show a static view (currently serve same page with note)
        // Future: could show read-only historical view
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        res.end(getPageHtml(navigation));
      }
    } catch (error) {
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
  private handleSprintsApiRequest(res: http.ServerResponse, params: URLSearchParams): void {
    // Validate pagination parameters first
    const pagination = validatePagination(params);
    if ('error' in pagination) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: pagination.error }));
      return;
    }

    try {
      const sprintsDir = this.getSprintsDir();
      const includeWorktreeInfo = params.get('includeWorktree') === 'true';
      const scanner = new SprintScanner(sprintsDir, { includeWorktreeInfo });
      const allSprints = scanner.scan();

      // Apply pagination
      const { page, limit } = pagination;
      const offset = (page - 1) * limit;
      const sprints = allSprints.slice(offset, offset + limit);

      // Build response with optional server worktree context
      const response: Record<string, unknown> = {
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
    } catch (error) {
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
  private handleMetricsApiRequest(res: http.ServerResponse): void {
    try {
      const sprintsDir = this.getSprintsDir();
      const scanner = new SprintScanner(sprintsDir);
      const sprints = scanner.scan();

      const aggregator = new MetricsAggregator(sprints);
      const metrics = aggregator.aggregate();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      });
      res.end(JSON.stringify(metrics, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Failed to calculate metrics',
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  }

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
  private handleWorktreesApiRequest(res: http.ServerResponse): void {
    try {
      // List all worktrees in the repository
      const worktreeList = listWorktrees(this.config.sprintDir);

      if (!worktreeList) {
        // Not in a git repository - return just this sprint's worktree
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        });
        res.end(JSON.stringify({
          worktrees: [],
          total: 0,
          error: 'Not in a git repository',
        }, null, 2));
        return;
      }

      // For each worktree, scan for sprints
      const worktreesWithSprints = worktreeList.worktrees.map((worktree) => {
        const sprintsDir = path.join(worktree.root, '.claude', 'sprints');
        let sprints: SprintSummary[] = [];

        try {
          if (fs.existsSync(sprintsDir) && fs.statSync(sprintsDir).isDirectory()) {
            const scanner = new SprintScanner(sprintsDir, { includeWorktreeInfo: false });
            sprints = scanner.scan();
          }
        } catch {
          // Skip inaccessible directories
        }

        return {
          name: worktree.isMain ? 'main' : worktree.name,
          branch: worktree.branch,
          commit: worktree.commit,
          isMain: worktree.isMain,
          root: worktree.root,
          sprints,
          activeSprint: sprints.find(s => s.status === 'in-progress') || null,
        };
      });

      // Sort worktrees: main first, then by name
      worktreesWithSprints.sort((a, b) => {
        if (a.isMain && !b.isMain) return -1;
        if (!a.isMain && b.isMain) return 1;
        return a.name.localeCompare(b.name);
      });

      // Build response
      const response: Record<string, unknown> = {
        worktrees: worktreesWithSprints,
        total: worktreesWithSprints.length,
      };

      // Include server's worktree context
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
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Failed to list worktrees',
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  /**
   * Load backlog from BACKLOG.yaml
   */
  private loadBacklog(): BacklogFile {
    const backlogPath = path.join(this.config.sprintDir, 'BACKLOG.yaml');
    try {
      if (fs.existsSync(backlogPath)) {
        const content = fs.readFileSync(backlogPath, 'utf-8');
        const backlog = yaml.load(content) as BacklogFile;
        return backlog && backlog.items ? backlog : { items: [] };
      }
    } catch {
      // Ignore errors reading backlog
    }
    return { items: [] };
  }

  /**
   * Handle GET /sprint/:id/operator - Operator queue page
   */
  private handleOperatorQueuePageRequest(res: http.ServerResponse, sprintId: string): void {
    try {
      const progress = this.loadProgress();
      const backlog = this.loadBacklog();
      const queueData = toOperatorQueueData(progress as any, backlog);

      const html = generateOperatorQueuePage(queueData, sprintId);

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(html);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<html><body><h1>Error loading operator queue</h1><p>${error instanceof Error ? error.message : String(error)}</p></body></html>`);
    }
  }

  /**
   * Handle GET /api/sprint/:id/operator-queue - Operator queue API
   */
  private handleOperatorQueueApiRequest(res: http.ServerResponse, sprintId: string): void {
    try {
      const progress = this.loadProgress();
      const backlog = this.loadBacklog();
      const queueData = toOperatorQueueData(progress as any, backlog);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      });
      res.end(JSON.stringify(queueData, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Failed to load operator queue',
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  /**
   * Handle POST /api/sprint/:id/operator-queue/:reqId/decide - Manual decision
   */
  private handleOperatorDecideRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    sprintId: string,
    requestId: string
  ): void {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { decision, reasoning, deferredUntil } = JSON.parse(body) as ManualDecision;

        if (!decision || !reasoning) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Missing required fields: decision and reasoning',
          }));
          return;
        }

        if (!['approve', 'reject', 'defer'].includes(decision)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Invalid decision. Must be: approve, reject, or defer',
          }));
          return;
        }

        const progress = this.loadProgress();
        const queue = (progress as any)['operator-queue'] as QueuedRequest[] | undefined;

        if (!queue) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'No operator queue found',
          }));
          return;
        }

        const requestIndex = queue.findIndex(r => r.id === requestId);
        if (requestIndex === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: `Request not found: ${requestId}`,
          }));
          return;
        }

        const request = queue[requestIndex];
        if (request.status !== 'pending') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: `Request already decided: ${request.status}`,
          }));
          return;
        }

        // Apply the manual decision
        const manualDecision: ManualDecision = { decision, reasoning, deferredUntil };
        const updatedRequest = applyManualDecision(request, manualDecision);
        queue[requestIndex] = updatedRequest;

        // Save the updated progress
        this.saveProgress(progress);

        // Broadcast the decision event
        this.broadcast('operator-decision', {
          request: updatedRequest,
          decision: updatedRequest.decision,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          requestId,
          decision,
          message: `Request ${decision}${decision === 'defer' ? ` until ${deferredUntil || 'later'}` : ''}`,
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    });
  }

  /**
   * Handle SSE connection
   */
  private handleSSERequest(req: http.IncomingMessage, res: http.ServerResponse): void {
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
    const client: SSEClient = {
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
  private handleAPIRequest(res: http.ServerResponse): void {
    try {
      const progress = this.loadProgress();
      const timingInfo = this.getTimingInfo(progress);
      const statusUpdate = toStatusUpdate(progress, true, timingInfo);

      // Extend response with worktree context for parallel execution awareness
      const response: Record<string, unknown> = { ...statusUpdate };
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
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Failed to load progress',
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Get timing info for the current progress
   */
  private getTimingInfo(progress: CompiledProgress): TimingInfo | undefined {
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
    } catch (error) {
      console.error('[StatusServer] Failed to calculate timing:', error);
      return undefined;
    }
  }

  /**
   * Get available actions based on current sprint status
   */
  private getAvailableActions(status: string): Array<'pause' | 'resume' | 'stop'> {
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
  private handleControlsRequest(res: http.ServerResponse): void {
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
    } catch (error) {
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
  private handleTimingRequest(res: http.ServerResponse): void {
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
      const phaseEstimates: Record<string, unknown> = {};
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
    } catch (error) {
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
  private handlePauseRequest(res: http.ServerResponse): void {
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

      const signalPath = path.join(this.config.sprintDir, SIGNAL_FILES.PAUSE);
      fs.writeFileSync(signalPath, new Date().toISOString());

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action: 'pause',
        message: 'Pause requested - sprint will pause after current task',
      }));
    } catch (error) {
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
  private handleResumeRequest(res: http.ServerResponse): void {
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

      const signalPath = path.join(this.config.sprintDir, SIGNAL_FILES.RESUME);
      fs.writeFileSync(signalPath, new Date().toISOString());

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action: 'resume',
        message: 'Resume requested - sprint will resume execution',
      }));
    } catch (error) {
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
  private handleStopRequest(res: http.ServerResponse): void {
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

      const signalPath = path.join(this.config.sprintDir, SIGNAL_FILES.STOP);
      fs.writeFileSync(signalPath, new Date().toISOString());

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action: 'stop',
        message: 'Stop requested - sprint will stop after current task',
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        action: 'stop',
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  /**
   * Handle POST /api/sprint/:id/resume request
   * Creates .resume-requested signal file for stale or interrupted sprints
   */
  private handleSprintResumeRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    sprintId: string
  ): void {
    try {
      const progress = this.loadProgress();

      // Only allow resuming interrupted or stale sprints
      const isInterrupted = progress.status === 'interrupted';
      const isStale = isSprintStale(progress);

      if (!isInterrupted && !isStale) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          action: 'resume',
          error: `Cannot resume - sprint status is "${progress.status}" and is not stale`,
        }));
        return;
      }

      // Create resume signal file
      const signalPath = path.join(this.config.sprintDir, SIGNAL_FILES.RESUME);
      fs.writeFileSync(signalPath, new Date().toISOString());

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action: 'resume',
        sprintId,
        message: 'Resume requested - sprint will be restarted',
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        action: 'resume',
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  /**
   * Find a phase by its path (e.g., "execute-all > step-0 > plan")
   * Returns the location information including indices for updating
   */
  private findPhaseByPath(progress: CompiledProgress, phaseId: string): PhaseLocation | null {
    const parts = phaseId.split(' > ').map(p => p.trim());

    if (parts.length === 0) return null;

    // Find top-level phase (Ralph mode has no phases)
    if (!progress.phases) return null;
    const phaseIndex = progress.phases.findIndex(p => p.id === parts[0]);
    if (phaseIndex === -1) return null;

    const phase = progress.phases[phaseIndex];

    // Single-level path (top phase only)
    if (parts.length === 1) {
      return { phase, phaseIndex };
    }

    // Check if phase has steps
    if (!phase.steps) return null;

    // Find step within phase
    const stepIndex = phase.steps.findIndex(s => s.id === parts[1]);
    if (stepIndex === -1) return null;

    const step = phase.steps[stepIndex];

    // Two-level path (phase > step)
    if (parts.length === 2) {
      return { phase, phaseIndex, step, stepIndex };
    }

    // Find sub-phase within step
    if (!step.phases) return null;

    const subPhaseIndex = step.phases.findIndex(sp => sp.id === parts[2]);
    if (subPhaseIndex === -1) return null;

    const subPhase = step.phases[subPhaseIndex];

    return { phase, phaseIndex, step, stepIndex, subPhase, subPhaseIndex };
  }

  /**
   * Save progress to PROGRESS.yaml and trigger SSE broadcast
   */
  private saveProgress(progress: CompiledProgress): void {
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
  private handleSkipRequest(res: http.ServerResponse, phaseId: string): void {
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
        } as PhaseActionResponse));
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
        } as PhaseActionResponse));
        return;
      }

      // Mark as skipped
      targetItem.status = 'skipped' as PhaseStatus;

      // If skipping a container (phase with steps, or step with sub-phases), skip all children
      if (location.subPhase) {
        // Skipping a sub-phase - no children to handle
      } else if (location.step) {
        // Skipping a step - mark all sub-phases as skipped
        if (location.step.phases) {
          for (const subPhase of location.step.phases) {
            if (subPhase.status === 'pending' || subPhase.status === 'in-progress' || subPhase.status === 'blocked') {
              subPhase.status = 'skipped';
            }
          }
        }
      } else {
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
      } as PhaseActionResponse));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        action: 'skip',
        phaseId,
        error: error instanceof Error ? error.message : String(error),
      } as PhaseActionResponse));
    }
  }

  /**
   * Handle POST /api/retry/:phaseId request
   * Resets the specified phase to "pending" for re-execution
   */
  private handleRetryRequest(res: http.ServerResponse, phaseId: string): void {
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
        } as PhaseActionResponse));
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
        } as PhaseActionResponse));
        return;
      }

      // Reset to pending
      targetItem.status = 'pending' as PhaseStatus;

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
      } as PhaseActionResponse));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        action: 'retry',
        phaseId,
        error: error instanceof Error ? error.message : String(error),
      } as PhaseActionResponse));
    }
  }

  /**
   * Handle POST /api/force-retry/:phaseId request
   * Creates .force-retry-requested signal file to bypass backoff
   */
  private handleForceRetryRequest(res: http.ServerResponse, phaseId: string): void {
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
      const signalPath = path.join(this.config.sprintDir, SIGNAL_FILES.FORCE_RETRY);
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
    } catch (error) {
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
  private getLogFilePath(phaseId: string): string {
    // Convert phase ID to log filename format
    const sanitized = phaseId.replace(/ > /g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
    const logPath = path.join(this.config.sprintDir, 'logs', `${sanitized}.log`);

    // Defense-in-depth: verify path is within expected logs directory
    const resolved = path.resolve(logPath);
    const logsDir = path.resolve(this.config.sprintDir, 'logs');
    if (!resolved.startsWith(logsDir + path.sep)) {
      throw new Error('Invalid log path');
    }

    return logPath;
  }

  /**
   * Get list of all log files in the logs directory
   */
  private getLogFiles(): string[] {
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
  private handleLogContentRequest(res: http.ServerResponse, phaseId: string): void {
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
    } catch (error) {
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
  private handleLogDownloadRequest(res: http.ServerResponse, phaseId: string): void {
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
    } catch (error) {
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
  private handleDownloadAllLogs(res: http.ServerResponse): void {
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
      const archive: Record<string, string> = {};

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
    } catch (error) {
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
  private advancePointerAfterSkip(progress: CompiledProgress, location: PhaseLocation): void {
    const current = progress.current;

    if (location.subPhase !== undefined && location.subPhaseIndex !== undefined) {
      // Skipped a sub-phase, try to move to next sub-phase
      const step = location.step!;
      if (location.subPhaseIndex < step.phases!.length - 1) {
        current['sub-phase'] = location.subPhaseIndex + 1;
      } else {
        // No more sub-phases, move to next step
        current['sub-phase'] = 0;
        if (location.stepIndex !== undefined && location.stepIndex < location.phase.steps!.length - 1) {
          current.step = location.stepIndex + 1;
        } else {
          // No more steps, move to next phase
          current.step = 0;
          if (location.phaseIndex < (progress.phases?.length ?? 0) - 1) {
            current.phase = location.phaseIndex + 1;
          }
        }
      }
    } else if (location.step !== undefined && location.stepIndex !== undefined) {
      // Skipped a step, try to move to next step
      current['sub-phase'] = 0;
      if (location.stepIndex < location.phase.steps!.length - 1) {
        current.step = location.stepIndex + 1;
      } else {
        // No more steps, move to next phase
        current.step = 0;
        if (location.phaseIndex < (progress.phases?.length ?? 0) - 1) {
          current.phase = location.phaseIndex + 1;
        }
      }
    } else {
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
  private setPointerToPhase(progress: CompiledProgress, location: PhaseLocation): void {
    const current = progress.current;
    current.phase = location.phaseIndex;

    if (location.stepIndex !== undefined) {
      current.step = location.stepIndex;
    } else {
      current.step = location.phase.steps ? 0 : null;
    }

    if (location.subPhaseIndex !== undefined) {
      current['sub-phase'] = location.subPhaseIndex;
    } else if (location.step?.phases) {
      current['sub-phase'] = 0;
    } else {
      current['sub-phase'] = null;
    }
  }

  /**
   * Update progress stats after modifying phase statuses
   */
  private updateProgressStats(progress: CompiledProgress): void {
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
          } else {
            totalPhases++;
            if (step.status === 'completed' || step.status === 'skipped') {
              completedPhases++;
            }
          }
        }
      } else {
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
  private sendInitialStatus(client: SSEClient): void {
    try {
      const progress = this.loadProgress();
      this.lastProgress = progress;

      const timingInfo = this.getTimingInfo(progress);
      const statusUpdate = toStatusUpdate(progress, false, timingInfo);
      this.sendEvent(client, 'status-update', statusUpdate);

      // Send a log entry for connection
      const logEntry = createLogEntry('info', 'Connected to status server');
      this.sendEvent(client, 'log-entry', logEntry);

      // Send historical activity events (BUG-003 fix)
      this.sendHistoricalActivity(client);

      // Send current agent state for workflow visualization
      this.sendAgentState(client);
    } catch (error) {
      console.error('[StatusServer] Failed to send initial status:', error);
      // Send error log entry
      const logEntry = createLogEntry(
        'error',
        `Failed to load progress: ${error instanceof Error ? error.message : String(error)}`
      );
      this.sendEvent(client, 'log-entry', logEntry);
    }
  }

  /**
   * Send historical activity events to a newly connected client (BUG-003 fix)
   * Reads from both .sprint-activity.jsonl and transcription files
   * Note: Reads entire file then slices tail - acceptable for typical activity files (<1000 lines)
   * For very large files, consider streaming tail read like ActivityWatcher.processFileChange()
   */
  private sendHistoricalActivity(client: SSEClient): void {
    try {
      // Read from .sprint-activity.jsonl (legacy hook-generated activity)
      if (fs.existsSync(this.activityFilePath)) {
        const content = fs.readFileSync(this.activityFilePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() !== '');

        // Take last N lines (same as ActivityWatcher tailLines default)
        const startIndex = Math.max(0, lines.length - DEFAULT_ACTIVITY_TAIL_LINES);
        const recentLines = lines.slice(startIndex);

        for (const line of recentLines) {
          try {
            const parsed = JSON.parse(line);
            if (isActivityEvent(parsed)) {
              this.sendEvent(client, 'activity-event', parsed);
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }

      // Also send recent activity from transcription files (live streaming source)
      // Note: Events may overlap with .jsonl - clients should dedupe by timestamp+tool
      if (this.transcriptionWatcher) {
        const transcriptionActivity = this.transcriptionWatcher.getRecentActivity(DEFAULT_ACTIVITY_TAIL_LINES);
        for (const event of transcriptionActivity) {
          this.sendEvent(client, 'activity-event', event);
        }
      }
    } catch (error) {
      console.error('[StatusServer] Failed to send historical activity:', error);
    }
  }

  /**
   * Send current agent state to a newly connected client
   * Provides initial snapshot for workflow visualization
   */
  private sendAgentState(client: SSEClient): void {
    if (!this.agentWatcher) return;

    try {
      const activeAgents = this.agentWatcher.getActiveAgents();
      if (activeAgents.length > 0) {
        const payload: AgentUpdatePayload = {
          event: {
            ts: new Date().toISOString(),
            sessionId: 'initial-state',
            type: 'spawn',
            stepId: 'initial-state',
          },
          allAgents: activeAgents,
        };
        this.sendEvent(client, 'agent-event', payload);
      }
    } catch (error) {
      console.error('[StatusServer] Failed to send agent state:', error);
    }
  }

  /**
   * Handle progress file change
   */
  private handleProgressChange(): void {
    try {
      const progress = this.loadProgress();

      // Reload timing history to capture newly completed phases
      if (this.timingTracker) {
        this.timingTracker.loadTimingHistory();
      }

      const timingInfo = this.getTimingInfo(progress);
      const statusUpdate = toStatusUpdate(progress, false, timingInfo);

      // Generate log entries for status changes
      const logEntries = generateDiffLogEntries(this.lastProgress, progress);
      this.lastProgress = progress;

      // Broadcast status update to all clients
      this.broadcast('status-update', statusUpdate);

      // Broadcast log entries
      for (const entry of logEntries) {
        this.broadcast('log-entry', entry);
      }

      // Check for sprint completion and broadcast special event
      if (progress.status === 'completed' || progress.status === 'blocked' ||
          progress.status === 'paused' || progress.status === 'needs-human') {
        const completionEvent = {
          status: progress.status,
          sprintId: progress['sprint-id'],
          completedAt: new Date().toISOString(),
          stats: progress.stats,
        };
        this.broadcast('sprint-complete', completionEvent);
        console.log(`[StatusServer] Sprint ${progress.status}: ${progress['sprint-id']}`);
      }
    } catch (error) {
      console.error('[StatusServer] Failed to process progress change:', error);
      // Broadcast error log entry
      const logEntry = createLogEntry(
        'error',
        `Failed to load progress: ${error instanceof Error ? error.message : String(error)}`
      );
      this.broadcast('log-entry', logEntry);
    }
  }

  /**
   * Load and parse PROGRESS.yaml
   */
  private loadProgress(): CompiledProgress {
    const content = fs.readFileSync(this.progressFilePath, 'utf-8');
    const progress = yaml.load(content) as CompiledProgress;

    if (!progress || typeof progress !== 'object') {
      throw new Error('Invalid PROGRESS.yaml format');
    }

    return progress;
  }

  /**
   * Clean up signal files from sprint directory
   * Called on server stop and start (to handle leftover files from crashed sprints)
   */
  private cleanupSignalFiles(): void {
    for (const signal of Object.values(SIGNAL_FILES)) {
      const signalPath = path.join(this.config.sprintDir, signal);
      try {
        fs.unlinkSync(signalPath);
      } catch {
        // Ignore errors (file may not exist)
      }
    }
  }

  /**
   * Send an SSE event to a specific client
   */
  private sendEvent<T>(client: SSEClient, type: string, data: T): void {
    const event: AnySSEEvent = {
      type: type as AnySSEEvent['type'],
      data: data as any,
      timestamp: new Date().toISOString(),
    };

    const message = `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;

    try {
      client.response.write(message);
    } catch (error) {
      // Client may have disconnected
      this.clients.delete(client.id);
    }
  }

  /**
   * Broadcast an event to all connected clients
   */
  private broadcast<T>(type: string, data: T): void {
    for (const client of this.clients.values()) {
      this.sendEvent(client, type, data);
    }
  }

  /**
   * Broadcast keep-alive to all clients
   */
  private broadcastKeepAlive(): void {
    const event: AnySSEEvent = {
      type: 'keep-alive',
      data: null,
      timestamp: new Date().toISOString(),
    };

    const message = `event: keep-alive\ndata: ${JSON.stringify(event)}\n\n`;

    for (const client of this.clients.values()) {
      try {
        client.response.write(message);
      } catch (error) {
        // Client may have disconnected
        this.clients.delete(client.id);
      }
    }
  }
}

/**
 * Create and start a status server
 * Convenience function for common use case
 */
export async function createStatusServer(config: ServerConfig): Promise<StatusServer> {
  const server = new StatusServer(config);
  await server.start();
  return server;
}
