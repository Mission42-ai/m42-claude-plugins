"use strict";
/**
 * Activity Watcher for sprint activity log
 * Watches .sprint-activity.jsonl file and emits events for new activity entries
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
exports.ActivityWatcher = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const activity_types_js_1 = require("./activity-types.js");
const DEFAULT_DEBOUNCE_DELAY = 100;
const DEFAULT_TAIL_LINES = 50;
/**
 * Watches a .sprint-activity.jsonl file for new activity events
 *
 * Implements tail-like behavior:
 * - On start, reads last N lines of existing file
 * - On file change, reads only new lines since last position
 * - Handles file rotation (truncation/deletion)
 * - Recovers from corrupted JSON lines by skipping them
 */
class ActivityWatcher extends events_1.EventEmitter {
    filePath;
    debounceDelay;
    tailLines;
    watcher = null;
    debounceTimer = null;
    isClosing = false;
    lastPosition = 0;
    lastSize = 0;
    constructor(filePath, options = {}) {
        super();
        this.filePath = path.resolve(filePath);
        this.debounceDelay = options.debounceDelay ?? DEFAULT_DEBOUNCE_DELAY;
        this.tailLines = options.tailLines ?? DEFAULT_TAIL_LINES;
    }
    /**
     * Start watching the activity file
     * Does not throw if file doesn't exist - waits for creation
     */
    start() {
        if (this.watcher) {
            return; // Already watching
        }
        const dir = path.dirname(this.filePath);
        const filename = path.basename(this.filePath);
        // Ensure directory exists
        if (!fs.existsSync(dir)) {
            this.emit('error', new Error(`Directory does not exist: ${dir}`));
            return;
        }
        try {
            // Read initial content if file exists
            if (fs.existsSync(this.filePath)) {
                this.readInitialContent();
            }
            // Watch the directory to handle file creation/deletion
            this.watcher = fs.watch(dir, { persistent: true }, (eventType, changedFile) => {
                if (this.isClosing)
                    return;
                // Only process events for our target file
                if (changedFile === filename) {
                    this.handleFileEvent(eventType);
                }
            });
            this.watcher.on('error', (error) => {
                if (!this.isClosing) {
                    this.emit('error', error);
                }
            });
            // Emit ready after watcher is set up
            process.nextTick(() => {
                if (!this.isClosing) {
                    this.emit('ready');
                }
            });
        }
        catch (error) {
            this.emit('error', new Error(`Failed to watch file: ${error instanceof Error ? error.message : String(error)}`));
        }
    }
    /**
     * Read initial content from file (tail behavior)
     */
    readInitialContent() {
        try {
            const stats = fs.statSync(this.filePath);
            this.lastSize = stats.size;
            if (stats.size === 0) {
                this.lastPosition = 0;
                return;
            }
            // Read entire file and take last N lines
            const content = fs.readFileSync(this.filePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim() !== '');
            // Take last N lines
            const startIndex = Math.max(0, lines.length - this.tailLines);
            const recentLines = lines.slice(startIndex);
            // Parse and emit each line
            for (const line of recentLines) {
                this.parseLine(line);
            }
            // Set position to end of file for incremental reads
            this.lastPosition = stats.size;
        }
        catch (error) {
            this.emit('error', new Error(`Failed to read initial content: ${error instanceof Error ? error.message : String(error)}`));
        }
    }
    /**
     * Handle file system events with debouncing
     */
    handleFileEvent(eventType) {
        // Clear any pending debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        // Set up new debounce timer
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.processFileChange();
        }, this.debounceDelay);
    }
    /**
     * Process file change - read new content since last position
     */
    processFileChange() {
        // Check if file exists
        if (!fs.existsSync(this.filePath)) {
            // File was deleted, reset position for when it's recreated
            this.lastPosition = 0;
            this.lastSize = 0;
            return;
        }
        try {
            const stats = fs.statSync(this.filePath);
            // Detect file rotation (truncation)
            if (stats.size < this.lastSize) {
                // File was truncated or rotated, read from beginning
                this.lastPosition = 0;
            }
            this.lastSize = stats.size;
            // No new content
            if (stats.size <= this.lastPosition) {
                return;
            }
            // Read new content from last position
            const fd = fs.openSync(this.filePath, 'r');
            try {
                const bufferSize = stats.size - this.lastPosition;
                const buffer = Buffer.alloc(bufferSize);
                fs.readSync(fd, buffer, 0, bufferSize, this.lastPosition);
                const content = buffer.toString('utf-8');
                const lines = content.split('\n');
                // Parse each complete line
                for (const line of lines) {
                    if (line.trim() !== '') {
                        this.parseLine(line);
                    }
                }
                this.lastPosition = stats.size;
            }
            finally {
                fs.closeSync(fd);
            }
        }
        catch (error) {
            this.emit('error', new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`));
        }
    }
    /**
     * Parse a single JSONL line and emit event if valid
     */
    parseLine(line) {
        try {
            const parsed = JSON.parse(line);
            if ((0, activity_types_js_1.isActivityEvent)(parsed)) {
                this.emit('activity', parsed);
            }
            else {
                // Invalid event structure, skip silently (could be future format)
                console.warn('[ActivityWatcher] Skipping invalid event structure');
            }
        }
        catch (error) {
            // Invalid JSON, skip this line
            console.warn(`[ActivityWatcher] Skipping corrupted line: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Stop watching the file and clean up resources
     */
    close() {
        if (this.isClosing)
            return;
        this.isClosing = true;
        // Clear debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        // Close watcher
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        this.emit('close');
    }
    /**
     * Get the path being watched
     */
    getFilePath() {
        return this.filePath;
    }
    /**
     * Check if the watcher is active
     */
    isWatching() {
        return this.watcher !== null && !this.isClosing;
    }
}
exports.ActivityWatcher = ActivityWatcher;
//# sourceMappingURL=activity-watcher.js.map