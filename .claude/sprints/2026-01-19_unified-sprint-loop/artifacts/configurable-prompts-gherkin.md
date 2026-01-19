# Gherkin Scenarios: configurable-prompts

## Step Task
GIVEN the cleaned codebase without Ralph
WHEN making runtime prompts configurable and creating workflow templates
THEN enable customization via SPRINT.yaml prompts: section

## Scope
- Refactor build-sprint-prompt.sh for configurable prompts
- Create 2 additional workflow templates (minimal, orchestrated)
- Copy existing gherkin-workflow as template

## Acceptance Criteria

### build-sprint-prompt.sh Refactoring
- [ ] `load_prompt_template()` function:
  ```bash
  # Loads prompt from SPRINT.yaml or uses default
  load_prompt_template() {
    local key="$1"
    local default="$2"
    yq -r ".prompts.$key // \"$default\"" "$SPRINT_DIR/SPRINT.yaml"
  }
  ```
- [ ] `substitute_variables()` function:
  - Ersetzt {{sprint-id}}, {{iteration}}, {{phase.id}}, etc.
- [ ] Defaults für alle Prompt-Bausteine:
  - header, position, retry-warning, instructions, result-reporting
- [ ] Prompts werden aus SPRINT.yaml geladen wenn vorhanden

### Workflow Templates (in plugins/m42-sprint/templates/)
- [ ] `gherkin-step-workflow.yaml`:
  - Kopie von .claude/workflows/gherkin-step-workflow.yaml
  - Unverändert, als Referenz-Template

- [ ] `minimal-workflow.yaml`:
  ```yaml
  name: Minimal Workflow
  description: Direct step execution without sub-phases
  phases:
    - id: execute
      for-each: step
      prompt: |
        {{step.prompt}}
  ```

- [ ] `orchestrated-workflow.yaml`:
  ```yaml
  name: Orchestrated Workflow
  description: Dynamic step injection
  orchestration:
    enabled: true
    insert-strategy: after-current
  phases:
    - id: execute
      for-each: step
      prompt: |
        {{step.prompt}}

        ## Optional: Proposed Steps
        If you discover new tasks, include in JSON:
        {"proposedSteps": [{"prompt": "...", "reasoning": "...", "priority": "medium"}]}
  ```

### Verification
- [ ] Sprint mit custom `prompts:` in SPRINT.yaml verwendet custom prompts
- [ ] Sprint ohne `prompts:` verwendet defaults (backward compat)
- [ ] Alle 3 Templates sind valides YAML

## Files to create
- plugins/m42-sprint/templates/gherkin-step-workflow.yaml
- plugins/m42-sprint/templates/minimal-workflow.yaml
- plugins/m42-sprint/templates/orchestrated-workflow.yaml

## Files to modify
- plugins/m42-sprint/scripts/build-sprint-prompt.sh

## Context
- context/prompt-extraction-concept.md (Variable Substitution, Defaults)

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: load_prompt_template function exists
```gherkin
Scenario: load_prompt_template function is defined
  Given the build-sprint-prompt.sh script exists
  When I check for the load_prompt_template function
  Then the function is defined with key and default parameters
```

Verification: `grep -qE 'load_prompt_template\s*\(\)|^load_prompt_template\(\)' plugins/m42-sprint/scripts/build-sprint-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: substitute_variables function exists
```gherkin
Scenario: substitute_variables function is defined
  Given the build-sprint-prompt.sh script exists
  When I check for the substitute_variables function
  Then the function is defined to replace template variables
```

Verification: `grep -qE 'substitute_variables\s*\(\)|^substitute_variables\(\)' plugins/m42-sprint/scripts/build-sprint-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Variable substitution includes core variables
```gherkin
Scenario: Core template variables are substituted
  Given the substitute_variables function exists
  When I check for variable replacement patterns
  Then {{sprint-id}}, {{iteration}}, and {{phase.id}} are handled
```

Verification: `grep -q '{{sprint-id}}' plugins/m42-sprint/scripts/build-sprint-prompt.sh && grep -q '{{iteration}}' plugins/m42-sprint/scripts/build-sprint-prompt.sh && grep -q '{{phase.id}}' plugins/m42-sprint/scripts/build-sprint-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Gherkin step workflow template exists
```gherkin
Scenario: gherkin-step-workflow.yaml template is created
  Given the templates directory is set up
  When I check for the gherkin workflow template
  Then plugins/m42-sprint/templates/gherkin-step-workflow.yaml exists
```

Verification: `test -f plugins/m42-sprint/templates/gherkin-step-workflow.yaml`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Minimal workflow template exists and is valid
```gherkin
Scenario: minimal-workflow.yaml template is created with correct structure
  Given the templates directory is set up
  When I check for the minimal workflow template
  Then plugins/m42-sprint/templates/minimal-workflow.yaml exists and is valid YAML
```

Verification: `test -f plugins/m42-sprint/templates/minimal-workflow.yaml && yq -e '.name == "Minimal Workflow"' plugins/m42-sprint/templates/minimal-workflow.yaml > /dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Orchestrated workflow template exists with orchestration config
```gherkin
Scenario: orchestrated-workflow.yaml template is created with orchestration settings
  Given the templates directory is set up
  When I check for the orchestrated workflow template
  Then plugins/m42-sprint/templates/orchestrated-workflow.yaml exists with orchestration.enabled=true
```

Verification: `test -f plugins/m42-sprint/templates/orchestrated-workflow.yaml && yq -e '.orchestration.enabled == true' plugins/m42-sprint/templates/orchestrated-workflow.yaml > /dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: All workflow templates are valid YAML
```gherkin
Scenario: All three workflow templates pass YAML validation
  Given all workflow templates exist in plugins/m42-sprint/templates/
  When I validate each template with yq
  Then all templates parse without errors
```

Verification: `yq -e '.' plugins/m42-sprint/templates/gherkin-step-workflow.yaml > /dev/null 2>&1 && yq -e '.' plugins/m42-sprint/templates/minimal-workflow.yaml > /dev/null 2>&1 && yq -e '.' plugins/m42-sprint/templates/orchestrated-workflow.yaml > /dev/null 2>&1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: build-sprint-prompt.sh uses load_prompt_template for defaults
```gherkin
Scenario: Default prompts are loaded via load_prompt_template
  Given the load_prompt_template function exists
  When I check how prompts are assembled in the script
  Then the script calls load_prompt_template to get configurable prompts
```

Verification: `grep -qE 'load_prompt_template\s+"(header|position|retry-warning|instructions|result-reporting)"' plugins/m42-sprint/scripts/build-sprint-prompt.sh || grep -qE '\$\(load_prompt_template' plugins/m42-sprint/scripts/build-sprint-prompt.sh`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
