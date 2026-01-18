# Gherkin Scenarios: step-11

## Step Task
## Phase 5.1: Getting Started Guide

Create the primary user documentation:

### Tasks
1. Create docs/getting-started.md:
   - Prerequisites (Claude Code installed, plugin enabled)
   - Installation steps
   - First sign in 5 minutes (quick tutorial)
   - Basic workflow: add -> list -> status
   - Link to how-to guides for more

2. Structure docs/ folder:
   ```
   docs/
     getting-started.md    # Entry point
     how-to/
       add-sign-manually.md
       extract-from-session.md
       review-and-apply.md
       integrate-with-sprint.md
     reference/
       commands.md         # All commands reference
       backlog-format.md   # Schema documentation
   ```

3. Update README.md:
   - Keep it concise (installation + quick example)
   - Add "Documentation" section with link to docs/getting-started.md
   - Add badges if appropriate

### Success Criteria
- Getting started guide is complete and accurate
- New user can add their first sign in < 5 minutes
- docs/ structure is clear and navigable

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: Getting Started Guide Exists
```gherkin
Scenario: Getting started guide exists
  Given the docs directory structure is being created
  When I check for the main entry point
  Then docs/getting-started.md exists
```

Verification: `test -f plugins/m42-signs/docs/getting-started.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Getting Started Contains Prerequisites Section
```gherkin
Scenario: Getting started contains prerequisites section
  Given docs/getting-started.md exists
  When I check for required sections
  Then a Prerequisites section is present
```

Verification: `grep -qi "prerequisite" plugins/m42-signs/docs/getting-started.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Getting Started Contains Quick Tutorial
```gherkin
Scenario: Getting started contains quick tutorial workflow
  Given docs/getting-started.md exists
  When I check for the basic workflow tutorial
  Then the add -> list -> status workflow is documented
```

Verification: `grep -q "/m42-signs:add\|m42-signs:list\|/add" plugins/m42-signs/docs/getting-started.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: How-To Directory Structure Exists
```gherkin
Scenario: How-to directory structure exists
  Given the docs folder is being structured
  When I check for the how-to subdirectory
  Then docs/how-to/ directory exists with placeholder files
```

Verification: `test -d plugins/m42-signs/docs/how-to`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Reference Directory Structure Exists
```gherkin
Scenario: Reference directory structure exists
  Given the docs folder is being structured
  When I check for the reference subdirectory
  Then docs/reference/ directory exists
```

Verification: `test -d plugins/m42-signs/docs/reference`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: README Links to Documentation
```gherkin
Scenario: README links to getting started guide
  Given the README is being updated
  When I check for documentation links
  Then README.md contains a link to docs/getting-started.md
```

Verification: `grep -q "getting-started" plugins/m42-signs/README.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: README Contains Quick Example
```gherkin
Scenario: README contains quick usage example
  Given the README is being updated
  When I check for a usage example
  Then README.md contains a code example showing basic usage
```

Verification: `grep -q '```' plugins/m42-signs/README.md && grep -qi "example\|usage\|quick start" plugins/m42-signs/README.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
