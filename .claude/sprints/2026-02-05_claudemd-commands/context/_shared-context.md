# Sprint Context: CLAUDE.md Workflow Commands

## Project Info
- **Test framework**: Bash scenario tests (SCORE/TOTAL pattern) for integration; custom Node.js test runner for unit tests (m42-sprint only)
- **Test location**: `tests/` (root, integration), `plugins/*/tests/` (plugin-specific), `plugins/*/e2e/` (end-to-end)
- **Build command**: N/A for m42-meta-toolkit (no TypeScript compilation; artifacts are .md files)
- **Test command**: N/A for m42-meta-toolkit (no existing test suite)
- **Lint command**: N/A for m42-meta-toolkit
- **Plugin location**: `plugins/m42-meta-toolkit/`

## Sprint Steps Overview

### Step 1: `scan-claudemd-command`
Create `/scan-claudemd` command at `plugins/m42-meta-toolkit/commands/scan-claudemd.md`.
- **Purpose**: Read-only diagnostic that scans project CLAUDE.md files and produces structured report
- **Integrations**: Invokes `Skill(skill='crafting-claudemd')` for domain knowledge; runs `scripts/scan_claudemd.sh` and `scripts/validate_claudemd.py` from that skill
- **Output**: Unified report with file list, loading types, line counts, validation results, recommendations
- **Dependencies**: None (standalone command)

### Step 2: `claudemd-agent`
Create `claudemd-writer` subagent at `plugins/m42-meta-toolkit/agents/claudemd-writer.md`.
- **Purpose**: Dual-mode subagent for CLAUDE.md creation/update
- **Mode A**: Prompt-based creation/update of CLAUDE.md files following best practices
- **Mode B**: Commit review extraction - analyzes git diffs for conventions/gotchas worth capturing
- **Critical constraint**: Must NOT create/update files if nothing meaningful to add; most commits yield "No updates needed"
- **Integrations**: Invokes `Skill(skill='crafting-claudemd')` for best practices
- **Tools needed**: Read, Write, Edit, Bash, Skill, Grep, Glob
- **Dependencies**: None (standalone subagent)

### Step 3: `optimize-claudemd-command`
Create `/optimize-claudemd` command at `plugins/m42-meta-toolkit/commands/optimize-claudemd.md`.
- **Purpose**: Full CLAUDE.md audit and optimization orchestrator
- **Phase 1 - Discovery**: Map repo structure, identify strategic folders, run scan script, produce prioritized plan
- **Phase 2 - Delegation**: Spawn parallel `claudemd-writer` subagents for each folder
- **Phase 3 - QA**: Re-scan, validate all files, check budget, produce final report
- **Integrations**: Invokes `Skill(skill='crafting-claudemd')` for scripts; delegates to `claudemd-writer` subagent via `Task(subagent_type='m42-meta-toolkit:claudemd-writer')`
- **Dependencies**: Requires `claudemd-writer` subagent from Step 2

## Patterns to Follow

### Command Structure (from existing create-command.md, create-skill.md)
```markdown
---
allowed-tools: Read, Write, Edit, Glob, Bash(...), Task, TodoWrite, Skill
argument-hint: <description-of-input>
description: Clear description of what command does
model: sonnet
---

## Preflight Checks
- Check description: !`command && echo "✓" || echo "⚠"`

## Context
- Dynamic info: !`command`

## Your Task
[Instructions referencing $ARGUMENTS]

## Success Criteria
[Concrete, measurable bullets]

IMPORTANT: Only work in ultrathink mode...
```

### Subagent Structure (from existing doc-writer.md, artifact-quality-reviewer.md)
```markdown
---
name: kebab-case-name
description: What it does. When to use it.
tools: Read, Write, Edit, Bash, Skill, Grep, Glob
model: inherit
color: blue|cyan|purple|green|yellow
---

[Imperative prompt - 50-200 words, no second-person]
[Action-first, starts with verb]
[Invokes Skill() for domain knowledge]
[Structured output format if needed]
```

### Color Coding Convention
- **Cyan**: Research/analysis
- **Purple**: Review/audit
- **Blue**: Implementation/creation
- **Green**: Testing/execution
- **Yellow**: Documentation

### Operator Pattern
- Commands contain ONLY: argument parsing, preflight checks, Task() orchestration, output aggregation
- All domain knowledge lives in Skills (loaded via `Skill()`)
- Subagents invoke `Skill()` to load domain knowledge - they don't embed it

### Key Skill Integration
The `crafting-claudemd` skill provides:
- **SKILL.md**: Core guidance on CLAUDE.md best practices, essential sections, decision tree
- **scripts/scan_claudemd.sh**: Discovers all CLAUDE.md files, annotates loading behavior, shows line counts
- **scripts/validate_claudemd.py**: Validates against best practices (size, structure, anti-patterns, content coverage)
- **references/claudemd-best-practices.md**: Writing style rules, content categories, anti-patterns
- **references/claudemd-architecture.md**: File hierarchy, loading order, monorepo patterns

Scripts are executed from the skill's directory. Commands reference them relative to the skill path.

### Plugin Registration
The `plugin.json` at `plugins/m42-meta-toolkit/.claude-plugin/plugin.json` contains metadata only. Artifact discovery is automatic based on directory structure and frontmatter.

## Existing Artifacts in m42-meta-toolkit

### Commands (4 existing)
- `create-skill.md` - Interactive skill creation with quality review
- `create-command.md` - Interactive command creation with quality review
- `create-subagent.md` - Interactive subagent creation with quality review
- `create-hook.md` - Interactive hook creation with quality review

### Subagents (5 existing)
- `skill-creator.md` - Programmatic skill creation
- `command-creator.md` - Programmatic command creation
- `agent-creator.md` - Programmatic agent creation
- `doc-writer.md` - Documentation automation
- `artifact-quality-reviewer.md` - Quality validation (scoring 1-5)

### Skills (7 existing)
- `creating-skills/` - Skill creation domain knowledge
- `creating-commands/` - Command creation domain knowledge
- `creating-subagents/` - Subagent creation domain knowledge
- `creating-hooks/` - Hook creation domain knowledge
- `crafting-agentic-prompts/` - Prompt engineering best practices
- `writing-ai-docs/` - AI-ready documentation guidance
- `crafting-claudemd/` - CLAUDE.md best practices (used by this sprint)

## Step Execution Notes

Each step uses the `/m42-meta-toolkit:create-command` or `/m42-meta-toolkit:create-subagent` skill invocation. These commands handle:
1. Analyzing the description and determining artifact name/location
2. Validating artifact type (command vs skill vs subagent)
3. Drafting using the appropriate creating-* skill
4. Independent review via artifact-quality-reviewer subagent
5. Iteration until scores >= 4/5
6. Writing the final artifact

Steps 1 and 2 are independent and can run in parallel. Step 3 depends on Step 2 (needs claudemd-writer subagent).
