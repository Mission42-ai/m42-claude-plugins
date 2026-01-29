"use strict";
/**
 * Worktree Configuration Module
 *
 * Extracts, resolves, and merges worktree configuration from workflow and sprint definitions.
 * Used by the compiler to populate CompiledWorktreeConfig in PROGRESS.yaml, and by
 * run-sprint to determine if a worktree should be created before execution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWorktreeConfig = extractWorktreeConfig;
exports.shouldCreateWorktree = shouldCreateWorktree;
exports.resolveWorktreePath = resolveWorktreePath;
exports.mergeWorktreeConfigs = mergeWorktreeConfigs;
/**
 * Default branch prefix when not specified
 */
const DEFAULT_BRANCH_PREFIX = 'sprint/';
/**
 * Default path pattern when not specified (relative to repo root)
 */
const DEFAULT_PATH_PATTERN = '../{sprint-id}-worktree';
/**
 * Default cleanup mode
 */
const DEFAULT_CLEANUP = 'on-complete';
/**
 * Extract sprint name from sprint ID.
 * Assumes format: YYYY-MM-DD_<sprint-name>
 *
 * @param sprintId - Full sprint ID
 * @returns The sprint name portion
 */
function extractSprintName(sprintId) {
    const parts = sprintId.split('_');
    if (parts.length > 1) {
        return parts.slice(1).join('_');
    }
    return sprintId;
}
/**
 * Extract date from sprint ID.
 * Assumes format: YYYY-MM-DD_<sprint-name>
 *
 * @param sprintId - Full sprint ID
 * @returns The date portion (YYYY-MM-DD)
 */
function extractDate(sprintId) {
    const match = sprintId.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : new Date().toISOString().split('T')[0];
}
/**
 * Substitute variables in a template string
 *
 * Supports {sprint-id}, {sprint-name}, {date}
 *
 * @param template - String with {variable} placeholders
 * @param vars - Variables to substitute
 * @returns String with variables replaced
 */
function substituteVars(template, vars) {
    return template
        .replace(/\{sprint-id\}/g, vars['sprint-id'])
        .replace(/\{sprint-name\}/g, vars['sprint-name'])
        .replace(/\{date\}/g, vars.date);
}
/**
 * Extract worktree configuration from a workflow definition.
 *
 * Returns the raw worktree defaults section from the workflow, or undefined
 * if the workflow has no worktree configuration.
 *
 * @param workflow - The workflow definition
 * @returns The workflow's worktree defaults, or undefined
 */
function extractWorktreeConfig(workflow) {
    return workflow.worktree;
}
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
function shouldCreateWorktree(sprint, workflow) {
    // Sprint-level config takes precedence
    if (sprint.worktree !== undefined) {
        return sprint.worktree.enabled === true;
    }
    // Fall back to workflow config
    if (workflow.worktree !== undefined) {
        return workflow.worktree.enabled === true;
    }
    // No worktree config anywhere
    return false;
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
function resolveWorktreePath(sprintId, workflowDefaults, sprintWorktree) {
    // Build substitution variables
    const vars = {
        'sprint-id': sprintId,
        'sprint-name': extractSprintName(sprintId),
        date: extractDate(sprintId)
    };
    // Determine branch (sprint.branch > workflow.branch-prefix > default)
    let branch;
    if (sprintWorktree?.branch) {
        branch = substituteVars(sprintWorktree.branch, vars);
    }
    else if (workflowDefaults?.['branch-prefix']) {
        branch = workflowDefaults['branch-prefix'] + sprintId;
    }
    else {
        branch = DEFAULT_BRANCH_PREFIX + sprintId;
    }
    // Determine path (sprint.path > workflow.path-prefix > default)
    let worktreePath;
    if (sprintWorktree?.path) {
        worktreePath = substituteVars(sprintWorktree.path, vars);
    }
    else if (workflowDefaults?.['path-prefix']) {
        worktreePath = workflowDefaults['path-prefix'] + sprintId;
    }
    else {
        worktreePath = substituteVars(DEFAULT_PATH_PATTERN, vars);
    }
    // Determine cleanup (sprint.cleanup > workflow.cleanup > default)
    const cleanup = sprintWorktree?.cleanup ??
        workflowDefaults?.cleanup ??
        DEFAULT_CLEANUP;
    return { branch, path: worktreePath, cleanup };
}
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
function mergeWorktreeConfigs(sprintId, sprint, workflow) {
    // Check if worktree should be created
    if (!shouldCreateWorktree(sprint, workflow)) {
        return undefined;
    }
    // Resolve paths
    const resolved = resolveWorktreePath(sprintId, workflow.worktree, sprint.worktree);
    return {
        enabled: true,
        branch: resolved.branch,
        path: resolved.path,
        cleanup: resolved.cleanup
    };
}
//# sourceMappingURL=worktree-config.js.map