# Sprint Context

## Project Info

- **Project Type**: Claude Code Plugin Marketplace (TypeScript, Bash, YAML)
- **Test Framework**: Bash scenario tests with SCORE/TOTAL pattern
- **Test Location**: `tests/*.sh`
- **Build Command**: `npm run build`
- **Test Command**: `npm run test`
- **Lint/Typecheck Command**: `npm run typecheck`

## Key File Paths

| Purpose | Path |
|---------|------|
| Extract command (to refactor) | `plugins/m42-signs/commands/extract.md` |
| Chunk analyzer (to deprecate) | `plugins/m42-signs/agents/chunk-analyzer.md` |
| Managing signs skill (pattern) | `plugins/m42-signs/skills/managing-signs/` |
| Meta-toolkit agents (patterns) | `plugins/m42-meta-toolkit/agents/` |
| Creating-subagents skill | `plugins/m42-meta-toolkit/skills/creating-subagents/` |
| Creating-skills skill | `plugins/m42-meta-toolkit/skills/creating-skills/` |
| Preprocessing script | `plugins/m42-signs/scripts/find-learning-lines.sh` |

## Patterns to Follow

### Skill Structure
```
skills/<skill-name>/
├── SKILL.md          # Main doc with frontmatter (name, description)
└── references/       # Supporting materials (schemas, examples)
```

### Subagent Structure
```yaml
---
name: agent-name
description: When/why to invoke (for proactive triggers)
tools: Read, Bash, Skill  # Minimal necessary tools
model: sonnet
color: cyan|purple|etc
---

[Role - 1 sentence]

[Core instructions - 3-5 directives]

[Skill invocation: Invoke Skill(command='skill-name')]
```

### Subagent Colors
- **cyan**: Research/analysis (transcript-section-analyzer)
- **purple**: Review/audit (context-matcher, quality-reviewer)
- **blue**: Implementation/development
- **green**: Testing/validation

### Operator Pattern
Commands orchestrate via Task() tool calls, domain logic lives in skills:
```
Command (Operator)
├── Parse args, preflight
├── Task(subagent-1, input) → parallel
├── Task(subagent-2, results) → sequential
└── Aggregate and output
```

### Skill Invocation (from subagents)
```markdown
Invoke Skill(command='learning-extraction') for taxonomy and quality criteria
```

## Sprint Steps Overview

| Step | Purpose | Dependencies |
|------|---------|--------------|
| **create-skill** | Create learning-extraction skill with taxonomy, quality criteria, patterns, scoring | None |
| **create-analyzer-agent** | Create transcript-section-analyzer subagent (replaces chunk-analyzer) | create-skill |
| **create-matcher-agent** | Create context-matcher subagent (CLAUDE.md targeting, deduplication) | None |
| **create-reviewer-agent** | Create quality-reviewer subagent (scoring, filtering) | create-skill |
| **refactor-command** | Refactor extract.md to operator pattern (~400→~150 lines) | All subagents |
| **cleanup** | Deprecate chunk-analyzer, fix find-learning-lines.sh | refactor-command |
| **test-e2e** | End-to-end testing with sample transcripts | All above |

## Backlog Schema (for reference)

```yaml
version: 1
extracted-from: session-id
extracted-at: ISO 8601
learnings:
  - id: kebab-case-id
    status: pending
    title: Short description
    problem: |
      What situation/challenge?
    solution: |
      What insight/approach?
    target: path/to/CLAUDE.md
    confidence: high|medium|low
    source:
      tool: Bash|Read|etc
      context: Brief context
```

## Edge Cases to Handle

| Case | Response |
|------|----------|
| Empty transcript | "No content to analyze" |
| No assistant messages | "Transcript contains no reasoning" |
| Mechanical task | "Session appears mechanical, no learning patterns detected" |
| All filtered by quality | "N candidates found, all filtered: [reasons]" |
| All duplicates | "N candidates identified, all duplicate existing signs" |

## Commit Convention

```
<type>(<scope>): <subject>

Types: feat, fix, docs, chore, refactor, test
Scope: m42-signs, m42-sprint, etc.
Subject: lowercase, imperative, no period
```
