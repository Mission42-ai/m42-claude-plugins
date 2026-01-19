# Command Reference

Complete reference for all M42-Sprint commands organized by category.

## Quick Reference

| Command | Description | Category |
|---------|-------------|----------|
| `/start-sprint <name> [--ralph \| --workflow <name>]` | Initialize new sprint directory | Lifecycle |
| `/run-sprint <dir> [options]` | Compile and execute sprint | Lifecycle |
| `/stop-sprint` | Forcefully stop sprint loop | Control |
| `/pause-sprint` | Pause after current task | Control |
| `/resume-sprint` | Resume paused sprint | Control |
| `/sprint-status` | Show progress dashboard | Monitoring |
| `/sprint-watch [dir]` | Start live status server | Monitoring |
| `/add-step <prompt>` | Add step to SPRINT.yaml | Step Management |
| `/import-steps issues --label <label>` | Import GitHub issues as steps | Step Management |
| `/import-steps file <path>` | Import steps from YAML file | Step Management |
| `/sprint-help` | Show help and documentation | Help |

---

## Lifecycle Commands

Commands for creating and running sprints.

### /start-sprint

Initialize a new sprint directory with either **Ralph mode** (autonomous goal-driven) or **workflow-based** configuration.

**Usage:**
```bash
/start-sprint <sprint-name> [--ralph | --workflow <name>]
```

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `<sprint-name>` | Yes | Name for the sprint (alphanumeric, hyphens allowed) |

**Options:**
| Option | Description |
|--------|-------------|
| `--ralph` | Create Ralph mode sprint (autonomous, goal-driven) |
| `--workflow <name>` | Create workflow-based sprint with specified workflow |

**Sprint Modes:**

| Mode | When to Use |
|------|-------------|
| **Ralph** (`--ralph`) | Complex features, research-heavy work, open-ended goals |
| **Workflow** (`--workflow`) | Well-defined tasks, routine work, batched operations |

**What it creates:**
```
.claude/sprints/YYYY-MM-DD_<sprint-name>/
├── SPRINT.yaml     # Sprint configuration (mode-dependent)
├── context/        # Context files and cached research
├── artifacts/      # Sprint outputs and deliverables
└── patterns/       # (Optional) Sprint-specific execution patterns
```

**Examples:**
```bash
# Create Ralph mode sprint (recommended for complex goals)
/start-sprint feature-auth --ralph

# Create workflow-based sprint
/start-sprint bugfix-batch --workflow bugfix-workflow

# If mode not specified, you'll be asked to choose
/start-sprint my-sprint
```

**Output (Ralph Mode):**
```
Sprint initialized (Ralph Mode)!

Location: .claude/sprints/2026-01-15_feature-auth/

Ralph Mode Features:
  - Autonomous goal-driven execution
  - Deep thinking with dynamic task shaping
  - Pattern-based execution for quality consistency
  - Per-iteration learning extraction (if enabled)

Next steps:
  1. Edit SPRINT.yaml to define your goal
  2. (Optional) Add context files to context/ directory
  3. Run /run-sprint to execute

Available patterns for Ralph to invoke:
  - implement-feature (TDD implementation)
  - fix-bug (debug and fix with regression test)
  - refactor (safe refactoring with test preservation)
  - document (documentation updates)
```

**Output (Workflow Mode):**
```
Sprint initialized (Workflow Mode)!

Location: .claude/sprints/2026-01-15_bugfix-batch/

Next steps:
  1. Edit SPRINT.yaml to add your steps
  2. Run /run-sprint to compile and execute
  3. Use --dry-run first to preview the workflow
```

**Notes:**
- Creates sprint with current date prefix: `YYYY-MM-DD_<name>`
- Ralph mode: Uses `workflow: ralph` with `goal:` field
- Workflow mode: Uses `workflow: <name>` with `steps:` array
- PROGRESS.yaml is NOT created here - it's compiled when running `/run-sprint`

---

### /run-sprint

Compile SPRINT.yaml through workflows and start the execution loop with fresh context per task.

**Usage:**
```bash
/run-sprint <sprint-directory> [options]
```

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `<sprint-directory>` | Yes | Path to sprint directory |

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--max-iterations N` | unlimited | Maximum loop iterations (0 = unlimited) |
| `--dry-run` | - | Preview workflow without executing |
| `--recompile` | - | Force recompilation even if PROGRESS.yaml exists |
| `--no-status` | - | Skip launching the live status server |

**Examples:**
```bash
# Basic execution
/run-sprint .claude/sprints/2026-01-15_my-sprint

