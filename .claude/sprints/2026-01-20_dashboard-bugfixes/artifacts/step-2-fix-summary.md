# BUG-003 Fix Summary: Live Activity Always Shows "Waiting for activity"

## Root Cause

**Multi-line JSON output instead of JSONL format.**

The `sprint-activity-hook.sh` script was using `jq -n` (null input mode) to construct JSON objects. Without the `-c` (compact) flag, jq produces human-readable multi-line output:

```json
{
  "ts": "2026-01-20T12:00:00Z",
  "type": "tool",
  "tool": "Read",
  "file": "/path/to/file.ts",
  "level": "basic"
}
```

The `ActivityWatcher` class parses `.sprint-activity.jsonl` line-by-line, expecting JSONL format (one JSON object per line). When it encountered multi-line JSON:
1. Each line was parsed independently
2. `{` alone is invalid JSON -> parse error, line skipped
3. `"ts": "2026-01-20T12:00:00Z",` is invalid JSON -> parse error, line skipped
4. All lines failed to parse
5. Zero valid events emitted
6. Frontend shows "Waiting for activity..." indefinitely

## Solution Implemented

Changed all 9 occurrences of `jq -n` to `jq -cn` in `sprint-activity-hook.sh`. The `-c` flag enables compact output mode:

### Before (Buggy)
```bash
OUTPUT=$(jq -n \
  --arg ts "$TIMESTAMP" \
  --arg type "tool" \
  --arg tool "$TOOL_NAME" \
  --arg level "$VERBOSITY" \
  '{ts: $ts, type: $type, tool: $tool, level: $level}')
```

### After (Fixed)
```bash
OUTPUT=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg type "tool" \
  --arg tool "$TOOL_NAME" \
  --arg level "$VERBOSITY" \
  '{ts: $ts, type: $type, tool: $tool, level: $level}')
```

Output is now compact single-line JSON:
```json
{"ts":"2026-01-20T12:00:00Z","type":"tool","tool":"Read","file":"/path/to/file.ts","level":"basic"}
```

## Data Flow (Now Working)

1. **Hook triggers**: Claude Code executes tool (Read, Write, Bash, etc.)
2. **Hook writes**: `sprint-activity-hook.sh` appends single-line JSON to `.sprint-activity.jsonl`
3. **Watcher detects**: `ActivityWatcher` sees file change via `fs.watch()`
4. **Watcher parses**: Reads new lines, `JSON.parse()` succeeds
5. **Watcher validates**: `isActivityEvent()` type guard validates structure
6. **Watcher emits**: `'activity'` event with `ActivityEvent` payload
7. **Server broadcasts**: `StatusServer` wraps in SSE `'activity-event'` message
8. **Frontend receives**: EventSource handler parses and calls `handleActivityEvent()`
9. **Frontend renders**: New activity entry appears in Live Activity panel

## Tests Added

File: `compiler/src/status-server/activity.test.ts` - 12 comprehensive test cases:

| Test | Purpose |
|------|---------|
| `BUG-003: sprint-activity-hook.sh produces single-line JSONL output` | Verifies hook fix produces compact JSON |
| `BUG-003: ActivityWatcher fails to parse multi-line JSON entries` | Documents why multi-line JSON breaks |
| `isActivityEvent validates required fields` | Type guard rejects invalid events |
| `isActivityEvent accepts optional fields` | Type guard accepts valid events |
| `ActivityWatcher emits activity events for new JSONL entries` | Core functionality works |
| `ActivityWatcher emits events for appended entries` | Tail-like behavior works |
| `ActivityWatcher reads initial content on start` | Historical activity loads |
| `StatusServer broadcasts activity events to SSE clients` | Full integration works |
| `StatusServer activity events contain correct data structure` | SSE payload format correct |
| `ActivityWatcher handles malformed JSONL lines gracefully` | Error recovery works |
| `ActivityWatcher handles empty file` | Edge case: empty file |
| `ActivityWatcher handles file not existing initially` | Edge case: file created later |

All 12 tests pass:
```
✓ BUG-003: sprint-activity-hook.sh produces single-line JSONL output
✓ BUG-003: ActivityWatcher fails to parse multi-line JSON entries
✓ isActivityEvent validates required fields
✓ isActivityEvent accepts optional fields
✓ ActivityWatcher emits activity events for new JSONL entries
✓ ActivityWatcher emits events for appended entries
✓ ActivityWatcher reads initial content on start
✓ StatusServer broadcasts activity events to SSE clients
✓ StatusServer activity events contain correct data structure
✓ ActivityWatcher handles malformed JSONL lines gracefully
✓ ActivityWatcher handles empty file
✓ ActivityWatcher handles file not existing initially

--- Test Summary ---
Passed: 12
Failed: 0
```

## Verification Steps

1. **Unit tests**: `npm run build && node dist/status-server/activity.test.js` - All 12 pass
2. **Hook output**: Single-line JSON confirmed
   ```
   {"ts":"2026-01-20T16:50:45Z","type":"tool","tool":"Read","file":"/test.ts","level":"basic"}
   ```
3. **Edge cases**: Multiple events append correctly, different verbosity levels work, invalid inputs handled gracefully

### Final Verification (2026-01-20)

**Test Suite Results:**
- `activity.test.js`: 12/12 passed
- `transforms.test.js`: 7/7 passed
- `dashboard-page.test.js`: 9/9 passed
- `step-progress.test.js`: 8/8 passed
- `step-indicators.test.js`: 7/7 passed
- `initial-activity.test.js`: 4/4 passed
- `worktree-filter.test.js`: 7/7 passed

**Manual Verification:**
- Hook script produces correct single-line JSONL for all verbosity levels (minimal, basic, detailed, verbose)
- Edge cases verified:
  - Empty input: exits cleanly (exit 0)
  - Invalid JSON input: exits cleanly (exit 0)
  - Missing tool_name: exits cleanly (exit 0)
  - Special characters in file paths: handled correctly with proper JSON escaping
  - Very long commands: handled correctly (tested 1000-character command)
  - Multiple appends: all events correctly appended to activity file

## Files Changed

| File | Change |
|------|--------|
| `hooks/sprint-activity-hook.sh` (9 locations) | `jq -n` -> `jq -cn` |
| `compiler/src/status-server/activity.test.ts` | New test file with 12 test cases |

## Important Note: Plugin Cache

The hook is installed to a plugin cache directory:
```
~/.claude/plugins/cache/m42-claude-plugins/m42-sprint/2.0.0/hooks/sprint-activity-hook.sh
```

The settings.json references this cached path, not the source file. If the fix isn't working after applying the source change, ensure the cached version is also updated. This can be done by:
1. Manually copying the fixed hook to the cache location
2. Reinstalling/updating the plugin
3. Clearing the plugin cache and restarting

## Follow-up Items

1. **Plugin version management**: Consider a mechanism to ensure plugin cache stays in sync with source changes during development
2. **Activity event enrichment**: Could add more context (e.g., file preview, command snippet) in verbose mode
3. **Activity persistence**: Could store activity history beyond single sprint session
