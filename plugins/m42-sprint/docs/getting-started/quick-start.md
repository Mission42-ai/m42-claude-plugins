# Quick Start

Get your first sprint running in under 5 minutes.

---

## Prerequisites

Before starting, verify you have these tools installed:

```bash
# Check yq (required for YAML processing)
yq --version
# Expected: yq (https://github.com/mikefarah/yq/) version v4.x

# Check Node.js (required for compilation)
node --version
# Expected: v18.x or higher
```

**Install if missing:**
```bash
# macOS
brew install yq node

# Linux (Ubuntu/Debian)
sudo snap install yq
sudo apt install nodejs npm
```

---

## Step 1: Create a Sprint

Initialize a new sprint with a name:

```bash
/start-sprint hello-sprint
```

**What happens:**
- Creates directory `.claude/sprints/2026-01-16_hello-sprint/`
- Generates `SPRINT.yaml` with default configuration
- Creates `context/` and `artifacts/` folders

**Expected output:**
```
Sprint initialized successfully!

Location: .claude/sprints/2026-01-16_hello-sprint/

Created files:
  - SPRINT.yaml (workflow definition)
  - context/ (context files)
  - artifacts/ (output files)

Next steps:
  1. Edit SPRINT.yaml to add your steps
  2. Run /run-sprint to compile and execute
```

---

## Step 2: Add Your First Step

Add a step that describes a task for Claude:

```bash
/add-step "Create a simple greeting function that takes a name and returns 'Hello, {name}!'"
```

**What happens:**
- Appends your step to the `steps:` array in SPRINT.yaml
- Each step becomes a task in the execution queue

**Expected output:**
```
Step added to sprint.

Sprint: 2026-01-16_hello-sprint
Step #1: Create a simple greeting function that takes a name...

SPRINT.yaml updated.
Note: Run /run-sprint to compile and execute.
```

---

## Step 3: Add Another Step

Add a second step to see how multi-step sprints work:

```bash
/add-step "Write unit tests for the greeting function"
```

**What happens:**
- Another step is added to the queue
- Steps execute sequentially, each with fresh context

**Expected output:**
```
Step added to sprint.

Sprint: 2026-01-16_hello-sprint
Step #2: Write unit tests for the greeting function

SPRINT.yaml updated.
Note: Run /run-sprint to compile and execute.
```

---

## Step 4: Run the Sprint

Execute your sprint:

```bash
/run-sprint .claude/sprints/2026-01-16_hello-sprint
```

**What happens:**
1. **Compilation**: SPRINT.yaml is compiled through the workflow into PROGRESS.yaml
2. **Ralph Loop starts**: A background process begins executing tasks
3. **Fresh context per task**: Each step runs in a clean Claude session
4. **Live status**: A web server shows real-time progress

**Expected output:**
```
Sprint Loop Launched
====================

Sprint: 2026-01-16_hello-sprint
Directory: .claude/sprints/2026-01-16_hello-sprint
Background Task ID: task_abc123

Workflow: sprint-default
Phases: 3
Steps: 2

Live Status: http://localhost:3100
(Open in browser for real-time progress)

Each phase/step runs with FRESH context (no accumulation).

Monitor progress:
- /sprint-status - View PROGRESS.yaml status
- TaskOutput(task_abc123) - View loop output
```

---

## Step 5: Watch Progress

Check how your sprint is progressing:

```bash
/sprint-status
```

**Expected output:**
```
Sprint: 2026-01-16_hello-sprint
Status: in-progress
Progress: 2/6 phases (33%)

Phases:
[x] prepare (completed)
[>] execute-all (in-progress)
    [x] step-0 (2/2 phases)
    [>] step-1 (1/2 phases)
        [x] implement
        [>] qa (current)
[ ] finalize (pending)

Current: execute-all > step-1 > qa
```

**Status indicators:**
- `[x]` = Completed
- `[>]` = Currently running
- `[ ]` = Pending

---

## What Just Happened?

1. **You defined work**: Two simple steps in plain language
2. **Compiler expanded it**: Your steps became a hierarchical execution plan with sub-phases
3. **Ralph Loop executed**: Each phase ran with fresh Claude context
4. **No context pollution**: Unlike a single long session, each task started clean

This is the **Fresh Context Pattern** - the core innovation of M42 Sprint.

---

## Next Steps

You've completed the quick start. Here's where to go next:

| Want to... | Read |
|------------|------|
| Understand the full workflow | [First Sprint Tutorial](first-sprint.md) |
| Learn the architecture | [Architecture Overview](../concepts/overview.md) |
| Write better sprints | [Writing Sprints Guide](../guides/writing-sprints.md) |
| See all commands | [Commands Reference](../reference/commands.md) |

---

## Quick Reference

```bash
# Create sprint
/start-sprint <name>

# Add steps
/add-step "<description>"

# Run sprint
/run-sprint <directory>

# Monitor
/sprint-status

# Control
/pause-sprint    # Pause gracefully
/resume-sprint   # Resume paused sprint
/stop-sprint     # Stop immediately
```

---

[Back to Documentation Index](../index.md) | [Full Tutorial](first-sprint.md)
