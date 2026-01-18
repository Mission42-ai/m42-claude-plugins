# Gherkin Scenarios: step-10

## Step Task
## Phase 4.1: Sprint Workflow Integration

Create workflow step template for learning extraction:

### Tasks
1. Create skills/managing-signs/assets/learning-extraction-workflow.yaml:
   - Phase that runs after sprint completion
   - Receives session transcript path
   - Runs extraction with --confidence-min medium
   - Outputs backlog summary

2. Document integration in skills/managing-signs/SKILL.md:
   - How to add learning extraction to sprint workflows
   - Session transcript variable names
   - Example workflow configurations

3. Create example in skills/managing-signs/assets/sprint-with-learning.yaml:
   - Complete sprint workflow
   - Includes learning extraction phase
   - Shows how phases connect

### Success Criteria
- Workflow template is valid YAML
- Integration documentation is clear
- Example works with m42-sprint


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: Learning extraction workflow file exists
Given the sprint workflow integration is implemented
When I check for the workflow template file
Then plugins/m42-signs/skills/managing-signs/assets/learning-extraction-workflow.yaml exists

Verification: `test -f plugins/m42-signs/skills/managing-signs/assets/learning-extraction-workflow.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Learning extraction workflow is valid YAML
Given the learning-extraction-workflow.yaml file exists
When I validate the YAML syntax
Then no YAML parsing errors occur

Verification: `yq e '.' plugins/m42-signs/skills/managing-signs/assets/learning-extraction-workflow.yaml > /dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Workflow contains extraction phase with confidence filter
Given the learning-extraction-workflow.yaml file exists
When I check for the extraction phase configuration
Then the workflow includes extraction with --confidence-min option

Verification: `grep -q '\-\-confidence-min' plugins/m42-signs/skills/managing-signs/assets/learning-extraction-workflow.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Sprint with learning example file exists
Given the example workflow is created
When I check for the complete sprint example
Then plugins/m42-signs/skills/managing-signs/assets/sprint-with-learning.yaml exists

Verification: `test -f plugins/m42-signs/skills/managing-signs/assets/sprint-with-learning.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Sprint with learning example is valid YAML
Given the sprint-with-learning.yaml file exists
When I validate the YAML syntax
Then no YAML parsing errors occur

Verification: `yq e '.' plugins/m42-signs/skills/managing-signs/assets/sprint-with-learning.yaml > /dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Sprint example includes learning extraction phase
Given the sprint-with-learning.yaml file exists
When I check the workflow structure
Then it contains a phase referencing learning extraction

Verification: `yq e '.phases[].id' plugins/m42-signs/skills/managing-signs/assets/sprint-with-learning.yaml 2>/dev/null | grep -qE 'learning|extract'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: SKILL.md documents sprint workflow integration
Given the SKILL.md file is updated
When I check for workflow integration documentation
Then the documentation includes sprint integration guidance

Verification: `grep -q -i 'sprint.*workflow\|workflow.*integration' plugins/m42-signs/skills/managing-signs/SKILL.md`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
