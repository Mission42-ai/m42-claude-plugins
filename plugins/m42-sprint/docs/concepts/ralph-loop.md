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
     │               TypeScript Sprint Runtime                     │
     │                                                            │
     │   while status == "in-progress":                           │
     │       prompt = buildPrompt(PROGRESS.yaml)                  │
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
│   sprint     │    │ prompt-builder │    │   claude -p     │    │ PROGRESS   │
│   runtime    │    │    (TS)        │    │  (Claude CLI)   │    │   .yaml    │
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

The Ralph Loop is implemented as a TypeScript runtime in `runtime/`. Here are the key components:

### 1. The Main Loop

```typescript
// Main loop - iterate until done (unlimited by default)
async function runLoop(options: LoopOptions): Promise<LoopResult> {
  while (true) {
    const progress = await readProgress(options.sprintDir);

    if (progress.status !== 'in-progress') {
      return { status: progress.status, iterations: iteration };
    }

    // Build prompt for current position
    const prompt = buildPrompt(progress, iteration);

    if (!prompt) {
      await writeProgress({ ...progress, status: 'completed' });
      return { status: 'completed', iterations: iteration };
    }

    // Execute with FRESH context - this is the key!
    await spawnClaude(prompt);

    // Check status and loop
    iteration++;
  }
}
```

The critical function is `spawnClaude(prompt)`. It invokes Claude with `-p` flag meaning "prompt mode" - Claude receives only the prompt, not conversation history. Each invocation is independent.

### 2. Prompt Construction

The `prompt-builder.ts` module reads the current pointer from PROGRESS.yaml and constructs a self-contained prompt:

```typescript
function buildPrompt(progress: CompiledProgress, iteration: number): string {
  const { current } = progress;
  const phase = progress.phases[current.phase];
  const step = phase.steps?.[current.step ?? 0];
  const subPhase = step?.phases?.[current['sub-phase'] ?? 0];

  return `# Sprint Workflow Execution
Sprint: ${progress['sprint-id']} | Iteration: ${iteration}

## Current Position
- Phase: **${phase.id}** (${current.phase + 1}/${progress.phases.length})
- Step: **${step?.id}** (${(current.step ?? 0) + 1}/${phase.steps?.length ?? 0})
- Sub-Phase: **${subPhase?.id}**

## Your Task: ${subPhase?.id}

${subPhase?.prompt}

## Instructions

1. Execute this sub-phase task
2. When complete, update PROGRESS.yaml
3. Commit your changes
4. **EXIT immediately** - do NOT continue to next task`;
}
```

Each prompt contains everything Claude needs to execute that one phase - no external context required.

### 3. State Transitions

After completing a phase, Claude updates the pointer in PROGRESS.yaml. The runtime uses a state machine for type-safe transitions:

```typescript
// Pure transition function
function transition(
  state: SprintState,
  event: SprintEvent,
  context: CompiledProgress
): TransitionResult {
  switch (event.type) {
    case 'PHASE_COMPLETED':
      return advancePointer(state, context);
    case 'PHASE_FAILED':
      return handleFailure(state, event.error);
    // ...
  }
}
```

The next loop iteration reads the updated pointer and builds a prompt for the next phase.

### 4. Error Handling and Retries

```typescript
// Classify errors for appropriate handling
function classifyError(error: Error): ErrorCategory {
  // Network errors, rate limits, timeouts → retry with backoff
  // Validation errors → skip phase
  // Logic errors → needs human intervention
}

// Handle failure with exponential backoff
async function handlePhaseFailure(
  error: Error,
  retryCount: number
): Promise<boolean> {
  const errorType = classifyError(error);

  if (isRetryable(errorType) && retryCount < MAX_RETRIES) {
    const backoffDelay = getBackoffDelay(retryCount);
    await sleep(backoffDelay);
    return true; // Continue loop for retry
  }

  // Block if non-retryable or retries exhausted
  await updatePhaseStatus('blocked');
  return false;
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
