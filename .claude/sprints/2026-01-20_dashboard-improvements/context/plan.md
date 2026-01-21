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
8. **Workflow reference**: Verify single-phase workflow references expand correctly
9. **Operator requests**: Agents can submit requests, operator processes with reasoning
10. **Dynamic injection**: Verify steps can be injected at various positions
11. **Operator queue view**: Pending/decided requests display with full reasoning

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

---

## Issue 8: Workflow Reference for Single Phases (NEW)

**Problem**: `workflow:` can only be used with `for-each:` iterations, not for single phases.
**Desired**: Allow referencing a workflow for a single phase, making workflows composable.

### Current vs Desired

```yaml
# Current - only works with for-each
phases:
  - id: development
    for-each: step
    workflow: tdd-step-workflow  # ✓ Works

# Desired - also work without for-each
phases:
  - id: documentation
    workflow: documentation-workflow  # NEW: Run entire workflow as one phase
```

### Use Cases
1. Reuse documentation workflow across multiple parent workflows
2. Compose complex workflows from smaller building blocks
3. Create "meta-workflows" that orchestrate other workflows

### Implementation
- Phase has EITHER `prompt` OR `workflow` (mutually exclusive)
- Compiler expands referenced workflow phases inline
- Phase IDs prefixed: `{parent-id}-{child-id}` to avoid collisions
- Recursive reference detection (prevent infinite loops)

### Files to Modify

| File | Changes |
|------|---------|
| `compiler/src/compile.ts` | Expand workflow references without for-each |
| `compiler/src/types.ts` | Update Phase type validation |
| `compiler/src/workflow-loader.ts` | Recursive workflow loading with cycle detection |

---

## Issue 9: Operator Request System (NEW)

**Problem**: Claude may discover issues during execution but has no way to report them structurally.
**Desired**: Agents submit requests to operator queue. Operator reviews, decides with reasoning, and injects work.

### Agent Response Schema (operatorRequests)
```typescript
interface PhaseResult {
  status: 'completed' | 'failed' | 'blocked';
  summary: string;
  operatorRequests?: OperatorRequest[];  // NEW
}

interface OperatorRequest {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'bug' | 'improvement' | 'refactor' | 'test' | 'docs' | 'security';
  context?: {
    discoveredIn: string;
    relatedFiles?: string[];
    suggestedWorkflow?: string;
  };
}
```

### Operator Response Schema (with reasoning)
```typescript
interface OperatorDecision {
  requestId: string;
  decision: 'approve' | 'reject' | 'defer' | 'backlog';  // NEW: backlog option
  reasoning: string;  // REQUIRED: Explain why
  injection?: {       // If approved
    workflow?: string;
    prompt?: string;
    position: InsertPosition;
  };
  deferredUntil?: 'end-of-phase' | 'end-of-sprint' | 'next-sprint';
  backlogEntry?: {    // NEW: If backlog
    category: string;
    suggestedPriority: 'high' | 'medium' | 'low';
    notes: string;    // Context for human reviewer
  };
  rejectionReason?: string;
}
```

### Decision Types
| Decision | Behavior |
|----------|----------|
| `approve` | Inject step/workflow immediately |
| `reject` | Decline with reason |
| `defer` | Queue for later in sprint |
| `backlog` | **NEW**: Add to BACKLOG.yaml for human review (NOT auto-implemented) |

### Operator as Skill
Default operator is a **skill** (`sprint-operator`) that can be overridden:
```yaml
operator:
  skill: sprint-operator  # Default skill
  # OR
  prompt: |               # Override with custom prompt
    Custom instructions...
```

### Backlog Storage
```yaml
# BACKLOG.yaml
items:
  - id: req_abc123
    title: "Upgrade to OAuth2"
    category: tech-debt
    suggested-priority: medium
    operator-notes: "Valid but significant scope..."
    status: pending-review  # pending-review | acknowledged | converted-to-issue
```

### Files to Modify

