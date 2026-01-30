/**
 * Tests for validation module
 */

import {
  validateWorkflowDefinition,
  validateWorktreeConfig,
  validateWorkflowWorktreeDefaults,
  isValidGitBranchName,
  validateSprintDefinition,
  validateCollections,
  validateCollectionItem,
  validateCollectionReferences,
  resolveCollectionName,
  validateDependencies,
  detectCircularDependencies,
  validateDependsOnField
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
// Flexible Collections Validation Tests
// ============================================================================

test('for-each: should accept any string value', () => {
  const workflow = {
    name: 'flexible-foreach-workflow',
    phases: [
      { id: 'phase-1', 'for-each': 'feature', workflow: 'feature-workflow' },
      { id: 'phase-2', 'for-each': 'bug', workflow: 'bugfix-workflow' },
      { id: 'phase-3', 'for-each': 'step', workflow: 'step-workflow' }
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const foreachErrors = errors.filter(e => e.code === 'INVALID_FOREACH');
  assert(foreachErrors.length === 0, `Should accept any string for-each, got ${foreachErrors.length} errors`);
});

test('for-each: should reject non-string values', () => {
  const workflow = {
    name: 'invalid-foreach-workflow',
    phases: [
      { id: 'phase-1', 'for-each': 123, workflow: 'step-workflow' }
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const foreachErrors = errors.filter(e => e.code === 'INVALID_FOREACH');
  assert(foreachErrors.length === 1, `Expected 1 INVALID_FOREACH error, got ${foreachErrors.length}`);
});

test('for-each: should reject empty string', () => {
  const workflow = {
    name: 'empty-foreach-workflow',
    phases: [
      { id: 'phase-1', 'for-each': '  ', workflow: 'step-workflow' }
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const emptyErrors = errors.filter(e => e.code === 'EMPTY_FOREACH');
  assert(emptyErrors.length === 1, `Expected 1 EMPTY_FOREACH error, got ${emptyErrors.length}`);
});

test('collection reference: should accept valid string', () => {
  const workflow = {
    name: 'collection-ref-workflow',
    phases: [
      { id: 'phase-1', 'for-each': 'item', collection: 'features', workflow: 'feature-workflow' }
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const collectionErrors = errors.filter(e => e.code.includes('COLLECTION_REF'));
  assert(collectionErrors.length === 0, `Should have no collection ref errors, got ${collectionErrors.length}`);
});

test('validateCollections: should validate collections object', () => {
  const collections = {
    feature: [
      { prompt: 'Feature 1', priority: 'high' },
      { prompt: 'Feature 2' }
    ],
    bug: [
      { prompt: 'Bug fix 1', severity: 'critical' }
    ]
  };

  const errors = validateCollections(collections);
  assert(errors.length === 0, `Expected no errors, got ${errors.length}: ${errors.map(e => e.code).join(', ')}`);
});

test('validateCollections: should fail for non-array collection', () => {
  const collections = {
    feature: 'not an array'
  };

  const errors = validateCollections(collections);

  const invalidErrors = errors.filter(e => e.code === 'INVALID_COLLECTION');
  assert(invalidErrors.length === 1, `Expected 1 INVALID_COLLECTION error, got ${invalidErrors.length}`);
});

test('validateCollectionItem: should validate item with prompt', () => {
  const item = { prompt: 'Do something', priority: 'high' };

  const errors = validateCollectionItem(item, 0, 'feature');
  assert(errors.length === 0, `Expected no errors, got ${errors.length}`);
});

test('validateCollectionItem: should fail for missing prompt', () => {
  const item = { priority: 'high' };

  const errors = validateCollectionItem(item, 0, 'feature');

  const promptErrors = errors.filter(e => e.code === 'MISSING_ITEM_PROMPT');
  assert(promptErrors.length === 1, `Expected 1 MISSING_ITEM_PROMPT error, got ${promptErrors.length}`);
});

test('validateCollectionItem: should fail for empty prompt', () => {
  const item = { prompt: '   ' };

  const errors = validateCollectionItem(item, 0, 'feature');

  const emptyErrors = errors.filter(e => e.code === 'EMPTY_ITEM_PROMPT');
  assert(emptyErrors.length === 1, `Expected 1 EMPTY_ITEM_PROMPT error, got ${emptyErrors.length}`);
});

test('resolveCollectionName: should use explicit collection when provided', () => {
  const result = resolveCollectionName('item', 'features');
  assert(result === 'features', `Expected 'features', got '${result}'`);
});

test('resolveCollectionName: should use for-each type when no explicit collection', () => {
  const result = resolveCollectionName('feature');
  assert(result === 'feature', `Expected 'feature', got '${result}'`);
});

test('validateCollectionReferences: should detect missing collection', () => {
  const workflow = {
    name: 'test-workflow',
    phases: [
      { id: 'phase-1', 'for-each': 'feature', workflow: 'feature-workflow' }
    ]
  };

  const sprint = {
    workflow: 'test-workflow',
    collections: {
      step: [{ prompt: 'Step 1' }]
    }
  };

  const errors = validateCollectionReferences(workflow as any, sprint as any);

  const notFoundErrors = errors.filter(e => e.code === 'COLLECTION_NOT_FOUND');
  assert(notFoundErrors.length === 1, `Expected 1 COLLECTION_NOT_FOUND error, got ${notFoundErrors.length}`);
  assert(notFoundErrors[0].message.includes('feature'), `Error should mention 'feature'`);
});

test('validateCollectionReferences: should pass for existing collection', () => {
  const workflow = {
    name: 'test-workflow',
    phases: [
      { id: 'phase-1', 'for-each': 'feature', workflow: 'feature-workflow' }
    ]
  };

  const sprint = {
    workflow: 'test-workflow',
    collections: {
      feature: [{ prompt: 'Feature 1' }]
    }
  };

  const errors = validateCollectionReferences(workflow as any, sprint as any);
  assert(errors.length === 0, `Expected no errors, got ${errors.length}`);
});

test('validateSprintDefinition: should validate collections when present', () => {
  const sprint = {
    workflow: 'test-workflow',
    collections: {
      feature: [
        { prompt: '   ' } // invalid - whitespace-only prompt
      ]
    }
  };

  const errors = validateSprintDefinition(sprint);

  const emptyErrors = errors.filter(e => e.code === 'EMPTY_ITEM_PROMPT');
  assert(emptyErrors.length === 1, `Expected 1 EMPTY_ITEM_PROMPT error, got ${emptyErrors.length}`);
});

test('validateSprintDefinition: should pass with valid collections', () => {
  const sprint = {
    workflow: 'test-workflow',
    collections: {
      feature: [
        { prompt: 'Feature 1', priority: 'high' }
      ],
      bug: [
        { prompt: 'Bug 1', severity: 'critical' }
      ]
    }
  };

  const errors = validateSprintDefinition(sprint);

  // Should have no collection-related errors
  const collectionErrors = errors.filter(e =>
    e.code.includes('COLLECTION') || e.code.includes('ITEM')
  );
  assert(collectionErrors.length === 0, `Should have no collection errors, got ${collectionErrors.length}`);
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

// ============================================================================
// Gate Check Validation Tests
// ============================================================================

import { validateGateCheck } from './validate.js';

test('GATE_MISSING_SCRIPT: should fail when gate has no script', () => {
  const gate = {
    'on-fail': {
      prompt: 'Fix the tests'
    }
  };

  const errors = validateGateCheck(gate, 'test-gate');

  const scriptErrors = errors.filter(e => e.code === 'GATE_MISSING_SCRIPT');
  assert(scriptErrors.length === 1, `Expected 1 GATE_MISSING_SCRIPT error, got ${scriptErrors.length}`);
});

test('GATE_EMPTY_SCRIPT: should fail when gate script is empty', () => {
  const gate = {
    script: '   ',
    'on-fail': {
      prompt: 'Fix the tests'
    }
  };

  const errors = validateGateCheck(gate, 'test-gate');

  const emptyScriptErrors = errors.filter(e => e.code === 'GATE_EMPTY_SCRIPT');
  assert(emptyScriptErrors.length === 1, `Expected 1 GATE_EMPTY_SCRIPT error, got ${emptyScriptErrors.length}`);
});

test('GATE_MISSING_ON_FAIL: should fail when gate has no on-fail', () => {
  const gate = {
    script: 'npm test'
  };

  const errors = validateGateCheck(gate, 'test-gate');

  const onFailErrors = errors.filter(e => e.code === 'GATE_MISSING_ON_FAIL');
  assert(onFailErrors.length === 1, `Expected 1 GATE_MISSING_ON_FAIL error, got ${onFailErrors.length}`);
});

test('GATE_MISSING_ON_FAIL_PROMPT: should fail when on-fail has no prompt', () => {
  const gate = {
    script: 'npm test',
    'on-fail': {}
  };

  const errors = validateGateCheck(gate, 'test-gate');

  const promptErrors = errors.filter(e => e.code === 'GATE_MISSING_ON_FAIL_PROMPT');
  assert(promptErrors.length === 1, `Expected 1 GATE_MISSING_ON_FAIL_PROMPT error, got ${promptErrors.length}`);
});

test('GATE_EMPTY_ON_FAIL_PROMPT: should fail when on-fail prompt is empty', () => {
  const gate = {
    script: 'npm test',
    'on-fail': {
      prompt: '  '
    }
  };

  const errors = validateGateCheck(gate, 'test-gate');

  const emptyPromptErrors = errors.filter(e => e.code === 'GATE_EMPTY_ON_FAIL_PROMPT');
  assert(emptyPromptErrors.length === 1, `Expected 1 GATE_EMPTY_ON_FAIL_PROMPT error, got ${emptyPromptErrors.length}`);
});

test('GATE_INVALID_MAX_RETRIES: should fail when max-retries is not positive integer', () => {
  const gate = {
    script: 'npm test',
    'on-fail': {
      prompt: 'Fix the tests',
      'max-retries': 0
    }
  };

  const errors = validateGateCheck(gate, 'test-gate');

  const retriesErrors = errors.filter(e => e.code === 'GATE_INVALID_MAX_RETRIES');
  assert(retriesErrors.length === 1, `Expected 1 GATE_INVALID_MAX_RETRIES error, got ${retriesErrors.length}`);
});

test('GATE_INVALID_MAX_RETRIES: should fail when max-retries is negative', () => {
  const gate = {
    script: 'npm test',
    'on-fail': {
      prompt: 'Fix the tests',
      'max-retries': -1
    }
  };

  const errors = validateGateCheck(gate, 'test-gate');

  const retriesErrors = errors.filter(e => e.code === 'GATE_INVALID_MAX_RETRIES');
  assert(retriesErrors.length === 1, `Expected 1 GATE_INVALID_MAX_RETRIES error, got ${retriesErrors.length}`);
});

test('GATE_INVALID_MAX_RETRIES: should fail when max-retries is not integer', () => {
  const gate = {
    script: 'npm test',
    'on-fail': {
      prompt: 'Fix the tests',
      'max-retries': 2.5
    }
  };

  const errors = validateGateCheck(gate, 'test-gate');

  const retriesErrors = errors.filter(e => e.code === 'GATE_INVALID_MAX_RETRIES');
  assert(retriesErrors.length === 1, `Expected 1 GATE_INVALID_MAX_RETRIES error, got ${retriesErrors.length}`);
});

test('GATE_INVALID_TIMEOUT: should fail when timeout is not positive', () => {
  const gate = {
    script: 'npm test',
    'on-fail': {
      prompt: 'Fix the tests'
    },
    timeout: 0
  };

  const errors = validateGateCheck(gate, 'test-gate');

  const timeoutErrors = errors.filter(e => e.code === 'GATE_INVALID_TIMEOUT');
  assert(timeoutErrors.length === 1, `Expected 1 GATE_INVALID_TIMEOUT error, got ${timeoutErrors.length}`);
});

test('GATE_INVALID_TIMEOUT: should fail when timeout is negative', () => {
  const gate = {
    script: 'npm test',
    'on-fail': {
      prompt: 'Fix the tests'
    },
    timeout: -10
  };

  const errors = validateGateCheck(gate, 'test-gate');

  const timeoutErrors = errors.filter(e => e.code === 'GATE_INVALID_TIMEOUT');
  assert(timeoutErrors.length === 1, `Expected 1 GATE_INVALID_TIMEOUT error, got ${timeoutErrors.length}`);
});

test('validateGateCheck: should pass for valid gate config', () => {
  const gate = {
    script: 'npm test',
    'on-fail': {
      prompt: 'Fix the tests',
      'max-retries': 3
    },
    timeout: 60
  };

  const errors = validateGateCheck(gate, 'test-gate');

  assert(errors.length === 0, `Expected no errors, got ${errors.length}: ${errors.map(e => e.code).join(', ')}`);
});

test('validateGateCheck: should pass for minimal valid gate config', () => {
  const gate = {
    script: 'npm test',
    'on-fail': {
      prompt: 'Fix the tests'
    }
  };

  const errors = validateGateCheck(gate, 'test-gate');

  assert(errors.length === 0, `Expected no errors, got ${errors.length}: ${errors.map(e => e.code).join(', ')}`);
});

test('validateWorkflowPhase: should validate gate when present in phase', () => {
  const workflow = {
    name: 'workflow-with-gate',
    phases: [
      {
        id: 'verify-tests',
        prompt: 'Run tests',
        gate: {
          script: '', // Empty script should fail
          'on-fail': {
            prompt: 'Fix tests'
          }
        }
      }
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const gateErrors = errors.filter(e => e.code.startsWith('GATE_'));
  assert(gateErrors.length === 1, `Expected 1 gate error, got ${gateErrors.length}: ${gateErrors.map(e => e.code).join(', ')}`);
  assert(gateErrors[0].code === 'GATE_EMPTY_SCRIPT', `Expected GATE_EMPTY_SCRIPT, got ${gateErrors[0].code}`);
});

test('validateWorkflowPhase: should pass with valid gate in phase', () => {
  const workflow = {
    name: 'workflow-with-valid-gate',
    phases: [
      {
        id: 'verify-tests',
        prompt: 'Run tests',
        gate: {
          script: 'npm test',
          'on-fail': {
            prompt: 'Fix failing tests',
            'max-retries': 3
          }
        }
      }
    ]
  };

  const errors = validateWorkflowDefinition(workflow, 'test-workflow');

  const gateErrors = errors.filter(e => e.code.startsWith('GATE_'));
  assert(gateErrors.length === 0, `Expected no gate errors, got ${gateErrors.length}: ${gateErrors.map(e => e.code).join(', ')}`);
});

// ============================================================================
<<<<<<< HEAD
// Schema Version Validation Tests
// ============================================================================

import { validateSchemaVersion } from './validate.js';
import { CURRENT_SCHEMA_VERSION } from './types.js';

test('validateSchemaVersion: should produce warning when schema-version is missing', () => {
  const workflow = {
    name: 'test-workflow',
    phases: [{ id: 'phase-1', prompt: 'Do something' }]
  };

  const warnings: string[] = [];
  validateSchemaVersion(workflow as any, 'test-workflow', warnings);

  assert(warnings.length === 1, `Expected 1 warning, got ${warnings.length}`);
  assert(warnings[0].includes('no schema-version'), `Warning should mention missing schema-version`);
  assert(warnings[0].includes(CURRENT_SCHEMA_VERSION), `Warning should mention current version ${CURRENT_SCHEMA_VERSION}`);
});

test('validateSchemaVersion: should produce warning when schema-version is outdated', () => {
  const workflow = {
    name: 'test-workflow',
    'schema-version': '1.0',
    phases: [{ id: 'phase-1', prompt: 'Do something' }]
  };

  const warnings: string[] = [];
  validateSchemaVersion(workflow as any, 'test-workflow', warnings);

  assert(warnings.length === 1, `Expected 1 warning, got ${warnings.length}`);
  assert(warnings[0].includes('1.0'), `Warning should mention outdated version`);
  assert(warnings[0].includes(CURRENT_SCHEMA_VERSION), `Warning should mention current version ${CURRENT_SCHEMA_VERSION}`);
  assert(warnings[0].includes('Consider updating'), `Warning should suggest updating`);
});

test('validateSchemaVersion: should produce no warning when schema-version is current', () => {
  const workflow = {
    name: 'test-workflow',
    'schema-version': CURRENT_SCHEMA_VERSION,
    phases: [{ id: 'phase-1', prompt: 'Do something' }]
  };

  const warnings: string[] = [];
  validateSchemaVersion(workflow as any, 'test-workflow', warnings);

  assert(warnings.length === 0, `Expected no warnings, got ${warnings.length}: ${warnings.join(', ')}`);
=======
// Dependency Validation Tests
// ============================================================================

test('validateDependsOnField: should pass when depends-on is absent', () => {
  const item = { prompt: 'Task 1' };

  const errors = validateDependsOnField(item, 0, 'step');
  assert(errors.length === 0, `Expected no errors, got ${errors.length}`);
});

test('validateDependsOnField: should pass when depends-on is valid array', () => {
  const item = { prompt: 'Task 1', 'depends-on': ['step-0', 'step-1'] };

  const errors = validateDependsOnField(item, 0, 'step');
  assert(errors.length === 0, `Expected no errors, got ${errors.length}`);
});

test('INVALID_DEPENDS_ON: should fail when depends-on is not an array', () => {
  const item = { prompt: 'Task 1', 'depends-on': 'step-0' };

  const errors = validateDependsOnField(item, 0, 'step');

  const invalidErrors = errors.filter(e => e.code === 'INVALID_DEPENDS_ON');
  assert(invalidErrors.length === 1, `Expected 1 INVALID_DEPENDS_ON error, got ${invalidErrors.length}`);
});

test('INVALID_DEPENDS_ON_ELEMENT: should fail when depends-on contains non-string', () => {
  const item = { prompt: 'Task 1', 'depends-on': ['step-0', 123] };

  const errors = validateDependsOnField(item, 0, 'step');

  const elementErrors = errors.filter(e => e.code === 'INVALID_DEPENDS_ON_ELEMENT');
  assert(elementErrors.length === 1, `Expected 1 INVALID_DEPENDS_ON_ELEMENT error, got ${elementErrors.length}`);
});

test('EMPTY_DEPENDS_ON_ELEMENT: should fail when depends-on contains empty string', () => {
  const item = { prompt: 'Task 1', 'depends-on': ['step-0', '   '] };

  const errors = validateDependsOnField(item, 0, 'step');

  const emptyErrors = errors.filter(e => e.code === 'EMPTY_DEPENDS_ON_ELEMENT');
  assert(emptyErrors.length === 1, `Expected 1 EMPTY_DEPENDS_ON_ELEMENT error, got ${emptyErrors.length}`);
});

test('DEPENDENCY_NOT_FOUND: should fail when dependency does not exist', () => {
  const items = [
    { prompt: 'Task 1', id: 'task-1' },
    { prompt: 'Task 2', id: 'task-2', 'depends-on': ['task-1', 'task-3'] } // task-3 doesn't exist
  ];

  const errors = validateDependencies(items, 'step');

  const notFoundErrors = errors.filter(e => e.code === 'DEPENDENCY_NOT_FOUND');
  assert(notFoundErrors.length === 1, `Expected 1 DEPENDENCY_NOT_FOUND error, got ${notFoundErrors.length}`);
  assert(notFoundErrors[0].message.includes('task-3'), `Error should mention 'task-3'`);
});

test('DEPENDENCY_SELF_REFERENCE: should fail when item depends on itself', () => {
  const items = [
    { prompt: 'Task 1', id: 'task-1', 'depends-on': ['task-1'] } // self-reference
  ];

  const errors = validateDependencies(items, 'step');

  const selfRefErrors = errors.filter(e => e.code === 'DEPENDENCY_SELF_REFERENCE');
  assert(selfRefErrors.length === 1, `Expected 1 DEPENDENCY_SELF_REFERENCE error, got ${selfRefErrors.length}`);
});

test('DEPENDENCY_CIRCULAR: should fail for simple A -> B -> A cycle', () => {
  const items = [
    { prompt: 'Task A', id: 'task-a', 'depends-on': ['task-b'] },
    { prompt: 'Task B', id: 'task-b', 'depends-on': ['task-a'] }
  ];

  const errors = detectCircularDependencies(items, 'step');

  const circularErrors = errors.filter(e => e.code === 'DEPENDENCY_CIRCULAR');
  assert(circularErrors.length >= 1, `Expected at least 1 DEPENDENCY_CIRCULAR error, got ${circularErrors.length}`);
});

test('DEPENDENCY_CIRCULAR: should fail for longer A -> B -> C -> A cycle', () => {
  const items = [
    { prompt: 'Task A', id: 'task-a', 'depends-on': ['task-c'] },
    { prompt: 'Task B', id: 'task-b', 'depends-on': ['task-a'] },
    { prompt: 'Task C', id: 'task-c', 'depends-on': ['task-b'] }
  ];

  const errors = detectCircularDependencies(items, 'step');

  const circularErrors = errors.filter(e => e.code === 'DEPENDENCY_CIRCULAR');
  assert(circularErrors.length >= 1, `Expected at least 1 DEPENDENCY_CIRCULAR error, got ${circularErrors.length}`);
});

test('validateDependencies: should pass for valid DAG', () => {
  const items = [
    { prompt: 'Setup', id: 'setup' },
    { prompt: 'Build', id: 'build', 'depends-on': ['setup'] },
    { prompt: 'Test', id: 'test', 'depends-on': ['build'] },
    { prompt: 'Deploy', id: 'deploy', 'depends-on': ['build', 'test'] }
  ];

  const errors = validateDependencies(items, 'step');
  assert(errors.length === 0, `Expected no errors for valid DAG, got ${errors.length}: ${errors.map(e => e.code).join(', ')}`);
});

test('validateDependencies: should handle items without explicit IDs', () => {
  const items = [
    { prompt: 'Task 1' },  // auto-generated ID: step-0
    { prompt: 'Task 2', 'depends-on': ['step-0'] }  // depends on first item
  ];

  const errors = validateDependencies(items, 'step');
  assert(errors.length === 0, `Expected no errors, got ${errors.length}: ${errors.map(e => e.code).join(', ')}`);
});

test('validateDependencies: should fail for missing auto-generated ID reference', () => {
  const items = [
    { prompt: 'Task 1' },  // auto-generated ID: step-0
    { prompt: 'Task 2', 'depends-on': ['step-5'] }  // step-5 doesn't exist
  ];

  const errors = validateDependencies(items, 'step');

  const notFoundErrors = errors.filter(e => e.code === 'DEPENDENCY_NOT_FOUND');
  assert(notFoundErrors.length === 1, `Expected 1 DEPENDENCY_NOT_FOUND error, got ${notFoundErrors.length}`);
});

test('validateCollections: should validate dependencies within collections', () => {
  const collections = {
    step: [
      { prompt: 'Task 1', id: 'task-1' },
      { prompt: 'Task 2', id: 'task-2', 'depends-on': ['task-1', 'nonexistent'] }
    ]
  };

  const errors = validateCollections(collections);

  const notFoundErrors = errors.filter(e => e.code === 'DEPENDENCY_NOT_FOUND');
  assert(notFoundErrors.length === 1, `Expected 1 DEPENDENCY_NOT_FOUND error, got ${notFoundErrors.length}`);
});

test('validateCollections: should detect circular dependencies', () => {
  const collections = {
    step: [
      { prompt: 'Task A', id: 'task-a', 'depends-on': ['task-b'] },
      { prompt: 'Task B', id: 'task-b', 'depends-on': ['task-a'] }
    ]
  };

  const errors = validateCollections(collections);

  const circularErrors = errors.filter(e => e.code === 'DEPENDENCY_CIRCULAR');
  assert(circularErrors.length >= 1, `Expected at least 1 DEPENDENCY_CIRCULAR error, got ${circularErrors.length}`);
});

test('validateCollectionItem: should validate depends-on field format', () => {
  const item = { prompt: 'Task', 'depends-on': 'not-an-array' };

  const errors = validateCollectionItem(item, 0, 'step');

  const depsErrors = errors.filter(e => e.code === 'INVALID_DEPENDS_ON');
  assert(depsErrors.length === 1, `Expected 1 INVALID_DEPENDS_ON error, got ${depsErrors.length}`);
});

test('validateDependencies: should detect multiple issues in one collection', () => {
  const items = [
    { prompt: 'Task A', id: 'task-a', 'depends-on': ['task-a'] },  // self-reference
    { prompt: 'Task B', id: 'task-b', 'depends-on': ['missing'] }, // missing reference
    { prompt: 'Task C', id: 'task-c', 'depends-on': ['task-d'] },  // cycle
    { prompt: 'Task D', id: 'task-d', 'depends-on': ['task-c'] }   // cycle
  ];

  const errors = validateDependencies(items, 'step');

  // Should have at least: 1 self-reference, 1 missing reference, and 1+ circular
  const selfRefErrors = errors.filter(e => e.code === 'DEPENDENCY_SELF_REFERENCE');
  const notFoundErrors = errors.filter(e => e.code === 'DEPENDENCY_NOT_FOUND');
  const circularErrors = errors.filter(e => e.code === 'DEPENDENCY_CIRCULAR');

  assert(selfRefErrors.length >= 1, `Expected at least 1 DEPENDENCY_SELF_REFERENCE error`);
  assert(notFoundErrors.length >= 1, `Expected at least 1 DEPENDENCY_NOT_FOUND error`);
  assert(circularErrors.length >= 1, `Expected at least 1 DEPENDENCY_CIRCULAR error`);
});

test('validateDependencies: should pass for empty collection', () => {
  const items: any[] = [];

  const errors = validateDependencies(items, 'step');
  assert(errors.length === 0, `Expected no errors for empty collection, got ${errors.length}`);
});

test('validateDependencies: should pass for collection with no dependencies', () => {
  const items = [
    { prompt: 'Task 1', id: 'task-1' },
    { prompt: 'Task 2', id: 'task-2' },
    { prompt: 'Task 3', id: 'task-3' }
  ];

  const errors = validateDependencies(items, 'step');
  assert(errors.length === 0, `Expected no errors, got ${errors.length}`);
>>>>>>> 34e1cb8 (feat(m42-sprint): dependency-based parallel execution)
});

console.log('\nValidation tests completed.'); // intentional
