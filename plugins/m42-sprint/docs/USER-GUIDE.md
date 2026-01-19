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
- [Documentation Index](index.md) - Full documentation map
- GitHub Issues: Report bugs and request features
