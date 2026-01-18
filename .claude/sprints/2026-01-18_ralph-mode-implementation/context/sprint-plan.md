# Sprint Plan: 2026-01-18_ralph-mode-implementation

## Goal

Implement "Ralph Mode" - a hybrid workflow system that combines autonomous Claude loops with deterministic per-iteration hooks. Unlike the standard phase-based workflow where Claude follows predefined steps, Ralph Mode allows Claude to analyze a goal, dynamically create steps, execute them, and decide when the goal is complete, while still running configurable parallel tasks (like learning extraction) deterministically each iteration.

## Success Criteria

- [ ] Compiler detects `mode: ralph` workflows and generates appropriate PROGRESS.yaml
- [ ] SPRINT.yaml with `workflow: ralph` requires `goal:` field
- [ ] Per-iteration hooks merge correctly (workflow defaults + sprint overrides)
- [ ] `sprint-loop.sh` detects Ralph mode and runs `run_ralph_loop()` instead of standard loop
- [ ] Ralph loop runs as infinite loop until `RALPH_COMPLETE:` detected
- [ ] Per-iteration hooks spawn parallel tasks as configured
- [ ] `build-ralph-prompt.sh` generates mode-specific prompts (planning/executing/reflecting)
- [ ] `ralph.yaml` workflow exists with default hook configurations
- [ ] Documentation covers Ralph mode concepts, schema, and usage
- [ ] E2E test validates compilation, prompt generation, and mode detection

## Step Breakdown

### Step 0: Worktree Setup
**Scope**: Create dedicated worktree and branch for Ralph mode development
**Files**: No code files - infrastructure setup only
**Dependencies**: None
**Risk**: Low - standard git operations

### Step 1: Compiler Extensions
**Scope**: Extend TypeScript compiler to handle Ralph mode workflows
**Files**:
- `plugins/m42-sprint/compiler/src/types.ts` (modify)
- `plugins/m42-sprint/compiler/src/compile.ts` (modify)
- `plugins/m42-sprint/compiler/src/validate.ts` (modify - may need validation rules)

**Dependencies**: None
**Risk**: Medium - core compiler changes require careful handling of existing functionality

### Step 2: Sprint Loop Implementation
**Scope**: Add Ralph loop execution logic to sprint-loop.sh
**Files**:
- `plugins/m42-sprint/scripts/sprint-loop.sh` (modify)

**Dependencies**: Step 1 (needs compiled PROGRESS.yaml with Ralph structure)
**Risk**: Medium - complex bash logic with parallel task management

### Step 3: Prompt Builder and Workflow
**Scope**: Create Ralph-specific prompt builder and workflow definition
**Files**:
- `plugins/m42-sprint/scripts/build-ralph-prompt.sh` (create)
- `.claude/workflows/ralph.yaml` (create)

**Dependencies**: Step 1 (needs to understand PROGRESS.yaml structure), Step 2 (called by loop)
**Risk**: Medium - must handle all three modes (planning/executing/reflecting) correctly

### Step 4: Integration and Documentation
**Scope**: Documentation, schema updates, final integration
**Files**:
- `plugins/m42-sprint/docs/concepts/ralph-mode.md` (create)
- `plugins/m42-sprint/skills/orchestrating-sprints/references/progress-schema.md` (modify)
- `plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md` (modify)
- `plugins/m42-sprint/skills/orchestrating-sprints/SKILL.md` (modify)
- `plugins/m42-sprint/skills/creating-workflows/SKILL.md` (modify)

**Dependencies**: Steps 1-3 complete
**Risk**: Low - documentation and schema updates

### Step 5: End-to-End Test
**Scope**: Validate complete Ralph mode workflow
**Files**:
- `.claude/sprints/test-ralph-e2e/SPRINT.yaml` (create temporarily)
- Test execution and cleanup

**Dependencies**: All previous steps
**Risk**: Low - verification only, no production code changes

## Step Dependency Graph

```
step-0 (Worktree Setup)
    │
    ▼
step-1 (Compiler Extensions)
    │
    ├──────────────┬───────────────┐
    ▼              ▼               │
step-2 (Loop)    step-3 (Prompt)  │
    │              │               │
    └──────────────┴───────────────┘
                   │
                   ▼
            step-4 (Docs)
                   │
                   ▼
            step-5 (E2E Test)
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Compiler changes break existing workflows | High | Test standard workflow compilation after changes |
| Per-iteration hooks cause race conditions | Medium | Use proper parallel task registration in PROGRESS.yaml |
| RALPH_COMPLETE detection unreliable | Medium | Use regex pattern matching, test with various output formats |
| Infinite loop on malformed goals | Medium | Add iteration safety limit (very high, e.g., 10000) |
| yq commands fail silently | Low | Use set -e and verify yq output in scripts |

## Estimated Complexity

| Step | Complexity | Reason |
|------|------------|--------|
| step-0 | Low | Standard git/worktree operations |
| step-1 | Medium | TypeScript changes, schema extensions, validation |
| step-2 | Medium | Complex bash logic, parallel task management |
| step-3 | Medium | Three distinct modes, template generation |
| step-4 | Low | Documentation only, no logic changes |
| step-5 | Low | Test execution and verification |

## Technical Notes

### Ralph Mode PROGRESS.yaml Structure

```yaml
mode: ralph
goal: |
  User-defined goal text
ralph:
  idle-threshold: 3
per-iteration-hooks:
  - id: learning
    workflow: "m42-signs:learning-extraction"
    parallel: true
    enabled: true
dynamic-steps: []
hook-tasks: []
ralph-exit:
  detected-at: null
  iteration: null
  final-summary: null
```

### Mode Detection in sprint-loop.sh

```bash
MODE=$(yq -r '.mode // "standard"' "$PROGRESS_FILE")
if [[ "$MODE" == "ralph" ]]; then
  run_ralph_loop
else
  run_standard_loop
fi
```

### Exit Detection

Claude outputs `RALPH_COMPLETE: <summary>` when goal is achieved:
```bash
if echo "$OUTPUT" | grep -qE "RALPH_COMPLETE:"; then
  SUMMARY=$(echo "$OUTPUT" | grep -oP "RALPH_COMPLETE:\s*\K.*")
  record_ralph_completion "$iteration" "$SUMMARY"
fi
```