# With iteration limit
/run-sprint .claude/sprints/2026-01-15_my-sprint --max-iterations 50

# Preview without executing
/run-sprint .claude/sprints/2026-01-15_my-sprint --dry-run

# Force recompilation
/run-sprint .claude/sprints/2026-01-15_my-sprint --recompile

# Run without status server
/run-sprint .claude/sprints/2026-01-15_my-sprint --no-status
```

**Output (normal execution):**
```
Sprint Loop Launched
====================

Sprint: 2026-01-15_my-sprint
Directory: .claude/sprints/2026-01-15_my-sprint
Background Task ID: task_abc123

Workflow: sprint-default
Phases: 4
Steps: 3

Live Status: http://localhost:3100
(Open in browser for real-time progress)

Each phase/step runs with FRESH context (no accumulation).

Monitor progress:
- /sprint-status - View PROGRESS.yaml status
- TaskOutput(task_abc123) - View loop output

Stop the sprint:
- /stop-sprint - Terminate the loop
- /pause-sprint - Request graceful pause
```

**Output (dry-run mode):**
```
Dry Run: Workflow Preview
==========================

Sprint: 2026-01-15_my-sprint
Directory: .claude/sprints/2026-01-15_my-sprint
Status: not-started

Workflow Phases:
-----------------
1. [phase] prepare
   Gather context and validate environment...

2. [for-each] development
   Steps (3):
     - step-0: Implement user login...
       Sub-phases: planning → implement → test → document
     - step-1: Add authentication...
       Sub-phases: planning → implement → test → document

3. [phase] deploy
   Final deployment checks...

Summary:
- Total phases: 3
- Total steps: 2
- Total sub-phases: 8
- Estimated iterations: 10

To start execution, run without --dry-run:
  /run-sprint .claude/sprints/2026-01-15_my-sprint --max-iterations 15
```

**How it works:**
1. Compiles SPRINT.yaml through referenced workflow(s)
2. Generates PROGRESS.yaml with hierarchical phases
3. Launches sprint-loop.sh in background
4. Starts live status server (unless `--no-status`)
5. Loop invokes `claude -p` for each task with fresh context

---

## Control Commands

Commands for pausing, resuming, and stopping sprints.

### /pause-sprint

Request sprint to pause gracefully after current task completes.

**Usage:**
```bash
/pause-sprint
```

**Behavior:**
- Sets PROGRESS.yaml status to `paused`
- Current task completes normally before stopping
- Loop exits gracefully at next status check

**Example:**
```bash
/pause-sprint
```

**Output:**
```
Pause requested for sprint: 2026-01-15_my-sprint

Current task will complete before pausing.
Status: paused

The sprint loop will stop after the current iteration completes.

Use /resume-sprint to continue.
Use /sprint-status to check progress.
Use /stop-sprint for immediate stop (kills task mid-execution).
```

**Notes:**
- Does not interrupt the current task
- Safe way to stop between tasks
- Use `/stop-sprint` for immediate termination

---

### /resume-sprint

Resume execution of a paused sprint.

**Usage:**
```bash
/resume-sprint
```

**Behavior:**
- Sets PROGRESS.yaml status back to `in-progress`
- Removes any `pause-requested` flag
- Does NOT start the loop - user must run `/run-sprint`

**Example:**
```bash
/resume-sprint
```

**Output:**
```
Sprint resumed: 2026-01-15_my-sprint

Status: in-progress
Queue: 5 tasks remaining
Next task: development > step-2 > implement

To start processing tasks:
/run-sprint .claude/sprints/2026-01-15_my-sprint
```

**Notes:**
- Only updates status - does not start execution
- Must run `/run-sprint` after resuming to continue processing

---

### /stop-sprint

Forcefully stop an active sprint loop immediately.

**Usage:**
```bash
/stop-sprint
```

**Behavior:**
- Sets PROGRESS.yaml status to `paused`
- Loop exits on next status check (typically within seconds)
- Current task completes before stopping

**Example:**
```bash
/stop-sprint
```

**Output:**
```
Sprint stopped.

