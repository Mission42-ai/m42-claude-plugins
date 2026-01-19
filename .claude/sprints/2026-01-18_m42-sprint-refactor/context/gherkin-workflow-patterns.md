# Gherkin Workflow Patterns Analysis

## Study Source
SPRINT.yaml from: `.claude/sprints/2026-01-17_plugin-enhancements/SPRINT.yaml`

---

## How Workflow Templates Work

### The Two-Layer Architecture

The m42-sprint system uses a **two-layer workflow architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Sprint-Level Workflow                                 │
│  (e.g., gherkin-verified-execution.yaml)                        │
│                                                                 │
│  Defines the OVERALL sprint structure:                          │
│  • preflight - one-time sprint initialization                   │
│  • development - for-each step (delegates to step workflow)     │
│  • final-qa - one-time sprint-level verification                │
│  • summary - one-time summary generation                        │
│  • pr-create - one-time PR creation                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ for-each: step
                              │ workflow: gherkin-step-workflow
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: Step-Level Workflow                                   │
│  (e.g., gherkin-step-workflow.yaml)                             │
│                                                                 │
│  Defines what happens to EACH STEP:                             │
│  • plan - generate gherkin scenarios                            │
│  • context - gather step-specific patterns                      │
│  • execute - implement the step                                 │
│  • qa - verify each scenario (1/0 binary)                       │
│  • verify - integration verification                            │
└─────────────────────────────────────────────────────────────────┘
```

### Key Insight: Workflows are Templates, Not Procedures

Workflows define **structure and prompts**, not execution logic. The sprint loop interprets them:

1. **Compile time**: SPRINT.yaml + workflow → PROGRESS.yaml
2. **Runtime**: Sprint loop walks PROGRESS.yaml phases

---

## Pattern 1: The Gherkin-Verified Pattern

### Philosophy
Every step must produce **binary-verifiable gherkin scenarios**. Each scenario has:
- Given/When/Then structure
- A shell command that exits 0 on pass, non-0 on fail
- Score: 1 (pass) or 0 (fail)

### Why This Works
- **Objective verification**: No subjective "is it done?" - exit codes decide
- **Self-healing**: Failed QA injects fix phases dynamically
- **Audit trail**: Gherkin files + QA reports provide evidence

### Implementation

```yaml
# In step workflow (gherkin-step-workflow.yaml)
phases:
  - id: plan
    prompt: |
      Generate 4-8 gherkin scenarios...
      Each scenario MUST have a verification command...

  - id: qa
    prompt: |
      For EACH scenario:
      1. Run verification command
      2. Record: 1 (pass) or 0 (fail)

      If ANY fail → inject fix phases via yq
```

The QA phase can modify PROGRESS.yaml to inject additional phases:
```bash
yq -i '
  (.phases[] | select(.steps) | .steps[] | select(.status == "in-progress") | .phases) +=
  [
    {"id": "fix", "status": "pending", "prompt": "..."},
    {"id": "reverify", "status": "pending", "prompt": "..."}
  ]
' "$PROGRESS_FILE"
```

---

## Pattern 2: The Shared Context Pattern

### Philosophy
Don't repeat context gathering for every step. Do it once in preflight, share via files.

### Implementation

```yaml
# Sprint-level workflow
phases:
  - id: preflight
    prompt: |
      Create: context/_shared-context.md
      Create: context/sprint-plan.md

  # Every step phase then reads these files
  - id: development
    for-each: step
    workflow: step-workflow  # Step workflow reads _shared-context.md
```

### Why This Works
- **Efficiency**: Context gathered once, used everywhere
- **Consistency**: All steps work from same shared understanding
- **Debuggability**: Context is visible in files, not hidden in prompts

---

## Pattern 3: The Template Variable Pattern

### Available Variables

| Variable | Scope | Example |
|----------|-------|---------|
| `{{step.prompt}}` | Inside for-each | "Implement user auth" |
| `{{step.id}}` | Inside for-each | "step-0" |
| `{{step.index}}` | Inside for-each | 0, 1, 2... |
| `{{phase.id}}` | Any phase | "execute" |
| `{{sprint.id}}` | Any phase | "2026-01-17_feature" |

### Key Pattern: File Naming with Step Context

```yaml
prompt: |
  Create: artifacts/{{step.id}}-gherkin.md
  Create: artifacts/{{step.id}}-qa-report.md
  Create: context/{{step.id}}-context.md
```

This produces:
- `artifacts/step-0-gherkin.md`
- `artifacts/step-0-qa-report.md`
- `context/step-0-context.md`

---

## Pattern 4: The Self-Healing Pattern

### Philosophy
QA failures don't stop the sprint. They inject fix phases and retry.

### Implementation Flow

```
┌─────────────┐
│     QA      │──── ALL PASS ───────────────► Continue to next phase
└─────────────┘
       │
       │ ANY FAIL
       ▼
┌──────────────────────────────────────┐
│  Inject fix + reverify phases via yq │
│  Set QA status = "failed"            │
└──────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│     FIX     │ (injected phase)
└─────────────┘
       │
       ▼
