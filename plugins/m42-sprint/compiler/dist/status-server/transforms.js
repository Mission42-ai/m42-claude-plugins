"use strict";
/**
 * Data transformation functions for converting CompiledProgress to StatusUpdate format
 * Used by the status server to send updates to connected browsers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatRelativeTime = formatRelativeTime;
exports.formatDisplayTime = formatDisplayTime;
exports.calculateElapsed = calculateElapsed;
exports.countRalphTasks = countRalphTasks;
exports.countPhases = countPhases;
exports.calculateProgressPercent = calculateProgressPercent;
exports.buildPhaseTree = buildPhaseTree;
exports.buildRalphTaskTree = buildRalphTaskTree;
exports.extractCurrentTask = extractCurrentTask;
exports.createLogEntry = createLogEntry;
exports.createStatusLogEntry = createStatusLogEntry;
exports.generateDiffLogEntries = generateDiffLogEntries;
exports.transformHookTasks = transformHookTasks;
exports.toStatusUpdate = toStatusUpdate;
// ============================================================================
// Timestamp Formatting
// ============================================================================
/**
 * Format an ISO timestamp to a human-readable relative time
 * e.g., "2 minutes ago", "just now", "1 hour ago"
 */
function formatRelativeTime(isoTimestamp) {
    const date = new Date(isoTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    if (diffSeconds < 5)
        return 'just now';
    if (diffSeconds < 60)
        return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60)
        return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24)
        return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}
/**
 * Format an ISO timestamp to a display time (HH:MM:SS)
 */
function formatDisplayTime(isoTimestamp) {
    const date = new Date(isoTimestamp);
    return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}
/**
 * Calculate elapsed time between two ISO timestamps
 * Returns human-readable format like "1m 30s" or "2h 15m"
 */
function calculateElapsed(startIso, endIso) {
    const start = new Date(startIso);
    const end = endIso ? new Date(endIso) : new Date();
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0)
        return '0s';
    const seconds = Math.floor(diffMs / 1000) % 60;
    const minutes = Math.floor(diffMs / (1000 * 60)) % 60;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}
// ============================================================================
// Progress Calculation
// ============================================================================
/**
 * Count total and completed tasks for Ralph mode (dynamic-steps)
 */
function countRalphTasks(progress) {
    const dynamicSteps = progress['dynamic-steps'];
    if (!dynamicSteps) {
        return { total: 0, completed: 0 };
    }
    let completed = 0;
    for (const step of dynamicSteps) {
        if (step.status === 'completed' || step.status === 'skipped') {
            completed++;
        }
    }
    return { total: dynamicSteps.length, completed };
}
/**
 * Count total and completed phases in the progress structure
 * Handles both standard mode (phases) and Ralph mode (dynamic-steps)
 */
function countPhases(progress) {
    // Check for Ralph mode
    const mode = progress.mode;
    if (mode === 'ralph') {
        return countRalphTasks(progress);
    }
    // Standard mode: count phases
    let total = 0;
    let completed = 0;
    for (const topPhase of progress.phases ?? []) {
        if (topPhase.steps) {
            // For-each phase: count sub-phases within each step
            for (const step of topPhase.steps) {
                for (const subPhase of step.phases) {
                    total++;
                    if (subPhase.status === 'completed' || subPhase.status === 'skipped') {
                        completed++;
                    }
                }
            }
        }
        else {
            // Simple phase (no steps)
            total++;
            if (topPhase.status === 'completed' || topPhase.status === 'skipped') {
                completed++;
            }
        }
    }
    return { total, completed };
}
/**
 * Calculate progress percentage (0-100)
 */
function calculateProgressPercent(progress) {
    const { total, completed } = countPhases(progress);
    if (total === 0)
        return 0;
    return Math.round((completed / total) * 100);
}
// ============================================================================
// Phase Tree Building
// ============================================================================
/**
 * Get a short label from a phase/step ID
 * e.g., "execute-all" -> "execute-all", "step-0" -> "step-0"
 */
function getLabel(id, prompt) {
    // Use ID as label, but could enhance with prompt excerpt if needed
    if (prompt && prompt.length <= 30) {
        return prompt;
    }
    return id;
}
/**
 * Build a PhaseTreeNode from a CompiledPhase (leaf node)
 */
