"use strict";
/**
 * Tests for worktree configuration extraction from workflows
 *
 * These tests verify that worktree config is properly extracted from
 * workflow definitions and inherited by sprints.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const worktree_config_js_1 = require("./worktree-config.js");
// Simple test runner
function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`); // intentional
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
        throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}
// ============================================================================
// extractWorktreeConfig tests
// ============================================================================
test('extractWorktreeConfig: extracts worktree config from workflow with enabled: true', () => {
    const workflow = {
        name: 'plugin-development',
        phases: [{ id: 'phase-1', prompt: 'Do something' }],
        worktree: {
            enabled: true,
            'branch-prefix': 'sprint/',
            'path-prefix': 'trees/'
        }
    };
    const config = (0, worktree_config_js_1.extractWorktreeConfig)(workflow);
    assert(config !== undefined, 'Should return worktree config');
    assertEqual(config.enabled, true, 'enabled should be true');
    assertEqual(config['branch-prefix'], 'sprint/', 'branch-prefix should match');
    assertEqual(config['path-prefix'], 'trees/', 'path-prefix should match');
});
test('extractWorktreeConfig: returns undefined when no worktree section', () => {
    const workflow = {
        name: 'simple-workflow',
        phases: [{ id: 'phase-1', prompt: 'Do something' }]
    };
    const config = (0, worktree_config_js_1.extractWorktreeConfig)(workflow);
    assertEqual(config, undefined, 'Should return undefined for no worktree section');
});
test('extractWorktreeConfig: returns config when worktree.enabled is false', () => {
    const workflow = {
        name: 'no-worktree-workflow',
        phases: [{ id: 'phase-1', prompt: 'Do something' }],
        worktree: {
            enabled: false
        }
    };
    const config = (0, worktree_config_js_1.extractWorktreeConfig)(workflow);
    assert(config !== undefined, 'Should return worktree config');
    assertEqual(config.enabled, false, 'enabled should be false');
});
// ============================================================================
// shouldCreateWorktree tests
// ============================================================================
test('shouldCreateWorktree: returns true when workflow has worktree.enabled: true', () => {
    const workflow = {
        name: 'plugin-development',
        phases: [{ id: 'phase-1', prompt: 'Do something' }],
        worktree: {
            enabled: true,
            'branch-prefix': 'sprint/'
        }
    };
    const sprint = {
        workflow: 'plugin-development'
    };
    const result = (0, worktree_config_js_1.shouldCreateWorktree)(sprint, workflow);
    assertEqual(result, true, 'Should return true when workflow enables worktree');
});
test('shouldCreateWorktree: returns false when workflow has no worktree section', () => {
    const workflow = {
        name: 'simple-workflow',
        phases: [{ id: 'phase-1', prompt: 'Do something' }]
    };
    const sprint = {
        workflow: 'simple-workflow'
    };
    const result = (0, worktree_config_js_1.shouldCreateWorktree)(sprint, workflow);
    assertEqual(result, false, 'Should return false when no worktree config');
});
test('shouldCreateWorktree: returns false when workflow has worktree.enabled: false', () => {
    const workflow = {
        name: 'no-worktree-workflow',
        phases: [{ id: 'phase-1', prompt: 'Do something' }],
        worktree: {
            enabled: false
        }
    };
    const sprint = {
        workflow: 'no-worktree-workflow'
    };
    const result = (0, worktree_config_js_1.shouldCreateWorktree)(sprint, workflow);
    assertEqual(result, false, 'Should return false when worktree explicitly disabled');
});
test('shouldCreateWorktree: sprint worktree config overrides workflow config', () => {
    const workflow = {
        name: 'plugin-development',
        phases: [{ id: 'phase-1', prompt: 'Do something' }],
        worktree: {
            enabled: true
        }
    };
    const sprint = {
        workflow: 'plugin-development',
        worktree: {
            enabled: false
        }
    };
    const result = (0, worktree_config_js_1.shouldCreateWorktree)(sprint, workflow);
    assertEqual(result, false, 'Sprint worktree config should override workflow');
});
test('shouldCreateWorktree: sprint can enable worktree even when workflow has none', () => {
    const workflow = {
        name: 'simple-workflow',
        phases: [{ id: 'phase-1', prompt: 'Do something' }]
    };
    const sprint = {
        workflow: 'simple-workflow',
        worktree: {
            enabled: true
        }
    };
    const result = (0, worktree_config_js_1.shouldCreateWorktree)(sprint, workflow);
    assertEqual(result, true, 'Sprint can enable worktree independently');
});
// ============================================================================
// resolveWorktreePath tests
// ============================================================================
test('resolveWorktreePath: uses workflow prefix with sprint-id substitution', () => {
    const workflowDefaults = {
        enabled: true,
        'branch-prefix': 'sprint/',
        'path-prefix': '../worktrees/'
    };
    const sprintId = '2026-01-29_my-sprint';
    const result = (0, worktree_config_js_1.resolveWorktreePath)(sprintId, workflowDefaults, undefined);
    assertEqual(result.branch, 'sprint/2026-01-29_my-sprint', 'Branch should use prefix + sprint-id');
    assertEqual(result.path, '../worktrees/2026-01-29_my-sprint', 'Path should use prefix + sprint-id');
});
test('resolveWorktreePath: sprint config overrides workflow defaults', () => {
    const workflowDefaults = {
        enabled: true,
        'branch-prefix': 'sprint/',
        'path-prefix': '../worktrees/'
    };
    const sprintWorktree = {
        enabled: true,
        branch: 'feature/custom-branch',
        path: '/custom/path'
    };
    const sprintId = '2026-01-29_my-sprint';
    const result = (0, worktree_config_js_1.resolveWorktreePath)(sprintId, workflowDefaults, sprintWorktree);
    assertEqual(result.branch, 'feature/custom-branch', 'Sprint branch should override workflow');
    assertEqual(result.path, '/custom/path', 'Sprint path should override workflow');
});
test('resolveWorktreePath: applies defaults when no workflow config', () => {
    const sprintId = '2026-01-29_my-sprint';
    const result = (0, worktree_config_js_1.resolveWorktreePath)(sprintId, undefined, { enabled: true });
    assertEqual(result.branch, 'sprint/2026-01-29_my-sprint', 'Should use default branch prefix');
    assertEqual(result.path, '../2026-01-29_my-sprint-worktree', 'Should use default path pattern');
});
test('resolveWorktreePath: supports variable substitution in sprint branch', () => {
    const sprintWorktree = {
        enabled: true,
        branch: 'sprint/{sprint-name}',
        path: '../worktrees/{date}'
    };
    const sprintId = '2026-01-29_my-sprint';
    const result = (0, worktree_config_js_1.resolveWorktreePath)(sprintId, undefined, sprintWorktree);
    assertEqual(result.branch, 'sprint/my-sprint', 'Should substitute sprint-name');
    assertEqual(result.path, '../worktrees/2026-01-29', 'Should substitute date');
});
// ============================================================================
// mergeWorktreeConfigs tests
// ============================================================================
test('mergeWorktreeConfigs: returns undefined when neither has worktree', () => {
    const workflow = {
        name: 'simple-workflow',
        phases: [{ id: 'phase-1', prompt: 'Do something' }]
    };
    const sprint = {
        workflow: 'simple-workflow'
    };
    const result = (0, worktree_config_js_1.mergeWorktreeConfigs)('2026-01-29_test', sprint, workflow);
    assertEqual(result, undefined, 'Should return undefined when no worktree config');
});
test('mergeWorktreeConfigs: uses workflow defaults when sprint has none', () => {
    const workflow = {
        name: 'plugin-development',
        phases: [{ id: 'phase-1', prompt: 'Do something' }],
        worktree: {
            enabled: true,
            'branch-prefix': 'sprint/',
            'path-prefix': '../worktrees/',
            cleanup: 'on-complete'
        }
    };
    const sprint = {
        workflow: 'plugin-development'
    };
    const result = (0, worktree_config_js_1.mergeWorktreeConfigs)('2026-01-29_test', sprint, workflow);
    assert(result !== undefined, 'Should return merged config');
    assertEqual(result.enabled, true, 'enabled should be true');
    assertEqual(result.branch, 'sprint/2026-01-29_test', 'branch should use workflow prefix');
    assertEqual(result.path, '../worktrees/2026-01-29_test', 'path should use workflow prefix');
    assertEqual(result.cleanup, 'on-complete', 'cleanup should match workflow');
});
test('mergeWorktreeConfigs: sprint values override workflow defaults', () => {
    const workflow = {
        name: 'plugin-development',
        phases: [{ id: 'phase-1', prompt: 'Do something' }],
        worktree: {
            enabled: true,
            'branch-prefix': 'sprint/',
            'path-prefix': '../worktrees/',
            cleanup: 'on-complete'
        }
    };
    const sprint = {
        workflow: 'plugin-development',
        worktree: {
            enabled: true,
            branch: 'custom/branch',
            path: '/absolute/path',
            cleanup: 'never'
        }
    };
    const result = (0, worktree_config_js_1.mergeWorktreeConfigs)('2026-01-29_test', sprint, workflow);
    assert(result !== undefined, 'Should return merged config');
    assertEqual(result.branch, 'custom/branch', 'branch should use sprint value');
    assertEqual(result.path, '/absolute/path', 'path should use sprint value');
    assertEqual(result.cleanup, 'never', 'cleanup should use sprint value');
});
test('mergeWorktreeConfigs: disabled in sprint overrides enabled in workflow', () => {
    const workflow = {
        name: 'plugin-development',
        phases: [{ id: 'phase-1', prompt: 'Do something' }],
        worktree: {
            enabled: true,
            'branch-prefix': 'sprint/'
        }
    };
    const sprint = {
        workflow: 'plugin-development',
        worktree: {
            enabled: false
        }
    };
    const result = (0, worktree_config_js_1.mergeWorktreeConfigs)('2026-01-29_test', sprint, workflow);
    assertEqual(result, undefined, 'Should return undefined when sprint disables worktree');
});
console.log('\nWorktree config tests complete'); // intentional
//# sourceMappingURL=worktree-config.test.js.map