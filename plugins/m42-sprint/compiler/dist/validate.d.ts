/**
 * Validation Module
 *
 * Schema validation for SPRINT.yaml and workflow definitions
 */
import type { CompiledProgress, CompilerError } from './types.js';
/**
 * Validate a sprint definition (SPRINT.yaml)
 *
 * @param sprint - The sprint definition to validate
 * @returns Array of validation errors
 */
export declare function validateSprintDefinition(sprint: unknown): CompilerError[];
/**
 * Validate a single sprint step
 *
 * @param step - The step to validate
 * @param index - Index of the step in the array
 * @returns Array of validation errors
 */
export declare function validateSprintStep(step: unknown, index: number): CompilerError[];
/**
 * Validate a workflow definition
 *
 * @param workflow - The workflow to validate
 * @param name - Name of the workflow (for error messages)
 * @returns Array of validation errors
 */
export declare function validateWorkflowDefinition(workflow: unknown, name: string): CompilerError[];
/**
 * Validate a single workflow phase
 *
 * @param phase - The phase to validate
 * @param index - Index of the phase
 * @param workflowName - Name of the containing workflow
 * @param existingIds - Set of already seen phase IDs (for duplicate detection)
 * @returns Array of validation errors
 */
export declare function validateWorkflowPhase(phase: unknown, index: number, workflowName: string, existingIds: Set<string>): CompilerError[];
/**
 * Check for unresolved template variables in compiled progress
 *
 * @param progress - The compiled progress to check
 * @param asErrors - If true, return as CompilerError[] for strict mode; otherwise return as string[]
 * @returns Array of issues about unresolved variables (errors or warnings based on asErrors)
 */
export declare function checkUnresolvedVariables(progress: CompiledProgress): CompilerError[];
/**
 * Validate the entire compiled progress structure
 *
 * @param progress - The compiled progress to validate
 * @returns Array of validation errors
 */
export declare function validateCompiledProgress(progress: CompiledProgress): CompilerError[];
//# sourceMappingURL=validate.d.ts.map