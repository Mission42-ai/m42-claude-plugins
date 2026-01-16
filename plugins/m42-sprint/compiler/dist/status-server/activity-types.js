"use strict";
/**
 * TypeScript types for activity event streaming
 * Used by ActivityWatcher to parse and validate events from .sprint-activity.jsonl
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERBOSITY_ORDER = void 0;
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
    // Required fields
    if (typeof event.ts !== 'string')
        return false;
    if (event.type !== 'tool')
        return false;
    if (typeof event.tool !== 'string')
        return false;
    if (!isVerbosityLevel(event.level))
        return false;
    // Optional fields must be correct type if present
    if (event.file !== undefined && typeof event.file !== 'string')
        return false;
    if (event.params !== undefined && typeof event.params !== 'string')
        return false;
    return true;
}
/**
 * Type guard for VerbosityLevel
 */
function isVerbosityLevel(value) {
    return value === 'minimal' || value === 'basic' || value === 'detailed' || value === 'verbose';
}
//# sourceMappingURL=activity-types.js.map