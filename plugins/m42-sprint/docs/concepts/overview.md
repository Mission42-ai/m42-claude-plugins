# Architecture Overview

The M42 Sprint system follows a **Three-Tier Architecture** that separates what you want to do (steps) from how to do it (workflows) and where you are (progress tracking).

---

## The Three-Tier Model

```
                         You Write This
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         SPRINT.yaml                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  workflow: sprint-default                                       │  │
│  │  steps:                                                         │  │
│  │    - prompt: "Implement user authentication"                    │  │
│  │    - prompt: "Add session management"                           │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │  /run-sprint triggers
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    TypeScript Compiler                                │
│                                                                       │
│   Load         Resolve        Expand         Substitute    Generate  │
│  SPRINT.yaml → Workflows → for-each loops → Variables → PROGRESS.yaml│
│                                                                       │
│  compiler/src/                                                        │
│  ├── compile.ts           (orchestrates pipeline)                     │
│  ├── resolve-workflows.ts (loads .yaml workflow templates)            │
│  ├── expand-foreach.ts    (iterates steps through phases)             │
│  └── validate.ts          (schema validation)                         │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │  Generates
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       PROGRESS.yaml                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  status: in-progress                                            │  │
│  │  current:                                                       │  │
│  │    phase: 1                                                     │  │
│  │    step: 0                                                      │  │
│  │    sub-phase: 1                                                 │  │
│  │  phases:                                                        │  │
│  │    - id: prepare       (status: completed)                      │  │
│  │    - id: development   (contains steps with sub-phases)         │  │
│  │    - id: qa            (status: pending)                        │  │
│  │    - id: deploy        (status: pending)                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │  Drives
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Ralph Loop (Sprint Loop)                          │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐    │
│   │                 TypeScript Runtime (runtime/)                │    │
│   │                                                              │    │
│   │  while not_done:                                             │    │
│   │    1. Read PROGRESS.yaml current pointer                     │    │
│   │    2. Build prompt for current phase                         │    │
│   │    3. Invoke `claude -p` with FRESH context  ◄── Key!        │    │
│   │    4. Update PROGRESS.yaml                                   │    │
│   │    5. Advance pointer or handle error                        │    │
│   └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## The Ralph Loop: Fresh Context Execution

The **Ralph Loop** is the core innovation that enables reliable, long-running sprints.

### The Problem: Context Accumulation

Traditional approaches accumulate context as tasks complete:

```
Task 1 completes  → Context: [Task 1 output]
Task 2 completes  → Context: [Task 1 output + Task 2 output]
Task 3 completes  → Context: [Task 1 + Task 2 + Task 3 output]
     ...
Task N            → Context: [FULL - responses slow, costs high, overflow risk]
```

### The Solution: Fresh Context Per Phase

The Ralph Loop gives each phase a clean slate:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Sprint Loop Execution                           │
│                                                                      │
│    ┌──────────────────┐                                              │
│    │  PROGRESS.yaml   │                                              │
│    │  current: {      │                                              │
│    │    phase: 1      │                                              │
│    │    step: 0       │                                              │
│    │    sub-phase: 1  │                                              │
│    │  }               │                                              │
│    └────────┬─────────┘                                              │
│             │                                                        │
│             │ Read position                                          │
│             ▼                                                        │
│    ┌──────────────────┐      ┌──────────────────┐                    │
│    │  Build Prompt    │ ───► │  claude -p       │                    │
│    │  (context files  │      │  (FRESH context) │                    │
│    │   + phase task)  │      └────────┬─────────┘                    │
│    └──────────────────┘               │                              │
│                                       │ Execute phase                │
│                                       ▼                              │
│    ┌──────────────────┐      ┌──────────────────┐                    │
│    │  Advance pointer │ ◄─── │  Update status   │                    │
│    │  to next phase   │      │  in PROGRESS.yaml│                    │
│    └────────┬─────────┘      └──────────────────┘                    │
│             │                                                        │
│             │ Loop                                                   │
│             └─────────────────────────┐                              │
│                                       ▼                              │
│                              [Next iteration with                    │
│                               FRESH context again]                   │
└─────────────────────────────────────────────────────────────────────┘
```

Each `claude -p` invocation starts with a clean context window. The only information carried forward is:
- The sprint's context files (explicit, controlled)
- The current phase's prompt (from PROGRESS.yaml)
- The current pointer position

**Result:** Consistent performance from phase 1 to phase 100.

For a deep dive into the Ralph Loop pattern, see [Ralph Loop Pattern](ralph-loop.md).

---

## Component Map

