# Sprint Plan: 2026-01-18_parallel-execution

## Goal

Add parallel execution capability to the m42-sprint workflow system, enabling sub-phases to run in background while the main loop continues. This allows non-blocking tasks (like documentation updates, learning loops) to execute concurrently with main implementation work, with synchronization points where the main loop can wait for all parallel tasks to complete.

## Success Criteria

- [ ] TypeScript types support parallel execution properties
- [ ] Compiler propagates parallel flags to compiled output
- [ ] Compiler initializes parallel-tasks array in CompiledProgress
- [ ] Validation checks parallel/wait-for-parallel properties
- [ ] New script builds prompts for parallel task execution
- [ ] Sprint loop spawns parallel tasks in background
- [ ] Sprint loop can wait for parallel tasks at sync points
- [ ] Prompt builder skips spawned parallel phases
- [ ] Status command shows parallel task information
- [ ] Workflow schema documentation updated
- [ ] Integration test validates end-to-end flow

## Step Breakdown

### Step 0: Add Parallel Execution Types
**Scope**: Extend TypeScript interfaces in `compiler/src/types.ts`
**Files**:
- `plugins/m42-sprint/compiler/src/types.ts`
**Dependencies**: None (foundational)
**Risk**: Low - additive changes to existing types

Changes:
1. Add `parallel?: boolean` to WorkflowPhase interface
2. Add `wait-for-parallel?: boolean` to WorkflowPhase interface
3. Create new ParallelTask interface with status tracking
4. Add `parallel-tasks?: ParallelTask[]` to CompiledProgress
5. Add `parallel?: boolean` and `parallel-task-id?: string` to CompiledPhase
6. Add `wait-for-parallel?: boolean` to CompiledTopPhase

### Step 1: Propagate Parallel Flag in Expansion
**Scope**: Update foreach expansion to propagate parallel flag
**Files**:
- `plugins/m42-sprint/compiler/src/expand-foreach.ts`
**Dependencies**: Step 0 (types must exist)
**Risk**: Low - small addition to existing function

Changes:
1. In expandStep() function, add `parallel: phase.parallel` when creating CompiledPhase objects

### Step 2: Initialize Parallel Tasks Array
**Scope**: Update compiler to initialize parallel-tasks and propagate wait-for-parallel
**Files**:
- `plugins/m42-sprint/compiler/src/compile.ts`
- `plugins/m42-sprint/compiler/src/expand-foreach.ts`
**Dependencies**: Steps 0, 1
**Risk**: Low - initialization and propagation

Changes:
1. Add `'parallel-tasks': []` to CompiledProgress initialization
2. Propagate `wait-for-parallel` from WorkflowPhase to CompiledTopPhase

### Step 3: Add Parallel Validation
**Scope**: Update validation to check parallel properties
**Files**:
- `plugins/m42-sprint/compiler/src/validate.ts`
**Dependencies**: Step 0 (types)
**Risk**: Low - validation additions

Changes:
1. Validate `parallel` property is boolean if present
2. Validate `wait-for-parallel` property is boolean if present
3. Add warning if parallel used on for-each phase (unsupported)

### Step 4: Create Parallel Prompt Builder
**Scope**: New script to build prompts for parallel background tasks
**Files**:
- `plugins/m42-sprint/scripts/build-parallel-prompt.sh` (new)
**Dependencies**: None (standalone script)
**Risk**: Medium - new file with specific format requirements

Output format:
```
# Parallel Task Execution
Task ID: $TASK_ID

## Context
Step: [step prompt]

## Your Task: [sub-phase-id]
[sub-phase prompt]

## Instructions
1. Execute independently
2. Runs in background
3. Commit when done
```

### Step 5: Update Sprint Loop for Parallel Management
**Scope**: Add parallel task spawning and waiting to sprint-loop.sh
**Files**:
- `plugins/m42-sprint/scripts/sprint-loop.sh`
**Dependencies**: Steps 0-4 (all types, compilation, prompt builder)
**Risk**: High - core loop modification, background process management

