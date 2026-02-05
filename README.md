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
claude plugin install m42-meta-toolkit
claude plugin install m42-signs
claude plugin install m42-dev
```

Or install all plugins:

```bash
claude plugin install m42-planning m42-sprint m42-task-execution m42-meta-toolkit m42-signs m42-dev
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

### m42-meta-toolkit

Meta-tooling for creating and managing Claude Code artifacts (skills, commands, subagents, hooks) with quality assurance workflows.

**Features:**
- `/create-skill` - Create new skills with proper structure and frontmatter
- `/create-command` - Create new slash commands
- `/create-subagent` - Create new subagents with validation
- `/create-hook` - Create new hooks
- `/scan-claudemd` - Scan CLAUDE.md files for issues
- `/optimize-claudemd` - Optimize CLAUDE.md content

### m42-signs

Learning extraction and management from session transcripts. Extracts wisdom from session failures and applies them as learnings in CLAUDE.md files.

**Features:**
- `/extract` - Extract learnings from session transcripts
- `/review` - Review extracted learnings before applying
- `/apply` - Apply approved learnings to CLAUDE.md files
- `/add` - Manually add a learning
- `/list` - List current learnings in backlog
- `/status` - View learning pipeline status

### m42-dev

Development utilities for software engineers - specs, planning, and daily practice support. (Early development)

**Features:**
- `creating-specs` skill - Guide for writing effective specification files

## Architecture

```
Workflow Plugins:
  Planning ──────────────> m42-planning
       │
       ▼
  Sprint ────────────────> m42-sprint
       │
       ▼
  Execution ─────────────> m42-task-execution

Tooling Plugins:
  Meta-tooling ──────────> m42-meta-toolkit
  Learning Loop ─────────> m42-signs
  Dev Utilities ─────────> m42-dev
```

Each plugin is independent but they compose together for end-to-end automation. Workflow plugins handle the planning-to-execution pipeline. Tooling plugins provide cross-cutting utilities for plugin development, learning management, and engineering practices.

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
│   ├── m42-task-execution/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   └── skills/
│   │       └── task-execution/
│   ├── m42-meta-toolkit/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── commands/
│   │   ├── agents/
│   │   └── skills/
│   ├── m42-signs/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── commands/
│   │   ├── agents/
│   │   └── skills/
│   └── m42-dev/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── commands/
│       ├── agents/
│       └── skills/
└── README.md
```

## License

MIT
