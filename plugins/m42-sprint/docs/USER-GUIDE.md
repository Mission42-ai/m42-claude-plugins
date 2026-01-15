# M42 Sprint Plugin - User Guide

Complete guide to autonomous sprint-based task processing for Claude Code.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Commands Reference](#commands-reference)
5. [Task Types](#task-types)
6. [Workflow Patterns](#workflow-patterns)
7. [Configuration](#configuration)
8. [Troubleshooting](#troubleshooting)

---

## Overview

M42 Sprint is a Claude Code plugin that enables autonomous task queue processing. It processes development tasks sequentially, tracking progress and managing state across iterations.

### Key Concepts

- **Sprint**: A container for related tasks with shared context
- **Task Queue**: Ordered list of work items to process
- **Loop Mechanism**: Bash loop with fresh Claude context per task (Ralph Loop pattern)
- **Progress Tracking**: YAML-based state management

### When to Use Sprint

| Good For | Not Good For |
|----------|--------------|
| Processing multiple related tasks | Single quick tasks |
| Autonomous batch operations | Tasks needing human decisions |
| Tasks with clear completion criteria | Unclear requirements |
| GitHub issue implementation | Exploratory research |

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
/start-sprint feature-auth
```

Creates:
```
.claude/sprints/2026-01-15_feature-auth/
  SPRINT.yaml       # Configuration
  PROGRESS.yaml     # Task queue
  context/          # Task context cache
  artifacts/        # Outputs
```

### 2. Add Tasks

```bash
# From GitHub issues
/add-task issue 42
/add-task issue 43

# Custom tasks
/add-task custom --desc "Refactor auth module" --done "Tests pass, code reviewed"

# Bulk import
/import-tasks issues --label "sprint-ready"
```

### 3. Run the Sprint

```bash
/run-sprint .claude/sprints/2026-01-15_feature-auth --max-iterations 20
```

### 4. Monitor Progress

```bash
/sprint-status
```

### 5. Control Execution

```bash
/pause-sprint    # Graceful pause after current task
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
# Creates: .claude/sprints/2026-01-15_auth-improvements/
```

#### `/run-sprint <directory> [options]`

Start autonomous task processing.

**Arguments:**
- `<directory>` - Path to sprint directory (required)
- `--max-iterations N` - Safety limit (default: 10)
- `--dry-run` - Preview tasks without executing

**Examples:**
```bash
# Start sprint execution
/run-sprint .claude/sprints/2026-01-15_auth --max-iterations 30

# Preview tasks without running
/run-sprint .claude/sprints/2026-01-15_auth --dry-run
```

#### `/sprint-status`

Display progress dashboard showing:
- Current task and status
- Queue remaining
- Completed tasks
- Blocked tasks
- Statistics

#### `/pause-sprint`

Request graceful pause. Current task completes, then sprint pauses.

#### `/resume-sprint`

Resume a paused sprint. Clears pause flag, shows next task.

#### `/stop-sprint`

Force immediate stop. Sets status to paused, causing the background loop to exit.

### Task Management

#### `/add-task issue <number>`

Add GitHub issue to queue.

**Example:**
```bash
/add-task issue 123
# Creates task: implement-issue-123
```

#### `/add-task refactor <path> --goal "..."`

Add code refactoring task.

**Arguments:**
- `<path>` - File or directory to refactor
- `--goal` - Refactoring objective

**Example:**
```bash
/add-task refactor src/auth/ --goal "Migrate to new token validation pattern"
```

#### `/add-task docs <path> --changes "..."`

Add documentation update task.

**Arguments:**
- `<path>` - Documentation file path
- `--changes` - Required changes description

**Example:**
```bash
/add-task docs docs/api.md --changes "Add authentication endpoints"
```

#### `/add-task custom --desc "..." --done "..."`

Add custom task with explicit criteria.

**Arguments:**
- `--desc` - Task description
- `--done` - Completion criteria

**Example:**
```bash
/add-task custom --desc "Set up CI pipeline" --done "GitHub Actions workflow runs successfully"
```

#### `/import-tasks issues --label <label> [--sort priority]`

Bulk import GitHub issues by label.

**Arguments:**
- `--label` - GitHub label to filter by
- `--sort priority` - Sort by priority labels (optional)

**Example:**
```bash
/import-tasks issues --label "sprint-1" --sort priority
```

---

## Task Types

### implement-issue

Implements a GitHub issue.

| Field | Required | Description |
|-------|----------|-------------|
| `issue-number` | Yes | GitHub issue number |
| `title` | Auto | Issue title (fetched) |
| `priority` | No | high, medium, low |

**Done-when:** PR merged or issue closed

### refactor

Refactors code files.

| Field | Required | Description |
|-------|----------|-------------|
| `target-path` | Yes | File or directory |
| `goal` | Yes | Refactoring objective |
| `priority` | No | high, medium, low |

**Done-when:** Tests pass and goal achieved

### update-docs

Updates documentation.

| Field | Required | Description |
|-------|----------|-------------|
| `doc-path` | Yes | Documentation file |
| `changes` | Yes | Changes description |
| `priority` | No | high, medium, low |

**Done-when:** Documentation updated and validated

### custom

Arbitrary task with explicit criteria.

| Field | Required | Description |
|-------|----------|-------------|
| `description` | Yes | What to do |
| `done-when` | Yes | Completion criteria |
| `priority` | No | high, medium, low |

**Done-when:** Custom criteria met

---

## Workflow Patterns

### Pattern 1: Feature Development Sprint

```bash
# 1. Create focused sprint
/start-sprint user-auth

# 2. Import related issues
/import-tasks issues --label "auth" --sort priority

# 3. Add supporting tasks
/add-task docs docs/auth.md --changes "Document new auth flow"

# 4. Run with generous limit
/run-sprint .claude/sprints/2026-01-15_user-auth --max-iterations 50
```

### Pattern 2: Bug Fix Sprint

```bash
# 1. Create bug sprint
/start-sprint bugfix-batch

# 2. Import bug issues
/import-tasks issues --label "bug"

# 3. Run with lower limit (bugs are usually quick)
/run-sprint .claude/sprints/2026-01-15_bugfix-batch --max-iterations 20
```

### Pattern 3: Refactoring Sprint

```bash
# 1. Create refactor sprint
/start-sprint code-cleanup

# 2. Add refactor tasks
/add-task refactor src/legacy/ --goal "Migrate to TypeScript"
/add-task refactor src/utils/ --goal "Add proper error handling"
/add-task refactor src/api/ --goal "Use async/await consistently"

# 3. Add validation task
/add-task custom --desc "Run full test suite" --done "All tests pass"

# 4. Run
/run-sprint .claude/sprints/2026-01-15_code-cleanup --max-iterations 30
```

### Pattern 4: Documentation Sprint

```bash
# 1. Create docs sprint
/start-sprint docs-update

# 2. Add doc tasks
/add-task docs README.md --changes "Update installation section"
/add-task docs docs/api.md --changes "Add new endpoint docs"
/add-task docs CONTRIBUTING.md --changes "Update workflow section"

# 3. Run
/run-sprint .claude/sprints/2026-01-15_docs-update --max-iterations 15
```

### Pattern 5: Mixed Sprint with Priorities

```bash
# 1. Create sprint
/start-sprint mixed-work

# 2. Add high priority items first
/add-task issue 100  # Critical bug
/add-task issue 101  # Security fix

# 3. Add medium priority
/add-task refactor src/core/ --goal "Performance optimization"

# 4. Add low priority
/add-task docs docs/changelog.md --changes "Update for release"

# 5. Run - tasks execute in queue order
/run-sprint .claude/sprints/2026-01-15_mixed-work --max-iterations 25
```

---

## Configuration

### SPRINT.yaml

```yaml
# Sprint Configuration
sprint-id: 2026-01-15_feature-auth
name: feature-auth
created: 2026-01-15T10:30:00Z
owner: claude

config:
  max-tasks: 10        # Maximum tasks allowed
  time-box: 4h         # Sprint duration limit
  auto-commit: true    # Commit after each task
  context-cache: true  # Cache gathered context
  parallel: false      # Sequential execution

github:
  repo: owner/repo     # Target repository
  milestone: null      # Optional milestone
  labels: []           # Default labels for PRs

goals:
  - Implement user authentication
  - Add session management

notes: |
  Sprint notes and context here.
```

### PROGRESS.yaml

```yaml
# Progress Tracking
sprint-id: 2026-01-15_feature-auth
status: in-progress
current-task: implement-issue-42

queue:
  - id: implement-issue-42
    type: implement-issue
    issue-number: 42
    title: "Add login endpoint"
    priority: high
  - id: implement-issue-43
    type: implement-issue
    issue-number: 43
    title: "Add session management"
    priority: medium

completed:
  - id: implement-issue-41
    type: implement-issue
    completed-at: 2026-01-15T11:00:00Z
    elapsed: 25m
    summary: "Implemented base auth module"

blocked: []

stats:
  started-at: 2026-01-15T10:30:00Z
  completed-at: null
  tasks-total: 3
  tasks-completed: 1
  tasks-blocked: 0
  elapsed: null
  avg-task-time: null
```

---

## Troubleshooting

### Sprint won't start

**Symptom:** `/run-sprint` fails or does nothing

**Check:**
1. Sprint directory exists: `ls .claude/sprints/`
2. PROGRESS.yaml has tasks: Check `queue` is not empty
3. Status is not "completed" or "blocked"
4. `yq` is installed (required for YAML parsing)

**Fix:**
```bash
# Verify queue has tasks
cat .claude/sprints/2026-01-15_my-sprint/PROGRESS.yaml

# Install yq if missing
brew install yq  # macOS
snap install yq  # Linux
```

### Sprint stuck on task

**Symptom:** Same task keeps repeating

**Check:**
1. PROGRESS.yaml `current-task` matches queue[0]
2. Task has valid completion criteria
3. No infinite loops in task logic

**Fix:**
```bash
# Check current state
/sprint-status

# Force pause and investigate
/stop-sprint

# Manually edit PROGRESS.yaml if needed
```

### Permission prompts appearing

**Symptom:** Bash commands require approval

**Check:**
1. Commands using simple patterns (no `$()` substitution)
2. `allowed-tools` in command frontmatter correct

**Fix:**
Update to latest plugin version which uses Read tool instead of bash `cat`.

### Tasks not completing

**Symptom:** Tasks stay in progress forever

**Check:**
1. `done-when` criteria is achievable
2. No external blockers
3. Iteration limit not reached

**Fix:**
```bash
# Increase iteration limit
/run-sprint .claude/sprints/my-sprint --max-iterations 50

# Or mark task as blocked manually in PROGRESS.yaml
```

### Can't find sprint

**Symptom:** Commands say "NO_SPRINT"

**Check:**
1. Sprint directory exists in `.claude/sprints/`
2. Directory has correct naming pattern
3. PROGRESS.yaml exists in directory

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
2. Check PROGRESS.yaml status

**Fix:**
```bash
# Stop any stale state
/stop-sprint

# Check PROGRESS.yaml is valid YAML
cat .claude/sprints/my-sprint/PROGRESS.yaml

# Set status to in-progress if needed, then restart
/run-sprint .claude/sprints/my-sprint
```

---

## Best Practices

1. **Keep sprints focused**: 5-10 related tasks maximum
2. **Set iteration limits**: Always use `--max-iterations` as a safety net
3. **Use meaningful names**: `feature-auth` not `sprint1`
4. **Write clear done-when**: Specific, measurable criteria
5. **Monitor progress**: Check `/sprint-status` periodically
6. **Commit atomically**: One logical change per task
7. **Cache context**: Enable `context-cache` for related tasks
8. **Time-box aggressively**: 2-4 hours per sprint

---

## Getting Help

- `/help` - Show plugin commands and usage
- GitHub Issues: Report bugs and request features
- README.md: Technical reference and architecture
