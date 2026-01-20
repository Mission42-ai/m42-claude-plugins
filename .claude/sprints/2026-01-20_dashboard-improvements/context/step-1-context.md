# Step Context: step-1

## Task
Add elapsed time display and prominent progress indicators.

Requirements:
1. Calculate elapsed in transforms.ts:
   - In buildSubPhaseNode(), buildStepNode(), buildTopPhaseNode()
   - If elapsed not set but started-at exists → calculate using calculateElapsed()

2. Add prominent timer in page.ts:
   - Add sprint-timer div in header with timer icon
   - Format as HH:MM:SS
   - Update every second
   - Large font, blue accent color

3. Add step progress counter:
   - Count total steps from phases in transforms.ts
   - Add totalSteps to SprintHeader
   - Display "Step X of Y" in header

Files:
- plugins/m42-sprint/compiler/src/status-server/transforms.ts
- plugins/m42-sprint/compiler/src/status-server/page.ts
- plugins/m42-sprint/compiler/src/status-server/status-types.ts

Verification:
- Steps show elapsed time in sidebar
- Prominent HH:MM:SS timer in header
- "Step X of Y" displays

## Implementation Plan
Based on gherkin scenarios (1-4 PASS, 5-8b FAIL), implement in this order:

1. **Create `countTotalSteps()` function in transforms.ts** (Scenario 5)
   - Count all leaf-level phases (sub-phases) across all steps
   - Handle both simple phases and for-each expanded phases with steps
   - Export the function

2. **Add `totalSteps` and `currentStep` to SprintHeader type** (Scenarios 6, 7)
   - Modify status-types.ts to add new fields
   - Calculate in toStatusUpdate() using countTotalSteps()
   - currentStep = completed count + 1 (1-indexed for display)

3. **Add sprint-timer HTML element in page.ts** (Scenario 8)
   - Add `<div id="sprint-timer">` in header section
   - Use timer/clock icon (⏱ or similar)
   - Style with large font, blue accent color

4. **Add step-counter HTML element in page.ts** (Scenario 8b)
   - Add `<div id="step-counter">` in header section
   - Display pattern: "Step X of Y"

5. **Add JavaScript timer logic** (Scenario 8)
   - Format function: toHHMMSS(seconds) → "HH:MM:SS"
   - setInterval every 1000ms to update sprint-timer
   - Update step-counter from SSE status updates

6. **Wire up timer and step counter in updateHeader()** (Scenarios 8, 8b)
   - Read header.totalSteps and header.currentStep
   - Update DOM elements with formatted values

## Related Code Patterns

### Pattern from: transforms.ts - countPhases()
```typescript
export function countPhases(progress: CompiledProgress): { total: number; completed: number } {
  // Standard mode: count phases
  let total = 0;
  let completed = 0;

  for (const topPhase of progress.phases ?? []) {
    if (topPhase.steps) {
      // For-each phase: count sub-phases within each step
      for (const step of topPhase.steps) {
        for (const subPhase of step.phases) {
          total++;
          if (subPhase.status === 'completed' || subPhase.status === 'skipped') {
            completed++;
          }
        }
      }
    } else {
      // Simple phase (no steps)
      total++;
      if (topPhase.status === 'completed' || topPhase.status === 'skipped') {
        completed++;
      }
    }
  }

  return { total, completed };
}
```

### Pattern from: page.ts - header HTML structure
```html
<header class="header">
  <div class="header-left">
    <h1 class="sprint-name" id="sprint-name">Loading...</h1>
    <span class="status-badge" id="status-badge">--</span>
  </div>
  <div class="header-right">
    <div class="iteration" id="iteration"></div>
    <div class="progress-container">
      <!-- progress bar here -->
    </div>
    <div class="estimate-display" id="estimate-display">
      <!-- ETA here -->
    </div>
    <div class="header-actions">
      <!-- buttons here -->
    </div>
  </div>
</header>
```

