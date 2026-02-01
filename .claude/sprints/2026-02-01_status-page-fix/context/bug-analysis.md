# Fix: Status Page Not Tracking Parallel Execution Phases

## Problem

When parallel execution starts, the status page doesn't properly track stages. All sub-phases appear immediately marked as completed instead of showing in-progress states.

## Root Cause

In `runtime/src/loop.ts`, the parallel execution flow has a timing bug:

1. **Line 1379**: Progress is written to disk (with steps still `pending`)
2. **Line 1382-1384**: Parallel steps start executing
3. **Line 1180**: Inside `executeParallelStep()`, step is marked `in-progress` (but NOT written to disk)
4. **Lines 1220-1229**: When step completes, step AND all sub-phases are marked `completed`

The `in-progress` status set at line 1180 is never persisted to PROGRESS.yaml, so the status page never sees it. Steps jump from `pending` directly to `completed`.

## Solution

Move the in-progress status marking to happen BEFORE writing progress to disk, so the status page can see intermediate states.

### Changes in `runtime/src/loop.ts`

**Location: Lines 1372-1384** - Modify the parallel execution setup:

```typescript
// Mark all ready steps as started in the scheduler AND set in-progress status
for (const step of readySteps) {
  scheduler.startStep(step.id);

  // Mark step and first sub-phase as in-progress in progress data
  const phase = progress.phases?.[progress.current.phase];
  const currentStep = phase?.steps?.[step.stepIndex];
  if (currentStep) {
    currentStep.status = 'in-progress';
    if (!currentStep['started-at']) {
      currentStep['started-at'] = new Date().toISOString();
    }
    // Mark first sub-phase as in-progress if exists
    if (currentStep.phases && currentStep.phases.length > 0) {
      currentStep.phases[0].status = 'in-progress';
      if (!currentStep.phases[0]['started-at']) {
        currentStep.phases[0]['started-at'] = new Date().toISOString();
      }
    }
  }
}

// Write progress AFTER marking in-progress (so status page sees it)
backupProgress(progressPath);
await writeProgressAtomic(progressPath, progress);

// Execute ready steps in parallel
const stepPromises = readySteps.map((step) =>
  executeParallelStep(step, progress, sprintDir, workingDir, deps, verbose)
);
```

**Location: Lines 1179-1183** - Keep existing code as idempotent safety check (no changes needed, already handles case where status is already set).

## Files to Modify

| File | Change |
|------|--------|
| `plugins/m42-sprint/runtime/src/loop.ts` | Add in-progress marking before writeProgressAtomic in parallel loop (lines ~1372-1379) |

## Verification

1. Start a sprint with parallel execution steps
2. Open the status page (`/sprint-watch`)
3. Verify steps show `in-progress` while executing (not jumping to `completed`)
4. Verify sub-phases show `in-progress` during execution
5. Verify final completion states are correct after execution finishes
