# M42 Sprint Plugin

Sprint orchestration with **fresh context per task** for Claude Code.

## What is M42 Sprint?

M42 Sprint enables autonomous, goal-driven development where Claude thinks deeply and shapes work dynamically. Two modes are available:

**Ralph Mode** (Recommended) - Autonomous goal-driven execution:
```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  SPRINT.yaml    │ ──► │  Ralph Loop  │ ──► │  goal-complete  │
│    (goal)       │     │ (iterates)   │     │    or pause     │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

**Workflow Mode** - Structured step-based execution:
```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  SPRINT.yaml    │ ──► │   Compiler   │ ──► │ PROGRESS.yaml   │
│   (steps)       │     │  (expands)   │     │   (phases)      │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

**The Ralph Loop** solves context accumulation: each iteration runs in a fresh Claude session, preventing slowdown during long sprints.

### Key Features

- **Chat-like activity feed**: Watch Claude's reasoning and tool calls in real-time
- **Elapsed time tracking**: See time spent on each phase and total sprint duration
- **Model selection**: Override Claude model (sonnet/opus/haiku) at sprint or step level
- **Stale detection**: Automatic alerts and recovery when phases become unresponsive
- **Workflow composition**: Reference and compose workflows for complex pipelines

## Quick Links

| Getting Started | Deep Dives | Reference |
|-----------------|------------|-----------|
| [Quick Start](docs/getting-started/quick-start.md) | [Ralph Mode](docs/concepts/ralph-mode.md) | [Commands](docs/reference/commands.md) |
| [First Sprint](docs/getting-started/first-sprint.md) | [Architecture Overview](docs/concepts/overview.md) | [SPRINT.yaml Schema](docs/reference/sprint-yaml-schema.md) |
| [User Guide](docs/USER-GUIDE.md) | [Workflow Compilation](docs/concepts/workflow-compilation.md) | [API Reference](docs/reference/api.md) |

## 30-Second Example

### Ralph Mode (Recommended)

```bash
# 1. Create Ralph mode sprint
/start-sprint my-feature --ralph

# 2. Edit SPRINT.yaml to define your goal
goal: |
  Build a user authentication system with JWT tokens.
  Requirements: registration, login, token refresh, logout.
  Success criteria: All tests passing, TypeScript compiles.

# 3. Run it
/run-sprint .claude/sprints/2026-01-16_my-feature

# 4. Watch progress (chat-like view with elapsed time)
/sprint-watch
```

Ralph thinks deeply, creates steps dynamically, and signals when the goal is complete.

### Model Selection

Override the model for complex or simple tasks:

```yaml
# SPRINT.yaml
model: sonnet  # Sprint-level default

steps:
  - prompt: Design architecture
    model: opus    # Use opus for complex reasoning
```

### Workflow Mode

```bash
# 1. Create workflow-based sprint
/start-sprint my-feature --workflow sprint-default

# 2. Add steps
/add-step "Create user model with validation"
/add-step "Add API endpoints for CRUD operations"

# 3. Run it
/run-sprint .claude/sprints/2026-01-16_my-feature

# 4. Check status
/sprint-status
```

Each step runs through predefined workflow phases with fresh context.

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
| `/start-sprint <name> [--ralph\|--workflow <name>] [--worktree]` | Initialize new sprint (add `--worktree` for [parallel development](docs/guides/worktree-sprints.md)) |
| `/add-step <prompt>` | Add step to queue (workflow mode) |
| `/import-steps` | Bulk import from GitHub |
| `/run-sprint <dir> [--model <model>]` | Start execution loop (model: sonnet/opus/haiku) |
| `/sprint-watch` | Open live dashboard (chat view, elapsed time, progress) |
| `/sprint-status` | View progress summary |
| `/pause-sprint` | Pause after current task |
| `/resume-sprint` | Resume paused or stale sprint |
| `/stop-sprint` | Stop immediately |

## Sprint Structure

```
.claude/sprints/YYYY-MM-DD_name/
├── SPRINT.yaml       # Goal (Ralph) or steps (workflow)
├── PROGRESS.yaml     # Generated execution state
├── context/          # Cached context files
└── artifacts/        # Outputs and results
```

## When to Use Each Mode

| Ralph Mode | Workflow Mode |
|------------|---------------|
| Complex features, open-ended goals | Well-defined tasks, routine work |
| Research-heavy, exploratory work | Batched operations |
| Tasks benefiting from reflection | Known phase sequences |
| Goals where exact steps aren't known | Compliance workflows |

## Why Fresh Context?

Traditional approaches accumulate context as tasks complete, leading to:
- Slower responses as context fills
- Increased token costs
- Risk of context overflow

The **Fresh Context Pattern** gives each iteration a clean slate, enabling reliable multi-hour sprints.

## Documentation

- [User Guide](docs/USER-GUIDE.md) - Complete usage guide
- [Ralph Mode](docs/concepts/ralph-mode.md) - Autonomous goal-driven workflows
- [Commands Reference](docs/reference/commands.md) - All commands with examples
- [API Reference](docs/reference/api.md) - Status server REST API
- [Troubleshooting](docs/troubleshooting/common-issues.md) - Common issues and solutions

## License

MIT
