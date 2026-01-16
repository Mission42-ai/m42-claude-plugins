# The Ralph Loop Pattern

The **Ralph Loop** is the core execution pattern that enables reliable, long-running sprints with consistent performance from start to finish.

---

## The Problem: Context Accumulation

When working with AI assistants on long tasks, a common failure mode emerges:

```
                    Traditional Long-Running Session
                    ─────────────────────────────────

Session Start    Task 1       Task 5        Task 10       Task 20+
     │             │            │             │             │
     ▼             ▼            ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐
│ Fresh   │  │ Task 1  │  │ Task 1  │  │ Task 1  │  │ Task 1...20 │
│ Context │  │ Output  │  │ + 2-4   │  │ + 2-9   │  │ Full!       │
│         │  │         │  │ Output  │  │ Output  │  │             │
└─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────────┘
   Fast         Fast        Slower      Slow          Timeout Risk

                    Context Window Fills Up Over Time
                              ▲
                              │
                    Each task adds its output
                    to the accumulated context
```

### Symptoms of Context Accumulation

| Symptom | Cause |
|---------|-------|
| **Slower responses** | More tokens to process each turn |
| **Higher costs** | Paying for accumulated context repeatedly |
| **Quality degradation** | Relevant info buried in noise |
| **Timeout failures** | Context exceeds window limits |
| **Lost focus** | Early context competes with task at hand |

This happens because each turn in a conversation carries forward all previous context. By task 20, you're processing the output of tasks 1-19 just to work on task 20.

---

## The Solution: Fresh Context Per Phase

The Ralph Loop solves this by giving each phase a **completely fresh context**:

```
                        Ralph Loop Execution
                        ────────────────────

     ┌────────────────────────────────────────────────────────────┐
     │                    PROGRESS.yaml                           │
     │   (State Machine - survives across invocations)            │
     │                                                            │
     │   current:                                                 │
     │     phase: 1                                               │
     │     step: 2        ◄── Pointer to current position        │
     │     sub-phase: 0                                           │
     └──────────────────────────┬─────────────────────────────────┘
                                │
                                │ Read pointer
                                ▼
     ┌────────────────────────────────────────────────────────────┐
     │                   sprint-loop.sh                           │
     │                                                            │
     │   while status == "in-progress":                           │
     │       prompt = build_prompt(PROGRESS.yaml)                 │
     │       ┌───────────────────────────────────────────────┐    │
     │       │    claude -p "$prompt"                        │    │
     │       │         ▲                                     │    │
     │       │         │                                     │    │
     │       │    FRESH CONTEXT                              │    │
     │       │    (no accumulated history)                   │    │
     │       └───────────────────────────────────────────────┘    │
     │       # Claude executes, updates PROGRESS.yaml             │
     │       # Loop reads updated pointer, continues              │
     │   done                                                     │
     └────────────────────────────────────────────────────────────┘


Phase 1:  [Fresh] → Execute → Update pointer → Exit
Phase 2:  [Fresh] → Execute → Update pointer → Exit
Phase 3:  [Fresh] → Execute → Update pointer → Exit
  ...
Phase N:  [Fresh] → Execute → Mark completed → Exit

Every phase gets the same clean start. No accumulation.
```

### What Gets Passed to Each Phase

Each `claude -p` invocation receives only:

1. **Context files** (explicit, controlled) - shared sprint context
2. **Current phase prompt** (from PROGRESS.yaml)
3. **Position information** (where we are in the hierarchy)
4. **Instructions** (what to do and how to update progress)

**Not passed:** Output from previous phases. Each phase works independently.

---

## Sequence Diagram: One Loop Iteration

