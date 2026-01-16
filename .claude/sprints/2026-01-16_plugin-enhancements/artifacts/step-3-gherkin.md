# Gherkin Scenarios: step-3

## Step Task
Track B - Step 2: Create creating-sprints Skill Structure

Create a new skill for sprint definition guidance.

Requirements:
- Create skills/creating-sprints/ directory structure
- Create main skill file: skills/creating-sprints/creating-sprints.md
- Create references/ subdirectory with:
  - sprint-schema.md (SPRINT.yaml structure reference)
  - step-writing-guide.md (How to write effective step prompts)
  - workflow-selection.md (Guide for choosing appropriate workflows)
- Create assets/ subdirectory with:
  - sprint-template.yaml (Annotated example sprint definition)
- Main skill file should trigger on: "create sprint", "new sprint", "sprint definition", "define steps"
- Include best practices for step prompts (clear, actionable, scoped)
- Guidance on sprint sizing (3-8 steps, single responsibility)
- Integration instructions with existing workflows

New files to create:
- skills/creating-sprints/creating-sprints.md
- skills/creating-sprints/references/*.md
- skills/creating-sprints/assets/sprint-template.yaml

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Main skill file exists
  Given the skills directory structure exists
  When I check for the main skill file
  Then skills/creating-sprints/creating-sprints.md exists

Verification: `test -f plugins/m42-sprint/skills/creating-sprints/creating-sprints.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Sprint schema reference exists
  Given the skill references directory is set up
  When I check for the schema reference
  Then skills/creating-sprints/references/sprint-schema.md exists

Verification: `test -f plugins/m42-sprint/skills/creating-sprints/references/sprint-schema.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Step writing guide reference exists
  Given the skill references directory is set up
  When I check for the step writing guide
  Then skills/creating-sprints/references/step-writing-guide.md exists

Verification: `test -f plugins/m42-sprint/skills/creating-sprints/references/step-writing-guide.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Workflow selection guide reference exists
  Given the skill references directory is set up
  When I check for the workflow selection guide
  Then skills/creating-sprints/references/workflow-selection.md exists

Verification: `test -f plugins/m42-sprint/skills/creating-sprints/references/workflow-selection.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Sprint template asset exists
  Given the skill assets directory is set up
  When I check for the sprint template
  Then skills/creating-sprints/assets/sprint-template.yaml exists

Verification: `test -f plugins/m42-sprint/skills/creating-sprints/assets/sprint-template.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Main skill file contains required triggers
  Given the main skill file exists
  When I check the frontmatter description for triggers
  Then all required trigger phrases are present (create sprint, new sprint, sprint definition, define steps)

Verification: `grep -q "create sprint" plugins/m42-sprint/skills/creating-sprints/creating-sprints.md && grep -q "new sprint" plugins/m42-sprint/skills/creating-sprints/creating-sprints.md && grep -q "sprint definition" plugins/m42-sprint/skills/creating-sprints/creating-sprints.md && grep -q "define steps" plugins/m42-sprint/skills/creating-sprints/creating-sprints.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Main skill file contains sprint sizing guidance
  Given the main skill file exists
  When I check for sprint sizing content
  Then guidance for 3-8 steps and single responsibility is documented

Verification: `grep -q "3-8\|3 to 8\|three to eight" plugins/m42-sprint/skills/creating-sprints/creating-sprints.md && grep -qi "single.*responsib\|responsib.*single\|focused\|one.*goal\|single.*purpose" plugins/m42-sprint/skills/creating-sprints/creating-sprints.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Step writing guide contains best practices
  Given the step writing guide reference exists
  When I check for best practice keywords
  Then the guide includes clear, actionable, and scoped guidance

Verification: `grep -qi "clear\|clarity" plugins/m42-sprint/skills/creating-sprints/references/step-writing-guide.md && grep -qi "actionable\|action" plugins/m42-sprint/skills/creating-sprints/references/step-writing-guide.md && grep -qi "scope\|scoped\|bounded" plugins/m42-sprint/skills/creating-sprints/references/step-writing-guide.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
