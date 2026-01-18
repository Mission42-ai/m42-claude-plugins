# Step Context: step-12

## Task
Create four task-oriented how-to guides:
1. docs/how-to/add-sign-manually.md
2. docs/how-to/extract-from-session.md
3. docs/how-to/review-and-apply.md
4. docs/how-to/integrate-with-sprint.md

## Related Code Patterns

### Similar Implementation: plugins/m42-signs/docs/getting-started.md
```markdown
# Getting Started

Add your first sign in under 5 minutes.

---

## Prerequisites
[Section with concrete steps]

---

## Step N: [Action]
[Command with explanation]

**What happens:**
[Bullet points explaining behavior]

**Example input/output:**
[Code blocks showing real examples]

---

## Next Steps
| Want to... | Read |
|------------|------|
| [action] | [link] |
```

### Pattern: Command Documentation (commands/*.md)
Commands define exact flags/options:
- `/m42-signs:add [--direct] [title]`
- `/m42-signs:extract <session-id|path> [--dry-run] [--confidence-min <level>] [--auto-approve]`
- `/m42-signs:review [--approve-all-high] [--reject-all-low]`
- `/m42-signs:apply [--dry-run] [--commit] [--auto-commit] [--targets <paths>]`

## Required Imports
### Internal
- No code imports (pure Markdown documentation)

### External
- None required

## Types/Interfaces to Use
### Backlog Schema (from references/backlog-schema.md)
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

### Sign Format (from references/claude-md-format.md)
```markdown
## Signs (Accumulated Learnings)

### Sign Title
**Problem**: Description of what went wrong
**Solution**: How to fix/avoid
**Origin**: <source reference>
```

## Integration Points
- Called by: Users reading documentation
- Calls: N/A (documentation only)
- Tests: Gherkin scenarios verify file existence and content keywords

## Gherkin Requirements Summary

### Scenario 1-2: add-sign-manually.md
- Must contain "Quick Start" or "## When to" section
- Must reference `/m42-signs:add`
- Must document `--direct` flag
- Must include "example" or "Example" text

### Scenario 3-4: extract-from-session.md
- Must contain "session" or "Session" text
- Must reference `/m42-signs:extract`
- Must document `--dry-run` flag

### Scenario 5-6: review-and-apply.md
- Must reference `/m42-signs:review`
- Must reference `/m42-signs:apply`
- Must document git/Git/--commit integration

### Scenario 7: integrate-with-sprint.md
- Must contain "workflow" or "Workflow" text
- Must contain "sprint" or "Sprint" text

### Scenario 8: Cross-linking
- All 4 guides must link to `getting-started` OR `how-to/` paths

## Implementation Notes

### Content Structure for Each Guide
1. **Title** - Clear, action-oriented
2. **Introduction** - One-line purpose statement
3. **Quick Start** - Fastest path to success
4. **When to Use** - Decision guidance (manual vs extract, etc.)
5. **Step-by-Step** - Detailed walkthrough
6. **Options/Flags** - Complete flag documentation
7. **Examples** - Concrete, realistic scenarios
8. **Troubleshooting** (optional) - Common issues
9. **Related Guides** - Cross-links

### Command Flags to Document

#### /m42-signs:add
- `--direct`: Skip backlog, write directly to CLAUDE.md
- Interactive prompts: title, problem, solution, target, confidence

#### /m42-signs:extract
- `<session-id|path>`: Session identifier or file path
- `--dry-run`: Preview without writing
- `--confidence-min <level>`: Filter by confidence (low/medium/high)
- `--auto-approve`: Auto-approve high-confidence learnings

#### /m42-signs:review
- `--approve-all-high`: Batch approve high-confidence pending
- `--reject-all-low`: Batch reject low-confidence pending
- Interactive actions: Approve/Reject/Edit/Skip/Quit

