/**
 * Tests for validation module
 */

import {
  validateWorkflowDefinition,
  validateWorktreeConfig,
  validateWorkflowWorktreeDefaults,
  isValidGitBranchName,
  validateSprintDefinition
} from './validate.js';

// Simple test runner
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`); // intentional
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error}`);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// Tests for empty workflow validation
test('EMPTY_WORKFLOW: should fail when workflow has zero phases', () => {
  const workflow = {
    name: 'empty-workflow',
    phases: []
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  assert(errors.length === 1, `Expected 1 error, got ${errors.length}`);
  assert(errors[0].code === 'EMPTY_WORKFLOW', `Expected EMPTY_WORKFLOW error code, got ${errors[0].code}`);
  assert(errors[0].message.includes('zero phases'), `Expected message to mention 'zero phases'`);
  assert(errors[0].path === 'test-workflow.phases', `Expected path 'test-workflow.phases', got ${errors[0].path}`);
});

test('EMPTY_WORKFLOW: should pass when workflow has phases', () => {
  const workflow = {
    name: 'valid-workflow',
    phases: [
      { id: 'phase-1', prompt: 'Do something' }
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  // Should have no EMPTY_WORKFLOW error
  const emptyWorkflowErrors = errors.filter(e => e.code === 'EMPTY_WORKFLOW');
  assert(emptyWorkflowErrors.length === 0, `Should have no EMPTY_WORKFLOW errors, got ${emptyWorkflowErrors.length}`);
});

test('MISSING_PHASES: should fail when phases array is missing', () => {
  const workflow = {
    name: 'no-phases-workflow'
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const missingPhasesErrors = errors.filter(e => e.code === 'MISSING_PHASES');
  assert(missingPhasesErrors.length === 1, `Expected 1 MISSING_PHASES error, got ${missingPhasesErrors.length}`);
});

// Parallel validation tests
test('INVALID_PARALLEL: should fail when parallel is not boolean', () => {
  const workflow = {
    name: 'invalid-parallel-workflow',
    phases: [
      { id: 'phase-1', prompt: 'Do something', parallel: 'true' } // string instead of boolean
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const parallelErrors = errors.filter(e => e.code === 'INVALID_PARALLEL');
  assert(parallelErrors.length === 1, `Expected 1 INVALID_PARALLEL error, got ${parallelErrors.length}`);
  assert(parallelErrors[0].message.includes('boolean'), `Expected message to mention 'boolean'`);
});

test('INVALID_PARALLEL: should pass when parallel is boolean', () => {
  const workflow = {
    name: 'valid-parallel-workflow',
    phases: [
      { id: 'phase-1', prompt: 'Do something', parallel: true }
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const parallelErrors = errors.filter(e => e.code === 'INVALID_PARALLEL');
  assert(parallelErrors.length === 0, `Should have no INVALID_PARALLEL errors, got ${parallelErrors.length}`);
});

test('INVALID_WAIT_FOR_PARALLEL: should fail when wait-for-parallel is not boolean', () => {
  const workflow = {
    name: 'invalid-wait-workflow',
    phases: [
      { id: 'phase-1', prompt: 'Do something', 'wait-for-parallel': 'yes' } // string instead of boolean
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const waitErrors = errors.filter(e => e.code === 'INVALID_WAIT_FOR_PARALLEL');
  assert(waitErrors.length === 1, `Expected 1 INVALID_WAIT_FOR_PARALLEL error, got ${waitErrors.length}`);
  assert(waitErrors[0].message.includes('boolean'), `Expected message to mention 'boolean'`);
});

test('INVALID_WAIT_FOR_PARALLEL: should pass when wait-for-parallel is boolean', () => {
  const workflow = {
    name: 'valid-wait-workflow',
    phases: [
      { id: 'phase-1', prompt: 'Do something', 'wait-for-parallel': true }
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const waitErrors = errors.filter(e => e.code === 'INVALID_WAIT_FOR_PARALLEL');
  assert(waitErrors.length === 0, `Should have no INVALID_WAIT_FOR_PARALLEL errors, got ${waitErrors.length}`);
});

test('PARALLEL_FOREACH_WARNING: should warn when parallel used with for-each', () => {
  const workflow = {
    name: 'parallel-foreach-workflow',
    phases: [
      { id: 'phase-1', 'for-each': 'step', parallel: true, workflow: 'step-workflow' }
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const warningErrors = errors.filter(e => e.code === 'PARALLEL_FOREACH_WARNING');
  assert(warningErrors.length === 1, `Expected 1 PARALLEL_FOREACH_WARNING error, got ${warningErrors.length}`);
  assert(warningErrors[0].message.includes('for-each'), `Expected message to mention 'for-each'`);
});

test('PARALLEL_FOREACH_WARNING: should not warn when parallel false with for-each', () => {
  const workflow = {
    name: 'parallel-false-foreach-workflow',
    phases: [
      { id: 'phase-1', 'for-each': 'step', parallel: false, workflow: 'step-workflow' }
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const warningErrors = errors.filter(e => e.code === 'PARALLEL_FOREACH_WARNING');
  assert(warningErrors.length === 0, `Should have no PARALLEL_FOREACH_WARNING errors, got ${warningErrors.length}`);
});

// ============================================================================
// Worktree Configuration Validation Tests
// ============================================================================

// Git branch name validation tests
test('isValidGitBranchName: should accept valid branch names', () => {
  assert(isValidGitBranchName('main'), 'main should be valid');
  assert(isValidGitBranchName('feature/auth'), 'feature/auth should be valid');
  assert(isValidGitBranchName('sprint/{sprint-id}'), 'sprint/{sprint-id} should be valid (with variable)');
  assert(isValidGitBranchName('release-1.0'), 'release-1.0 should be valid');
  assert(isValidGitBranchName('user/john/feature'), 'nested paths should be valid');
});

test('isValidGitBranchName: should reject invalid branch names', () => {
  assert(!isValidGitBranchName('/leading-slash'), 'leading slash should be invalid');
  assert(!isValidGitBranchName('trailing-slash/'), 'trailing slash should be invalid');
  assert(!isValidGitBranchName('double//slash'), 'double slash should be invalid');
  assert(!isValidGitBranchName('-starts-with-hyphen'), 'leading hyphen should be invalid');
  assert(!isValidGitBranchName('ends-with.lock'), '.lock suffix should be invalid');
  assert(!isValidGitBranchName('has..dots'), 'consecutive dots should be invalid');
  assert(!isValidGitBranchName('has spaces'), 'spaces should be invalid');
  assert(!isValidGitBranchName('has~tilde'), 'tilde should be invalid');
});

// Sprint worktree config validation tests
test('WORKTREE_MISSING_ENABLED: should fail when enabled is missing', () => {
  const worktree = {
    branch: 'sprint/test'
  };

  const errors = validateWorktreeConfig(worktree, 'worktree');

  const enabledErrors = errors.filter(e => e.code === 'WORKTREE_MISSING_ENABLED');
  assert(enabledErrors.length === 1, `Expected 1 WORKTREE_MISSING_ENABLED error, got ${enabledErrors.length}`);
});

test('WORKTREE_INVALID_ENABLED: should fail when enabled is not boolean', () => {
  const worktree = {
    enabled: 'yes'
  };

  const errors = validateWorktreeConfig(worktree, 'worktree');

  const enabledErrors = errors.filter(e => e.code === 'WORKTREE_INVALID_ENABLED');
  assert(enabledErrors.length === 1, `Expected 1 WORKTREE_INVALID_ENABLED error, got ${enabledErrors.length}`);
});

test('WORKTREE_INVALID_BRANCH: should fail when branch is not string', () => {
  const worktree = {
    enabled: true,
    branch: 123
  };

  const errors = validateWorktreeConfig(worktree, 'worktree');

  const branchErrors = errors.filter(e => e.code === 'WORKTREE_INVALID_BRANCH');
  assert(branchErrors.length === 1, `Expected 1 WORKTREE_INVALID_BRANCH error, got ${branchErrors.length}`);
});

test('WORKTREE_EMPTY_BRANCH: should fail when branch is empty string', () => {
  const worktree = {
    enabled: true,
    branch: '   '
  };

  const errors = validateWorktreeConfig(worktree, 'worktree');

  const emptyErrors = errors.filter(e => e.code === 'WORKTREE_EMPTY_BRANCH');
  assert(emptyErrors.length === 1, `Expected 1 WORKTREE_EMPTY_BRANCH error, got ${emptyErrors.length}`);
});

test('WORKTREE_INVALID_BRANCH_NAME: should fail for invalid git branch names', () => {
  const worktree = {
    enabled: true,
    branch: 'has spaces/invalid'
  };

  const errors = validateWorktreeConfig(worktree, 'worktree');

  const nameErrors = errors.filter(e => e.code === 'WORKTREE_INVALID_BRANCH_NAME');
  assert(nameErrors.length === 1, `Expected 1 WORKTREE_INVALID_BRANCH_NAME error, got ${nameErrors.length}`);
});

test('WORKTREE_INVALID_CLEANUP_MODE: should fail for invalid cleanup mode', () => {
  const worktree = {
    enabled: true,
    cleanup: 'always'
  };

  const errors = validateWorktreeConfig(worktree, 'worktree');

  const cleanupErrors = errors.filter(e => e.code === 'WORKTREE_INVALID_CLEANUP_MODE');
  assert(cleanupErrors.length === 1, `Expected 1 WORKTREE_INVALID_CLEANUP_MODE error, got ${cleanupErrors.length}`);
  assert(cleanupErrors[0].message.includes('never'), 'Error should list valid options');
  assert(cleanupErrors[0].message.includes('on-complete'), 'Error should list valid options');
  assert(cleanupErrors[0].message.includes('on-merge'), 'Error should list valid options');
});

test('validateWorktreeConfig: should pass for valid complete config', () => {
  const worktree = {
    enabled: true,
    branch: 'sprint/{sprint-id}',
    path: '../{sprint-id}-worktree',
    cleanup: 'on-complete'
  };

  const errors = validateWorktreeConfig(worktree, 'worktree');
  assert(errors.length === 0, `Expected no errors, got ${errors.length}: ${errors.map(e => e.code).join(', ')}`);
});

test('validateWorktreeConfig: should pass when worktree is undefined', () => {
  const errors = validateWorktreeConfig(undefined, 'worktree');
  assert(errors.length === 0, `Expected no errors for undefined worktree, got ${errors.length}`);
});

test('validateWorktreeConfig: should pass for minimal valid config', () => {
  const worktree = {
    enabled: false
  };

  const errors = validateWorktreeConfig(worktree, 'worktree');
  assert(errors.length === 0, `Expected no errors, got ${errors.length}: ${errors.map(e => e.code).join(', ')}`);
});

// Workflow worktree defaults validation tests
test('WORKFLOW_WORKTREE_MISSING_ENABLED: should fail when workflow worktree enabled is missing', () => {
  const worktree = {
    'branch-prefix': 'sprint/'
  };

  const errors = validateWorkflowWorktreeDefaults(worktree, 'test-workflow');

  const enabledErrors = errors.filter(e => e.code === 'WORKFLOW_WORKTREE_MISSING_ENABLED');
  assert(enabledErrors.length === 1, `Expected 1 WORKFLOW_WORKTREE_MISSING_ENABLED error, got ${enabledErrors.length}`);
});

test('WORKFLOW_WORKTREE_INVALID_BRANCH_PREFIX: should fail when branch-prefix is not string', () => {
  const worktree = {
    enabled: true,
    'branch-prefix': 123
  };

  const errors = validateWorkflowWorktreeDefaults(worktree, 'test-workflow');

  const prefixErrors = errors.filter(e => e.code === 'WORKFLOW_WORKTREE_INVALID_BRANCH_PREFIX');
  assert(prefixErrors.length === 1, `Expected 1 WORKFLOW_WORKTREE_INVALID_BRANCH_PREFIX error, got ${prefixErrors.length}`);
});

test('validateWorkflowWorktreeDefaults: should pass for valid workflow defaults', () => {
  const worktree = {
    enabled: true,
    'branch-prefix': 'sprint/',
    'path-prefix': '../worktrees/',
    cleanup: 'on-merge'
  };

  const errors = validateWorkflowWorktreeDefaults(worktree, 'test-workflow');
  assert(errors.length === 0, `Expected no errors, got ${errors.length}: ${errors.map(e => e.code).join(', ')}`);
});

// Integration tests - worktree in sprint definition
test('validateSprintDefinition: should validate worktree config when present', () => {
  const sprint = {
    workflow: 'test-workflow',
    worktree: {
      enabled: 'yes' // invalid - should be boolean
    }
  };

  const errors = validateSprintDefinition(sprint);

  const worktreeErrors = errors.filter(e => e.code === 'WORKTREE_INVALID_ENABLED');
  assert(worktreeErrors.length === 1, `Expected 1 WORKTREE_INVALID_ENABLED error, got ${worktreeErrors.length}`);
});

test('validateSprintDefinition: should pass with valid worktree config', () => {
  const sprint = {
    workflow: 'test-workflow',
    worktree: {
      enabled: true,
      branch: 'sprint/{sprint-id}'
    }
  };

  const errors = validateSprintDefinition(sprint);

  // Should have no worktree-related errors
  const worktreeErrors = errors.filter(e => e.code.startsWith('WORKTREE_'));
  assert(worktreeErrors.length === 0, `Should have no worktree errors, got ${worktreeErrors.length}`);
});

// Integration tests - worktree in workflow definition
test('validateWorkflowDefinition: should validate worktree defaults when present', () => {
  const workflow = {
    name: 'test-workflow',
    phases: [
      { id: 'phase-1', prompt: 'Do something' }
    ],
    worktree: {
      enabled: 'true' // invalid - should be boolean
    }
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const worktreeErrors = errors.filter(e => e.code === 'WORKFLOW_WORKTREE_INVALID_ENABLED');
  assert(worktreeErrors.length === 1, `Expected 1 WORKFLOW_WORKTREE_INVALID_ENABLED error, got ${worktreeErrors.length}`);
});

test('validateWorkflowDefinition: should pass with valid worktree defaults', () => {
  const workflow = {
    name: 'test-workflow',
    phases: [
      { id: 'phase-1', prompt: 'Do something' }
    ],
    worktree: {
      enabled: true,
      'branch-prefix': 'sprint/',
      cleanup: 'on-complete'
    }
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  // Should have no worktree-related errors
  const worktreeErrors = errors.filter(e => e.code.includes('WORKTREE'));
  assert(worktreeErrors.length === 0, `Should have no worktree errors, got ${worktreeErrors.length}: ${worktreeErrors.map(e => e.code).join(', ')}`);
});

console.log('\nValidation tests completed.'); // intentional
