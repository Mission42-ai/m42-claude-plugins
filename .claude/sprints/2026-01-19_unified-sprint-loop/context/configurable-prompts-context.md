# Step Context: configurable-prompts

## Task
GIVEN the cleaned codebase without Ralph
WHEN making runtime prompts configurable and creating workflow templates
THEN enable customization via SPRINT.yaml prompts: section

## Scope
- Refactor build-sprint-prompt.sh for configurable prompts
- Create 2 additional workflow templates (minimal, orchestrated)
- Copy existing gherkin-workflow as template

## Related Code Patterns

### Pattern: yq fallback values (from build-sprint-prompt.sh)
```bash
# Uses // for default values when field doesn't exist
PHASE_IDX=$(yq -r '.current.phase // 0' "$PROGRESS_FILE")
SUB_PHASE_ERROR=$(yq -r ".phases[$PHASE_IDX].error // \"null\"" "$PROGRESS_FILE")
```

### Pattern: Reading config from SPRINT.yaml (sprint-loop.sh:127)
```bash
# CLI flag takes precedence over config file
CONFIG_MAX_ITER=$(yq -r '.config."max-iterations" // "null"' "$SPRINT_YAML" 2>/dev/null || echo "null")
```

### Existing Prompt Structure (build-sprint-prompt.sh:126-186)
Current hardcoded prompts in two places:
1. **For-each phase with steps** (lines 126-186): Full prompt with step context
2. **Simple phase** (lines 221-276): Similar structure without step context

#### Prompt Components (extractable as defaults):
| Component | Lines | Current Content |
|-----------|-------|-----------------|
| header | 126-128 | `# Sprint Workflow Execution\nSprint: $SPRINT_ID \| Iteration: $ITERATION` |
| position | 130-134 | Phase/Step/Sub-Phase indices |
| retry-warning | 138-144 | Warning with retry count and error |
| instructions | 156-160 | Execute, commit, EXIT immediately |
| result-reporting | 167-186 | JSON format for status reporting |

### TypeScript Types (already defined in types.ts:211-222)
```typescript
interface SprintPrompts {
  header?: string;
  position?: string;
  'retry-warning'?: string;
  instructions?: string;
  'result-reporting'?: string;
}

interface SprintDefinition {
  // ... existing fields
  prompts?: SprintPrompts;
}
```

### Workflow Definition Structure (gherkin-step-workflow.yaml)
```yaml
name: Gherkin Step Workflow
description: |
  Per-step workflow that generates binary-verifiable gherkin scenarios...

phases:
  - id: plan
    prompt: |
      Generate binary-verifiable gherkin scenarios for this step.
      ## Your Task
      {{step.prompt}}
      ...
  - id: context
    prompt: |
      Gather step-specific context...
```

## Required Imports
### Internal
- None - bash script, no imports needed

### External (System Dependencies)
- `yq`: YAML manipulation in bash (already used extensively)
- `sed`: String replacement for variable substitution

## Files to Create

### 1. plugins/m42-sprint/templates/gherkin-step-workflow.yaml
- Copy from: `.claude/workflows/gherkin-step-workflow.yaml`
- No modifications needed (reference template)

### 2. plugins/m42-sprint/templates/minimal-workflow.yaml
```yaml
name: Minimal Workflow
description: Direct step execution without sub-phases

phases:
  - id: execute
    for-each: step
    prompt: |
      {{step.prompt}}
```

