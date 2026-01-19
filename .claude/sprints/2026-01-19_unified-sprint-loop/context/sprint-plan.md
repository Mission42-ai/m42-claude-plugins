# Sprint Plan: 2026-01-19_unified-sprint-loop

## Goal

Unify Standard Mode and Ralph Mode into a single execution loop with:
1. Configurable runtime prompts via SPRINT.yaml `prompts:` section
2. Dynamic step injection via `orchestration:` configuration
3. Complete removal of Ralph Mode code
4. Workflow templates for different use cases

## Success Criteria

- [ ] `npm run build` in compiler directory succeeds
- [ ] `npm run typecheck` in compiler directory has no errors
- [ ] Existing standard sprints run unchanged (backward compatible)
- [ ] `grep -ri "ralph" plugins/m42-sprint/scripts/` returns nothing
- [ ] Custom `prompts:` in SPRINT.yaml are used when specified
- [ ] Sprint without `prompts:` uses defaults (backward compatible)
- [ ] All 3 workflow templates are valid YAML
- [ ] Sprint with `orchestration.enabled: true` processes proposedSteps

## Step Breakdown

### Step 0: foundation

**Scope**: Extend TypeScript types for orchestration and configurable prompts - schema changes only, no bash scripts.

**Files**:
- Modify: `plugins/m42-sprint/compiler/src/types.ts`
- Modify: `plugins/m42-sprint/compiler/src/compile.ts`

**New Types**:
- `OrchestrationConfig` interface
- `ProposedStep` interface
- `StepQueueItem` interface
- `SprintPrompts` interface

**New Functions**:
- `compileOrchestration()` - process orchestration config
- `compilePrompts()` - process prompt templates

**Dependencies**: None (first step)

**Risk**: Low - additive type changes, backward compatible

**Verification**:
- `npm run build` succeeds
- `npm run typecheck` passes
- Existing tests still pass

---

### Step 1: ralph-cleanup

**Scope**: Remove Ralph mode completely - deletions only, no new functionality.

**Files**:
- Modify: `plugins/m42-sprint/scripts/sprint-loop.sh`
  - Remove `run_ralph_loop()` function (~160 lines)
  - Remove `process_ralph_result()` function (~150 lines)
  - Remove mode dispatch (`case "$SPRINT_MODE"`)
  - Remove Ralph-specific variables and checks
- Delete: `plugins/m42-sprint/scripts/build-ralph-prompt.sh`
- Delete: `.claude/workflows/ralph.yaml` (if exists)
- Delete: `.claude/workflows/ralph-with-bookends.yaml`

**Dependencies**: Step 0 (foundation)

**Risk**: Medium - significant code removal, but Ralph mode is not used in production

**Verification**:
- `grep -ri "ralph" plugins/m42-sprint/scripts/` returns nothing
- Deleted files don't exist
- Standard workflow still runs

---

### Step 2: configurable-prompts

**Scope**: Make runtime prompts configurable and create workflow templates.

**Files**:
- Modify: `plugins/m42-sprint/scripts/build-sprint-prompt.sh`
  - Add `load_prompt_template()` function
  - Add `substitute_variables()` function
  - Implement defaults for all prompt sections
- Create: `plugins/m42-sprint/templates/gherkin-step-workflow.yaml`
  - Copy from `.claude/workflows/gherkin-step-workflow.yaml`
- Create: `plugins/m42-sprint/templates/minimal-workflow.yaml`
  - Minimal direct step execution
- Create: `plugins/m42-sprint/templates/orchestrated-workflow.yaml`
  - Step execution with proposedSteps support

**Dependencies**: Step 1 (ralph-cleanup)

**Risk**: Low - additive changes, defaults maintain backward compatibility

**Verification**:
- Sprint with custom `prompts:` uses custom prompts
- Sprint without `prompts:` uses defaults
- All 3 templates are valid YAML (`yq` can parse them)

---

### Step 3: unified-loop-orchestration

**Scope**: Implement unified loop with orchestration support.

**Files**:
- Modify: `plugins/m42-sprint/scripts/sprint-loop.sh`
  - Replace `run_standard_loop()` with `run_loop()`
  - Add `extract_proposed_steps()` function
  - Add `add_to_step_queue()` function
  - Add `should_run_orchestration()` function
  - Add `run_orchestration_iteration()` function
  - Add `insert_step_at_position()` function
  - Implement auto-approve mode

**Dependencies**: Steps 0, 1, 2 (all previous)

**Risk**: High - core loop changes, requires careful testing

**Verification**:
- Sprint without orchestration runs as before
- Sprint with `orchestration.enabled: true`:
  - proposedSteps in result → step-queue populated
  - Orchestration runs → decisions made
  - Approved steps inserted and executed

## Step Dependency Graph

```
foundation (Step 0)
     ↓
ralph-cleanup (Step 1)
     ↓
configurable-prompts (Step 2)
     ↓
unified-loop-orchestration (Step 3)
```

Linear dependency chain - each step requires the previous step to be complete.

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing sprints | High | Extensive backward compatibility testing |
| Ralph removal incomplete | Medium | Comprehensive grep verification |
| Type errors propagating | Medium | TypeScript strict mode, incremental changes |
| Orchestration complexity | Medium | Auto-approve as simpler alternative |
| YAML manipulation errors | Medium | Atomic updates with backup/restore |

## Estimated Complexity

| Step | Complexity | Reason |
|------|------------|--------|
| foundation | Medium | Multiple new types, compiler changes |
| ralph-cleanup | Medium | Large code removal, careful extraction |
| configurable-prompts | Low | Template functions, file copying |
| unified-loop-orchestration | High | Core loop refactoring, new features |

## Context Files

| File | Purpose |
|------|---------|
| `context/_shared-context.md` | Project architecture, types, commands |
| `context/implementation-plan.md` | Detailed orchestration architecture |
| `context/prompt-extraction-concept.md` | Configurable prompts design |
| `context/sprint-plan.md` | This file - step breakdown and verification |
