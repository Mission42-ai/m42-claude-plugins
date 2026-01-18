# Ralph Mode: Autonomous Goal-Driven Workflows

**Ralph Mode** is a hybrid workflow system that combines autonomous Claude loops with deterministic per-iteration hooks. Unlike standard phase-based workflows where Claude follows predefined steps, Ralph Mode allows Claude to analyze a goal, dynamically create steps, execute them, and decide when the goal is complete.

---

## Overview: What is Ralph Mode?

Ralph Mode transforms the sprint system from a **deterministic phase executor** into an **autonomous goal solver**:

| Standard Mode | Ralph Mode |
|---------------|------------|
| Predefined phases execute sequentially | Claude analyzes goal and creates steps dynamically |
| Fixed step count | Unlimited iterations until goal complete |
| Workflow defines the path | Workflow defines prompts, Claude decides path |
| Exits when phases exhausted | Exits on `RALPH_COMPLETE` signal |

Ralph Mode is ideal for:
- Open-ended implementation tasks
- Goals where the exact steps aren't known upfront
- Tasks that benefit from reflection and course correction
- Integration with per-iteration hooks (learning extraction, documentation)

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                      RALPH LOOP                               │
│                    (Endlosschleife)                           │
└──────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  FREI (Claude)  │ │ DETERMINISTISCH │ │ DETERMINISTISCH │
│                 │ │   (Hook 1)      │ │   (Hook 2)      │
│ - Analysiert    │ │                 │ │                 │
│ - Plant Steps   │ │ - Learning      │ │ - Documentation │
│ - Führt aus     │ │ - parallel: ✓   │ │ - parallel: ✓   │
│ - Reflektiert   │ │                 │ │                 │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         │              (non-blocking)      (non-blocking)
         │                   │                   │
         ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    PROGRESS.yaml                              │
│  - dynamic-steps[] (von Claude)                               │
│  - hook-tasks[] (deterministisch)                             │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │    RALPH_COMPLETE?     │
              │                        │
              │  Ja → Exit             │
              │  Nein → Nächste Iter.  │
              └────────────────────────┘
```

### The Hybrid Concept

Ralph Mode combines two execution paradigms:

**1. Free Loop (Claude Autonomous)**
- Claude analyzes the goal
- Creates implementation steps dynamically
- Executes steps one at a time
- Reflects when stuck
- Decides when goal is achieved

**2. Deterministic Hooks (Per-Iteration)**
- Configured hooks run every iteration
- Parallel execution (non-blocking)
- Examples: learning extraction, documentation updates
- Consistent, predictable behavior

---

## Execution Modes

Each iteration enters one of three modes based on state:

| Mode | Trigger | Action |
|------|---------|--------|
| **planning** | No pending steps OR first iteration | Analyze goal, create initial steps |
| **executing** | Pending steps exist | Execute next pending step |
| **reflecting** | No pending steps for N iterations | Evaluate: complete goal or add more steps |

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Planning   │────▶│  Executing  │────▶│  Reflecting │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      │                   ▼                    │
      │         ┌─────────────────┐           │
      └────────▶│ RALPH_COMPLETE  │◀──────────┘
                └─────────────────┘
```

---

## SPRINT.yaml Configuration

### Minimal Example

```yaml
workflow: ralph
goal: |
  Build a complete authentication system with JWT tokens.
```

### Full Example with Hook Overrides

```yaml
workflow: ralph
goal: |
  Build a complete authentication system with JWT tokens.
  Include registration, login, token refresh, and logout.

# Override per-iteration hooks from workflow defaults
per-iteration-hooks:
  learning:
    enabled: true      # Enable learning extraction
  documentation:
    enabled: true      # Enable documentation updates
```

---

## Per-Iteration Hooks

Hooks are deterministic tasks that run every iteration in parallel with Claude's main execution.

### Hook Definition (in workflow)

```yaml
# .claude/workflows/ralph.yaml
per-iteration-hooks:
  - id: learning
    workflow: "m42-signs:learning-extraction"
    parallel: true
    enabled: false                           # Default off

  - id: documentation
    prompt: |
      Review changes from this iteration and update relevant docs.
    parallel: true
    enabled: false

  - id: tests
    prompt: |
      Analyze code changes and suggest test cases.
    parallel: true
    enabled: false
```

