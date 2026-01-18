# Step Context: step-9

## Task
Create integration test for parallel execution:

1. Create test workflow with parallel sub-phase in step workflow
2. Create test sprint with 2-3 steps using this workflow
3. Run compilation and verify:
   - parallel-tasks array is initialized
   - parallel flag propagates to compiled sub-phases
   - wait-for-parallel flag appears on sync phases

4. Test execution (manual or automated):
   - Verify parallel tasks spawn as background processes
   - Verify main loop advances without waiting
   - Verify wait-for-parallel blocks until completion
   - Check parallel task logs are created
   - Test failure handling (kill a parallel task, check status)

Reference: context/implementation-plan.md section 8 (Verification Plan)

## Related Code Patterns

### Similar Test: plugins/m42-sprint/compiler/src/validate.test.ts
```typescript
// Simple test runner pattern used in the project
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`); // intentional
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error}`);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// Tests follow this pattern:
test('DESCRIPTION: should pass when condition', () => {
  const result = someFunction(input);
  assert(result === expected, `Expected ${expected}, got ${result}`);
});
```

### Workflow Definition Pattern: .claude/workflows/gherkin-step-workflow.yaml
```yaml
# Step workflow with multiple sub-phases
name: Gherkin Step Workflow
phases:
  - id: plan
    prompt: |
      Generate binary-verifiable gherkin scenarios...

  - id: context
    prompt: |
      Gather step-specific context...

  - id: execute
    prompt: |
      Implement the step...
```

### Top-Level Workflow Pattern: .claude/workflows/gherkin-verified-execution.yaml
```yaml
# Main workflow with for-each and sync phases
name: Gherkin-Verified Execution
phases:
  - id: preflight
    prompt: |
      Create comprehensive sprint context...

  - id: development
    for-each: step
    workflow: gherkin-step-workflow

  - id: final-qa
    prompt: |
      Comprehensive Quality Assurance...
```

### Sprint Definition Pattern: .claude/sprints/<sprint-id>/SPRINT.yaml
```yaml
workflow: gherkin-verified-execution
steps:
  - prompt: "Step 1 description"
  - prompt: "Step 2 description"
```

## Required Imports
### Internal
- Test workflows: Reference existing `.claude/workflows/` patterns
- Sprint definition: Reference existing `.claude/sprints/*/SPRINT.yaml` patterns
- Compiler: `plugins/m42-sprint/compiler/src/` modules (types, compile, validate)

### External
- `yq`: CLI tool for YAML manipulation (already used in scripts)
- `js-yaml`: YAML parsing in TypeScript (already in project)

## Types/Interfaces to Use
```typescript
// From types.ts - Already implemented parallel types
interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  parallel?: boolean;           // Key: runs in background
  'wait-for-parallel'?: boolean; // Key: sync point
}

interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  parallel?: boolean;           // Propagated from WorkflowPhase
  'parallel-task-id'?: string;  // Set at runtime when spawned
}

interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  prompt?: string;
  steps?: CompiledStep[];
  'wait-for-parallel'?: boolean; // Propagated from WorkflowPhase
}

interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  'parallel-tasks'?: ParallelTask[]; // Initialized to [] by compiler
}

interface ParallelTask {
  id: string;
  'step-id': string;
  'phase-id': string;
  status: 'spawned' | 'running' | 'completed' | 'failed';
  pid?: number;
  'log-file'?: string;
  'spawned-at'?: string;
  'completed-at'?: string;
  'exit-code'?: number;
  error?: string;
}
```

## Integration Points

### Test Workflow Files (to create)
1. `.claude/workflows/test-parallel-step.yaml` - Step workflow with `parallel: true` sub-phase
2. `.claude/workflows/test-parallel-main.yaml` - Main workflow with `wait-for-parallel: true` sync phase
3. `.claude/sprints/test-parallel-execution/SPRINT.yaml` - Test sprint definition

