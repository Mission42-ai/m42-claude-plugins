# M42 Sprint Plugin - User Guide

Complete guide to sprint orchestration for Claude Code.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Ralph Mode (Recommended)](#ralph-mode-recommended)
5. [Workflow Mode](#workflow-mode)
6. [Commands Reference](#commands-reference)
7. [Configuration](#configuration)
8. [Activity Logging & Hooks](#activity-logging--hooks)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Overview

M42 Sprint is a Claude Code plugin that enables autonomous sprint execution with fresh context per iteration. It supports two modes:

- **Ralph Mode** (recommended): Goal-driven autonomous execution where Claude thinks deeply and shapes work dynamically
- **Workflow Mode**: Structured step-based execution with predefined phases

### Key Concepts

- **Sprint**: A container for work with shared configuration and context
- **Ralph Loop**: Fresh Claude context per iteration (no context accumulation)
- **Goal** (Ralph mode): High-level objective Claude works toward autonomously
- **Steps** (Workflow mode): Predefined work items processed through workflows
- **Per-iteration hooks**: Deterministic background tasks that run after each iteration

### How It Works

```
Ralph Mode:
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ SPRINT.yaml │ ──► │  Ralph Loop  │ ──► │ goal-complete   │
│   (goal)    │     │  (iterates)  │     │    or pause     │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │
                           ▼
                    Fresh context per iteration
                    + optional per-iteration hooks

Workflow Mode:
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ SPRINT.yaml │ ──► │   Compiler   │ ──► │ PROGRESS.yaml   │
│  (steps)    │     │  (expands)   │     │   (phases)      │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                │
                                                ▼
                                          Sprint Loop
```

### When to Use Each Mode

| Ralph Mode | Workflow Mode |
|------------|---------------|
| Complex features, open-ended goals | Well-defined tasks, routine work |
| Research-heavy, exploratory work | Batched operations |
| Goals where exact steps aren't known | Known phase sequences |
| Tasks benefiting from reflection | Compliance workflows |

---

## Installation

### From Plugin Registry

```bash
claude plugin install m42-sprint
```

### From GitHub

```bash
claude plugin add https://github.com/mission42-ai/m42-claude-plugins/tree/main/plugins/m42-sprint
```

### Verify Installation

```bash
claude /help
# Look for m42-sprint commands in the list
```

---

## Quick Start

### Ralph Mode (Recommended)

For goal-driven autonomous execution:

```bash
# 1. Create sprint with Ralph mode
/start-sprint auth-feature --ralph

# 2. Edit SPRINT.yaml to define your goal
# (The command will tell you where the file is)

# 3. Run it
/run-sprint .claude/sprints/2026-01-19_auth-feature

# 4. Watch progress
/sprint-watch
```

**Example SPRINT.yaml for Ralph mode:**
```yaml
workflow: ralph

goal: |
  Build a complete JWT authentication system.

  Requirements:
  - Login and registration endpoints
  - Token refresh mechanism
  - Logout with token invalidation

  Success criteria:
  - All endpoints tested
  - TypeScript compiles without errors
  - All tests passing

per-iteration-hooks:
  learning:
    enabled: true   # Extract learnings after each iteration
```

### Workflow Mode

For structured step-by-step execution:

```bash
# 1. Create sprint
/start-sprint auth-feature --workflow sprint-default

# 2. Add steps
/add-step "Implement user login endpoint with JWT authentication"
/add-step "Add authentication middleware for protected routes"

# 3. Run (compiles and executes)
/run-sprint .claude/sprints/2026-01-19_auth-feature

# 4. Monitor
/sprint-status
```

### Control Commands

```bash
/pause-sprint    # Graceful pause after current iteration
/resume-sprint   # Resume paused sprint
/stop-sprint     # Immediate stop
/sprint-watch    # Open status dashboard
```

---

## Ralph Mode (Recommended)

Ralph Mode is an autonomous goal-driven workflow where Claude thinks deeply and shapes work dynamically. Each iteration runs with fresh context, and Claude decides when the goal is complete.

### How Ralph Mode Works

1. **Define a goal** in SPRINT.yaml - describe what you want to achieve
2. **Claude analyzes** the goal and creates implementation steps
3. **Each iteration**: Claude executes a step with fresh context
4. **Reflection**: When stuck, Claude reflects and adjusts approach
5. **Completion**: Claude signals `goal-complete` when done

### SPRINT.yaml Configuration

```yaml
workflow: ralph

goal: |
  Build a complete authentication system with JWT tokens.

  Requirements:
  - Registration and login endpoints
  - Token refresh mechanism
  - Logout with token invalidation

  Success criteria:
  - All endpoints tested and documented
  - TypeScript compiles without errors
  - All tests passing

# Optional configuration
ralph:
  idle-threshold: 3      # Iterations without progress → reflection mode
  min-iterations: 15     # Minimum iterations before goal-complete accepted

# Per-iteration hooks (recommended)
per-iteration-hooks:
  learning:
    enabled: true        # Extract learnings after each iteration
```

### Result Reporting

Claude signals its state via JSON in each iteration:

**Continue working:**
```json
{
  "status": "continue",
  "summary": "Implemented login endpoint",
  "completedStepIds": ["step-0"],
  "pendingSteps": [
    {"id": "step-1", "prompt": "Add logout endpoint"},
    {"id": null, "prompt": "Add token refresh (discovered need)"}
  ]
}
```

**Goal complete:**
```json
{
  "status": "goal-complete",
  "summary": "Completed final verification",
  "goalCompleteSummary": "Implemented full JWT auth with registration, login, refresh, logout. All 12 tests passing."
}
```

**Need human help:**
```json
{
  "status": "needs-human",
  "summary": "Blocked on database configuration",
  "humanNeeded": {
    "reason": "DATABASE_URL not configured",
    "details": "The .env file is missing credentials. Please add and resume."
  }
}
```

### Best Practices for Ralph Mode

1. **Write clear goals**: Include requirements and success criteria
2. **Enable learning hooks**: Compounds knowledge across iterations
3. **Set min-iterations appropriately**: Ensures deep work, not premature completion
4. **Add context files**: Put relevant docs in `context/` directory

For full Ralph Mode documentation, see [Ralph Mode Concepts](concepts/ralph-mode.md).

---

## Workflow Mode

Workflow Mode uses predefined workflows to process steps through structured phases. Best for well-defined tasks with known phase sequences.

### How Workflow Mode Works

1. **Define steps** in SPRINT.yaml - your work items
2. **Compiler expands** steps through workflow templates into PROGRESS.yaml
3. **Sprint loop executes** each phase with fresh context
4. **Completion**: When all phases are done

### SPRINT.yaml Configuration

```yaml
workflow: sprint-default    # Reference to .claude/workflows/sprint-default.yaml

steps:
  - prompt: |
      Implement user authentication with JWT.
      Requirements:
      - Login endpoint
      - Token refresh
      - Logout

  - prompt: |
      Add session management and remember-me functionality.

  - prompt: |
      Fix: Password reset emails not sending.
    workflow: bugfix-workflow  # Optional: use different workflow for this step
```

### Available Workflows

| Workflow | Phases | Best For |
|----------|--------|----------|
| `sprint-default` | prepare → development (per step) → qa → deploy | Full sprints |
| `feature-standard` | planning → implement → test → document | Individual features |
| `bugfix-workflow` | diagnose → fix → verify | Bug fixes |

For detailed workflow information, see the [Workflow System](#workflow-system) section below.

---

## Commands Reference

### Sprint Lifecycle

#### `/start-sprint <name> [--ralph | --workflow <name>]`

Initialize a new sprint directory.

**Arguments:**
- `<name>` - Sprint identifier (alphanumeric, hyphens allowed)
- `--ralph` - Create Ralph mode sprint (recommended)
- `--workflow <name>` - Create workflow mode sprint with specified workflow

**Examples:**
```bash
/start-sprint auth-feature --ralph
# Creates Ralph mode sprint

/start-sprint bug-batch --workflow bugfix-workflow
# Creates workflow mode sprint
```

#### `/run-sprint <directory> [options]`

Compile and start autonomous phase processing.

**Arguments:**
- `<directory>` - Path to sprint directory (required)
- `--max-iterations N` - Override iteration limit (default: unlimited)
- `--dry-run` - Preview compiled workflow without executing
- `--recompile` - Force recompilation even if PROGRESS.yaml exists

**Examples:**
```bash
# Compile and start sprint execution
/run-sprint .claude/sprints/2026-01-16_auth --max-iterations 50

# Preview compiled workflow without running
/run-sprint .claude/sprints/2026-01-16_auth --dry-run

# Force recompilation after adding steps
/run-sprint .claude/sprints/2026-01-16_auth --recompile
```

#### `/sprint-status`

Display hierarchical progress dashboard showing:
- Current phase/step/sub-phase position
- Completion status at each level
- Progress statistics
- Actionable next steps

#### `/pause-sprint`

Request graceful pause. Current phase completes, then sprint pauses.

#### `/resume-sprint`

Resume a paused sprint. Clears pause flag, continues from current position.

#### `/stop-sprint`

Force immediate stop. Sets status to paused, causing the background loop to exit.

### Step Management

#### `/add-step <prompt>`

Add a step to the current sprint's SPRINT.yaml.

**Example:**
```bash
/add-step "Implement password reset functionality with email verification"
# Adds step to SPRINT.yaml - recompilation happens on /run-sprint
```

#### `/import-steps issues --label <label>`

Bulk import GitHub issues as steps.

**Arguments:**
- `--label` - GitHub label to filter by

**Example:**
```bash
/import-steps issues --label "sprint-1"
# Creates steps from matching GitHub issues
```

#### `/import-steps file <path.yaml>`

Import steps from a YAML file.

**Arguments:**
- `<path.yaml>` - Path to YAML file with steps array

**Example:**
```bash
/import-steps file sprint-steps.yaml
```

---

## Workflow System

### SPRINT.yaml Format

The sprint definition file specifies which workflow to use and what steps to process:

```yaml
# SPRINT.yaml - Workflow-based Sprint Definition
workflow: sprint-default    # Reference to .claude/workflows/sprint-default.yaml

steps:
  - prompt: |
      Implement user authentication with JWT.
      Requirements:
      - Login endpoint
      - Token refresh
      - Logout

  - prompt: |
      Add session management and remember-me functionality.

  - prompt: |
      Fix: Password reset emails not sending.
    workflow: bugfix-workflow  # Optional: use different workflow for this step

# Sprint metadata
sprint-id: 2026-01-16_auth-feature
name: auth-feature
created: 2026-01-16T10:30:00Z
```

### Workflow Templates

Workflows are reusable templates stored in `.claude/workflows/`. They define the phases each step goes through.

#### sprint-default.yaml

The standard sprint workflow with four top-level phases:

```yaml
name: Standard Sprint
description: Complete sprint with prepare, development, QA, and deploy phases.

phases:
  - id: prepare
    prompt: |
      Prepare the sprint: create branch, gather context, check dependencies.

  - id: development
    for-each: step           # Iterates over all steps from SPRINT.yaml
    workflow: feature-standard   # Each step uses this workflow

  - id: qa
    prompt: |
      Run full test suite, linting, and security checks.

  - id: deploy
    prompt: |
      Create PR and finalize the sprint.
```

#### feature-standard.yaml

Workflow for individual feature/step implementation:

```yaml
name: Standard Feature Development
description: Planning, implementation, testing, and documentation for each step.

phases:
  - id: planning
    prompt: |
      Analyze the step and create implementation plan.
      {{step.prompt}}

  - id: implement
    prompt: |
      Implement based on the plan.
      {{step.prompt}}

  - id: test
    prompt: |
      Write and run tests for the implementation.
      {{step.prompt}}

  - id: document
    prompt: |
      Update documentation if needed.
      {{step.prompt}}
```

#### bugfix-workflow.yaml

Streamlined workflow for bug fixes:

```yaml
name: Bugfix Workflow
description: Diagnose, fix, and verify bugs with minimal overhead.

phases:
  - id: diagnose
    prompt: |
      Diagnose the bug and find root cause.
      {{step.prompt}}

  - id: fix
    prompt: |
      Implement minimal fix.
      {{step.prompt}}

  - id: verify
    prompt: |
      Verify the bug is fixed and add regression test.
      {{step.prompt}}
```

### Compilation Process

When you run `/run-sprint`, the compiler:

1. Reads SPRINT.yaml (steps + workflow reference)
2. Loads the workflow template from `.claude/workflows/`
3. Expands `for-each: step` phases by iterating over all steps
4. Substitutes template variables (`{{step.prompt}}`, `{{step.id}}`, etc.)
5. Generates PROGRESS.yaml with full hierarchical structure

**Example expansion:**

SPRINT.yaml with 2 steps + sprint-default workflow becomes:

```
phases:
  - prepare (single phase)
  - development (for-each)
      - step-0
          - planning
          - implement
          - test
          - document
      - step-1
          - planning
          - implement
          - test
          - document
  - qa (single phase)
  - deploy (single phase)
```

Total phases to execute: 1 + (2 x 4) + 1 + 1 = 11 phases

### Template Variables

Workflows can use these variables in prompts:

| Variable | Description |
|----------|-------------|
| `{{step.prompt}}` | The step's prompt from SPRINT.yaml |
| `{{step.id}}` | Auto-generated step ID (e.g., `step-0`) |
| `{{step.index}}` | Step index (0-based) |
| `{{sprint.id}}` | Sprint identifier |
| `{{sprint.name}}` | Sprint name |

---

## Workflow Patterns

### Pattern 1: Feature Development Sprint

```bash
# 1. Create sprint
/start-sprint user-auth

# 2. Add feature steps
/add-step "Implement login endpoint with JWT tokens"
/add-step "Add logout endpoint and token invalidation"
/add-step "Create password reset flow with email verification"

# 3. Preview the compiled workflow
/run-sprint .claude/sprints/2026-01-16_user-auth --dry-run

# 4. Execute with generous limit
/run-sprint .claude/sprints/2026-01-16_user-auth --max-iterations 50
```

Each step goes through: planning -> implement -> test -> document

### Pattern 2: Bug Fix Sprint

```bash
# 1. Create bug sprint
/start-sprint bugfix-batch

# 2. Import bugs from GitHub
/import-steps issues --label "bug"

# 3. Edit SPRINT.yaml to use bugfix workflow
# (Optional: steps can override with workflow: bugfix-workflow)

# 4. Run - bugs use diagnose -> fix -> verify phases
/run-sprint .claude/sprints/2026-01-16_bugfix-batch --max-iterations 30
```

### Pattern 3: Mixed Sprint with Workflow Overrides

```bash
# 1. Create sprint
/start-sprint mixed-work

# 2. Add steps with different workflows
```

Then edit SPRINT.yaml:

```yaml
workflow: sprint-default

steps:
  - prompt: |
      Add new dashboard feature with charts and filters.
    # Uses default feature-standard workflow

  - prompt: |
      Fix: Charts not rendering on mobile devices.
    workflow: bugfix-workflow    # Override for this step only

  - prompt: |
      Implement data export functionality.
    # Uses default feature-standard workflow
```

### Pattern 4: Custom Workflow Sprint

Create a custom workflow in `.claude/workflows/custom-workflow.yaml`:

```yaml
name: Custom Review Workflow
description: Implementation with mandatory code review phase.

phases:
  - id: implement
    prompt: |
      Implement the feature.
      {{step.prompt}}

  - id: self-review
    prompt: |
      Review your own code for issues, edge cases, and improvements.
      {{step.prompt}}

  - id: test
    prompt: |
      Write comprehensive tests.
      {{step.prompt}}
```

Then use it in SPRINT.yaml:

```yaml
workflow: custom-workflow
steps:
  - prompt: "Implement feature X"
```

---

## Configuration

### SPRINT.yaml

```yaml
# Workflow-based Sprint Definition
workflow: sprint-default

steps:
  - prompt: |
      Implement user authentication.
  - prompt: |
      Add session management.

# Sprint metadata
sprint-id: 2026-01-16_feature-auth
name: feature-auth
created: 2026-01-16T10:30:00Z
owner: claude

# Optional configuration
config:
  max-tasks: 10        # Maximum phases
  time-box: 4h         # Sprint duration limit
  auto-commit: true    # Commit after each phase
```

### PROGRESS.yaml (Compiled Output)

```yaml
# Compiled Progress - Generated by /run-sprint
sprint-id: 2026-01-16_feature-auth
status: in-progress

phases:
  - id: prepare
    status: completed
    prompt: "Prepare the sprint..."
    started-at: 2026-01-16T10:30:00Z
    completed-at: 2026-01-16T10:35:00Z
    elapsed: 5m

  - id: development
    status: in-progress
    steps:
      - id: step-0
        prompt: "Implement user authentication..."
        status: in-progress
        phases:
          - id: planning
            status: completed
            prompt: "Analyze the step..."
          - id: implement
            status: in-progress
            prompt: "Implement based on plan..."
          - id: test
            status: pending
            prompt: "Write and run tests..."
          - id: document
            status: pending
            prompt: "Update documentation..."

      - id: step-1
        prompt: "Add session management..."
        status: pending
        phases:
          - id: planning
            status: pending
          - id: implement
            status: pending
          - id: test
            status: pending
          - id: document
            status: pending

  - id: qa
    status: pending
    prompt: "Run full test suite..."

  - id: deploy
    status: pending
    prompt: "Create PR..."

current:
  phase: 1
  step: 0
  sub-phase: 1

stats:
  started-at: 2026-01-16T10:30:00Z
  total-phases: 11
  completed-phases: 2
  total-steps: 2
  completed-steps: 0
```

---

## Troubleshooting

### Compilation fails

**Symptom:** `/run-sprint` fails during compilation

**Check:**
1. SPRINT.yaml has valid YAML syntax
2. `workflow:` references an existing file in `.claude/workflows/`
3. `steps:` is a valid array with `prompt:` entries
4. Node.js is available (compiler is TypeScript)

**Fix:**
```bash
# Validate SPRINT.yaml syntax
cat .claude/sprints/my-sprint/SPRINT.yaml

# Check workflow exists
ls .claude/workflows/

# Verify node is available
node --version
```

### Workflow not found

**Symptom:** "Workflow not found: xyz-workflow"

**Check:**
1. Workflow file exists: `.claude/workflows/xyz-workflow.yaml`
2. Workflow name in SPRINT.yaml matches filename (without .yaml)

**Fix:**
```bash
# List available workflows
ls .claude/workflows/

# Use correct workflow name in SPRINT.yaml
# workflow: sprint-default  (for sprint-default.yaml)
```

### Recompilation needed after adding steps

**Symptom:** New steps not appearing in execution

**Cause:** PROGRESS.yaml was already compiled before steps were added

**Fix:**
```bash
# Force recompilation
/run-sprint .claude/sprints/my-sprint --recompile
```

### Sprint stuck on phase

**Symptom:** Same phase keeps repeating

**Check:**
1. Phase status is being updated in PROGRESS.yaml
2. `current` pointer is advancing correctly
3. No infinite loops in phase logic

**Fix:**
```bash
# Check current state
/sprint-status

# Force stop and investigate
/stop-sprint

# Review PROGRESS.yaml current pointer
```

### Permission prompts appearing

**Symptom:** Bash commands require approval

**Check:**
1. Commands using simple patterns
2. `allowed-tools` in skill/command frontmatter is correct

**Fix:**
Update to latest plugin version which uses Read tool instead of bash `cat`.

### Can't find sprint

**Symptom:** Commands say "NO_SPRINT"

**Check:**
1. Sprint directory exists in `.claude/sprints/`
2. Directory has correct naming pattern
3. SPRINT.yaml exists in directory

**Fix:**
```bash
# List sprints
ls -la .claude/sprints/

# Create new sprint if missing
/start-sprint my-sprint
```

### Background loop not running

**Symptom:** Sprint started but no progress

**Check:**
1. Use `/tasks` to see if background task is running
2. Check PROGRESS.yaml status field

**Fix:**
```bash
# Stop any stale state
/stop-sprint

# Check PROGRESS.yaml is valid
cat .claude/sprints/my-sprint/PROGRESS.yaml

# Restart sprint
/run-sprint .claude/sprints/my-sprint
```

### Ralph Mode: Loop never exits

**Symptom:** Ralph mode keeps running indefinitely

**Check:**
1. Goal might be too vague - add measurable success criteria
2. `min-iterations` threshold might not be reached yet

**Fix:**
```bash
# Check current iteration count vs min-iterations
/sprint-status

# Make goal more specific with clear completion criteria
# Edit SPRINT.yaml goal to include "Success criteria:"
```

### Ralph Mode: goal-complete ignored

**Symptom:** Claude reports goal-complete but sprint continues

**Cause:** `ralph.min-iterations` threshold not reached

**Fix:**
Either wait for threshold or adjust in SPRINT.yaml:
```yaml
ralph:
  min-iterations: 10    # Reduce if appropriate
```

### Ralph Mode: JSON result not parsed

**Symptom:** "No JSON result found" in sprint output

**Cause:** Claude's JSON result wasn't in proper code block format

**Fix:**
This is usually transient. The loop will retry. If persistent, check that the sprint prompt template includes JSON format instructions.

---

## Activity Logging & Hooks

The sprint system includes automatic activity logging that captures tool usage during execution, providing visibility into what Claude is doing in real-time.

### How Activity Logging Works

When you run `/run-sprint`, the system automatically:
1. Generates a `.sprint-hooks.json` configuration file in the sprint directory
2. Configures a PostToolCall hook that triggers after each tool invocation
3. Logs activity events to `.sprint-activity.jsonl` in the sprint directory
4. Streams events to the status page for live display
5. Cleans up the hook config file when the sprint completes or stops

### Hook Configuration

The auto-generated `.sprint-hooks.json` uses this format:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash /path/to/plugin/hooks/sprint-activity-hook.sh /path/to/sprint"
          }
        ]
      }
    ]
  }
}
```

This configuration:
- Matches all tool calls (empty matcher string)
- Triggers the `sprint-activity-hook.sh` script after each tool use
- Passes the sprint directory as an argument

### Verbosity Levels

Control the detail level of activity logging via the `SPRINT_ACTIVITY_VERBOSITY` environment variable:

| Level | Description |
|-------|-------------|
| `minimal` | Tool names only (e.g., "Read", "Bash") |
| `basic` | Tool names + file paths (default) |
| `detailed` | Full input summaries |
| `verbose` | Complete tool data |

Example:
```bash
export SPRINT_ACTIVITY_VERBOSITY=detailed
/run-sprint .claude/sprints/my-sprint
```

If not set, defaults to "basic".

### Activity Log Format

Events are stored in JSONL format (one JSON object per line) in `.sprint-activity.jsonl`:

```jsonl
{"timestamp":"2026-01-16T10:30:00.123Z","tool":"Read","summary":"file: src/index.ts","level":"basic"}
{"timestamp":"2026-01-16T10:30:01.456Z","tool":"Edit","summary":"file: src/index.ts","level":"basic"}
```

### Live Activity Panel

The status page (`http://localhost:3100`) includes a live activity panel that:
- Displays real-time tool activity as it happens
- Shows activity filtered by your selected verbosity level
- Auto-scrolls to latest activity
- Provides visual icons for different tool types

