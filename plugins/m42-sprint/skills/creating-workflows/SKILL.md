---
name: creating-workflows
description: Guide for creating sprint workflow definitions. This skill should be used when users want to create a new workflow, modify existing workflows, understand workflow schema, or define phase sequences. Triggers on "create workflow", "new workflow", "workflow definition", "define phases".
---

# Creating Workflows

Guide for authoring sprint workflow definitions in `.claude/workflows/`.

## Before You Start

For complete reference, read these files:
1. **Schema**: `references/workflow-schema.md` - Full field definitions
2. **Examples**: `.claude/workflows/` - Working workflow files

The Quick Reference below covers common cases. For edge cases, consult the schema.

## Quick Reference (Cheat Sheet)

### Workflow Structure
```yaml
name: <string>           # Required
description: <string>    # Optional
phases:                  # Required - list of phases
  - id: <string>         # Required, unique identifier
    prompt: <string>     # For simple phases (direct execution)
    # OR
    for-each: <string>   # Collection name to iterate
    workflow: <string>   # Workflow to run per item
```

### Phase Types
| Type | Required Fields | Use Case |
|------|-----------------|----------|
| Simple | `id`, `prompt` | Direct execution of instructions |
| For-Each | `id`, `for-each`, `workflow` | Iterate over collection items |

### Template Variables
| Variable | Description |
|----------|-------------|
| `{{item.prompt}}` | Current item's prompt |
| `{{item.id}}` | Current item's ID |
| `{{sprint.id}}` | Sprint identifier |
| `{{sprint.name}}` | Sprint name |

### Optional Phase Fields
| Field | Type | Description |
|-------|------|-------------|
| `parallel` | boolean | Run in background (item workflows only) |
| `wait-for-parallel` | boolean | Sync point for parallel tasks |
| `break` | boolean | Pause for human review after completion |
| `gate` | object | Quality gate script + on-fail handling |

## Current Workflow Patterns

### sprint-default.yaml
**Phases**: prepare → development (for-each) → qa → deploy
**Use for**: Standard sprint execution with QA gates

### plugin-development.yaml
**Phases**: preflight → development (TDD) → docs → tooling → version → qa → summary → pr
**Use for**: Plugin development with TDD and documentation

### feature-standard.yaml
**Phases**: planning → implement → test → document
**Use for**: Single feature implementation

### bugfix-workflow.yaml
**Phases**: diagnose → fix → verify
**Use for**: Bug investigation and fixing

### ralph mode
**Type**: Goal-driven autonomous mode
**Use for**: Complex, research-heavy, open-ended goals
**Note**: Uses `mode: ralph` instead of predefined phases

## What is a Workflow?

| Concept | Description |
|---------|-------------|
| Workflow | YAML file defining execution phases |
| Phase | Individual step with prompt or iteration |
| For-Each | Phase that iterates over collection items |
| Template Variables | Dynamic values substituted at runtime |
| Quality Gate | Validation script with retry-on-fail capability |
| Breakpoint | Pause point for human review before continuing |
| Ralph Mode | Autonomous goal-driven workflow (no predefined phases) |

## Workflow Location

```text
.claude/workflows/
├── sprint-default.yaml     # Top-level sprint workflow
├── feature-standard.yaml   # Step-level implementation workflow
├── bugfix-workflow.yaml    # Quick bug fix workflow
└── custom-workflow.yaml    # Your custom workflows
```

## Quick Start

### 1. Create Workflow File

```yaml
# .claude/workflows/my-workflow.yaml
name: My Custom Workflow
description: Brief description of workflow purpose

phases:
  - id: first-phase
    prompt: |
      Instructions for first phase.
      {{item.prompt}}

  - id: second-phase
    prompt: |
      Instructions for second phase.
```

### 2. Reference in SPRINT.yaml

```yaml
workflow: my-workflow
collections:
  step:
    - prompt: Implement feature X
    - prompt: Add tests for feature X
```

## Phase Types Decision Tree

```text
Do you need to process multiple collection items?
├── YES → Use for-each phase
│         └── for-each: step    # or: feature, bug, etc.
│             workflow: step-workflow
│
└── NO → Use simple phase
         └── prompt: "Instructions here"
```

