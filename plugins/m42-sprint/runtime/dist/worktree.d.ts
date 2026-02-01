/**
 * Worktree Creation Module for Sprint Initialization
 *
 * Creates git branches and worktrees when starting sprints with worktree configuration.
 * Used by /init-sprint command to isolate sprint work in dedicated worktrees.
 */
/**
 * Variables available for substitution in branch/path templates
 */
export interface WorktreeVariables {
    /** Sprint ID, e.g., "2026-01-20_feature-auth" */
    'sprint-id': string;
    /** Sprint name, e.g., "feature-auth" */
    'sprint-name': string;
    /** Date portion, e.g., "2026-01-20" */
    date: string;
    /** Workflow name, e.g., "feature-development" */
    workflow: string;
}
/**
 * Worktree configuration from SPRINT.yaml
 */
export interface WorktreeConfig {
    enabled: boolean;
    branch?: string;
    path?: string;
    cleanup?: 'never' | 'on-complete' | 'on-merge';
}
/**
 * Result of worktree creation
 */
export interface CreateWorktreeResult {
    success: boolean;
    /** Resolved branch name */
    branch: string;
    /** Absolute path to worktree */
    worktreePath: string;
    /** Sprint directory within worktree */
    sprintDir: string;
    /** Whether a new branch was created (vs reusing existing) */
    branchCreated: boolean;
    /** Error message if failed */
    error?: string;
    /** Suggestion for recovery if failed */
    suggestion?: string;
}
/**
 * Result of checking if branch exists
 */
export interface BranchCheckResult {
    exists: boolean;
    isCurrentBranch: boolean;
    hasWorktree: boolean;
    worktreePath?: string;
}
/**
 * Substitute variables in a template string
 *
 * Supports {sprint-id}, {sprint-name}, {date}, {workflow}
 *
 * @param template - String with {variable} placeholders
 * @param vars - Variables to substitute
 * @returns String with variables replaced
 */
export declare function substituteWorktreeVars(template: string, vars: WorktreeVariables): string;
/**
 * Extract sprint name from sprint ID
 * Assumes format: YYYY-MM-DD_<sprint-name>
 */
export declare function extractSprintName(sprintId: string): string;
/**
 * Extract date from sprint ID
 * Assumes format: YYYY-MM-DD_<sprint-name>
 */
export declare function extractDate(sprintId: string): string;
/**
 * Get the repository root directory
 */
export declare function getRepoRoot(cwd: string): string | null;
/**
 * Get the current branch name
 */
export declare function getCurrentBranch(cwd: string): string | null;
/**
 * Check if a branch exists (locally or remote)
 */
export declare function checkBranchExists(branchName: string, cwd: string): BranchCheckResult;
/**
 * Create a new git branch from HEAD (or specified base)
 */
export declare function createBranch(branchName: string, cwd: string, baseBranch?: string): {
    success: boolean;
    error?: string;
};
/**
 * Create a git worktree at the specified path for the given branch
 */
export declare function createGitWorktree(worktreePath: string, branchName: string, cwd: string): {
    success: boolean;
    error?: string;
};
/**
 * Create a worktree for a sprint
 *
 * This function:
 * 1. Resolves branch and path templates with variable substitution
 * 2. Creates the git branch if it doesn't exist
 * 3. Creates the git worktree
 * 4. Creates the sprint directory structure in the worktree
 * 5. Returns information for PROGRESS.yaml worktree fields
 *
 * @param config - Worktree configuration from SPRINT.yaml
 * @param sprintId - The sprint ID (e.g., "2026-01-20_feature-auth")
 * @param workflow - The workflow name
 * @param repoRoot - Root of the git repository
 * @param options - Additional options
 * @returns Result with paths and status
 */
export declare function createWorktree(config: WorktreeConfig, sprintId: string, workflow: string, repoRoot: string, options?: {
    /** Base branch to create from (default: HEAD) */
    baseBranch?: string;
    /** Force reuse of existing branch */
    reuseExistingBranch?: boolean;
}): CreateWorktreeResult;
/**
 * Build the worktree section for PROGRESS.yaml
 */
export declare function buildWorktreeProgressSection(result: CreateWorktreeResult, config: WorktreeConfig): {
    enabled: boolean;
    branch: string;
    path: string;
    'working-dir': string;
    'created-at': string;
    cleanup: 'never' | 'on-complete' | 'on-merge';
};
/**
 * Format user-facing message for successful worktree creation
 */
export declare function formatWorktreeSuccessMessage(result: CreateWorktreeResult, baseBranch: string): string;
/**
 * Format user-facing error message for failed worktree creation
 */
export declare function formatWorktreeErrorMessage(result: CreateWorktreeResult): string;
/**
 * Information about the current worktree environment
 */
export interface WorktreeInfo {
    /** Whether the current directory is inside a git worktree (not the main repo) */
    isWorktree: boolean;
    /** Absolute path to the current worktree root (or main repo if not a worktree) */
    path: string;
    /** Unique identifier for this worktree (SHA-256 hash of path, first 12 chars) */
    id: string;
    /** Path to the main worktree (main repository root) */
    mainWorktreePath: string;
}
/**
 * Get information about the current worktree environment.
 *
 * Detects if running inside a git worktree (vs main repository) and provides
 * isolation-relevant information including a unique worktree ID.
 *
 * @param cwd - Current working directory to check
 * @returns WorktreeInfo with detection results
 */
export declare function getWorktreeInfo(cwd: string): WorktreeInfo;
/**
 * Validate that sprint artifacts are isolated to the current worktree.
 *
 * This function checks that:
 * 1. The sprint directory is within the current worktree (not shared)
 * 2. PROGRESS.yaml would be written to the worktree-local sprint directory
 *
 * This prevents conflicts when multiple developers run sprints in parallel
 * across different worktrees.
 *
 * @param sprintDir - Path to the sprint directory (.claude/sprints/xxx/)
 * @param cwd - Current working directory (defaults to sprintDir)
 * @returns true if isolation is valid, false if there's a risk of conflict
 */
export declare function validateWorktreeIsolation(sprintDir: string, cwd?: string): boolean;
/**
 * Build worktree metadata fields for PROGRESS.yaml.
 *
 * These fields are added to PROGRESS.yaml on sprint start to track
 * which worktree the sprint is running in.
 *
 * @param cwd - Current working directory
 * @returns Object with worktree-id and worktree-path fields
 */
export declare function buildWorktreeMetadata(cwd: string): {
    'worktree-id': string;
    'worktree-path': string;
    'is-worktree': boolean;
};
/**
 * Get the project root for Claude execution.
 *
 * This determines the correct working directory for Claude:
 * - For worktree sprints: uses the worktree path (via PROGRESS.yaml working-dir)
 * - For non-worktree sprints: finds the git repository root
 * - Falls back to the directory containing .claude/ folder
 * - Final fallback to the sprint directory's parent hierarchy
 *
 * @param sprintDir - Path to the sprint directory (.claude/sprints/xxx/)
 * @returns Absolute path to the project root where Claude should execute
 */
export declare function getProjectRoot(sprintDir: string): string;
//# sourceMappingURL=worktree.d.ts.map