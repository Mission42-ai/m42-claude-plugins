# Sprint Dashboard Fixes & Improvements

## User Preferences (Confirmed)
- **Stale timeout**: 15 minutes
- **Stale action**: Show badge + recovery option button
- **Message display**: Show full assistant content

---

## Issues to Fix (Priority Order)

### 1. Live Activity Content (P0 - Highest)
**Problem**: Only shows tool name + truncated file path. Assistant messages/thinking are not displayed.
**Desired**: Chat-like UI with:
- Assistant text/thinking in normal style (the core content) - show full content
- Tool calls in light grey/secondary styling
- Better content summaries for TodoWrite, Edit, Read

### 2. Sprint Dropdown Switching (P1)
**Problem**: Navigation happens but SSE connection stays bound to original sprint.
**Desired**: Switching sprints should fully load the new sprint's data and activity.

### 3. Elapsed Time for Steps (P2)
**Problem**: `'started-at'` and `'completed-at'` timestamps exist but `elapsed` string is never calculated.
**Desired**: Show elapsed time for each step/phase in the sidebar.

### 4. Overall Sprint Duration (P3)
**Problem**: Footer timer exists but isn't prominent.
**Desired**: Prominent timer in header showing how long the sprint has been running.

### 5. Iterations/Steps Planned (P4)
**Problem**: PROGRESS.yaml has step counts but not displayed in UI.
**Desired**: Show "Step X of Y" progress indicator.

### 6. Stale Sprint Detection (P1 - Critical)
**Problem**: If Claude process crashes, sprint stays `in-progress` forever. No heartbeat or watchdog.
**Desired**:
- Detect stale sprints (no activity for 15 minutes)
- Show "Stale" badge in UI
- Show "Resume" button to attempt recovery

---

## Implementation Plan

### Phase 1: Live Activity Chat-Like UI

**Files to modify:**
- `plugins/m42-sprint/compiler/src/status-server/activity-types.ts`
- `plugins/m42-sprint/compiler/src/status-server/transcription-watcher.ts`
- `plugins/m42-sprint/compiler/src/status-server/page.ts`

**Changes:**

1. **Extend ActivityEvent type** (`activity-types.ts`):
```typescript
export type ActivityEventType = 'tool' | 'assistant';

export interface ActivityEvent {
  ts: string;
  type: ActivityEventType;  // Changed from hardcoded 'tool'
  tool?: string;            // Optional (only for tool events)
  level: VerbosityLevel;
  file?: string;
  params?: string;
  text?: string;            // NEW: Assistant text content
  isThinking?: boolean;     // NEW: True if from thinking block
}
```

2. **Extract assistant text** (`transcription-watcher.ts`):
   - Parse `content_block_start` with `type: "text"` for assistant messages
   - Parse `content_block_delta` with `text_delta` for incremental text
   - Accumulate text deltas with debouncing (emit every 500ms or on tool call)
   - Emit as `ActivityEvent` with `type: 'assistant'`

3. **Chat-like rendering** (`page.ts`):
   - Assistant messages: chat bubble style, full content
   - Tool calls: grey/secondary style, icon + name + description
   - Better tool descriptions:
     - TodoWrite → "Updated task list"
     - Edit → "Editing {filename}"
     - Read → "Reading {filename}"

### Phase 2: Sprint Dropdown & Stale Detection

**Files to modify:**
- `plugins/m42-sprint/compiler/src/status-server/page.ts`
- `plugins/m42-sprint/compiler/src/status-server/server.ts`
- `plugins/m42-sprint/runtime/src/loop.ts`
- `plugins/m42-sprint/runtime/src/cli.ts`

**Changes:**

1. **Fix dropdown** (`page.ts`):
   - Close existing SSE connection on change
   - Navigate to `/sprint/{id}` (full page reload ensures fresh SSE)
   - Add loading indicator during navigation

