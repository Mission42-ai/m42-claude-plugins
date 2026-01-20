/**
 * Tests for Activity Feature - BUG-003: Live Activity Always Shows "Waiting for activity"
 *
 * Issue: The Live Activity panel on the Sprint Detail page always shows
 * "Waiting for activity..." even when activity events are being written
 * to .sprint-activity.jsonl.
 *
 * ROOT CAUSE: The sprint-activity-hook.sh uses `jq -n` without the `-c` flag,
 * producing multi-line pretty-printed JSON instead of compact single-line JSONL.
 * The ActivityWatcher expects one JSON object per line, so it fails to parse
 * multi-line output and emits zero valid events.
 *
 * FIX: Change all `jq -n` to `jq -cn` in sprint-activity-hook.sh to produce
 * compact single-line JSON output.
 *
 * Expected Behavior:
 * - Activity events written to .sprint-activity.jsonl should be:
 *   1. Written as single-line compact JSON (one per line)
 *   2. Detected by ActivityWatcher
 *   3. Parsed as valid ActivityEvent objects
 *   4. Emitted as 'activity' events
 *   5. Broadcast to SSE clients as 'activity-event' SSE events
 *   6. Displayed in the Live Activity panel
 *
 * This test verifies:
 * 1. The hook produces correct JSONL format (single-line JSON)
 * 2. Backend components (ActivityWatcher, StatusServer) work correctly
 */
export {};
//# sourceMappingURL=activity.test.d.ts.map