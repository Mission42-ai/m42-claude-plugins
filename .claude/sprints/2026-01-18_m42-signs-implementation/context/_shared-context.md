# Shared Sprint Context

## Project Architecture

m42-claude-plugins is a plugin ecosystem for Claude Code. Each plugin lives in `plugins/<plugin-name>/` with a standardized structure:

```text
plugins/
├── m42-sprint/        # Sprint orchestration (reference implementation)
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── commands/      # Slash commands (auto-discovered)
│   ├── skills/        # LLM skills with references/assets
│   ├── scripts/       # Shell scripts and utilities
│   ├── compiler/      # TypeScript workflow compiler
│   └── docs/          # User documentation
│
└── m42-signs/         # Learning loop plugin (this sprint)
    ├── .claude-plugin/
    ├── commands/
    ├── skills/
    ├── scripts/
    └── docs/
```

## Key Patterns

### Plugin Structure Pattern
- `.claude-plugin/plugin.json`: Metadata only (name, version, description, author)
- Commands and skills are **auto-discovered** from directory structure
- No explicit declaration of commands/skills in plugin.json

### Command Pattern
- Location: `commands/<command-name>.md`
- Auto-namespaced: `commands/add.md` → `/m42-signs:add`
- Frontmatter required:
  ```yaml
  ---
  allowed-tools: Bash(ls:*), Read(*), Edit(*)
  argument-hint: <arg-description>
  description: Short description
  model: sonnet
  ---
  ```
- Sections: Preflight Checks, Context, Task Instructions, Success Criteria

### Skill Pattern
- Location: `skills/<skill-name>/`
- Structure:
  ```text
  skills/<skill-name>/
  ├── SKILL.md           # Main skill file with frontmatter
  ├── references/        # LLM-optimized reference docs
  └── assets/            # Templates, examples
  ```
- SKILL.md frontmatter:
  ```yaml
  ---
  name: skill-name
  description: When to use this skill. Triggers on "keyword1", "keyword2".
  ---
  ```
- References: Dense, structured, no prose - tables and code examples

### Script Pattern
- Location: `scripts/<script-name>.sh`
- Bash scripts for automation
- Used by commands for validation, parsing, etc.

## Conventions

### Naming
- Directories: kebab-case (`managing-signs`, `sprint-default`)
- Commands: kebab-case (`add.md`, `list.md`)
- YAML files: UPPER or kebab-case (`SPRINT.yaml`, `backlog.yaml`)
- Scripts: kebab-case with `.sh` extension

### File Structure
- All plugin content under `plugins/<plugin-name>/`
- User data in `.claude/` directories (e.g., `.claude/learnings/backlog.yaml`)
- Documentation in `docs/` subdirectory

### Testing
- No formal test framework for plugins
- Validation scripts in `scripts/`
- Manual testing via commands

### Error Handling
- Scripts use exit codes (0 = success, non-zero = failure)
- Commands check preflight conditions before execution
- Graceful fallbacks for missing files

## Commands

- **Build**: `npm run build` (TypeScript compilation)
- **Test**: `npm run test` (test suite)
- **Lint**: `npm run lint` (ESLint + format checks)
- **TypeCheck**: `npm run typecheck` (TypeScript checking)

For this plugin specifically:
- No TypeScript (pure Markdown + shell scripts)
- Validation via `scripts/validate-backlog.sh`

## Dependencies

### Internal Modules
- **m42-sprint patterns**: Command structure, skill organization
- **CLAUDE.md injection**: Native Claude Code feature for context injection
- **Session transcripts**: `~/.claude/projects/{project}/{session}.jsonl`

### External Packages
- **yq**: YAML processing in shell scripts
- **jq**: JSON processing for transcript parsing
- **Claude Code CLI**: `claude -p` for programmatic invocation

## Types and Interfaces

### Backlog Schema (YAML)
```yaml
version: 1
extracted-from: <session-id or sprint-id>
extracted-at: <ISO timestamp>

learnings:
  - id: kebab-case-id
    status: pending | approved | rejected | applied
    title: Short description
    problem: |
      Multi-line description of what went wrong
    solution: |
      Multi-line description of how to fix/avoid
    target: path/to/CLAUDE.md
    confidence: low | medium | high
    source:
      tool: <tool name>
      command: <command that failed>
      error: <error message>
```

### CLAUDE.md Sign Format
```markdown
## Signs (Accumulated Learnings)

### Sign Title
**Problem**: Description of what went wrong
**Solution**: How to fix/avoid
**Origin**: <source reference>
```

### Session Transcript Format (JSONL)
```json
{"type": "system", "subtype": "init", "session_id": "...", "tools": [...]}
{"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Bash", "input": {...}}]}}
{"type": "user", "content": [{"type": "tool_result", "is_error": true, "content": "..."}]}
{"type": "result", "subtype": "success", "total_cost_usd": 0.112}
```

## Key Files for This Sprint

| File | Purpose |
|------|---------|
| `CONCEPT.md` | Full design document with architecture |
| `SESSION-TRACKING.md` | Transcript format documentation |
| `~/.claude/projects/*/` | Session transcript storage |
| `~/.claude/history.jsonl` | User input history with session IDs |

## Sprint-Specific Notes

### Learning Loop Flow
```
1. CAPTURE     → Parse session transcript for errors
2. EXTRACT     → Identify retry patterns, infer targets
3. BACKLOG     → Write proposed learnings to backlog.yaml
4. REVIEW      → Human approves/rejects/edits
5. APPLY       → Write approved signs to CLAUDE.md files
```

### Key Decisions
- Signs stored in CLAUDE.md (native injection) not separate files
- Backlog is staging area for human review
- Confidence scoring: low/medium/high based on pattern clarity
- Target inference from file paths in tool calls
