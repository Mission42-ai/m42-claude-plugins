/**
 * Validation Module
 *
 * Schema validation for SPRINT.yaml and workflow definitions
 */
import type { SprintDefinition, WorkflowDefinition, CompiledProgress, CompilerError } from './types.js';
/**
 * Validate that a model value is valid
 *
 * @param model - The model value to validate
 * @param path - Path for error messages
 * @returns Array of validation errors (empty if valid)
 */
export declare function validateModel(model: unknown, path: string): CompilerError[];
/**
 * Validate a sprint definition (SPRINT.yaml) - basic validation
 *
 * This performs minimal validation before workflow is loaded.
 * The `steps` array requirement is deferred to validateStandardModeSprint()
 * because Ralph mode sprints don't use steps.
 *
 * @param sprint - The sprint definition to validate
 * @returns Array of validation errors
 */
export declare function validateSprintDefinition(sprint: unknown): CompilerError[];
/**
 * Validate standard mode sprint requirements
 *
 * Called after workflow is loaded to validate sprint-specific standard mode requirements.
 *
 * @param sprint - The sprint definition
 * @returns Array of validation errors
 */
export declare function validateStandardModeSprint(sprint: SprintDefinition): CompilerError[];
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
 * Validate a per-iteration hook
 *
 * @param hook - The hook to validate
 * @param index - Index of the hook
 * @param workflowName - Name of the containing workflow
 * @returns Array of validation errors
 */
export declare function validatePerIterationHook(hook: unknown, index: number, workflowName: string): CompilerError[];
/**
 * Validate Ralph mode sprint requirements
 *
 * Called after workflow is loaded to validate sprint-specific Ralph mode requirements.
 *
 * @param sprint - The sprint definition
 * @param workflow - The workflow definition (known to be Ralph mode)
 * @returns Array of validation errors
 */
export declare function validateRalphModeSprint(sprint: SprintDefinition, workflow: WorkflowDefinition): CompilerError[];
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
/**
 * Validate a git branch name according to git ref rules
 * @see https://git-scm.com/docs/git-check-ref-format
 *
 * @param branch - The branch name to validate (may contain variables like {sprint-id})
 * @returns true if the branch name is valid
 */
export declare function isValidGitBranchName(branch: string): boolean;
/**
 * Validate worktree configuration from SPRINT.yaml
 *
 * @param worktree - The worktree configuration to validate
 * @param configPath - Path prefix for error messages (e.g., 'worktree' or 'workflow.worktree')
 * @returns Array of validation errors
 */
export declare function validateWorktreeConfig(worktree: unknown, configPath: string): CompilerError[];
/**
 * Validate workflow-level worktree defaults
 *
 * @param worktree - The workflow worktree defaults to validate
 * @param workflowName - Name of the workflow (for error messages)
 * @returns Array of validation errors
 */
export declare function validateWorkflowWorktreeDefaults(worktree: unknown, workflowName: string): CompilerError[];
//# sourceMappingURL=validate.d.ts.map