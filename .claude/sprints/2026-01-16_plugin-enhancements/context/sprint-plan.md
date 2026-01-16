# Sprint Plan: 2026-01-16_plugin-enhancements

## Goal

Implement four tracks of enhancements to the m42-sprint plugin: (A) interactive control buttons for the status page with pause/resume/stop functionality, (B) new skills for workflow and sprint authoring guidance, (C) live Claude Code hook integration for activity logging with real-time UI updates, and (D) future enhancements including skip/retry buttons, phase log viewer, desktop notifications, progress estimation, and improved error recovery.

## Success Criteria

- [ ] Status page has working Pause/Resume/Stop buttons with API endpoints
- [ ] `creating-workflows` skill provides comprehensive workflow authoring guidance
- [ ] `creating-sprints` skill provides sprint definition best practices
- [ ] PostToolCall hook captures activity to JSONL file
- [ ] Status page shows live activity panel with verbosity control
- [ ] Hook auto-configuration integrated into run-sprint command
- [ ] Skip/Retry buttons work for individual phases
- [ ] Phase logs are viewable and downloadable
- [ ] Desktop notifications fire for sprint events
- [ ] Progress estimation shows ETA based on historical timing
- [ ] Auto-retry with backoff implemented for transient failures

## Step Breakdown

### Step 0: Track A - Add API Endpoints for Status Page Controls
**Scope**: Add POST endpoints for pause/resume/stop that create signal files, plus GET endpoint for available actions
**Files**: `compiler/src/status-server/server.ts`
**Dependencies**: None
**Risk**: Low - extends existing server with standard HTTP handlers

### Step 1: Track A - Add Button UI Components to Status Page
**Scope**: Implement control bar with buttons, confirmation modals, loading states, and toast notifications
**Files**: `compiler/src/status-server/page.ts`
**Dependencies**: Step 0 (API endpoints must exist)
**Risk**: Medium - significant UI work in template literal format

### Step 2: Track B - Create creating-workflows Skill Structure
**Scope**: New skill with comprehensive workflow definition guidance, schema reference, templates
**Files**:
- `skills/creating-workflows/creating-workflows.md`
- `skills/creating-workflows/references/*.md` (4 files)
- `skills/creating-workflows/assets/*.{yaml,md}` (3 files)
**Dependencies**: None
**Risk**: Low - documentation/skill creation, no runtime impact

### Step 3: Track B - Create creating-sprints Skill Structure
**Scope**: New skill for sprint definition guidance with best practices and templates
**Files**:
- `skills/creating-sprints/creating-sprints.md`
- `skills/creating-sprints/references/*.md` (3 files)
- `skills/creating-sprints/assets/sprint-template.yaml`
**Dependencies**: None
**Risk**: Low - documentation/skill creation, no runtime impact

### Step 4: Track C - Create Sprint Activity Hook Script
**Scope**: Bash script that parses PostToolCall events and writes to JSONL
**Files**: `hooks/sprint-activity-hook.sh`
**Dependencies**: None
**Risk**: Low - standalone script with simple I/O

### Step 5: Track C - Implement Activity Watcher in Status Server
**Scope**: TypeScript module to watch JSONL file and stream events via SSE
**Files**:
- `compiler/src/status-server/activity-watcher.ts` (new)
- `compiler/src/status-server/activity-types.ts` (new)
- `compiler/src/status-server/server.ts` (integrate watcher)
**Dependencies**: Step 4 (hook must produce JSONL file)
**Risk**: Medium - file watching and SSE integration

### Step 6: Track C - Add Live Activity UI Panel to Status Page
**Scope**: UI panel with activity display, verbosity selector, auto-scroll, and tool icons
**Files**: `compiler/src/status-server/page.ts`
**Dependencies**: Step 5 (SSE events must be available)
**Risk**: Medium - significant UI work with state management

### Step 7: Track C - Integrate Hook Auto-Configuration in run-sprint
**Scope**: Auto-generate hook config and pass to claude -p invocations
**Files**:
- `.claude/commands/m42-sprint/run-sprint` (modify)
- `scripts/sprint-loop.sh` (add --hook-config flag)
**Dependencies**: Steps 4, 5, 6 (hook system must be complete)
**Risk**: Medium - modifies critical execution path

