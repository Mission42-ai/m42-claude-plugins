"use strict";
/**
 * TypeScript types for activity event streaming
 * Used by ActivityWatcher to parse and validate events from .sprint-activity.jsonl
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ACTIVITY_TAIL_LINES = exports.VERBOSITY_ORDER = void 0;
exports.shouldShowAtLevel = shouldShowAtLevel;
exports.isActivityEvent = isActivityEvent;
exports.isVerbosityLevel = isVerbosityLevel;
/**
 * Numeric ordering of verbosity levels for comparison
 */
exports.VERBOSITY_ORDER = {
    minimal: 0,
    basic: 1,
    detailed: 2,
    verbose: 3,
};
/**
 * Check if an event level should be shown at a given display level
 */
function shouldShowAtLevel(eventLevel, displayLevel) {
    return exports.VERBOSITY_ORDER[eventLevel] <= exports.VERBOSITY_ORDER[displayLevel];
}
/**
 * Type guard to check if an object is a valid ActivityEvent
 */
function isActivityEvent(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const event = obj;
    // Required base fields
    if (typeof event.ts !== 'string')
        return false;
    if (!isVerbosityLevel(event.level))
        return false;
    // Validate by type
    if (event.type === 'tool') {
        // Tool event validation
        if (typeof event.tool !== 'string')
            return false;
        // Optional fields must be correct type if present
        if (event.file !== undefined && typeof event.file !== 'string')
            return false;
        if (event.params !== undefined && typeof event.params !== 'string')
            return false;
        return true;
    }
    if (event.type === 'assistant') {
        // Assistant event validation
        // tool field is optional for assistant (for compatibility, can be empty string)
        if (event.tool !== undefined && typeof event.tool !== 'string')
            return false;
        // text is optional for assistant events (can be empty string)
        if (event.text !== undefined && typeof event.text !== 'string')
            return false;
        // isThinking is optional boolean
        if (event.isThinking !== undefined && typeof event.isThinking !== 'boolean')
            return false;
        return true;
    }
    // Unknown type
    return false;
}
/**
 * Type guard for VerbosityLevel
 */
function isVerbosityLevel(value) {
    return value === 'minimal' || value === 'basic' || value === 'detailed' || value === 'verbose';
}
// ============================================================================
// Activity Watcher Configuration
// ============================================================================
/**
 * Default number of activity lines to read from end of file
 * Used by both ActivityWatcher (for initial read) and StatusServer (for new client connections)
 */
exports.DEFAULT_ACTIVITY_TAIL_LINES = 50;
//# sourceMappingURL=activity-types.js.map