function buildSubPhaseNode(phase, depth) {
    return {
        id: phase.id,
        label: getLabel(phase.id, phase.prompt),
        status: phase.status,
        type: 'sub-phase',
        depth,
        startedAt: phase['started-at'],
        completedAt: phase['completed-at'],
        elapsed: phase.elapsed,
        error: phase.error,
        'retry-count': phase['retry-count'],
        'next-retry-at': phase['next-retry-at'],
        'error-category': phase['error-category'],
    };
}
/**
 * Build a PhaseTreeNode from a CompiledStep (contains sub-phases)
 */
function buildStepNode(step, depth) {
    return {
        id: step.id,
        label: getLabel(step.id, step.prompt),
        status: step.status,
        type: 'step',
        depth,
        children: step.phases.map((p) => buildSubPhaseNode(p, depth + 1)),
        startedAt: step['started-at'],
        completedAt: step['completed-at'],
        elapsed: step.elapsed,
        error: step.error,
        'retry-count': step['retry-count'],
        'next-retry-at': step['next-retry-at'],
        'error-category': step['error-category'],
    };
}
/**
 * Build a PhaseTreeNode from a CompiledTopPhase
 */
function buildTopPhaseNode(topPhase, depth) {
    const node = {
        id: topPhase.id,
        label: getLabel(topPhase.id, topPhase.prompt),
        status: topPhase.status,
        type: 'phase',
        depth,
        startedAt: topPhase['started-at'],
        completedAt: topPhase['completed-at'],
        elapsed: topPhase.elapsed,
        error: topPhase.error,
        'retry-count': topPhase['retry-count'],
        'next-retry-at': topPhase['next-retry-at'],
        'error-category': topPhase['error-category'],
    };
    if (topPhase.steps) {
        node.children = topPhase.steps.map((s) => buildStepNode(s, depth + 1));
    }
    return node;
}
/**
 * Build the complete phase tree from CompiledProgress
 */
function buildPhaseTree(progress) {
    return (progress.phases ?? []).map((p) => buildTopPhaseNode(p, 0));
}
// ============================================================================
// Ralph Mode Task Tree Building
// ============================================================================
/**
 * Build a PhaseTreeNode from a DynamicStep (Ralph mode)
 * Ralph tasks are flat (no hierarchy) - each is a leaf node
 */
function buildTaskNode(step, depth) {
    // Extract a short label from the prompt
    const label = step.prompt.length <= 50
        ? step.prompt
        : step.prompt.substring(0, 47) + '...';
    return {
        id: step.id,
        label,
        status: step.status,
        type: 'task',
        depth,
        startedAt: step['added-at'],
        // Ralph tasks don't have completedAt in the current schema
        // They transition: pending -> in-progress -> completed
    };
}
/**
 * Build task tree for Ralph mode from dynamic-steps
 * Returns a flat list of task nodes (no hierarchy)
 */
function buildRalphTaskTree(progress) {
    const dynamicSteps = progress['dynamic-steps'];
    if (!dynamicSteps || dynamicSteps.length === 0) {
        return [];
    }
    return dynamicSteps.map((step) => buildTaskNode(step, 0));
}
// ============================================================================
// Current Task Extraction
// ============================================================================
/**
 * Build the path string for the current task position
 */
function buildCurrentPath(progress, phaseIdx, stepIdx, subPhaseIdx) {
    const parts = [];
    if (phaseIdx >= 0 && phaseIdx < (progress.phases?.length ?? 0)) {
        const phase = progress.phases[phaseIdx];
        parts.push(phase.id);
        if (stepIdx !== null && phase.steps && stepIdx >= 0 && stepIdx < phase.steps.length) {
            const step = phase.steps[stepIdx];
            parts.push(step.id);
            if (subPhaseIdx !== null && subPhaseIdx >= 0 && subPhaseIdx < step.phases.length) {
                const subPhase = step.phases[subPhaseIdx];
                parts.push(subPhase.id);
            }
        }
    }
    return parts.join(' > ');
}
/**
 * Extract the current task from the progress pointer
 */
