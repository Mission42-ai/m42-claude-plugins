/**
 * Tests for validation module
 */

import { validateWorkflowDefinition } from './validate.js';

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

console.log('\nValidation tests completed.'); // intentional
