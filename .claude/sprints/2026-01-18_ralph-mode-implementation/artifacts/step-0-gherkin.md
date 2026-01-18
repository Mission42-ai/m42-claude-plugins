# Gherkin Scenarios: step-0

## Step Task
Erweitere das Compiler-System für Ralph Mode Support.

### 1. Types erweitern (plugins/m42-sprint/compiler/src/types.ts)

Füge `PerIterationHook` Interface und erweitere `WorkflowDefinition` und `SprintDefinition` um Ralph Mode Felder.

### 2. Compile.ts erweitern (plugins/m42-sprint/compiler/src/compile.ts)

Füge Ralph Mode Detection und PROGRESS.yaml Generierung hinzu mit Ralph-spezifischer Struktur.

### 3. Validierung

Füge Validierungsregeln hinzu für Ralph Mode Requirements.

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: PerIterationHook interface exists in types.ts

```gherkin
Scenario: PerIterationHook interface is defined
  Given the compiler types file exists
  When I check for PerIterationHook interface
  Then the interface has id, workflow, prompt, parallel, and enabled fields
```

Verification: `grep -qE "export\s+(interface|type)\s+PerIterationHook" plugins/m42-sprint/compiler/src/types.ts && grep -A10 "interface PerIterationHook" plugins/m42-sprint/compiler/src/types.ts | grep -q "id:" && grep -A10 "interface PerIterationHook" plugins/m42-sprint/compiler/src/types.ts | grep -q "workflow\?:" && grep -A10 "interface PerIterationHook" plugins/m42-sprint/compiler/src/types.ts | grep -q "prompt\?:" && grep -A10 "interface PerIterationHook" plugins/m42-sprint/compiler/src/types.ts | grep -q "parallel:" && grep -A10 "interface PerIterationHook" plugins/m42-sprint/compiler/src/types.ts | grep -q "enabled:"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: WorkflowDefinition has Ralph mode fields

```gherkin
Scenario: WorkflowDefinition interface includes Ralph mode fields
  Given the compiler types file exists
  When I check WorkflowDefinition interface
  Then it has mode, goal-prompt, reflection-prompt, and per-iteration-hooks fields
```

Verification: `grep -A30 "export interface WorkflowDefinition" plugins/m42-sprint/compiler/src/types.ts | grep -q "mode\?:" && grep -A30 "export interface WorkflowDefinition" plugins/m42-sprint/compiler/src/types.ts | grep -qE "goal-prompt|\"goal-prompt\"" && grep -A30 "export interface WorkflowDefinition" plugins/m42-sprint/compiler/src/types.ts | grep -qE "reflection-prompt|\"reflection-prompt\"" && grep -A30 "export interface WorkflowDefinition" plugins/m42-sprint/compiler/src/types.ts | grep -qE "per-iteration-hooks|\"per-iteration-hooks\""`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: SprintDefinition has goal field for Ralph mode

```gherkin
Scenario: SprintDefinition interface includes goal field
  Given the compiler types file exists
  When I check SprintDefinition interface
  Then it has an optional goal field for Ralph mode
```

Verification: `grep -A40 "export interface SprintDefinition" plugins/m42-sprint/compiler/src/types.ts | grep -qE "goal\?:"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: TypeScript compiler builds without errors

```gherkin
Scenario: TypeScript compiles without errors
  Given the types.ts file has been extended with Ralph mode interfaces
  When I run the TypeScript compiler
  Then no compilation errors occur
```

Verification: `cd plugins/m42-sprint/compiler && npm run build 2>&1 | tail -1 | grep -vq "error"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: CompiledProgress has Ralph mode fields

```gherkin
Scenario: CompiledProgress interface includes Ralph mode structure
  Given the compiler types file exists
  When I check CompiledProgress interface
  Then it has mode, goal, dynamic-steps, hook-tasks, per-iteration-hooks, and ralph fields
```

Verification: `grep -qE "export interface CompiledProgress" plugins/m42-sprint/compiler/src/types.ts && (grep -A50 "export interface CompiledProgress" plugins/m42-sprint/compiler/src/types.ts | grep -qE "mode\?:|'mode'\?:" || grep -qE "export interface RalphCompiledProgress" plugins/m42-sprint/compiler/src/types.ts)`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Compile.ts detects Ralph mode workflows

```gherkin
Scenario: Compiler detects Ralph mode from workflow
  Given compile.ts handles workflow compilation
  When I check for Ralph mode detection logic
  Then the compiler checks for mode: ralph in workflow definition
```

Verification: `grep -qE "mode.*ralph|ralph.*mode" plugins/m42-sprint/compiler/src/compile.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Validation enforces goal field for Ralph mode

