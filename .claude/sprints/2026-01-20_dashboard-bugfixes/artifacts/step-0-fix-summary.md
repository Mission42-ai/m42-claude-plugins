# BUG-001 Fix Summary: Sprint Steps Show No Progress Indicators

## Status: FIXED (Pre-existing fix verified)

## Root Cause

The sprint runtime (`loop.ts`) was only updating:
1. `progress.status` (sprint-level status)
2. `phase.status` (top-level phase, only when sprint completed)

It **never** updated:
- `step.status` (remained 'pending' forever during execution)
- `subPhase.status` (remained 'pending' forever during execution)

The dashboard frontend (`page.ts`) and transforms (`transforms.ts`) were correctly rendering based on status values - they just never received the correct status updates from the runtime.

## Solution Implemented

The fix was already implemented in `plugins/m42-sprint/runtime/src/loop.ts` at lines 485-584:

### 1. Mark in-progress before execution (lines 486-506)
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

### 2. Mark completed on success (lines 551-566)
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

### 3. Mark failed on error (lines 576-584)
```typescript
// BUG-001 FIX: Mark current step/sub-phase as failed
if (currentSubPhase) {
  currentSubPhase.status = 'failed';
  currentSubPhase.error = spawnResult?.error ?? 'Unknown error';
}
if (currentStep) {
  currentStep.status = 'failed';
  currentStep.error = spawnResult?.error ?? 'Unknown error';
}
```

## Tests Added

### Runtime Tests (`runtime/src/loop.test.ts`)
- `BUG-001: Step status should be updated to in-progress when executing`
  - Verifies that step and sub-phase statuses are set to 'in-progress' during Claude execution
- `BUG-001: Completed step status should be preserved in PROGRESS.yaml`
  - Verifies that after sprint completion, steps and sub-phases have 'completed' status

### Transform Tests (`compiler/src/status-server/transforms.test.ts`)
- `BUG-001: buildStepNode should preserve step status for completed steps`
- `BUG-001: buildStepNode should preserve step status for in-progress steps`
- `BUG-001: buildStepNode should preserve step status for pending steps`
- `BUG-001: buildPhaseTree should correctly represent mixed step statuses`
- `BUG-001: toStatusUpdate should include phaseTree with correct step statuses`
- `BUG-001: buildStepNode should preserve failed and blocked step statuses`
- `BUG-001: sub-phase statuses should also be correctly preserved`

## Test Results

```
✓ BUG-001: Step status should be updated to in-progress when executing
✓ BUG-001: Completed step status should be preserved in PROGRESS.yaml
Tests completed: 33 passed, 0 failed
```

All BUG-001 related tests pass.

## Visual Indicators (Already Working in Frontend)

The frontend (`page.ts`) already had the correct CSS for status icons:
- **Pending**: `◯` empty circle (muted color)
- **In-progress**: `●` filled circle with pulse animation (blue)
- **Completed**: `✓` checkmark (green)
- **Failed**: `✗` X (red)
- **Blocked**: `⚠` warning (yellow)
- **Skipped**: `—` dash (muted)

## Verification Results (2026-01-20)

### Full Test Suite Results
All status-server tests pass:

```
=== step-progress.test.js ===
✓ buildPhaseTree preserves mixed step statuses
✓ BUG-001 DETECTION: steps should NOT all show pending when sprint is in-progress
✓ toStatusUpdate delivers correct step statuses for rendering
✓ sub-phase statuses are preserved for rendering
✓ failed and blocked step statuses are preserved
✓ step statuses map to valid CSS icon classes
✓ step timing information is preserved
✓ data format supports correct tree-icon class generation
Tests completed: 8 passed, 0 failed

=== transforms.test.js ===
✓ BUG-001: buildStepNode should preserve step status for completed steps
✓ BUG-001: buildStepNode should preserve step status for in-progress steps
✓ BUG-001: buildStepNode should preserve step status for pending steps
✓ BUG-001: buildPhaseTree should correctly represent mixed step statuses
✓ BUG-001: toStatusUpdate should include phaseTree with correct step statuses
✓ BUG-001: buildStepNode should preserve failed and blocked step statuses
✓ BUG-001: sub-phase statuses should also be correctly preserved

=== step-indicators.test.js ===
✓ BUG-001: Completed step should render with "completed" CSS class
✓ BUG-001: In-progress step should render with "in-progress" CSS class
✓ BUG-001: Pending step should render with "pending" CSS class
✓ BUG-001: Failed step should render with "failed" CSS class
✓ BUG-001: Mixed status tree should show different indicators for each step
✓ BUG-001: All status values should produce valid CSS class names
✓ BUG-001: E2E - buildPhaseTree output renders with correct status classes
Tests completed: 7 passed, 0 failed
```

### Manual Verification
Verified via Playwright browser automation on the live dashboard:

**Sprint**: 2026-01-20_dashboard-bugfixes (in-progress)
**URL**: http://127.0.0.1:3100/sprint/2026-01-20_dashboard-bugfixes

**Phase Tree Visual Verification**:
| Element | Expected | Actual | Status |
|---------|----------|--------|--------|
| preflight | ✓ (completed) | ✓ green checkmark | ✅ PASS |
| fix-bugs | ● (in-progress) | ● blue filled | ✅ PASS |
| step-0 | ● (in-progress) | ● blue filled | ✅ PASS |
| step-0 > analyze | ✓ (completed) | ✓ green checkmark | ✅ PASS |
| step-0 > red | ✓ (completed) | ✓ green checkmark | ✅ PASS |
| step-0 > green | ✓ (completed) | ✓ green checkmark | ✅ PASS |
| step-0 > refactor | ✓ (completed) | ✓ green checkmark | ✅ PASS |
| step-0 > verify | ● (in-progress) | ● blue filled (highlighted) | ✅ PASS |
| step-1 through step-6 | ○ (pending) | ○ gray empty circles | ✅ PASS |
| regression-check | ○ (pending) | ○ gray empty circle | ✅ PASS |
| summary | ○ (pending) | ○ gray empty circle | ✅ PASS |

**Screenshot**: `.playwright-mcp/bug-001-verified-fixed.png`

### Edge Cases Verified
1. **In-progress status with timestamps**: ✅ `started-at` properly recorded
2. **Completed status with timestamps**: ✅ `completed-at` properly recorded
3. **Failed status with error message**: ✅ Error preserved in `error` field
4. **Step completion logic**: ✅ Only marks complete when ALL sub-phases complete
5. **Phase completion logic**: ✅ Only marks complete when ALL steps complete
6. **Direct phase execution**: ✅ Phases without steps mark complete correctly

## Follow-up Items

None - the fix is complete and all tests pass. The pre-existing implementation was already correct.
