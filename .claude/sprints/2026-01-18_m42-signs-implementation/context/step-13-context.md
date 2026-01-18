# Step Context: step-13

## Task
## Phase 5.3: Reference Documentation

Create comprehensive reference docs:

### Tasks
1. Create docs/reference/commands.md:
   - All commands with full syntax
   - All options/flags documented
   - Examples for each command
   - Common errors and solutions

2. Create docs/reference/backlog-format.md:
   - Complete YAML schema
   - All fields explained
   - Status transitions
   - Example entries

3. Create docs/reference/sign-format.md:
   - How signs appear in CLAUDE.md
   - Formatting conventions
   - Origin tracking explained

### Success Criteria
- Reference is comprehensive
- Easy to find specific information
- Code examples are copy-pasteable

## Related Code Patterns

### Existing Reference: commands.md
Location: `plugins/m42-signs/docs/reference/commands.md`

Current state: Basic documentation exists but needs enhancement:
- Missing complete option documentation for some commands
- Missing common errors and solutions sections
- Missing some flags (`--reject-all-low`, `--confidence-min`, `--auto-approve`, `--auto-commit`, `--targets`)

### Existing Reference: backlog-format.md
Location: `plugins/m42-signs/docs/reference/backlog-format.md`

Current state: Good coverage of schema but needs:
- Status transition diagram
- More detailed field explanations
- Source object subfields documentation

### Missing Reference: sign-format.md
Location: `plugins/m42-signs/docs/reference/sign-format.md`

Must be created from scratch covering:
- CLAUDE.md sign section format
- Individual sign formatting
- Origin tracking conventions

## Required Imports
### Internal
- None (documentation only)

### External
- None (documentation only)

## Types/Interfaces to Use

### Sign Format (from shared context)
```markdown
## Signs (Accumulated Learnings)

### Sign Title
**Problem**: Description of what went wrong
**Solution**: How to fix/avoid
**Origin**: <source reference>
```

### Backlog Schema (from shared context)
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

## Command Details for Documentation

### /m42-signs:add
- `--direct`: Write directly to CLAUDE.md (skip backlog)
- `[title]`: Optional initial title

### /m42-signs:list
- `--format json`: Output as JSON instead of table

### /m42-signs:status
- No arguments

### /m42-signs:extract
- `<session-id|path>`: Required - session ID or transcript path
- `--dry-run`: Preview without writing
- `--confidence-min <level>`: Filter by minimum confidence (low/medium/high)
- `--auto-approve`: Auto-approve high-confidence learnings

### /m42-signs:review
- `--approve-all-high`: Batch approve high confidence
- `--reject-all-low`: Batch reject low confidence

### /m42-signs:apply
- `--dry-run`: Preview without writing
- `--commit`: Create git commit (with confirmation)
- `--auto-commit`: Create git commit (no confirmation)
- `--targets <paths>`: Filter to specific CLAUDE.md files (comma-separated)

### /m42-signs:help
- No arguments

## Integration Points
- Called by: Users via slash commands
- Calls: N/A (documentation)
- Tests: N/A (no formal tests for docs)

## Implementation Notes
- Existing commands.md needs expansion with all flags
- Existing backlog-format.md needs status transition diagram
- sign-format.md must be created from scratch
- All docs should include copy-pasteable examples
- Gherkin scenarios require ≥5 bash code blocks in commands.md
- All 7 commands must be documented in commands.md
- backlog-format.md must document: status, pending, approved, applied, rejected, confidence
- sign-format.md must document: CLAUDE.md, Signs, Origin, Problem, Solution
