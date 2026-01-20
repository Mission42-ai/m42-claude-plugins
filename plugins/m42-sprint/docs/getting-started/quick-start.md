# Quick Start

Get your first sprint running in under 5 minutes.

---

## Prerequisites

Before starting, verify you have Node.js installed:

```bash
# Check Node.js (required for compilation and runtime)
node --version
# Expected: v18.x or higher
```

**Install if missing:**
```bash
# macOS
brew install node

# Linux (Ubuntu/Debian)
sudo apt install nodejs npm

# Or use nvm (recommended)
nvm install --lts
```

---

## Choose Your Mode

M42 Sprint offers two execution modes:

| Mode | Best For | How It Works |
|------|----------|--------------|
| **Ralph Mode** (Recommended) | Complex features, open-ended goals | Define a goal; Claude thinks and shapes work dynamically |
| **Workflow Mode** | Routine tasks, known sequences | Define steps; compiler expands through workflow phases |

---

## Option A: Ralph Mode (Recommended)

Ralph Mode is ideal when you have a goal but want Claude to figure out the steps.

### Step 1: Create a Ralph Sprint

```bash
/start-sprint hello-sprint --ralph
```

**What happens:**
- Creates directory `.claude/sprints/2026-01-16_hello-sprint/`
- Generates `SPRINT.yaml` configured for Ralph mode
- Creates `context/` and `artifacts/` folders

### Step 2: Define Your Goal

Edit `SPRINT.yaml` to describe what you want to achieve:

```yaml
workflow: ralph

goal: |
  Create a greeting utility module with:
  - A function that takes a name and returns "Hello, {name}!"
  - Unit tests for the function
  - TypeScript types

  Success criteria:
  - All tests pass
  - Code compiles without errors

per-iteration-hooks:
  learning:
    enabled: true  # Extract learnings after each iteration
```

### Step 3: Run the Sprint

```bash
/run-sprint .claude/sprints/2026-01-16_hello-sprint
```

**What happens:**
1. Ralph Loop starts with your goal
2. Claude analyzes the goal and creates implementation steps
3. Each iteration runs with fresh context
4. Claude signals `goal-complete` when done

### Step 4: Watch Progress

```bash
/sprint-watch
```

Opens a live dashboard showing:
- Current iteration and step being executed
- Dynamically created steps
- Hook task status

---

## Option B: Workflow Mode

Workflow Mode is best when you have specific steps to execute.

### Step 1: Create a Workflow Sprint

```bash
/start-sprint hello-sprint --workflow sprint-default
```

### Step 2: Add Your Steps

```bash
/add-step "Create a simple greeting function that takes a name and returns 'Hello, {name}!'"
/add-step "Write unit tests for the greeting function"
```

**What happens:**
- Each step is appended to `SPRINT.yaml`
- Steps will be expanded through workflow phases

### Step 3: Run the Sprint

```bash
/run-sprint .claude/sprints/2026-01-16_hello-sprint
```

**What happens:**
1. **Compilation**: SPRINT.yaml is expanded into PROGRESS.yaml
2. **Sprint Loop starts**: Executes each phase sequentially
3. **Fresh context**: Each phase runs in a clean Claude session

### Step 4: Check Status

```bash
/sprint-status
```

**Example output:**
```
Sprint: 2026-01-16_hello-sprint
Status: in-progress
Progress: 2/6 phases (33%)

Phases:
[x] prepare (completed)
[>] execute-all (in-progress)
    [x] step-0 (2/2 phases)
    [>] step-1 (1/2 phases)
[ ] finalize (pending)
```

---

## What Just Happened?

Both modes use the **Fresh Context Pattern**:
- Each iteration/phase runs in a clean Claude session
- No slowdown from context accumulation
- Reliable multi-hour sprints

**Ralph Mode**: Claude thought about the goal, created steps dynamically, and decided when complete.

**Workflow Mode**: Your steps were expanded through workflow phases and executed sequentially.

---

## Next Steps

| Want to... | Read |
|------------|------|
| Learn Ralph Mode deeply | [Ralph Mode Concepts](../concepts/ralph-mode.md) |
| Understand the architecture | [Architecture Overview](../concepts/overview.md) |
| See complete usage guide | [User Guide](../USER-GUIDE.md) |
| See all commands | [Commands Reference](../reference/commands.md) |

---

## Quick Reference

```bash
# Create sprint (Ralph mode - recommended)
/start-sprint <name> --ralph

# Create sprint (Workflow mode)
/start-sprint <name> --workflow sprint-default

# Add steps (workflow mode)
/add-step "<description>"

# Run sprint
/run-sprint <directory>

# Monitor
/sprint-watch    # Live dashboard
/sprint-status   # Quick status

# Control
/pause-sprint    # Pause gracefully
/resume-sprint   # Resume paused sprint
/stop-sprint     # Stop immediately
```

---

[Back to Documentation Index](../index.md) | [User Guide](../USER-GUIDE.md)
