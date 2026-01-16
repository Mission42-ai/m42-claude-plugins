/**
 * HTTP Server with SSE endpoint for Sprint Status updates
 * Serves the HTML page and streams real-time progress updates
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import type {
  ServerConfig,
  StatusUpdate,
  LogEntry,
  AnySSEEvent,
  CompiledProgress,
} from './status-types.js';
import { ProgressWatcher } from './watcher.js';
import { toStatusUpdate, generateDiffLogEntries, createLogEntry } from './transforms.js';
import { getPageHtml } from './page.js';

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
  private clients: Map<string, SSEClient> = new Map();
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private lastProgress: CompiledProgress | null = null;
  private clientIdCounter = 0;
  private progressFilePath: string;

  constructor(config: ServerConfig) {
    this.config = {
      port: config.port ?? DEFAULT_PORT,
      host: config.host ?? DEFAULT_HOST,
      sprintDir: config.sprintDir,
      keepAliveInterval: config.keepAliveInterval ?? DEFAULT_KEEP_ALIVE_INTERVAL,
      debounceDelay: config.debounceDelay ?? 100,
    };
    this.progressFilePath = path.join(this.config.sprintDir, 'PROGRESS.yaml');
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

    // Allow POST for control endpoints, GET for everything else
    if (isControlEndpoint) {
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
      const statusUpdate = toStatusUpdate(progress, true);

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
   * Send initial status to a newly connected client
   */
  private sendInitialStatus(client: SSEClient): void {
    try {
      const progress = this.loadProgress();
      this.lastProgress = progress;

      const statusUpdate = toStatusUpdate(progress);
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
      const statusUpdate = toStatusUpdate(progress);

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