┌─────────────┐
│  REVERIFY   │──── ALL PASS ───► Continue
└─────────────┘      │
       │             │
       │ STILL FAIL  │
       ▼             │
┌─────────────┐      │
│  Another    │◄─────┘
│  FIX cycle  │
└─────────────┘
```

### Key Insight: PROGRESS.yaml is Mutable at Runtime

The sprint loop doesn't just read PROGRESS.yaml - phases can modify it to inject new work.

---

## Pattern 5: The Sprint Lifecycle Pattern

### Standard Sprint Structure

```yaml
phases:
  # 1. PREPARATION (runs once)
  - id: preflight/prepare
    # Branch creation, context gathering

  # 2. DEVELOPMENT (for-each step)
  - id: development
    for-each: step
    workflow: step-workflow

  # 3. VERIFICATION (runs once)
  - id: final-qa
    # Sprint-level verification

  # 4. DELIVERY (runs once)
  - id: summary/pr-create
    # Summary and PR creation
```

### Why This Structure
- **Clear phases**: Each phase has single responsibility
- **Composable**: Step workflow can be swapped without changing sprint structure
- **Observable**: Progress visible at both sprint and step level

---

## Pattern 6: The Gherkin Verification Command Pattern

### Structure

```gherkin
Scenario: [Name]
  Given [precondition]
  When [action]
  Then [expected outcome]

Verification: `[shell command]`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

### Common Verification Patterns

| Check | Command | Notes |
|-------|---------|-------|
| File exists | `test -f path/to/file.ts` | Simple existence |
| TypeScript compiles | `npx tsc --noEmit file.ts 2>&1; echo $?` | Capture exit code |
| Export exists | `grep -q "export.*functionName" file.ts` | Grep for pattern |
| Tests pass | `npm test -- --testPathPattern="pattern"` | Scoped test run |
| Lint passes | `npm run lint -- file.ts` | Scoped lint check |

### Why Binary Verification
- **Objective**: No interpretation needed
- **Automatable**: Script can run and score
- **Repeatable**: Same command, same conditions, same result

---

## How Ralph Mode Differs

### Standard Mode (gherkin-verified-execution)
- **Phases are predefined** in the workflow
- **Steps are static** from SPRINT.yaml
- **Execution is linear**: preflight → steps → qa → summary

### Ralph Mode
- **No predefined phases** - goal-driven
- **Steps are dynamic** - Claude creates them as needed
- **Execution is iterative**: think → act → reflect → repeat

### Key Difference: Freedom vs Structure

```
Standard Mode:                     Ralph Mode:
┌─────────────────┐               ┌─────────────────┐
│ Workflow defines│               │ Goal defines    │
│ EXACTLY what    │               │ DESTINATION,    │
│ happens         │               │ not path        │
└─────────────────┘               └─────────────────┘
         │                                 │
         ▼                                 ▼
  Execute phases                   Think → Create steps
  in order                         → Execute → Reflect
                                   → Maybe create more
```

---

## Implications for the Refactor

### What the Gherkin Pattern Teaches Us

1. **Verification should be binary** - not subjective
2. **Self-healing is powerful** - inject fixes, don't fail hard
3. **Shared context prevents waste** - gather once, use everywhere
4. **Structure enables automation** - predictable files, predictable outcomes

### How This Applies to Ralph Mode

Ralph has freedom, but when Ralph decides to EXECUTE something, the execution should follow proven patterns like:
- Binary verification of outcomes
- Self-healing on failures
- Clear artifacts for debugging

### The Missing Piece

The current Ralph mode has:
- ✅ Freedom to think and create steps
- ✅ Iteration and reflection
- ❌ Patterns for consistent execution within steps

**Opportunity**: Ralph could invoke patterns (like gherkin-verification) when executing, not just when planning.

---

## Summary: Key Patterns

| Pattern | Purpose | Key Mechanism |
|---------|---------|---------------|
| Two-Layer Workflow | Separate sprint from step concerns | `for-each: step` + nested workflow |
| Shared Context | Avoid redundant context gathering | Preflight creates files all steps read |
| Template Variables | Inject runtime values | `{{step.prompt}}`, `{{sprint.id}}` |
| Self-Healing | Recover from failures | QA injects fix phases via yq |
| Binary Verification | Objective pass/fail | Exit code 0 = pass |
| Sprint Lifecycle | Predictable structure | prepare → develop → verify → deliver |

---

## Files Studied

- `.claude/sprints/2026-01-17_plugin-enhancements/SPRINT.yaml`
- `.claude/workflows/gherkin-verified-execution.yaml`
- `.claude/workflows/gherkin-step-workflow.yaml`
- `.claude/workflows/ralph.yaml`
- `plugins/m42-sprint/compiler/src/compile.ts`
- `plugins/m42-sprint/compiler/src/resolve-workflows.ts`
- `plugins/m42-sprint/compiler/src/expand-foreach.ts`
- `plugins/m42-sprint/compiler/src/types.ts`
- `plugins/m42-sprint/docs/concepts/workflow-compilation.md`
- `plugins/m42-sprint/docs/reference/workflow-yaml-schema.md`
