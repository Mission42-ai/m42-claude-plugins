# Shared Sprint Context

## Sprint Goal

Add large transcript handling to the m42-signs plugin to enable extraction of learnings from session transcripts that exceed token limits (>100 lines or >500KB).

## Project Architecture

### Repository Structure

This is a Claude Code plugin repository containing multiple plugins:
- **m42-signs**: Learning loop for agent evolution - extracts wisdom from sessions
- **m42-sprint**: Sprint orchestration and workflow automation
- **m42-meta-toolkit**: Meta-tooling for creating commands, skills, subagents
- **m42-planning**: Planning tools
- **m42-task-execution**: Task execution helpers

### Plugin Structure Pattern

Each plugin follows this structure:
```
plugins/<plugin-name>/
├── .claude-plugin/
│   └── plugin.json       # Plugin metadata
├── CLAUDE.md             # Plugin-specific instructions
├── README.md             # User documentation
├── commands/             # Slash command definitions (.md files)
├── skills/               # Skill definitions with references/assets
│   └── <skill-name>/
│       ├── SKILL.md
│       ├── references/
│       └── assets/
├── agents/               # Subagent definitions (.md files)
├── scripts/              # Shell scripts for automation
└── docs/                 # User-facing documentation
    ├── getting-started.md
    ├── how-to/
    └── reference/
```

### m42-signs Plugin Specifics

**Commands** (plugins/m42-signs/commands/):
- `extract.md` - Extract learnings from transcripts (PRIMARY TARGET for enhancement)
- `add.md` - Add sign manually
- `list.md` - List backlog
- `review.md` - Interactive review
- `apply.md` - Apply approved signs
- `status.md` - Backlog summary
- `help.md` - Help info

**Scripts** (plugins/m42-signs/scripts/):
- `parse-transcript.sh` - DEPRECATED - shows jq patterns for transcript parsing
- `find-retry-patterns.sh` - Find retry patterns
- `infer-target.sh` - Infer target CLAUDE.md
- `validate-backlog.sh` - Validate backlog YAML

**Data Locations**:
- Backlog: `.claude/learnings/backlog.yaml`
- Transcripts: `.claude/sprints/<sprint-id>/transcripts/<name>.jsonl`

## Key Patterns

### Command Frontmatter

Commands use YAML frontmatter for tool permissions and metadata:
```yaml
---
allowed-tools: Bash(test:*, mkdir:*), Read(*), Write(*), Edit(*)
argument-hint: "<required> [optional]"
description: Short description
model: sonnet
---
```

### Preflight Checks Pattern

Commands start with bash preflight checks to validate environment:
```markdown
## Preflight Checks

1. Check if directory exists:
   !`test -d .claude/learnings && echo "EXISTS" || echo "NOT_EXISTS"`

2. List existing files:
   !`find . -name "CLAUDE.md" | head -20`
```

### Shell Script Patterns

Scripts follow this structure:
```bash
#!/bin/bash
set -euo pipefail

FILE="${1:?Usage: script.sh <file>}"

command -v jq &>/dev/null || { echo "Error: jq required" >&2; exit 1; }

# Main logic using jq
jq '...' "$FILE"
```

### Subagent Definition Pattern

Subagents are defined in markdown with frontmatter:
```markdown
---
name: chunk-analyzer
description: Analyze preprocessed transcript chunk
tools: Read, Bash
model: sonnet
color: cyan
---

Instructions for the subagent...
```

## Transcript Format (JSONL)

Each line is one of these types:
- `system/init`: Session metadata
- `assistant`: Claude responses with text blocks and tool_use
- `user`: User input or tool_result blocks
- `result`: Session end stats

Learning extraction focuses on `assistant` type with `text` blocks containing reasoning.

## Commands

- **Build**: N/A (pure markdown/bash plugin)
- **Test**: Manual testing via `/m42-signs:extract <path> --dry-run`
- **Test (scripts)**: `./plugins/m42-signs/scripts/<script>.sh <args>`
- **Lint**: N/A
- **TypeCheck**: N/A

## Documentation Structure

### m42-signs Documentation

| Path | Status | Purpose |
|------|--------|---------|
| `plugins/m42-signs/README.md` | exists | Overview |
| `plugins/m42-signs/docs/getting-started.md` | exists | Quick start guide |
| `plugins/m42-signs/docs/reference/commands.md` | exists | Command reference |
| `plugins/m42-signs/docs/reference/backlog-format.md` | exists | Backlog YAML schema |
| `plugins/m42-signs/docs/reference/sign-format.md` | exists | Sign output format |
| `plugins/m42-signs/docs/how-to/add-sign-manually.md` | exists | Manual sign addition |
| `plugins/m42-signs/docs/how-to/extract-from-session.md` | exists | Extraction guide |
| `plugins/m42-signs/docs/how-to/review-and-apply.md` | exists | Review workflow |
| `plugins/m42-signs/docs/how-to/integrate-with-sprint.md` | exists | Sprint integration |
| `plugins/m42-signs/docs/how-to/handle-large-transcripts.md` | **NEW** | Large transcript handling |

## Dependencies

### External Tools Required

- `jq` - JSON processor for transcript parsing
- `split` - Unix utility for chunking (standard)
- `wc` - Line counting (standard)
- `stat` - File size (standard)

### Internal Modules

- `managing-signs` skill - Core skill with references and assets
- `backlog-schema.md` - Backlog validation schema
- `transcript-format.md` - Transcript parsing reference

## Testing Context

Large transcript for testing:
- `.claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl`
- 82 lines, ~200KB

Thresholds defined in plan:
- Large transcript: >100 lines OR >500KB
- Chunk size: 50 blocks per chunk

## Files to Create/Modify

| File | Action | Step |
|------|--------|------|
| `plugins/m42-signs/scripts/extract-reasoning.sh` | Create | 0 |
| `plugins/m42-signs/scripts/transcript-summary.sh` | Create | 0 |
| `plugins/m42-signs/scripts/find-learning-lines.sh` | Create | 0 |
| `plugins/m42-signs/agents/chunk-analyzer.md` | Create | 1 |
| `plugins/m42-signs/commands/extract.md` | Modify | 2 |
| `plugins/m42-signs/docs/how-to/handle-large-transcripts.md` | Create | 3 |