Sprint: 2026-01-15_my-sprint
Directory: .claude/sprints/2026-01-15_my-sprint
Status: paused

The sprint loop will exit on its next status check.

To resume: /run-sprint .claude/sprints/2026-01-15_my-sprint
To view status: /sprint-status
```

**Notes:**
- For truly immediate termination (killing mid-task):
  1. Use `/tasks` to find the background task ID
  2. Use `KillShell` to terminate it
- Prefer `/pause-sprint` for graceful stopping

---

## Monitoring Commands

Commands for viewing sprint progress and status.

### /sprint-status

Display current sprint progress with hierarchical phase/step/sub-phase status.

**Usage:**
```bash
/sprint-status
```

**Output:**
```
Sprint: 2026-01-15_my-sprint
Status: in-progress
Progress: 5/12 phases (41%)

Phases:
[x] prepare (completed)
[>] development (in-progress)
    [x] step-1 (4/4 phases)
    [>] step-2 (2/4 phases)
        [x] planning
        [>] implement (current)
        [ ] test
        [ ] document
    [ ] step-3 (0/4 phases)
[ ] qa (pending)
[ ] deploy (pending)

Current: development > step-2 > implement
```

**Status indicators:**
| Symbol | Meaning |
|--------|---------|
| `[x]` | Completed |
| `[>]` | In progress (current) |
| `[ ]` | Pending |
| `[!]` | Blocked |

**Notes:**
- Automatically finds the most recent sprint
- Shows hierarchical progress with indentation
- Displays stats and current pointer position

---

### /sprint-watch

Start the live status server for monitoring sprint progress in a browser.

**Usage:**
```bash
/sprint-watch [sprint-directory]
```

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `[sprint-directory]` | No | Path to sprint (defaults to most recent) |

**Examples:**
```bash
# Watch most recent sprint
/sprint-watch

# Watch specific sprint
/sprint-watch .claude/sprints/2026-01-15_my-sprint
```

**Output:**
```
Sprint Status Server Started
============================

Sprint: 2026-01-15_my-sprint
Directory: .claude/sprints/2026-01-15_my-sprint
Status: in-progress

Live Status: http://localhost:3100

Open the URL in your browser to see:
- Real-time phase tree with status indicators
- Current task details and progress
- Activity feed with recent updates

The page auto-updates when PROGRESS.yaml changes.

To stop the server, close this terminal or use Ctrl+C.
```

**Notes:**
- If server already running, shows existing URL
- Page auto-refreshes when PROGRESS.yaml changes
- Useful when sprint was started without status server
- **Worktree-aware**: Dashboard shows sprints from all git worktrees for parallel execution monitoring. See [API Reference](api.md#worktree-aware-endpoints) for details.

---

## Step Management Commands

Commands for adding and importing steps to a sprint.

### /add-step

Add a single step to the current sprint's SPRINT.yaml.

**Usage:**
```bash
/add-step <step-prompt>
```

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `<step-prompt>` | Yes | Description/prompt for the step |

**Example:**
```bash
/add-step "Implement user login API endpoint with JWT authentication"
```

**Output:**
```
Step added to sprint.

Sprint: 2026-01-15_my-sprint
Step #3: Implement user login API endpoint with JWT authentication

SPRINT.yaml updated.
Note: Run /run-sprint to compile and execute.
```

**Notes:**
- Automatically finds the most recent sprint
- Appends step to the `steps:` array in SPRINT.yaml
- Requires recompilation via `/run-sprint` to take effect

---

### /import-steps

Bulk import steps from GitHub issues or a YAML file.

**Usage:**
```bash
# Import from GitHub issues
/import-steps issues --label <label>

# Import from YAML file
/import-steps file <path.yaml>
```

**Mode: GitHub Issues**

Import open GitHub issues with a specific label as steps.

```bash
/import-steps issues --label sprint-ready
```

**Output:**
```
Steps imported from GitHub issues:
  Label: sprint-ready
  Found: 6 issues
  Added: 6 steps

New steps:
  - Step 4: Implement GitHub issue #45 - Fix login timeout
  - Step 5: Implement GitHub issue #47 - Handle null response
  - Step 6: Implement GitHub issue #51 - Update error messages
  - Step 7: Implement GitHub issue #52 - Fix pagination
  - Step 8: Implement GitHub issue #55 - Resolve memory leak
  - Step 9: Implement GitHub issue #58 - Fix date parsing

