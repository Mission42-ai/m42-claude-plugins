# Step Context: step-8

## Task
## Phase 3.2: Apply Command

Implement /m42-signs:apply command:

### Tasks
1. Create commands/apply.md:
   - Proper frontmatter (description, allowed-tools, model)
   - Load backlog, filter to status: approved
   - Group learnings by target CLAUDE.md
   - For each target:
     - Read or create CLAUDE.md
     - Find or create ## Signs section
     - Append formatted learning entry
     - Update backlog: status -> applied
   - Output summary of applied changes

2. Create skills/managing-signs/references/claude-md-format.md:
   - Proper frontmatter (title, description, skill: managing-signs)
   - Document sign format
   - Show examples with proper structure
   - Explain origin tracking
   - Keep LLM-dense

3. Add options:
   - --commit: create git commit after applying
   - --dry-run: show what would be changed
   - --targets: apply only to specific CLAUDE.md files

### Success Criteria
- CLAUDE.md files are properly formatted
- Signs section is clearly delimited
- Applied learnings are removed from pending


## Related Code Patterns

### Similar Implementation: plugins/m42-signs/commands/review.md
```markdown
---
allowed-tools: Bash(test:*, ls:*), Read(*), Edit(*), Write(*), AskUserQuestion(*)
argument-hint: "[--approve-all-high] [--reject-all-low]"
description: Interactive review of pending learnings in backlog
model: sonnet
---
```
Key patterns:
- Frontmatter with allowed-tools, argument-hint, description, model
- Preflight checks using `!` syntax for inline bash
- Context section for argument parsing
- Structured task instructions with numbered sections
- Edge case handling section
- Success criteria section

### Similar Implementation: plugins/m42-signs/commands/add.md (--direct mode)
```markdown
### 4. Handle --direct Mode

If `--direct` flag was provided:

1. Read the target CLAUDE.md file (or note it doesn't exist)
2. Look for existing `## Signs` section
3. If section exists: Append new sign after existing signs
4. If section doesn't exist: Create it at end of file
5. Format sign as:
   ```markdown
   ### <Title>
   **Problem**: <problem description>
   **Solution**: <solution description>
   **Origin**: Manual addition via /m42-signs:add
   ```
```
Key patterns:
- CLAUDE.md Signs section at `## Signs`
- Individual signs at `### <Title>` level
- Standard fields: Problem, Solution, Origin
- Creates section if doesn't exist

### Similar Implementation: plugins/m42-signs/commands/extract.md
```markdown
### 8. Handle --dry-run Mode

If `--dry-run` is set:
- Show all proposed learnings in formatted table
- Do NOT write to backlog
- Output: "Dry run complete - no changes written"
```
Key patterns:
- --dry-run flag handling
- Preview without writing
- Summary table output

## Required Imports
### Internal
- Backlog schema from `skills/managing-signs/references/backlog-schema.md`
- Sign format already defined in add.md's --direct mode

### External
- `yq`: YAML processing in shell scripts
- No new packages needed

## Types/Interfaces to Use

### From backlog-schema.md
```yaml
# Status enum values
pending   # Awaiting human review
approved  # Ready for application (our input filter)
rejected  # Will not apply
applied   # Successfully applied (our output status)

# Learning entry structure
- id: kebab-case-id
  status: approved  # Filter on this
  title: Short description
  problem: |
    Multi-line problem
  solution: |
    Multi-line solution
  target: path/to/CLAUDE.md  # Group by this
  confidence: low|medium|high
  source:
    tool: tool-name
    command: command-string
    error: error-message
```

### Sign Format (from add.md)
```markdown
## Signs

### <Title>
**Problem**: <problem description>
**Solution**: <solution description>
**Origin**: <source reference>
```

## Integration Points
- Called by: User via `/m42-signs:apply` command
- Calls:
  - Read tool to load backlog.yaml
  - Read tool to load target CLAUDE.md files
  - Write/Edit tools to update CLAUDE.md files
  - Edit tool to update backlog.yaml (status -> applied)
  - Bash for optional git commit
- Tests: Gherkin scenarios in artifacts/step-8-gherkin.md

## Implementation Notes

### Signs Section Handling
1. Use regex/grep to find `## Signs` section
2. If found, append after last `###` entry (or after header if empty)
3. If not found, create at end of file with blank line before

### Origin Field Generation
- For extracted learnings: `Extracted from session <session-id> (<tool> error)`
- For manual learnings: `Manual addition via /m42-signs:add`
- Include confidence and timestamp

### --targets Filter
- Accept comma-separated paths or glob patterns
- Filter approved learnings to only those matching targets
- Useful for applying signs to specific subsystems

### --commit Workflow
1. Complete all apply operations
2. Stage modified files: `git add <all-modified-files>`
3. Generate commit message listing applied signs
4. Run git commit

### Status Transition
- Only process learnings with `status: approved`
- After successful write: update to `status: applied`
- Save backlog.yaml after each successful apply (atomic updates)

### Edge Cases
- Empty backlog: "No approved learnings to apply"
- Target CLAUDE.md doesn't exist: Create with Signs section
- Multiple learnings for same target: Batch append
- Failed write: Keep status as approved, report error

### Reference File Format
The claude-md-format.md should follow transcript-format.md pattern:
```yaml
---
title: CLAUDE.md Sign Format
description: Format specification for writing learning signs to CLAUDE.md files. Used by /m42-signs:apply command.
keywords: claude-md, signs, format, learnings, markdown
skill: managing-signs
---
```
