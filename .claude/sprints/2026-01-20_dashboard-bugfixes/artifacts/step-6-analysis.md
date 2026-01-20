# BUG-007 Analysis: Steps/Substeps Missing Duration and Clickable Logs

## Executive Summary

This is a **feature enhancement request** rather than a bug. The dashboard currently displays duration on nodes that have `elapsed` data, but there are gaps:

1. **Duration display exists** but only for nodes that already have computed `elapsed` values
2. **Log viewer exists and works** via "View Log" buttons, but only appears for leaf nodes (completed or in-progress)
3. **Steps/rows are NOT clickable** - only dedicated buttons are interactive

## Root Cause Analysis

### 1. Duration Display Gaps

**Location**: `page.ts:4415-4417` (renderTreeNode function)

```typescript
if (node.elapsed) {
  html += '<span class="tree-elapsed">' + node.elapsed + '</span>';
}
```

**Conditions causing missing duration**:
- Node's `elapsed` property is `undefined` or empty
- Phase hasn't started yet (`pending` status) - no `started-at` timestamp
- Elapsed calculation happens in `transforms.ts:77-95` but only when timestamps exist

**Data flow**:
1. Runtime writes `started-at` and `completed-at` to PROGRESS.yaml
2. `transforms.ts:calculateElapsed()` computes human-readable format
3. `buildPhaseNode()` in transforms adds `elapsed` to PhaseTreeNode
4. UI conditionally displays if `node.elapsed` is truthy

### 2. Click Handlers Only on Buttons

**Location**: `page.ts:4443-4444` (renderTreeNode function)

```typescript
// View Log button: visible for completed or in-progress phases (leaf nodes only)
if (!hasChildren && (node.status === 'completed' || node.status === 'in-progress')) {
  html += '<button class="log-viewer-toggle" data-phase-id="' + escapeHtml(phaseId) + '" title="View Log">View Log</button>';
}
```

**Conditions limiting clickability**:
- Button only renders for **leaf nodes** (`!hasChildren`)
- Only for **completed** or **in-progress** status
- Parent nodes (phases with steps) never get View Log button
- Row itself (`tree-node-content`) has no click handler

**Handler binding**: `page.ts:4359-4361`
```typescript
elements.phaseTree.querySelectorAll('.log-viewer-toggle').forEach(btn => {
  btn.addEventListener('click', handleViewLogClick);
});
```

### 3. Log Viewer Already Implemented

**Existing infrastructure**:
- Modal: `page.ts:237-253` - `.log-viewer-modal` with title, search, close button
- API: `server.ts:391-404` - `/api/logs/:phaseId` endpoint
- Handler: `server.ts:1396-1423` - `handleLogContentRequest()`
- Show function: `page.ts:3150-3166` - `showLogViewer(phaseId)`

The log viewer is **fully functional** - the issue is just **accessibility/discoverability**.

## What Tests Should Verify

### Duration Display Tests

1. **Every node with `started-at` shows elapsed time**
   - In-progress phases show live-updating elapsed
   - Completed phases show final duration
   - Pending phases show nothing (acceptable)

2. **Duration format is correct**
   - Sub-60 seconds: "45s"
   - Minutes: "3m 15s"
   - Hours: "2h 30m"

3. **Real-time updates for in-progress**
   - Timer increments every second for active phases

### Clickability Tests

1. **Row click opens log viewer** (NEW behavior)
   - Clicking anywhere on `tree-node-content` for leaf nodes
   - Parent nodes remain non-clickable (would be confusing)

2. **Visual hover state indicates clickability**
   - Cursor changes to pointer
   - Background highlights on hover

3. **Click on buttons still works**
   - Buttons don't conflict with row click
   - Event propagation handled correctly

### Log Navigation Tests

1. **Can navigate between step logs**
   - Prev/Next buttons or keyboard navigation
   - Current step highlighted in tree

2. **Real-time tailing for in-progress**
   - New log content appears automatically
   - Scroll follows new content (optional toggle)

## Files Requiring Changes

| File | Changes Needed | Priority |
|------|---------------|----------|
| `page.ts:4403-4417` | Add clickable row wrapper for leaf nodes | HIGH |
| `page.ts:733-737` | Add hover cursor/highlight for clickable rows | HIGH |
| `page.ts:4359-4361` | Bind click handler to row, not just button | HIGH |
| `page.ts:3150-3200` | Add prev/next log navigation | MEDIUM |
| `transforms.ts:200-300` | Ensure all started nodes get elapsed | MEDIUM |

## Implementation Recommendations

### Phase 1: Make Rows Clickable (Quick Win)

1. Add CSS cursor and hover state to leaf node rows
2. Bind click handler to `tree-node-content` div for leafs
3. Ensure button clicks don't double-fire

### Phase 2: Ensure Duration Everywhere

1. Verify all in-progress/completed nodes have `elapsed`
2. Add live timer update for in-progress nodes without stored elapsed
3. Test edge cases (paused sprints, skipped phases)

### Phase 3: Log Navigation Enhancement

1. Add prev/next controls to log viewer modal
2. Keyboard shortcuts (left/right arrow)
3. Auto-scroll toggle for live tailing

## Test File Locations

Create tests in: `plugins/m42-sprint/compiler/src/status-server/`

```
clickable-logs.test.ts     # Row clickability, log viewer opening
step-duration.test.ts      # Duration display for all node types
log-navigation.test.ts     # Prev/next navigation between logs
```

## Success Criteria Mapping

| Requirement | Implementation | Test |
|-------------|---------------|------|
| Every step shows duration | Ensure `elapsed` on all started nodes | Duration appears for in-progress/completed |
| Clicking step opens log | Row click handler + cursor styling | Click row → modal opens |
| Log viewer easy to use | Already implemented, add navigation | Can search, scroll, navigate |
| Real-time updates for running | Live timer + log tailing | Timer increments, new lines appear |
| Navigate between step logs | Prev/next buttons in modal | Can cycle through step logs |
