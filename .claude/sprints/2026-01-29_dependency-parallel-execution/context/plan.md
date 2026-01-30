# Dependency-Aware Parallel Sprint Execution Plan

This is the implementation plan for adding dependency-aware parallel execution to the m42-sprint plugin.

See the full plan at: `/home/konstantin/.claude/plans/happy-exploring-mccarthy.md`

## Key Features

1. **Step-level dependencies** via `depends-on: [step-id]` syntax (similar to GitHub Actions `needs`)
2. **DAG-based scheduler** for parallel execution
3. **Dynamic injection support** - planning phase can propose steps with dependencies
4. **Failure policies**: skip-dependents (default), continue, fail-fast
5. **Backward compatible** - existing sprints work unchanged

## Implementation Phases

The sprint is organized into 6 dependent phases:

```
phase-1-types ──┬──→ phase-2-compiler ──┐
                │                        ├──→ phase-5-loop ──→ phase-6-dashboard
                └──→ phase-3-scheduler ──┤
                           │             │
                           └──→ phase-4-injection ──┘
```

Each phase builds on previous work, demonstrating the dependency system we're implementing.

## Critical Files

| File | Purpose |
|------|---------|
| `compiler/src/types.ts` | Add CollectionItem.depends-on, DependencyNode, ParallelExecutionConfig |
| `compiler/src/validate.ts` | Cycle detection, reference validation |
| `compiler/src/expand-foreach.ts` | Preserve depends-on, build graph |
| `runtime/src/scheduler.ts` | NEW: DAG scheduler |
| `runtime/src/loop.ts` | Parallel execution mode |
| `runtime/src/transition.ts` | PROPOSE_STEPS with depends-on |
| `runtime/src/progress-injector.ts` | Dynamic injection with deps |

## Example Usage

```yaml
# SPRINT.yaml with dependencies
collections:
  step:
    - id: shared-types
      prompt: Create shared TypeScript interfaces

    - id: frontend
      depends-on: [shared-types]
      prompt: Implement frontend component

    - id: backend
      depends-on: [shared-types]
      prompt: Implement backend API

    - id: integration-test
      depends-on: [frontend, backend]
      prompt: Integration tests
```

Execution: `shared-types` → `frontend` + `backend` (parallel) → `integration-test`
