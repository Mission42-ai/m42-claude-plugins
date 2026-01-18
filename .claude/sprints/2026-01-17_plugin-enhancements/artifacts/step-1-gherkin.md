# Gherkin Scenarios: step-1

## Step Task
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

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: run-sprint.md has default 60
```gherkin
Scenario: run-sprint.md shows default max-iterations as 60
  Given the file plugins/m42-sprint/commands/run-sprint.md exists
  When I check the max-iterations option documentation
  Then it shows default: 60 (not 30)

Verification: `grep -q "max-iterations.*default: 60" plugins/m42-sprint/commands/run-sprint.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: commands.md reference has default 60
```gherkin
Scenario: commands.md reference shows default max-iterations as 60
  Given the file plugins/m42-sprint/docs/reference/commands.md exists
  When I check the options table for run-sprint
  Then the max-iterations row shows 60 as default

Verification: `grep -q "| \`--max-iterations N\` | 60 |" plugins/m42-sprint/docs/reference/commands.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: USER-GUIDE.md has default 60
```gherkin
Scenario: USER-GUIDE.md shows default max-iterations as 60
  Given the file plugins/m42-sprint/docs/USER-GUIDE.md exists
  When I check the max-iterations documentation in the commands reference
  Then it shows default: 60 (not 30)

Verification: `grep -q "max-iterations.*default: 60" plugins/m42-sprint/docs/USER-GUIDE.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: No remaining default: 30 in run-sprint.md
```gherkin
Scenario: No references to default 30 remain in run-sprint.md
  Given the file plugins/m42-sprint/commands/run-sprint.md exists
  When I search for "default: 30" references
  Then no matches are found

Verification: `! grep -q "default: 30" plugins/m42-sprint/commands/run-sprint.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: No remaining default: 30 in commands.md reference
```gherkin
Scenario: No references to default 30 remain in commands.md
  Given the file plugins/m42-sprint/docs/reference/commands.md exists
  When I search for "| 30 |" in the options table
  Then no matches are found for max-iterations default

Verification: `! grep -q "max-iterations.*| 30 |" plugins/m42-sprint/docs/reference/commands.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: No remaining default: 30 in USER-GUIDE.md
```gherkin
Scenario: No references to default 30 remain in USER-GUIDE.md
  Given the file plugins/m42-sprint/docs/USER-GUIDE.md exists
  When I search for "default: 30" references
  Then no matches are found

Verification: `! grep -q "default: 30" plugins/m42-sprint/docs/USER-GUIDE.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Notes

The grep search found these occurrences that need updating:
1. `plugins/m42-sprint/commands/run-sprint.md:25` - `(default: 30)`
2. `plugins/m42-sprint/docs/reference/commands.md:94` - `| 30 |` in options table
3. `plugins/m42-sprint/docs/USER-GUIDE.md:152` - `(default: 30)`

Additional occurrences found that are **example values** (not defaults):
- `plugins/m42-sprint/docs/USER-GUIDE.md:426` - example command using 30 (can optionally update)
- `plugins/m42-sprint/docs/reference/commands.md:570` - example command using 30 (can optionally update)
- `plugins/m42-sprint/docs/reference/progress-yaml-schema.md:376` - schema example
- `plugins/m42-sprint/docs/getting-started/first-sprint.md:434` - example config

The primary scenarios focus on the documented default value. Example usage values in tutorials/examples may remain at 30 since they are illustrative rather than normative.
