# Sprint Context: sprint-creator-subagent

## Project Info

- **Test framework**: Custom TypeScript test runner (no Jest/Vitest)
- **Test location**: `*.test.ts` files colocated with source in `compiler/src/` and `runtime/src/`
- **Build command**: `npm run build` (uses `tsc`)
- **Test command**: `npm run test` (builds then runs `node dist/*.test.js`)
- **Lint command**: Not configured in package.json (use `tsc --noEmit` for type checking)

### Directory Structure
```
plugins/m42-sprint/
├── commands/           # User-facing slash commands (.md files)
├── skills/             # Domain knowledge guides (SKILL.md in subdirs)
├── subagents/          # Specialized agents (this sprint adds here)
├── compiler/src/       # SPRINT.yaml → PROGRESS.yaml compilation
├── runtime/src/        # Sprint execution engine
├── e2e/                # End-to-end tests
├── docs/               # User documentation
└── .claude-plugin/     # Plugin metadata
```

## Patterns to Follow

### Skill Structure
Skills are markdown files with YAML frontmatter:
```yaml
---
name: skill-name
description: What this skill does
---
# Markdown content with references, examples, assets
```

Triggers are implicit from description keywords (e.g., "create sprint", "define steps").

### Subagent Structure
Subagents are defined in `subagents/<name>/SUBAGENT.yaml`:
```yaml
---
name: subagent-name
description: What this subagent does
tools: [Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion]
---
Prompt content describing the subagent's role, capabilities, and behavior.
```

Subagents can reference skills using `Skill tool: /plugin:skill-name`.

### Key Integration Points
1. **init-sprint command**: Creates sprint directories, should optionally invoke sprint-creator subagent
2. **Skill invocation**: Use `Skill tool` to load domain knowledge during execution
3. **AskUserQuestion**: Used for clarifying ambiguous plan content

### SPRINT.yaml Schema (key fields)
```yaml
workflow: workflow-name          # Required: workflow template
collections:
  step:
    - id: unique-id              # Optional but recommended
      prompt: |                  # Task description
        Multi-line prompt here
      depends-on: [other-id]     # Optional: dependencies
      model: opus                # Optional: model override
sprint-id: YYYY-MM-DD_name       # Auto-generated
name: human-readable-name
created: ISO-8601-timestamp
worktree:                        # Optional: git isolation
  enabled: true
  branch: sprint/{sprint-id}
  path: ../{sprint-id}-worktree
  cleanup: on-complete
```

### Existing Skills to Reference
- `creating-sprints`: Full guide for SPRINT.yaml structure (249 lines)
- `creating-workflows`: Workflow authoring patterns
- `orchestrating-sprints`: Sprint execution concepts

## Sprint Steps Overview

### Step 1: creating-sprints-skill
**Goal**: Create a skill containing domain knowledge for transforming plan documents into SPRINT.yaml files.

**Content to include**:
- SPRINT.yaml schema and structure
- How to extract steps from plan documents
- Workflow selection guidance based on task types
- Collection item patterns and examples
- Best practices for step prompts

**Dependencies**: None (foundational knowledge artifact)

### Step 2: sprint-creator-subagent
**Goal**: Create a subagent that parses plan files and generates properly structured SPRINT.yaml files.

**Capabilities**:
- Parse plan files (markdown) to understand goals and tasks
- Generate SPRINT.yaml with appropriate structure
- Support additional context documents (requirements, specs)
- Reference the creating-sprints skill for domain knowledge

**Integration points**:
- Works with /init-sprint command flow
- Integrates with m42-sprint plugin structure

**User experience**:
- Accept plan file paths as input
- Ask clarifying questions when plan is ambiguous
- Generate step collection items from plan tasks
- Suggest appropriate workflow based on plan content

**Dependencies**: Step 1 (creating-sprints-skill) provides the domain knowledge this subagent references

## Development Notes

### Testing Strategy
- Skills don't require unit tests (they're documentation)
- Subagents should be tested via integration tests in `e2e/`
- Use existing test helpers from `e2e/test-helpers.ts`

### File Locations for This Sprint
- Skill: `plugins/m42-sprint/skills/creating-sprints-from-plans/SKILL.md`
- Subagent: `plugins/m42-sprint/subagents/sprint-creator/SUBAGENT.yaml`

### Workflow Reference
This sprint uses `plugin-development` workflow which follows TDD (RED/GREEN/REFACTOR) with operator-driven subagent delegation.
