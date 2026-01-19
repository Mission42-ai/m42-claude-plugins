---
allowed-tools: Bash(mkdir:*), Bash(date:*), Write(*), Read(*)
argument-hint: <sprint-name> [--ralph | --workflow <name>]
description: Initialize new sprint directory structure
model: sonnet
---

# Start Sprint Command

Initialize a new sprint directory with either **Ralph mode** (autonomous goal-driven) or **workflow-based** configuration.

## Sprint Modes

**Ralph Mode** (`--ralph` or default when goal is complex):
- Goal-driven autonomous execution
- Ralph thinks deeply and shapes work dynamically
- Patterns ensure consistent quality execution
- Best for: complex features, research-heavy work, open-ended goals

**Workflow Mode** (`--workflow <name>`):
- Predefined workflow phases
- Deterministic step-by-step execution
- Best for: well-defined tasks, routine work, batched operations

## Preflight Checks

Before proceeding, verify the following:

1. **Sprint name argument provided**: The user must provide a sprint name as argument `$ARGUMENTS`
   - If empty, prompt: "Please provide a sprint name, e.g., `/start-sprint feature-auth` or `/start-sprint my-feature --ralph`"

2. **Sprints directory exists**: Check `.claude/sprints/` directory exists
   - If not, create it: `mkdir -p .claude/sprints/`

3. **For workflow mode**: Check `.claude/workflows/` directory exists
   - If not and `--ralph` not specified, warn: "No workflows found. Use `--ralph` for autonomous mode or create workflows."

4. **Sprint does not already exist**: Check if sprint directory already exists
   - Pattern: `.claude/sprints/*_$ARGUMENTS/`
   - If exists, abort with message: "Sprint '$ARGUMENTS' already exists at [path]"

## Argument Parsing

Parse `$ARGUMENTS` to extract:
- **Sprint name**: First positional argument (required)
- **Mode flag**: `--ralph` for Ralph mode, `--workflow <name>` for workflow mode
- If neither specified, ask user to choose mode

## Context Gathering

1. Get current date in ISO format for sprint naming:
   ```bash
   date +%Y-%m-%d
   ```

2. List available workflows (for workflow mode):
   ```bash
   ls .claude/workflows/*.yaml 2>/dev/null || echo "No workflows found"
   ```

## Task Instructions

### Step 1: Create Sprint Directory Structure

Create the sprint directory with the naming convention `YYYY-MM-DD_<sprint-name>`:

```
.claude/sprints/YYYY-MM-DD_<sprint-name>/
  - SPRINT.yaml
  - context/       (for research, notes, cached context)
  - artifacts/     (for outputs, deliverables)
  - patterns/      (optional: sprint-specific patterns)
```

Note: PROGRESS.yaml is NOT created here - it will be compiled from SPRINT.yaml when running `/run-sprint`.

### Step 2: Create SPRINT.yaml (Mode-Dependent)

#### For Ralph Mode (`--ralph`):

```yaml
# SPRINT.yaml - Ralph Mode (Autonomous Goal-Driven)
# Ralph thinks deeply and shapes work dynamically

workflow: ralph

goal: |
  <USER TO FILL IN>

  Describe your goal here. Be specific about:
  - What you want to achieve
  - Any constraints or requirements
  - Success criteria

  Ralph will think deeply about this goal, shape the work dynamically,
  and use patterns for consistent quality execution.

# Per-iteration hooks (optional but recommended)
per-iteration-hooks:
  learning:
    enabled: true  # Extract learnings after each iteration

# Sprint metadata
sprint-id: YYYY-MM-DD_<sprint-name>
name: <sprint-name>
created: <current-iso-timestamp>
```

#### For Workflow Mode (`--workflow <name>`):

```yaml
# SPRINT.yaml - Workflow-based Sprint Definition
# This file is compiled into PROGRESS.yaml by /run-sprint

workflow: <workflow-name>    # Reference to .claude/workflows/<workflow-name>.yaml

steps:
  # Add your steps here. Each step will be processed through the workflow.
  # Example:
  # - prompt: |
  #     Implement user authentication with JWT.
  #     Requirements:
  #     - Login endpoint
  #     - Token refresh
  #     - Logout
  #
  # - prompt: |
  #     Fix: Password reset emails not sending.
  #   workflow: bugfix-workflow  # Optional: use different workflow for this step

# Sprint metadata
sprint-id: YYYY-MM-DD_<sprint-name>
name: <sprint-name>
created: <current-iso-timestamp>
```

Replace placeholders with actual values:
- `YYYY-MM-DD` → current date
- `<sprint-name>` → provided sprint name
- `<workflow-name>` → specified workflow or `sprint-default`
- `<current-iso-timestamp>` → current ISO timestamp

### Step 3: Create Subdirectories

Create the following subdirectories:
- `context/` - For sprint context files, research notes, cached context
- `artifacts/` - For sprint outputs and deliverables
- `patterns/` - (Optional) For sprint-specific execution patterns

### Step 4: Output Success Message

#### For Ralph Mode:

```
Sprint initialized (Ralph Mode)!

Location: .claude/sprints/YYYY-MM-DD_<sprint-name>/

Created files:
  - SPRINT.yaml (Ralph mode configuration)
  - context/ (for research, notes, cached context)
  - artifacts/ (for outputs)

Ralph Mode Features:
  - Autonomous goal-driven execution
  - Deep thinking with dynamic task shaping
  - Pattern-based execution for quality consistency
  - Per-iteration learning extraction (if enabled)

Next steps:
  1. Edit SPRINT.yaml to define your goal:
     ```yaml
     goal: |
       Describe what you want to achieve.
       Be specific about requirements and success criteria.
     ```
  2. (Optional) Add context files to context/ directory
  3. Run `/run-sprint .claude/sprints/YYYY-MM-DD_<sprint-name>`

Available patterns for Ralph to invoke:
  - implement-feature (TDD implementation)
  - fix-bug (debug and fix with regression test)
  - refactor (safe refactoring with test preservation)
  - document (documentation updates)
```

#### For Workflow Mode:

```
Sprint initialized (Workflow Mode)!

Location: .claude/sprints/YYYY-MM-DD_<sprint-name>/

Created files:
  - SPRINT.yaml (workflow definition)
  - context/ (context files)
  - artifacts/ (output files)

Available workflows:
  - sprint-default (standard sprint with prepare/dev/qa/deploy)
  - feature-standard (planning/implement/test/document per step)
  - bugfix-workflow (diagnose/fix/verify)
  - ralph (autonomous goal-driven - consider /start-sprint --ralph instead)

Next steps:
  1. Edit SPRINT.yaml to add your steps:
     ```yaml
     steps:
       - prompt: |
           Your first task description here.
       - prompt: |
           Your second task description here.
     ```
  2. Run `/run-sprint .claude/sprints/YYYY-MM-DD_<sprint-name>` to compile and execute
  3. Use `--dry-run` first to preview the workflow
```

## Success Criteria

- Directory `.claude/sprints/YYYY-MM-DD_<sprint-name>/` exists
- `SPRINT.yaml` contains valid YAML appropriate for chosen mode:
  - Ralph mode: has `workflow: ralph` and `goal:` keys
  - Workflow mode: has `workflow:` and `steps:` keys
- `context/` and `artifacts/` subdirectories exist
- User receives mode-appropriate guidance for next steps
