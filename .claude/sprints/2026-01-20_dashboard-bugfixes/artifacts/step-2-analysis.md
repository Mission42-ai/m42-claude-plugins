# BUG-003 Analysis: Live Activity Always Shows "Waiting for activity"

## Summary

**Severity**: HIGH (core feature broken)
**Root Cause**: Missing initial activity events on client connection
**Secondary Issue**: Activity file creation timing (initialization race condition)

---

## Root Cause Analysis

### Primary Issue: No Initial Activity Sent to New Clients

**Location**: `plugins/m42-sprint/compiler/src/status-server/server.ts:1592-1612`

**Function**: `sendInitialStatus(client: SSEClient)`

**Problem**: When a new SSE client connects, `sendInitialStatus()` sends:
1. `status-update` - sprint progress
2. `log-entry` - connection confirmation

**Missing**: Historical `activity-event` entries are NEVER sent to newly connecting clients.

The `ActivityWatcher.readInitialContent()` does read existing events and emits them, but this happens at server startup (line 72-73 in `activity-watcher.ts`) - BEFORE any clients connect. New clients miss all historical activity.

### Secondary Issue: Activity File Timing (Race Condition)

**Location**: `plugins/m42-sprint/hooks/sprint-activity-hook.sh`

**Problem**: The `.sprint-activity.jsonl` file is only created when the first PostToolUse event is captured. If the dashboard is opened before any tool execution, no activity file exists.

The `ActivityWatcher` handles this gracefully (watches directory, waits for file creation), but when the file is finally created, historical events are still not sent to already-connected clients.

---

## Data Flow Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Activity Flow - Current (Broken)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Tool Execution                                                             │
│       │                                                                     │
│       ▼                                                                     │
│  PostToolUse Hook (sprint-activity-hook.sh)                                │
│       │                                                                     │
│       ▼                                                                     │
│  .sprint-activity.jsonl (appends event)                                    │
│       │                                                                     │
│       ▼                                                                     │
│  ActivityWatcher (detects change)                                          │
│       │                                                                     │
│       ▼                                                                     │
│  Server.broadcast('activity-event', event) ────────► Connected Clients ✓   │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  NEW CLIENT CONNECTS                                                        │
│       │                                                                     │
│       ▼                                                                     │
│  sendInitialStatus()                                                        │
│       │                                                                     │
│       ├──► status-update (sprint progress) ✓                               │
│       └──► log-entry (connection msg) ✓                                    │
│       ✗    activity-event (historical) ← MISSING!                          │
│                                                                             │
│  Result: New client shows "Waiting for activity..." even if file has data  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Affected Code Locations

### 1. Server SSE Handler (Primary Fix Location)

**File**: `plugins/m42-sprint/compiler/src/status-server/server.ts`
**Function**: `sendInitialStatus()` (line 1592)

```typescript
private sendInitialStatus(client: SSEClient): void {
  try {
    const progress = this.loadProgress();
    this.lastProgress = progress;

    const timingInfo = this.getTimingInfo(progress);
    const statusUpdate = toStatusUpdate(progress, false, timingInfo);
    this.sendEvent(client, 'status-update', statusUpdate);

    // Send a log entry for connection
    const logEntry = createLogEntry('info', 'Connected to status server');
    this.sendEvent(client, 'log-entry', logEntry);

    // MISSING: Should send initial activity events here!
  } catch (error) {
    // ...
  }
}
```

### 2. ActivityWatcher Initial Read (Support)

**File**: `plugins/m42-sprint/compiler/src/status-server/activity-watcher.ts`
**Function**: `readInitialContent()` (line 106)

The watcher reads initial content on startup and emits events, but this method is private and called only once at server startup - not accessible for new client connections.

### 3. Frontend Handler

**File**: `plugins/m42-sprint/compiler/src/status-server/page.ts`
**Function**: `handleActivityEvent(event)` (line 4588)
**Function**: `renderLiveActivity()` (line 4629)

The frontend is correctly implemented - it handles activity events and displays them. The issue is upstream (server not sending initial events).

---

## Conditions That Trigger the Bug

1. **Always occurs on new client connection**: Any time a browser opens the dashboard
2. **Worsened when sprint is running**: More historical events exist but aren't shown
3. **Worsened on refresh**: Browser loses in-memory events, reconnects, gets nothing

---

## What a Proper Test Should Verify

### Unit Tests

1. **Activity file with existing events + new client connects**
   - Pre-populate `.sprint-activity.jsonl` with N events
   - Start server
   - Connect SSE client
   - Assert: Client receives N `activity-event` messages

2. **No activity file + new client connects**
   - No `.sprint-activity.jsonl` exists
   - Start server
   - Connect SSE client
   - Assert: Client receives 0 activity events (not an error)
   - Write to activity file
   - Assert: Client receives new events via broadcast

3. **Multiple clients receive same initial events**
   - Pre-populate activity file
   - Connect client A
   - Assert: A receives all events
   - Connect client B
   - Assert: B receives same events
   - Write new event
   - Assert: Both A and B receive it

### Integration Tests

1. **Full E2E flow**
   - Start sprint with hook registered
   - Open dashboard (client connects)
   - Execute some tools (generates activity)
   - Assert: Activity appears in real-time
   - Refresh dashboard (client reconnects)
   - Assert: Historical activity still visible

---

## Proposed Fix

### Option A: Add `sendInitialActivity()` Method (Recommended)

Add a new method to send historical activity on client connection:

```typescript
private sendInitialActivity(client: SSEClient): void {
  if (!fs.existsSync(this.activityFilePath)) {
    return; // No activity yet, that's fine
  }

  try {
    const content = fs.readFileSync(this.activityFilePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    // Send last N events (configurable, default 50)
    const tailLines = 50;
    const recentLines = lines.slice(-tailLines);

    for (const line of recentLines) {
      try {
        const event = JSON.parse(line);
        if (isActivityEvent(event)) {
          this.sendEvent(client, 'activity-event', event);
        }
      } catch {
        // Skip corrupted lines
      }
    }
  } catch (error) {
    console.error('[StatusServer] Failed to send initial activity:', error);
  }
}
```

Then call it from `sendInitialStatus()`:

```typescript
private sendInitialStatus(client: SSEClient): void {
  // ... existing code ...

  // Send initial activity events
  this.sendInitialActivity(client);
}
```

### Option B: Expose ActivityWatcher for Re-read

Modify `ActivityWatcher` to expose a method for reading all events:

```typescript
public getRecentEvents(count: number = 50): ActivityEvent[] {
  // Read and return recent events
}
```

Then use it in the server.

---

## Files to Modify

1. **`server.ts`**: Add `sendInitialActivity()` method, call from `sendInitialStatus()`
2. **`activity-watcher.ts`** (optional): Expose `getRecentEvents()` for cleaner architecture
3. **`server.test.ts`** (if exists): Add unit tests for initial activity sending

---

## Risk Assessment

**Fix Complexity**: Low
**Regression Risk**: Low - additive change, doesn't modify existing broadcast logic
**Testing Needed**: Medium - need to verify both initial load and real-time updates work

---

## Verification Commands

```bash
# Check if activity file exists and has content
cat /path/to/sprint/.sprint-activity.jsonl | wc -l

# Verify hook is registered
cat /path/to/sprint/.sprint-hooks.json

# Test hook manually
echo '{"tool_name":"Test","tool_input":{},"tool_response":{}}' | \
  bash /path/to/hooks/sprint-activity-hook.sh /path/to/sprint/
```
