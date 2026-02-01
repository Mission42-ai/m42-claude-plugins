/**
 * Progress Injector - Dynamic Step Injection into Running Sprints
 *
 * Allows adding steps to PROGRESS.yaml at runtime:
 * - Add single steps to a specific position
 * - Compile a workflow to add multiple steps
 * - Choose insertion point (after current, end of phase, specific position)
 */
/**
 * Position types for step injection
 */
export type InsertPosition = {
    type: 'after-current';
} | {
    type: 'after-step';
    stepId: string;
} | {
    type: 'end-of-phase';
    phaseId: string;
} | {
    type: 'end-of-workflow';
} | {
    type: 'before-step';
    stepId: string;
};
/**
 * Single step injection request
 */
export interface StepInjection {
    step: {
        id: string;
        prompt: string;
        model?: string;
    };
    position: InsertPosition;
}
/**
 * Workflow injection request
 */
export interface WorkflowInjection {
    workflow: string;
    context?: {
        step?: {
            prompt: string;
            id: string;
        };
        variables?: Record<string, unknown>;
    };
    position: InsertPosition;
    idPrefix: string;
}
/**
 * Injected phase marker
 */
export interface InjectedPhase {
    id: string;
    status: 'pending';
    prompt: string;
    injected: true;
    'injected-at': string;
    model?: string;
}
export declare class ProgressInjector {
    private progressPath;
    private workflowsDir;
    constructor(progressPath: string, workflowsDir?: string);
    /**
     * Inject a single step into the progress file
     */
    injectStep(injection: StepInjection): Promise<void>;
    /**
     * Inject a compiled workflow into the progress file
     */
    injectWorkflow(injection: WorkflowInjection): Promise<void>;
    /**
     * Read progress, apply modifications, update stats, and write atomically
     */
    private modifyProgress;
    /**
     * Create an injected phase with metadata
     */
    private createInjectedPhase;
    /**
     * Resolve position to insert index
     */
    private resolvePosition;
    /**
     * Find index of step by ID
     */
    private findStepIndex;
    /**
     * Recalculate stats after injection
     */
    private updateStats;
    /**
     * Load workflow phases from YAML file
     */
    private loadWorkflowPhases;
    /**
     * Find workflow file path
     */
    private findWorkflowPath;
    /**
     * Try to find workflow file in a directory
     */
    private tryFindWorkflow;
}
//# sourceMappingURL=progress-injector.d.ts.map