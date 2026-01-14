---
allowed-tools: Bash(mkdir:*), Bash(date:*), Write(*), Read(*)
argument-hint: <sprint-name>
description: Initialize new sprint directory structure
model: sonnet
---

# Start Sprint Command

Initialize a new sprint directory with required YAML configuration files.

## Preflight Checks

Before proceeding, verify the following:

1. **Sprint name argument provided**: The user must provide a sprint name as argument `$ARGUMENTS`
   - If empty, prompt: "Please provide a sprint name, e.g., `/start-sprint feature-auth`"

2. **Sprints directory exists**: Check `.claude/sprints/` directory exists
   - If not, create it: `mkdir -p .claude/sprints/`

3. **Sprint does not already exist**: Check if sprint directory already exists
   - Pattern: `.claude/sprints/*_$ARGUMENTS/`
   - If exists, abort with message: "Sprint '$ARGUMENTS' already exists at [path]"

## Context Gathering

1. Get current date in ISO format for sprint naming:
   ```bash
   date +%Y-%m-%d
   ```

2. Reference templates from orchestrating-sprints skill:
   - Sprint template: `.claude/skills/orchestrating-sprints/assets/sprint-template.yaml`
   - Progress template: `.claude/skills/orchestrating-sprints/assets/progress-template.yaml`

## Task Instructions

### Step 1: Create Sprint Directory Structure

Create the sprint directory with the naming convention `YYYY-MM-DD_<sprint-name>`:

```
.claude/sprints/YYYY-MM-DD_<sprint-name>/
  - SPRINT.yaml
  - PROGRESS.yaml
  - context/
  - artifacts/
```

### Step 2: Create SPRINT.yaml

Generate SPRINT.yaml with populated values:

```yaml
# SPRINT.yaml - Sprint Configuration
sprint-id: YYYY-MM-DD_<sprint-name>
name: <sprint-name>
created: <current-iso-timestamp>
owner: claude

config:
  max-tasks: 10
  time-box: 4h
  auto-commit: true
  context-cache: true
  parallel: false

github:
  repo: null
  milestone: null
  labels: []

goals:
  - Define sprint objectives here

notes: |
  Sprint initialized. Add tasks using ralph-loop or manual queue editing.
```

### Step 3: Create PROGRESS.yaml

Generate PROGRESS.yaml with initial state:

```yaml
# PROGRESS.yaml - Sprint Progress Tracking
sprint-id: YYYY-MM-DD_<sprint-name>
status: not-started
current-task: null

queue: []

completed: []

blocked: []

stats:
  started-at: null
  completed-at: null
  tasks-total: 0
  tasks-completed: 0
  tasks-blocked: 0
  elapsed: null
  avg-task-time: null
```

### Step 4: Create Subdirectories

Create the following subdirectories:
- `context/` - For sprint context files and research
- `artifacts/` - For sprint outputs and deliverables

### Step 5: Output Success Message

After successful creation, display:

```
Sprint initialized successfully!

Location: .claude/sprints/YYYY-MM-DD_<sprint-name>/

Created files:
  - SPRINT.yaml (configuration)
  - PROGRESS.yaml (progress tracking)
  - context/ (context files)
  - artifacts/ (output files)

Next steps:
  1. Edit SPRINT.yaml to define sprint goals
  2. Add tasks to the queue:
     - Use `/ralph-loop` to start task processing
     - Or manually edit PROGRESS.yaml queue
  3. Run `/ralph-loop` to begin sprint execution
```

## Success Criteria

- Directory `.claude/sprints/YYYY-MM-DD_<sprint-name>/` exists
- `SPRINT.yaml` contains valid YAML with correct sprint-id
- `PROGRESS.yaml` contains valid YAML with status "not-started"
- `context/` and `artifacts/` subdirectories exist
- User receives clear next-steps guidance
