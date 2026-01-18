# Gherkin Scenarios: step-4

## Step Task
Perform End-to-End test of the Ralph Mode implementation.

This step validates the complete Ralph Mode workflow by:
1. Creating a test sprint with Ralph workflow
2. Compiling it with the compiler
3. Validating the generated PROGRESS.yaml
4. Testing prompt generation for all three modes
5. Verifying mode detection
6. Cleaning up test artifacts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Test Sprint Directory Creation
```gherkin
Scenario: Test sprint directory can be created
  Given the project directory exists
  When I create the test sprint directory structure
  Then .claude/sprints/test-ralph-e2e exists

Verification: `mkdir -p .claude/sprints/test-ralph-e2e && test -d .claude/sprints/test-ralph-e2e`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Test SPRINT.yaml Creation
```gherkin
Scenario: Test SPRINT.yaml with Ralph workflow is created
  Given the test sprint directory exists
  When I create SPRINT.yaml with workflow: ralph and goal field
  Then .claude/sprints/test-ralph-e2e/SPRINT.yaml exists with correct structure

Verification: `cat > .claude/sprints/test-ralph-e2e/SPRINT.yaml << 'EOF'
workflow: ralph
goal: |
  Create a simple hello.ts file that exports a greet function.
  The function should take a name and return "Hello, {name}!".
  Include a test file hello.test.ts with basic tests.

per-iteration-hooks:
  learning:
    enabled: false
EOF
test -f .claude/sprints/test-ralph-e2e/SPRINT.yaml && grep -q "workflow: ralph" .claude/sprints/test-ralph-e2e/SPRINT.yaml && grep -q "goal:" .claude/sprints/test-ralph-e2e/SPRINT.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Compiler Generates PROGRESS.yaml with Ralph Mode
```gherkin
Scenario: Compiler generates PROGRESS.yaml with mode: ralph
  Given .claude/sprints/test-ralph-e2e/SPRINT.yaml exists
  When I run the compiler on the test sprint
  Then PROGRESS.yaml is created with mode: ralph

Verification: `node plugins/m42-sprint/compiler/dist/index.js .claude/sprints/test-ralph-e2e -w ".claude/workflows" && yq -r '.mode' .claude/sprints/test-ralph-e2e/PROGRESS.yaml | grep -qx "ralph"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: PROGRESS.yaml Contains Goal Field
```gherkin
Scenario: PROGRESS.yaml contains the goal from SPRINT.yaml
  Given PROGRESS.yaml has been generated
  When I check for the goal field
  Then the goal field contains the original goal text

Verification: `yq -r '.goal' .claude/sprints/test-ralph-e2e/PROGRESS.yaml | grep -q "hello.ts"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: PROGRESS.yaml Has Empty Dynamic-Steps
```gherkin
Scenario: PROGRESS.yaml has empty dynamic-steps array
  Given PROGRESS.yaml has been generated
  When I check the dynamic-steps field
  Then dynamic-steps is an empty array

Verification: `yq -r '.dynamic-steps | length' .claude/sprints/test-ralph-e2e/PROGRESS.yaml | grep -qx "0"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Prompt Builder Generates Planning Mode Prompt
```gherkin
Scenario: build-ralph-prompt.sh generates planning mode prompt
  Given PROGRESS.yaml exists with mode: ralph
  When I run build-ralph-prompt.sh with planning mode
  Then a non-empty prompt is generated containing goal information

Verification: `OUTPUT=$(plugins/m42-sprint/scripts/build-ralph-prompt.sh .claude/sprints/test-ralph-e2e planning 1 2>/dev/null) && test -n "$OUTPUT" && echo "$OUTPUT" | grep -qi "goal\|planning\|analyze"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Mode Detection Returns Ralph
```gherkin
Scenario: Sprint loop mode detection identifies Ralph mode
  Given PROGRESS.yaml has mode: ralph
  When I read the mode field using yq
  Then the mode is "ralph"

