"use strict";
/**
 * File watcher for PROGRESS.yaml with debounce
 * Emits events when the file changes, handling rapid updates gracefully
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
exports.ProgressWatcher = void 0;
exports.watchProgressFile = watchProgressFile;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_DEBOUNCE_DELAY = 100;
/**
 * Watches a PROGRESS.yaml file for changes with debouncing
 *
 * Uses fs.watch() for efficient file system monitoring and implements
 * debouncing to prevent excessive updates when the file is modified
 * rapidly (e.g., during sprint-loop.sh execution).
 */
class ProgressWatcher extends events_1.EventEmitter {
    filePath;
    debounceDelay;
    watcher = null;
    debounceTimer = null;
    isClosing = false;
    constructor(filePath, options = {}) {
        super();
        this.filePath = path.resolve(filePath);
        this.debounceDelay = options.debounceDelay ?? DEFAULT_DEBOUNCE_DELAY;
    }
    /**
     * Start watching the file
     * @throws Error if file does not exist or cannot be watched
     */
    start() {
        if (this.watcher) {
            return; // Already watching
        }
        // Verify file exists before watching
        if (!fs.existsSync(this.filePath)) {
            throw new Error(`File does not exist: ${this.filePath}`);
        }
        const dir = path.dirname(this.filePath);
        const filename = path.basename(this.filePath);
        try {
            // Watch the directory to handle file deletion/recreation
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
            throw new Error(`Failed to watch file: ${error instanceof Error ? error.message : String(error)}`);
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
            // Check if file exists (handles deletion case)
            if (!fs.existsSync(this.filePath)) {
                // File was deleted, don't emit change
                // We'll pick it up when it's recreated
                return;
            }
            // Emit change event
            this.emit('change', this.filePath);
        }, this.debounceDelay);
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
exports.ProgressWatcher = ProgressWatcher;
/**
 * Create and start a watcher for a PROGRESS.yaml file
 * Convenience function that handles common setup
 */
function watchProgressFile(filePath, onUpdate, options = {}) {
    const watcher = new ProgressWatcher(filePath, options);
    watcher.on('change', onUpdate);
    watcher.start();
    return watcher;
}
//# sourceMappingURL=watcher.js.map