Updated: .claude/sprints/2026-01-15_bugfix-sprint/SPRINT.yaml
Note: Run /run-sprint to compile and execute
```

**Mode: YAML File**

Import steps from a YAML file.

```bash
/import-steps file steps-to-import.yaml
```

**Expected file format:**
```yaml
steps:
  - prompt: |
      Step description here
  - prompt: |
      Another step description
```

**Output:**
```
Steps imported from file:
  Source: steps-to-import.yaml
  Found: 3 steps
  Added: 3 steps

New steps:
  - Step 2: Add user authentication
  - Step 3: Improve database module
  - Step 4: Update API documentation

Updated: .claude/sprints/2026-01-15_sprint/SPRINT.yaml
Note: Run /run-sprint to compile and execute
```

**Notes:**
- Requires `gh` CLI for GitHub issues import
- Automatically finds the most recent sprint
- Requires recompilation via `/run-sprint` to take effect

---

## Help Commands

### /sprint-help

Display comprehensive help about the M42-Sprint plugin.

**Usage:**
```bash
/sprint-help
```

**Shows:**
- Overview of the sprint system
- All available commands with descriptions
- Quick start example
- Sprint structure explanation
- Workflow architecture
- Loop mechanism (Ralph Loop pattern)
- Tips and best practices

---

## Common Workflows

### Starting a New Sprint (Ralph Mode - Recommended for Complex Goals)

```bash
# 1. Create Ralph mode sprint
/start-sprint feature-auth --ralph

# 2. Edit SPRINT.yaml to set your goal
# goal: |
#   Implement user authentication system with:
#   - User registration with email verification
#   - Login with JWT tokens
#   - Password reset flow
#   Success: All endpoints tested, documented, and deployed

# 3. Execute sprint
/run-sprint .claude/sprints/2026-01-15_feature-auth
```

### Starting a New Sprint (Workflow Mode - For Well-Defined Steps)

```bash
# 1. Create workflow-based sprint
/start-sprint bugfix-batch --workflow bugfix-workflow

# 2. Add steps
/add-step "Implement user registration endpoint"
/add-step "Add email verification"
/add-step "Create password reset flow"

# 3. Preview workflow
/run-sprint .claude/sprints/2026-01-15_bugfix-batch --dry-run

# 4. Execute sprint
/run-sprint .claude/sprints/2026-01-15_bugfix-batch --max-iterations 30
```

### Monitoring and Controlling

```bash
# Check status
/sprint-status

# Open live status page
/sprint-watch

# Pause when needed
/pause-sprint

# Resume later
/resume-sprint
/run-sprint .claude/sprints/2026-01-15_feature-auth
```

### Importing from GitHub

```bash
# Create sprint for bug fixes
/start-sprint bugfix-batch

# Import all issues labeled 'bug'
/import-steps issues --label bug

# Run with higher iteration limit
/run-sprint .claude/sprints/2026-01-15_bugfix-batch --max-iterations 50
```

---

## Status Values Reference

The sprint loop monitors PROGRESS.yaml for these status values:

| Status | Description | Loop Action |
|--------|-------------|-------------|
| `in-progress` | Tasks being processed | Continue |
| `completed` | All tasks finished successfully | Exit (success) |
| `blocked` | Task cannot proceed | Exit (failure) |
| `paused` | User requested pause | Exit (graceful) |
| `needs-human` | Human decision required | Exit (intervention) |

---

## Environment Requirements

- **yq**: Required for YAML processing in sprint-loop.sh
- **Node.js**: Required for workflow compilation and status server
- **gh CLI**: Required only for `/import-steps issues` command
- **Workflows**: At least one workflow in `.claude/workflows/` directory

---

## See Also

- [Architecture Overview](../concepts/overview.md) - Three-tier model explanation
- [Ralph Loop Pattern](../concepts/ralph-loop.md) - Fresh context execution
- [Workflow Compilation](../concepts/workflow-compilation.md) - How SPRINT.yaml compiles
- [SPRINT.yaml Schema](sprint-yaml-schema.md) - Sprint configuration reference
- [PROGRESS.yaml Schema](progress-yaml-schema.md) - Progress tracking reference
- [API Reference](api.md) - Status server REST API for worktree-aware monitoring
