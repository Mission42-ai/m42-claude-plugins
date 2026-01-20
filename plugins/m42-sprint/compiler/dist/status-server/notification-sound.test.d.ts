/**
 * Test for BUG-005: Completed Sprint Triggers Completion Sound
 *
 * Bug: When clicking on an already-completed sprint, the completion sound
 * plays as if the sprint just completed, even though it completed long ago.
 *
 * Expected: Completion sound should only play ONCE when sprint transitions
 * to completed status, not every time the page is viewed.
 *
 * Root Cause: In page.ts, `previousSprintStatus` is initialized to `null`.
 * When page loads with a completed sprint, the first status update triggers
 * notification because the condition `previousSprintStatus !== newStatus`
 * is true (null !== 'completed').
 *
 * The checkAndSendNotification function then sees:
 *   newStatus === 'completed' && previousStatus !== 'completed'
 * which is true because previousStatus is null, not 'completed'.
 *
 * This test extracts and tests the notification triggering logic from page.ts
 * to demonstrate the bug exists.
 */
export {};
//# sourceMappingURL=notification-sound.test.d.ts.map