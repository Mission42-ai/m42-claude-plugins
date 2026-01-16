/**
 * HTTP Server with SSE endpoint for Sprint Status updates
 * Serves the HTML page and streams real-time progress updates
 */

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
import type { ActivityEvent } from './activity-types.js';
import { ProgressWatcher } from './watcher.js';
import { ActivityWatcher } from './activity-watcher.js';
import { toStatusUpdate, generateDiffLogEntries, createLogEntry, type TimingInfo } from './transforms.js';
import { getPageHtml } from './page.js';
import { TimingTracker, type SprintTimingInfo, type PhaseTimingStats } from './timing-tracker.js';

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
 * Status Server class
 * Manages HTTP server, SSE connections, and file watching
 */
export class StatusServer {
  private readonly config: Required<ServerConfig>;
  private server: http.Server | null = null;
  private watcher: ProgressWatcher | null = null;
  private activityWatcher: ActivityWatcher | null = null;
  private timingTracker: TimingTracker | null = null;
  private clients: Map<string, SSEClient> = new Map();
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private lastProgress: CompiledProgress | null = null;
  private clientIdCounter = 0;
  private progressFilePath: string;
  private activityFilePath: string;

  constructor(config: ServerConfig) {
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
        resolve();
      });
    });
  }

  /**
   * Stop the server and clean up resources
   */
  async stop(): Promise<void> {
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
        this.server!.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
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

    // Check for skip/retry endpoints with phaseId param
    const skipMatch = url.match(/^\/api\/skip\/(.+)$/);
    const retryMatch = url.match(/^\/api\/retry\/(.+)$/);
    const isPhaseActionEndpoint = skipMatch || retryMatch;

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

    switch (url) {
      case '/':
        this.handlePageRequest(res);
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
      default:
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
  }

  /**
   * Serve the HTML page
   */
  private handlePageRequest(res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(getPageHtml());
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
   */
  private handleAPIRequest(res: http.ServerResponse): void {
    try {
      const progress = this.loadProgress();
      const timingInfo = this.getTimingInfo(progress);
      const statusUpdate = toStatusUpdate(progress, true, timingInfo);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      });
      res.end(JSON.stringify(statusUpdate, null, 2));
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

      const signalPath = path.join(this.config.sprintDir, '.pause-requested');
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

      const signalPath = path.join(this.config.sprintDir, '.resume-requested');
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

      const signalPath = path.join(this.config.sprintDir, '.stop-requested');
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
   * Find a phase by its path (e.g., "execute-all > step-0 > plan")
   * Returns the location information including indices for updating
   */
  private findPhaseByPath(progress: CompiledProgress, phaseId: string): PhaseLocation | null {
    const parts = phaseId.split(' > ').map(p => p.trim());

    if (parts.length === 0) return null;

    // Find top-level phase
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

      // Only allow retrying failed phases
      if (currentStatus !== 'failed') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          action: 'retry',
          phaseId,
          error: `Cannot retry phase with status "${currentStatus}" - only failed phases can be retried`,
        } as PhaseActionResponse));
        return;
      }

      // Reset to pending
      targetItem.status = 'pending' as PhaseStatus;

      // Clear error field and timing but preserve partial work
      delete targetItem.error;
      delete targetItem['started-at'];
      delete targetItem['completed-at'];

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
   * Get log file path from phase ID
   * Phase IDs use ' > ' as separator (e.g., "development > step-0 > context")
   * Log files use '-' as separator (e.g., "development-step-0-context.log")
   */
  private getLogFilePath(phaseId: string): string {
    // Convert phase ID to log filename format
    const sanitized = phaseId.replace(/ > /g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.config.sprintDir, 'logs', `${sanitized}.log`);
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
          if (location.phaseIndex < progress.phases.length - 1) {
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
        if (location.phaseIndex < progress.phases.length - 1) {
          current.phase = location.phaseIndex + 1;
        }
      }
    } else {
      // Skipped a top-level phase, move to next phase
      current.step = 0;
      current['sub-phase'] = 0;
      if (location.phaseIndex < progress.phases.length - 1) {
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

    for (const phase of progress.phases) {
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