### Step 8: Track D - Add Skip/Retry Phase Buttons
**Scope**: API endpoints and UI for skipping stuck phases and retrying failed ones
**Files**:
- `compiler/src/status-server/server.ts` (API endpoints)
- `compiler/src/status-server/page.ts` (contextual buttons)
**Dependencies**: Steps 0, 1 (control infrastructure)
**Risk**: Medium - requires careful PROGRESS.yaml manipulation

### Step 9: Track D - Implement Phase Log Viewer
**Scope**: Capture and display Claude output per phase with syntax highlighting
**Files**:
- `scripts/sprint-loop.sh` (tee to log files)
- `compiler/src/status-server/server.ts` (log serving endpoints)
- `compiler/src/status-server/page.ts` (log viewer UI)
**Dependencies**: None
**Risk**: Medium - large log handling, ANSI conversion

### Step 10: Track D - Add Desktop Notifications
**Scope**: Browser Notification API integration with permission flow and settings
**Files**: `compiler/src/status-server/page.ts`
**Dependencies**: None
**Risk**: Low - client-side only, well-documented API

### Step 11: Track D - Implement Progress Estimation
**Scope**: Track timing data and display ETA based on historical averages
**Files**:
- `scripts/sprint-loop.sh` (record phase timing)
- `compiler/src/status-server/server.ts` (timing endpoints)
- `compiler/src/status-server/page.ts` (estimation UI)
- `compiler/src/status-server/timing-tracker.ts` (new)
**Dependencies**: None
**Risk**: Medium - requires historical data collection and analysis

### Step 12: Track D - Implement Improved Error Recovery
**Scope**: Auto-retry with backoff, error classification, and intervention queue
**Files**:
- `scripts/sprint-loop.sh` (retry logic)
- `compiler/src/compiler.ts` (retry config parsing)
- `compiler/src/status-server/page.ts` (retry status UI)
- `compiler/src/error-classifier.ts` (new)
**Dependencies**: None
**Risk**: High - complex error handling logic, critical path changes

## Step Dependency Graph

```
Track A:
  step-0 (API endpoints) → step-1 (Button UI)
                              ↓
                        step-8 (Skip/Retry)

Track B (Independent):
  step-2 (creating-workflows skill)
  step-3 (creating-sprints skill)

Track C:
  step-4 (Hook script) → step-5 (Activity watcher) → step-6 (Activity UI) → step-7 (Auto-config)

Track D (Mostly Independent):
  step-8 (Skip/Retry) ← depends on step-0, step-1
  step-9 (Log Viewer)
  step-10 (Desktop Notifications)
  step-11 (Progress Estimation)
  step-12 (Error Recovery)
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Template literal UI complexity | Medium | Use well-structured functions, test incrementally |
| SSE connection reliability | Medium | Implement reconnection logic, keep-alive |
| PROGRESS.yaml concurrent writes | High | Use atomic writes, file locking if needed |
| Hook integration breaks sprint loop | High | Thorough testing, fallback if hook fails |
| Large log file performance | Medium | Implement pagination, lazy loading |
| Browser notification permissions | Low | Graceful degradation if denied |

## Estimated Complexity

| Step | Complexity | Reason |
|------|------------|--------|
| step-0 | Low | Standard HTTP endpoints |
| step-1 | Medium | UI in template literals, modal logic |
| step-2 | Low | Documentation only |
| step-3 | Low | Documentation only |
| step-4 | Low | Simple bash script |
| step-5 | Medium | File watching, SSE integration |
| step-6 | Medium | Complex UI state management |
| step-7 | Medium | Critical path modification |
| step-8 | Medium | YAML state manipulation |
| step-9 | Medium | Log handling, ANSI conversion |
| step-10 | Low | Well-documented browser API |
| step-11 | Medium | Historical data analysis |
| step-12 | High | Error classification, retry logic |
