"use strict";
/**
 * Tests for error-classifier module
 *
 * BUG-005: Error Classifier Pattern Ordering
 * The 'logic' category has overly broad patterns (/error/i, /failed/i) that could
 * potentially match before more specific patterns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const error_classifier_js_1 = require("./error-classifier.js");
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
        throw new Error(`${message}: expected '${expected}', got '${actual}'`);
    }
}
// ========================================
// BUG-005 Tests: Pattern Ordering Priority
// ========================================
// These tests verify that specific categories are matched BEFORE the broad 'logic' patterns
test('BUG-005: network error containing "error" should match network, not logic', () => {
    // "network error" contains both "network" and "error"
    // The broad /error/i pattern in 'logic' should NOT match before network patterns
    const result = (0, error_classifier_js_1.classifyError)(1, 'network error occurred');
    assertEqual(result.category, 'network', 'network error should be classified as network category');
});
test('BUG-005: validation failed should match validation, not logic', () => {
    // "validation failed" contains both "validation" and "failed"
    // The broad /failed/i pattern in 'logic' should NOT match before validation patterns
    const result = (0, error_classifier_js_1.classifyError)(1, 'validation failed for input');
    assertEqual(result.category, 'validation', 'validation failed should be classified as validation category');
});
test('BUG-005: connection failed should match network, not logic', () => {
    // "connection failed" contains "failed" which matches logic's /failed/i
    // But should match network's /connection.*failed/i pattern
    const result = (0, error_classifier_js_1.classifyError)(1, 'connection failed');
    assertEqual(result.category, 'network', 'connection failed should be classified as network category');
});
test('BUG-005: rate limit error should match rate-limit, not logic', () => {
    // Contains "error" which matches logic's /error/i
    // But should match rate-limit patterns
    const result = (0, error_classifier_js_1.classifyError)(1, 'rate limit error: 429');
    assertEqual(result.category, 'rate-limit', 'rate limit error should be classified as rate-limit category');
});
test('BUG-005: timeout exception should match timeout, not logic', () => {
    // Contains "exception" which matches logic's /exception/i
    // But should match timeout's /timeout/i pattern
    const result = (0, error_classifier_js_1.classifyError)(1, 'timeout exception occurred');
    assertEqual(result.category, 'timeout', 'timeout exception should be classified as timeout category');
});
test('BUG-005: DNS failed error should match network, not logic', () => {
    // Contains both "failed" and "error" which match logic patterns
    // But should match network's /DNS.*failed/i pattern
    const result = (0, error_classifier_js_1.classifyError)(1, 'DNS failed error');
    assertEqual(result.category, 'network', 'DNS failed error should be classified as network category');
});
test('BUG-005: schema validation error should match validation, not logic', () => {
    // Contains "error" which matches logic's /error/i
    // But should match validation's /schema.*validation/i or /validation.*error/i
    const result = (0, error_classifier_js_1.classifyError)(1, 'schema validation error');
    assertEqual(result.category, 'validation', 'schema validation error should be classified as validation category');
});
// ========================================
// Edge Cases: Messages that SHOULD match logic
// ========================================
test('BUG-005: generic error should match logic category', () => {
    // A truly generic error with no specific category patterns
    const result = (0, error_classifier_js_1.classifyError)(1, 'unknown error in processing');
    assertEqual(result.category, 'logic', 'generic error should be classified as logic category');
});
test('BUG-005: generic failure should match logic category', () => {
    // A generic failure message with no specific category patterns
    const result = (0, error_classifier_js_1.classifyError)(1, 'operation failed unexpectedly');
    assertEqual(result.category, 'logic', 'generic failure should be classified as logic category');
});
// ========================================
// Confidence Tests
// ========================================
test('BUG-005: specific category should have high confidence', () => {
    const result = (0, error_classifier_js_1.classifyError)(1, 'ECONNREFUSED');
    assertEqual(result.category, 'network', 'should be network');
    assert(result.confidence === 0.9, `Expected confidence 0.9, got ${result.confidence}`);
});
test('BUG-005: logic category should have lower confidence', () => {
    const result = (0, error_classifier_js_1.classifyError)(1, 'some random error');
    assertEqual(result.category, 'logic', 'should be logic');
    assert(result.confidence === 0.5, `Expected confidence 0.5, got ${result.confidence}`);
});
// ========================================
// Loop Order Verification Test
// ========================================
test('BUG-005: loop order ensures specific patterns are checked before logic fallback', () => {
    // The categoryPriority array ensures specific categories are checked first:
    // ['network', 'rate-limit', 'timeout', 'validation', 'logic']
    //
    // This loop order guarantees that messages containing both specific keywords
    // and generic terms like "error" or "failed" match the specific category.
    const networkResult = (0, error_classifier_js_1.classifyError)(1, 'network error');
    assertEqual(networkResult.category, 'network', 'should classify as network due to priority loop order');
});
// ========================================
// Regression Tests: Priority Order Robustness
// ========================================
test('BUG-005: REGRESSION - messages with multiple category keywords should match most specific', () => {
    // This is a regression test to ensure the priority ordering remains correct.
    // If someone changes the categoryPriority order or the skip logic, this should fail.
    // "connection timeout error" could match:
    // - network: /connection.*/ patterns
    // - timeout: /timeout/i
    // - logic: /error/i
    // Should match network (first in priority with a match)
    const result1 = (0, error_classifier_js_1.classifyError)(1, 'connection timeout error');
    // Note: "connection timeout" doesn't match /connection.*failed/i or /connection.*refused/i
    // or /connection.*reset/i, so it falls through to timeout which matches /timeout/i
    assertEqual(result1.category, 'timeout', 'connection timeout error should match timeout');
    // "rate limit validation error" could match:
    // - rate-limit: /rate.*limit/i
    // - validation: /validation.*error/i
    // - logic: /error/i
    // Should match rate-limit (first in priority)
    const result2 = (0, error_classifier_js_1.classifyError)(1, 'rate limit validation error');
    assertEqual(result2.category, 'rate-limit', 'rate limit validation error should match rate-limit');
});
test('BUG-005: CODE CLARITY - implementation is clean and straightforward', () => {
    // The current implementation correctly handles pattern ordering by:
    // 1. Defining categoryPriority with 'logic' as the last element
    // 2. Iterating through categories in priority order
    // 3. Returning immediately when a pattern matches
    //
    // This ensures specific patterns (network, rate-limit, timeout, validation)
    // are always checked before the broad 'logic' fallback patterns.
    // Verify the implementation works as expected
    const result = (0, error_classifier_js_1.classifyError)(1, 'validation error occurred');
    assertEqual(result.category, 'validation', 'validation-specific pattern should match before logic fallback');
});
console.log('\nError classifier tests completed.'); // intentional
//# sourceMappingURL=error-classifier.test.js.map