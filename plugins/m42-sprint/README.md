# M42 Sprint Plugin

Sprint orchestration with autonomous task queue processing for Claude Code.

## Installation

```bash
claude plugin install m42-sprint
```

Or from URL:
```bash
claude plugin add https://github.com/mission42-ai/m42-sprint-plugin
```

## Commands

| Command | Description |
|---------|-------------|
| `/start-sprint <name>` | Initialize new sprint directory |
| `/add-task issue <num>` | Add GitHub issue to queue |
| `/add-task refactor <path> --goal "..."` | Add refactor task |
| `/add-task docs <path> --changes "..."` | Add documentation task |
| `/add-task custom --desc "..." --done "..."` | Add custom task |
| `/import-tasks issues --label <label>` | Bulk import by label |
| `/run-sprint <dir> [--max-iterations N]` | Start sprint execution loop |
| `/sprint-status` | View progress dashboard |
| `/pause-sprint` | Pause gracefully after current task |
| `/resume-sprint` | Resume paused sprint |
| `/stop-sprint` | Forcefully stop active loop |
| `/help` | Show plugin help and commands |

## Quick Start

```bash
# 1. Create a sprint
/start-sprint auth-feature

# 2. Add tasks
/add-task issue 123
/add-task issue 124
/add-task refactor src/auth/ --goal "Migrate to new patterns"

# 3. Run the sprint
/run-sprint .claude/sprints/2026-01-15_auth-feature --max-iterations 20

# 4. Check progress
/sprint-status
```

## Sprint Structure

```
.claude/sprints/YYYY-MM-DD_sprint-name/
├── SPRINT.yaml       # Configuration
├── PROGRESS.yaml     # Task queue and state
├── context/          # Cached context
└── artifacts/        # Outputs
```

## Task Types

### implement-issue
Implement a GitHub issue. Fetches issue details, parses gherkin, creates PR.

### refactor
Refactor code files. Specify target path, goal, and done-when criteria.

### update-docs
Update documentation. Specify doc path, changes, and validation.

### custom
Arbitrary task with explicit description and completion criteria.

## Loop Mechanism

The sprint uses the **Ralph Loop pattern** for autonomous task processing with fresh context per task:

1. `/run-sprint` launches `sprint-loop.sh` as a background task
2. Bash loop invokes `claude -p` for ONE task (fresh context)
3. Claude executes the task from the queue
4. Updates PROGRESS.yaml and exits
5. Bash loop checks status from PROGRESS.yaml
6. If not complete, starts NEW Claude invocation with fresh context
7. Continues until completed, blocked, or paused

**Status Values:**
- `completed` - All tasks done, queue empty
- `blocked` - Current task cannot proceed
- `paused` - Pause was requested
- `needs-human` - Human decision required

**Key Benefits:**
- 100% context utilization per task (no accumulation)
- Reliable for long sprints
- Status-based control via PROGRESS.yaml

## State Management

All sprint state is contained within the sprint directory:
- **SPRINT.yaml** - Sprint configuration and goals
- **PROGRESS.yaml** - Task queue, completed/blocked lists, stats, status

This sprint-contained approach allows multiple sprints to exist simultaneously.

## Requirements

- Claude Code CLI
- `yq` for YAML processing: `brew install yq` (macOS) or `snap install yq` (Linux)

## Structure

```
m42-sprint-plugin/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── start-sprint.md
│   ├── add-task.md
│   ├── import-tasks.md
│   ├── run-sprint.md
│   ├── sprint-status.md
│   ├── pause-sprint.md
│   ├── resume-sprint.md
│   ├── stop-sprint.md
│   └── help.md
├── scripts/
│   ├── sprint-loop.sh
│   ├── build-sprint-prompt.sh
│   └── setup-sprint-loop.sh
├── skills/
│   └── orchestrating-sprints/
│       ├── SKILL.md
│       ├── references/
│       └── assets/
├── docs/
│   └── USER-GUIDE.md
└── README.md
```

## License

MIT
