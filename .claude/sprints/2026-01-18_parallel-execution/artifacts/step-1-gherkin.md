# Gherkin Scenarios: step-1

## Step Task
Update compiler/src/expand-foreach.ts to propagate parallel flag:

1. In expandStep() function (lines 84-130)
2. When creating CompiledPhase objects in the map (line 117-121)
3. Add: `parallel: phase.parallel` to propagate the flag from WorkflowPhase to CompiledPhase

This ensures sub-phases marked as parallel in workflow definitions are compiled with the parallel flag.

Reference: context/implementation-plan.md section 4.B

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: expand-foreach.ts file exists
  Given the project structure is set up
  When I check for the expand-foreach module
  Then plugins/m42-sprint/compiler/src/expand-foreach.ts exists

Verification: `test -f plugins/m42-sprint/compiler/src/expand-foreach.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: CompiledPhase object includes parallel property
  Given the expandStep function creates CompiledPhase objects
  When I check the object creation in the map callback
  Then the parallel property is included from phase.parallel

Verification: `grep -E "parallel:\s*phase\.parallel" plugins/m42-sprint/compiler/src/expand-foreach.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: TypeScript compiles without errors
  Given the parallel propagation code is added
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: expandStep function returns phases with parallel flag
  Given a workflow phase has parallel: true
  When expandStep processes that phase
  Then the resulting CompiledPhase has parallel: true

Verification: `cd plugins/m42-sprint/compiler && node -e "
const { expandStep } = require('./dist/expand-foreach.js');
const step = { prompt: 'Test step', id: 'test-step' };
const workflow = { name: 'Test', phases: [{ id: 'phase1', prompt: 'Do something', parallel: true }] };
const context = { sprint: { id: 'test' } };
const result = expandStep(step, 0, workflow, context);
const phase = result.phases[0];
if (phase.parallel !== true) { console.error('parallel flag not propagated'); process.exit(1); }
console.log('OK');
"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Non-parallel phases have undefined parallel flag
  Given a workflow phase does not have parallel set
  When expandStep processes that phase
  Then the resulting CompiledPhase has parallel as undefined (not false)

Verification: `cd plugins/m42-sprint/compiler && node -e "
const { expandStep } = require('./dist/expand-foreach.js');
const step = { prompt: 'Test step', id: 'test-step' };
const workflow = { name: 'Test', phases: [{ id: 'phase1', prompt: 'Do something' }] };
const context = { sprint: { id: 'test' } };
const result = expandStep(step, 0, workflow, context);
const phase = result.phases[0];
if (phase.parallel !== undefined) { console.error('parallel should be undefined, got: ' + phase.parallel); process.exit(1); }
console.log('OK');
"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Multiple phases preserve their individual parallel flags
  Given a workflow with mixed parallel and non-parallel phases
  When expandStep processes all phases
  Then each CompiledPhase has the correct parallel value

Verification: `cd plugins/m42-sprint/compiler && node -e "
const { expandStep } = require('./dist/expand-foreach.js');
const step = { prompt: 'Test step', id: 'test-step' };
const workflow = {
  name: 'Test',
  phases: [
    { id: 'phase1', prompt: 'Regular phase' },
    { id: 'phase2', prompt: 'Parallel phase', parallel: true },
    { id: 'phase3', prompt: 'Another regular' },
    { id: 'phase4', prompt: 'Another parallel', parallel: true }
  ]
};
const context = { sprint: { id: 'test' } };
const result = expandStep(step, 0, workflow, context);
if (result.phases[0].parallel !== undefined) { console.error('phase1 should not have parallel'); process.exit(1); }
if (result.phases[1].parallel !== true) { console.error('phase2 should be parallel'); process.exit(1); }
if (result.phases[2].parallel !== undefined) { console.error('phase3 should not have parallel'); process.exit(1); }
if (result.phases[3].parallel !== true) { console.error('phase4 should be parallel'); process.exit(1); }
console.log('OK');
"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
