# M42 Sprint Plugin

Sprint orchestration with **fresh context per task** for Claude Code.

## What is M42 Sprint?

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  SPRINT.yaml    │ ──► │   Compiler   │ ──► │ PROGRESS.yaml   │
│  (your steps)   │     │  (expands)   │     │ (execution plan)│
└─────────────────┘     └──────────────┘     └────────┬────────┘
                                                      │
                                                      ▼
                                             ┌─────────────────┐
                                             │   Ralph Loop    │
                                             │ (fresh context  │
                                             │   per phase)    │
                                             └─────────────────┘
```

**The Ralph Loop** solves context accumulation: each task runs in a fresh Claude session, preventing the slowdown that happens when context fills up during long sprints.

## Quick Links

| Getting Started | Deep Dives | Reference |
|-----------------|------------|-----------|
| [Quick Start](docs/getting-started/quick-start.md) | [Architecture Overview](docs/concepts/overview.md) | [Commands](docs/reference/commands.md) |
| [First Sprint](docs/getting-started/first-sprint.md) | [Ralph Loop Pattern](docs/concepts/ralph-loop.md) | [SPRINT.yaml Schema](docs/reference/sprint-yaml-schema.md) |
| [Writing Sprints](docs/guides/writing-sprints.md) | [Workflow Compilation](docs/concepts/workflow-compilation.md) | [PROGRESS.yaml Schema](docs/reference/progress-yaml-schema.md) |

## 30-Second Example

```bash
# 1. Create sprint
/start-sprint my-feature

# 2. Add steps
/add-step "Create user model with validation"
/add-step "Add API endpoints for CRUD operations"

# 3. Run it
/run-sprint .claude/sprints/2026-01-16_my-feature

# 4. Watch progress
/sprint-status
```

Each step runs with fresh context. No slowdown. No context pollution.

## Installation

```bash
claude plugin install m42-sprint
```

Requirements:
- Claude Code CLI
- `yq` for YAML: `brew install yq` (macOS) or `snap install yq` (Linux)

## Commands

| Command | Description |
|---------|-------------|
| `/start-sprint <name>` | Initialize new sprint |
| `/add-step <prompt>` | Add step to queue |
| `/import-steps` | Bulk import from GitHub |
| `/run-sprint <dir>` | Start execution loop |
| `/sprint-status` | View progress dashboard |
| `/pause-sprint` | Pause after current task |
| `/resume-sprint` | Resume paused sprint |
| `/stop-sprint` | Stop immediately |

## Sprint Structure

```
.claude/sprints/YYYY-MM-DD_name/
├── SPRINT.yaml       # Your steps and config
├── PROGRESS.yaml     # Generated execution plan
├── context/          # Cached context files
└── artifacts/        # Outputs and results
```

## Why Fresh Context?

Traditional approaches accumulate context as tasks complete, leading to:
- Slower responses as context fills
- Increased token costs
- Risk of context overflow

The **Fresh Context Pattern** gives each phase a clean slate, enabling reliable multi-hour sprints.

## Troubleshooting

See [Common Issues](docs/troubleshooting/common-issues.md) or run `/help` for command details.

## License

MIT
