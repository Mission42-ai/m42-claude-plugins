"use strict";
/**
 * Transcription Watcher for sprint activity
 * Watches transcription directory for .log files and extracts tool use activity
 * from the NDJSON stream format produced by Claude CLI
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
exports.TranscriptionWatcher = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_DEBOUNCE_DELAY = 100;
const DEFAULT_MAX_EVENTS = 200;
const TEXT_DEBOUNCE_DELAY = 500; // 500ms debounce for text accumulation
/**
 * Determine verbosity level for a tool
 * NOTE: Similar logic exists in sprint-activity-hook.sh - keep in sync
 */
function getToolVerbosityLevel(toolName) {
    // Minimal: major milestones and agent delegation
    const minimalTools = [
        'TodoWrite', 'AskUserQuestion',
        'Task', 'Skill', // Agent delegation
        'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', // Task management
    ];
    if (minimalTools.includes(toolName)) {
        return 'minimal';
    }
    // Basic: actual changes (writes, edits, commands)
    const basicTools = ['Write', 'Edit', 'Bash'];
    if (basicTools.includes(toolName)) {
        return 'basic';
    }
    // Detailed: file reads and searches (noise at basic level)
    // Includes: Read, Glob, Grep, and everything else
    return 'detailed';
}
/**
 * Extract file path from tool input
 * NOTE: Similar logic exists in sprint-activity-hook.sh - keep in sync
 */
function extractFilePath(toolName, input) {
    switch (toolName) {
        case 'Read':
        case 'Write':
        case 'Edit':
            return input.file_path;
        case 'Glob':
            return input.pattern;
        case 'Grep':
            return input.path;
        default:
            return undefined;
    }
}
/**
 * Extract params summary from tool input
 * NOTE: Similar logic exists in sprint-activity-hook.sh - keep in sync
 */
