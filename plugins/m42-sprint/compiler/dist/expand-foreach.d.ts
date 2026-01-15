/**
 * For-Each Expansion Module
 *
 * Handles expansion of for-each: step phases into concrete steps
 */
import type { WorkflowPhase, WorkflowDefinition, SprintStep, CompiledTopPhase, CompiledStep, LoadedWorkflow, TemplateContext, CompilerError } from './types.js';
/**
 * Substitute template variables in a string
 *
 * Supports:
 * - {{step.prompt}} - The step's prompt text
 * - {{step.id}} - The step's ID
 * - {{step.index}} - The step's index (0-based)
 * - {{phase.id}} - Current phase ID
 * - {{sprint.id}} - Sprint ID
 *
 * @param template - String containing template variables
 * @param context - Context for variable substitution
 * @returns String with variables replaced
 */
export declare function substituteTemplateVars(template: string, context: TemplateContext): string;
/**
 * Find unresolved template variables in a string
 *
 * @param text - String to check
 * @returns Array of unresolved variable names
 */
export declare function findUnresolvedVars(text: string): string[];
/**
 * Expand a single step using its workflow
 *
 * @param step - The step to expand
 * @param stepIndex - Index of this step
 * @param workflow - The workflow to use for expansion
 * @param context - Template context
 * @returns Compiled step with expanded sub-phases
 */
export declare function expandStep(step: SprintStep, stepIndex: number, workflow: WorkflowDefinition, context: TemplateContext): CompiledStep;
/**
 * Expand a for-each phase into concrete steps
 *
 * @param phase - The phase with for-each directive
 * @param steps - The steps from SPRINT.yaml
 * @param workflowsDir - Directory containing workflow definitions
 * @param defaultWorkflow - Default workflow to use if step doesn't specify one
 * @param context - Template context
 * @param errors - Array to collect errors
 * @returns Compiled top phase with expanded steps
 */
export declare function expandForEach(phase: WorkflowPhase, steps: SprintStep[], workflowsDir: string, defaultWorkflow: LoadedWorkflow | null, context: TemplateContext, errors: CompilerError[]): CompiledTopPhase;
/**
 * Compile a simple phase (no for-each)
 *
 * @param phase - The phase to compile
 * @param context - Template context
 * @returns Compiled top phase
 */
export declare function compileSimplePhase(phase: WorkflowPhase, context: TemplateContext): CompiledTopPhase;
//# sourceMappingURL=expand-foreach.d.ts.map