# Bugs Discovered - Dashboard Bug Fixes

## BUG-001: Sprint Steps Show No Progress Indicators
**Severity**: HIGH
**Feature**: Status dashboard - sprint detail page
**Reporter**: User observation
**Status**: FIXED

### Description
Die "steps" im Sprint Review zeigen aktuell keine Indikationen, ob etwas läuft oder gelaufen ist (sind alles leere Kreise).

### Expected Behavior
Steps should show visual indicators:
- Completed steps: filled/checked circle
- In-progress steps: animated/partial circle
- Pending steps: empty circle

### Location
- `plugins/m42-sprint/compiler/src/status-server/` - Frontend components
- Step rendering logic in React components
- **Root cause**: `plugins/m42-sprint/runtime/src/loop.ts` - runtime wasn't updating step/subphase statuses

### Fix Applied
The fix was already implemented in `loop.ts` at lines 485-584. The runtime now:
1. Marks step/sub-phase as 'in-progress' before Claude execution (lines 486-506)
2. Marks step/sub-phase as 'completed' on success (lines 551-566)
3. Marks step/sub-phase as 'failed' on error (lines 576-584)

Tests added in:
- `runtime/src/loop.test.ts`: BUG-001 specific tests
- `compiler/src/status-server/transforms.test.ts`: Status preservation tests

---

## BUG-002: Worktree Filter Shows No Sprints
**Severity**: HIGH
**Feature**: Status dashboard - worktree filter
**Reporter**: User observation
**Status**: FIXED

### Description
Wenn ich auf dem Dashboard einen Worktree auswähle außer "All Worktrees", dann sehe ich keine Sprints in der Liste.

### Expected Behavior
Selecting a specific worktree should filter sprints to show only those belonging to that worktree.

### Location
- Status server dashboard filtering logic
- Worktree detection and sprint association
- **Root cause**: `dashboard-page.ts` used `extractWorktreeName(sprint.path)` which returns the directory basename, while `/api/worktrees` normalizes main worktree to `'main'`

### Fix Applied
Modified `dashboard-page.ts` to use `sprint.worktree?.name` from the server data with fallback to path extraction:
1. Server-side HTML generation (line 199): `sprint.worktree?.name ?? extractWorktreeName(sprint.path)`
2. Client-side JS for dynamic rows (line 910): `(sprint.worktree && sprint.worktree.name) || extractWorktreeName(sprint.path)`

The `sprint-scanner.ts` already normalizes the main worktree name to `'main'` (line 212), matching the `/api/worktrees` convention.

Tests added in:
- `compiler/src/status-server/worktree-filter.test.ts`: 7 test cases covering all edge cases

---

## BUG-003: Live Activity Always Shows "Waiting for activity"
**Severity**: HIGH (core feature broken)
**Feature**: Status dashboard - live activity panel
**Reporter**: User observation
**Status**: FIXED

### Description
Die "Live Activity" auf der Sprint Detailseite zeigt immer "Waiting for activity" an.

### Expected Behavior
Live activity should show real-time tool usage and events from `.sprint-activity.jsonl`.

### Root Cause
The `sprint-activity-hook.sh` script was using `jq -n` which produces multi-line pretty-printed JSON output. The `ActivityWatcher` parses the `.sprint-activity.jsonl` file line-by-line, expecting each line to be a complete JSON object (JSONL format). Multi-line JSON cannot be parsed this way, resulting in zero valid events being detected.

### Location
- `plugins/m42-sprint/hooks/sprint-activity-hook.sh` - Hook script that writes activity events
- `plugins/m42-sprint/compiler/src/status-server/activity-watcher.ts` - Watches and parses activity file
- `plugins/m42-sprint/compiler/src/status-server/server.ts` - Broadcasts activity events via SSE

### Fix Applied
Changed all 9 occurrences of `jq -n` to `jq -cn` in `sprint-activity-hook.sh`. The `-c` flag enables compact output, producing single-line JSON suitable for JSONL format.

**Before (buggy):**
```bash
OUTPUT=$(jq -n \
  --arg ts "$TIMESTAMP" \
  --arg type "tool" \
  ...
```
Produces:
```json
{
  "ts": "2026-01-20T12:00:00Z",
  "type": "tool",
  ...
}
```