### Hook Reference Types

| Type | Syntax | Description |
|------|--------|-------------|
| External Plugin | `workflow: "m42-signs:learning-extraction"` | Invokes external plugin command |
| Local Workflow | `workflow: "doc-update"` | References `.claude/workflows/doc-update.yaml` |
| Inline Prompt | `prompt: "..."` | Direct prompt instructions |

### Enabling Hooks in SPRINT.yaml

```yaml
# Enable specific hooks for this sprint
per-iteration-hooks:
  learning:
    enabled: true
  documentation:
    enabled: true
```

---

## Exit Mechanism: RALPH_COMPLETE

Claude signals goal completion by outputting:

```
RALPH_COMPLETE: [summary of what was accomplished]
```

### Exit Detection

The sprint loop detects this pattern and:
1. Records the completion summary
2. Waits for all parallel hooks to complete
3. Updates PROGRESS.yaml with final status
4. Exits the loop

### Example Claude Output

```text
All authentication endpoints have been implemented and tested.

RALPH_COMPLETE: Implemented JWT authentication with registration, login,
token refresh, and logout endpoints. All 12 tests passing.
```

---

## PROGRESS.yaml Structure (Ralph Mode)

```yaml
mode: ralph
goal: |
  Build authentication system with JWT tokens

ralph:
  idle-threshold: 3           # Iterations without progress → reflection

per-iteration-hooks:
  - id: learning
    workflow: "m42-signs:learning-extraction"
    parallel: true
    enabled: true
  - id: documentation
    workflow: "doc-update"
    parallel: true
    enabled: false

dynamic-steps:
  - id: step-0
    prompt: "Initialize auth module structure"
    status: completed
    added-at: "2026-01-18T10:00:00Z"
    added-in-iteration: 1
  - id: step-1
    prompt: "Implement JWT token generation"
    status: in-progress
    added-at: "2026-01-18T10:05:00Z"
    added-in-iteration: 1

hook-tasks:
  - iteration: 1
    hook-id: learning
    status: completed
    pid: null
    transcript: transcripts/iter-1-learning.jsonl

ralph-exit:
  detected-at: null
  iteration: null
  final-summary: null
```

---

## Sprint Loop Detection

The sprint loop automatically detects Ralph Mode and switches execution:

```bash
MODE=$(yq -r '.mode // "standard"' "$PROGRESS_FILE")

if [[ "$MODE" == "ralph" ]]; then
  run_ralph_loop    # Autonomous goal-driven execution
else
  run_standard_loop # Phase-based execution
fi
```

---

## Comparison: Standard vs Ralph Mode

| Aspect | Standard Mode | Ralph Mode |
|--------|---------------|------------|
| **Step definition** | SPRINT.yaml | Claude creates dynamically |
| **Iteration count** | Fixed (phase count) | Unlimited until complete |
| **Exit condition** | All phases done | `RALPH_COMPLETE` detected |
| **Hooks** | None | Per-iteration, parallel |
| **Reflection** | Not applicable | After idle threshold |
| **Best for** | Known task sequences | Open-ended goals |

---

## Use Cases

### Good Fit for Ralph Mode

- **Feature implementation**: "Build X with Y functionality"
- **Research tasks**: "Investigate and document X"
- **Refactoring**: "Improve X codebase area"
- **Bug investigation**: "Find and fix the issue with X"

### Better with Standard Mode

- **Sequential deployments**: Known phase order
- **Compliance workflows**: Fixed audit steps
- **Release processes**: Predictable checklist

---

## Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| Loop never exits | Goal too vague | Make goal more specific and measurable |
| Hook not running | Hook disabled | Enable in SPRINT.yaml `per-iteration-hooks` |
| Stuck in reflection | No clear completion criteria | Add success criteria to goal |
| Steps keep growing | Goal scope creep | Constrain goal or use `RALPH_COMPLETE` |

---

## Related Concepts

- [The Ralph Loop](ralph-loop.md) - Execution pattern powering both modes
- [Workflow Compilation](workflow-compilation.md) - How workflows compile to PROGRESS.yaml
- [Progress Schema](../../skills/orchestrating-sprints/references/progress-schema.md) - Full PROGRESS.yaml specification

---

[← Back to Concepts](overview.md) | [← Back to Documentation Index](../index.md)
