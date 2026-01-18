# Step Context: step-1

## Task
Phase 1 - Step 2: Update Default Max Iterations (30 → 60)

The default of 30 iterations is insufficient for larger sprints.

Requirements:
- Update default value in run-sprint.md command documentation
- Update reference documentation in docs/reference/commands.md
- Update USER-GUIDE.md with new default
- Ensure all mentions of "default: 30" are changed to "default: 60"

Verification:
- Search for all occurrences of max-iterations default value
- Verify consistency across all documentation

Files to modify:
- plugins/m42-sprint/commands/run-sprint.md
- plugins/m42-sprint/docs/reference/commands.md
- plugins/m42-sprint/docs/USER-GUIDE.md

## Related Code Patterns

### Similar Implementation: Documentation Default Value Pattern
The plugin uses consistent patterns for documenting command options with defaults:
- In command files: `--option-name N` - Description (default: N)
- In reference tables: `| option | default | description |`
- In user guides: `--option-name N` - Description (default: N)

### File 1: plugins/m42-sprint/commands/run-sprint.md:25
```markdown
   - `--max-iterations N` - Maximum loop iterations (default: 30)
```
**Action**: Change `(default: 30)` to `(default: 60)`

### File 2: plugins/m42-sprint/docs/reference/commands.md:94
```markdown
| `--max-iterations N` | 30 | Maximum loop iterations (safety limit) |
```
**Action**: Change `| 30 |` to `| 60 |`

### File 3: plugins/m42-sprint/docs/USER-GUIDE.md:152
```markdown
- `--max-iterations N` - Safety limit (default: 30)
```
**Action**: Change `(default: 30)` to `(default: 60)`

## Required Imports
### Internal
- None (documentation-only change)

### External
- None (documentation-only change)

## Types/Interfaces to Use
N/A - This is a documentation update, no code changes required.

## Integration Points
- Called by: Users reading documentation to understand default behavior
- Calls: N/A
- Tests: Verification via grep commands (see gherkin scenarios)

## Implementation Notes

### Primary Changes (Documented Defaults)
1. **run-sprint.md:25** - Change `(default: 30)` to `(default: 60)`
2. **commands.md:94** - Change `| 30 |` to `| 60 |`
3. **USER-GUIDE.md:152** - Change `(default: 30)` to `(default: 60)`

### Secondary Occurrences (Example Values - NOT Defaults)
These are example commands showing usage, not default values. Per gherkin notes, they can remain unchanged since they are illustrative:
- `commands.md:570` - Example command using 30 (illustrative)
- `USER-GUIDE.md:426` - Example command using 30 (illustrative)
- `progress-yaml-schema.md:376` - Schema example with 30 (illustrative)
- `first-sprint.md:434` - Example config with 30 (illustrative)

### Gherkin Verification Commands
From artifacts/step-1-gherkin.md:
1. `grep -q "max-iterations.*default: 60" plugins/m42-sprint/commands/run-sprint.md`
2. `grep -q "| \`--max-iterations N\` | 60 |" plugins/m42-sprint/docs/reference/commands.md`
3. `grep -q "max-iterations.*default: 60" plugins/m42-sprint/docs/USER-GUIDE.md`
4. `! grep -q "default: 30" plugins/m42-sprint/commands/run-sprint.md`
5. `! grep -q "max-iterations.*| 30 |" plugins/m42-sprint/docs/reference/commands.md`
6. `! grep -q "default: 30" plugins/m42-sprint/docs/USER-GUIDE.md`

### Edge Cases
- The grep patterns in gherkin scenarios are specific enough to avoid matching example values
- Only documented defaults need to change; example usage values in tutorials are intentionally lower to be conservative examples