function extractCurrentTask(progress) {
    const { phase: phaseIdx, step: stepIdx, 'sub-phase': subPhaseIdx } = progress.current;
    if (phaseIdx < 0 || phaseIdx >= (progress.phases?.length ?? 0)) {
        return null;
    }
    const phase = progress.phases[phaseIdx];
    // If we're not in-progress, no current task
    if (progress.status !== 'in-progress') {
        return null;
    }
    // Determine the prompt and started time
    let prompt;
    let startedAt;
    if (stepIdx !== null && phase.steps && stepIdx >= 0 && stepIdx < phase.steps.length) {
        const step = phase.steps[stepIdx];
        if (subPhaseIdx !== null && subPhaseIdx >= 0 && subPhaseIdx < step.phases.length) {
            const subPhase = step.phases[subPhaseIdx];
            prompt = subPhase.prompt;
            startedAt = subPhase['started-at'];
        }
        else {
            prompt = step.prompt;
            startedAt = step['started-at'];
        }
    }
    else {
        prompt = phase.prompt;
        startedAt = phase['started-at'];
    }
    if (!prompt) {
        return null;
    }
    const path = buildCurrentPath(progress, phaseIdx, stepIdx, subPhaseIdx);
    return {
        path,
        prompt,
        startedAt,
        elapsed: startedAt ? calculateElapsed(startedAt) : undefined,
    };
}
// ============================================================================
// Log Entry Generation
// ============================================================================
let logIdCounter = 0;
/**
 * Generate a unique log entry ID
 */
function generateLogId() {
    return `log-${Date.now()}-${++logIdCounter}`;
}
/**
 * Determine log entry type from phase status
 */
function statusToLogType(status) {
    switch (status) {
        case 'in-progress':
            return 'start';
        case 'completed':
            return 'complete';
        case 'failed':
        case 'blocked':
            return 'error';
        case 'skipped':
            return 'skip';
        default:
            return 'info';
    }
}
/**
 * Generate a log message for a status change
 */
function statusToMessage(status, context) {
    switch (status) {
        case 'in-progress':
            return `Started: ${context}`;
        case 'completed':
            return `Completed: ${context}`;
        case 'failed':
            return `Failed: ${context}`;
        case 'blocked':
            return `Blocked: ${context}`;
        case 'skipped':
            return `Skipped: ${context}`;
        default:
            return `${status}: ${context}`;
    }
}
/**
 * Create a log entry for a status change
 */
function createLogEntry(type, message, context, timestamp) {
    return {
        id: generateLogId(),
        type,
        message,
        timestamp: timestamp || new Date().toISOString(),
        context,
    };
}
/**
 * Create a log entry from a phase status change
 */
function createStatusLogEntry(status, phasePath, timestamp) {
    return createLogEntry(statusToLogType(status), statusToMessage(status, phasePath), phasePath, timestamp);
}
/**
 * Compare two progress states and generate log entries for changes
 * This is useful for detecting status transitions
 */
function generateDiffLogEntries(oldProgress, newProgress) {
    const entries = [];
    // Helper to track phase paths and statuses
    function collectPhaseStatuses(progress) {
        const result = new Map();
        for (const phase of progress.phases ?? []) {
            const phasePath = phase.id;
            result.set(phasePath, {
                status: phase.status,
                startedAt: phase['started-at'],
                completedAt: phase['completed-at'],
            });
            if (phase.steps) {
                for (const step of phase.steps) {
                    const stepPath = `${phasePath} > ${step.id}`;
                    result.set(stepPath, {
                        status: step.status,
                        startedAt: step['started-at'],
                        completedAt: step['completed-at'],
                    });
                    for (const subPhase of step.phases) {
                        const subPhasePath = `${stepPath} > ${subPhase.id}`;
                        result.set(subPhasePath, {
                            status: subPhase.status,
                            startedAt: subPhase['started-at'],
                            completedAt: subPhase['completed-at'],
                        });
                    }
                }
            }
        }
        return result;
    }
    const oldStatuses = oldProgress ? collectPhaseStatuses(oldProgress) : new Map();
    const newStatuses = collectPhaseStatuses(newProgress);
    // Find status changes
    for (const [path, newInfo] of newStatuses) {
        const oldInfo = oldStatuses.get(path);
        if (!oldInfo || oldInfo.status !== newInfo.status) {
            // Status changed or new phase
            const timestamp = newInfo.status === 'completed'
                ? newInfo.completedAt
                : newInfo.status === 'in-progress'
                    ? newInfo.startedAt
                    : undefined;
            entries.push(createStatusLogEntry(newInfo.status, path, timestamp));
        }
    }
    return entries;
}
// ============================================================================
// Hook Task Transformation (Ralph Mode)
// ============================================================================
/**
 * Transform HookTask array to HookTaskStatus array for UI display
 * Groups by iteration and shows latest status for each hook
 */