#### /m42-signs:apply
- `--dry-run`: Preview without writing
- `--commit`: Create git commit (with confirmation)
- `--auto-commit`: Create git commit without prompting
- `--targets <paths>`: Filter to specific CLAUDE.md files

### Session Transcript Location
```bash
# Compute encoded project path
PROJECT_PATH=$(pwd | sed 's|/|-|g')

# Session files location
~/.claude/projects/$PROJECT_PATH/<session-id>.jsonl
```

### Confidence Levels
- **high**: Clear error→success pattern, same tool/command
- **medium**: Retry pattern detected but less clear
- **low**: Error found but resolution unclear

### Sprint Integration Patterns
1. **Workflow Phase**: Add learning-extraction phase to workflow
2. **Template Variables**: `{{sprint.id}}`, `{{step.id}}`, etc.
3. **Transcript Path**: `.claude/sprints/<sprint-id>/transcripts/`
4. **Post-Sprint Manual**: Extract → Review → Apply flow

### Example Sign Content
```markdown
### Quote Variables in yq Expressions
**Problem**: yq expressions with variable interpolation fail when variables contain special characters or spaces
**Solution**: Always wrap yq expressions in single quotes and use proper variable quoting: `yq '.key = "'"$VAR"'"' file.yaml`
**Origin**: Extracted from session (Tool: Bash) [high confidence]
```

## Files to Create/Modify
| File | Action |
|------|--------|
| plugins/m42-signs/docs/how-to/add-sign-manually.md | Expand (exists but minimal) |
| plugins/m42-signs/docs/how-to/extract-from-session.md | Expand (exists but minimal) |
| plugins/m42-signs/docs/how-to/review-and-apply.md | Expand (exists but minimal) |
| plugins/m42-signs/docs/how-to/integrate-with-sprint.md | Expand (exists but minimal) |

## Success Verification
```bash
# Scenario 1: add-sign-manually exists with key sections
test -f plugins/m42-signs/docs/how-to/add-sign-manually.md && \
grep -q "Quick Start\|## When to" plugins/m42-signs/docs/how-to/add-sign-manually.md && \
grep -q "/m42-signs:add" plugins/m42-signs/docs/how-to/add-sign-manually.md

# Scenario 2: --direct flag documented
grep -q "\-\-direct" plugins/m42-signs/docs/how-to/add-sign-manually.md && \
grep -qE '(example|Example)' plugins/m42-signs/docs/how-to/add-sign-manually.md

# Scenario 3: extract guide exists
test -f plugins/m42-signs/docs/how-to/extract-from-session.md && \
grep -qE "(session|Session)" plugins/m42-signs/docs/how-to/extract-from-session.md && \
grep -q "/m42-signs:extract" plugins/m42-signs/docs/how-to/extract-from-session.md

# Scenario 4: --dry-run documented
grep -q "\-\-dry-run" plugins/m42-signs/docs/how-to/extract-from-session.md

# Scenario 5: review-and-apply guide exists
test -f plugins/m42-signs/docs/how-to/review-and-apply.md && \
grep -q "/m42-signs:review" plugins/m42-signs/docs/how-to/review-and-apply.md && \
grep -q "/m42-signs:apply" plugins/m42-signs/docs/how-to/review-and-apply.md

# Scenario 6: git integration documented
grep -qE "(\-\-commit|git|Git)" plugins/m42-signs/docs/how-to/review-and-apply.md

# Scenario 7: sprint integration guide exists
test -f plugins/m42-signs/docs/how-to/integrate-with-sprint.md && \
grep -qE "(workflow|Workflow)" plugins/m42-signs/docs/how-to/integrate-with-sprint.md && \
grep -qE "(sprint|Sprint)" plugins/m42-signs/docs/how-to/integrate-with-sprint.md

# Scenario 8: cross-linking (all 4 must link)
grep -l "getting-started\|how-to/" plugins/m42-signs/docs/how-to/*.md | wc -l | grep -q "^4$"
```
