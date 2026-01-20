# Your First Sprint

A complete 15-minute walkthrough of the M42 Sprint system. You'll create a sprint, understand each component, execute it, and learn to interpret the results.

---

## Prerequisites

Before starting, ensure you have these tools installed.

### Node.js (JavaScript Runtime)

The compiler is written in TypeScript and requires Node.js.

```bash
# Check installation
node --version
# Expected: v18.x or higher

npm --version
# Expected: 8.x or higher
```

**Install if missing:**

| Platform | Command |
|----------|---------|
| macOS | `brew install node` |
| Ubuntu/Debian | `sudo apt update && sudo apt install nodejs npm` |
| Windows | Download from [nodejs.org](https://nodejs.org/) |
| Using nvm | `nvm install 18 && nvm use 18` |

### Claude Code CLI

You should already have Claude Code installed if you're reading this. Verify:

```bash
claude --version
```

---

## Step 1: Create Your Sprint

Let's create a sprint that builds a simple utility function with tests.

```bash
/start-sprint calculator-utils
```

**What this does:**
1. Creates a date-prefixed directory: `.claude/sprints/YYYY-MM-DD_calculator-utils/`
2. Generates a starter `SPRINT.yaml` file
3. Creates `context/` and `artifacts/` directories

**Expected output:**
```
Sprint initialized successfully!

Location: .claude/sprints/2026-01-16_calculator-utils/

Created files:
  - SPRINT.yaml (workflow definition)
  - context/ (context files)
  - artifacts/ (output files)

Next steps:
  1. Edit SPRINT.yaml to add your steps
  2. Run /run-sprint to compile and execute
```

**Verify by listing the directory:**
```bash
ls -la .claude/sprints/
# Should show: 2026-01-16_calculator-utils/
```

---

## Step 2: Understand SPRINT.yaml

Let's look at what was created:

```bash
cat .claude/sprints/2026-01-16_calculator-utils/SPRINT.yaml
```

You'll see something like:

```yaml
workflow: sprint-default
steps: []

sprint-id: 2026-01-16_calculator-utils
name: calculator-utils
created: 2026-01-16T10:00:00Z
```

### Key Fields Explained

| Field | Purpose |
|-------|---------|
| `workflow` | Which workflow template to use (defines the execution phases) |
| `steps` | Your list of tasks (currently empty) |
| `sprint-id` | Unique identifier for this sprint |
| `name` | Human-readable name |
| `created` | When the sprint was initialized |

The `workflow: sprint-default` references a workflow file at `.claude/workflows/sprint-default.yaml`. This workflow defines:
- A `prepare` phase (sets up the sprint)
- An `execute-all` phase (runs your steps through sub-phases)
- A `finalize` phase (cleanup and PR creation)

---

## Step 3: Add Your Steps

Now let's add the tasks we want Claude to accomplish:

```bash
/add-step "Create a calculator utility module with add, subtract, multiply, and divide functions"
```

**Expected output:**
```
Step added to sprint.

Sprint: 2026-01-16_calculator-utils
Step #1: Create a calculator utility module with add, subtract...

SPRINT.yaml updated.
```

Add a second step:

```bash
/add-step "Write comprehensive unit tests for the calculator module"
```

And a third step:

```bash
/add-step "Add input validation to handle edge cases like division by zero"
```

### Verify Your SPRINT.yaml

```bash
cat .claude/sprints/2026-01-16_calculator-utils/SPRINT.yaml
```

Now shows:

```yaml
workflow: sprint-default
steps:
  - Create a calculator utility module with add, subtract, multiply, and divide functions
  - Write comprehensive unit tests for the calculator module
  - Add input validation to handle edge cases like division by zero

sprint-id: 2026-01-16_calculator-utils
name: calculator-utils
created: 2026-01-16T10:00:00Z
```

### Step Format Options

Steps can be simple strings (as above) or objects with metadata:

```yaml
# String format (simple)
steps:
  - Create a feature

# Object format (with metadata)
steps:
  - prompt: Create a feature
    id: feature-creation
    workflow: custom-workflow  # Optional: use different workflow for this step
```

---

## Step 4: Choose and Understand Your Workflow

Your sprint uses `sprint-default`, but what does that mean?

### View Available Workflows

```bash
ls .claude/workflows/
```

Common workflows:
- `sprint-default.yaml` - Full sprint with prepare/execute/finalize
- `execute-step.yaml` - Simple single-phase execution
- `gherkin-verified-execution.yaml` - TDD with Gherkin scenarios

### Understanding sprint-default

The `sprint-default` workflow typically has this structure:

```yaml
name: Standard Sprint
phases:
  - id: prepare
    prompt: |
      Initialize sprint environment...

  - id: execute-all
    for-each: step           # Iterates over your SPRINT.yaml steps
    workflow: implement-and-qa  # Each step goes through this workflow

  - id: finalize
    prompt: |
      Create PR and cleanup...
```

The key is `for-each: step`. This means each of your 3 steps will be processed through the `implement-and-qa` workflow, which typically has phases like `implement` and `qa`.

### How Expansion Works

```
Your 3 steps × 2 sub-phases per step + prepare + finalize = 8 total phases

SPRINT.yaml steps:                PROGRESS.yaml phases:
─────────────────                 ─────────────────────
1. Calculator module    ──►       prepare (1 phase)
2. Unit tests           ──►       execute-all:
3. Input validation     ──►         step-0: implement, qa (2 phases)
                                    step-1: implement, qa (2 phases)
                                    step-2: implement, qa (2 phases)
                                  finalize (1 phase)

                                  Total: 8 phases
```

---

## Step 5: Preview the Compiled Workflow (Optional)

Before running, you can preview what will be generated:

```bash
/run-sprint .claude/sprints/2026-01-16_calculator-utils --dry-run
```

This compiles SPRINT.yaml + workflows into PROGRESS.yaml **without** executing. You'll see the full phase hierarchy that will be created.

---

## Step 6: Run the Sprint

Now let's execute:

```bash
/run-sprint .claude/sprints/2026-01-16_calculator-utils
```

**What happens:**

1. **Compilation Phase**
   - Compiler reads SPRINT.yaml and workflow templates
   - Expands `for-each` phases over your steps
   - Generates PROGRESS.yaml with the full execution plan

2. **Ralph Loop Starts**
   - A background process begins executing phases
   - Each phase runs with FRESH Claude context (no accumulation)
   - Status page becomes available for monitoring

**Expected output:**
```
Sprint Loop Launched
====================

Sprint: 2026-01-16_calculator-utils
Directory: .claude/sprints/2026-01-16_calculator-utils
Background Task ID: task_abc123

Workflow: sprint-default
Phases: 3 top-level
Steps: 3

Live Status: http://localhost:3100
(Open in browser for real-time progress)

Monitor progress:
- /sprint-status - View PROGRESS.yaml status
- TaskOutput(task_abc123) - View loop output
```

---

## Step 7: Monitor Progress

### Using /sprint-status

```bash
/sprint-status
```

**Example output:**
```
Sprint: 2026-01-16_calculator-utils
Status: in-progress
Progress: 4/8 phases (50%)

Phases:
[x] prepare (completed)
[>] execute-all (in-progress)
    [x] step-0 (2/2 phases)
        [x] implement
        [x] qa
    [>] step-1 (1/2 phases)
        [x] implement
        [>] qa (current)
    [ ] step-2 (0/2 phases)
        [ ] implement
        [ ] qa
[ ] finalize (pending)

Current: execute-all > step-1 > qa
```

### Status Indicators

| Symbol | Meaning |
|--------|---------|
| `[x]` | Completed successfully |
| `[>]` | Currently executing |
| `[ ]` | Pending (not started) |
| `[!]` | Blocked or failed |
| `[~]` | Skipped |

### Using the Live Status Page

Open `http://localhost:3100` in your browser for:
- Real-time progress visualization
- Activity feed showing what Claude is doing
- Phase timing information

---

## Step 8: Interpret PROGRESS.yaml

Once the sprint starts, examine the generated PROGRESS.yaml:

```bash
cat .claude/sprints/2026-01-16_calculator-utils/PROGRESS.yaml
```

### Key Sections

**1. Status and Sprint ID:**
```yaml
sprint-id: 2026-01-16_calculator-utils
status: in-progress  # or: completed, paused, blocked, needs-human
```

**2. Current Pointer:**
```yaml
current:
  phase: 1        # Index into phases[] (0-based)
  step: 1         # Index into steps[] within execute-all phase
  sub-phase: 0    # Index into step's phases[]
```

This tells you exactly where execution is:
- `phase: 1` → `execute-all` (the for-each phase)
- `step: 1` → `step-1` (your second step)
- `sub-phase: 0` → `implement` phase of that step

**3. Phase Hierarchy:**
```yaml
phases:
  - id: prepare
    status: completed
    started-at: "2026-01-16T10:00:00Z"
    completed-at: "2026-01-16T10:02:00Z"

  - id: execute-all
    status: in-progress
    steps:
      - id: step-0
        prompt: "Create a calculator utility module..."
        status: completed
        phases:
          - id: implement
            status: completed
          - id: qa
            status: completed

      - id: step-1
        prompt: "Write comprehensive unit tests..."
        status: in-progress
        phases:
          - id: implement
            status: in-progress  # ← Currently here
          - id: qa
            status: pending
```

**4. Statistics:**
```yaml
stats:
  started-at: "2026-01-16T10:00:00Z"
  total-phases: 3
  completed-phases: 1
  total-steps: 3
  completed-steps: 1
  current-iteration: 5
  max-iterations: 30
```

---

## Step 9: Control Execution

### Pause the Sprint

If you need to pause:

```bash
/pause-sprint
```

This sets a pause flag. The current phase completes, then the loop stops gracefully.

### Resume a Paused Sprint

```bash
/resume-sprint
```

Clears the pause flag and continues from where it stopped.

### Stop Immediately

```bash
/stop-sprint
```

Forces immediate stop. Use sparingly - prefer `/pause-sprint` for graceful handling.

---

## Step 10: Review Results

When the sprint completes, you'll see:

```
Sprint: 2026-01-16_calculator-utils
Status: completed
Progress: 8/8 phases (100%)

Duration: 15m 32s
Completed: 2026-01-16T10:15:32Z
```

### Check the Artifacts

Your implemented code is in your project directory. Any sprint-specific outputs are in:

```bash
ls .claude/sprints/2026-01-16_calculator-utils/artifacts/
```

### Review Phase Logs

Each phase creates a log file:

```bash
ls .claude/sprints/2026-01-16_calculator-utils/logs/
# prepare.log
# execute-all-step-0-implement.log
# execute-all-step-0-qa.log
# execute-all-step-1-implement.log
# ...
```

These logs contain the full Claude output for each phase.

---

## Troubleshooting

### "node: command not found"

**Cause:** Node.js is not installed.

**Solution:**
```bash
# macOS
brew install node

# Ubuntu/Debian
sudo apt update && sudo apt install nodejs npm

# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### "Workflow not found: xyz-workflow"

**Cause:** Referenced workflow doesn't exist.

**Solution:**
```bash
# List available workflows
ls .claude/workflows/

# Update SPRINT.yaml to use an existing workflow name
# (workflow names don't include .yaml extension)
```

### Sprint stuck on same phase

**Cause:** Phase completion not updating, or pointer not advancing.

**Diagnosis:**
```bash
# Check current state
/sprint-status

# Or inspect PROGRESS.yaml directly
cat .claude/sprints/*/PROGRESS.yaml | grep -A5 'current:'
cat .claude/sprints/*/PROGRESS.yaml | grep 'status:'
```

**Solution:**
```bash
# Stop and investigate
/stop-sprint

# Review the last log file for errors
tail -50 .claude/sprints/*/logs/*.log

# If needed, manually fix PROGRESS.yaml current pointer
# Then resume
/resume-sprint
```

### "needs-human" status

**Cause:** Sprint hit a situation requiring your input.

**Check:**
```bash
# Check for blocked phases
cat .claude/sprints/*/PROGRESS.yaml | grep -B5 'status: blocked'
```

Look for `human-needed` field with `reason` and `details`.

**Solution:** Resolve the issue described, then manually edit PROGRESS.yaml to set the status to `in-progress` and the blocked phase to `pending`, then:
```bash
/resume-sprint
```

### Compilation fails with YAML syntax error

**Cause:** Invalid YAML in SPRINT.yaml.

**Diagnosis:**
```bash
# Check YAML syntax by viewing the file
cat .claude/sprints/*/SPRINT.yaml

# Common issues:
# - Unquoted colons in prompts
# - Bad indentation
# - Missing list markers (-)
```

**Solution:** Fix the YAML syntax. Use quotes for prompts with special characters:
```yaml
steps:
  - prompt: "Fix: this colon was causing problems"
```

### New steps not appearing in execution

**Cause:** PROGRESS.yaml was compiled before you added steps.

**Solution:**
```bash
# Force recompilation
/run-sprint .claude/sprints/2026-01-16_calculator-utils --recompile
```

---

## What's Next?

You've completed your first sprint. Here's where to explore next:

| Goal | Resource |
|------|----------|
| Understand the architecture | [Architecture Overview](../concepts/overview.md) |
| Learn about the Ralph Loop | [Ralph Loop Pattern](../concepts/ralph-loop.md) |
| Write better sprints | [Writing Sprints Guide](../guides/writing-sprints.md) |
| Create custom workflows | [Writing Workflows Guide](../guides/writing-workflows.md) |
| See all commands | [Commands Reference](../reference/commands.md) |
| Fix common problems | [Troubleshooting](../troubleshooting/common-issues.md) |

---

## Quick Reference Card

```bash
# Sprint Lifecycle
/start-sprint <name>              # Create new sprint
/add-step "<description>"         # Add step to current sprint
/run-sprint <dir>                 # Compile and execute
/run-sprint <dir> --dry-run       # Preview without executing
/run-sprint <dir> --recompile     # Force recompilation

# Monitoring
/sprint-status                    # View progress
http://localhost:3100             # Live status page

# Control
/pause-sprint                     # Graceful pause
/resume-sprint                    # Continue paused sprint
/stop-sprint                      # Immediate stop

# Debugging
/sprint-status                    # Current position and status
cat PROGRESS.yaml                 # Raw view of execution state
tail -50 logs/*.log               # Recent log output
```

---

[Back to Documentation Index](../index.md) | [Quick Start](quick-start.md) | [Architecture](../concepts/overview.md)
