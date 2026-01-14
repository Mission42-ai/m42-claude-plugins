# M42 Claude Plugins

A marketplace of Claude Code plugins for modular development workflows.

## Installation

Add this marketplace to Claude Code:

```bash
claude marketplace add https://github.com/mission42-ai/m42-claude-plugins
```

Then install individual plugins:

```bash
claude plugin install m42-planning
claude plugin install m42-sprint
claude plugin install m42-task-execution
```

Or install all plugins:

```bash
claude plugin install m42-planning m42-sprint m42-task-execution
```

## Plugins

### m42-planning

Epic and story planning with GitHub integration, gherkin-based acceptance criteria, and structured issue templates.

**Features:**
- Epic and story planning workflows
- Gherkin acceptance criteria patterns
- GitHub issue templates (epic.yml, story.yml)
- DEEP estimation methodology

### m42-sprint

Sprint orchestration with ralph-loop driven task queue processing.

**Features:**
- `/start-sprint` - Initialize new sprint
- `/add-task` - Add tasks to queue (issue, refactor, docs, custom)
- `/run-sprint` - Start ralph-loop execution
- `/sprint-status` - View progress dashboard
- `/pause-sprint` / `/resume-sprint` - Control execution
- `/import-tasks` - Bulk import from GitHub

### m42-task-execution

Reusable 6-phase task execution workflow.

**Features:**
- 6-phase workflow (Context → Planning → Execution → Quality → Progress → Learning)
- Quality gates (build, typecheck, lint, test)
- Learning documentation
- Context caching

## Architecture

```
Building Block 1: Planning ─────> m42-planning
         │
         ▼
Building Block 2: Sprint ───────> m42-sprint
         │
         ▼
Building Block 3: Execution ────> m42-task-execution
```

Each plugin is independent but they compose together for end-to-end automation.

## Repository Structure

```
m42-claude-plugins/
├── .claude-plugin/
│   └── marketplace.json      # Plugin registry
├── plugins/
│   ├── m42-planning/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── skills/
│   │   │   └── epic-story-planning/
│   │   └── templates/
│   ├── m42-sprint/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── commands/
│   │   └── skills/
│   │       └── orchestrating-sprints/
│   └── m42-task-execution/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       └── skills/
│           └── task-execution/
└── README.md
```

## License

MIT