### Pattern from: page.ts - DOM elements initialization
```typescript
const elements = {
  sprintName: document.getElementById('sprint-name'),
  statusBadge: document.getElementById('status-badge'),
  iteration: document.getElementById('iteration'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  // ... add new elements here
};
```

### Pattern from: page.ts - timer update interval
```typescript
// Init function already has timer intervals
function init() {
  // ...
  // Update elapsed time every second
  setInterval(updateElapsedTimes, 1000);
  // Update relative times in activity panel
  setInterval(updateActivityRelativeTimes, 1000);
}
```

### Pattern from: page.ts - CSS styling
```css
.estimate-display {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 12px;
}
```

## Required Imports
### Internal (already present)
- `transforms.ts`: All needed types already imported
- `page.ts`: No new imports needed
- `status-types.ts`: No new imports needed

### External
- None required

## Types/Interfaces to Use

### From status-types.ts - SprintHeader (to be extended)
```typescript
export interface SprintHeader {
  sprintId: string;
  status: SprintStatus;
  mode?: 'standard' | 'ralph';
  goal?: string;
  progressPercent: number;
  completedPhases: number;
  totalPhases: number;
  currentIteration?: number;
  maxIterations?: number;
  startedAt?: string;
  elapsed?: string;
  estimatedRemainingMs?: number;
  estimatedRemaining?: string;
  estimateConfidence?: 'low' | 'medium' | 'high' | 'no-data';
  estimatedCompletionTime?: string;
  // NEW FIELDS TO ADD:
  totalSteps?: number;    // Total leaf-level phases for "Step X of Y"
  currentStep?: number;   // Current step number (1-indexed)
}
```

## Integration Points
- Called by: server.ts sends StatusUpdate via SSE
- Calls: countTotalSteps() called by toStatusUpdate()
- JavaScript in page.ts receives updates via EventSource

## Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| status-types.ts | Modify | Add `totalSteps` and `currentStep` to SprintHeader interface |
| transforms.ts | Modify | Add `countTotalSteps()` function, use it in `toStatusUpdate()` |
| page.ts | Modify | Add sprint-timer div, step-counter div, CSS styles, JS logic |

## Test File
- `elapsed-step.test.ts` - Already created with failing tests for scenarios 5-8b
- Run: `cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/elapsed-step.test.js`

## Existing Passing Functionality
Scenarios 1-4 already PASS because:
- `computeElapsedIfNeeded()` already exists in transforms.ts
- It's called in `buildSubPhaseNode()`, `buildStepNode()`, `buildTopPhaseNode()`
- It calculates elapsed from started-at when status is 'in-progress'

## Implementation Notes

### countTotalSteps() Logic
Similar to `countPhases()` but focused on counting leaf nodes (steps with sub-phases):
```typescript
export function countTotalSteps(progress: CompiledProgress): number {
  let total = 0;
  for (const topPhase of progress.phases ?? []) {
    if (topPhase.steps) {
      for (const step of topPhase.steps) {
        total += step.phases.length;
      }
    } else {
      total++; // Simple phase counts as 1
    }
  }
  return total;
}
```

### currentStep Calculation
Calculate based on completed sub-phases + 1:
```typescript
const { completed } = countPhases(progress);
const currentStep = progress.status === 'in-progress' ? completed + 1 : completed;
```

### Timer Format Function
```javascript
function toHHMMSS(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return String(hours).padStart(2, '0') + ':' +
         String(minutes).padStart(2, '0') + ':' +
         String(seconds).padStart(2, '0');
}
```

### Timer Update Logic
```javascript
function updateSprintTimer() {
  const startedAt = elements.elapsed.dataset.startedAt;
  if (!startedAt) return;
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  elements.sprintTimer.textContent = toHHMMSS(elapsed);
}
// Call in init():
setInterval(updateSprintTimer, 1000);
```
