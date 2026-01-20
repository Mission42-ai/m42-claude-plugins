"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
// Simple test runner (consistent with project patterns)
function test(name, fn) {
    try {
        const result = fn();
        if (result instanceof Promise) {
            result
                .then(() => console.log(`✓ ${name}`))
                .catch((error) => {
                console.error(`✗ ${name}`);
                console.error(`  ${error}`);
                process.exitCode = 1;
            });
        }
        else {
            console.log(`✓ ${name}`);
        }
    }
    catch (error) {
        console.error(`✗ ${name}`);
        console.error(`  ${error}`);
        process.exitCode = 1;
    }
}
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected "${expected}", got "${actual}"`);
    }
}
console.log('\n--- BUG-002: Worktree Filter Shows No Sprints Tests ---\n');
// ============================================================================
// Helper function: extractWorktreeName (simulates dashboard-page.ts)
// This is the problematic path-based extraction that doesn't normalize "main"
// ============================================================================
function extractWorktreeName(sprintPath) {
    if (!sprintPath)
        return 'main';
    const parts = sprintPath.split('/.claude/sprints/');
    if (parts.length > 0) {
        const worktreeRoot = parts[0];
        const basename = worktreeRoot.split('/').pop() || 'main';
        return basename;
    }
    return 'main';
}
// ============================================================================
// Helper function: getWorktreeName (simulates dashboard-page.ts logic)
// ============================================================================
function getWorktreeName(sprint) {
    return sprint.worktree?.name ?? extractWorktreeName(sprint.path);
}
// ============================================================================
// Helper function: getWorktreeNameFromApi (simulates /api/worktrees normalization)
// ============================================================================
function getWorktreeNameFromApi(isMain, directoryName) {
    return isMain ? 'main' : directoryName;
}
// ============================================================================
// Tests: Fallback behavior when worktree info is missing (uses directory basename)
// ============================================================================
test('extractWorktreeName returns directory basename when worktree info is missing', () => {
    // When SprintScanner is created WITHOUT includeWorktreeInfo, it falls back to
    // path extraction, which returns the directory basename (not normalized to "main")
    const sprint = {
        sprintId: '2025-01-20_feature-x',
        path: '/home/user/projects/m42-claude-plugins/.claude/sprints/2025-01-20_feature-x',
        // NO worktree field
    };
    const worktreeName = getWorktreeName(sprint);
    // Fallback behavior: returns directory basename
    assertEqual(worktreeName, 'm42-claude-plugins', 'Without worktree info, should return directory basename');
});
test('filter mismatch occurs when worktree info is missing (documenting old bug behavior)', () => {
    // This documents the problematic scenario that existed before the fix
    // API returns "main" for main worktree, but path extraction returns directory basename
    const apiWorktreeName = getWorktreeNameFromApi(true, 'm42-claude-plugins');
    const filterDropdownValue = apiWorktreeName; // User selects "main"
    const sprint = {
        sprintId: 'sprint-1',
        path: '/home/user/projects/m42-claude-plugins/.claude/sprints/sprint-1',
        // NO worktree field - demonstrates the fallback scenario
    };
    const rowWorktree = getWorktreeName(sprint);
    // Document that WITHOUT worktree info, there's a mismatch
    assertEqual(filterDropdownValue, 'main', 'API returns "main" for main worktree');
    assertEqual(rowWorktree, 'm42-claude-plugins', 'Path extraction returns directory basename');
    // They don't match - this is why the fix uses includeWorktreeInfo: true
    assert(filterDropdownValue !== rowWorktree, 'Without worktree info, filter values mismatch (this is why the fix is needed)');
});
test('path extraction works for linked worktrees (no normalization issue)', () => {
    // Linked worktrees don't have the "main" normalization issue even without worktree info
    const sprint = {
        sprintId: 'sprint-001',
        path: '/home/user/projects/feature-branch/.claude/sprints/sprint-001',
        // NO worktree field
    };
    const worktreeName = getWorktreeName(sprint);
    const apiWorktreeName = getWorktreeNameFromApi(false, 'feature-branch');
    // Both return the same directory name for linked worktrees
    assertEqual(worktreeName, 'feature-branch', 'Path extraction returns directory basename');
    assertEqual(apiWorktreeName, 'feature-branch', 'API returns directory basename for linked worktree');
    assertEqual(worktreeName, apiWorktreeName, 'No mismatch for linked worktrees');
});
// ============================================================================
// Tests that pass when worktree info IS present (the fix scenario)
// ============================================================================
// ============================================================================
// Tests: Correct behavior when worktree info IS present (the fixed scenario)
// ============================================================================
test('filter works correctly when worktree info is included', () => {
    const filterValue = 'main';
    // When SprintScanner has includeWorktreeInfo: true, sprints have worktree field
    // with properly normalized name ("main" for main worktree)
    const sprints = [
        {
            sprintId: 'sprint-001',
            path: '/home/user/projects/awesome-project/.claude/sprints/sprint-001',
            worktree: { name: 'main', branch: 'main', isMain: true },
        },
        {
            sprintId: 'sprint-002',
            path: '/home/user/projects/awesome-project/.claude/sprints/sprint-002',
            worktree: { name: 'main', branch: 'main', isMain: true },
        },
    ];
    const visibleSprints = sprints.filter((sprint) => {
        const worktreeName = getWorktreeName(sprint);
        return filterValue === 'all' || worktreeName === filterValue;
    });
    assertEqual(visibleSprints.length, sprints.length, `All sprints should be visible when worktree info is present`);
});
test('linked worktree filter works with worktree info', () => {
    const filterValue = 'feature-branch';
    const sprint = {
        sprintId: 'sprint-1',
        path: '/home/user/worktrees/feature-branch/.claude/sprints/sprint-1',
        worktree: { name: 'feature-branch', branch: 'feature-x', isMain: false },
    };
    const rowWorktree = getWorktreeName(sprint);
    const shouldShow = filterValue === 'all' || rowWorktree === filterValue;
    assert(shouldShow, `Linked worktree filter should work: filter="${filterValue}", rowWorktree="${rowWorktree}"`);
});
test('"All Worktrees" filter always shows all sprints', () => {
    const filterValue = 'all';
    const sprints = [
        {
            sprintId: 'main-sprint',
            path: '/home/user/projects/repo/.claude/sprints/main-sprint',
            worktree: { name: 'main', branch: 'main', isMain: true },
        },
        {
            sprintId: 'feature-sprint',
            path: '/home/user/worktrees/feature/.claude/sprints/feature-sprint',
            worktree: { name: 'feature', branch: 'feature-x', isMain: false },
        },
    ];
    const visibleSprints = sprints.filter((sprint) => {
        const worktreeName = getWorktreeName(sprint);
        return filterValue === 'all' || worktreeName === filterValue;
    });
    assertEqual(visibleSprints.length, sprints.length, 'All sprints should be visible when "all" is selected');
});
test('mixed worktree filtering works correctly', () => {
    const sprints = [
        {
            sprintId: 'sprint-1',
            path: '/home/user/projects/repo/.claude/sprints/sprint-1',
            worktree: { name: 'main', branch: 'main', isMain: true },
        },
        {
            sprintId: 'sprint-2',
            path: '/home/user/projects/repo/.claude/sprints/sprint-2',
            worktree: { name: 'main', branch: 'main', isMain: true },
        },
        {
            sprintId: 'sprint-3',
            path: '/home/user/worktrees/feature-a/.claude/sprints/sprint-3',
            worktree: { name: 'feature-a', branch: 'feature-a', isMain: false },
        },
    ];
    // Filter for main should show 2 sprints
    const mainFilter = 'main';
    const mainSprints = sprints.filter((sprint) => {
        const worktreeName = getWorktreeName(sprint);
        return mainFilter === 'all' || worktreeName === mainFilter;
    });
    assertEqual(mainSprints.length, 2, 'Should show 2 main worktree sprints');
    // Filter for feature-a should show 1 sprint
    const featureFilter = 'feature-a';
    const featureSprints = sprints.filter((sprint) => {
        const worktreeName = getWorktreeName(sprint);
        return featureFilter === 'all' || worktreeName === featureFilter;
    });
    assertEqual(featureSprints.length, 1, 'Should show 1 feature-a worktree sprint');
});
console.log('\nBUG-002 tests completed.\n');
//# sourceMappingURL=worktree-filter.test.js.map