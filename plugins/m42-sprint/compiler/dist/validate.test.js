"use strict";
/**
 * Tests for validation module
 */
Object.defineProperty(exports, "__esModule", { value: true });
const validate_js_1 = require("./validate.js");
// Simple test runner
function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
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
// Tests for empty workflow validation
test('EMPTY_WORKFLOW: should fail when workflow has zero phases', () => {
    const workflow = {
        name: 'empty-workflow',
        phases: []
    };
    const errors = (0, validate_js_1.validateWorkflowDefinition)(workflow, 'test-workflow');
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
    const errors = (0, validate_js_1.validateWorkflowDefinition)(workflow, 'test-workflow');
    // Should have no EMPTY_WORKFLOW error
    const emptyWorkflowErrors = errors.filter(e => e.code === 'EMPTY_WORKFLOW');
    assert(emptyWorkflowErrors.length === 0, `Should have no EMPTY_WORKFLOW errors, got ${emptyWorkflowErrors.length}`);
});
test('MISSING_PHASES: should fail when phases array is missing', () => {
    const workflow = {
        name: 'no-phases-workflow'
    };
    const errors = (0, validate_js_1.validateWorkflowDefinition)(workflow, 'test-workflow');
    const missingPhasesErrors = errors.filter(e => e.code === 'MISSING_PHASES');
    assert(missingPhasesErrors.length === 1, `Expected 1 MISSING_PHASES error, got ${missingPhasesErrors.length}`);
});
console.log('\nValidation tests completed.');
//# sourceMappingURL=validate.test.js.map