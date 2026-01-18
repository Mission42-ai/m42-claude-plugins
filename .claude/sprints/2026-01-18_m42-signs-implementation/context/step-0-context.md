# Step Context: step-0

## Task
Create the basic plugin structure for m42-signs including:
1. `.claude-plugin/plugin.json` with metadata
2. Minimal `README.md` with docs link
3. Directory structure: `commands/`, `skills/managing-signs/`, `scripts/`, `docs/`
4. `SKILL.md` with proper frontmatter

## Related Code Patterns

### Similar Implementation: plugins/m42-sprint/.claude-plugin/plugin.json
```json
{
  "name": "m42-sprint",
  "version": "2.0.0",
  "description": "Sprint orchestration with autonomous task queue processing, polymorphic task types, and progress tracking",
  "author": {
    "name": "Mission42",
    "email": "dev@mission42.ai"
  },
  "homepage": "https://github.com/mission42-ai/m42-claude-plugins",
  "repository": "https://github.com/mission42-ai/m42-claude-plugins",
  "license": "MIT",
  "keywords": [...]
}
```

**Key pattern**: Author object with name/email, homepage and repository URLs, MIT license, keywords array.

### Similar Implementation: plugins/m42-sprint/skills/orchestrating-sprints/SKILL.md
```yaml
---
name: orchestrating-sprints
description: Manages development sprints with workflow-based compilation and fresh-context execution. Supports hierarchical phases (prepare → development → QA → deploy) with for-each step expansion. This skill should be used when starting sprints, managing workflows, or tracking sprint progress. Triggers on "start sprint", "create sprint", "run sprint", "sprint status", "add step", "compile sprint".
---
```

**Key pattern**:
- `name`: kebab-case skill identifier
- `description`: Third-person ("This skill should be used when..."), includes trigger keywords at end

### Similar Implementation: plugins/m42-sprint/README.md
```markdown
# M42 Sprint Plugin

Sprint orchestration with **fresh context per task** for Claude Code.

## What is M42 Sprint?
[ASCII diagram]

## Quick Links
[Table with docs links]

## Installation
[Installation command]

## Commands
[Command table]

## License
MIT
```

**Key pattern**: One-line description, optional diagram, Quick Links table, Installation section, License footer.

## Required Imports
### Internal
- None (pure Markdown/YAML structure, no code)

### External
- None (no dependencies)

## Types/Interfaces to Use

### plugin.json Schema
```json
{
  "name": "m42-signs",
  "version": "0.1.0",
  "description": "<description>",
  "author": {
    "name": "Mission42",
    "email": "dev@mission42.ai"
  },
  "homepage": "https://github.com/mission42-ai/m42-claude-plugins",
  "repository": "https://github.com/mission42-ai/m42-claude-plugins",
  "license": "MIT",
  "keywords": [...]
}
```

### SKILL.md Frontmatter Schema
```yaml
---
name: managing-signs
description: <Third-person description with trigger keywords>
---
```

## Integration Points
- Called by: Claude Code plugin loader (auto-discovers commands and skills from directory structure)
- Calls: Nothing (foundation structure only)
- Tests: No formal tests; validation via gherkin scenarios using `jq`, `test`, `grep`

## Implementation Notes

### Directory Structure to Create
```text
plugins/m42-signs/
├── .claude-plugin/
│   └── plugin.json           # Metadata only (name, version, description, author)
├── README.md                  # Minimal with docs/ link
├── commands/                  # Empty placeholder (auto-discovered)
├── skills/
│   └── managing-signs/
│       ├── SKILL.md          # Frontmatter + placeholder content
│       ├── references/       # Empty placeholder
│       └── assets/           # Empty placeholder
├── scripts/                   # Empty placeholder
└── docs/                      # Empty placeholder
```

### Existing Files to Preserve
- `CONCEPT.md` - Full design document (already exists)
- `SESSION-TRACKING.md` - Transcript format documentation (already exists)
- `.claude-plugin/` - Directory exists but empty

### Gherkin Verification Commands
| Scenario | Verification |
|----------|--------------|
| plugin.json valid JSON | `jq empty plugin.json` |
| plugin.json has fields | `jq -e '.name == "m42-signs" and .version == "0.1.0" ...'` |
| README has docs link | `grep -q "docs/" README.md` |
| commands/ exists | `test -d commands` |
| skill dirs exist | `test -d skills/managing-signs/references && test -d skills/managing-signs/assets` |
| SKILL.md has frontmatter | `grep -q "^name:" SKILL.md && grep -q "^description:" SKILL.md` |
| scripts/ and docs/ exist | `test -d scripts && test -d docs` |

### Plugin Description for m42-signs
Based on CONCEPT.md: "Learning loop for agent evolution - extracts wisdom from session failures and applies them as signs in CLAUDE.md files"

### Keywords for m42-signs
- learning-loop
- signs
- claude-md
- error-extraction
- wisdom
- agent-evolution
- backlog
- transcript-analysis

### SKILL.md Description Pattern
Follow third-person convention: "Manages learning extraction and sign application workflows. This skill should be used when extracting learnings from session transcripts, reviewing proposed signs, or applying approved learnings to CLAUDE.md files. Triggers on 'extract learnings', 'review signs', 'apply signs', 'manage signs', 'learning backlog'."
