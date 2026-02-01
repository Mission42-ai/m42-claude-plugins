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

## Create Your Sprint

### Step 1: Initialize a Sprint

```bash
/init-sprint hello-sprint
```

**What happens:**
- Creates directory `.claude/sprints/2026-01-16_hello-sprint/`
- Generates `SPRINT.yaml` with default workflow
- Creates `context/` and `artifacts/` folders

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
2. **Sprint loop starts**: Executes each phase sequentially
3. **Fresh context**: Each phase runs in a clean Claude session

### Step 4: Watch Progress

```bash
/sprint-watch
```

Opens a live dashboard showing:
- **Chat-like activity feed**: Assistant messages and tool calls in real-time
- **Elapsed time**: Time spent on each phase and total sprint duration
- **Progress bar**: Visual progress through steps with completion percentage
- **Stale detection**: Automatic alerts if a phase becomes unresponsive

Or use the quick status command:

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

## Model Selection (Optional)

Override the Claude model for specific items or the entire sprint:

```yaml
# Sprint-level default
model: sonnet

collections:
  step:
    - prompt: Complex architecture decision
      model: opus    # Use stronger model for complex reasoning

    - prompt: Simple formatting fix
      model: haiku   # Use faster model for simple tasks
```

---

## What Just Happened?

The sprint uses the **Fresh Context Pattern**:
- Each phase runs in a clean Claude session
- No slowdown from context accumulation
- Reliable multi-hour sprints

Your steps were expanded through workflow phases and executed sequentially with fresh context each time.

---

## Next Steps

| Want to... | Read |
|------------|------|
| Understand the architecture | [Architecture Overview](../concepts/overview.md) |
| Run multiple sprints in parallel | [Worktree Sprints Guide](../guides/worktree-sprints.md) |
| See complete usage guide | [User Guide](../USER-GUIDE.md) |
| See all commands | [Commands Reference](../reference/commands.md) |

---

## Quick Reference

```bash
# Create sprint
/init-sprint <name>

# Create sprint with specific workflow
/init-sprint <name> --workflow sprint-default

# Create sprint with isolated worktree (for parallel development)
/init-sprint <name> --worktree

# Add steps (workflow mode)
/add-step "<description>"

# Run sprint
/run-sprint <directory>

# Run with specific model
/run-sprint <directory> --model opus

# Monitor
/sprint-watch    # Live dashboard (chat-like view, elapsed time, progress)
/sprint-status   # Quick status

# Control
/pause-sprint    # Pause gracefully
/resume-sprint   # Resume paused sprint
/stop-sprint     # Stop immediately
```

---

[Back to Documentation Index](../index.md) | [User Guide](../USER-GUIDE.md)