### Manual Hook Configuration

You can also run sprints without automatic activity logging by using the `--no-status` flag. If you want custom hook behavior, create your own `.sprint-hooks.json` before running the sprint.

---

## Best Practices

### Ralph Mode

1. **Write clear goals**: Include requirements, constraints, and measurable success criteria
2. **Enable learning hooks**: Compounds knowledge across iterations
3. **Set min-iterations appropriately**: Ensures deep work (15-30 is typical)
4. **Add context files**: Put relevant docs in `context/` directory
5. **Trust Ralph's judgment**: The system is designed for autonomous operation
6. **Review at milestones**: Check `/sprint-status` periodically, not constantly

### Workflow Mode

1. **Keep sprints focused**: 3-7 steps per sprint
2. **Write clear step prompts**: Include requirements and acceptance criteria
3. **Use appropriate workflows**: Match workflow to work type
4. **Preview before running**: Use `--dry-run` to verify compilation
5. **Recompile after changes**: Use `--recompile` after adding steps
6. **Use workflow overrides**: Mix workflows within a sprint when needed

### General

1. **Monitor with `/sprint-watch`**: Real-time dashboard is better than polling
2. **Trust the loop**: Default unlimited iterations - loop exits on completion or error status
3. **One sprint at a time**: (Worktree support for parallel sprints coming soon)

---

## Getting Help

- `/help` - Show plugin commands and usage
- [Ralph Mode Concepts](concepts/ralph-mode.md) - Deep dive into autonomous mode
- [Troubleshooting Guide](troubleshooting/common-issues.md) - Common issues and solutions
- GitHub Issues: Report bugs and request features
