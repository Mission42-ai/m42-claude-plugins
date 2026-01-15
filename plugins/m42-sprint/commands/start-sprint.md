---
allowed-tools: Bash(mkdir:*), Bash(date:*), Write(*), Read(*)
argument-hint: <sprint-name>
description: Initialize new sprint directory structure
model: sonnet
---

# Start Sprint Command

Initialize a new sprint directory with workflow-based configuration.

## Preflight Checks

Before proceeding, verify the following:

1. **Sprint name argument provided**: The user must provide a sprint name as argument `$ARGUMENTS`
   - If empty, prompt: "Please provide a sprint name, e.g., `/start-sprint feature-auth`"

2. **Sprints directory exists**: Check `.claude/sprints/` directory exists
   - If not, create it: `mkdir -p .claude/sprints/`

3. **Workflows directory exists**: Check `.claude/workflows/` directory exists
   - If not, warn user: "No workflows found. Create workflows in .claude/workflows/ first."

4. **Sprint does not already exist**: Check if sprint directory already exists
   - Pattern: `.claude/sprints/*_$ARGUMENTS/`
   - If exists, abort with message: "Sprint '$ARGUMENTS' already exists at [path]"

## Context Gathering

1. Get current date in ISO format for sprint naming:
   ```bash
   date +%Y-%m-%d
   ```

2. List available workflows:
   ```bash
   ls .claude/workflows/*.yaml 2>/dev/null || echo "No workflows found"
   ```

## Task Instructions

### Step 1: Create Sprint Directory Structure

Create the sprint directory with the naming convention `YYYY-MM-DD_<sprint-name>`:

```
.claude/sprints/YYYY-MM-DD_<sprint-name>/
  - SPRINT.yaml
  - context/
  - artifacts/
```

Note: PROGRESS.yaml is NOT created here - it will be compiled from SPRINT.yaml when running `/run-sprint`.

### Step 2: Create SPRINT.yaml

Generate SPRINT.yaml with the workflow-based format:

```yaml
# SPRINT.yaml - Workflow-based Sprint Definition
# This file is compiled into PROGRESS.yaml by /run-sprint

workflow: sprint-default    # Reference to .claude/workflows/sprint-default.yaml

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

# Sprint metadata (optional)
sprint-id: YYYY-MM-DD_<sprint-name>
name: <sprint-name>
created: <current-iso-timestamp>
```

Replace placeholders with actual values:
- `YYYY-MM-DD` → current date
- `<sprint-name>` → provided sprint name
- `<current-iso-timestamp>` → current ISO timestamp

### Step 3: Create Subdirectories

Create the following subdirectories:
- `context/` - For sprint context files and cached research
- `artifacts/` - For sprint outputs and deliverables

### Step 4: Output Success Message

After successful creation, display:

```
Sprint initialized successfully!

Location: .claude/sprints/YYYY-MM-DD_<sprint-name>/

Created files:
  - SPRINT.yaml (workflow definition)
  - context/ (context files)
  - artifacts/ (output files)

Available workflows:
  - sprint-default (standard sprint with prepare/dev/qa/deploy)
  - feature-standard (planning/implement/test/document per step)
  - bugfix-workflow (diagnose/fix/verify)

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
- `SPRINT.yaml` contains valid YAML with `workflow:` and `steps:` keys
- `context/` and `artifacts/` subdirectories exist
- User receives clear guidance on adding steps and running the sprint
