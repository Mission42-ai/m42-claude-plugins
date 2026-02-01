/**
 * Executor Module - Action Execution for Sprint State Machine
 *
 * Maps SprintAction discriminated union to side effect implementations.
 * Actions describe effects; this module executes them.
 */
import * as fs from 'fs';
import * as path from 'path';
import { writeProgressAtomic } from './yaml-ops.js';
import { runClaude, categorizeError } from './claude-runner.js';
/** Default dependencies using real implementations */
const defaultDeps = {
    runClaude,
};
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// ============================================================================
// Main Functions
// ============================================================================
/**
 * Execute a single action and return any resulting event.
 *
 * @param action - The action to execute
 * @param context - Executor context with sprint state
 * @param deps - Optional dependencies for testing
 * @returns Promise resolving to SprintEvent or null
 */
export async function executeAction(action, context, deps = defaultDeps) {
    switch (action.type) {
        case 'LOG': {
            const logFn = action.level === 'warn' ? console.warn :
                action.level === 'error' ? console.error :
                    console.log;
            logFn(action.message);
            return null;
        }
        case 'SPAWN_CLAUDE': {
            const result = await deps.runClaude({
                prompt: action.prompt,
                cwd: context.sprintDir,
            });
            if (result.success) {
                // Extract summary from jsonResult if available
                const summary = result.jsonResult?.summary ||
                    'Phase completed';
                return { type: 'PHASE_COMPLETE', summary, phaseId: action.phaseId };
            }
            else {
                const category = categorizeError(result.error || 'Unknown error');
                return {
                    type: 'PHASE_FAILED',
                    error: result.error || 'Unknown error',
                    category,
                    phaseId: action.phaseId,
                };
            }
        }
        case 'WRITE_PROGRESS': {
            const progressPath = path.join(context.sprintDir, 'PROGRESS.yaml');
            // Cast to yaml-ops compatible type (index signature allows all fields)
            await writeProgressAtomic(progressPath, context.progress);
            return null;
        }
        case 'UPDATE_STATS': {
            // Merge updates into existing stats
            context.progress.stats = {
                ...context.progress.stats,
                ...action.updates,
            };
            return null;
        }
        case 'EMIT_ACTIVITY': {
            const activityPath = path.join(context.sprintDir, '.sprint-activity.jsonl');
            const entry = {
                timestamp: new Date().toISOString(),
                activity: action.activity,
                data: action.data,
            };
            // Ensure directory exists
            const dir = path.dirname(activityPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            // Append JSONL line
            fs.appendFileSync(activityPath, JSON.stringify(entry) + '\n');
            return null;
        }
        case 'SCHEDULE_RETRY': {
            await sleep(action.delayMs);
            // Return TICK event to signal retry iteration
            return { type: 'TICK' };
        }
        case 'INSERT_STEP': {
            const { step, position } = action;
            const currentPhaseIdx = context.progress.current.phase;
            const currentPhase = context.progress.phases?.[currentPhaseIdx];
            if (!currentPhase?.steps) {
                // Handle simple phase (no steps) - cannot insert
                return null;
            }
            // Create CompiledStep from StepQueueItem
            const newStep = {
                id: step.id,
                prompt: step.prompt,
                status: 'pending',
                phases: [],
            };
            if (position === 'after-current') {
                const insertIdx = (context.progress.current.step ?? 0) + 1;
                currentPhase.steps.splice(insertIdx, 0, newStep);
            }
            else {
                // 'end-of-phase'
                currentPhase.steps.push(newStep);
            }
            return null;
        }
        default: {
            // Exhaustive switch - TypeScript will error if any action type is not handled
            const _exhaustive = action;
            throw new Error(`Unhandled action type: ${JSON.stringify(_exhaustive)}`);
        }
    }
}
/**
 * Execute multiple actions in sequence and collect resulting events.
 *
 * @param actions - Array of actions to execute
 * @param context - Executor context with sprint state
 * @param deps - Optional dependencies for testing
 * @returns Promise resolving to array of non-null events
 */
export async function executeActions(actions, context, deps = defaultDeps) {
    const events = [];
    for (const action of actions) {
        const event = await executeAction(action, context, deps);
        if (event !== null) {
            events.push(event);
        }
    }
    return events;
}
//# sourceMappingURL=executor.js.map