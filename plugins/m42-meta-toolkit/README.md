# M42 Meta-Toolkit Plugin

Meta-tooling for creating and managing Claude Code artifacts with quality assurance workflows.

## Overview

The M42 Meta-Toolkit provides a layered component architecture for building Claude Code artifacts:

```
COMMANDS (User-facing workflows)
    /create-skill, /create-command, /create-subagent, /create-hook
         │
         ▼
SKILLS (Reusable knowledge)
    creating-skills, creating-commands, creating-subagents
    creating-hooks, crafting-agentic-prompts, writing-ai-docs
         │
         ▼
SUBAGENTS (Autonomous executors)
    skill-creator, command-creator, agent-creator
    doc-writer, artifact-quality-reviewer
```

## Installation

```bash
claude mcp add-json m42-meta-toolkit '{"type": "claude-plugin", "source": "https://github.com/mission42-ai/m42-claude-plugins", "plugin": "m42-meta-toolkit"}'
```

## Features

### Skills (6)

| Skill | Description |
|-------|-------------|
| `creating-skills` | Create skills with bundled resources (scripts, references, templates) |
| `creating-commands` | Create slash commands with preflight checks and validation |
| `creating-subagents` | Create specialized task agents with concise prompts |
| `creating-hooks` | Create event-driven hooks for automation |
| `crafting-agentic-prompts` | Prompt engineering best practices for agentic workflows |
| `writing-ai-docs` | AI-ready documentation principles and templates |

### Commands (4)

| Command | Description |
|---------|-------------|
| `/create-skill` | Interactive skill creation with quality review |
| `/create-command` | Interactive command creation with validation |
| `/create-subagent` | Interactive subagent creation |
| `/create-hook` | Interactive hook creation |

### Subagents (5)

| Agent | Description |
|-------|-------------|
| `skill-creator` | Programmatic skill creation for batch operations |
| `command-creator` | Programmatic command creation for batch operations |
| `agent-creator` | Programmatic subagent creation for batch operations |
| `doc-writer` | AI-ready documentation creation |
| `artifact-quality-reviewer` | Independent quality review for all artifact types |

## Usage

### Quick Start

Use slash commands for guided workflows with quality gates:

```bash
/create-skill <description>      # Create a new skill
/create-command <description>    # Create a new slash command
/create-subagent <description>   # Create a new subagent
/create-hook <description>       # Create a new hook
```

### When to Create Each Artifact Type

**Skill** - Complex workflow requiring >200 lines, needs bundled resources, should auto-trigger

**Command** - Simple workflow <200 lines, single-file, manually triggered, needs preflight checks

**Subagent** - Separate domain, autonomous execution, dedicated scope, orchestrates skills

**Hook** - Event-driven automation, validation on tool calls, context injection

### Direct Skill Invocation

For guidance while working:

```
Skill(command='creating-skills')
Skill(command='crafting-agentic-prompts')
Skill(command='writing-ai-docs')
```

### Quality Assurance

All artifacts undergo independent quality review:

- Automated validation (frontmatter, structure, naming)
- Independent review via `artifact-quality-reviewer`
- Iteration until scores ≥4/5 across all categories

## Directory Structure

```
m42-meta-toolkit/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── skills/
│   ├── creating-skills/
│   │   ├── SKILL.md
│   │   ├── scripts/
│   │   └── references/
│   ├── creating-commands/
│   ├── creating-subagents/
│   ├── creating-hooks/
│   ├── crafting-agentic-prompts/
│   └── writing-ai-docs/
├── commands/
│   ├── create-skill.md
│   ├── create-command.md
│   ├── create-subagent.md
│   └── create-hook.md
└── agents/
    ├── skill-creator.md
    ├── command-creator.md
    ├── agent-creator.md
    ├── doc-writer.md
    └── artifact-quality-reviewer.md
```

## Key Concepts

### Progressive Disclosure (Skills)

Skills load in 3 levels:
1. **Metadata** (~100 words) - Name, description, triggers
2. **SKILL.md** (<5k words) - Core methodology
3. **Bundled resources** (unlimited) - Scripts, references, templates

### Tool Restrictions (Commands)

Commands specify exact allowed tools in frontmatter to prevent unintended side effects.

### Skill Integration (Subagents)

Subagents keep prompts minimal by invoking skills for complex knowledge.

## License

MIT
