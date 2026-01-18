# Step Context: step-14

## Task
Phase 5.4: Final Polish and Testing

Complete documentation and validate:

### Tasks
1. Update CONCEPT.md:
   - Mark all phases as complete
   - Add link to docs/getting-started.md
   - Document known limitations
   - Add changelog section

2. Verify documentation:
   - All internal links work
   - Code examples are tested
   - No placeholder text remains

3. Run full workflow test:
   - Follow getting-started guide as new user
   - Extract from real session
   - Review and approve learnings
   - Apply to test CLAUDE.md
   - Verify signs appear correctly

4. Update skills/managing-signs/SKILL.md:
   - Proper frontmatter with trigger keywords
   - Link to docs/ for user-facing content
   - Keep skill focused on LLM behavior

### Success Criteria
- Documentation is complete and accurate
- All commands have been tested via docs
- Plugin is ready for use

## Related Code Patterns

### CONCEPT.md Current State
```markdown
# Phase checkboxes to update (currently unchecked)
### Phase 1: Foundation
- [x] CONCEPT.md (this document)
- [x] SESSION-TRACKING.md (transcript format research)
- [ ] Plugin structure (.claude-plugin/plugin.json)  # Should be [x]
- [ ] Backlog schema and template                   # Should be [x]
...

# Missing sections to add:
## Known Limitations
## Changelog
## Quick Start (link to docs/getting-started.md)
```

### Similar Pattern: m42-sprint Plugin Structure
```text
plugins/m42-sprint/
├── CONCEPT.md        # Has version history and status markers
├── docs/
│   └── getting-started.md
└── skills/
    └── orchestrating-sprints/
        └── SKILL.md  # Has proper frontmatter
```

### SKILL.md Frontmatter Pattern
```yaml
---
name: managing-signs
description: Manages learning extraction and sign application workflows. This skill should be used when extracting learnings from session transcripts, reviewing proposed signs, or applying approved learnings to CLAUDE.md files. Triggers on "extract learnings", "review signs", "apply signs", "manage signs", "learning backlog".
---
```
The SKILL.md already has proper frontmatter with triggers - needs verification only.

## Required Imports
### Internal
- No code imports needed (documentation-only step)

### External
- `yq`: For any YAML validation
- `jq`: For transcript parsing validation
- `grep`: For placeholder text detection

## Files to Modify

### 1. plugins/m42-signs/CONCEPT.md
**Changes needed:**
- Update Phase 1-4 checkboxes to `[x]` completed
- Add `## Quick Start` section linking to `docs/getting-started.md`
- Add `## Known Limitations` section
- Add `## Changelog` section
- Update status from "Planning" to "Complete"

### 2. plugins/m42-signs/skills/managing-signs/SKILL.md
**Current state:** Already has frontmatter with triggers
**Verify:**
- `name:` field present ✓
- `description:` field present ✓
- "Triggers on" phrase present ✓
- Links to docs/ or commands ✓

## Documentation Files to Verify

| File | Link Check | Placeholder Check |
|------|------------|-------------------|
| `docs/getting-started.md` | 4 internal links | None found |
| `docs/how-to/add-sign-manually.md` | 3 internal links | None found |
| `docs/how-to/extract-from-session.md` | 3 internal links | None found |
| `docs/how-to/review-and-apply.md` | 4 internal links | None found |
| `docs/how-to/integrate-with-sprint.md` | 3 internal links | None found |
| `docs/reference/commands.md` | 3 internal links | None found |
| `docs/reference/backlog-format.md` | 3 internal links | None found |
| `docs/reference/sign-format.md` | 3 internal links | None found |

### Internal Link Patterns Found
```markdown
# In docs/getting-started.md:
[Add Sign Manually](how-to/add-sign-manually.md)
[Extract from Session](how-to/extract-from-session.md)
[Integrate with Sprint](how-to/integrate-with-sprint.md)
[Commands Reference](reference/commands.md)
[Back to README](../README.md)

# Cross-references in reference docs:
[Backlog Format Reference](./backlog-format.md)
[Sign Format Reference](./sign-format.md)
[Getting Started Guide](../getting-started.md)
```

## Gherkin Verification Commands

### Scenario 1: All phases marked complete
```bash
grep -E '^\s*- \[x\]' plugins/m42-signs/CONCEPT.md | wc -l | xargs test 7 -le
```

### Scenario 2: Getting-started link present
```bash
grep -q 'docs/getting-started' plugins/m42-signs/CONCEPT.md
```

### Scenario 3: Known limitations section
```bash
grep -qi '## .*limitation' plugins/m42-signs/CONCEPT.md
```

### Scenario 4: Internal links valid
```bash
cd plugins/m42-signs/docs && find . -name '*.md' -exec grep -hoE '\]\([^)]+\.md\)' {} \; | sed 's/](\(.*\))/\1/' | while read link; do test -f "$link" || exit 1; done
```

### Scenario 5: SKILL.md frontmatter
```bash
grep -q '^name:' plugins/m42-signs/skills/managing-signs/SKILL.md && grep -q '^description:' plugins/m42-signs/skills/managing-signs/SKILL.md && grep -q 'Triggers on' plugins/m42-signs/skills/managing-signs/SKILL.md
```

### Scenario 6: SKILL.md links to docs
```bash
grep -qE 'docs/|/m42-signs:' plugins/m42-signs/skills/managing-signs/SKILL.md
```

### Scenario 7: No placeholder text
```bash
! grep -riE '(TODO|FIXME|TBD|\[placeholder\]|\[PLACEHOLDER\]|XXX)' plugins/m42-signs/docs/
```

## Implementation Notes

1. **CONCEPT.md updates are substantial**: Need to update ~7 unchecked boxes and add 3 new sections
2. **SKILL.md is nearly complete**: Already has proper frontmatter, just verify and potentially add explicit docs link
3. **Link validation**: All internal links appear to follow relative path patterns that should work
4. **No placeholder text found**: Documentation is clean of common placeholder patterns
5. **README.md reference**: `docs/getting-started.md` references `../README.md` - ensure README exists

## Integration Points
- Called by: Sprint QA phase
- Calls: N/A (documentation updates only)
- Tests: Gherkin verification commands above

## Commands Available
All commands implemented in `plugins/m42-signs/commands/`:
- `add.md` → `/m42-signs:add`
- `list.md` → `/m42-signs:list`
- `status.md` → `/m42-signs:status`
- `extract.md` → `/m42-signs:extract`
- `review.md` → `/m42-signs:review`
- `apply.md` → `/m42-signs:apply`
- `help.md` → `/m42-signs:help`
