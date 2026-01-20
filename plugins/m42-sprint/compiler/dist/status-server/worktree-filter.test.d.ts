/**
 * Tests for worktree filter - BUG-002: Worktree Filter Shows No Sprints
 *
 * Issue: When selecting a worktree from the filter dropdown (except "All Worktrees"),
 * no sprints are shown in the list.
 *
 * ROOT CAUSE:
 * The server-side dashboard HTML generation was creating SprintScanner
 * WITHOUT includeWorktreeInfo: true, causing a mismatch between:
 * - API worktree names (normalized to "main" for main worktree)
 * - Row data-worktree attributes (directory basename like "m42-claude-plugins")
 *
 * FIX APPLIED:
 * In server.ts handleDashboardPageRequest(), SprintScanner now uses
 * { includeWorktreeInfo: true }, ensuring worktree.name is properly normalized.
 *
 * These tests verify:
 * 1. The fallback behavior when worktree info is missing (returns directory basename)
 * 2. The correct behavior when worktree info is present (uses normalized name)
 * 3. Filter matching works correctly in both scenarios
 */
export {};
//# sourceMappingURL=worktree-filter.test.d.ts.map