```
┌──────────────┐    ┌────────────────┐    ┌─────────────────┐    ┌────────────┐
│ sprint-loop  │    │ build-prompt   │    │   claude -p     │    │ PROGRESS   │
│    .sh       │    │    .sh         │    │  (Claude CLI)   │    │   .yaml    │
└──────┬───────┘    └───────┬────────┘    └────────┬────────┘    └─────┬──────┘
       │                    │                      │                   │
       │  Read current      │                      │                   │
       │  position          │                      │                   │
       │────────────────────┼──────────────────────┼─────────────────►│
       │                    │                      │                   │
       │◄───────────────────┼──────────────────────┼───────────────────│
       │  {phase:1, step:0, │                      │                   │
       │   sub-phase:1}     │                      │                   │
       │                    │                      │                   │
       │  Build prompt for  │                      │                   │
       │  current position  │                      │                   │
       │──────────────────►│                      │                   │
       │                    │                      │                   │
       │                    │  Read phase details  │                   │
       │                    │──────────────────────┼─────────────────►│
       │                    │                      │                   │
       │                    │◄─────────────────────┼───────────────────│
       │                    │  {id: "implement",   │                   │
       │                    │   prompt: "..."}     │                   │
       │                    │                      │                   │
       │◄──────────────────│                      │                   │
       │  Complete prompt   │                      │                   │
       │  with context      │                      │                   │
       │                    │                      │                   │
       │  Execute with      │                      │                   │
       │  fresh context     │                      │                   │
       │───────────────────┼─────────────────────►│                   │
       │                    │                      │                   │
       │                    │                      │  Update status    │
       │                    │                      │  + advance pointer│
       │                    │                      │─────────────────►│
       │                    │                      │                   │
       │                    │                      │◄──────────────────│
       │                    │                      │                   │
       │◄──────────────────┼──────────────────────│                   │
       │  Exit (success)    │                      │                   │
       │                    │                      │                   │
       │  Check status      │                      │                   │
       │────────────────────┼──────────────────────┼─────────────────►│
       │                    │                      │                   │
       │◄───────────────────┼──────────────────────┼───────────────────│
       │  "in-progress"     │                      │                   │
       │                    │                      │                   │
       │  [Loop continues   │                      │                   │
       │   with next phase] │                      │                   │
       ▼                    ▼                      ▼                   ▼
```

---

## Key Benefits

| Benefit | How the Ralph Loop Achieves It |
|---------|-------------------------------|
| **Consistent performance** | Every phase starts fresh, same speed at phase 100 as phase 1 |
| **Predictable costs** | Each phase uses similar token count (no accumulation tax) |
| **Reliable execution** | No context window overflow, even for 50+ phase sprints |
| **Clean failure handling** | If a phase fails, retry with the same clean context |
| **Resumable** | Current pointer persists - resume exactly where you left off |
| **Observable** | Each phase logs independently, easy to diagnose issues |
| **Parallel-ready** | Architecture supports future parallel phase execution |

### Cost Comparison

```
Traditional Approach (accumulated context):
──────────────────────────────────────────
Phase 1:  1,000 tokens input  ───►  $0.003
Phase 2:  2,500 tokens input  ───►  $0.008
Phase 3:  4,500 tokens input  ───►  $0.014
Phase 4:  7,000 tokens input  ───►  $0.021
Phase 5: 10,000 tokens input  ───►  $0.030
                              Total: $0.076 (and growing exponentially)


Ralph Loop (fresh context):
───────────────────────────
Phase 1:  1,500 tokens input  ───►  $0.005
Phase 2:  1,500 tokens input  ───►  $0.005
Phase 3:  1,500 tokens input  ───►  $0.005
Phase 4:  1,500 tokens input  ───►  $0.005
Phase 5:  1,500 tokens input  ───►  $0.005
                              Total: $0.025 (linear, predictable)
```

---

## Implementation Details

The Ralph Loop is implemented in `scripts/sprint-loop.sh`. Here are the key components:

### 1. The Main Loop

```bash
# Main loop - iterate until done or max iterations
for ((i=1; i<=MAX_ITERATIONS; i++)); do
    echo "=== Iteration $i/$MAX_ITERATIONS ==="

    # Build prompt for current position
    PROMPT=$("$SCRIPT_DIR/build-sprint-prompt.sh" "$SPRINT_DIR" "$i")

    if [[ -z "$PROMPT" ]]; then
        echo "No more work to do. Sprint complete."
        yq -i '.status = "completed"' "$PROGRESS_FILE"
        exit 0
    fi

    # Execute with FRESH context - this is the key!
    claude -p "$PROMPT" --dangerously-skip-permissions 2>&1 | tee "$LOG_FILE"

    # Check status and loop
    STATUS=$(yq -r '.status' "$PROGRESS_FILE")
    # ... handle status
done
```

The critical line is `claude -p "$PROMPT"`. The `-p` flag means "prompt mode" - Claude receives only the prompt, not conversation history. Each invocation is independent.

### 2. Prompt Construction

The `build-sprint-prompt.sh` script reads the current pointer from PROGRESS.yaml and constructs a self-contained prompt:

