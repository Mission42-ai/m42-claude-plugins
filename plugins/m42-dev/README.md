# M42 Dev Plugin

Development toolkit for software engineers - specs, planning, and daily practice support.

## Overview

The M42 Dev plugin provides tools to support engineers in their daily development practice:

- **Specification Writing** - Create clear, actionable specs before coding
- **Planning Support** - Break down tasks and organize work
- **Engineering Best Practices** - Guidance for quality implementation

## Installation

```bash
claude mcp add-json m42-dev '{"type": "claude-plugin", "source": "https://github.com/mission42-ai/m42-claude-plugins", "plugin": "m42-dev"}'
```

## Features

### Skills

| Skill | Description |
|-------|-------------|
| `creating-specs` | Guide for writing effective specification files |

## Usage

### Quick Start

Use skills for guidance while working:

```
Skill(command='creating-specs')
```

## Directory Structure

```
m42-dev/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── CLAUDE.md
├── skills/
│   └── creating-specs/
├── commands/
└── agents/
```

## License

MIT
