# Step Context: unified-loop-orchestration

## Task
GIVEN configurable prompts and workflow templates
WHEN implementing unified loop with orchestration
THEN enable dynamic step injection based on Claude's proposals

## Scope
- Unified run_loop() in sprint-loop.sh
- proposedSteps extraction from JSON result
- Step-queue management
- Orchestration iteration when step-queue not empty

## Related Code Patterns

### Pattern 1: JSON Result Extraction (sprint-loop.sh:672-711)
The existing `extract_json_result()` function provides the pattern for parsing Claude output:

```bash
extract_json_result() {
  local transcript_file="$1"

  # Extract from stream-json result field
  local result_text
  result_text=$(jq -rs '[.[] | select(.type=="result")] | last | .result // empty' "$transcript_file" 2>/dev/null)

  # Extract JSON from markdown code block (```json ... ```)
  local json_block
  json_block=$(echo "$result_text" | sed -n '/```json/,/```/p' | sed '1d;$d' | tr '\n' ' ')

  # Validate and return
  if echo "$json_block" | jq empty 2>/dev/null; then
    echo "$json_block"
  fi
}
```

The `extract_proposed_steps()` function should build on this pattern.

### Pattern 2: YAML Atomic Updates (sprint-loop.sh:305-339)
All PROGRESS.yaml modifications use atomic updates for consistency:

```bash
yaml_atomic_update() {
  local expressions=("$@")
  local combined_expr="${expressions[0]}"
  for ((i=1; i<${#expressions[@]}; i++)); do
    combined_expr="$combined_expr | ${expressions[i]}"
  done

  local temp_file="${PROGRESS_FILE}.tmp.$$"
  yq -e "$combined_expr" "$PROGRESS_FILE" > "$temp_file" 2>/dev/null
  mv "$temp_file" "$PROGRESS_FILE"
  save_checksum
}
```

The `add_to_step_queue()` and `insert_step_at_position()` functions must use this pattern.

### Pattern 3: Process Standard Result (sprint-loop.sh:714-802)
The existing result processing flow provides the template for extending with proposedSteps:

```bash
process_standard_result() {
  local transcript_file="$1"
  # ... existing fields: status, summary, error, humanNeeded

  # After processing status, we add proposedSteps extraction:
  # local proposed_steps=$(extract_proposed_steps "$transcript_file")
  # if [[ -n "$proposed_steps" ]] && [[ "$proposed_steps" != "[]" ]]; then
  #   add_to_step_queue "$proposed_steps" "$step_id"
  # fi
}
```

### Pattern 4: Main Loop Structure (sprint-loop.sh:1833-2081)
The `run_standard_loop()` provides the iteration pattern to follow:

```bash
for ((i=1; i<=MAX_ITERATIONS; i++)); do
  # Write iteration counter
  yq -i ".stats.\"current-iteration\" = $i" "$PROGRESS_FILE"

  # Build and execute prompt
  PROMPT=$("$SCRIPT_DIR/build-sprint-prompt.sh" "$SPRINT_DIR" "$i")
  claude -p "$PROMPT" --dangerously-skip-permissions --output-format stream-json > "$TRANSCRIPT_FILE" 2>&1

  # Process result
  process_standard_result "$TRANSCRIPT_FILE" ...

  # Check status and loop control
  STATUS=$(yq -r '.status' "$PROGRESS_FILE")
done
```

The unified `run_loop()` will add orchestration checks after processing results.

### Pattern 5: Dynamic Step Creation (from Ralph mode, sprint-loop.sh:925-963)
Ralph mode's pendingSteps processing shows how to add steps dynamically:

```bash
# Process each step from agent's pending list
while read -r step; do
  local step_id step_prompt
  step_id=$(echo "$step" | jq -r '.id // empty')
  step_prompt=$(echo "$step" | jq -r '.prompt')

  if [[ -z "$step_id" ]]; then
    # Generate new ID and add
    local new_id="step-$next_id"
    yq -i ".dynamic-steps += [{
      \"id\": \"$new_id\",
      \"prompt\": \"$step_prompt\",
      \"status\": \"pending\",
      \"added-at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }]" "$PROGRESS_FILE"
  fi
done < <(echo "$pending_steps" | jq -c '.[]')
```

## Required Imports / Dependencies

### Internal (from sprint-loop.sh)
- `PROGRESS_FILE` - global path to PROGRESS.yaml
- `SPRINT_DIR` - sprint directory path
- `yaml_atomic_update()` - atomic YAML writes
- `extract_json_result()` - JSON parsing from transcript

### External Commands
- `yq` - YAML manipulation (already required)
- `jq` - JSON parsing (already required)
- `date` - ISO timestamps (already available)

## Types/Interfaces to Use

### ProposedStep (from Claude's JSON result)
```typescript
// Agent outputs this in their JSON result
interface ProposedStep {
  prompt: string;           // Required: the task prompt
  reasoning?: string;       // Optional: why this step is needed
  priority?: 'high' | 'medium' | 'low';  // Default: medium
}
```