## Workflow Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| Simple Sequential | Linear task flow | `prepare → execute → verify` |
| For-Each Development | Item iteration | `development` phase with `for-each: step` |
| Nested Workflow | Complex step execution | For-each phase referencing step workflow |
| Hybrid | Mixed phases | Simple + for-each combined |
| Ralph Mode | Autonomous goal-driven | `mode: ralph` with dynamic steps |

## Template Variables

| Variable | Available In | Value |
|----------|--------------|-------|
| `{{item.prompt}}` | For-each phases | Item description from collection |
| `{{item.id}}` | For-each phases | Item identifier (e.g., step-0) |
| `{{item.index}}` | For-each phases | 0-based item index |
| `{{item.<prop>}}` | For-each phases | Any custom property from the item |
| `{{<type>.prompt}}` | For-each phases | Type-specific alias (e.g., `{{step.prompt}}` when `for-each: step`) |
| `{{phase.id}}` | All phases | Current phase identifier |
| `{{sprint.id}}` | All phases | Sprint identifier |
| `{{sprint.name}}` | All phases | Sprint name (if set) |

## Example Workflows

### Minimal Workflow

```yaml
name: Minimal Execute
phases:
  - id: execute
    prompt: "Execute the task: {{item.prompt}}"
```

### Sprint Workflow with For-Each

```yaml
name: Standard Sprint
phases:
  - id: prepare
    prompt: "Prepare sprint environment"

  - id: development
    for-each: step
    workflow: feature-standard

  - id: qa
    prompt: "Run tests and quality checks"

  - id: deploy
    prompt: "Create PR and finalize"
```

## Quality Gates and Breakpoints

### Quality Gate

Run validation scripts after phase completion with automatic retry:

```yaml
phases:
  - id: implement
    prompt: "Implement the feature..."
    gate:
      script: "npm run build && npm test"
      on-fail:
        prompt: "Fix build/test failures: {{gate.output}}"
        max-retries: 3
      timeout: 120
```

### Breakpoint

Pause for human review after phase completes:

```yaml
phases:
  - id: prepare-release
    prompt: "Prepare release artifacts..."
    break: true  # Sprint pauses with status: paused-at-breakpoint

  - id: deploy
    prompt: "Deploy to production..."  # Runs after /resume-sprint
```

See `references/workflow-schema.md` for full gate and breakpoint documentation.

## Ralph Mode Workflows

Ralph Mode enables autonomous goal-driven execution where Claude creates steps dynamically instead of following predefined phases.

### Ralph Mode Structure

```yaml
name: My Ralph Workflow
mode: ralph

goal-prompt: |
  Analyze goal and create steps...

reflection-prompt: |
  Evaluate if goal is complete...

per-iteration-hooks:
  - id: learning
    workflow: "m42-signs:learning-extraction"
    parallel: true
    enabled: false
```

### Per-Iteration Hooks

Hooks are deterministic tasks that run every iteration:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique hook identifier |
| `workflow` | string | External workflow/plugin reference |
| `prompt` | string | Inline prompt (alternative to workflow) |
| `parallel` | boolean | Run non-blocking in background |
| `enabled` | boolean | Default enabled state |

See `references/workflow-schema.md` for full Ralph Mode schema.

## References

- `references/workflow-schema.md` - Complete YAML schema (includes Ralph Mode)
- `references/template-variables.md` - All available variables
- `references/phase-types.md` - Simple vs for-each phases
- `references/workflow-patterns.md` - Common patterns

## Assets

- `assets/feature-workflow.yaml` - Feature implementation template
- `assets/bugfix-workflow.yaml` - Bug fix template
- `assets/validation-checklist.md` - Pre-deployment checklist

## Validation

Before using a workflow:

1. Check YAML syntax is valid
2. Verify all phase IDs are unique
3. Ensure for-each phases have `workflow` reference
4. Confirm referenced workflows exist in `.claude/workflows/`
5. Test template variables resolve correctly

## Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| Workflow not found | Missing file | Create in `.claude/workflows/` |
| Phase skipped | Missing `prompt` or `for-each` | Add required field |
| Variable not resolved | Wrong context | Check variable availability (item.* only in for-each) |
| Compilation error | Invalid YAML | Validate YAML syntax |

## Related

- **orchestrating-sprints** - Running and managing sprints
- **creating-sprints** - Creating SPRINT.yaml definitions
