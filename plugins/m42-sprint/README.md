# M42 Sprint Plugin

Sprint orchestration with ralph-loop driven task queue processing for Claude Code.

## Dependencies

This plugin requires:
- **m42-ralph-loop** (>=1.0.0) - Provides autonomous task processing via self-referential loops

The m42-ralph-loop plugin is part of the same marketplace and will be automatically installed when you install m42-sprint.

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
| `/run-sprint [--max-iterations N]` | Start ralph-loop execution |
| `/sprint-status` | View progress dashboard |
| `/pause-sprint` | Pause after current task |
| `/resume-sprint` | Resume paused sprint |

## Quick Start

```bash
# 1. Create a sprint
/start-sprint auth-feature

# 2. Add tasks
/add-task issue 123
/add-task issue 124
/add-task refactor src/auth/ --goal "Migrate to new patterns"

# 3. Run the sprint
/run-sprint --max-iterations 20

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

## Ralph-Loop Integration

The `/run-sprint` command leverages ralph-loop for autonomous task processing:
- Each iteration processes ONE task
- Progress persisted after each task
- Completion promise signals done/blocked/paused

## Structure

```
m42-sprint-plugin/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── start-sprint.md
│   ├── add-task.md
│   ├── run-sprint.md
│   ├── sprint-status.md
│   ├── pause-sprint.md
│   ├── resume-sprint.md
│   └── import-tasks.md
├── skills/
│   └── orchestrating-sprints/
│       ├── SKILL.md
│       ├── references/
│       └── assets/
└── README.md
```

## License

MIT