**After (fixed):**
```bash
OUTPUT=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg type "tool" \
  ...
```
Produces:
```json
{"ts":"2026-01-20T12:00:00Z","type":"tool",...}
```

### Tests Added
- `compiler/src/status-server/activity.test.ts` - 12 comprehensive test cases:
  - BUG-003: sprint-activity-hook.sh produces single-line JSONL output
  - BUG-003: ActivityWatcher fails to parse multi-line JSON entries
  - isActivityEvent validates required fields
  - isActivityEvent accepts optional fields
  - ActivityWatcher emits activity events for new JSONL entries
  - ActivityWatcher emits events for appended entries
  - ActivityWatcher reads initial content on start
  - StatusServer broadcasts activity events to SSE clients
  - StatusServer activity events contain correct data structure
  - ActivityWatcher handles malformed JSONL lines gracefully
  - ActivityWatcher handles empty file
  - ActivityWatcher handles file not existing initially

### Verification
1. All 12 activity tests pass
2. Manual test confirms hook produces single-line JSONL
3. ActivityWatcher correctly parses and emits events
4. SSE broadcast to frontend works correctly
5. Edge cases (multiple events, different verbosity, invalid input) all handled correctly

---

## BUG-004: Performance Metrics Cluttered and Uninformative
**Severity**: MEDIUM (usability/polish)
**Feature**: Status dashboard - performance metrics
**Reporter**: User observation
**Status**: FIXED

### Description
Die Performance Metrics sind ziemlich cluttered und nichtsaussagend. Da darf nochmal etwas Gedanken und Energie reinfließen das auszuarbeiten.

### Expected Behavior
Performance metrics should be:
- Clear and easy to understand
- Visually organized
- Provide actionable insights
- Show meaningful aggregations

### Location
- `plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts` - `generateMetricsSection()` function
- `plugins/m42-sprint/compiler/src/status-server/metrics-aggregator.ts` - Metrics calculation

### Fix Applied
The metrics section was completely redesigned with a categorized layout showing 4 distinct sections:

1. **Status Category** (5 cards with visual hierarchy):
   - Success Rate (primary, wide card with color coding: green ≥80%, yellow ≥50%, red <50%)
   - Total Sprints, Completed Sprints, Failed Sprints, In Progress (secondary cards)

2. **Performance Category** (2 cards):
   - Avg Duration (human-readable format)
   - Avg Steps per sprint

3. **Workflows Category** (2 cards):
   - Most Used Workflow (with percentage)
   - Workflow Distribution (bar chart showing top 5 workflows)

4. **Activity Trend Category** (3 cards):
   - Today's activity (count + completed/failed breakdown)
   - This Week's activity (count + breakdown)
   - 7-Day Trend sparkline (interactive bar chart with hover tooltips)

### Key Improvements
- **Organized by category**: Clear groupings (Status, Performance, Workflows, Trends)
- **Visual hierarchy**: Primary metrics are larger/more prominent than secondary
- **All computed metrics utilized**: All 12 calculated metrics from MetricsAggregator are now displayed
- **Contextual information**: Success rate shows "X/Y finished" context, tooltips provide details
- **Color coding**: Green for success, yellow for warning, red for danger
- **Responsive design**: Adapts to mobile (1 column), tablet (2 columns), desktop (full layout)
- **Interactive elements**: Sparkline bars show hover tooltips with date and success rate

### Tests
- 9 unit tests in `dashboard-page.test.ts` covering:
  - Status breakdown display
  - Category organization
  - Workflow statistics
  - Average steps display
  - Trend information
  - Success rate context
  - Visual hierarchy
  - Metrics utilization (≥75% of calculated metrics displayed)

### Verification
1. All 9 dashboard-page tests pass
2. Visual inspection confirms clear organization and scannability
3. Metrics show actionable insights (success rate, trends, workflow patterns)
4. Information density is appropriate with proper spacing

---

## BUG-005: Completed Sprint Triggers Completion Sound
**Severity**: MEDIUM (annoying UX bug)
**Feature**: Status dashboard - completion notifications
**Reporter**: User observation
**Status**: FIXED