```bash
# Read current pointer
PHASE_IDX=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
STEP_IDX=$(yq -r '.current.step // "null"' "$PROGRESS_FILE")
SUB_PHASE_IDX=$(yq -r '.current."sub-phase" // "null"' "$PROGRESS_FILE")

# Get phase details and build prompt
PHASE_ID=$(yq -r ".phases[$PHASE_IDX].id" "$PROGRESS_FILE")
SUB_PHASE_PROMPT=$(yq -r ".phases[$PHASE_IDX].steps[$STEP_IDX].phases[$SUB_PHASE_IDX].prompt" "$PROGRESS_FILE")

# Generate complete, self-contained prompt
cat <<EOF
# Sprint Workflow Execution
Sprint: $SPRINT_ID | Iteration: $ITERATION

## Current Position
- Phase: **$PHASE_ID** ($((PHASE_IDX + 1))/$TOTAL_PHASES)
- Step: **$STEP_ID** ($((STEP_IDX + 1))/$TOTAL_STEPS)
- Sub-Phase: **$SUB_PHASE_ID** ($((SUB_PHASE_IDX + 1))/$TOTAL_SUB_PHASES)

## Your Task: $SUB_PHASE_ID

$SUB_PHASE_PROMPT

## Instructions

1. Execute this sub-phase task
2. When complete, update PROGRESS.yaml
3. Commit your changes
4. **EXIT immediately** - do NOT continue to next task
EOF
```

Each prompt contains everything Claude needs to execute that one phase - no external context required.

### 3. Pointer Advancement

After completing a phase, Claude updates the pointer in PROGRESS.yaml:

```bash
# Mark current sub-phase as completed
yq -i '.phases[1].steps[0].phases[0].status = "completed"' PROGRESS.yaml
yq -i '.phases[1].steps[0].phases[0]."completed-at" = "2026-01-16T10:30:00Z"' PROGRESS.yaml

# Advance the pointer to next sub-phase
yq -i '.current."sub-phase" = 1' PROGRESS.yaml
```

The next loop iteration reads this updated pointer and builds a prompt for the next phase.

### 4. Error Handling and Retries

```bash
# Classify errors for appropriate handling
classify_error() {
    local exit_code="$1"
    local error_output="$2"

    # Network errors, rate limits, timeouts → retry with backoff
    # Validation errors → skip phase
    # Logic errors → needs human intervention
}

# Handle failure with exponential backoff
handle_phase_failure() {
    if is_retryable "$ERROR_TYPE"; then
        if [[ "$retry_count" -lt "$MAX_RETRIES" ]]; then
            backoff_delay=$(get_backoff_delay "$new_retry_count")
            apply_backoff "$backoff_delay"
            return 0  # Continue loop for retry
        fi
    fi
    # Block if non-retryable or retries exhausted
    yq -i "$phase_path.status = \"blocked\"" "$PROGRESS_FILE"
    return 1
}
```

---

## Why "Ralph Loop"?

The pattern is named after the observation that a "dumb bash loop" invoking Claude repeatedly with fresh context is more reliable than a "smart" long-running session.

Like Ralph Wiggum saying "I'm helping!", the bash loop's simplicity is its strength:

- It doesn't try to be clever
- It just runs one thing, checks the result, runs the next thing
- State lives in YAML, not in memory
- Each invocation is identical in structure

The name is memorable, and the pattern is effective.

---

## Comparison: Ralph Loop vs. Alternatives

| Aspect | Long-Running Session | Agent Framework | Ralph Loop |
|--------|---------------------|-----------------|------------|
| **Context handling** | Accumulates | Summarizes | Fresh each phase |
| **Failure recovery** | Manual | Varies | Automatic retry |
| **Resume capability** | Limited | Checkpoint-based | Pointer-based |
| **Observability** | Single log | Framework logs | Per-phase logs |
| **Complexity** | Simple | High | Simple |
| **Reliability** | Degrades | Good | Excellent |
| **Cost scaling** | Exponential | Linear | Linear |

---

## When to Use the Ralph Loop

**Good fit:**
- Multi-step work that can be broken into independent phases
- Tasks that benefit from clear progress tracking
- Work that might need to be interrupted and resumed
- Scenarios where consistent performance matters

**Consider alternatives when:**
- Phases have tight coupling and need shared context
- The entire task fits easily in one context window
- Real-time interaction is required (not batch processing)

---

## Related Concepts

- [Architecture Overview](overview.md) - How the Ralph Loop fits in the three-tier model
- [Workflow Compilation](workflow-compilation.md) - How SPRINT.yaml becomes the phases the Ralph Loop executes
- [PROGRESS.yaml Schema](../reference/progress-yaml-schema.md) - The state machine that drives the loop

---

[← Back to Concepts](overview.md) | [← Back to Documentation Index](../index.md)
