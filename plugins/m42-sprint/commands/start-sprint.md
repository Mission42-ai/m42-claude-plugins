---
allowed-tools: Bash(mkdir:*), Bash(date:*), Bash(git:*), Write(*), Read(*)
argument-hint: <sprint-name> [--ralph | --workflow <name>] [--worktree]
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

## Worktree Mode (Optional)

When `--worktree` flag is provided or the selected workflow has `worktree.enabled: true`:
- Creates a dedicated git branch for the sprint
- Creates a git worktree for isolated development
- Sprint files are created in the new worktree
- Enables parallel sprint execution without branch conflicts

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

5. **For worktree mode**: Check git repository status
   - Must be in a git repository: `git rev-parse --git-dir`
   - Get current branch for reference: `git rev-parse --abbrev-ref HEAD`
   - Get repo root: `git rev-parse --show-toplevel`

## Argument Parsing

Parse `$ARGUMENTS` to extract:
- **Sprint name**: First positional argument (required)
- **Mode flag**: `--ralph` for Ralph mode, `--workflow <name>` for workflow mode
- **Worktree flag**: `--worktree` to enable worktree isolation
- **Reuse branch flag**: `--reuse-branch` to use existing branch if it exists
- If neither mode specified, ask user to choose mode

## Context Gathering

1. Get current date in ISO format for sprint naming:
   ```bash
   date +%Y-%m-%d
   ```

2. List available workflows (for workflow mode):
   ```bash
   ls .claude/workflows/*.yaml 2>/dev/null || echo "No workflows found"
   ```

3. For worktree mode, gather git info:
   ```bash
   git rev-parse --show-toplevel  # Get repo root
   git rev-parse --abbrev-ref HEAD  # Get current branch (for base)
   ```

## Task Instructions

### Step 1: Handle Worktree Creation (if enabled)

If `--worktree` flag is provided, create dedicated branch and worktree BEFORE creating sprint files:

#### 1a. Resolve Worktree Configuration

Use the worktree configuration from SPRINT.yaml or defaults:
- **Branch name**: Default is `sprint/{sprint-id}`, supports variables:
  - `{sprint-id}` → e.g., "2026-01-20_feature-auth"
  - `{sprint-name}` → e.g., "feature-auth"
  - `{date}` → e.g., "2026-01-20"
  - `{workflow}` → e.g., "ralph" or "feature-standard"
- **Worktree path**: Default is `../{sprint-id}-worktree` (relative to repo root)

#### 1b. Check Branch Status

```bash
# Check if branch already exists
git rev-parse --verify refs/heads/sprint/YYYY-MM-DD_<sprint-name> 2>/dev/null
```

If branch exists:
- Without `--reuse-branch`: Show error and offer options:
  ```
  Branch 'sprint/YYYY-MM-DD_<sprint-name>' already exists.

  Options:
  1. Use --reuse-branch to checkout the existing branch
  2. Choose a different sprint name
  3. Delete the branch: git branch -d sprint/YYYY-MM-DD_<sprint-name>
  ```
- With `--reuse-branch`: Continue using existing branch

#### 1c. Check Worktree Path

```bash
# Check if worktree path already exists
ls -d ../YYYY-MM-DD_<sprint-name>-worktree 2>/dev/null
```

If path exists, fail with clear message:
```
Directory already exists: /path/to/YYYY-MM-DD_<sprint-name>-worktree

Choose a different worktree path or remove the existing directory.
```

#### 1d. Create Branch

```bash
# Create new branch from current HEAD
git branch sprint/YYYY-MM-DD_<sprint-name>
```

#### 1e. Create Worktree

```bash
# Create worktree at specified path
git worktree add ../YYYY-MM-DD_<sprint-name>-worktree sprint/YYYY-MM-DD_<sprint-name>
```

#### 1f. Update Sprint Directory Location

When worktree is created, the sprint directory is created in the NEW worktree:
```
<worktree-path>/.claude/sprints/YYYY-MM-DD_<sprint-name>/
```

### Step 2: Create Sprint Directory Structure

Create the sprint directory with the naming convention `YYYY-MM-DD_<sprint-name>`:

**Standard mode (no worktree):**
```
.claude/sprints/YYYY-MM-DD_<sprint-name>/
  - SPRINT.yaml
  - context/       (for research, notes, cached context)
  - artifacts/     (for outputs, deliverables)
```

