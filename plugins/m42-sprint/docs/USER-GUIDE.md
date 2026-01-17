# M42 Sprint Plugin - User Guide

Complete guide to workflow-based sprint processing for Claude Code.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Commands Reference](#commands-reference)
5. [Workflow System](#workflow-system)
6. [Workflow Patterns](#workflow-patterns)
7. [Configuration](#configuration)
8. [Troubleshooting](#troubleshooting)
9. [Migration from Task-Queue](#migration-from-task-queue)

---

## Overview

M42 Sprint is a Claude Code plugin that enables workflow-based sprint processing. Steps are defined in SPRINT.yaml, compiled into hierarchical phases, and executed with fresh context per phase using the Ralph Loop pattern.

### Key Concepts

- **Sprint**: A container for related steps with shared workflow configuration
- **Step**: A high-level work item defined by a prompt in SPRINT.yaml
- **Workflow**: A reusable template that defines phases for processing steps
- **Compilation**: Expands steps through workflows into hierarchical phases in PROGRESS.yaml
- **Ralph Loop**: Fresh Claude context per phase (no context accumulation)

### How It Works

```
SPRINT.yaml (steps) + Workflow Templates → Compilation → PROGRESS.yaml (phases)
                                                              ↓
                                                        Sprint Loop
                                                              ↓
                                                   Fresh context per phase
```

### When to Use Sprint

| Good For | Not Good For |
|----------|--------------|
| Multi-step feature development | Single quick tasks |
| Autonomous batch operations | Tasks needing human decisions |
| Structured workflows with phases | Unclear requirements |
| Consistent development process | Exploratory research |

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

### 1. Create a Sprint

```bash
/start-sprint auth-feature
```

Creates:
```
.claude/sprints/2026-01-16_auth-feature/
  SPRINT.yaml       # Workflow definition with steps
  context/          # Context files for phases
  artifacts/        # Sprint outputs
```

### 2. Add Steps

```bash
# Add individual steps
/add-step "Implement user login endpoint with JWT authentication"
/add-step "Add authentication middleware for protected routes"

# Or import from GitHub issues
/import-steps issues --label "sprint-ready"
```

### 3. Run the Sprint (Compiles and Executes)

```bash
/run-sprint .claude/sprints/2026-01-16_auth-feature
```

This:
1. Compiles SPRINT.yaml + workflows into PROGRESS.yaml
2. Launches the sprint loop in the background
3. Processes each phase with fresh context

### 4. Monitor Progress

```bash
/sprint-status
```

### 5. Control Execution

```bash
/pause-sprint    # Graceful pause after current phase
/resume-sprint   # Resume paused sprint
/stop-sprint     # Immediate stop
```

---

## Commands Reference

### Sprint Lifecycle

#### `/start-sprint <name>`

Initialize a new sprint directory.

**Arguments:**
- `<name>` - Sprint identifier (alphanumeric, hyphens allowed)

**Example:**
```bash
/start-sprint auth-improvements
# Creates: .claude/sprints/2026-01-16_auth-improvements/
```

#### `/run-sprint <directory> [options]`

Compile and start autonomous phase processing.

**Arguments:**
- `<directory>` - Path to sprint directory (required)
- `--max-iterations N` - Safety limit (default: 60)
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

---

## Migration from Task-Queue

If you used the old task-queue system, here's what changed:

### Old System (Task-Queue)

- Tasks had types: `implement-issue`, `refactor`, `update-docs`, `custom`
- Task definitions went directly in PROGRESS.yaml queue array
- No workflows - each task type had built-in behavior
- Commands: `/add-task`, `/import-tasks`

### New System (Workflow-Based)

- Steps are simple prompts in SPRINT.yaml
- Workflows define phases each step goes through
- PROGRESS.yaml is compiled from SPRINT.yaml + workflows
- Commands: `/add-step`, `/import-steps`

### Migration Steps

1. **Create new sprint:**
   ```bash
   /start-sprint migrated-sprint
   ```

2. **Convert tasks to steps in SPRINT.yaml:**

   Old task:
   ```yaml
   - id: implement-issue-42
     type: implement-issue
     issue-number: 42
   ```

   New step:
   ```yaml
   - prompt: |
       Implement GitHub issue #42
       [paste issue title and body here]
   ```

3. **Choose appropriate workflow:**
   - `sprint-default` for general development
   - `bugfix-workflow` for bug fixes
   - Create custom workflows as needed

4. **Run with compilation:**
   ```bash
   /run-sprint .claude/sprints/YYYY-MM-DD_migrated-sprint
   ```

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

1. **Keep sprints focused**: 3-7 steps per sprint
2. **Write clear step prompts**: Include requirements and acceptance criteria
3. **Use appropriate workflows**: Match workflow to work type
4. **Preview before running**: Use `--dry-run` to verify compilation
5. **Monitor progress**: Check `/sprint-status` periodically
6. **Set iteration limits**: Always use `--max-iterations` as safety
7. **Use workflow overrides**: Mix workflows within a sprint when needed
8. **Recompile after changes**: Use `--recompile` after adding steps

---

## Getting Help

- `/help` - Show plugin commands and usage
- GitHub Issues: Report bugs and request features
- README.md: Technical reference and architecture
