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
| Exits when phases exhausted | Exits on `goal-complete` JSON result |

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
              │   goal-complete?       │
              │                        │
              │  Yes → Exit            │
              │  No  → Next Iteration  │
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
      └────────▶│  goal-complete  │◀──────────┘
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

### Full Example with All Options

```yaml
workflow: ralph
goal: |
  Build a complete authentication system with JWT tokens.
  Include registration, login, token refresh, and logout.

  Success criteria:
  - All endpoints tested and documented
  - TypeScript compiles without errors
  - All tests passing

# Ralph mode configuration
ralph:
  idle-threshold: 3      # Iterations without progress → reflection mode
  min-iterations: 15     # Minimum iterations before goal-complete accepted

# Per-iteration hooks run in background after each iteration
per-iteration-hooks:
  - id: learning
    prompt: |
      /m42-signs:extract $ITERATION_TRANSCRIPT
    parallel: true
    enabled: true

# Sprint metadata
sprint-id: 2026-01-18_auth-feature
name: auth-feature
created: 2026-01-18T10:30:00Z
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `ralph.idle-threshold` | 3 | Iterations without new steps before entering reflection mode |
| `ralph.min-iterations` | 0 | Minimum iterations required before `goal-complete` is accepted. Use to ensure deep thinking. |

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

### Template Variables

Hook prompts support template variable substitution:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `$ITERATION_TRANSCRIPT` | Path to current iteration's transcript log file | `/sprints/test/transcriptions/phase-0.log` |
| `$SPRINT_ID` | Sprint identifier | `2026-01-18_auth-feature` |
| `$ITERATION` | Current iteration number (1-based) | `5` |
| `$PHASE_ID` | Current phase identifier | `development` |

Example prompt using template variables:
```yaml
- id: learning
  prompt: |
    /m42-signs:extract $ITERATION_TRANSCRIPT --auto-apply-high --sprint $SPRINT_ID --phase $PHASE_ID
  parallel: true
  enabled: true
```

### Runtime Hook Execution

The TypeScript runtime (`loop.ts`) executes per-iteration hooks after each successful phase completion:

1. **After Phase Completion**: Hooks execute after the phase prompt completes but before advancing to the next phase
2. **Sequential Hooks** (`parallel: false`): Execute in order, blocking the next iteration until complete
3. **Parallel Hooks** (`parallel: true`): Spawn in background without blocking the next iteration
4. **Hook Tracking**: Each hook execution is tracked in `hook-tasks[]` with status, timestamps, and exit code
5. **Failure Handling**: Hook failures are logged but don't crash the sprint - the main workflow continues

**Hook Task Lifecycle:**
```text
spawned (running) → completed | failed
```

**Execution Order Per Iteration:**
```text
1. Execute phase prompt
2. Run sequential hooks (blocking)
3. Spawn parallel hooks (non-blocking)
4. Write progress (includes hook task entries)
5. Advance to next phase
```

---

## Exit Mechanism: JSON Result Reporting

Claude signals its state by outputting a JSON result in its response. This provides structured communication between Claude and the sprint loop.

### JSON Result Format

Claude outputs a JSON code block in its final message:

```json
{
  "status": "continue" | "goal-complete" | "needs-human",
  "summary": "What was done this iteration",
  "completedStepIds": ["step-0", "step-1"],
  "pendingSteps": [
    {"id": "step-2", "prompt": "Existing step"},
    {"id": null, "prompt": "New step to add"}
  ],
  "goalCompleteSummary": "Final summary when goal achieved",
  "humanNeeded": {"reason": "Why human is needed", "details": "Context"}
}
```

### Result Statuses

| Status | When to Use | Required Fields |
|--------|-------------|-----------------|
| `continue` | More work to do | `summary`, optionally `completedStepIds`, `pendingSteps` |
| `goal-complete` | Goal achieved | `summary`, `goalCompleteSummary`, optionally `completedStepIds` |
| `needs-human` | Blocked, need help | `summary`, `humanNeeded.reason`, `humanNeeded.details` |

### Exit Detection

The sprint loop parses this JSON and:
1. Updates step statuses based on `completedStepIds`
2. Adds new steps from `pendingSteps` (where `id: null`)
3. For `goal-complete`: records completion summary, exits loop
4. For `needs-human`: sets sprint status, exits for intervention
5. For `continue`: proceeds to next iteration

### Example Claude Output

**Continue working:**
```json
{
  "status": "continue",
  "summary": "Implemented login endpoint with JWT generation",
  "completedStepIds": ["step-0"],
  "pendingSteps": [
    {"id": "step-1", "prompt": "Add logout endpoint"},
    {"id": null, "prompt": "Add token refresh mechanism"}
  ]
}
```

**Goal complete:**
```json
{
  "status": "goal-complete",
  "summary": "Completed final verification and documentation",
  "completedStepIds": ["step-4"],
  "goalCompleteSummary": "Implemented JWT authentication with registration, login, token refresh, and logout endpoints. All 12 tests passing."
}
```

**Need human help:**
```json
{
  "status": "needs-human",
  "summary": "Attempted database migration but encountered blocking issue",
  "humanNeeded": {
    "reason": "Database credentials not configured",
    "details": "The .env file is missing DATABASE_URL. Please add credentials and resume."
  }
}
```

---

## PROGRESS.yaml Structure (Ralph Mode)

```yaml
sprint-id: 2026-01-18_auth-feature
status: in-progress
mode: ralph

