---
description: "Show sprint plugin help and available commands"
model: haiku
---

# M42 Sprint Plugin Help

Please explain the following to the user:

## What is Sprint?

The M42 Sprint plugin provides autonomous workflow-based execution for development sprints.
It uses a compilation model where SPRINT.yaml defines steps, which are compiled into
a hierarchical phase structure in PROGRESS.yaml for execution.

**Core concept:**
- Define a sprint with steps in SPRINT.yaml
- Compilation expands steps into hierarchical phases
- Run the sprint to start autonomous processing
- Each phase runs with FRESH context (Ralph Loop pattern)
- Progress tracked hierarchically in PROGRESS.yaml
- Sprint continues until complete, blocked, or paused

## Available Commands

### Sprint Lifecycle

| Command | Description |
|---------|-------------|
| `/start-sprint <name>` | Initialize new sprint directory structure |
| `/run-sprint <dir> [--max-iterations N]` | Compile and start sprint execution loop |
| `/pause-sprint` | Pause gracefully after current phase |
| `/resume-sprint` | Resume a paused sprint |
| `/stop-sprint` | Forcefully stop active loop |
| `/sprint-status` | Show hierarchical progress dashboard |

### Step Management

| Command | Description |
|---------|-------------|
| `/add-step <prompt>` | Add step to SPRINT.yaml steps array |
| `/import-steps issues --label <label>` | Bulk import GitHub issues as steps |
| `/import-steps file <path.yaml>` | Import steps from YAML file |

## Quick Start Example

```
# 1. Create a sprint
/start-sprint auth-feature

# 2. Add steps to SPRINT.yaml
/add-step "Implement user login API endpoint"
/add-step "Add authentication middleware"

# Or import from GitHub issues
/import-steps issues --label sprint-ready

# 3. Run the sprint (compiles and executes)
/run-sprint .claude/sprints/2026-01-15_auth-feature --max-iterations 20

# 4. Check progress
/sprint-status
```

## Sprint Structure

```
.claude/sprints/YYYY-MM-DD_sprint-name/
  SPRINT.yaml       # Configuration with steps array
  PROGRESS.yaml     # Compiled phases hierarchy (generated)
  context/          # Cached context files
  artifacts/        # Generated outputs
```

## Workflow Architecture

The sprint uses a **compilation model**:

1. **SPRINT.yaml** - Source definition with steps:
   ```yaml
   steps:
     - prompt: "Implement feature X"
     - prompt: "Add tests for feature X"
   ```

2. **Compilation** - Steps expand into phases:
   - Each step becomes a development phase
   - Each phase has sub-phases: planning, implement, test, document
   - Creates hierarchical structure in PROGRESS.yaml

3. **Execution** - Phases run sequentially:
   - Pointer tracks current phase/step/sub-phase
   - Fresh context per phase (Ralph Loop)
   - Progress persisted after each phase

## Loop Mechanism

The sprint uses the **Ralph Loop pattern** with fresh context per phase:

1. `/run-sprint` compiles SPRINT.yaml to PROGRESS.yaml
2. Launches TypeScript sprint runtime in background
3. Runtime invokes `claude -p` for ONE phase (fresh context)
4. Claude executes the phase and updates pointer
5. Claude exits, releasing context
6. Runtime checks PROGRESS.yaml status
7. If not complete, starts NEW Claude with fresh context
8. Continues until complete, blocked, or paused

**Status Values:**
- `completed` - All phases done
- `blocked` - Current phase cannot proceed
- `paused` - Pause was requested
- `needs-human` - Human decision required

**Key Benefits:**
- 100% context utilization per phase
- No accumulated context between phases
- Hierarchical progress tracking
- Reliable for long sprints

## When to Use Sprint

**Good for:**
- Processing multiple related development steps
- Autonomous development workflows
- Steps with clear completion criteria
- Batch implementation of issues

**Not good for:**
- Single quick tasks (just do them directly)
- Tasks requiring human decisions mid-execution
- Unclear requirements

## Tips

- Always set `--max-iterations` as a safety limit
- Use `/pause-sprint` for graceful stops
- Use `/stop-sprint` for immediate stops
- Check `/sprint-status` to monitor hierarchical progress
- Keep sprints focused: 5-10 related steps
- Requires Node.js >=18.0.0
- Recompilation happens automatically on `/run-sprint`
