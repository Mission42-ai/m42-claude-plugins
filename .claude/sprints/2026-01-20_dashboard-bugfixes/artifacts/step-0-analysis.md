# BUG-001 Analysis: Sprint Steps Show No Progress Indicators

## Summary

Steps in the Sprint Status Dashboard show empty circles regardless of their actual status (completed, in-progress, pending). The expected behavior is visual differentiation between status states.

## Root Cause Analysis

### Primary Investigation

After thorough code analysis, the bug has **TWO possible root causes** that need verification:

#### Hypothesis 1: Missing Default CSS for Undefined Status (LIKELY)

**Location:** `plugins/m42-sprint/compiler/src/status-server/page.ts:4394`

```javascript
html += '<span class="tree-icon ' + node.status + '"></span>';
```

If `node.status` is `undefined`, this produces:
```html
<span class="tree-icon undefined"></span>
```

The CSS at lines 702-718 only defines `::before` content for specific status classes:
- `.tree-icon.pending::before` → `\25CB` (empty circle ○)
- `.tree-icon.in-progress::before` → `\25CF` (filled circle ●) + animation
- `.tree-icon.completed::before` → `\2713` (checkmark ✓)
- `.tree-icon.failed::before` → `\2717` (X mark ✗)
- `.tree-icon.blocked::before` → `\26A0` (warning ⚠)
- `.tree-icon.skipped::before` → `\2014` (dash —)

**There is NO default/fallback `::before` content for `.tree-icon` alone.**

If status is undefined or an unexpected value, nothing renders.

#### Hypothesis 2: Status Data Not Propagating (ALTERNATIVE)

**Location:** `plugins/m42-sprint/compiler/src/status-server/transforms.ts:206-222`

The `buildStepNode()` function directly copies `step.status`:
```typescript
function buildStepNode(step: CompiledStep, depth: number): PhaseTreeNode {
  return {
    id: step.id,
    label: getLabel(step.id, step.prompt),
    status: step.status,  // <-- Direct copy, no default
    // ...
  };
}
```

If the YAML parsing or data structure has issues, status could be undefined despite TypeScript types saying otherwise.

## Conditions That Trigger the Bug

1. **When `node.status` is undefined or null** - produces class `tree-icon undefined` with no matching CSS
2. **When `node.status` has unexpected value** - e.g., typo like `"complete"` instead of `"completed"`
3. **YAML parsing edge case** - if status field is missing in PROGRESS.yaml for any step

## Data Flow Path

```
PROGRESS.yaml (status field per phase/step/sub-phase)
    ↓
yaml.load() [server.ts:1657]
    ↓
toStatusUpdate() [transforms.ts:597]
    ↓
buildPhaseTree() → buildTopPhaseNode() → buildStepNode() → buildSubPhaseNode()
    ↓
PhaseTreeNode[] with status field
    ↓
SSE to browser [server.ts:1628-1635]
    ↓
handleStatusUpdate() [page.ts:4097]
    ↓
updatePhaseTree() [page.ts:4293]
    ↓
renderTreeNode() [page.ts:4368]
    ↓
'<span class="tree-icon ' + node.status + '"></span>' [page.ts:4394]
    ↓
CSS ::before pseudo-element renders icon
```

## Files Involved

| File | Lines | Purpose |
|------|-------|---------|
| `status-server/page.ts` | 692-718 | CSS definitions for status icons |
| `status-server/page.ts` | 4394 | HTML generation with status class |
| `status-server/page.ts` | 4368-4481 | `renderTreeNode()` function |
| `status-server/transforms.ts` | 186-255 | Tree building functions |
| `status-server/server.ts` | 1655-1660 | YAML loading |

## What a Proper Test Should Verify

### Unit Tests for transforms.ts

1. **Test `buildStepNode()` with valid status values**
   - Input: step with status 'pending' → Output: node with status 'pending'
   - Input: step with status 'completed' → Output: node with status 'completed'
   - Input: step with status 'in-progress' → Output: node with status 'in-progress'

2. **Test `buildStepNode()` with edge cases**
   - Input: step with undefined status → Output: node with status defaulted to 'pending'
   - Input: step with null status → Output: node with status defaulted to 'pending'
   - Input: step with empty string status → Output: node with status defaulted to 'pending'

3. **Test `buildPhaseTree()` end-to-end**
   - Input: CompiledProgress with mixed statuses → Output: PhaseTreeNode[] with correct statuses preserved

### Integration Tests for page.ts (Browser/DOM)

4. **Test `renderTreeNode()` renders correct icons**
   - Node with status 'pending' → Element has class `tree-icon pending`
   - Node with status 'completed' → Element has class `tree-icon completed`
   - Node with status 'in-progress' → Element has class `tree-icon in-progress`

5. **Test CSS renders correct symbols**
   - `.tree-icon.pending` → displays ○ (empty circle)
   - `.tree-icon.completed` → displays ✓ (checkmark) in green
   - `.tree-icon.in-progress` → displays ● (filled circle) in blue with animation

## Recommended Fix

### Option A: Add Defensive Default in JavaScript (RECOMMENDED)

In `page.ts:4394`, change:
```javascript
// Before
html += '<span class="tree-icon ' + node.status + '"></span>';

// After
html += '<span class="tree-icon ' + (node.status || 'pending') + '"></span>';
```

### Option B: Add CSS Default Rule

In `page.ts` CSS section (~line 700), add:
```css
/* Default fallback for undefined status */
.tree-icon::before { content: '\25CB'; color: var(--text-muted); }
```

### Option C: Add Defensive Default in transforms.ts (MOST ROBUST)

In `buildStepNode()`, `buildSubPhaseNode()`, and `buildTopPhaseNode()`:
```typescript
status: step.status ?? 'pending',
```