### Compilation Verification
- Compile test sprint using: `cd plugins/m42-sprint/compiler && npm run build && node dist/index.js compile .claude/sprints/test-parallel-execution`
- Verify PROGRESS.yaml with yq commands per gherkin scenarios

### Runtime Verification (scripts)
- `plugins/m42-sprint/scripts/sprint-loop.sh` - Contains parallel functions:
  - `is_parallel_subphase()` - Check if sub-phase has `parallel: true`
  - `spawn_parallel_task()` - Spawn Claude in background with prompt
  - `is_wait_for_parallel_phase()` - Check for `wait-for-parallel: true`
  - `wait_for_parallel_tasks()` - Block until all parallel tasks complete
  - `update_parallel_task_statuses()` - Poll PIDs and update PROGRESS.yaml

- `plugins/m42-sprint/scripts/build-parallel-prompt.sh` - Generates prompts for parallel tasks

## Implementation Notes

### Verification Commands (from gherkin scenarios)
```bash
# Scenario 1: Test step workflow exists with parallel sub-phase
test -f .claude/workflows/test-parallel-step.yaml && \
  grep -q "parallel: true" .claude/workflows/test-parallel-step.yaml

# Scenario 2: Test main workflow with wait-for-parallel
test -f .claude/workflows/test-parallel-main.yaml && \
  grep -q "wait-for-parallel: true" .claude/workflows/test-parallel-main.yaml

# Scenario 3: Test sprint with 2+ steps
test -f .claude/sprints/test-parallel-execution/SPRINT.yaml && \
  yq -e '.steps | length >= 2' .claude/sprints/test-parallel-execution/SPRINT.yaml

# Scenario 4: parallel-tasks array initialized
test -f .claude/sprints/test-parallel-execution/PROGRESS.yaml && \
  yq -e '."parallel-tasks" == []' .claude/sprints/test-parallel-execution/PROGRESS.yaml

# Scenario 5: parallel flag propagates to sub-phases
yq -e '[.phases[].steps[]?.phases[]? | select(.parallel == true)] | length > 0' \
  .claude/sprints/test-parallel-execution/PROGRESS.yaml

# Scenario 6: wait-for-parallel on top-level phase
yq -e '[.phases[] | select(."wait-for-parallel" == true)] | length > 0' \
  .claude/sprints/test-parallel-execution/PROGRESS.yaml

# Scenario 7: Sprint loop parallel helper functions exist
grep -q "is_parallel_subphase()" plugins/m42-sprint/scripts/sprint-loop.sh && \
  grep -q "spawn_parallel_task()" plugins/m42-sprint/scripts/sprint-loop.sh && \
  grep -q "wait_for_parallel_tasks()" plugins/m42-sprint/scripts/sprint-loop.sh

# Scenario 8: build-parallel-prompt.sh exists and is executable
test -x plugins/m42-sprint/scripts/build-parallel-prompt.sh
```

### Test Workflow Design

**test-parallel-step.yaml** - Step workflow with parallel sub-phase:
```yaml
name: Test Parallel Step Workflow
phases:
  - id: execute
    prompt: "Execute main task for: {{step.prompt}}"

  - id: parallel-task
    prompt: "Run parallel task for: {{step.prompt}}"
    parallel: true   # This phase spawns in background
```

**test-parallel-main.yaml** - Main workflow with sync phase:
```yaml
name: Test Parallel Main Workflow
phases:
  - id: development
    for-each: step
    workflow: test-parallel-step

  - id: sync
    prompt: "Wait for all parallel tasks to complete"
    wait-for-parallel: true   # This phase blocks until parallel tasks done
```

### File Locations
- Workflows: `.claude/workflows/test-parallel-*.yaml`
- Sprint: `.claude/sprints/test-parallel-execution/`
  - `SPRINT.yaml` - Sprint definition
  - `PROGRESS.yaml` - Compiled output (generated)
  - `context/` - Context files (optional)
  - `logs/` - Parallel task logs (runtime)
