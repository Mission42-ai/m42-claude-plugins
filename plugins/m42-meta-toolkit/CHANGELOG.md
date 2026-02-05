# Changelog

All notable changes to the m42-meta-toolkit plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-06

### Added
- Official Documentation References section in all 7 skills with WebFetch instructions
- 38 mapped links to official Claude Code documentation (code.claude.com) across skills
- Each skill now instructs agents to fetch up-to-date docs before creating/reviewing artifacts

### Skills updated
- `creating-commands`: 5 links (plugins, plugins-reference, cli-reference, hooks-guide, sub-agents)
- `creating-skills`: 6 links (skills, plugins, plugins-reference, sub-agents, hooks, memory)
- `creating-subagents`: 6 links (sub-agents, agent-teams, plugins, plugins-reference, hooks, cli-reference)
- `creating-hooks`: 5 links (hooks-guide, hooks, plugins, plugins-reference, sub-agents)
- `crafting-agentic-prompts`: 6 links (sub-agents, output-styles, hooks-guide, headless, cli-reference, agent-teams)
- `crafting-claudemd`: 5 links (memory, output-styles, github-actions, cli-reference, agent-teams)
- `writing-ai-docs`: 4 links (memory, plugins, plugins-reference, mcp)

## [1.1.0] - 2026-02-06

### Added
- New `crafting-claudemd` skill for CLAUDE.md authoring guidance
- New `optimize-claudemd` command for optimizing existing CLAUDE.md files
- New `scan-claudemd` command for scanning and analyzing CLAUDE.md files
- New `claudemd-writer` subagent for CLAUDE.md documentation creation

### Changed
- Removed hardcoded `model: sonnet` from create-command, create-hook, create-skill, and create-subagent commands (inherits model from context)

## [1.0.0] - 2026-02-01

### Added
- Initial release
- Commands: create-command, create-hook, create-skill, create-subagent
- Skills: creating-commands, creating-hooks, creating-skills, creating-subagents, crafting-agentic-prompts, writing-ai-docs
- Subagents: artifact-quality-reviewer, agent-creator, skill-creator, doc-writer, command-creator
