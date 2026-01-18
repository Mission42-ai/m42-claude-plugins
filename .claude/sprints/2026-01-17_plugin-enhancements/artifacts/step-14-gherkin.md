# Gherkin Scenarios: step-14

## Step Task
Phase 4 - Step 6: Update sprint-watch Command for Dashboard Mode

Add --dashboard flag to sprint-watch command to open dashboard view.

Requirements:
- Add `--dashboard` flag to sprint-watch.md command
- When --dashboard, open browser to `/` instead of `/sprint/<id>`
- Update command help text with new flag
- Allow running dashboard mode without active sprint

Verification:
- Run `/sprint-watch --dashboard`, verify dashboard opens
- Run `/sprint-watch` normally, verify sprint detail opens

File to modify:
- plugins/m42-sprint/commands/sprint-watch.md

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: Command file exists
Given the plugin structure is set up
When I check for the sprint-watch command file
Then plugins/m42-sprint/commands/sprint-watch.md exists

Verification: `test -f plugins/m42-sprint/commands/sprint-watch.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: --dashboard flag documented in argument parsing
Given plugins/m42-sprint/commands/sprint-watch.md exists
When I check for --dashboard flag documentation
Then the argument parsing section mentions --dashboard

Verification: `grep -q "\-\-dashboard" plugins/m42-sprint/commands/sprint-watch.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Dashboard flag opens root URL
Given the --dashboard flag is documented
When I check the command instructions for dashboard URL behavior
Then the file specifies opening `/` (root dashboard) when --dashboard is used

Verification: `grep -E "(dashboard.*(/|root|localhost:[0-9]+\"))|(/.*dashboard)" plugins/m42-sprint/commands/sprint-watch.md | grep -qE "(/\"|/\s|localhost:[0-9]+\"?\s*$|localhost:[0-9]+/\")"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Dashboard mode works without active sprint
Given the --dashboard flag is documented
When I check for instructions about running without an active sprint
Then the file indicates that --dashboard can run without requiring an active sprint

Verification: `grep -iE "(dashboard.*(without|no).*(active|sprint|directory))|(without.*(active|sprint).*dashboard)|(\-\-dashboard.*optional)|(dashboard.*mode.*(doesn't|does not|skip))" plugins/m42-sprint/commands/sprint-watch.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Description includes dashboard functionality
Given the command file exists
When I check the description or usage section
Then the --dashboard flag purpose is explained

Verification: `grep -iE "dashboard.*(flag|option|mode)" plugins/m42-sprint/commands/sprint-watch.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Usage examples include --dashboard
Given the command file has usage examples
When I check the usage examples section
Then at least one example shows --dashboard usage

Verification: `grep -A20 "Usage Example" plugins/m42-sprint/commands/sprint-watch.md | grep -q "\-\-dashboard"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
