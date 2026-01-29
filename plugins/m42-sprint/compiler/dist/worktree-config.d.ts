/**
 * Worktree Configuration Module
 *
 * Extracts, resolves, and merges worktree configuration from workflow and sprint definitions.
 * Used by the compiler to populate CompiledWorktreeConfig in PROGRESS.yaml, and by
 * run-sprint to determine if a worktree should be created before execution.
 */
import type { WorkflowDefinition, SprintDefinition, WorkflowWorktreeDefaults, WorktreeConfig, CompiledWorktreeConfig } from './types.js';
/**
 * Extract worktree configuration from a workflow definition.
 *
 * Returns the raw worktree defaults section from the workflow, or undefined
 * if the workflow has no worktree configuration.
 *
 * @param workflow - The workflow definition
 * @returns The workflow's worktree defaults, or undefined
 */
export declare function extractWorktreeConfig(workflow: WorkflowDefinition): WorkflowWorktreeDefaults | undefined;
/**
 * Determine whether a worktree should be created for a sprint.
 *
 * Checks both sprint-level and workflow-level worktree configuration.
 * Sprint configuration takes precedence over workflow defaults.
 *
 * Decision logic:
 * 1. If sprint has worktree.enabled = false → false (sprint overrides)
 * 2. If sprint has worktree.enabled = true → true
 * 3. If workflow has worktree.enabled = true → true
 * 4. Otherwise → false
 *
 * @param sprint - The sprint definition
 * @param workflow - The workflow definition
 * @returns true if a worktree should be created
 */
export declare function shouldCreateWorktree(sprint: SprintDefinition, workflow: WorkflowDefinition): boolean;
/**
 * Resolved worktree paths after variable substitution
 */
export interface ResolvedWorktreePaths {
    /** Resolved branch name */
    branch: string;
    /** Resolved worktree path */
    path: string;
    /** Cleanup mode */
    cleanup: 'never' | 'on-complete' | 'on-merge';
}
/**
 * Resolve the worktree branch and path from configuration.
 *
 * Applies variable substitution and merges workflow defaults with sprint overrides.
 *
 * @param sprintId - The sprint ID for variable substitution
 * @param workflowDefaults - Workflow-level worktree defaults (optional)
 * @param sprintWorktree - Sprint-level worktree config (optional)
 * @returns Resolved branch and path
 */
export declare function resolveWorktreePath(sprintId: string, workflowDefaults: WorkflowWorktreeDefaults | undefined, sprintWorktree: WorktreeConfig | undefined): ResolvedWorktreePaths;
/**
 * Merge workflow and sprint worktree configurations into a compiled config.
 *
 * This is used during compilation to produce the worktree section in PROGRESS.yaml.
 * Returns undefined if worktree is not enabled in either config.
 *
 * @param sprintId - The sprint ID
 * @param sprint - The sprint definition
 * @param workflow - The workflow definition
 * @returns Compiled worktree config, or undefined if worktree is not enabled
 */
export declare function mergeWorktreeConfigs(sprintId: string, sprint: SprintDefinition, workflow: WorkflowDefinition): CompiledWorktreeConfig | undefined;
//# sourceMappingURL=worktree-config.d.ts.map