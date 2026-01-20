/**
 * Test for BUG-003: Live Activity Always Shows "Waiting for activity"
 *
 * ROOT CAUSE: When an SSE client connects, the StatusServer sends initial
 * `status-update` and `log-entry` events, but does NOT send historical
 * activity events from .sprint-activity.jsonl.
 *
 * The ActivityWatcher correctly reads initial content and emits 'activity'
 * events during server startup. However, no SSE clients are connected at
 * that time, so the historical activity is lost.
 *
 * When a client later connects, it only receives status updates and shows
 * "Waiting for activity..." because no activity events are sent.
 *
 * EXPECTED: When an SSE client connects, it should receive:
 * 1. status-update (current progress)
 * 2. log-entry (connection message)
 * 3. activity-event (for each historical activity entry, up to tailLines)
 *
 * This test verifies that historical activity is sent to newly connected clients.
 */
export {};
//# sourceMappingURL=initial-activity.test.d.ts.map