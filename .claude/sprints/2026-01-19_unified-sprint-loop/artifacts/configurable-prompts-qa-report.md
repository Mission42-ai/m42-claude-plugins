# QA Report: configurable-prompts

## Summary
- Total Scenarios: 8
- Passed: 8
- Failed: 0
- Score: 8/8 = 100%

## Verification Results

| # | Scenario | Result | Details |
|---|----------|--------|---------|
| 1 | load_prompt_template function exists | PASS | Function defined in build-sprint-prompt.sh |
| 2 | substitute_variables function exists | PASS | Function defined in build-sprint-prompt.sh |
| 3 | Core template variables are substituted | PASS | {{sprint-id}}, {{iteration}}, {{phase.id}} handled |
| 4 | gherkin-step-workflow.yaml exists | PASS | File exists (15131 bytes) |
| 5 | minimal-workflow.yaml exists and is valid | PASS | Valid YAML with name="Minimal Workflow" |
| 6 | orchestrated-workflow.yaml has orchestration config | PASS | orchestration.enabled=true present |
| 7 | All workflow templates are valid YAML | PASS | All 3 templates parse successfully |
| 8 | load_prompt_template used for defaults | PASS | Called for header, position, retry-warning, instructions, result-reporting |

## Detailed Results

### Scenario 1: load_prompt_template function is defined
**Verification**: `grep -qE 'load_prompt_template\s*\(\)|^load_prompt_template\(\)' plugins/m42-sprint/scripts/build-sprint-prompt.sh`
**Exit Code**: 0
**Output**:
```
load_prompt_template() {
```
**Result**: PASS

### Scenario 2: substitute_variables function is defined
**Verification**: `grep -qE 'substitute_variables\s*\(\)|^substitute_variables\(\)' plugins/m42-sprint/scripts/build-sprint-prompt.sh`
**Exit Code**: 0
**Output**:
```
substitute_variables() {
```
**Result**: PASS

### Scenario 3: Core template variables are substituted
**Verification**: `grep -q '{{sprint-id}}' ... && grep -q '{{iteration}}' ... && grep -q '{{phase.id}}' ...`
**Exit Code**: 0
**Output**:
```
Sprint: {{sprint-id}} | Iteration: {{iteration}}'
    | sed "s|{{sprint-id}}|${SPRINT_ID:-}|g" \
Sprint: {{sprint-id}} | Iteration: {{iteration}}'
    | sed "s|{{iteration}}|${ITERATION:-1}|g" \
- Phase: **{{phase.id}}** ({{phase.index}}/{{phase.total}})
    | sed "s|{{phase.id}}|${PHASE_ID:-}|g" \
```
**Result**: PASS

### Scenario 4: gherkin-step-workflow.yaml template is created
**Verification**: `test -f plugins/m42-sprint/templates/gherkin-step-workflow.yaml`
**Exit Code**: 0
**Output**:
```
-rw-r--r-- 1 konstantin konstantin 15131 Jan 19 22:52 plugins/m42-sprint/templates/gherkin-step-workflow.yaml
```
**Result**: PASS

### Scenario 5: minimal-workflow.yaml template is created with correct structure
**Verification**: `test -f plugins/m42-sprint/templates/minimal-workflow.yaml && yq -e '.name == "Minimal Workflow"' ...`
**Exit Code**: 0
**Output**:
```
name: Minimal Workflow
description: Direct step execution without sub-phases
```
**Result**: PASS

### Scenario 6: orchestrated-workflow.yaml template is created with orchestration settings
**Verification**: `test -f plugins/m42-sprint/templates/orchestrated-workflow.yaml && yq -e '.orchestration.enabled == true' ...`
**Exit Code**: 0
**Output**:
```
orchestration:
  enabled: true
  insert-strategy: after-current
```
**Result**: PASS

### Scenario 7: All three workflow templates pass YAML validation
**Verification**: `yq -e '.' plugins/m42-sprint/templates/gherkin-step-workflow.yaml ... && yq -e '.' plugins/m42-sprint/templates/minimal-workflow.yaml ... && yq -e '.' plugins/m42-sprint/templates/orchestrated-workflow.yaml ...`
**Exit Code**: 0
**Output**:
```
=== gherkin-step-workflow.yaml ===
- name
- description
- phases
=== minimal-workflow.yaml ===
- name
- description
- phases
=== orchestrated-workflow.yaml ===
- name
- description
- orchestration
- phases
```
**Result**: PASS

### Scenario 8: Default prompts are loaded via load_prompt_template
**Verification**: `grep -qE 'load_prompt_template\s+"(header|position|...)"' ... || grep -qE '\$\(load_prompt_template' ...`
**Exit Code**: 0
**Output**:
```
HEADER_TEMPLATE=$(load_prompt_template "header" "$DEFAULT_HEADER")
POSITION_TEMPLATE=$(load_prompt_template "position" "$DEFAULT_POSITION")
RETRY_TEMPLATE=$(load_prompt_template "retry-warning" "$DEFAULT_RETRY_WARNING")
INSTRUCTIONS_TEMPLATE=$(load_prompt_template "instructions" "$DEFAULT_INSTRUCTIONS")
RESULT_TEMPLATE=$(load_prompt_template "result-reporting" "$DEFAULT_RESULT_REPORTING")
```
**Result**: PASS

## Issues Found
None - all scenarios passed.

## Status: PASS