Verification: `MODE=$(yq -r '.mode // "standard"' .claude/sprints/test-ralph-e2e/PROGRESS.yaml) && test "$MODE" = "ralph"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Test Sprint Cleanup Succeeds
```gherkin
Scenario: Test sprint directory is cleaned up
  Given the test sprint directory exists
  When I remove the test-ralph-e2e directory
  Then the directory no longer exists

Verification: `rm -rf .claude/sprints/test-ralph-e2e && test ! -d .claude/sprints/test-ralph-e2e`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Execution Order

These scenarios must be executed in order as they have dependencies:

1. **Scenario 1** → Creates test directory
2. **Scenario 2** → Creates SPRINT.yaml (depends on 1)
3. **Scenario 3** → Compiles to PROGRESS.yaml (depends on 2)
4. **Scenarios 4-5** → Validate PROGRESS.yaml structure (depend on 3)
5. **Scenario 6** → Tests prompt generation (depends on 3)
6. **Scenario 7** → Tests mode detection (depends on 3)
7. **Scenario 8** → Cleanup (should run last)

## Full Verification Script

Run all scenarios in sequence:

```bash
#!/bin/bash
set -e

SCORE=0
TOTAL=8

# Scenario 1
mkdir -p .claude/sprints/test-ralph-e2e && test -d .claude/sprints/test-ralph-e2e && ((SCORE++)) && echo "Scenario 1: PASS"

# Scenario 2
cat > .claude/sprints/test-ralph-e2e/SPRINT.yaml << 'EOF'
workflow: ralph
goal: |
  Create a simple hello.ts file that exports a greet function.
  The function should take a name and return "Hello, {name}!".
  Include a test file hello.test.ts with basic tests.

per-iteration-hooks:
  learning:
    enabled: false
EOF
test -f .claude/sprints/test-ralph-e2e/SPRINT.yaml && grep -q "workflow: ralph" .claude/sprints/test-ralph-e2e/SPRINT.yaml && ((SCORE++)) && echo "Scenario 2: PASS"

# Scenario 3
node plugins/m42-sprint/compiler/dist/index.js .claude/sprints/test-ralph-e2e -w ".claude/workflows" && \
yq -r '.mode' .claude/sprints/test-ralph-e2e/PROGRESS.yaml | grep -qx "ralph" && ((SCORE++)) && echo "Scenario 3: PASS"

# Scenario 4
yq -r '.goal' .claude/sprints/test-ralph-e2e/PROGRESS.yaml | grep -q "hello.ts" && ((SCORE++)) && echo "Scenario 4: PASS"

# Scenario 5
yq -r '.dynamic-steps | length' .claude/sprints/test-ralph-e2e/PROGRESS.yaml | grep -qx "0" && ((SCORE++)) && echo "Scenario 5: PASS"

# Scenario 6
OUTPUT=$(plugins/m42-sprint/scripts/build-ralph-prompt.sh .claude/sprints/test-ralph-e2e planning 1 2>/dev/null)
test -n "$OUTPUT" && echo "$OUTPUT" | grep -qi "goal\|planning\|analyze" && ((SCORE++)) && echo "Scenario 6: PASS"

# Scenario 7
MODE=$(yq -r '.mode // "standard"' .claude/sprints/test-ralph-e2e/PROGRESS.yaml)
test "$MODE" = "ralph" && ((SCORE++)) && echo "Scenario 7: PASS"

# Scenario 8
rm -rf .claude/sprints/test-ralph-e2e && test ! -d .claude/sprints/test-ralph-e2e && ((SCORE++)) && echo "Scenario 8: PASS"

echo ""
echo "Final Score: $SCORE/$TOTAL"
test "$SCORE" -eq "$TOTAL"
```

## Additional Validation

After E2E tests pass, verify compiler project integrity:

```bash
cd plugins/m42-sprint/compiler && npm run build && npm run typecheck
```

This ensures no regressions were introduced during Ralph Mode implementation.
