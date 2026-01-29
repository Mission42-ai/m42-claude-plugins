# Skill Discoverability Feedback

## Source
Feedback from another agent using the m42-sprint plugin.

---

## Problem 1: Skill Didn't Surface Key References

When invoking `creating-workflows`, the agent got the SKILL.md but didn't automatically see critical reference files (sprint-schema.md, workflow-patterns.md).

**Root Cause**: Skills rely on agents to proactively read referenced files, but agents often don't unless explicitly told to.

**Impact**: Agent had incomplete context, leading to trial-and-error.

---

## Problem 2: No Clear "Current Patterns" Entry Point

Had to dig through multiple files to understand current patterns.

**Root Cause**: Pattern information is spread across:
- `references/workflow-schema.md` (schema)
- `references/workflow-patterns.md` (patterns)
- Various example workflows in `.claude/workflows/`

**Impact**: Time wasted navigating file structure.

---

## Problem 3: Version Awareness

No way to know if local workflows are current or outdated.

**Root Cause**: No schema versioning. Workflows created 6 months ago may use deprecated patterns.

**Impact**: Agents may create or modify workflows using outdated syntax.

---

## Proposed Improvements

### 1. Inline Critical Schema in SKILL.md (Low Effort)

Instead of just "see references/X.md", include a condensed cheat sheet directly in the skill:

```markdown
## Quick Reference

### Workflow Structure
```yaml
name: <string>           # Required
description: <string>    # Optional
phases:                  # Required
  - id: <string>         # Required, unique
    prompt: <string>     # For simple phases
    # OR
    for-each: <string>   # For iteration phases
    workflow: <string>   # Workflow to run per item
```

### Phase Types
| Type | Fields | Use Case |
|------|--------|----------|
| Simple | `id`, `prompt` | Direct execution |
| For-Each | `id`, `for-each`, `workflow` | Iterate over collection |

### Template Variables
- `{{item.prompt}}` - Current item's prompt
- `{{item.id}}` - Current item's ID
- `{{sprint.id}}` - Sprint identifier
```

**Benefit**: Agent has essential syntax immediately without file reads.

### 2. Add Current Patterns Section to Skill (Low Effort)

Add a "Current Workflow Patterns" section directly in SKILL.md:

```markdown
## Current Workflow Patterns

### Standard Sprint (sprint-default.yaml)
- prepare → development (for-each: step) → qa → deploy
- Use for: typical sprint execution

### TDD Development (plugin-development.yaml)
- preflight → development (RED/GREEN/REFACTOR) → docs → qa → summary
- Use for: plugin development with TDD

### Feature Standard (feature-standard.yaml)
- planning → implement → test → document
- Use for: single feature implementation
```

**Benefit**: Agent knows which workflow to use without exploring files.

### 3. Schema Version Field + Compiler Warnings (Medium Effort)

Add `schema-version` field to workflows:

```yaml
# .claude/workflows/my-workflow.yaml
schema-version: "2.0"  # Current schema version
name: My Workflow
# ...
```

Compiler validates and warns:
```
Warning: Workflow 'my-workflow.yaml' uses schema-version 1.0.
Current schema version is 2.0. Consider updating.
See: plugins/m42-sprint/docs/migration/v1-to-v2.md
```

**Implementation**:
- Add `CURRENT_SCHEMA_VERSION` constant to compiler
- Add `schema-version` field to WorkflowDefinition type
- Add validation check in validate.ts
- Emit warning (not error) for older versions

### 4. /validate-workflow Command (Medium Effort)

User-invokable command to validate workflow files:

```bash
/validate-workflow .claude/workflows/my-workflow.yaml
```

Output:
```
Validating: my-workflow.yaml

✓ Schema structure valid
✓ Phase IDs unique
✓ Workflow references resolve
⚠ Schema version 1.0 (current: 2.0)
⚠ Phase 'dev' uses deprecated 'steps:' key (use 'collections:')

Validation: PASS (2 warnings)
```

**Benefit**: Users can check workflows before running sprints.

---

## Summary Table

| Improvement | Type | Effort | Impact |
|-------------|------|--------|--------|
| Inline schema in SKILL.md | Docs | Low | High |
| Add current patterns to skill | Docs | Low | High |
| Schema version + warnings | Compiler | Medium | Medium |
| /validate-workflow command | Command | Medium | Medium |

---

## Recommendation

**Priority order:**
1. Inline schema + patterns in SKILL.md (immediate impact, no code)
2. /validate-workflow command (user-facing quality tool)
3. Schema version field (prevents drift over time)

All three could be in a single sprint, or split:
- Sprint A: Docs improvements (steps 1, 2)
- Sprint B: Compiler improvements (steps 3, 4)
