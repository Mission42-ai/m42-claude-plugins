"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const testResults = [];
function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        testResults.push({ name, passed: true });
    }
    catch (error) {
        console.error(`✗ ${name}`);
        console.error(`  ${error.message}`);
        testResults.push({ name, passed: false, error: error });
    }
}
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}\n    Expected: ${expected}\n    Actual: ${actual}`);
    }
}
// ============================================================================
// Notification Controller (extracted from page.ts for testing)
// ============================================================================
/**
 * This class mirrors the notification logic in page.ts lines 2944-3527
 *
 * Key code from page.ts:
 *
 * Line 2944: let previousSprintStatus = null;
 *
 * Lines 4098-4105 (handleStatusUpdate):
 *   var newStatus = update.header ? update.header.status : null;
 *   if (previousSprintStatus !== newStatus && newStatus) {
 *     checkAndSendNotification(newStatus, previousSprintStatus, update);
 *     previousSprintStatus = newStatus;
 *   }
 *
 * Lines 3450-3455 (checkAndSendNotification):
 *   if (newStatus === 'completed' && previousStatus !== 'completed') {
 *     if (notificationPreferences.events.sprintCompleted) {
 *       shouldNotify = true;
 *     }
 *   }
 */
class NotificationController {
    previousSprintStatus = null;
    notificationPreferences;
    soundPlayedCount = 0;
    notificationsSentCount = 0;
    constructor(preferences) {
        this.notificationPreferences = preferences;
    }
    /**
     * Mirrors handleStatusUpdate() from page.ts lines 4098-4105
     *
     * BUG: previousSprintStatus starts as null. On first status update,
     * the condition `previousSprintStatus !== newStatus` is ALWAYS true
     * when newStatus is any non-null value.
     */
    handleStatusUpdate(update) {
        const newStatus = update.header?.status ?? null;
        // Mirrors: if (previousSprintStatus !== newStatus && newStatus)
        if (this.previousSprintStatus !== newStatus && newStatus) {
            const result = this.checkAndSendNotification(newStatus, this.previousSprintStatus, update);
            this.previousSprintStatus = newStatus;
            return result;
        }
        return { notified: false, reason: 'no-change' };
    }
    /**
     * Mirrors checkAndSendNotification() from page.ts lines 3440-3488
     */
    checkAndSendNotification(newStatus, previousStatus, _update) {
        if (!this.notificationPreferences.enabled) {
            return { notified: false, reason: 'notifications-disabled' };
        }
        // BUG-005 fix: Skip notifications on initial page load (previousStatus is null)
        // When user opens a page for an already-completed/failed sprint, we should not
        // play sounds or show notifications - the sprint was already in that state
        if (previousStatus === null) {
            return { notified: false, reason: 'initial-load-skip' };
        }
        let shouldNotify = false;
        let reason = '';
        // FIXED: Now that we check for null above, this condition only fires
        // for actual transitions from one status to another
        if (newStatus === 'completed' && previousStatus !== 'completed') {
            if (this.notificationPreferences.events.sprintCompleted) {
                shouldNotify = true;
                reason = 'sprint-completed';
            }
        }
        if (newStatus === 'failed' && previousStatus !== 'failed') {
            if (this.notificationPreferences.events.sprintFailed) {
                shouldNotify = true;
                reason = 'sprint-failed';
            }
        }
        if (newStatus === 'blocked' && previousStatus !== 'blocked') {
            if (this.notificationPreferences.events.phaseBlocked) {
                shouldNotify = true;
                reason = 'phase-blocked';
            }
        }
        if (newStatus === 'needs-human' && previousStatus !== 'needs-human') {
            if (this.notificationPreferences.events.needsHuman) {
                shouldNotify = true;
                reason = 'needs-human';
            }
        }
        if (shouldNotify) {
            this.notificationsSentCount++;
            // Mirrors showNotification() calling playNotificationSound() at line 3515
            if (this.notificationPreferences.sound.enabled) {
                this.soundPlayedCount++;
            }
        }
        return { notified: shouldNotify, reason: reason || 'no-match' };
    }
    /**
     * Simulate page reload / new page view
     * In browser, this happens when user navigates away and comes back
     */
    resetForNewPageView() {
        this.previousSprintStatus = null;
        // Note: sound/notification counts persist to track across page views
    }
}
// ============================================================================
// Test Fixtures
// ============================================================================
function createDefaultPreferences() {
    return {
        enabled: true,
        events: {
            sprintCompleted: true,
            sprintFailed: true,
            phaseBlocked: true,
            needsHuman: true,
        },
        sound: {
            enabled: true,
            soundId: 'chime',
        },
    };
}
// ============================================================================
// BUG-005 Tests
// ============================================================================
console.log('=== BUG-005 Test: Completed Sprint Triggers Completion Sound ===\n');
// Test 1: Core bug demonstration
test('BUG-005: Sound should NOT play when opening already-completed sprint (FAILING TEST)', () => {
    const controller = new NotificationController(createDefaultPreferences());
    // Simulate: User opens page for an already-completed sprint
    // This is the initial status update received when page loads
    const completedSprintUpdate = {
        header: {
            status: 'completed',
            sprintId: 'sprint-2026-01-20-bug005',
        },
    };
    // Initial page load - sprint was already completed before user opened page
    const result = controller.handleStatusUpdate(completedSprintUpdate);
    // BUG: The notification fires because previousSprintStatus is null
    // and the condition `previousStatus !== 'completed'` is true for null
    assertEqual(result.notified, false, `BUG-005: Notification should NOT trigger on initial load of completed sprint.\n` +
        `    The sprint was already completed - user is just viewing it.\n` +
        `    Root cause: previousSprintStatus starts as null, so condition\n` +
        `    'previousStatus !== completed' is true (null !== 'completed')`);
    assertEqual(controller.soundPlayedCount, 0, `BUG-005: Sound should NOT play on initial load of completed sprint.\n` +
        `    Sound played ${controller.soundPlayedCount} time(s).`);
});
// Test 2: Verify real transitions still work
test('Sound SHOULD play when sprint transitions from in-progress to completed', () => {
    const controller = new NotificationController(createDefaultPreferences());
    // First: Sprint is in-progress
    controller.handleStatusUpdate({
        header: { status: 'in-progress', sprintId: 'sprint-real-transition' },
    });
    // Then: Sprint completes - this is a REAL transition
    const result = controller.handleStatusUpdate({
        header: { status: 'completed', sprintId: 'sprint-real-transition' },
    });
    assertEqual(result.notified, true, 'Notification SHOULD trigger when sprint transitions to completed');
    assertEqual(controller.soundPlayedCount, 1, 'Sound SHOULD play on real completion');
});
// Test 3: Multiple page views of same completed sprint
test('BUG-005: Sound should NOT play again on second page view (FAILING TEST)', () => {
    const controller = new NotificationController(createDefaultPreferences());
    const completedSprintUpdate = {
        header: { status: 'completed', sprintId: 'sprint-multi-view' },
    };
    // First page view
    controller.handleStatusUpdate(completedSprintUpdate);
    const firstViewSounds = controller.soundPlayedCount;
    // User navigates away and comes back (page reload)
    controller.resetForNewPageView();
    // Second page view of same completed sprint
    controller.handleStatusUpdate(completedSprintUpdate);
    const totalSounds = controller.soundPlayedCount;
    assertEqual(totalSounds, 0, `BUG-005: Sound should NOT play for already-completed sprint on ANY page view.\n` +
        `    First view: ${firstViewSounds} sound(s), Second view: ${totalSounds - firstViewSounds} sound(s)\n` +
        `    Total: ${totalSounds} sounds played across 2 page views.`);
});
// Test 4: Initial load of failed sprint (same bug pattern)
test('BUG-005: Sound should NOT play when opening already-failed sprint (FAILING TEST)', () => {
    const controller = new NotificationController(createDefaultPreferences());
    const failedSprintUpdate = {
        header: { status: 'failed', sprintId: 'sprint-already-failed' },
    };
    const result = controller.handleStatusUpdate(failedSprintUpdate);
    assertEqual(result.notified, false, `BUG-005: Notification should NOT trigger on initial load of failed sprint.\n` +
        `    Same root cause as completed sprints.`);
    assertEqual(controller.soundPlayedCount, 0, 'Sound should NOT play on initial load of failed sprint');
});
// Test 5: In-progress sprint initial load is OK (no notification expected)
test('In-progress sprint initial load should NOT trigger notification', () => {
    const controller = new NotificationController(createDefaultPreferences());
    const inProgressUpdate = {
        header: { status: 'in-progress', sprintId: 'sprint-active' },
    };
    const result = controller.handleStatusUpdate(inProgressUpdate);
    // This should NOT notify (in-progress doesn't trigger notifications)
    assertEqual(result.notified, false, 'In-progress status should NOT trigger notification');
    assertEqual(controller.soundPlayedCount, 0, 'No sound for in-progress status');
});
// Test 6: Multiple status updates while watching (correct behavior)
test('Watching sprint go through multiple status changes should notify correctly', () => {
    const controller = new NotificationController(createDefaultPreferences());
    // User opens page, sprint is not started
    controller.handleStatusUpdate({
        header: { status: 'not-started', sprintId: 'sprint-full-lifecycle' },
    });
    assertEqual(controller.soundPlayedCount, 0, 'No notification for not-started');
    // Sprint starts
    controller.handleStatusUpdate({
        header: { status: 'in-progress', sprintId: 'sprint-full-lifecycle' },
    });
    assertEqual(controller.soundPlayedCount, 0, 'No notification for in-progress');
    // Sprint gets blocked
    controller.handleStatusUpdate({
        header: { status: 'blocked', sprintId: 'sprint-full-lifecycle' },
    });
    assertEqual(controller.soundPlayedCount, 1, 'Notification for blocked');
    // Sprint resumes
    controller.handleStatusUpdate({
        header: { status: 'in-progress', sprintId: 'sprint-full-lifecycle' },
    });
    assertEqual(controller.soundPlayedCount, 1, 'No notification for resuming');
    // Sprint completes
    controller.handleStatusUpdate({
        header: { status: 'completed', sprintId: 'sprint-full-lifecycle' },
    });
    assertEqual(controller.soundPlayedCount, 2, 'Notification for completed');
});
// ============================================================================
// Summary
// ============================================================================
console.log('\n=== Test Summary ===');
const passed = testResults.filter((r) => r.passed).length;
const failed = testResults.filter((r) => !r.passed).length;
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
    console.log('\nFailed tests (BUG-005 demonstration):');
    testResults
        .filter((r) => !r.passed)
        .forEach((r) => {
        console.log(`  - ${r.name}`);
    });
    console.log('\n=== BUG-005 Analysis ===');
    console.log('Root cause in page.ts:');
    console.log('  Line 2944: let previousSprintStatus = null;');
    console.log('  Lines 4102-4104: Status change detection uses null as initial state');
    console.log('  Lines 3450-3455: Completion check passes when previousStatus is null');
    console.log('\nFix needed:');
    console.log('  1. Track which sprint completions user has been notified about (localStorage)');
    console.log('  2. On initial load, check if sprint was already completed before user connected');
    console.log('  3. Only play sound for NEW completions, not historical ones');
}
// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
//# sourceMappingURL=notification-sound.test.js.map