### Description
Wenn ich auf einen fertigen Sprint klicke, dann bekomme ich sofort die Sound Notification, als ob der Sprint gerade abgeschlossen wäre (was er aber schon lange ist).

### Expected Behavior
Completion sound should only play ONCE when sprint transitions to completed status, not every time the page is viewed.

### Location
- Status server notification logic
- Sound trigger code in frontend
- **Root cause**: `plugins/m42-sprint/compiler/src/status-server/page.ts` - `checkAndSendNotification()` was called with `previousStatus === null` on initial page load

### Fix Applied
Added early return guard in `checkAndSendNotification()` (line 3445-3448):
```javascript
// BUG-005 fix: Skip notifications on initial page load (previousStatus is null)
// When user opens a page for an already-completed/failed sprint, we should not
// play sounds or show notifications - the sprint was already in that state
if (previousStatus === null) return;
```

This ensures notifications only trigger for actual status transitions, not initial page loads where `previousSprintStatus` is null.

### Tests Added
- `compiler/src/status-server/notification-sound.test.ts` - 6 test cases:
  - BUG-005: Sound should NOT play when opening already-completed sprint
  - Sound SHOULD play when sprint transitions from in-progress to completed
  - BUG-005: Sound should NOT play again on second page view
  - BUG-005: Sound should NOT play when opening already-failed sprint
  - In-progress sprint initial load should NOT trigger notification
  - Watching sprint go through multiple status changes should notify correctly

### Verification
1. All 6 notification tests pass
2. Fix covers completed, failed, blocked, and needs-human status types
3. Real-time transitions still work correctly
4. Edge case: user watching sprint lifecycle from start to completion is handled

---

## BUG-006: Total Sprint Duration Not Displayed
**Severity**: MEDIUM (missing information)
**Feature**: Status dashboard - sprint detail page
**Reporter**: User observation
**Status**: FIXED

### Description
Ich sehe nirgends mehr auf der Sprint Detailseite, wie lange der Sprint in Summe gelaufen ist.

### Expected Behavior
Sprint detail page should prominently display total duration:
- For completed sprints: total elapsed time
- For running sprints: current elapsed time (updating)
- Format: human-readable (e.g., "2h 34m 12s" or "45 minutes")

### Root Cause
The `updateHeader()` function in `page.ts` only set `elements.elapsed.dataset.startedAt` from `header.startedAt`, relying on the `updateElapsedTimes()` timer to display the elapsed time. However, the timer function returns early for terminal statuses ('completed', 'failed', 'blocked', 'needs-human', 'paused'), so elapsed time was never displayed for completed sprints.

### Location
- `plugins/m42-sprint/compiler/src/status-server/page.ts` - `updateHeader()` function (lines 4236-4244)
- `plugins/m42-sprint/compiler/src/status-server/transforms.ts` - `header.elapsed` passed from `progress.stats.elapsed`

### Fix Applied
Added explicit elapsed time setting in `updateHeader()` for terminal sprint statuses (line 4240-4244):

```javascript
// BUG-006 fix: Set elapsed textContent directly for completed/terminal sprints
// The timer skips these statuses, so we must set the value here
if (header.elapsed && ['completed', 'failed', 'blocked', 'needs-human'].includes(header.status)) {
  elements.elapsed.textContent = 'Total: ' + header.elapsed;
}
```

For running sprints (in-progress), the timer continues to calculate and update elapsed from `startedAt` every second.

### Tests Added
- `compiler/src/status-server/total-duration.test.ts` - 6 comprehensive test cases:
  - toStatusUpdate should include elapsed time in header for completed sprints
  - toStatusUpdate should include elapsed time in header for in-progress sprints
  - toStatusUpdate header should include startedAt for duration calculation
  - Page HTML should include a dedicated total duration element
  - Page CSS should style total duration prominently
  - Page JavaScript should set elapsed for completed sprints without relying on timer

### Verification
1. All 6 BUG-006 tests pass
2. Completed sprints display "Total: Xh Ym" in footer
3. Running sprints update elapsed time every second
4. Terminal statuses (completed/failed/blocked/needs-human) display static elapsed from PROGRESS.yaml

