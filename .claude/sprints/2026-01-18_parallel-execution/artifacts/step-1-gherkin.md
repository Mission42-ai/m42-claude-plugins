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

## Scenario 1: TypeScript compiles without errors
```gherkin
Scenario: TypeScript compiles without errors
  Given the expand-foreach.ts file has been modified
  When I run the TypeScript compiler on the compiler module
  Then no compilation errors occur
```

Verification: `cd plugins/m42-sprint/compiler && npm run typecheck 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0

---

## Scenario 2: CompiledPhase includes parallel property assignment
```gherkin
Scenario: CompiledPhase includes parallel property in expandStep
  Given the expandStep function creates CompiledPhase objects
  When I check the object creation in the map function
  Then the parallel property is propagated from phase.parallel
```

Verification: `grep -E "parallel:\s*phase\.parallel" plugins/m42-sprint/compiler/src/expand-foreach.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Parallel property appears in CompiledPhase object literal
```gherkin
Scenario: Parallel property is in the object literal between lines 117-122
  Given the expandStep function returns CompiledPhase objects
  When I examine the object creation block
  Then parallel property is included alongside id, status, and prompt
```

Verification: `sed -n '117,125p' plugins/m42-sprint/compiler/src/expand-foreach.ts | grep -q "parallel"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Compiler builds successfully
```gherkin
Scenario: Compiler builds without errors
  Given the source code changes are complete
  When I build the compiler module
  Then the build completes successfully
```

Verification: `cd plugins/m42-sprint/compiler && npm run build 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0

---

## Scenario 5: Return type is compatible with CompiledPhase interface
```gherkin
Scenario: The object literal is type-compatible with CompiledPhase
  Given CompiledPhase interface includes optional parallel property
  When expandStep creates objects with parallel property
  Then the type checker accepts the assignment
```

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit src/expand-foreach.ts 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0

---

## Scenario 6: WorkflowPhase.parallel is accessed in expandStep
```gherkin
Scenario: The function accesses phase.parallel property
  Given expandStep iterates over workflow.phases
  When creating CompiledPhase for each phase
  Then phase.parallel is referenced in the mapping function
```

Verification: `grep -A 20 "workflow.phases.map" plugins/m42-sprint/compiler/src/expand-foreach.ts | grep -q "phase\.parallel"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