function transformHookTasks(hookTasks) {
    if (!hookTasks || hookTasks.length === 0) {
        return [];
    }
    // Get the most recent entries for each iteration/hook combination
    const latestTasks = new Map();
    for (const task of hookTasks) {
        const key = `${task.iteration}-${task['hook-id']}`;
        const existing = latestTasks.get(key);
        // Keep the one with more complete status (completed > in-progress > spawned)
        if (!existing || isMoreCompleteStatus(task.status, existing.status)) {
            latestTasks.set(key, task);
        }
    }
    // Convert to HookTaskStatus array, sorted by iteration desc
    return Array.from(latestTasks.values())
        .map(task => ({
        hookId: task['hook-id'],
        iteration: task.iteration,
        status: task.status,
        spawnedAt: task['spawned-at'],
        completedAt: task['completed-at'],
        exitCode: task['exit-code'],
    }))
        .sort((a, b) => b.iteration - a.iteration);
}
/**
 * Helper to determine if a status is more complete than another
 */
function isMoreCompleteStatus(a, b) {
    const order = { spawned: 0, running: 1, 'in-progress': 1, completed: 2, failed: 2 };
    return (order[a] || 0) > (order[b] || 0);
}
// ============================================================================
// Main Transform Function
// ============================================================================
/**
 * Convert CompiledProgress to StatusUpdate format
 * This is the main entry point for transforming progress data for the UI
 * Handles both standard mode (phases) and Ralph mode (goal-driven with dynamic-steps)
 */
function toStatusUpdate(progress, includeRaw = false, timingInfo) {
    // Detect execution mode
    const progressWithMode = progress;
    const isRalphMode = progressWithMode.mode === 'ralph';
    const { total, completed } = countPhases(progress);
    // Build the header
    const header = {
        sprintId: progress['sprint-id'],
        status: progress.status,
        mode: isRalphMode ? 'ralph' : 'standard',
        progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
        completedPhases: completed,
        totalPhases: total,
        startedAt: progress.stats['started-at'] || undefined,
        elapsed: progress.stats.elapsed,
    };
    // Add Ralph-specific header fields
    if (isRalphMode && progressWithMode.goal) {
        header.goal = progressWithMode.goal;
    }
    // Add iteration info if available (from enhanced SprintStats)
    // Use type assertion through unknown to access potential extra fields
    const stats = progress.stats;
    if (typeof stats['current-iteration'] === 'number') {
        header.currentIteration = stats['current-iteration'];
    }
    if (typeof stats['max-iterations'] === 'number') {
        header.maxIterations = stats['max-iterations'];
    }
    // Add timing estimates if available
    if (timingInfo) {
        header.estimatedRemainingMs = timingInfo.estimatedRemainingMs;
        header.estimatedRemaining = timingInfo.estimatedRemaining;
        header.estimateConfidence = timingInfo.estimateConfidence;
        if (timingInfo.estimatedCompletionTime) {
            header.estimatedCompletionTime = timingInfo.estimatedCompletionTime;
        }
    }
    // Build the phase/task tree based on mode
    const phaseTree = isRalphMode ? buildRalphTaskTree(progress) : buildPhaseTree(progress);
    // Extract current task (only for standard mode - Ralph mode is goal-driven)
    const currentTask = isRalphMode ? null : extractCurrentTask(progress);
    const update = {
        header,
        phaseTree,
        currentTask,
    };
    // Add hook tasks for Ralph mode
    if (isRalphMode) {
        const hookTasks = progress['hook-tasks'];
        if (hookTasks && hookTasks.length > 0) {
            update.hookTasks = transformHookTasks(hookTasks);
        }
    }
    // Optionally include raw progress data for debugging
    if (includeRaw) {
        update.raw = progress;
    }
    return update;
}
//# sourceMappingURL=transforms.js.map