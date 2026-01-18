# Step Context: step-4

## Task
Perform End-to-End test of the Ralph Mode implementation.

This step validates the complete Ralph Mode workflow by:
1. Creating a test sprint with Ralph workflow
2. Compiling it with the compiler
3. Validating the generated PROGRESS.yaml
4. Testing prompt generation for all three modes
5. Verifying mode detection
6. Cleaning up test artifacts

## Related Code Patterns

### Compiler: Ralph Mode Compilation (`plugins/m42-sprint/compiler/src/compile.ts:377-432`)
```typescript
function compileRalphMode(
  sprintDef: SprintDefinition,
  workflow: WorkflowDefinition,
  config: CompilerConfig,
  errors: CompilerError[],
  warnings: string[]
): CompilerResult {
  const sprintId = sprintDef['sprint-id'] || generateSprintId(config.sprintDir);
  const mergedHooks = mergePerIterationHooks(
    workflow['per-iteration-hooks'],
    sprintDef['per-iteration-hooks']
  );

  const progress: CompiledProgress = {
    'sprint-id': sprintId,
    status: 'not-started',
    mode: 'ralph',
    goal: sprintDef.goal,
    'dynamic-steps': [],
    'hook-tasks': [],
    'per-iteration-hooks': mergedHooks,
    // ...
  };
  return { success: true, progress, errors, warnings };
}
```

### Prompt Builder Pattern (`plugins/m42-sprint/scripts/build-ralph-prompt.sh`)
```bash
# Three modes: planning, executing, reflecting
case "$MODE" in
  planning)
    # Goal analysis and step creation
    ;;
  executing)
    # Execute pending step
    STEP_ID=$(yq -r '[.dynamic-steps[] | select(.status == "pending")][0].id // "null"' "$PROGRESS_FILE")
    ;;
  reflecting)
    # No pending steps - reflect on progress
    ;;
esac
```

### Sprint Loop Mode Detection (`plugins/m42-sprint/scripts/sprint-loop.sh:1448-1452`)
```bash
SPRINT_MODE=$(yq -r '.mode // "standard"' "$PROGRESS_FILE")

case "$SPRINT_MODE" in
  "ralph") run_ralph_loop ;;
  *) run_standard_loop ;;
esac
```

### Ralph Workflow Definition (`.claude/workflows/ralph.yaml`)
```yaml
name: Ralph Mode Workflow
mode: ralph

goal-prompt: |
  Analyze the goal and create initial implementation steps.

reflection-prompt: |
  No pending steps remain. Evaluate if complete.

per-iteration-hooks:
  - id: learning
    workflow: "m42-signs:learning-extraction"
    parallel: true
    enabled: false  # Default disabled, override in SPRINT.yaml
```

## Required Imports
### Internal
- None (E2E test uses external CLI tools)

### External (CLI tools)
- `yq`: YAML manipulation and querying
- `node`: Run compiler
- `bash`: Execute test scripts

## Types/Interfaces to Validate

### PROGRESS.yaml for Ralph Mode (from `types.ts`)
```typescript
interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  mode?: 'ralph';  // Must be 'ralph'
  goal?: string;   // Must be present
  'dynamic-steps'?: DynamicStep[];  // Must be empty array initially
  'per-iteration-hooks'?: PerIterationHook[];  // Merged from workflow+sprint
  ralph?: RalphConfig;
  'ralph-exit'?: RalphExitInfo;
}

interface DynamicStep {
  id: string;
  prompt: string;
  status: PhaseStatus;
  'added-at': string;
  'added-in-iteration': number;
}
```

## Integration Points

### Called by
- E2E test script (manual execution)
- Could be automated in CI/CD pipeline

### Calls
- `plugins/m42-sprint/compiler/dist/index.js` - Main compiler
- `plugins/m42-sprint/scripts/build-ralph-prompt.sh` - Prompt generation
- `.claude/workflows/ralph.yaml` - Workflow definition

### Validation Points
1. **Compiler output** → PROGRESS.yaml with correct structure
2. **Mode detection** → `yq -r '.mode'` returns "ralph"
3. **Goal preservation** → Goal text from SPRINT.yaml appears in PROGRESS.yaml
4. **Dynamic steps** → Initially empty array `[]`
5. **Per-iteration hooks** → Merged with sprint overrides (learning: disabled)
6. **Prompt generation** → All three modes produce valid output

## Test Scenarios

| Scenario | Verification Command | Expected |
|----------|---------------------|----------|
| Directory creation | `test -d .claude/sprints/test-ralph-e2e` | Exit 0 |
| SPRINT.yaml creation | `grep -q "workflow: ralph" ... && grep -q "goal:"` | Exit 0 |
| Compilation | `node ... && yq -r '.mode' | grep -qx "ralph"` | Exit 0 |
| Goal in PROGRESS | `yq -r '.goal' | grep -q "hello.ts"` | Exit 0 |
| Empty dynamic-steps | `yq -r '.dynamic-steps \| length' | grep -qx "0"` | Exit 0 |
| Planning prompt | `build-ralph-prompt.sh ... planning 1` | Non-empty |
| Mode detection | `yq -r '.mode // "standard"' | test = "ralph"` | Exit 0 |
| Cleanup | `rm -rf ... && test ! -d ...` | Exit 0 |

## Implementation Notes

1. **Test sprint path**: `.claude/sprints/test-ralph-e2e/`
2. **Compiler invocation**: Must specify `-w ".claude/workflows"` for workflow resolution
3. **yq syntax**: Uses `yq -r` for raw output (no quotes)
4. **Prompt script permissions**: Must be executable (`-x` check)
5. **Cleanup is critical**: Always remove test artifacts to avoid polluting project
6. **Sequential execution**: Scenarios have dependencies (compile before validate)
7. **No actual Claude execution**: This is structural/integration testing only

## Files Involved

| File | Role |
|------|------|
| `.claude/sprints/test-ralph-e2e/SPRINT.yaml` | Test input (created) |
| `.claude/sprints/test-ralph-e2e/PROGRESS.yaml` | Compiler output (validated) |
| `.claude/workflows/ralph.yaml` | Workflow definition (used) |
| `plugins/m42-sprint/compiler/dist/index.js` | Compiler CLI (executed) |
| `plugins/m42-sprint/scripts/build-ralph-prompt.sh` | Prompt builder (executed) |
| `plugins/m42-sprint/scripts/sprint-loop.sh` | Sprint loop (mode detection validated) |

## Success Criteria
- All 8 gherkin scenarios pass (score 8/8)
- Compiler project integrity maintained (`npm run build && npm run typecheck` passes)
