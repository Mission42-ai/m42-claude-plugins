# Step Context: step-10

## Task
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


## Related Code Patterns

### Similar Implementation: plugins/m42-sprint/skills/creating-workflows/assets/feature-workflow.yaml
```yaml
# Feature Implementation Workflow Template
# Use as step-level workflow for feature development
#
# Usage: Reference in sprint workflow's for-each phase
#   phases:
#     - id: development
#       for-each: step
#       workflow: feature-workflow

name: Feature Implementation
description: Step-level workflow for implementing features

phases:
  - id: plan
    prompt: |
      ## Task
      {{step.prompt}}
      # ... instructions ...
```

### Similar Implementation: plugins/m42-sprint/skills/orchestrating-sprints/assets/workflow-template.yaml
```yaml
# Top-level workflow template showing simple and for-each phases
name: custom-workflow
description: Brief description

phases:
  - id: setup
    prompt: |
      Setup phase instructions.
      Use {{sprint.id}} for sprint context.

  - id: main
    for-each: step
    workflow: feature-standard

  - id: finalize
    prompt: |
      Finalization instructions.
```

## Required Imports
### Internal
- No TypeScript imports (pure YAML + Markdown)

### External
- `yq`: YAML processing for validation

## Types/Interfaces to Use

### Workflow Schema (from creating-workflows/references/workflow-schema.md)
```yaml
name: <string>           # Required - human-readable name
description: <string>    # Optional - brief description
phases: <list>           # Required - ordered list of phases

# Phase structure (simple phase)
- id: <string>           # Required - unique identifier
  prompt: <string>       # Required - execution instructions

# Phase structure (for-each phase)
- id: <string>           # Required - unique identifier
  for-each: step         # Required - iteration mode
  workflow: <string>     # Required - workflow reference (no .yaml extension)
```

### Template Variables (from creating-workflows/references/template-variables.md)
| Variable | Available In | Description |
|----------|--------------|-------------|
| `{{step.prompt}}` | For-each phases | Step description |
| `{{step.id}}` | For-each phases | Step identifier |
| `{{sprint.id}}` | All phases | Sprint identifier |
| `{{sprint.name}}` | All phases | Sprint name |
| `{{phase.id}}` | All phases | Current phase identifier |

## Integration Points
- Called by: m42-sprint workflows via `for-each: step` or as standalone phase
- Calls: `/m42-signs:extract` command with session transcript path
- Tests: Manual validation via `yq e '.' <file>.yaml`

### Transcript Location Pattern (from sprint-loop.sh)
```bash
# Transcripts stored at:
$SPRINT_DIR/transcripts/<phase>-<step>-<subphase>.jsonl

# Generated via:
get_transcript_filename() {
  local log_file=$(get_log_filename)
  local base_name=$(basename "$log_file" .log)
  mkdir -p "$SPRINT_DIR/transcripts"
  echo "$SPRINT_DIR/transcripts/${base_name}.jsonl"
}
```

### Extract Command Interface (from commands/extract.md)
```bash
# Usage:
/m42-signs:extract <session-id|path> [--dry-run] [--confidence-min <level>] [--auto-approve]

# Arguments:
# - session-id|path: Either session ID or file path to transcript
# - --confidence-min: low | medium | high
# - --dry-run: Preview without writing
# - --auto-approve: Auto-approve high-confidence learnings
```

## Implementation Notes

### File Structure to Create
```text
plugins/m42-signs/skills/managing-signs/
├── SKILL.md                         # UPDATE: Add workflow integration docs
└── assets/
    ├── backlog-template.yaml        # EXISTS
    ├── learning-extraction-workflow.yaml  # CREATE
    └── sprint-with-learning.yaml    # CREATE
```

### Workflow Design Decisions

1. **learning-extraction-workflow.yaml**:
   - Post-sprint phase (runs after all development steps complete)
   - Uses simple phase with prompt (not for-each)
   - Invokes `/m42-signs:extract` with transcript path
   - Uses `--confidence-min medium` as sensible default
   - Outputs summary of learnings found

2. **sprint-with-learning.yaml**:
   - Complete sprint workflow template
   - Includes: prepare → development → qa → learning-extraction phases
   - Shows integration of learning extraction as final phase
   - Development phase uses `for-each: step` pattern

3. **SKILL.md Updates**:
   - Add "## Sprint Workflow Integration" section
   - Document transcript path patterns
   - Document template variables available
   - Include example configurations

### Transcript Path Patterns
When running in sprint context, transcripts are located at:
- `.claude/sprints/<sprint-id>/transcripts/<phase>-<step>-<subphase>.jsonl`
- Can reference via `{{sprint.id}}` in workflow prompts

### Example Integration Snippet
```yaml
# Add to any sprint workflow as final phase:
- id: learning-extraction
  prompt: |
    Extract learnings from this sprint's development sessions.

    Use /m42-signs:extract to process transcripts at:
    .claude/sprints/{{sprint.id}}/transcripts/

    Use --confidence-min medium to filter low-confidence patterns.
```