**Worktree mode:**
```
<worktree-path>/.claude/sprints/YYYY-MM-DD_<sprint-name>/
  - SPRINT.yaml
  - context/
  - artifacts/
```

Note: PROGRESS.yaml is NOT created here - it will be compiled from SPRINT.yaml when running `/run-sprint`.

### Step 3: Create SPRINT.yaml (Mode-Dependent)

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

#### For Ralph Mode with Worktree (`--ralph --worktree`):

```yaml
# SPRINT.yaml - Ralph Mode with Dedicated Worktree
# Isolated development in a dedicated git worktree

workflow: ralph

goal: |
  <USER TO FILL IN>

# Worktree configuration (auto-generated when --worktree used)
worktree:
  enabled: true
  branch: sprint/{sprint-id}      # Git branch for this sprint
  path: ../{sprint-id}-worktree   # Worktree location (relative to repo root)
  cleanup: on-complete            # When to clean up: never, on-complete, on-merge

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

#### For Workflow Mode with Worktree (`--workflow <name> --worktree`):

```yaml
# SPRINT.yaml - Workflow-based Sprint with Dedicated Worktree

workflow: <workflow-name>

steps:
  # Add your steps here

# Worktree configuration
worktree:
  enabled: true
  branch: sprint/{sprint-id}
  path: ../{sprint-id}-worktree
  cleanup: on-complete

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

### Step 4: Create Subdirectories

Create the following subdirectories:
- `context/` - For sprint context files, research notes, cached context
- `artifacts/` - For sprint outputs and deliverables

### Step 5: Output Success Message

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
  - Consistent execution via workflow templates
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

Ralph Mode Features:
  - Goal-driven autonomous execution with fresh context per iteration
  - Dynamic step creation and reprioritization
  - JSON result reporting for progress tracking
  - Per-iteration learning extraction (via m42-signs)
  - Minimum iterations threshold to ensure deep work
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

#### For Worktree Mode (any workflow):

```
Creating dedicated worktree for sprint...

Branch: sprint/YYYY-MM-DD_<sprint-name> (created from <current-branch>)
Worktree: /absolute/path/to/YYYY-MM-DD_<sprint-name>-worktree
Sprint Dir: /absolute/path/to/YYYY-MM-DD_<sprint-name>-worktree/.claude/sprints/YYYY-MM-DD_<sprint-name>

Sprint initialized in worktree. Run:
  cd /absolute/path/to/YYYY-MM-DD_<sprint-name>-worktree
  /run-sprint .claude/sprints/YYYY-MM-DD_<sprint-name>

Note: The worktree is configured for cleanup 'on-complete'.
After the sprint completes, run `/cleanup-sprint` to remove the worktree.
```

## Error Handling

### Branch Already Exists

```
Branch 'sprint/YYYY-MM-DD_<sprint-name>' already exists.

Options:
1. Add --reuse-branch flag to use the existing branch
2. Choose a different sprint name
3. Manually delete the branch: git branch -d sprint/YYYY-MM-DD_<sprint-name>
```

### Worktree Path Exists

```
Directory already exists: /path/to/YYYY-MM-DD_<sprint-name>-worktree

This path cannot be used for a new worktree.

Options:
1. Remove the existing directory
2. Modify worktree.path in your workflow/sprint configuration
3. Choose a different sprint name
```

### Git Errors

If git commands fail, display the git error output and suggest manual recovery:

```
Git error: <error message>

Manual recovery steps:
1. Check git status: git status
2. Verify you're in a git repository: git rev-parse --git-dir
3. List existing worktrees: git worktree list
4. Remove problematic worktree: git worktree remove <path>
```

## Success Criteria

- Directory `.claude/sprints/YYYY-MM-DD_<sprint-name>/` exists (in main repo or worktree)
- `SPRINT.yaml` contains valid YAML appropriate for chosen mode:
  - Ralph mode: has `workflow: ralph` and `goal:` keys
  - Workflow mode: has `workflow:` and `steps:` keys
  - Worktree mode: has `worktree:` section with `enabled: true`
- `context/` and `artifacts/` subdirectories exist
- If worktree enabled:
  - Git branch exists: `sprint/YYYY-MM-DD_<sprint-name>`
  - Worktree exists and is valid: `git worktree list` shows the path
  - Sprint directory is in the worktree, not the main repo
- User receives mode-appropriate guidance for next steps
