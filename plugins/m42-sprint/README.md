# M42 Sprint Plugin

Sprint orchestration with **fresh context per task** for Claude Code.

## What is M42 Sprint?

M42 Sprint enables autonomous, goal-driven development where Claude thinks deeply and shapes work dynamically through workflow-based execution:

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  SPRINT.yaml    │ ──► │   Compiler   │ ──► │ PROGRESS.yaml   │
│   (steps)       │     │  (expands)   │     │   (phases)      │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

Each step runs in a fresh Claude session, preventing context accumulation and slowdown during long sprints.

### Key Features

- **Chat-like activity feed**: Watch Claude's reasoning and tool calls in real-time
- **Elapsed time tracking**: See time spent on each phase and total sprint duration
- **Model selection**: Override Claude model (sonnet/opus/haiku) at sprint or step level
- **Stale detection**: Automatic alerts and recovery when phases become unresponsive
- **Workflow composition**: Reference and compose workflows for complex pipelines
- **PDF export**: Generate PDF summaries of sprint progress and results

## Quick Links

| Getting Started | Deep Dives | Reference |
|-----------------|------------|-----------|
| [Quick Start](docs/getting-started/quick-start.md) | [Architecture Overview](docs/concepts/overview.md) | [Commands](docs/reference/commands.md) |
| [First Sprint](docs/getting-started/first-sprint.md) | [Workflow Compilation](docs/concepts/workflow-compilation.md) | [SPRINT.yaml Schema](docs/reference/sprint-yaml-schema.md) |
| [User Guide](docs/USER-GUIDE.md) | | [API Reference](docs/reference/api.md) |

## Quick Start

```bash
# 1. Create a new sprint
/init-sprint my-feature --workflow sprint-default

# 2. Add steps
/add-step "Create user model with validation"
/add-step "Add API endpoints for CRUD operations"

# 3. Run it
/run-sprint .claude/sprints/2026-01-16_my-feature

# 4. Watch progress (chat-like view with elapsed time)
/sprint-watch
```

Each step runs through predefined workflow phases with fresh context.

### Model Selection

Override the model for complex or simple tasks:

```yaml
# SPRINT.yaml
model: sonnet  # Sprint-level default

collections:
  step:
    - prompt: Design architecture
      model: opus    # Use opus for complex reasoning
```

## Installation

```bash
claude plugin install m42-sprint
```

Requirements:
- Claude Code CLI
- Node.js >= 18.0.0

The sprint runtime is built with TypeScript and runs on Node.js. No additional YAML tools are required.

## Commands

| Command | Description |
|---------|-------------|
| `/init-sprint <name> [--workflow <name>] [--worktree]` | Initialize new sprint (add `--worktree` for [parallel development](docs/guides/worktree-sprints.md)) |
| `/add-step <prompt>` | Add step to queue |
| `/import-steps` | Bulk import from GitHub |
| `/run-sprint <dir> [--model <model>]` | Start execution loop (model: sonnet/opus/haiku) |
| `/sprint-watch` | Open live dashboard (chat view, elapsed time, progress) |
| `/sprint-status` | View progress summary |
| `/pause-sprint` | Pause after current task |
| `/resume-sprint` | Resume paused or stale sprint |
| `/stop-sprint` | Stop immediately |
| `/export-pdf <sprint-path>` | Export sprint summary as PDF |

## Sprint Structure

```
.claude/sprints/YYYY-MM-DD_name/
├── SPRINT.yaml       # Steps and configuration
├── PROGRESS.yaml     # Generated execution state
├── context/          # Cached context files
└── artifacts/        # Outputs and results
```

## Why Fresh Context?

Traditional approaches accumulate context as tasks complete, leading to:
- Slower responses as context fills
- Increased token costs
- Risk of context overflow

The **Fresh Context Pattern** gives each iteration a clean slate, enabling reliable multi-hour sprints.

## Documentation

- [User Guide](docs/USER-GUIDE.md) - Complete usage guide
- [Commands Reference](docs/reference/commands.md) - All commands with examples
- [API Reference](docs/reference/api.md) - Status server REST API
- [Troubleshooting](docs/troubleshooting/common-issues.md) - Common issues and solutions

## License

MIT
