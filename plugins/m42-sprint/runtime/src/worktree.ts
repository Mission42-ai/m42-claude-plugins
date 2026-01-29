/**
 * Worktree Creation Module for Sprint Initialization
 *
 * Creates git branches and worktrees when starting sprints with worktree configuration.
 * Used by /start-sprint command to isolate sprint work in dedicated worktrees.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Variable Substitution
// ============================================================================

/**
 * Substitute variables in a template string
 *
 * Supports {sprint-id}, {sprint-name}, {date}, {workflow}
 *
 * @param template - String with {variable} placeholders
 * @param vars - Variables to substitute
 * @returns String with variables replaced
 */
export function substituteWorktreeVars(
  template: string,
  vars: WorktreeVariables
): string {
  return template
    .replace(/\{sprint-id\}/g, vars['sprint-id'])
    .replace(/\{sprint-name\}/g, vars['sprint-name'])
    .replace(/\{date\}/g, vars.date)
    .replace(/\{workflow\}/g, vars.workflow);
}

/**
 * Extract sprint name from sprint ID
 * Assumes format: YYYY-MM-DD_<sprint-name>
 */
export function extractSprintName(sprintId: string): string {
  const parts = sprintId.split('_');
  if (parts.length > 1) {
    return parts.slice(1).join('_');
  }
  return sprintId;
}

/**
 * Extract date from sprint ID
 * Assumes format: YYYY-MM-DD_<sprint-name>
 */
export function extractDate(sprintId: string): string {
  const match = sprintId.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : new Date().toISOString().split('T')[0];
}

// ============================================================================
// Git Operations
// ============================================================================

/**
 * Execute a git command and return output
 */
function execGit(
  command: string,
  cwd: string,
  options: { throwOnError?: boolean } = {}
): { success: boolean; output: string; error?: string } {
  const { throwOnError = false } = options;
  const execOptions: ExecSyncOptionsWithStringEncoding = {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  };

  try {
    const output = execSync(command, execOptions).trim();
    return { success: true, output };
  } catch (err) {
    const error = err as { stderr?: string; message?: string };
    const errorMsg = error.stderr?.trim() || error.message || 'Unknown git error';
    if (throwOnError) {
      throw new Error(errorMsg);
    }
    return { success: false, output: '', error: errorMsg };
  }
}

/**
 * Get the repository root directory
 */
export function getRepoRoot(cwd: string): string | null {
  const result = execGit('git rev-parse --show-toplevel', cwd);
  return result.success ? result.output : null;
}

/**
 * Get the current branch name
 */
export function getCurrentBranch(cwd: string): string | null {
  const result = execGit('git rev-parse --abbrev-ref HEAD', cwd);
  return result.success ? result.output : null;
}

/**
 * Check if a branch exists (locally or remote)
 */
export function checkBranchExists(branchName: string, cwd: string): BranchCheckResult {
  // Check if branch exists locally
  const localResult = execGit(`git rev-parse --verify refs/heads/${branchName}`, cwd);
  const exists = localResult.success;

  // Check if it's the current branch
  const currentBranch = getCurrentBranch(cwd);
  const isCurrentBranch = currentBranch === branchName;

  // Check if branch has an associated worktree
  let hasWorktree = false;
  let worktreePath: string | undefined;

  if (exists) {
    const worktreeResult = execGit('git worktree list --porcelain', cwd);
    if (worktreeResult.success) {
      const lines = worktreeResult.output.split('\n');
      let currentPath = '';
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          currentPath = line.slice(9);
        } else if (line.startsWith('branch refs/heads/') && line.slice(18) === branchName) {
          hasWorktree = true;
          worktreePath = currentPath;
          break;
        }
      }
    }
  }

  return { exists, isCurrentBranch, hasWorktree, worktreePath };
}

/**
 * Create a new git branch from HEAD (or specified base)
 */
export function createBranch(
  branchName: string,
  cwd: string,
  baseBranch?: string
): { success: boolean; error?: string } {
  const base = baseBranch || 'HEAD';
  const result = execGit(`git branch ${branchName} ${base}`, cwd);
  return { success: result.success, error: result.error };
}

/**
 * Create a git worktree at the specified path for the given branch
 */
