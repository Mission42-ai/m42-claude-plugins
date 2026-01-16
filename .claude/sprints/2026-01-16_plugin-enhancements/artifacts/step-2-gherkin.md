# Gherkin Scenarios: step-2

## Step Task
Track B - Step 1: Create creating-workflows Skill Structure

Create a new skill for workflow definition guidance.

Requirements:
- Create skills/creating-workflows/ directory structure
- Create main skill file: skills/creating-workflows/creating-workflows.md
- Create references/ subdirectory with:
  - workflow-schema.md (Full YAML schema reference)
  - template-variables.md (All available template variables)
  - phase-types.md (Simple vs for-each phase explanations)
  - workflow-patterns.md (Common workflow patterns)
- Create assets/ subdirectory with:
  - feature-workflow.yaml (Example feature workflow)
  - bugfix-workflow.yaml (Example bugfix workflow)
  - validation-checklist.md (Pre-deployment checklist)
- Main skill file should trigger on: "create workflow", "new workflow", "workflow definition", "define phases"
- Include comprehensive documentation for workflow authoring
- Reference existing workflows in .claude/workflows/ as examples

New files to create:
- skills/creating-workflows/creating-workflows.md
- skills/creating-workflows/references/*.md
- skills/creating-workflows/assets/*.{yaml,md}

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Main skill file exists
```gherkin
Scenario: Main skill file exists
  Given the project requires a creating-workflows skill
  When I check for the main skill file
  Then skills/creating-workflows/creating-workflows.md exists

Verification: `test -f plugins/m42-sprint/skills/creating-workflows/creating-workflows.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Skill file has valid YAML frontmatter with triggers
```gherkin
Scenario: Skill file has valid YAML frontmatter with triggers
  Given skills/creating-workflows/creating-workflows.md exists
  When I check the frontmatter for required triggers
  Then the file contains triggers for "create workflow", "new workflow", "workflow definition", "define phases"

Verification: `grep -E "create workflow|new workflow|workflow definition|define phases" plugins/m42-sprint/skills/creating-workflows/creating-workflows.md | head -1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: References directory contains workflow-schema.md
```gherkin
Scenario: References directory contains workflow-schema.md
  Given the skill requires schema documentation
  When I check for the workflow schema reference file
  Then skills/creating-workflows/references/workflow-schema.md exists

Verification: `test -f plugins/m42-sprint/skills/creating-workflows/references/workflow-schema.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: References directory contains template-variables.md
```gherkin
Scenario: References directory contains template-variables.md
  Given the skill requires template variable documentation
  When I check for the template variables reference file
  Then skills/creating-workflows/references/template-variables.md exists

Verification: `test -f plugins/m42-sprint/skills/creating-workflows/references/template-variables.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: References directory contains phase-types.md
```gherkin
Scenario: References directory contains phase-types.md
  Given the skill requires phase type documentation
  When I check for the phase types reference file
  Then skills/creating-workflows/references/phase-types.md exists

Verification: `test -f plugins/m42-sprint/skills/creating-workflows/references/phase-types.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: References directory contains workflow-patterns.md
```gherkin
Scenario: References directory contains workflow-patterns.md
  Given the skill requires workflow pattern documentation
  When I check for the workflow patterns reference file
  Then skills/creating-workflows/references/workflow-patterns.md exists

Verification: `test -f plugins/m42-sprint/skills/creating-workflows/references/workflow-patterns.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Assets directory contains example workflow YAML files
```gherkin
Scenario: Assets directory contains example workflow YAML files
  Given the skill requires example workflow templates
  When I check for the example workflow files
  Then feature-workflow.yaml and bugfix-workflow.yaml exist in assets

Verification: `test -f plugins/m42-sprint/skills/creating-workflows/assets/feature-workflow.yaml && test -f plugins/m42-sprint/skills/creating-workflows/assets/bugfix-workflow.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Assets directory contains validation-checklist.md
```gherkin
Scenario: Assets directory contains validation-checklist.md
  Given the skill requires a validation checklist
  When I check for the validation checklist file
  Then skills/creating-workflows/assets/validation-checklist.md exists

Verification: `test -f plugins/m42-sprint/skills/creating-workflows/assets/validation-checklist.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```