```
plugins/m42-sprint/
│
├── commands/                     # Claude Code slash commands
│   ├── init-sprint.md           (/init-sprint)
│   ├── run-sprint.md            (/run-sprint)
│   ├── sprint-status.md         (/sprint-status)
│   ├── add-step.md              (/add-step)
│   ├── import-steps.md          (/import-steps)
│   ├── pause-sprint.md          (/pause-sprint)
│   ├── resume-sprint.md         (/resume-sprint)
│   └── stop-sprint.md           (/stop-sprint)
│
├── compiler/                     # TypeScript compilation pipeline
│   └── src/
│       ├── compile.ts           Main orchestration
│       ├── resolve-workflows.ts  Load workflow templates
│       ├── expand-foreach.ts    Iterate steps through phases
│       ├── validate.ts          Schema validation
│       └── types.ts             TypeScript definitions
│
├── runtime/                      # TypeScript execution runtime
│   └── src/
│       ├── cli.ts               Entry point (node dist/cli.js run)
│       ├── loop.ts              The Ralph Loop implementation
│       ├── prompt-builder.ts    Construct prompts from PROGRESS.yaml
│       ├── transition.ts        State machine transitions
│       ├── executor.ts          Action execution
│       └── yaml-ops.ts          Atomic YAML operations
│
├── scripts/                      # Integration tests
│   ├── test-sprint-features.sh
│   ├── test-skip-spawned.sh
│   ├── test-skip-parallel-task-id.sh
│   └── test-normal-subphase.sh
│
├── docs/                         # Documentation (you are here)
│   ├── index.md                 Navigation hub
│   ├── concepts/                Architecture & patterns
│   ├── getting-started/         Tutorials
│   ├── guides/                  How-to guides
│   ├── reference/               Technical specs
│   └── troubleshooting/         Problem solving
│
└── skills/                       # Claude Code skills
    ├── orchestrating-sprints/   Sprint execution skills
    ├── creating-sprints/        Sprint creation skills
    └── creating-workflows/      Workflow authoring skills
```

### Sprint Directory Structure

When you create a sprint, it lives here:

```
.claude/sprints/YYYY-MM-DD_sprint-name/
│
├── SPRINT.yaml          # Your input: steps + workflow reference
├── PROGRESS.yaml        # Generated: hierarchical execution plan
│
├── context/             # Context files passed to each phase
│   └── sprint-plan.md   # Sprint-level context
│
├── artifacts/           # Outputs and deliverables
│
└── logs/                # Phase execution logs
    ├── prepare.log
    ├── execute-all-step-0-implement.log
    └── ...
```

---

## Why This Architecture?

### Separation of Concerns

| Layer | Responsibility | Who Writes It |
|-------|---------------|---------------|
| SPRINT.yaml | **What** needs to be done (steps) | You |
| Workflows | **How** to process each step (phases) | You or built-in |
| PROGRESS.yaml | **Where** we are (tracking) | Compiler (generated) |
| Ralph Loop | **Execute** one phase at a time | Sprint system |

This separation means:
- Steps are simple prompts (easy to write)
- Workflows are reusable across sprints
- Progress tracking is automatic and consistent
- Execution is reliable and observable

### Fresh Context Enables Scale

```
Without Fresh Context:          With Fresh Context (Ralph Loop):
─────────────────────────       ─────────────────────────────────

Phase 1:  Fast                  Phase 1:  Fast
Phase 5:  Slower                Phase 5:  Fast
Phase 10: Much slower           Phase 10: Fast
Phase 20: Very slow             Phase 20: Fast
Phase 50: Timeout risk          Phase 50: Fast
          ▲                               ▲
          │                               │
    Context grows              Each phase: clean slate
    with each phase
```

### Compilation Provides Structure

The compilation step transforms your simple steps into a rich execution plan:

```
INPUT (SPRINT.yaml):                OUTPUT (PROGRESS.yaml):
────────────────────────────        ─────────────────────────────────
workflow: sprint-default            phases:
steps:                                - id: prepare
  - prompt: "Step A"                    status: pending
  - prompt: "Step B"                  - id: development
                                        steps:
2 steps                                   - id: step-0
                                            phases:
                                              - id: implement
                                              - id: qa
                                          - id: step-1
                                            phases:
                                              - id: implement
                                              - id: qa
                                      - id: deploy

                                    12 total phases to execute
```

For details on the compilation pipeline, see [Workflow Compilation](workflow-compilation.md).

---

## Key Benefits

| Benefit | How It's Achieved |
|---------|-------------------|
| **Reliable long sprints** | Fresh context per phase (no accumulation) |
| **Simple step definition** | Just write prompts in SPRINT.yaml |
| **Reusable workflows** | Workflows define phase patterns once |
| **Automatic tracking** | PROGRESS.yaml generated and updated |
| **Resumable execution** | Current pointer survives interruption |
| **Observable progress** | `/sprint-status` shows hierarchical view |
| **Predictable costs** | Each phase uses similar token count |
| **Parallel-ready** | Architecture supports future parallel execution |

---

## What's Next?

- [Ralph Loop Pattern](ralph-loop.md) - Deep dive into fresh context execution
- [Workflow Compilation](workflow-compilation.md) - How SPRINT.yaml becomes PROGRESS.yaml
- [Quick Start](../getting-started/quick-start.md) - Try it in 5 minutes
- [Commands Reference](../reference/commands.md) - All available commands

---

[← Back to Documentation Index](../index.md)