function extractParams(toolName, input) {
    switch (toolName) {
        case 'Bash':
            return input.command;
        case 'Grep':
            return input.pattern;
        case 'Task':
            return input.description;
        case 'TaskCreate':
            return input.subject;
        case 'TaskUpdate': {
            const status = input.status;
            const subject = input.subject;
            if (status && subject)
                return `${status}: ${subject}`;
            return status || subject;
        }
        case 'TaskGet':
            return input.taskId;
        default:
            return undefined;
    }
}
class TranscriptionWatcher extends events_1.EventEmitter {
    transcriptionsDir;
    debounceDelay;
    maxEvents;
    watcher = null;
    debounceTimer = null;
    isClosing = false;
    filePositions = new Map();
    seenToolUseIds = new Set();
    recentActivity = [];
    // Text block accumulation state
    textBlocks = new Map();
    textDebounceTimer = null;
    constructor(transcriptionsDir, options = {}) {
        super();
        this.transcriptionsDir = path.resolve(transcriptionsDir);
        this.debounceDelay = options.debounceDelay ?? DEFAULT_DEBOUNCE_DELAY;
        this.maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
    }
    /**
     * Start watching the transcriptions directory
     */
    start() {
        if (this.watcher) {
            return; // Already watching
        }
        // Ensure directory exists
        if (!fs.existsSync(this.transcriptionsDir)) {
            try {
                fs.mkdirSync(this.transcriptionsDir, { recursive: true });
            }
            catch (error) {
                this.emit('error', new Error(`Failed to create transcriptions directory: ${error instanceof Error ? error.message : String(error)}`));
                return;
            }
        }
        try {
            // Read existing transcription files
            this.readExistingFiles();
            // Watch the directory for changes
            this.watcher = fs.watch(this.transcriptionsDir, { persistent: true }, (eventType, filename) => {
                if (this.isClosing)
                    return;
                // Only process .log files
                if (filename && filename.endsWith('.log')) {
                    this.handleFileEvent(filename);
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
            this.emit('error', new Error(`Failed to watch transcriptions: ${error instanceof Error ? error.message : String(error)}`));
        }
    }
    /**
     * Read existing transcription files and extract activity
     */
    readExistingFiles() {
        try {
            const files = fs.readdirSync(this.transcriptionsDir)
                .filter(f => f.endsWith('.log'))
                .map(f => ({
                name: f,
                path: path.join(this.transcriptionsDir, f),
                mtime: fs.statSync(path.join(this.transcriptionsDir, f)).mtime.getTime(),
            }))
                .sort((a, b) => a.mtime - b.mtime); // Oldest first
            for (const file of files) {
                this.processFile(file.path, false);
            }
        }
        catch (error) {
            this.emit('error', new Error(`Failed to read existing files: ${error instanceof Error ? error.message : String(error)}`));
        }
    }
    /**
     * Handle file system events with debouncing
     */
    handleFileEvent(filename) {
        // Clear any pending debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        // Set up new debounce timer
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            const filePath = path.join(this.transcriptionsDir, filename);
            this.processFile(filePath, true);
        }, this.debounceDelay);
    }
    /**
     * Process a transcription file and extract tool use activity
     */
    processFile(filePath, incrementalOnly) {
        if (!fs.existsSync(filePath)) {
            return;
        }
        try {
            const stats = fs.statSync(filePath);
            const lastPosition = this.filePositions.get(filePath) ?? 0;
            // Use file modification time as base timestamp for events
            const fileTimestamp = stats.mtime.toISOString();
            // Check for truncation
            if (stats.size < lastPosition) {
                this.filePositions.set(filePath, 0);
                return this.processFile(filePath, false);
            }
            // Skip if no new content
            if (incrementalOnly && stats.size <= lastPosition) {
                return;
            }
            // Read new content
            const startPos = incrementalOnly ? lastPosition : 0;
            const fd = fs.openSync(filePath, 'r');
            try {
                const bufferSize = stats.size - startPos;
                if (bufferSize <= 0)
                    return;
                const buffer = Buffer.alloc(bufferSize);
                fs.readSync(fd, buffer, 0, bufferSize, startPos);
                const content = buffer.toString('utf-8');
                const lines = content.split('\n');
                for (const line of lines) {
                    if (line.trim()) {
                        this.parseLine(line, fileTimestamp);
                    }
                }
                this.filePositions.set(filePath, stats.size);
            }
            finally {
                fs.closeSync(fd);
            }
        }
        catch (error) {
            this.emit('error', new Error(`Failed to process file ${filePath}: ${error instanceof Error ? error.message : String(error)}`));
        }
    }
    /**
     * Parse a single NDJSON line and emit activity if it's a tool use or text content
     */
    parseLine(line, timestamp) {
        try {
            const event = JSON.parse(line);
            // Handle two formats:
            // 1. Non-streaming: assistant message with content array containing tool_use
            // 2. Streaming: stream_event with content_block_start
            let toolUses = [];
            // Format 1: Assistant message with tool_use and text in content array
            if (event.type === 'assistant' && event.message?.content) {
                const content = event.message.content;
                if (Array.isArray(content)) {
                    for (const block of content) {
                        if (block.type === 'tool_use' && block.id && block.name) {
                            toolUses.push({
                                id: block.id,
                                name: block.name,
                                input: block.input || {},
                            });
                        }
                        else if (block.type === 'text' && block.text) {
                            // Extract text blocks (assistant reasoning/output) in non-streaming mode
                            const activityEvent = {
                                ts: timestamp,
                                type: 'assistant',
                                tool: '',
                                level: 'minimal',
                                text: block.text,
                                isThinking: false, // Non-streaming text is always complete
                            };
                            this.addToRecentActivity(activityEvent);
                            this.emit('activity', activityEvent);
                        }
                    }
                }
            }
            // Format 2: Stream event with content_block_start (for streaming mode)
            if (event.type === 'stream_event' && event.event?.type === 'content_block_start') {
                const contentBlock = event.event.content_block;
                const blockIndex = event.event.index ?? 0;
                if (contentBlock?.type === 'tool_use') {
                    // Tool use block
                    toolUses.push({
                        id: contentBlock.id,
                        name: contentBlock.name,
                        input: contentBlock.input || {},
                    });
                }
                else if (contentBlock?.type === 'text') {
                    // Text content block start
                    this.textBlocks.set(blockIndex, {
                        text: '',
                        startTime: Date.now(),
                        stopped: false,
                    });
                }
            }
            // Handle text_delta events
            if (event.type === 'stream_event' &&
                event.event?.type === 'content_block_delta' &&
                event.event?.delta?.type === 'text_delta') {
                const blockIndex = event.event.index ?? 0;
                const deltaText = event.event.delta.text || '';
                let block = this.textBlocks.get(blockIndex);
                if (!block) {
                    // Create block if not exists (handle out-of-order events)
                    block = {
                        text: '',
                        startTime: Date.now(),
                        stopped: false,
                    };
                    this.textBlocks.set(blockIndex, block);
                }
                block.text += deltaText;
                this.scheduleTextEmission(timestamp);
            }
            // Handle content_block_stop events
            if (event.type === 'stream_event' && event.event?.type === 'content_block_stop') {
                const blockIndex = event.event.index ?? 0;
                const block = this.textBlocks.get(blockIndex);
                if (block) {
                    block.stopped = true;
                    this.scheduleTextEmission(timestamp);
                }
            }
            // Process each tool use found
            for (const toolUse of toolUses) {
                // Skip if we've already seen this tool use
                if (this.seenToolUseIds.has(toolUse.id)) {
                    continue;
                }
                this.seenToolUseIds.add(toolUse.id);
                // Limit memory usage
                if (this.seenToolUseIds.size > this.maxEvents * 2) {
                    const idsArray = Array.from(this.seenToolUseIds);
                    this.seenToolUseIds = new Set(idsArray.slice(-this.maxEvents));
                }
                const activityEvent = {
                    ts: timestamp,
                    type: 'tool',
                    tool: toolUse.name,
                    level: getToolVerbosityLevel(toolUse.name),
                    file: extractFilePath(toolUse.name, toolUse.input),
                    params: extractParams(toolUse.name, toolUse.input),
                };
                this.addToRecentActivity(activityEvent);
                this.emit('activity', activityEvent);
            }
        }
        catch {
            // Invalid JSON, skip silently
        }
    }
    /**
     * Add an event to recent activity, maintaining max size limit
     */
    addToRecentActivity(event) {
        this.recentActivity.push(event);
        if (this.recentActivity.length > this.maxEvents) {
            this.recentActivity = this.recentActivity.slice(-this.maxEvents);
        }
    }
    /**
     * Schedule text emission with debouncing
     */
    scheduleTextEmission(timestamp) {
        if (this.textDebounceTimer) {
            clearTimeout(this.textDebounceTimer);
        }
        this.textDebounceTimer = setTimeout(() => {
            this.textDebounceTimer = null;
            this.emitAccumulatedText(timestamp);
        }, TEXT_DEBOUNCE_DELAY);
    }
    /**
     * Emit accumulated text as assistant activity events
     */
    emitAccumulatedText(timestamp) {
        for (const [blockIndex, block] of this.textBlocks) {
            if (block.text.length > 0) {
                const activityEvent = {
                    ts: timestamp,
                    type: 'assistant',
                    tool: '', // Required for compatibility
                    level: 'minimal',
                    text: block.text,
                    isThinking: !block.stopped,
                };
                this.addToRecentActivity(activityEvent);
                this.emit('activity', activityEvent);
            }
            // Remove completed blocks
            if (block.stopped) {
                this.textBlocks.delete(blockIndex);
            }
        }
    }
    /**
     * Stop watching and clean up resources
     */
    close() {
        if (this.isClosing)
            return;
        this.isClosing = true;
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.textDebounceTimer) {
            clearTimeout(this.textDebounceTimer);
            this.textDebounceTimer = null;
        }
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        this.textBlocks.clear();
        this.emit('close');
    }
    /**
     * Get the directory being watched
     */
    getDirectory() {
        return this.transcriptionsDir;
    }
    /**
     * Check if the watcher is active
     */
    isWatching() {
        return this.watcher !== null && !this.isClosing;
    }
    /**
     * Get recent activity events (for historical queries by new SSE clients)
     * Returns most recent events up to the specified limit
     */
    getRecentActivity(limit = 50) {
        return this.recentActivity.slice(-limit);
    }
}
exports.TranscriptionWatcher = TranscriptionWatcher;
//# sourceMappingURL=transcription-watcher.js.map