2. **Add heartbeat** (`loop.ts`):
   - Write `last-activity` timestamp to PROGRESS.yaml each iteration
   - Add `process.on('SIGTERM')` and `process.on('SIGINT')` handlers
   - On signal: mark sprint as `interrupted` status before exit

3. **Detect staleness** (`transforms.ts` / `page.ts`):
   - If status is `in-progress` but `last-activity` > 15 min ago → stale
   - Show "Stale" badge next to status
   - Show "Resume Sprint" button

4. **Resume endpoint** (`server.ts`):
   - Add `/api/sprint/:id/resume` endpoint
   - Triggers sprint loop restart for that sprint

### Phase 3: Elapsed Time & Progress Display

**Files to modify:**
- `plugins/m42-sprint/compiler/src/status-server/transforms.ts`
- `plugins/m42-sprint/compiler/src/status-server/page.ts`
- `plugins/m42-sprint/compiler/src/status-server/status-types.ts`

**Changes:**

1. **Calculate elapsed** (`transforms.ts`):
   - In `buildSubPhaseNode()`, `buildStepNode()`, `buildTopPhaseNode()`:
   - If `elapsed` not set but `started-at` exists → calculate using `calculateElapsed()`

2. **Prominent timer** (`page.ts`):
   - Add `⏱ HH:MM:SS` timer in header-right section
   - Large font, blue accent color
   - Update every second via `updateElapsedTimes()`

3. **Step progress** (`transforms.ts` + `page.ts`):
   - Count total steps from phases
   - Add `totalSteps` to `SprintHeader`
   - Display "Step X of Y" in header

---

## Critical Files Summary

| File | Changes |
|------|---------|
| `activity-types.ts` | Add `assistant` type, `text`, `isThinking` fields |
| `transcription-watcher.ts` | Extract assistant text from NDJSON stream |
| `page.ts` | Chat UI, timer, dropdown fix, stale badge, step count |
| `transforms.ts` | Calculate elapsed, detect staleness, count steps |
| `server.ts` | Resume endpoint for stale sprints |
| `loop.ts` | Heartbeat timestamp, graceful shutdown handlers |
| `cli.ts` | SIGTERM/SIGINT handlers |

---

## Verification

1. **Live Activity**: Start sprint, verify assistant messages appear in chat style with tools in grey
2. **Sprint dropdown**: Switch sprints via dropdown, verify new sprint's data loads
3. **Elapsed time**: Verify steps show elapsed time in sidebar (e.g., "2m 15s")
4. **Sprint timer**: Verify prominent HH:MM:SS timer in header
5. **Step count**: Verify "Step X of Y" displays
6. **Stale detection**: Kill sprint process, wait 15 min, verify "Stale" badge + "Resume" button
7. **Model selection**: Verify model override works at step > phase > sprint > workflow levels

---

## Issue 7: Model Selection per Level (NEW)

**Problem**: No way to configure which model (sonnet, opus, haiku) to use for different tasks.
**Desired**: Cascading model configuration with override priority: step > phase > sprint > workflow

### Schema Design

```yaml
# Workflow level (lowest priority)
workflow: plugin-development
model: sonnet  # Default for all phases

# Sprint level (overrides workflow)
model: sonnet

steps:
  - prompt: "Simple task"
    # Uses sprint default (sonnet)
  - prompt: "Complex reasoning task"
    model: opus  # Step override (highest priority)

# Phase level (in workflow YAML)
phases:
  - id: planning
    model: opus  # Override for this phase
```

### Files to Modify

| File | Changes |
|------|---------|
| `compiler/src/compile.ts` | Parse model fields, resolve cascading |
| `compiler/src/types.ts` | Add model to SprintConfig, Step, Phase types |
| `runtime/src/loop.ts` | Pass resolved model to claude-runner |
| `runtime/src/claude-runner.ts` | Add --model flag to CLI invocation |
| `status-server/page.ts` | Display model indicator (optional) |