### 3. plugins/m42-sprint/templates/orchestrated-workflow.yaml
```yaml
name: Orchestrated Workflow
description: Dynamic step injection based on discoveries

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

## Files to Modify

### plugins/m42-sprint/scripts/build-sprint-prompt.sh

#### New Function: load_prompt_template()
```bash
# Loads prompt from SPRINT.yaml or uses default
# Args: $1 = key (e.g., "header"), $2 = default value
load_prompt_template() {
  local key="$1"
  local default="$2"
  local sprint_yaml="$SPRINT_DIR/SPRINT.yaml"

  if [[ -f "$sprint_yaml" ]]; then
    local custom=$(yq -r ".prompts.$key // \"\"" "$sprint_yaml")
    if [[ -n "$custom" ]]; then
      echo "$custom"
      return
    fi
  fi
  echo "$default"
}
```

#### New Function: substitute_variables()
```bash
# Replaces template variables in prompt text
# Args: $1 = template text
substitute_variables() {
  local template="$1"
  echo "$template" \
    | sed "s/{{sprint-id}}/$SPRINT_ID/g" \
    | sed "s/{{iteration}}/$ITERATION/g" \
    | sed "s/{{phase.id}}/$PHASE_ID/g" \
    | sed "s/{{phase.index}}/$((PHASE_IDX + 1))/g" \
    | sed "s/{{phase.total}}/$TOTAL_PHASES/g" \
    | sed "s/{{step.id}}/${STEP_ID:-}/g" \
    | sed "s/{{step.index}}/$((STEP_IDX + 1))/g" \
    | sed "s/{{step.total}}/${TOTAL_STEPS:-0}/g" \
    | sed "s/{{sub-phase.id}}/${SUB_PHASE_ID:-}/g" \
    | sed "s/{{sub-phase.index}}/$((SUB_PHASE_IDX + 1))/g" \
    | sed "s/{{sub-phase.total}}/${TOTAL_SUB_PHASES:-0}/g" \
    | sed "s/{{retry-count}}/${RETRY_COUNT:-0}/g" \
    | sed "s/{{error}}/${ERROR:-}/g"
}
```

#### Default Prompts (to be defined as heredoc variables)
```bash
DEFAULT_HEADER='# Sprint Workflow Execution
Sprint: {{sprint-id}} | Iteration: {{iteration}}'

DEFAULT_POSITION='## Current Position
- Phase: **{{phase.id}}** ({{phase.index}}/{{phase.total}})
- Step: **{{step.id}}** ({{step.index}}/{{step.total}})
- Sub-Phase: **{{sub-phase.id}}** ({{sub-phase.index}}/{{sub-phase.total}})'

DEFAULT_RETRY_WARNING='## Warning: RETRY ATTEMPT {{retry-count}}
This task previously failed. Please review the error and try a different approach.

Previous error: {{error}}'

DEFAULT_INSTRUCTIONS='## Instructions

1. Execute this sub-phase task
2. Commit your changes when the task is done
3. **EXIT immediately** - do NOT continue to next task'

DEFAULT_RESULT_REPORTING='## Result Reporting (IMPORTANT)

Do NOT modify PROGRESS.yaml directly. The sprint loop handles all state updates.
Report your result as JSON in your final output:

**On Success:**
```json
{"status": "completed", "summary": "Brief description of what was accomplished"}
```

**On Failure:**
```json
{"status": "failed", "summary": "What was attempted", "error": "What went wrong"}
```

**If Human Needed:**
```json
{"status": "needs-human", "summary": "What was done so far", "humanNeeded": {"reason": "Why human is needed", "details": "Additional context"}}
```'
```

## Integration Points
- **Called by**: `sprint-loop.sh` at line 1414
  ```bash
  PROMPT=$("$SCRIPT_DIR/build-sprint-prompt.sh" "$SPRINT_DIR" "$i")
  ```
- **Reads from**: `SPRINT_DIR/PROGRESS.yaml`, `SPRINT_DIR/SPRINT.yaml`
- **Tests**: `test-normal-subphase.sh`, `test-skip-parallel-task-id.sh`, `test-skip-spawned.sh`

## Implementation Notes

1. **Backward Compatibility**: If `prompts:` section doesn't exist in SPRINT.yaml, defaults are used (same behavior as before)

2. **Variable Substitution Order**: Variables must be substituted AFTER loading the template, since the template may contain placeholders like `{{sprint-id}}`

3. **Multi-line Handling**: Use heredoc for default values to preserve newlines in bash

4. **Templates Directory**: Create `plugins/m42-sprint/templates/` directory if it doesn't exist

5. **Escaping**: Default prompts containing backticks need careful escaping in heredocs (use `'EOF'` instead of `EOF`)

6. **Position Template Variants**: Need two variants - one with step/sub-phase (for-each), one without (simple phase)

7. **Gherkin Scenarios to Pass**:
   - Scenario 1: `load_prompt_template` function exists
   - Scenario 2: `substitute_variables` function exists
   - Scenario 3: Core variables ({{sprint-id}}, {{iteration}}, {{phase.id}}) handled
   - Scenarios 4-7: Template files exist and are valid YAML
   - Scenario 8: `load_prompt_template` is actually called for prompts