goal: |
  Build authentication system with JWT tokens.
  Include registration, login, token refresh, and logout.

ralph:
  idle-threshold: 3           # Iterations without progress → reflection
  min-iterations: 10          # Minimum iterations before goal-complete allowed

per-iteration-hooks:
  - id: learning
    prompt: |
      /m42-signs:extract $ITERATION_TRANSCRIPT
    parallel: true
    enabled: true

dynamic-steps:
  - id: step-0
    prompt: "Initialize auth module structure"
    status: completed
    added-at: "2026-01-18T10:00:00Z"
    added-in-iteration: 1
    completed-at: "2026-01-18T10:05:00Z"
  - id: step-1
    prompt: "Implement JWT token generation"
    status: pending
    added-at: "2026-01-18T10:05:00Z"
    added-in-iteration: 1

hook-tasks:
  - iteration: 1
    hook-id: learning
    status: completed
    spawned-at: "2026-01-18T10:00:00Z"
    completed-at: "2026-01-18T10:01:00Z"
    exit-code: 0

ralph-exit:
  detected-at: null
  iteration: null
  final-summary: null

stats:
  started-at: "2026-01-18T10:00:00Z"
  current-iteration: 2
  max-iterations: 1000000
```

### Key Fields

| Field | Description |
|-------|-------------|
| `mode: ralph` | Activates Ralph mode execution |
| `goal` | The high-level objective Claude works toward |
| `ralph.idle-threshold` | Iterations without progress before reflection mode |
| `ralph.min-iterations` | Minimum iterations required before `goal-complete` is accepted |
| `dynamic-steps` | Steps created by Claude during execution |
| `hook-tasks` | Background hook execution records |
| `ralph-exit` | Populated when goal is complete |

---

## Sprint Loop Detection

The TypeScript runtime automatically detects Ralph Mode and switches execution:

```typescript
// The TypeScript runtime reads mode from PROGRESS.yaml
const progress = await readProgress(progressFile);
const mode = progress.mode ?? 'standard';

if (mode === 'ralph') {
  await runRalphLoop(sprintDir, options);  // Autonomous goal-driven execution
} else {
  await runStandardLoop(sprintDir, options);  // Phase-based execution
}
```

---

## Comparison: Standard vs Ralph Mode

| Aspect | Standard Mode | Ralph Mode |
|--------|---------------|------------|
| **Step definition** | SPRINT.yaml | Claude creates dynamically |
| **Iteration count** | Fixed (phase count) | Unlimited until complete |
| **Exit condition** | All phases done | `goal-complete` JSON status |
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
| Steps keep growing | Goal scope creep | Constrain goal or use `goal-complete` status |
| Goal-complete ignored | `min-iterations` not reached | Wait for threshold or adjust `ralph.min-iterations` |
| No JSON result parsed | Claude output malformed | Ensure JSON is in ```json code block |

---

## Related Concepts

- [The Ralph Loop](ralph-loop.md) - Execution pattern powering both modes
- [Workflow Compilation](workflow-compilation.md) - How workflows compile to PROGRESS.yaml
- [Progress Schema](../../skills/orchestrating-sprints/references/progress-schema.md) - Full PROGRESS.yaml specification

---

[← Back to Concepts](overview.md) | [← Back to Documentation Index](../index.md)
