# m42-signs: Self-Evolutionary Knowledge Accumulation

> Status: **Planning** | Created: 2026-01-17

## Origin

This concept emerged from studying the [Ralph Loop](https://ghuntley.com/ralph/) pattern. The key insight:

> "Each time Ralph does something bad, Ralph gets tuned."

Like adding signs to a playground ("SLIDE DOWN, DON'T JUMP"), we accumulate guidance in the codebase itself. This is **not ML** - it's explicit, human-curated wisdom that makes autonomous agents increasingly effective over time.

## Core Philosophy

1. **Failures are tuning opportunities** - Every error teaches something
2. **Signs persist** - Knowledge survives sessions
3. **Codebase as instruction set** - The environment guides behavior
4. **Eventual consistency** - Given enough signs, complex tasks succeed

## Proposed Architecture

```
.claude/signs/                    # Global signs (all projects)
├── typescript-patterns.md
├── testing-gotchas.md
├── yaml-handling.md
└── api-interactions.md

$PROJECT/.claude/signs/           # Project-specific signs
├── domain-knowledge.md
├── codebase-conventions.md
└── learned-patterns.md

$SPRINT_DIR/signs.md              # Sprint-specific signs (ephemeral)
```

## Sign Structure

```markdown
# Sign: Quote Variables in yq Expressions

## Context
- Categories: yaml, shell, tooling
- Applies to: validation phases, any yq usage
- Learned from: sprint/2026-01-16 step-3 retry

## Problem
yq commands fail silently or return empty when variables aren't quoted:
```bash
# Fails
yq '.phases[$IDX].status' file.yaml
```

## Solution
Always quote variable references in yq:
```bash
# Works
yq '.phases['"$IDX"'].status' file.yaml
```

## Evidence
- Failure rate before: 3/10 phases
- Failure rate after: 0/10 phases
```

## Planned Features

### Phase 1: Foundation
- [ ] Sign storage format (markdown with frontmatter)
- [ ] Directory structure (global, project, sprint levels)
- [ ] Basic CRUD commands (`/signs add`, `/signs list`, `/signs search`)
- [ ] Manual sign creation workflow

### Phase 2: Integration
- [ ] Query API for m42-sprint integration
- [ ] Relevance matching (categories, keywords, phase types)
- [ ] Prompt injection during sprint execution
- [ ] Sign loading in build-sprint-prompt.sh

### Phase 3: Learning
- [ ] Capture diff between failed and successful retry attempts
- [ ] Propose signs automatically after retry success
- [ ] Human approval workflow for auto-generated signs
- [ ] Confidence scoring for signs

### Phase 4: Intelligence
- [ ] Sign effectiveness tracking (does this sign reduce failures?)
- [ ] Sign deprecation (outdated patterns)
- [ ] Cross-project sign sharing
- [ ] Sign conflict detection

## Integration with m42-sprint

```bash
# In build-sprint-prompt.sh:

# 1. Determine context
PHASE_TYPE="implementation"
ERROR_CATEGORY="yaml"
TOOLS_USED="yq,bash"

# 2. Query relevant signs
SIGNS=$(m42-signs query \
  --categories "$ERROR_CATEGORY" \
  --phase-type "$PHASE_TYPE" \
  --tools "$TOOLS_USED" \
  --limit 5)

# 3. Inject into prompt
cat <<EOF
## Relevant Guidance

$SIGNS

## Your Task
...
EOF
```

## Commands (Planned)

| Command | Description |
|---------|-------------|
| `/signs add` | Create a new sign interactively |
| `/signs list` | List all signs with filtering |
| `/signs search <query>` | Search signs by content/category |
| `/signs show <id>` | Display a specific sign |
| `/signs edit <id>` | Edit an existing sign |
| `/signs delete <id>` | Remove a sign |
| `/signs import <file>` | Import signs from file |
| `/signs export` | Export all signs |
| `/signs stats` | Show sign usage statistics |

## Open Questions

1. **Sign format**: Pure markdown? Markdown + YAML frontmatter? Structured YAML?
2. **Relevance algorithm**: Keyword matching? Embeddings? Category hierarchy?
3. **Scope inheritance**: Do global signs override project signs or merge?
4. **Version control**: Track sign history? Git integration?
5. **Sign validation**: How to verify a sign actually helps?

## Related Concepts

- **Ralph Loop** - The execution pattern that benefits from signs
- **Prompt engineering** - Signs are essentially accumulated prompt improvements
- **Knowledge bases** - But simpler, text-based, human-readable
- **Test fixtures** - Signs are like fixtures for agent behavior

## Next Steps

1. Design the sign file format (frontmatter schema)
2. Implement basic storage and retrieval
3. Create `/signs add` command
4. Integrate with m42-sprint prompt construction
5. Build feedback loop for sign effectiveness

---

*This plugin represents a shift from "disposable context" to "accumulated wisdom" - making each failure a permanent improvement to the system.*