export function createGitWorktree(
  worktreePath: string,
  branchName: string,
  cwd: string
): { success: boolean; error?: string } {
  // Ensure parent directory exists
  const parentDir = path.dirname(worktreePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const result = execGit(`git worktree add "${worktreePath}" ${branchName}`, cwd);
  return { success: result.success, error: result.error };
}

// ============================================================================
// Main API
// ============================================================================

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
export function createWorktree(
  config: WorktreeConfig,
  sprintId: string,
  workflow: string,
  repoRoot: string,
  options: {
    /** Base branch to create from (default: HEAD) */
    baseBranch?: string;
    /** Force reuse of existing branch */
    reuseExistingBranch?: boolean;
  } = {}
): CreateWorktreeResult {
  const { baseBranch, reuseExistingBranch = false } = options;

  // Build substitution variables
  const vars: WorktreeVariables = {
    'sprint-id': sprintId,
    'sprint-name': extractSprintName(sprintId),
    date: extractDate(sprintId),
    workflow,
  };

  // Resolve branch name (default: sprint/{sprint-id})
  const branchTemplate = config.branch || 'sprint/{sprint-id}';
  const branchName = substituteWorktreeVars(branchTemplate, vars);

  // Resolve worktree path (default: ../{sprint-id}-worktree)
  const pathTemplate = config.path || '../{sprint-id}-worktree';
  const resolvedPath = substituteWorktreeVars(pathTemplate, vars);
  const worktreePath = path.isAbsolute(resolvedPath)
    ? resolvedPath
    : path.resolve(repoRoot, resolvedPath);

  // Check if worktree path already exists
  if (fs.existsSync(worktreePath)) {
    return {
      success: false,
      branch: branchName,
      worktreePath,
      sprintDir: '',
      branchCreated: false,
      error: `Directory already exists: ${worktreePath}`,
      suggestion: 'Choose a different worktree path in SPRINT.yaml or remove the existing directory.',
    };
  }

  // Check branch status
  const branchCheck = checkBranchExists(branchName, repoRoot);

  if (branchCheck.exists) {
    if (branchCheck.hasWorktree) {
      return {
        success: false,
        branch: branchName,
        worktreePath,
        sprintDir: '',
        branchCreated: false,
        error: `Branch '${branchName}' already has a worktree at: ${branchCheck.worktreePath}`,
        suggestion: 'Use a different branch name or remove the existing worktree with: git worktree remove <path>',
      };
    }

    if (!reuseExistingBranch) {
      return {
        success: false,
        branch: branchName,
        worktreePath,
        sprintDir: '',
        branchCreated: false,
        error: `Branch '${branchName}' already exists`,
        suggestion: 'Run with --reuse-branch to use the existing branch, or choose a different branch name.',
      };
    }
    // If reuseExistingBranch is true, we continue and use the existing branch
  } else {
    // Create new branch
    const branchResult = createBranch(branchName, repoRoot, baseBranch);
    if (!branchResult.success) {
      return {
        success: false,
        branch: branchName,
        worktreePath,
        sprintDir: '',
        branchCreated: false,
        error: `Failed to create branch '${branchName}': ${branchResult.error}`,
        suggestion: 'Check if the base branch exists and you have write permissions.',
      };
    }
  }

  // Create git worktree
  const worktreeResult = createGitWorktree(worktreePath, branchName, repoRoot);
  if (!worktreeResult.success) {
    return {
      success: false,
      branch: branchName,
      worktreePath,
      sprintDir: '',
      branchCreated: !branchCheck.exists,
      error: `Failed to create worktree: ${worktreeResult.error}`,
      suggestion: 'Ensure the path is valid and you have write permissions. Check git worktree list for conflicts.',
    };
  }

  // Create sprint directory structure in the new worktree
  const sprintDir = path.join(worktreePath, '.claude', 'sprints', sprintId);
  try {
    fs.mkdirSync(sprintDir, { recursive: true });
    fs.mkdirSync(path.join(sprintDir, 'context'), { recursive: true });
    fs.mkdirSync(path.join(sprintDir, 'artifacts'), { recursive: true });
  } catch (err) {
    const error = err as { message?: string };
    return {
      success: false,
      branch: branchName,
      worktreePath,
      sprintDir,
      branchCreated: !branchCheck.exists,
      error: `Failed to create sprint directory structure: ${error.message}`,
      suggestion: 'Check write permissions in the worktree directory.',
    };
  }

  return {
    success: true,
    branch: branchName,
    worktreePath,
    sprintDir,
    branchCreated: !branchCheck.exists,
  };
}

/**
 * Build the worktree section for PROGRESS.yaml
 */
export function buildWorktreeProgressSection(
  result: CreateWorktreeResult,
  config: WorktreeConfig
): {
  enabled: boolean;
  branch: string;
  path: string;
  'working-dir': string;
  'created-at': string;
  cleanup: 'never' | 'on-complete' | 'on-merge';
} {
  return {
    enabled: true,
    branch: result.branch,
    path: result.worktreePath,
    'working-dir': result.worktreePath,
    'created-at': new Date().toISOString(),
    cleanup: config.cleanup || 'on-complete',
  };
}

/**
 * Format user-facing message for successful worktree creation
 */
export function formatWorktreeSuccessMessage(
  result: CreateWorktreeResult,
  baseBranch: string
): string {
  const branchAction = result.branchCreated ? 'created from' : 'reused, originally from';

  return `
Creating dedicated worktree for sprint...

Branch: ${result.branch} (${branchAction} ${baseBranch})
Worktree: ${result.worktreePath}
Sprint Dir: ${result.sprintDir}

Sprint initialized in worktree. Run:
  cd ${result.worktreePath}
  /run-sprint .claude/sprints/${path.basename(result.sprintDir)}
`.trim();
}

/**
 * Format user-facing error message for failed worktree creation
 */
export function formatWorktreeErrorMessage(result: CreateWorktreeResult): string {
  let message = `Failed to create worktree: ${result.error}`;
  if (result.suggestion) {
    message += `\n\nSuggestion: ${result.suggestion}`;
  }
  return message;
}

// ============================================================================
// Worktree Detection and Isolation
// ============================================================================

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
 * Calculate a unique hash identifier for a path.
 * Uses a simple hash function (djb2) for portability - no crypto dependency.
 *
 * @param path - The path to hash
 * @returns 12-character hexadecimal hash
 */
function hashPath(pathStr: string): string {
  // djb2 hash algorithm - simple and portable
  let hash = 5381;
  for (let i = 0; i < pathStr.length; i++) {
    hash = (hash * 33) ^ pathStr.charCodeAt(i);
  }
  // Convert to unsigned 32-bit and then to hex, pad to 8 chars
  const hex1 = (hash >>> 0).toString(16).padStart(8, '0');
  // Hash again with different seed for more uniqueness
  hash = 5381;
  for (let i = pathStr.length - 1; i >= 0; i--) {
    hash = (hash * 33) ^ pathStr.charCodeAt(i);
  }
  const hex2 = (hash >>> 0).toString(16).padStart(8, '0');
  // Combine and take first 12 chars
  return (hex1 + hex2).slice(0, 12);
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
export function getWorktreeInfo(cwd: string): WorktreeInfo {
  // Get the worktree root (not just repo root)
  // git rev-parse --show-toplevel returns the worktree root in worktrees
  const worktreeResult = execGit('git rev-parse --show-toplevel', cwd);
  if (!worktreeResult.success) {
    // Not in a git repository at all
    return {
      isWorktree: false,
      path: cwd,
      id: hashPath(cwd),
      mainWorktreePath: cwd,
    };
  }

  const worktreePath = worktreeResult.output;

  // Get the git common directory (shared .git folder for worktrees)
  // For main repo: same as .git directory
  // For worktree: points to main repo's .git directory
  const gitCommonDirResult = execGit('git rev-parse --git-common-dir', cwd);
  const gitDirResult = execGit('git rev-parse --git-dir', cwd);

  if (!gitCommonDirResult.success || !gitDirResult.success) {
    // Shouldn't happen if --show-toplevel worked, but handle gracefully
    return {
      isWorktree: false,
      path: worktreePath,
      id: hashPath(worktreePath),
      mainWorktreePath: worktreePath,
    };
  }

  const gitCommonDir = path.resolve(cwd, gitCommonDirResult.output);
  const gitDir = path.resolve(cwd, gitDirResult.output);

  // If git-dir and git-common-dir are different, we're in a worktree
  // In a worktree, git-dir is like .git/worktrees/<name>
  // while git-common-dir points to the main .git
  const isWorktree = gitDir !== gitCommonDir;

  // The main worktree path is one level up from the common .git directory
  // e.g., if gitCommonDir is /main-repo/.git, mainWorktreePath is /main-repo
  const mainWorktreePath = isWorktree
    ? path.dirname(gitCommonDir)
    : worktreePath;

  return {
    isWorktree,
    path: worktreePath,
    id: hashPath(worktreePath),
    mainWorktreePath,
  };
}

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
export function validateWorktreeIsolation(
  sprintDir: string,
  cwd: string = sprintDir
): boolean {
  const info = getWorktreeInfo(cwd);

  // Resolve sprint directory to absolute path and normalize symlinks (macOS /var -> /private/var)
  let absoluteSprintDir: string;
  try {
    absoluteSprintDir = fs.realpathSync(path.resolve(sprintDir));
  } catch {
    // Sprint dir doesn't exist yet - resolve path without following symlinks
    absoluteSprintDir = path.resolve(sprintDir);
  }

  // Check that sprint directory is under the worktree path
  // This ensures .claude/sprints/ is worktree-local, not shared
  // Normalize worktree path to handle symlinks
  let worktreePath: string;
  try {
    worktreePath = fs.realpathSync(path.resolve(info.path));
  } catch {
    worktreePath = path.resolve(info.path);
  }

  // Sprint dir should start with worktree path
  if (!absoluteSprintDir.startsWith(worktreePath + path.sep) &&
      absoluteSprintDir !== worktreePath) {
    return false;
  }

  // Additional check: ensure we're not using a sprint dir from main worktree
  // when running in a linked worktree
  if (info.isWorktree) {
    let mainWorktreePath: string;
    try {
      mainWorktreePath = fs.realpathSync(path.resolve(info.mainWorktreePath));
    } catch {
      mainWorktreePath = path.resolve(info.mainWorktreePath);
    }
    if (absoluteSprintDir.startsWith(mainWorktreePath + path.sep) &&
        !absoluteSprintDir.startsWith(worktreePath + path.sep)) {
      // Sprint dir is in main worktree, not current worktree - isolation violation
      return false;
    }
  }

  return true;
}

/**
 * Build worktree metadata fields for PROGRESS.yaml.
 *
 * These fields are added to PROGRESS.yaml on sprint start to track
 * which worktree the sprint is running in.
 *
 * @param cwd - Current working directory
 * @returns Object with worktree-id and worktree-path fields
 */
export function buildWorktreeMetadata(cwd: string): {
  'worktree-id': string;
  'worktree-path': string;
  'is-worktree': boolean;
} {
  const info = getWorktreeInfo(cwd);
  return {
    'worktree-id': info.id,
    'worktree-path': info.path,
    'is-worktree': info.isWorktree,
  };
}

// ============================================================================
// Project Root Detection
// ============================================================================

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
export function getProjectRoot(sprintDir: string): string {
  // Try to find git repository root first
  const gitRoot = getRepoRoot(sprintDir);
  if (gitRoot) {
    return gitRoot;
  }

  // Fallback: traverse up to find .claude directory
  let currentDir = path.resolve(sprintDir);
  const rootDir = path.parse(currentDir).root;

  while (currentDir !== rootDir) {
    // Check if we're inside .claude/sprints/xxx structure
    const parentDir = path.dirname(currentDir);

    if (path.basename(parentDir) === 'sprints' && path.basename(path.dirname(parentDir)) === '.claude') {
      // We're at sprintDir, project root is 3 levels up
      return path.dirname(path.dirname(parentDir));
    }

    // Check if .claude exists at current level
    const claudeDir = path.join(currentDir, '.claude');
    if (fs.existsSync(claudeDir) && fs.statSync(claudeDir).isDirectory()) {
      return currentDir;
    }

    currentDir = parentDir;
  }

  // Final fallback: assume sprint is at .claude/sprints/xxx, so project is 3 levels up
  const defaultRoot = path.resolve(sprintDir, '..', '..', '..');
  if (fs.existsSync(defaultRoot)) {
    return defaultRoot;
  }

  // Ultimate fallback: return sprint directory itself
  return sprintDir;
}
