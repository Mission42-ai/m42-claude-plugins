# Gherkin Scenarios: step-1

## Step Task
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

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 9 (8 main + 1 additional)
Required score: 9/9

Note: Scenarios 1-4 test existing elapsed time calculation functionality.
Scenarios 5-8b test NEW functionality that needs to be implemented.

---

## Scenario 1: In-progress step calculates elapsed time from started-at
Given a CompiledProgress with an in-progress step
And the step has 'started-at' timestamp but no 'elapsed' field
When buildStepNode() is called
Then the resulting PhaseTreeNode has elapsed calculated from started-at to now

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build && node dist/status-server/elapsed-step.test.js 2>&1 | grep -q "✓.*in-progress step calculates elapsed"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Completed step preserves existing elapsed time
Given a CompiledProgress with a completed step
And the step has both 'started-at' and 'elapsed' fields set
When buildStepNode() is called
Then the resulting PhaseTreeNode preserves the existing elapsed value

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build && node dist/status-server/elapsed-step.test.js 2>&1 | grep -q "✓.*preserves existing elapsed"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Sub-phase calculates elapsed time from started-at
Given a CompiledProgress with an in-progress sub-phase
And the sub-phase has 'started-at' timestamp but no 'elapsed' field
When buildSubPhaseNode() is called (via buildPhaseTree)
Then the resulting PhaseTreeNode has elapsed calculated from started-at to now

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build && node dist/status-server/elapsed-step.test.js 2>&1 | grep -q "✓.*sub-phase calculates elapsed"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Top-level phase calculates elapsed time
Given a CompiledProgress with an in-progress top-level phase
And the phase has 'started-at' timestamp but no 'elapsed' field
When buildTopPhaseNode() is called (via buildPhaseTree)
Then the resulting PhaseTreeNode has elapsed calculated from started-at to now

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build && node dist/status-server/elapsed-step.test.js 2>&1 | grep -q "✓.*top-level phase calculates elapsed"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Step counting returns correct totals
Given a CompiledProgress with multiple phases
And phases contain steps with sub-phases
When countTotalSteps() is called
Then it returns the total number of leaf-level phases/sub-phases

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build && node dist/status-server/elapsed-step.test.js 2>&1 | grep -q "✓.*countTotalSteps returns correct total"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: SprintHeader includes totalSteps
Given a CompiledProgress with phases containing steps
When toStatusUpdate() is called
Then the returned SprintHeader contains totalSteps field with correct count

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build && node dist/status-server/elapsed-step.test.js 2>&1 | grep -q "✓.*SprintHeader includes totalSteps"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: SprintHeader includes currentStep
Given a CompiledProgress with an in-progress sprint
And the current pointer indicates phase 1, step 2
When toStatusUpdate() is called
Then the returned SprintHeader contains currentStep field indicating position

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build && node dist/status-server/elapsed-step.test.js 2>&1 | grep -q "✓.*SprintHeader includes currentStep"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Page renders sprint timer with HH:MM:SS format
Given the dashboard HTML is generated
When the header section is rendered
Then it contains a sprint-timer element with timer icon
And the JavaScript updates the timer every second in HH:MM:SS format

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build && node dist/status-server/elapsed-step.test.js 2>&1 | grep -q "✓.*page contains sprint-timer element"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

---

## Scenario 8b: Page renders step progress counter
Given the dashboard HTML is generated
When the header section is rendered
Then it contains an element for "Step X of Y" display

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build && node dist/status-server/elapsed-step.test.js 2>&1 | grep -q "✓.*step progress counter"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Unit Test Coverage
| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| elapsed-step.test.ts | 11 | 1, 2, 3, 4, 5, 6, 7, 8, 8b + 2 edge cases |

## RED Phase Verification
Tests are expected to PARTIALLY FAIL at this point:
```bash
cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler
npm run build && node dist/status-server/elapsed-step.test.js
# Expected output:
# ✓ Scenario 1-4: PASS (elapsed calculation already works)
# ✗ Scenario 5-8b: FAIL (new functionality not implemented)
```

## Current Test Results (RED Phase)
- **PASS**: Scenarios 1, 2, 3, 4 (elapsed time calculation already implemented)
- **FAIL**: Scenario 5 (countTotalSteps not implemented)
- **FAIL**: Scenario 6 (totalSteps not in SprintHeader)
- **FAIL**: Scenario 7 (currentStep not in SprintHeader)
- **FAIL**: Scenario 8 (sprint-timer element missing)
- **FAIL**: Scenario 8b (step progress counter missing)