```gherkin
Scenario: Validation requires goal field when using Ralph workflow
  Given validate.ts contains sprint validation rules
  When I check for Ralph mode validation
  Then validation checks that goal field exists for Ralph mode sprints
```

Verification: `grep -qE "goal|ralph" plugins/m42-sprint/compiler/src/validate.ts && grep -qE "Ralph.*goal|goal.*ralph|Ralph mode requires" plugins/m42-sprint/compiler/src/validate.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Per-iteration hooks merging logic exists

```gherkin
Scenario: Compiler implements per-iteration hook merging
  Given compile.ts handles workflow compilation
  When I check for hook merging logic
  Then the compiler has logic to merge per-iteration hooks from workflow and sprint
```

Verification: `grep -qE "per-iteration-hooks|perIterationHooks|iteration.*hook|hook.*merge|merge.*hook" plugins/m42-sprint/compiler/src/compile.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Summary Verification Script

Run all scenarios with this composite verification:

```bash
#!/bin/bash
# Verify all step-0 gherkin scenarios

SCORE=0
TOTAL=8

echo "=== Step 0 Gherkin Verification ==="

# Scenario 1: PerIterationHook interface
if grep -qE "export\s+(interface|type)\s+PerIterationHook" plugins/m42-sprint/compiler/src/types.ts 2>/dev/null; then
  echo "✓ Scenario 1: PerIterationHook interface exists"
  ((SCORE++))
else
  echo "✗ Scenario 1: PerIterationHook interface missing"
fi

# Scenario 2: WorkflowDefinition Ralph fields
if grep -A30 "export interface WorkflowDefinition" plugins/m42-sprint/compiler/src/types.ts 2>/dev/null | grep -qE "mode\?:" ; then
  echo "✓ Scenario 2: WorkflowDefinition has mode field"
  ((SCORE++))
else
  echo "✗ Scenario 2: WorkflowDefinition missing Ralph fields"
fi

# Scenario 3: SprintDefinition goal field
if grep -A40 "export interface SprintDefinition" plugins/m42-sprint/compiler/src/types.ts 2>/dev/null | grep -qE "goal\?:" ; then
  echo "✓ Scenario 3: SprintDefinition has goal field"
  ((SCORE++))
else
  echo "✗ Scenario 3: SprintDefinition missing goal field"
fi

# Scenario 4: TypeScript compiles
if cd plugins/m42-sprint/compiler && npm run build >/dev/null 2>&1; then
  echo "✓ Scenario 4: TypeScript compiles without errors"
  ((SCORE++))
  cd - >/dev/null
else
  echo "✗ Scenario 4: TypeScript compilation failed"
  cd - >/dev/null 2>/dev/null
fi

# Scenario 5: CompiledProgress Ralph fields
if grep -qE "mode\?:|'mode'\?:" plugins/m42-sprint/compiler/src/types.ts 2>/dev/null; then
  echo "✓ Scenario 5: CompiledProgress has Ralph mode fields"
  ((SCORE++))
else
  echo "✗ Scenario 5: CompiledProgress missing Ralph fields"
fi

# Scenario 6: Ralph mode detection in compile.ts
if grep -qE "mode.*ralph|ralph.*mode" plugins/m42-sprint/compiler/src/compile.ts 2>/dev/null; then
  echo "✓ Scenario 6: Compiler detects Ralph mode"
  ((SCORE++))
else
  echo "✗ Scenario 6: Ralph mode detection missing in compile.ts"
fi

# Scenario 7: Validation enforces goal for Ralph
if grep -qE "Ralph.*goal|goal.*ralph|Ralph mode requires" plugins/m42-sprint/compiler/src/validate.ts 2>/dev/null; then
  echo "✓ Scenario 7: Validation enforces goal for Ralph mode"
  ((SCORE++))
else
  echo "✗ Scenario 7: Validation missing goal check for Ralph"
fi

# Scenario 8: Hook merging logic
if grep -qE "per-iteration-hooks|perIterationHooks|iteration.*hook|hook.*merge|merge.*hook" plugins/m42-sprint/compiler/src/compile.ts 2>/dev/null; then
  echo "✓ Scenario 8: Hook merging logic exists"
  ((SCORE++))
else
  echo "✗ Scenario 8: Hook merging logic missing"
fi

echo ""
echo "=== Final Score: $SCORE/$TOTAL ==="

if [ "$SCORE" -eq "$TOTAL" ]; then
  echo "✓ All scenarios pass - step-0 complete"
  exit 0
else
  echo "✗ Some scenarios failed - step-0 incomplete"
  exit 1
fi
```
