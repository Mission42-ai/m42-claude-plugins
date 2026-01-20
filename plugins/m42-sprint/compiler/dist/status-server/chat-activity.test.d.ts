/**
 * Tests for Chat Activity Rendering - Step 0: Chat-Like Live Activity UI
 *
 * Tests the renderLiveActivity function's behavior for displaying
 * chat-like assistant messages and improved tool call descriptions.
 *
 * Note: page.ts generates HTML as a string. These tests verify the
 * expected patterns in the generated HTML output.
 *
 * Expected Behavior:
 * - Assistant messages render with chat bubble styling
 * - Tool calls render with secondary/grey styling
 * - Tool names are transformed to human-readable descriptions:
 *   - TodoWrite → "Updated task list"
 *   - Edit → "Editing {filename}"
 *   - Read → "Reading {filename}"
 *   - Write → "Writing {filename}"
 *   - Bash → Shows command
 *   - etc.
 *
 * RED PHASE: These tests should FAIL until page.ts renderLiveActivity
 * is updated to support assistant events and improved tool descriptions.
 */
export {};
//# sourceMappingURL=chat-activity.test.d.ts.map