This ensures the data is correct before it reaches the frontend.

## Success Criteria

After fix:
- [ ] Completed steps show green checkmark (✓)
- [ ] In-progress steps show blue animated filled circle (●)
- [ ] Pending steps show gray empty circle (○)
- [ ] Failed steps show red X (✗)
- [ ] Blocked steps show yellow warning (⚠)
- [ ] Skipped steps show gray dash (—)
- [ ] Edge cases (undefined/null status) show pending indicator as fallback

## Additional Analysis (2026-01-20)

### PROGRESS.yaml Structure Verification

Examined actual PROGRESS.yaml and confirmed:
- Steps DO have `status` field: `status: pending` (line 61)
- Sub-phases also have status: `status: pending` (line 64)
- Top-level phases have status: `status: in-progress` (line 5)

Example from current sprint:
```yaml
- id: fix-bugs
  status: pending
  steps:
    - id: step-0
      prompt: |
        BUG-001: Sprint Steps...
      status: pending        # <-- STATUS EXISTS AT STEP LEVEL
      phases:
        - id: analyze
          status: pending    # <-- AND AT SUB-PHASE LEVEL
```

### TypeScript Type Definitions

Verified CompiledStep interface (`types.ts:479-494`):
```typescript
export interface CompiledStep {
  id: string;
  prompt: string;
  status: PhaseStatus;  // <-- REQUIRED, not optional
  phases: CompiledPhase[];
  'started-at'?: string;
  // ...
}
```

PhaseStatus type (`types.ts:9`):
```typescript
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';
```

### Conclusion (Updated)

The original analysis was **INCORRECT**. The actual root cause was discovered:

**THE REAL ROOT CAUSE**: The runtime loop (`runtime/src/loop.ts`) was NEVER updating step or sub-phase status fields. All steps remained `pending` forever regardless of execution state.

## ACTUAL Root Cause (from runtime/loop.ts)

### The Original Bug

The runtime loop only updated:
1. `progress.status` (sprint-level)
2. `phase.status` (only when sprint completes)

It **NEVER** updated:
- `step.status` - remained 'pending' forever
- `subPhase.status` - remained 'pending' forever

### Evidence from PROGRESS.yaml

Looking at a completed sprint's PROGRESS.yaml:
```yaml
# 2026-01-20_bughunt-m42-sprint-fixing - STATUS: completed
phases:
  - id: preflight
    status: completed
  - id: fix-bugs
    status: completed
    steps:
      - id: step-0
        status: pending    # <-- BUG! Should be 'completed'
        phases:
          - id: analyze
            status: pending  # <-- BUG! Should be 'completed'
```

## FIX ALREADY APPLIED (Verified 2026-01-20)

The fix was applied in `runtime/src/loop.ts`:

### Fix 1: Mark In-Progress Before Execution (lines 485-506)
```typescript
// BUG-001 FIX: Mark current step/sub-phase as in-progress before execution
if (currentPhase) {
  currentPhase.status = 'in-progress';
  if (!currentPhase['started-at']) {
    currentPhase['started-at'] = new Date().toISOString();
  }
}
if (currentStep) {
  currentStep.status = 'in-progress';
  if (!currentStep['started-at']) {
    currentStep['started-at'] = new Date().toISOString();
  }
}
if (currentSubPhase) {
  currentSubPhase.status = 'in-progress';
  if (!currentSubPhase['started-at']) {
    currentSubPhase['started-at'] = new Date().toISOString();
  }
}

// BUG-001 FIX: Write progress to disk so status server can see in-progress status
await writeProgressAtomic(progressPath, progress);
```

### Fix 2: Mark Completed After Execution (lines 551-582)
```typescript
// BUG-001 FIX: Mark current step/sub-phase as completed
const completedAt = new Date().toISOString();
if (currentSubPhase) {
  currentSubPhase.status = 'completed';
  currentSubPhase['completed-at'] = completedAt;
}
// Mark step completed only if all its sub-phases are completed
if (currentStep) {
  const allSubPhasesComplete = currentStep.phases.every(
    (p) => p.status === 'completed' || p.status === 'skipped'
  );
  if (allSubPhasesComplete || currentStep.phases.length === 0) {
    currentStep.status = 'completed';
    currentStep['completed-at'] = completedAt;
  }
}
```

## Tests Added (transforms.test.ts)

Tests verify the transform layer correctly preserves all status values:

| Test | Purpose |
|------|---------|
| `BUG-001: buildStepNode should preserve step status for completed steps` | Completed status flows through |
| `BUG-001: buildStepNode should preserve step status for in-progress steps` | In-progress status flows through |
| `BUG-001: buildStepNode should preserve step status for pending steps` | Pending status flows through |
| `BUG-001: buildPhaseTree should correctly represent mixed step statuses` | Mixed statuses work |
| `BUG-001: toStatusUpdate should include phaseTree with correct step statuses` | Full SSE payload correct |
| `BUG-001: buildStepNode should preserve failed and blocked step statuses` | Error statuses work |
| `BUG-001: sub-phase statuses should also be correctly preserved` | Sub-phase hierarchy works |

## Status: FIXED

The bug fix is complete. New sprints will correctly show:
- **Completed steps**: Green checkmark (✓)
- **In-progress steps**: Blue pulsing circle (●)
- **Pending steps**: Gray empty circle (○)
- **Failed steps**: Red X (✗)
- **Blocked steps**: Yellow warning (⚠)
- **Skipped steps**: Gray dash (—)

Old sprints that ran before the fix will still show incorrect statuses in their PROGRESS.yaml files (all 'pending'), but this is historical data and not fixable retroactively.
