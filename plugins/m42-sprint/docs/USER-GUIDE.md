# M42 Sprint Plugin - User Guide

Complete guide to sprint orchestration for Claude Code.

---

## Overview

M42 Sprint enables autonomous sprint execution with fresh context per iteration. It supports two modes:

- **Ralph Mode** (recommended): Goal-driven autonomous execution where Claude thinks deeply and shapes work dynamically
- **Workflow Mode**: Structured step-based execution with predefined phases

For detailed architecture and concepts, see [Architecture Overview](concepts/overview.md).

---

## Getting Started

| Guide | What You'll Learn |
|-------|-------------------|
| [Quick Start](getting-started/quick-start.md) | Create and run your first sprint in 5 minutes |
| [First Sprint Tutorial](getting-started/first-sprint.md) | Complete walkthrough with explanations |
| [Ralph Mode](concepts/ralph-mode.md) | Autonomous goal-driven workflows |
| [Workflow Compilation](concepts/workflow-compilation.md) | How SPRINT.yaml becomes PROGRESS.yaml |

---

## Commands & Reference

| Document | Contents |
|----------|----------|
| [Commands Reference](reference/commands.md) | All 10 commands with usage and examples |
| [API Reference](reference/api.md) | Status server REST API endpoints |
| [SPRINT.yaml Schema](reference/sprint-yaml-schema.md) | Sprint definition format |
| [PROGRESS.yaml Schema](reference/progress-yaml-schema.md) | Compiled execution plan format |
| [Workflow YAML Schema](reference/workflow-yaml-schema.md) | Workflow template format |

---

## Writing Sprints & Workflows

| Guide | When to Use |
|-------|-------------|
| [Writing Sprints](guides/writing-sprints.md) | Creating effective SPRINT.yaml files |
| [Writing Workflows](guides/writing-workflows.md) | Building reusable workflow templates |

---

## Parallel Development with Worktrees

Run multiple sprints simultaneously using git worktrees. Each sprint gets its own branch, working directory, and Claude session—completely isolated from your main work.

### Quick Start

```bash
# Start a sprint with dedicated worktree
/init-sprint feature-auth --ralph --worktree

# Navigate to worktree and run
cd ../2026-01-20_feature-auth-worktree
/run-sprint .claude/sprints/2026-01-20_feature-auth

# Monitor all parallel sprints
/sprint-status --all-worktrees

# Clean up after completion
/cleanup-sprint .claude/sprints/2026-01-20_feature-auth
```

### SPRINT.yaml Configuration

Enable worktree mode in your sprint definition:

```yaml
name: User Authentication
workflow: ralph

worktree:
  enabled: true
  branch: sprint/{sprint-id}        # Default branch pattern
  path: ../{sprint-id}-worktree     # Default worktree location
  cleanup: on-complete              # Auto-cleanup when done

goal: |
  Implement user authentication with JWT tokens.
```

### Key Commands

| Command | Description |
|---------|-------------|
| `/init-sprint <name> --worktree` | Create sprint with dedicated worktree |
| `/sprint-status --all-worktrees` | View all parallel sprints |
| `/cleanup-sprint <path>` | Remove worktree and optionally branch |

### Automatic Context Injection

When running in worktree mode, spawned agents automatically receive execution context including their working directory, branch name, and main repository path. This ensures agents understand their isolated environment and use appropriate relative paths without any additional configuration.

For complete configuration options, troubleshooting, and advanced workflows, see [Parallel Development with Git Worktrees](guides/worktree-sprints.md).

---

## Troubleshooting

See [Common Issues](troubleshooting/common-issues.md) for solutions to:
- Compilation failures
- Workflow not found errors
- Stuck phases
- Ralph Mode JSON parsing issues
- Permission prompts

**Quick diagnostics:**
```bash
/sprint-status          # Check current state
cat PROGRESS.yaml       # Inspect execution plan
ls .claude/workflows/   # Verify workflow exists
```

---

## Live Activity Feed

The dashboard includes a real-time activity feed showing what Claude is doing during sprint execution.

### Chat-Like Display

The activity feed shows two types of content:

1. **Assistant Messages**: Claude's thinking and explanations displayed as chat bubbles
2. **Tool Calls**: Operations like Read, Edit, Bash displayed with relevant details

This provides visibility into Claude's reasoning process alongside the actual actions being taken.

### Activity Sources

Activity is captured directly from Claude's transcript files (`transcriptions/` directory), parsing:
- Tool invocations with names and parameters
- Text content from Claude's responses
- Timestamps for elapsed time calculation

