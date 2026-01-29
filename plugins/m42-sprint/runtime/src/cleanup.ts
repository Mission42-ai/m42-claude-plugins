/**
 * Worktree Cleanup Module for Sprint Lifecycle Management
 *
 * Handles cleanup of git worktrees when sprints complete or are explicitly cleaned up.
 * Supports multiple cleanup modes: never, on-complete, on-merge.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import { getRepoRoot } from './worktree.js';
import { readSprintProgress, listAllWorktrees, SprintProgress } from './status.js';

// ============================================================================
// Type Definitions (copied from compiler for ESM compatibility)
// ============================================================================

/** Cleanup mode for worktrees */
export type WorktreeCleanup = 'never' | 'on-complete' | 'on-merge';

/**
 * Compiled worktree configuration in PROGRESS.yaml
 * Contains resolved paths and runtime state
 */
export interface CompiledWorktreeConfig {
  /** Whether worktree is enabled */
  enabled: boolean;
  /** Resolved branch name (variables substituted) */
  branch: string;
  /** Resolved worktree path (variables substituted) */
  path: string;
  /** Cleanup mode */
  cleanup: WorktreeCleanup;
  /** When the worktree was created (ISO timestamp) */
  'created-at'?: string;
  /** Whether worktree has been cleaned up */
  'cleaned-up'?: boolean;
  /** Working directory for Claude execution (worktree root or sprint dir) */
  'working-dir'?: string;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Result of checking if cleanup is safe to proceed
 */
export interface CleanupSafetyCheck {
  /** Whether cleanup can proceed */
  safe: boolean;
  /** Reason if not safe */
  reason?: string;
  /** Details about the issue */
  details?: string;
  /** Whether --force can override this check */
  forceOverridable: boolean;
}

/**
 * Options for cleanup operation
 */
export interface CleanupOptions {
  /** Skip confirmation prompts and safety checks (use with caution) */
  force?: boolean;
  /** Keep the git branch after removing worktree */
  keepBranch?: boolean;
  /** Archive sprint directory before removal */
  archive?: boolean;
  /** Dry run - show what would be done without doing it */
  dryRun?: boolean;
}

/**
 * Cleanup action that was or will be performed
 */
export interface CleanupAction {
  /** Type of action */
  type: 'worktree-remove' | 'branch-delete' | 'archive' | 'skip';
  /** Human-readable description */
  description: string;
  /** Whether action was successful */
  success?: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Result of cleanup operation
 */
export interface CleanupResult {
  /** Whether cleanup succeeded overall */
  success: boolean;
  /** Sprint ID that was cleaned up */
  sprintId: string;
  /** Actions that were performed */
  actions: CleanupAction[];
  /** Summary message */
  summary: string;
  /** Warning messages */
  warnings: string[];
  /** Error message if failed */
  error?: string;
}

/**
 * Information gathered for cleanup decision
 */
export interface CleanupContext {
  /** Sprint ID */
  sprintId: string;
  /** Sprint directory path */
  sprintDir: string;
  /** Sprint status from PROGRESS.yaml */
  status: SprintProgress['status'];
  /** Worktree configuration from PROGRESS.yaml */
  worktreeConfig: CompiledWorktreeConfig | null;
  /** Worktree path (if applicable) */
  worktreePath: string | null;
  /** Branch name (if applicable) */
  branch: string | null;
  /** Whether worktree has uncommitted changes */
  hasUncommittedChanges: boolean;
  /** Whether branch has unpushed commits */
  hasUnpushedCommits: boolean;
  /** Whether branch is merged to main */
  isMergedToMain: boolean;
  /** Repository root path */
  repoRoot: string;
}

// ============================================================================
// Terminal States
// ============================================================================

/**
 * Sprint states that are considered terminal (sprint is done)
 */
export const TERMINAL_STATES: SprintProgress['status'][] = [
  'completed',
  'blocked',
  'paused',
];

/**
 * Check if a sprint status is a terminal state
 */
export function isTerminalState(status: SprintProgress['status']): boolean {
  return TERMINAL_STATES.includes(status);
}

// ============================================================================
// Git Operations
// ============================================================================

/**
 * Execute a git command and return output
 */
function execGit(
  command: string,
  cwd: string
): { success: boolean; output: string; error?: string } {
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
    return { success: false, output: '', error: errorMsg };
  }
}

/**
 * Check if worktree has uncommitted changes
 */
export function hasUncommittedChanges(worktreePath: string): boolean {
  const result = execGit('git status --porcelain', worktreePath);
  if (!result.success) {
    // If we can't check, assume there are changes (safer)
    return true;
  }
  return result.output.length > 0;
}

/**
 * Check if branch has commits not pushed to remote
 */
export function hasUnpushedCommits(branch: string, cwd: string): boolean {
  // Get the upstream branch
  const upstreamResult = execGit(`git rev-parse --abbrev-ref ${branch}@{upstream}`, cwd);

  if (!upstreamResult.success) {
    // No upstream configured - all commits are "unpushed"
    return true;
  }

  // Check for commits ahead of upstream
  const aheadResult = execGit(`git rev-list --count ${upstreamResult.output}..${branch}`, cwd);

  if (!aheadResult.success) {
    return true;
  }

  return parseInt(aheadResult.output, 10) > 0;
}

/**
 * Check if branch is merged into main/master
 */
export function isBranchMerged(branch: string, cwd: string): boolean {
  // Try main first, then master
  let baseBranch = 'main';
  const mainCheck = execGit('git rev-parse --verify refs/heads/main', cwd);
  if (!mainCheck.success) {
    baseBranch = 'master';
    const masterCheck = execGit('git rev-parse --verify refs/heads/master', cwd);
    if (!masterCheck.success) {
      // Can't determine base branch - assume not merged
      return false;
    }
  }

  // Check if branch is merged into base
  const mergedResult = execGit(`git branch --merged ${baseBranch}`, cwd);
  if (!mergedResult.success) {
    return false;
  }

  // Parse merged branches list
  const mergedBranches = mergedResult.output
    .split('\n')
    .map(b => b.trim().replace(/^\*\s*/, ''));

  return mergedBranches.includes(branch);
}

/**
 * Remove a git worktree
 */
export function removeWorktree(
  worktreePath: string,
  cwd: string,
  force: boolean = false
): { success: boolean; error?: string } {
  const forceFlag = force ? ' --force' : '';
  const result = execGit(`git worktree remove "${worktreePath}"${forceFlag}`, cwd);
  return { success: result.success, error: result.error };
}

/**
 * Delete a git branch
 */
export function deleteBranch(
  branch: string,
  cwd: string,
  force: boolean = false
): { success: boolean; error?: string } {
  const flag = force ? '-D' : '-d';
  const result = execGit(`git branch ${flag} ${branch}`, cwd);
  return { success: result.success, error: result.error };
}

/**
 * Prune worktrees that have been removed from disk
 */
export function pruneWorktrees(cwd: string): { success: boolean; error?: string } {
  const result = execGit('git worktree prune', cwd);
  return { success: result.success, error: result.error };
}

// ============================================================================
// Context Gathering
// ============================================================================

/**
 * Gather all information needed for cleanup decision
 */
export function gatherCleanupContext(sprintDir: string): CleanupContext | null {
  // Read PROGRESS.yaml
  const { progress, error } = readSprintProgress(sprintDir);
  if (!progress || error) {
    return null;
  }

  // Get repository root
  const repoRoot = getRepoRoot(sprintDir);
  if (!repoRoot) {
    return null;
  }

  // Extract worktree config from progress
  const worktreeConfig = (progress as unknown as { worktree?: CompiledWorktreeConfig }).worktree || null;

  // Determine worktree path and branch
  let worktreePath: string | null = null;
  let branch: string | null = null;

  if (worktreeConfig?.enabled) {
    worktreePath = worktreeConfig.path;
    branch = worktreeConfig.branch;
  }

  // Check for uncommitted changes (only if worktree exists)
  let uncommittedChanges = false;
  if (worktreePath && fs.existsSync(worktreePath)) {
    uncommittedChanges = hasUncommittedChanges(worktreePath);
  }

  // Check for unpushed commits (only if branch exists)
  let unpushedCommits = false;
  if (branch) {
    unpushedCommits = hasUnpushedCommits(branch, repoRoot);
  }

  // Check if merged to main
  let mergedToMain = false;
  if (branch) {
    mergedToMain = isBranchMerged(branch, repoRoot);
  }

  return {
    sprintId: progress['sprint-id'],
    sprintDir,
    status: progress.status,
    worktreeConfig,
    worktreePath,
    branch,
    hasUncommittedChanges: uncommittedChanges,
    hasUnpushedCommits: unpushedCommits,
    isMergedToMain: mergedToMain,
    repoRoot,
  };
}

// ============================================================================
// Safety Checks
// ============================================================================

/**
 * Perform safety checks before cleanup
 */
export function performSafetyChecks(
  context: CleanupContext,
  options: CleanupOptions = {}
): CleanupSafetyCheck {
  const { force = false } = options;

  // Check 1: Sprint must be in terminal state
  if (!isTerminalState(context.status) && context.status !== 'pending') {
    return {
      safe: false,
      reason: `Sprint is ${context.status}`,
      details: 'Cannot clean up a sprint that is still in progress. Wait for completion or stop the sprint first.',
      forceOverridable: false,
    };
  }

  // Check 2: No uncommitted changes in worktree
  if (context.hasUncommittedChanges && !force) {
    return {
      safe: false,
      reason: 'Worktree has uncommitted changes',
      details: `There are uncommitted changes in ${context.worktreePath}. Commit or stash changes first, or use --force to discard them.`,
      forceOverridable: true,
    };
  }

  // Check 3: No unpushed commits (warn but allow with --force)
  if (context.hasUnpushedCommits && !force) {
    return {
      safe: false,
      reason: 'Branch has unpushed commits',
      details: `Branch ${context.branch} has commits that haven't been pushed to remote. Push changes first, or use --force to proceed anyway.`,
      forceOverridable: true,
    };
  }

  // All checks passed
  return {
    safe: true,
    forceOverridable: false,
  };
}

// ============================================================================
// Cleanup Logic
// ============================================================================

/**
 * Determine if automatic cleanup should run based on config and state
 */
export function shouldAutoCleanup(
  context: CleanupContext
): { shouldCleanup: boolean; reason: string } {
  if (!context.worktreeConfig?.enabled) {
    return {
      shouldCleanup: false,
      reason: 'No worktree configuration',
    };
  }

  const cleanup = context.worktreeConfig.cleanup || 'on-complete';

  switch (cleanup) {
    case 'never':
      return {
        shouldCleanup: false,
        reason: 'Cleanup mode is "never"',
      };

    case 'on-complete':
      if (context.status === 'completed') {
        return {
          shouldCleanup: true,
          reason: 'Sprint completed and cleanup mode is "on-complete"',
        };
      }
      return {
        shouldCleanup: false,
        reason: `Sprint status is ${context.status}, not completed`,
      };

    case 'on-merge':
      if (context.isMergedToMain) {
        return {
          shouldCleanup: true,
          reason: 'Branch merged to main and cleanup mode is "on-merge"',
        };
      }
      return {
        shouldCleanup: false,
        reason: 'Branch not yet merged to main',
      };

    default:
      return {
        shouldCleanup: false,
        reason: `Unknown cleanup mode: ${cleanup}`,
      };
  }
}

/**
 * Archive sprint directory to .claude/sprints/archive/
 */
export function archiveSprint(
  sprintDir: string,
  repoRoot: string
): { success: boolean; archivePath?: string; error?: string } {
  const sprintId = path.basename(sprintDir);
  const archiveDir = path.join(repoRoot, '.claude', 'sprints', 'archive');
  const archivePath = path.join(archiveDir, sprintId);

  try {
    // Create archive directory if needed
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    // Check if archive already exists
    if (fs.existsSync(archivePath)) {
      return {
        success: false,
        error: `Archive already exists: ${archivePath}`,
      };
    }

    // Copy sprint directory to archive
    fs.cpSync(sprintDir, archivePath, { recursive: true });

    return { success: true, archivePath };
  } catch (err) {
    const error = err as { message?: string };
    return {
      success: false,
      error: error.message || 'Failed to archive sprint',
    };
  }
}

/**
 * Execute cleanup for a sprint
 */
export function executeCleanup(
  context: CleanupContext,
  options: CleanupOptions = {}
): CleanupResult {
  const { keepBranch = false, archive = false, dryRun = false, force = false } = options;
  const actions: CleanupAction[] = [];
  const warnings: string[] = [];

  // Safety checks
  const safetyCheck = performSafetyChecks(context, options);
  if (!safetyCheck.safe) {
    return {
      success: false,
      sprintId: context.sprintId,
      actions: [],
      summary: '',
      warnings: [],
      error: `${safetyCheck.reason}: ${safetyCheck.details}`,
    };
  }

  // Archive if requested
  if (archive) {
    if (dryRun) {
      actions.push({
        type: 'archive',
        description: `Would archive sprint to .claude/sprints/archive/${context.sprintId}`,
        success: true,
      });
    } else {
      const archiveResult = archiveSprint(context.sprintDir, context.repoRoot);
      actions.push({
        type: 'archive',
        description: archiveResult.success
          ? `Archived to ${archiveResult.archivePath}`
          : 'Failed to archive',
        success: archiveResult.success,
        error: archiveResult.error,
      });
      if (!archiveResult.success) {
        warnings.push(`Archive failed: ${archiveResult.error}`);
      }
    }
  }

  // Remove worktree
  if (context.worktreePath && fs.existsSync(context.worktreePath)) {
    if (dryRun) {
      actions.push({
        type: 'worktree-remove',
        description: `Would remove worktree: ${context.worktreePath}`,
        success: true,
      });
    } else {
      // First, prune any stale worktrees
      pruneWorktrees(context.repoRoot);

      const removeResult = removeWorktree(context.worktreePath, context.repoRoot, force);
      actions.push({
        type: 'worktree-remove',
        description: removeResult.success
          ? `Removed worktree: ${context.worktreePath}`
          : `Failed to remove worktree`,
        success: removeResult.success,
        error: removeResult.error,
      });

      if (!removeResult.success) {
        return {
          success: false,
          sprintId: context.sprintId,
          actions,
          summary: '',
          warnings,
          error: `Failed to remove worktree: ${removeResult.error}`,
        };
      }
    }
  } else if (context.worktreeConfig?.enabled) {
    actions.push({
      type: 'skip',
      description: `Worktree not found at ${context.worktreePath}`,
      success: true,
    });
  }

  // Delete branch if not keeping it
  if (context.branch && !keepBranch) {
    if (dryRun) {
      const mergeNote = context.isMergedToMain ? ' (merged to main)' : '';
      actions.push({
        type: 'branch-delete',
        description: `Would delete branch: ${context.branch}${mergeNote}`,
        success: true,
      });
    } else {
      // Use force delete if branch is not merged and user specified --force
      const forceDelete = !context.isMergedToMain && force;
      const deleteResult = deleteBranch(context.branch, context.repoRoot, forceDelete);

      if (deleteResult.success) {
        const mergeNote = context.isMergedToMain ? ' (was merged to main)' : '';
        actions.push({
          type: 'branch-delete',
          description: `Deleted branch: ${context.branch}${mergeNote}`,
          success: true,
        });
      } else {
        // Branch deletion is not critical - just warn
        warnings.push(`Could not delete branch ${context.branch}: ${deleteResult.error}`);
        actions.push({
          type: 'branch-delete',
          description: `Failed to delete branch: ${context.branch}`,
          success: false,
          error: deleteResult.error,
        });
      }
    }
  } else if (keepBranch && context.branch) {
    actions.push({
      type: 'skip',
      description: `Keeping branch: ${context.branch}`,
      success: true,
    });
  }

  // Build summary
  const actionSummary = actions
    .filter(a => a.type !== 'skip')
    .map(a => (a.success ? '[x]' : '[ ]') + ' ' + a.description)
    .join('\n  ');

  const summary = dryRun
    ? `Dry run - no changes made\n\nActions that would be performed:\n  ${actionSummary}`
    : `Cleanup complete\n\nActions:\n  ${actionSummary}`;

  return {
    success: true,
    sprintId: context.sprintId,
    actions,
    summary,
    warnings,
  };
}

// ============================================================================
// User-Facing Formatting
// ============================================================================

/**
 * Format cleanup result for user display
 */
export function formatCleanupResult(
  result: CleanupResult,
  context: CleanupContext
): string {
  const lines: string[] = [];

  if (!result.success) {
    lines.push(`Cleanup failed: ${result.error}`);
    return lines.join('\n');
  }

  lines.push('Sprint cleanup complete.');
  lines.push('');
  lines.push(`Worktree: ${context.worktreePath || 'N/A'}`);
  lines.push(`Branch: ${context.branch || 'N/A'}`);
  lines.push(`Status: ${context.status}`);
  lines.push('');
  lines.push('Actions:');

  for (const action of result.actions) {
    const mark = action.success ? '[x]' : '[ ]';
    const desc = action.type === 'worktree-remove'
      ? 'Worktree removed'
      : action.type === 'branch-delete'
        ? context.isMergedToMain
          ? 'Branch deleted (was merged to main)'
          : 'Branch deleted'
        : action.type === 'archive'
          ? 'Sprint archived'
          : action.description;
    lines.push(`  ${mark} ${desc}`);
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format cleanup prompt for user confirmation
 */
export function formatCleanupPrompt(context: CleanupContext): string {
  const lines: string[] = [];

  lines.push('Sprint ready for cleanup.');
  lines.push('');
  lines.push(`Sprint: ${context.sprintId}`);
  lines.push(`Worktree: ${context.worktreePath || 'N/A'}`);
  lines.push(`Branch: ${context.branch || 'N/A'}`);
  lines.push(`Status: ${context.status}`);

  if (context.hasUncommittedChanges) {
    lines.push('');
    lines.push('⚠️  WARNING: Worktree has uncommitted changes');
  }

  if (context.hasUnpushedCommits) {
    lines.push('');
    lines.push('⚠️  WARNING: Branch has unpushed commits');
  }

  lines.push('');
  lines.push('Cleanup will:');
  lines.push(`  - Remove worktree at ${context.worktreePath}`);

  if (context.isMergedToMain) {
    lines.push(`  - Delete branch ${context.branch} (already merged to main)`);
  } else {
    lines.push(`  - Delete branch ${context.branch}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Discovery
// ============================================================================

/**
 * Find sprints that are eligible for cleanup
 */
export function findCleanableWorktrees(repoRoot: string): CleanupContext[] {
  const worktrees = listAllWorktrees(repoRoot);
  const cleanable: CleanupContext[] = [];

  for (const worktree of worktrees) {
    if (worktree.isMain) continue; // Skip main worktree

    // Find sprint directory in this worktree
    const sprintsDir = path.join(worktree.path, '.claude', 'sprints');
    if (!fs.existsSync(sprintsDir)) continue;

    try {
      const entries = fs.readdirSync(sprintsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'archive') continue; // Skip archive directory

        const sprintDir = path.join(sprintsDir, entry.name);
        const progressFile = path.join(sprintDir, 'PROGRESS.yaml');

        if (!fs.existsSync(progressFile)) continue;

        const context = gatherCleanupContext(sprintDir);
        if (!context) continue;

        // Check if this sprint is eligible for cleanup
        const { shouldCleanup } = shouldAutoCleanup(context);
        if (shouldCleanup || isTerminalState(context.status)) {
          cleanable.push(context);
        }
      }
    } catch {
      // Ignore errors reading directories
    }
  }

  return cleanable;
}
