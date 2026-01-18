# Gherkin Scenarios: step-14

## Step Task
## Phase 5.4: Final Polish and Testing

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


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: CONCEPT.md has all phases marked complete
  Given the CONCEPT.md file exists
  When I check for phase completion markers
  Then all phases (1-4) are marked as complete with [x]

Verification: `grep -E '^\s*- \[x\]' plugins/m42-signs/CONCEPT.md | wc -l | xargs test 7 -le`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: CONCEPT.md links to getting-started guide
  Given the CONCEPT.md file exists
  When I check for the getting-started link
  Then a link to docs/getting-started.md is present

Verification: `grep -q 'docs/getting-started' plugins/m42-signs/CONCEPT.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: CONCEPT.md has known limitations section
  Given the CONCEPT.md file exists
  When I check for known limitations
  Then a "Known Limitations" or "Limitations" section exists

Verification: `grep -qi '## .*limitation' plugins/m42-signs/CONCEPT.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Documentation internal links are valid
  Given the docs/ directory contains markdown files
  When I check all relative markdown links
  Then all linked files exist

Verification: `cd plugins/m42-signs/docs && find . -name '*.md' -exec grep -hoE '\]\([^)]+\.md\)' {} \; | sed 's/](\(.*\))/\1/' | while read link; do test -f "$link" || exit 1; done`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: SKILL.md has proper frontmatter with triggers
  Given the SKILL.md file exists
  When I check the frontmatter
  Then it has name, description, and trigger keywords

Verification: `grep -q '^name:' plugins/m42-signs/skills/managing-signs/SKILL.md && grep -q '^description:' plugins/m42-signs/skills/managing-signs/SKILL.md && grep -q 'Triggers on' plugins/m42-signs/skills/managing-signs/SKILL.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: SKILL.md links to user documentation
  Given the SKILL.md file exists
  When I check for documentation references
  Then it references the docs/ directory or commands

Verification: `grep -qE 'docs/|/m42-signs:' plugins/m42-signs/skills/managing-signs/SKILL.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: No placeholder text in documentation
  Given all documentation files exist
  When I search for common placeholder patterns
  Then no placeholder text like TODO, FIXME, TBD, [placeholder] is found

Verification: `! grep -riE '(TODO|FIXME|TBD|\[placeholder\]|\[PLACEHOLDER\]|XXX)' plugins/m42-signs/docs/`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---
