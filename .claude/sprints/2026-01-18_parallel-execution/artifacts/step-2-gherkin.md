# Gherkin Scenarios: step-2

## Step Task
Update compiler/src/compile.ts to initialize parallel-tasks array:

1. In the compile() function around line 209 where CompiledProgress is built
2. Add initialization: `'parallel-tasks': []`
3. Propagate `wait-for-parallel` from WorkflowPhase to CompiledTopPhase in expandForEach and compileSimplePhase

Reference: context/implementation-plan.md section 4.C

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: TypeScript compiles without errors
  Given the file compiler/src/compile.ts has been modified
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npm run typecheck 2>&1; echo "EXIT:$?"`
Pass: Last line contains "EXIT:0" → Score 1
Fail: Last line contains non-zero exit code → Score 0

---

## Scenario 2: CompiledProgress includes parallel-tasks initialization
  Given the compile() function builds a CompiledProgress object
  When I check the progress object construction around line 209
  Then it initializes 'parallel-tasks' as an empty array

Verification: `grep -E "['\"']parallel-tasks['\"'].*:.*\[\]" plugins/m42-sprint/compiler/src/compile.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: expandForEach propagates wait-for-parallel
  Given the expandForEach function returns a CompiledTopPhase
  When I check the return object construction
  Then it includes the wait-for-parallel property from the input phase

Verification: `grep -E "wait-for-parallel.*:.*phase\[" plugins/m42-sprint/compiler/src/expand-foreach.ts || grep -E "'wait-for-parallel'.*phase\." plugins/m42-sprint/compiler/src/expand-foreach.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: compileSimplePhase propagates wait-for-parallel
  Given the compileSimplePhase function returns a CompiledTopPhase
  When I check the return object construction
  Then it includes the wait-for-parallel property from the input phase

Verification: `grep -A 10 "function compileSimplePhase" plugins/m42-sprint/compiler/src/expand-foreach.ts | grep -E "wait-for-parallel"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Compiled output includes parallel-tasks array
  Given a valid SPRINT.yaml with a workflow
  When I run the compiler
  Then the output PROGRESS.yaml contains parallel-tasks key

Verification: `cd plugins/m42-sprint/compiler && npm run build 2>/dev/null && node dist/cli.js ../../.claude/sprints/2026-01-18_parallel-execution 2>/dev/null && grep -q "parallel-tasks" ../../.claude/sprints/2026-01-18_parallel-execution/PROGRESS.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: wait-for-parallel propagated to compiled phases with the property
  Given a workflow with wait-for-parallel: true on a phase
  When I compile the sprint
  Then the compiled phase in PROGRESS.yaml includes wait-for-parallel: true

Verification: `cd plugins/m42-sprint/compiler && npm run build 2>/dev/null && cat > /tmp/test-wait-workflow.yaml << 'EOF'
name: Test Wait Workflow
phases:
  - id: development
    for-each: step
    workflow: feature-standard
  - id: sync
    prompt: "Wait for parallel tasks"
    wait-for-parallel: true
EOF
mkdir -p /tmp/test-sprint && cat > /tmp/test-sprint/SPRINT.yaml << 'EOF'
name: Test Sprint
workflow: test-wait-workflow
steps:
  - id: step-0
    prompt: Test step
EOF
node dist/cli.js /tmp/test-sprint --workflows-dir /tmp 2>/dev/null; grep -q "wait-for-parallel: true" /tmp/test-sprint/PROGRESS.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