### Note: Potential Follow-up
Paused sprints are not included in the fix array because `progress.stats.elapsed` is not written when a sprint is paused (only on completion). For paused sprints, the elapsed time would need to be calculated on-the-fly from `startedAt`. This could be addressed in a future enhancement if users report it as an issue.

---

## BUG-007: Steps/Substeps Missing Duration and Clickable Logs
**Severity**: HIGH (usability/discoverability)
**Feature**: Status dashboard - step/substep display
**Reporter**: User observation
**Status**: FIXED

### Description
Ich würde gerne, dass jeder Step/Substep mir in der Liste anzeigt wie lange er gelaufen ist (oder gerade läuft) - und idealerweise sind die Einträge auch klickbar, sodass ich mir vorherige Logs anschauen kann.

### Expected Behavior
- Each step/substep shows duration (elapsed or total)
- Steps are clickable to view logs
- Visual indication of clickability (hover state, cursor)
- Log viewer opens in modal or side panel

### Root Cause
1. **Duration**: `transforms.ts` only copied `elapsed` from PROGRESS.yaml. In-progress nodes have `started-at` timestamps but no pre-computed `elapsed` field.
2. **Clickability**: Only the "View Log" button on leaf nodes was clickable. Step/substep rows themselves had no click handlers.

### Location
- `plugins/m42-sprint/compiler/src/status-server/transforms.ts` - Duration computation
- `plugins/m42-sprint/compiler/src/status-server/page.ts` - Click handlers and CSS

### Fix Applied

**1. Duration Display (transforms.ts lines 187-201):**
Added `computeElapsedIfNeeded()` helper function that computes elapsed time on-the-fly for in-progress nodes:
```typescript
function computeElapsedIfNeeded(
  existingElapsed: string | undefined,
  startedAt: string | undefined,
  status: PhaseStatus
): string | undefined {
  if (existingElapsed) return existingElapsed;
  if (startedAt && status === 'in-progress') {
    return calculateElapsed(startedAt);
  }
  return undefined;
}
```

This function is called in `buildSubPhaseNode()`, `buildStepNode()`, and `buildTopPhaseNode()` to ensure all nodes with timestamps have duration data.

**2. Clickable Step Rows (page.ts lines 4363-4380):**
Added click handler to `.tree-node-content` elements:
```javascript
// BUG-007 FIX: Add click handlers to tree-node-content for easier log access
elements.phaseTree.querySelectorAll('.tree-node-content').forEach(content => {
  content.addEventListener('click', function(e) {
    if (e.target.closest('.tree-toggle, .tree-actions, button')) return;
    const node = this.closest('.tree-node');
    if (node) {
      const viewLogBtn = node.querySelector('.log-viewer-toggle');
      if (viewLogBtn && viewLogBtn.dataset.phaseId) {
        handleViewLogClick({ target: viewLogBtn, stopPropagation: function() {} });
      }
    }
  });
});
```

**3. Hover Styles (page.ts lines 655-657):**
CSS already includes hover state for visual feedback:
```css
.tree-node-content:hover {
  background-color: var(--bg-tertiary);
}
```

### Tests Added
- `compiler/src/status-server/step-duration-clickable.test.ts` - 9 test cases:
  - BUG-007 DETECTION: in-progress steps should have duration available
  - BUG-007 DETECTION: in-progress sub-phases should have duration available
  - BUG-007 DETECTION: toStatusUpdate provides duration for in-progress nodes
  - calculateElapsed works for in-progress (no end time)
  - BUG-007 DETECTION: step rows should be clickable
  - BUG-007 DETECTION: step rows should have click handlers for log viewing
  - BUG-007 DETECTION: clickable steps should have hover indication
  - completed steps still show elapsed time
  - View Log button is still rendered for leaf nodes

### Verification
1. All 9 BUG-007 tests pass
2. transforms.ts correctly computes elapsed for in-progress nodes
3. Click handlers on step rows work - clicking reveals View Log button
4. Log viewer modal opens with proper title and controls
5. Hover states provide visual feedback on interactive elements