### StepQueueItem (stored in PROGRESS.yaml)
```yaml
# In PROGRESS.yaml under step-queue:
- id: "proposed-001"
  prompt: "Refactor authentication module"
  proposedBy: "step-foundation"
  proposedAt: "2026-01-19T14:30:00Z"
  priority: "medium"
  reasoning: "Found code duplication during implementation"
```

### OrchestrationConfig (from SPRINT.yaml or workflow)
```yaml
orchestration:
  enabled: true
  insertStrategy: 'after-current' | 'end-of-phase' | 'custom'
  autoApprove: false
  prompt: |  # Optional custom orchestration prompt
    Review these proposed steps...
```

## Integration Points

### Called by
- Main execution entry point (replaces `run_standard_loop`)

### Calls
- `build-sprint-prompt.sh` - builds iteration prompt
- `process_standard_result()` - processes Claude output (extended with proposedSteps)
- `extract_proposed_steps()` - NEW: extracts proposedSteps from result
- `add_to_step_queue()` - NEW: adds to step-queue
- `should_run_orchestration()` - NEW: checks if orchestration needed
- `run_orchestration_iteration()` - NEW: executes orchestration
- `insert_step_at_position()` - NEW: inserts approved steps

### Tests
- Manual testing via running sprints with/without orchestration
- Verification via gherkin scenarios in artifacts/unified-loop-orchestration-gherkin.md

## Implementation Notes

### 1. Unified Loop Replaces run_standard_loop
- Rename `run_standard_loop()` to `run_loop()`
- Remove the `run_ralph_loop()` entirely (previous step)
- Remove mode dispatch at bottom of script

### 2. ProposedSteps Extraction Pattern
```bash
extract_proposed_steps() {
  local transcript_file="$1"
  local json_result
  json_result=$(extract_json_result "$transcript_file")

  if [[ -z "$json_result" ]]; then
    echo "[]"
    return
  fi

  # Extract proposedSteps array, default to empty
  echo "$json_result" | jq -c '.proposedSteps // []'
}
```

### 3. Step Queue Entry Generation
```bash
add_to_step_queue() {
  local proposed_json="$1"
  local proposed_by="$2"
  local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Get next queue ID
  local max_id=$(yq -r '["step-queue"//[]].[].id | select(. != null) | ltrimstr("proposed-") | tonumber' "$PROGRESS_FILE" | sort -rn | head -1)
  local next_id=$((${max_id:-0} + 1))

  # Parse each proposed step and add to queue
  echo "$proposed_json" | jq -c '.[]' | while read -r step; do
    local prompt=$(echo "$step" | jq -r '.prompt')
    local priority=$(echo "$step" | jq -r '.priority // "medium"')
    local reasoning=$(echo "$step" | jq -r '.reasoning // ""')

    yq -i ".\"step-queue\" += [{
      \"id\": \"proposed-$next_id\",
      \"prompt\": \"$prompt\",
      \"proposedBy\": \"$proposed_by\",
      \"proposedAt\": \"$timestamp\",
      \"priority\": \"$priority\",
      \"reasoning\": \"$reasoning\"
    }]" "$PROGRESS_FILE"
    next_id=$((next_id + 1))
  done
}
```

### 4. Orchestration Check Pattern
```bash
should_run_orchestration() {
  # Check if orchestration is enabled
  local enabled=$(yq -r '.orchestration.enabled // false' "$PROGRESS_FILE")
  if [[ "$enabled" != "true" ]]; then
    return 1
  fi

  # Check if step-queue has items
  local queue_count=$(yq -r '."step-queue" // [] | length' "$PROGRESS_FILE")
  if [[ "$queue_count" -eq 0 ]]; then
    return 1
  fi

  return 0
}
```

### 5. Auto-Approve Mode
```bash
if [[ "$(yq -r '.orchestration.autoApprove // false' "$PROGRESS_FILE")" == "true" ]]; then
  # Insert directly without orchestration call
  local strategy=$(yq -r '.orchestration.insertStrategy // "end-of-phase"' "$PROGRESS_FILE")
  # Process all queued steps with insert_step_at_position
else
  # Run orchestration iteration for human-like decision making
  run_orchestration_iteration
fi
```

### 6. Insert Strategy Options
- `after-current`: Insert immediately after current step (within same phase)
- `end-of-phase`: Append to end of current phase's steps
- `custom`: Use custom position specified in orchestration decision

### 7. Backward Compatibility
- Sprints without `orchestration` section run exactly as before
- proposedSteps in result are silently ignored if orchestration disabled
- No changes to existing sprint execution flow

### 8. Error Handling
- Invalid proposedSteps JSON → log warning, continue execution
- Orchestration failure → log error, continue with next iteration
- Empty step-queue → skip orchestration check entirely
