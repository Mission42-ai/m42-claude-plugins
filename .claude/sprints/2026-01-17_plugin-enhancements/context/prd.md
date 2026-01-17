# M42-Sprint Plugin Enhancement Plan

## Overview
Comprehensive improvements to the m42-sprint plugin focusing on reliability, visibility, and developer experience.

## Issues to Address

### 1. Status Server Reliability + Auto-Open Browser
**Problem:** Race condition with 2-second timeout; no auto-open browser functionality.

**Solution:**
- Add `EventEmitter` pattern to `StatusServer` with `waitForReady()` method
- Create cross-platform browser opener utility (`browser.ts`)
- Make status server startup blocking (mandatory before sprint loop starts)
- Write port file only AFTER server is confirmed listening
- **Auto-open browser by default** (use `--no-browser` flag to disable)

**Files:**
- `plugins/m42-sprint/compiler/src/status-server/browser.ts` - NEW
- `plugins/m42-sprint/compiler/src/status-server/server.ts` - Add EventEmitter, ready signal
- `plugins/m42-sprint/compiler/src/status-server/index.ts` - Wait for ready, auto-open
- `plugins/m42-sprint/commands/run-sprint.md` - Synchronous server startup

---

### 2. Sprint Dashboard/History View
**Problem:** No way to view past sprints or navigate between them.

**Solution:**
- Add URL routing: `/` (dashboard), `/sprint/:id` (detail view)
- Create `SprintScanner` to enumerate all sprints in `.claude/sprints/`
- **Show last 50 sprints** (sorted by date, newest first)
- Create `MetricsAggregator` for cross-sprint statistics
- Add dashboard page with sprint listing, status, dates, duration
- Add navigation between dashboard and individual sprint views

**Files:**
- `plugins/m42-sprint/compiler/src/status-server/sprint-scanner.ts` - NEW
- `plugins/m42-sprint/compiler/src/status-server/metrics-aggregator.ts` - NEW
- `plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts` - NEW
- `plugins/m42-sprint/compiler/src/status-server/server.ts` - Add routing
- `plugins/m42-sprint/compiler/src/status-server/page.ts` - Add navigation header
- `plugins/m42-sprint/commands/sprint-watch.md` - Add `--dashboard` mode

---

### 3. Elapsed Time Runs Indefinitely
**Problem:** Timer continues after sprint completes/pauses.

**Solution:**
In `page.ts`, modify `updateElapsedTimes()` to check sprint status:
```javascript
function updateElapsedTimes() {
  const terminalStatuses = ['completed', 'failed', 'stopped', 'blocked'];
  if (currentSprintStatus && terminalStatuses.includes(currentSprintStatus)) {
    return; // Stop updating for terminal states
  }
  // ... existing logic
}
```

**File:** `plugins/m42-sprint/compiler/src/status-server/page.ts` (~line 2989)

---

### 4. Default Max Iterations (30 → 60)
**Problem:** 30 iterations insufficient for larger sprints.

**Solution:** Update default in documentation and examples.

**Files:**
- `plugins/m42-sprint/commands/run-sprint.md` - Change `(default: 30)` to `(default: 60)`
- `plugins/m42-sprint/docs/reference/commands.md`
- `plugins/m42-sprint/docs/USER-GUIDE.md`

---

### 5. Desktop Notifications Not Working
**Problem:** Notifications enabled but not appearing.

**Solution:**
- Add error handling to `showNotification()` with try-catch
- Pre-initialize AudioContext on first user interaction (browser autoplay policy)
- Add "Test Notification" button in settings panel
- Show toast fallback when notification fails

**File:** `plugins/m42-sprint/compiler/src/status-server/page.ts` (~lines 1948-2169)

---

## Additional DX Improvements

### 6. Keyboard Shortcuts
Add keyboard navigation for common actions:
- `P` - Pause/Resume sprint
- `L` - Toggle live activity panel
- `N` - Notification settings
- `D` - Download all logs
- `Esc` - Close modals
- `?` - Show shortcuts help

**File:** `plugins/m42-sprint/compiler/src/status-server/page.ts`

---

### 7. Connection Status with Reconnection Info
Show reconnection attempt count and countdown timer when disconnected.

**File:** `plugins/m42-sprint/compiler/src/status-server/page.ts`

---

### 8. Enhanced Error Messages with Recovery Actions
When phases fail, show contextual error details with actionable recovery guidance based on error category (network, rate-limit, timeout, validation, logic).

**File:** `plugins/m42-sprint/compiler/src/status-server/page.ts`

---

### 9. Log Viewer Enhancements
- Add line numbers
- Search navigation (next/previous match)
- "Jump to Error" button

**File:** `plugins/m42-sprint/compiler/src/status-server/page.ts`

---

### 10. Mobile Responsiveness
Add responsive CSS for mobile/tablet viewing (remote status checking).

**File:** `plugins/m42-sprint/compiler/src/status-server/page.ts` (CSS section)

---

### 11. Performance Metrics Section
Collapsible section showing phase timing statistics from `/api/timing` endpoint.

**Files:**
- `plugins/m42-sprint/compiler/src/status-server/page.ts`
- `plugins/m42-sprint/compiler/src/status-server/server.ts` (extend if needed)

---

## Implementation Order

| Phase | Items | Priority |
|-------|-------|----------|
| **Phase 1** | #3 Elapsed timer fix, #4 Max iterations default, #5 Notifications | P0 - Quick wins |
| **Phase 2** | #1 Status server reliability + auto-open | P0 - Core reliability |
| **Phase 3** | #6 Keyboard shortcuts, #8 Error recovery guidance, #9 Log viewer | P1 - User-selected DX |
| **Phase 4** | #2 Sprint dashboard/history (last 50 sprints) | P1 - Major feature |
| **Phase 5** | #7 Connection status, #10 Mobile, #11 Metrics | P2 - Polish |

---

## Verification Plan

1. **Status Server**: Start sprint, verify browser opens automatically within 3s
2. **Dashboard**: Navigate to `/`, verify sprint list loads, click through to detail
3. **Elapsed Timer**: Complete a sprint, verify timer stops at completion time
4. **Max Iterations**: Run `/run-sprint --help`, verify default shows 60
5. **Notifications**: Enable notifications, trigger test, verify desktop notification appears
6. **Keyboard**: Press `?` to see shortcuts, test each shortcut works
7. **Connection**: Kill server briefly, verify countdown and reconnection display
8. **Build**: Run `npm run build && npm run typecheck` in compiler directory

---

## Critical Files Summary

| File | Changes |
|------|---------|
| `compiler/src/status-server/page.ts` | Elapsed fix, notifications, keyboard, connection, errors, logs, mobile, metrics |
| `compiler/src/status-server/server.ts` | EventEmitter, ready signal, routing, dashboard endpoints |
| `compiler/src/status-server/index.ts` | Wait for ready, auto-open browser |
| `compiler/src/status-server/browser.ts` | NEW - Cross-platform browser opener |
| `compiler/src/status-server/sprint-scanner.ts` | NEW - Enumerate sprints |
| `compiler/src/status-server/dashboard-page.ts` | NEW - Dashboard HTML |
| `commands/run-sprint.md` | Sync server start, max-iterations default |
| `commands/sprint-watch.md` | Dashboard mode |