Changes:
1. `is_parallel_subphase()` - Check if current sub-phase has parallel flag
2. `spawn_parallel_task()` - Spawn task in background, register in PROGRESS.yaml
3. `is_wait_for_parallel_phase()` - Check for wait-for-parallel flag
4. `wait_for_parallel_tasks()` - Block until all parallel tasks complete
5. `update_parallel_task_statuses()` - Poll and update status of running tasks
6. Update main loop to use these functions

### Step 6: Update Prompt Builder to Skip Parallel
**Scope**: Skip already-spawned parallel phases in main prompt building
**Files**:
- `plugins/m42-sprint/scripts/build-sprint-prompt.sh`
**Dependencies**: Step 5 (parallel task registration)
**Risk**: Low - conditional skip logic

Changes:
1. Skip sub-phases with status 'spawned'
2. Skip sub-phases with parallel-task-id set

### Step 7: Update Status Display
**Scope**: Show parallel task information in sprint status
**Files**:
- `plugins/m42-sprint/commands/sprint-status.md`
**Dependencies**: Steps 0, 5 (types, task tracking)
**Risk**: Low - display additions

Output format:
```
Parallel Tasks:
[~] step-0-update-docs-1705123456 (running, 2m elapsed)
    Step: Implement user authentication
    Phase: update-docs
    PID: 12345 | Log: logs/step-0-update-docs-1705123456.log
```

### Step 8: Document Workflow Schema
**Scope**: Update workflow schema documentation
**Files**:
- `plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md`
**Dependencies**: All implementation steps
**Risk**: Low - documentation only

Document:
1. `parallel?: boolean` property and use cases
2. `wait-for-parallel?: boolean` property and use cases
3. Usage examples

### Step 9: Integration Test
**Scope**: End-to-end test of parallel execution
**Files**:
- Test workflow with parallel sub-phase
- Test sprint definition
- Manual or automated verification
**Dependencies**: All previous steps
**Risk**: Medium - integration verification

Verify:
1. parallel-tasks array initialized
2. parallel flag propagates correctly
3. wait-for-parallel flag appears on sync phases
4. Parallel tasks spawn as background processes
5. Main loop advances without waiting
6. wait-for-parallel blocks until completion
7. Parallel task logs created
8. Failure handling works

## Step Dependency Graph

```
step-0 (types)
   ↓
step-1 (expand-foreach) ─────────┐
   ↓                             │
step-2 (compile.ts) ─────────────┤
   ↓                             │
step-3 (validate.ts)             │
                                 │
step-4 (build-parallel-prompt)   │
   ↓                             │
step-5 (sprint-loop.sh) ←────────┘
   ↓
step-6 (build-sprint-prompt)
   ↓
step-7 (status display)
   ↓
step-8 (documentation)
   ↓
step-9 (integration test)
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Background process management complexity | High | Use simple PID tracking, explicit log files |
| Race conditions in PROGRESS.yaml updates | Medium | Use file locking or atomic yq operations |
| Parallel task cleanup on sprint abort | Medium | Track PIDs, add cleanup on SIGTERM |
| TypeScript build failures during development | Low | Run typecheck after each step |
| Sprint loop regression | High | Test existing workflow before/after changes |

## Estimated Complexity

| Step | Complexity | Reason |
|------|------------|--------|
| step-0 | Low | Additive type definitions only |
| step-1 | Low | Single property propagation |
| step-2 | Low | Initialization and simple propagation |
| step-3 | Low | Validation additions |
| step-4 | Medium | New script with specific output format |
| step-5 | High | Core loop modification, process management |
| step-6 | Low | Conditional skip logic |
| step-7 | Low | Display formatting only |
| step-8 | Low | Documentation only |
| step-9 | Medium | Integration verification |