### Dashboard Features

The status page (`http://localhost:3100`) displays:
- **Progress Bar**: Visual completion percentage with step count
- **Elapsed Time**: How long the current phase/step has been running
- **Stale Detection**: Warning if a sprint appears stuck (no activity for 5+ minutes)
- **Sprint Switcher**: Dropdown to quickly navigate between sprints
- **Live Activity Panel**: Auto-scrolling feed of Claude's activity

### Stale Sprint Recovery

If a sprint becomes stale (e.g., Claude process crashed), the dashboard shows:
- A warning indicator with time since last activity
- A "Resume" button to restart the sprint from where it left off

Use the resume endpoint to restart:
```bash
curl -X POST http://localhost:3100/api/sprint/<sprint-id>/resume
```

---

## Operator Queue

The operator system allows Claude to discover issues during execution and queue them for review. This enables dynamic work injection without derailing the current task.

### How It Works

1. **Discovery**: During phase execution, Claude may discover bugs, tech debt, or improvements
2. **Request**: Claude creates an operator request with priority, type, and context
3. **Queue**: Requests are added to the operator queue in PROGRESS.yaml
4. **Decision**: Requests are auto-triaged or manually reviewed
5. **Action**: Approved requests get injected as new steps; rejected/deferred/backlogged items are tracked

### Viewing the Queue

Access the operator queue view:
- **Web UI**: Navigate to `/sprint/<sprint-id>/operator`
- **API**: `GET /api/sprint/<sprint-id>/operator-queue`

The queue view shows:
- Pending requests awaiting decision
- Recent decisions (approved, rejected, deferred)
- Backlog items for human review

### Manual Decisions

Submit manual decisions via the dashboard or API:
```bash
curl -X POST http://localhost:3100/api/sprint/<sprint-id>/operator-queue/<request-id>/decide \
  -H "Content-Type: application/json" \
  -d '{"decision": "approve", "reasoning": "Critical bug fix needed"}'
```

Decision options:
- `approve`: Inject as new step(s) in the current sprint
- `reject`: Decline the request with reason
- `defer`: Delay until end-of-phase, end-of-sprint, or next-sprint
- `backlog`: Add to BACKLOG.yaml for human review

### BACKLOG.yaml

Items sent to backlog are stored in `BACKLOG.yaml` for later review:
```yaml
items:
  - id: req-abc123
    title: "Refactor authentication module"
    description: "..."
    category: tech-debt
    suggested-priority: medium
    operator-notes: "Valid improvement but out of scope"
    source:
      request-id: req-abc123
      discovered-in: "development > step-2 > implement"
      discovered-at: "2026-01-20T10:30:00Z"
    status: pending-review
```

---

## Model Selection

Control which Claude model executes each phase with the `model` field.

### Available Models

| Model | Use Case |
|-------|----------|
| `sonnet` | Default - balanced speed and capability |
| `opus` | Complex reasoning, architecture decisions |
| `haiku` | Fast, simple tasks, validation |

### Resolution Order

Model selection follows a precedence hierarchy (highest to lowest priority):

1. **Step-level**: `model` field in SPRINT.yaml step
2. **Workflow phase-level**: `model` field in workflow phase
3. **Sprint-level**: Top-level `model` in SPRINT.yaml
4. **Workflow-level**: Top-level `model` in workflow definition
5. **Default**: No override (uses CLI default, typically sonnet)

### Examples

**Sprint-level default:**
```yaml
workflow: sprint-default
model: opus  # All phases use opus unless overridden

collections:
  step:
    - prompt: Design the architecture
    - prompt: Implement the solution
```

**Item-level override:**
```yaml
workflow: sprint-default
model: sonnet

collections:
  step:
    - prompt: Design the architecture
      model: opus  # This item uses opus
    - prompt: Implement the solution  # Uses sonnet (sprint default)
```

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
3. **Use worktrees for parallel work**: Run multiple sprints simultaneously with `--worktree` flag
4. **Use model selection wisely**: Use opus for architecture/design, sonnet for implementation, haiku for validation
5. **Review operator queue**: Check `/sprint/<id>/operator` for discovered issues during execution
6. **Handle stale sprints**: If dashboard shows stale warning, use the Resume button to restart

---

## Getting Help

- `/help` - Show plugin commands and usage
- [Documentation Index](index.md) - Full documentation map
- GitHub Issues: Report bugs and request features
