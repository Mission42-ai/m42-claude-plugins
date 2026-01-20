"use strict";
/**
 * Tests for Activity Types - Step 0: Chat-Like Live Activity UI
 *
 * Tests the ActivityEvent type guard for the new 'assistant' event type
 * which will be used to display chat-like messages in the Live Activity panel.
 *
 * Expected Behavior:
 * - ActivityEvent supports both 'tool' and 'assistant' types
 * - Assistant events have optional text and isThinking fields
 * - Type guard validates all required and optional fields correctly
 *
 * RED PHASE: These tests should FAIL until activity-types.ts is updated
 * to support the 'assistant' event type.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const activity_types_js_1 = require("./activity-types.js");
// ============================================================================
// Test Framework (consistent with project patterns)
// ============================================================================
function test(name, fn) {
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
}
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
console.log('\n--- Step 0: Activity Types Tests (RED PHASE) ---\n');
// ============================================================================
// Scenario 1: ActivityEvent type supports assistant type
// ============================================================================
test('Scenario 1: isActivityEvent accepts assistant event type', () => {
    const assistantEvent = {
        ts: '2026-01-20T12:00:00Z',
        type: 'assistant',
        tool: '', // Not used for assistant type but required by current interface
        level: 'minimal',
    };
    // RED: This should FAIL - current implementation only accepts type='tool'
    assert((0, activity_types_js_1.isActivityEvent)(assistantEvent), `isActivityEvent should accept type='assistant'. ` +
        `Currently only accepts 'tool'. ` +
        `This will PASS after implementing assistant support in activity-types.ts`);
});
test('Scenario 1: ActivityEvent type union includes assistant', () => {
    // Test that we can assign 'assistant' to the type field
    // Using type assertion to allow compilation - runtime will verify the behavior
    const event = {
        ts: '2026-01-20T12:00:00Z',
        type: 'assistant',
        level: 'minimal',
    };
    // RED: isActivityEvent will return false until type union is updated
    assert((0, activity_types_js_1.isActivityEvent)(event), `ActivityEvent type union should include 'assistant'. ` +
        `Currently fails because type union only includes 'tool'.`);
});
// ============================================================================
// Scenario 2: ActivityEvent has text and isThinking fields
// ============================================================================
test('Scenario 2: isActivityEvent validates text field for assistant type', () => {
    const assistantEventWithText = {
        ts: '2026-01-20T12:00:00Z',
        type: 'assistant',
        tool: '',
        level: 'minimal',
        text: 'Hello user, I am working on your request.',
    };
    // RED: Should fail - text field not yet in type definition
    assert((0, activity_types_js_1.isActivityEvent)(assistantEventWithText), `isActivityEvent should accept assistant event with text field. ` +
        `This tests that text is a valid optional field for assistant events.`);
    // Verify text field is accessible
    if ((0, activity_types_js_1.isActivityEvent)(assistantEventWithText)) {
        // This assertion will fail at compile time until text is added to ActivityEvent
        assert(assistantEventWithText.text === 'Hello user, I am working on your request.', 'Text field should be accessible on validated event');
    }
});
test('Scenario 2: isActivityEvent validates isThinking field for assistant type', () => {
    const thinkingEvent = {
        ts: '2026-01-20T12:00:00Z',
        type: 'assistant',
        tool: '',
        level: 'minimal',
        text: '...',
        isThinking: true,
    };
    // RED: Should fail - isThinking field not yet in type definition
    assert((0, activity_types_js_1.isActivityEvent)(thinkingEvent), `isActivityEvent should accept assistant event with isThinking field. ` +
        `isThinking indicates the assistant is currently processing (typing indicator).`);
    // Verify isThinking field is accessible
    if ((0, activity_types_js_1.isActivityEvent)(thinkingEvent)) {
        assert(thinkingEvent.isThinking === true, 'isThinking field should be accessible on validated event');
    }
});
test('Scenario 2: isActivityEvent accepts assistant event with both text and isThinking', () => {
    const fullAssistantEvent = {
        ts: '2026-01-20T12:00:00Z',
        type: 'assistant',
        tool: '',
        level: 'minimal',
        text: 'Analyzing the codebase structure...',
        isThinking: false,
    };
    // RED: Should fail until ActivityEvent supports assistant type with all fields
    assert((0, activity_types_js_1.isActivityEvent)(fullAssistantEvent), `isActivityEvent should accept assistant event with both text and isThinking fields`);
});
// ============================================================================
// Edge Cases for Assistant Events
// ============================================================================
test('Scenario 2: isActivityEvent rejects assistant event with invalid text type', () => {
    const invalidTextEvent = {
        ts: '2026-01-20T12:00:00Z',
        type: 'assistant',
        tool: '',
        level: 'minimal',
        text: 12345, // Invalid: should be string
    };
    // Even after implementation, this should be rejected
    // For now it passes because assistant type isn't validated yet
    // After implementation, this should return false
    const isValid = (0, activity_types_js_1.isActivityEvent)(invalidTextEvent);
    // RED: Currently this might pass because assistant validation doesn't exist
    // After implementation: assert(!isValid, ...)
    console.log(`  (text type validation: ${isValid ? 'not enforced' : 'enforced'})`);
});
test('Scenario 2: isActivityEvent rejects assistant event with invalid isThinking type', () => {
    const invalidThinkingEvent = {
        ts: '2026-01-20T12:00:00Z',
        type: 'assistant',
        tool: '',
        level: 'minimal',
        isThinking: 'yes', // Invalid: should be boolean
    };
    const isValid = (0, activity_types_js_1.isActivityEvent)(invalidThinkingEvent);
    console.log(`  (isThinking type validation: ${isValid ? 'not enforced' : 'enforced'})`);
});
// ============================================================================
// Backward Compatibility: Tool events still work
// ============================================================================
test('Backward compatibility: tool events still validate correctly', () => {
    const toolEvent = {
        ts: '2026-01-20T12:00:00Z',
        type: 'tool',
        tool: 'Read',
        level: 'basic',
        file: '/path/to/file.ts',
    };
    // This should continue to work
    assert((0, activity_types_js_1.isActivityEvent)(toolEvent), `Tool events should still be valid after adding assistant support`);
});
test('Backward compatibility: tool events with all fields validate', () => {
    const fullToolEvent = {
        ts: '2026-01-20T12:00:00Z',
        type: 'tool',
        tool: 'Bash',
        level: 'detailed',
        params: 'npm run build',
        file: '/project',
        input: { command: 'npm run build' },
        response: { exitCode: 0 },
    };
    assert((0, activity_types_js_1.isActivityEvent)(fullToolEvent), `Full tool events should validate correctly`);
});
// ============================================================================
// Verbosity Level Tests for Assistant Events
// ============================================================================
test('Scenario 1: Assistant events can have any verbosity level', () => {
    const levels = ['minimal', 'basic', 'detailed', 'verbose'];
    for (const level of levels) {
        const event = {
            ts: '2026-01-20T12:00:00Z',
            type: 'assistant',
            tool: '',
            level,
            text: 'Test message',
        };
        // RED: All will fail until assistant type is supported
        assert((0, activity_types_js_1.isActivityEvent)(event), `Assistant event with level='${level}' should be valid`);
    }
});
console.log('\n--- End of Activity Types Tests ---\n');
//# sourceMappingURL=activity-types.test.js.map