| File | Changes |
|------|---------|
| `runtime/src/claude-runner.ts` | Parse operatorRequests from JSON |
| `runtime/src/loop.ts` | Queue requests, trigger operator |
| `runtime/src/operator.ts` | NEW: Operator logic with skill loading |
| `runtime/src/backlog.ts` | NEW: Backlog management |
| `skills/sprint-operator/skill.md` | NEW: Default operator skill |
| `compiler/src/types.ts` | Workflow schema with operator config |

---

## Issue 10: Dynamic Step Injection (NEW)

**Problem**: Cannot add steps to a running sprint at runtime.
**Desired**: API to inject steps at specific positions, supporting both single steps and compiled workflows.

### Injection API
```typescript
// Single step
await injector.injectStep({
  step: { id: 'hotfix-1', prompt: 'Fix bug' },
  position: { type: 'after-current' }
});

// Workflow expansion
await injector.injectWorkflow({
  workflow: 'bugfix-workflow',
  position: { type: 'end-of-phase', phaseId: 'development' },
  idPrefix: 'hotfix'
});
```

### Position Options
| Type | Description |
|------|-------------|
| `after-current` | After currently executing step |
| `after-step` | After specific step by ID |
| `before-step` | Before specific step by ID |
| `end-of-phase` | At end of specific phase |
| `end-of-workflow` | At very end |

### Files to Modify

| File | Changes |
|------|---------|
| `runtime/src/progress-injector.ts` | NEW: Injection logic |
| `runtime/src/loop.ts` | Integrate injector |
| `runtime/src/cli.ts` | Add inject-step command |
| `status-server/page.ts` | Show injected badge |

---

## Issue 11: Operator Queue View UI (NEW)

**Problem**: No visibility into operator decisions and reasoning.
**Desired**: Dedicated per-sprint view showing pending requests, decision history, and backlog for human review.

### UX Requirements
- **Navigation**: Tab/link from sprint detail, badge with pending count
- **Pending Section**: Cards showing request details, priority, context, action buttons
- **History Section**: Decided requests with collapsible reasoning blocks
- **Backlog Section**: Items for human review (NOT auto-implemented)
- **Manual Override**: Human can approve/reject bypassing operator

### Three Sections
```
┌─────────────────────────────────────────────────────────────┐
│ 🔔 Pending Requests (3)                      [Process All] │
├─────────────────────────────────────────────────────────────┤
│ 🔴 CRITICAL  Fix SQL injection...     [Approve][Reject]    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 📋 Decision History                    [Filter ▼] [Search] │
├─────────────────────────────────────────────────────────────┤
│ ✅ APPROVED  Fix null pointer...                           │
│    Reasoning: Blocking bug, injecting before QA...         │
│ ❌ REJECTED  Refactor utils...                             │
│    Reasoning: Invalid - adds unnecessary dependency        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 📝 Backlog (For Human Review)               [Export CSV]   │
├─────────────────────────────────────────────────────────────┤
│ 📌 Upgrade to OAuth2 • tech-debt • medium                  │
│    Notes: Valid but significant scope, needs arch review   │
│    [Create Issue] [Acknowledge] [Delete]                   │
└─────────────────────────────────────────────────────────────┘
```

### API Endpoints
```
GET  /api/sprint/:id/operator-queue           # All requests
POST /api/sprint/:id/operator-queue/:id/decide # Manual decision
POST /api/sprint/:id/operator/process          # Trigger operator
```

### Implementation Approach
1. **Research & Design** (Explore subagent) - Study patterns, create wireframes
2. **Backend** - Queue storage, API endpoints, SSE events
3. **Frontend** - Components, navigation, real-time updates
4. **Polish** - Animations, empty states, mobile

### Files to Modify

| File | Changes |
|------|---------|
| `status-server/page.ts` | Add queue view navigation |
| `status-server/server.ts` | Add API endpoints |
| `status-server/operator-queue-page.ts` | NEW: Dedicated view |
| `status-server/transforms.ts` | Transform queue data |
