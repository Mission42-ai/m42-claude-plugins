# Sprint Plan: 2026-01-18_parallel-execution

## Goal

Add parallel execution support to the m42-sprint plugin, enabling non-blocking background tasks at the step workflow level. This allows "learning loop" patterns where documentation updates or similar tasks can run in background while the main workflow proceeds to the next step, with optional synchronization points before critical phases like QA or deployment.

## Success Criteria

- [ ] `parallel?: boolean` property added to WorkflowPhase and CompiledPhase types
- [ ] `wait-for-parallel?: boolean` property added to WorkflowPhase and CompiledTopPhase
- [ ] `ParallelTask` interface defined with full status tracking
- [ ] Compiler propagates parallel flags through for-each expansion
- [ ] `parallel-tasks: []` array initialized in compiled PROGRESS.yaml
- [ ] Sprint loop spawns parallel tasks as background processes
- [ ] Sprint loop waits at `wait-for-parallel` sync points
- [ ] Sprint status command displays parallel task progress
- [ ] Workflow schema documentation updated
- [ ] Integration test validates end-to-end parallel execution

## Step Breakdown

### Step 0 (step-1 in SPRINT.yaml): Type System Extensions
**Scope**: Add new TypeScript interfaces and properties for parallel execution tracking
**Files**:
- `compiler/src/types.ts` - Add `parallel`, `wait-for-parallel`, `ParallelTask` interface
**Dependencies**: None (foundational)
**Risk**: Low - pure type additions, no runtime impact

### Step 1 (step-2): Update Compiler - Expand ForEach
**Scope**: Propagate `parallel` flag when expanding step workflows into CompiledPhase objects
**Files**:
- `compiler/src/expand-foreach.ts` - Modify `expandStep()` function
**Dependencies**: Step 0 (types must exist)
**Risk**: Low - single property addition to existing object creation

### Step 2 (step-3): Update Compiler - Main Compile
**Scope**: Initialize parallel-tasks array and propagate wait-for-parallel flag
**Files**:
- `compiler/src/compile.ts` - Modify compile() function
**Dependencies**: Step 0 (types must exist)
**Risk**: Low - initializing empty array, simple property propagation

### Step 3 (step-4): Add Validation Rules
**Scope**: Validate new properties and add warnings for unsupported usage patterns
**Files**:
- `compiler/src/validate.ts` - Modify `validateWorkflowPhase()` function
**Dependencies**: Step 0 (types must exist)
**Risk**: Low - adding validation rules doesn't break existing workflows

### Step 4 (step-5): Create Build Parallel Prompt Script
**Scope**: New script to generate prompts for background parallel tasks
**Files**:
- `scripts/build-parallel-prompt.sh` - **NEW FILE**
**Dependencies**: None (standalone script)
**Risk**: Low - new file, no modifications to existing code

### Step 5 (step-6): Update Sprint Loop - Core Logic
**Scope**: Add parallel task management functions and modify main loop
**Files**:
- `scripts/sprint-loop.sh` - Add helper functions and modify main loop
**Dependencies**: Step 4 (needs build-parallel-prompt.sh)
**Risk**: Medium - core execution logic, must preserve existing sequential behavior

### Step 6 (step-7): Update Build Sprint Prompt Script
**Scope**: Skip parallel sub-phases that are already spawned in background
**Files**:
- `scripts/build-sprint-prompt.sh` - Add status check for spawned phases
**Dependencies**: Step 0 (type definitions for status values)
**Risk**: Low - adding conditional skip logic

### Step 7 (step-8): Update Sprint Status Command
**Scope**: Display parallel task status in dashboard
**Files**:
- `commands/sprint-status.md` - Add parallel tasks section
**Dependencies**: Step 0 (parallel task structure)
**Risk**: Low - display-only changes

### Step 8 (step-9): Update Workflow Schema Documentation
**Scope**: Document new `parallel` and `wait-for-parallel` properties
**Files**:
- `skills/creating-workflows/references/workflow-schema.md`
**Dependencies**: All implementation steps complete
**Risk**: Low - documentation only

### Step 9 (step-10): Integration Testing
**Scope**: Create and execute test workflows to verify parallel execution
**Files**:
- Test workflow files (may be temporary)
- Test sprint definition
**Dependencies**: All previous steps complete
**Risk**: Medium - integration testing may reveal issues requiring backtracking

## Step Dependency Graph

```
step-0 (Types) ────┬────────────────────────────────────────────────┐
                   │                                                 │
                   ├──→ step-1 (Expand ForEach)                     │
                   │                                                 │
                   ├──→ step-2 (Compile) ──→ step-5 (Sprint Loop) ──┼──→ step-9 (Integration Test)
                   │                              ↑                  │
                   ├──→ step-3 (Validation)       │                  │
                   │                              │                  │
step-4 (Build Parallel Prompt) ───────────────────┘                  │
                                                                     │
step-6 (Build Sprint Prompt) ────────────────────────────────────────┤
                                                                     │
step-7 (Sprint Status) ──────────────────────────────────────────────┤
                                                                     │
step-8 (Docs) ←──────────────────────────────────────────────────────┘
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sprint loop modifications break sequential execution | High | Test with non-parallel workflows after changes |
| Background processes orphaned on sprint stop | Medium | Add cleanup logic in trap handler |
| yq syntax errors in parallel task tracking | Medium | Test yq commands independently before integration |
| Race conditions in PROGRESS.yaml updates | Medium | Use atomic file operations, consider file locking |
| Parallel tasks interfere with each other | Low | Tasks should be independent (docs vs implementation) |

## Estimated Complexity

| Step | Complexity | Reason |
|------|------------|--------|
| step-0 | Low | Pure type additions |
| step-1 | Low | Single property propagation |
| step-2 | Low | Array initialization, property copy |
| step-3 | Low | Validation rule additions |
| step-4 | Low | New standalone script |
| step-5 | Medium | Core loop logic, background process management |
| step-6 | Low | Conditional skip logic |
| step-7 | Low | Display formatting |
| step-8 | Low | Documentation update |
| step-9 | Medium | End-to-end testing, may reveal issues |

## Notes

- The implementation plan in `context/implementation-plan.md` contains detailed code snippets and line references
- Backward compatibility is maintained - all new properties are optional
- Existing workflows without `parallel` flags will continue to work sequentially
- No limit on concurrent parallel tasks is enforced (user responsibility)
