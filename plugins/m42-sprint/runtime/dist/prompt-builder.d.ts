/**
 * Prompt Builder Module - Generates execution prompts for sprint tasks
 *
 * Replaces: build-sprint-prompt.sh (354 lines) and build-parallel-prompt.sh (82 lines)
 *
 * Generates hierarchical prompts for:
 * - Simple phases (no steps)
 * - For-each phases with steps and sub-phases
 * - Parallel background tasks
 */
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed' | 'spawned';
export type SprintStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human';
export interface CurrentPointer {
    phase: number;
    step: number | null;
    'sub-phase': number | null;
}
export interface SprintStats {
    'started-at': string | null;
    'completed-at'?: string | null;
    'total-phases': number;
    'completed-phases': number;
    elapsed?: string;
    'current-iteration'?: number;
    'max-iterations'?: number;
    'total-steps'?: number;
    'completed-steps'?: number;
}
export interface CompiledPhase {
    id: string;
    status: PhaseStatus;
    prompt: string;
    'started-at'?: string;
    'completed-at'?: string;
    elapsed?: string;
    summary?: string;
    error?: string;
    'retry-count'?: number;
    'next-retry-at'?: string;
    parallel?: boolean;
    'parallel-task-id'?: string;
}
export interface CompiledStep {
    id: string;
    prompt: string;
    status: PhaseStatus;
    phases: CompiledPhase[];
    'started-at'?: string;
    'completed-at'?: string;
    elapsed?: string;
    error?: string;
    'retry-count'?: number;
}
export interface CompiledTopPhase {
    id: string;
    status: PhaseStatus;
    prompt?: string;
    steps?: CompiledStep[];
    'started-at'?: string;
    'completed-at'?: string;
    elapsed?: string;
    summary?: string;
    error?: string;
    'retry-count'?: number;
    'wait-for-parallel'?: boolean;
    'parallel-task-id'?: string;
}
export interface CompiledProgress {
    'sprint-id': string;
    status: SprintStatus;
    current: CurrentPointer;
    stats: SprintStats;
    phases?: CompiledTopPhase[];
    [key: string]: unknown;
}
/**
 * Context for template variable substitution
 */
export interface PromptContext {
    sprintId: string;
    iteration: number;
    phase: {
        id: string;
        index: number;
        total: number;
    };
    step: {
        id: string;
        prompt: string;
        index: number;
        total: number;
    } | null;
    subPhase: {
        id: string;
        index: number;
        total: number;
    } | null;
    retryCount: number;
    error: string | null;
}
/**
 * Custom prompt templates from SPRINT.yaml
 */
export interface CustomPrompts {
    header?: string;
    position?: string;
    'retry-warning'?: string;
    instructions?: string;
    'result-reporting'?: string;
}
export declare const DEFAULT_PROMPTS: Required<CustomPrompts>;
/**
 * Substitute template variables in a string
 * Variables use {{variable.name}} syntax
 * Index values are converted from 0-based to 1-based for display
 */
export declare function substituteVariables(template: string, context: PromptContext): string;
/**
 * Load context files from the sprint's context directory
 * Returns concatenated content of all context files (primarily _shared.md)
 */
export declare function loadContextFiles(contextDir: string): string;
/**
 * Build prompt for the current sprint position
 * Handles both simple phases and for-each phases with steps/sub-phases
 */
export declare function buildPrompt(progress: CompiledProgress, sprintDir: string, customPrompts?: CustomPrompts): string;
/**
 * Build simplified prompt for parallel background tasks
 * Does NOT include progress modification instructions
 */
export declare function buildParallelPrompt(progress: CompiledProgress, sprintDir: string, phaseIdx: number, stepIdx: number, subPhaseIdx: number, taskId: string): string;
//# sourceMappingURL=prompt-builder.d.ts.map