---
title: Workflow Schema Reference
description: Complete YAML schema for workflow definitions including all fields, types, and validation rules.
keywords: workflow, schema, yaml, phases, validation, types
skill: creating-workflows
---

# Workflow Schema Reference

## File Structure

Workflow files are YAML documents stored in `.claude/workflows/`.

```yaml
# .claude/workflows/<workflow-name>.yaml
name: <string>           # Required
description: <string>    # Optional
phases: <list>           # Required
```

## Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable workflow name |
| `description` | string | No | Brief description of workflow purpose |
| `phases` | list[Phase] | Yes | Ordered list of phase definitions |

## Phase Schema

### Simple Phase

```yaml
- id: <string>           # Required - unique identifier
  prompt: <string>       # Required - execution instructions
```

### For-Each Phase

```yaml
- id: <string>           # Required - unique identifier
  for-each: step         # Required - iteration mode (only "step" supported)
  workflow: <string>     # Required - workflow reference for each iteration
```

## Phase Fields Reference

| Field | Type | Required | Context | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | All phases | Unique phase identifier (kebab-case recommended) |
| `prompt` | string | Conditional | Simple phases | Instructions for phase execution |
| `for-each` | `'step'` | Conditional | For-each phases | Iteration mode |
| `workflow` | string | Conditional | For-each phases | Workflow reference (no `.yaml` extension) |
| `parallel` | boolean | No | Step workflow phases | Run in background, don't block next step |
| `wait-for-parallel` | boolean | No | Top-level phases | Wait for all parallel tasks before continuing |

## Conditional Requirements

| Phase Type | Required Fields | Description |
|------------|-----------------|-------------|
| Simple | `id` + `prompt` | Direct prompt execution |
| For-Each | `id` + `for-each` + `workflow` | Iterates over steps, runs workflow per step |

## TypeScript Interface

```typescript
interface WorkflowDefinition {
  name: string;
  description?: string;
  phases: WorkflowPhase[];
}

interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: 'step';
  workflow?: string;
  parallel?: boolean;
  'wait-for-parallel'?: boolean;
}
```

## Validation Rules

### Workflow Level

1. `name` must be non-empty string
2. `phases` must be non-empty array
3. File must be valid YAML

### Phase Level

1. Each phase must have unique `id`
2. Phase `id` should be kebab-case (lowercase, hyphens)
3. Simple phase: `prompt` is required, `for-each` and `workflow` must be absent
4. For-each phase: `for-each` and `workflow` are required, `prompt` must be absent

### Reference Resolution

1. Workflow references resolve from `.claude/workflows/<name>.yaml`
2. References should not include `.yaml` extension
3. Circular workflow references are invalid

### Parallel Execution

1. `parallel` must be boolean if present
2. `wait-for-parallel` must be boolean if present
3. `parallel: true` only works in step workflows (not on for-each phases)
4. `wait-for-parallel: true` only makes sense on top-level simple phases

## Valid Examples

### Minimal Workflow

```yaml
name: Minimal
phases:
  - id: execute
    prompt: "Execute the task"
```

### Sprint Workflow

```yaml
name: Standard Sprint
description: Full sprint lifecycle
phases:
  - id: prepare
    prompt: "Initialize sprint environment"

  - id: development
    for-each: step
    workflow: feature-standard

  - id: qa
    prompt: "Run quality checks"
```

### Nested Workflows

```yaml
# sprint-workflow.yaml
name: Sprint with QA
phases:
  - id: develop
    for-each: step
    workflow: step-with-qa

# step-with-qa.yaml (referenced workflow)
name: Step with QA
phases:
  - id: implement
    prompt: "Implement: {{step.prompt}}"
  - id: test
    prompt: "Test implementation"
```

### Parallel Execution

Use `parallel: true` on step workflow phases to run them in background without blocking the next step. Use `wait-for-parallel: true` on top-level phases to create sync points.

```yaml
# sprint-workflow.yaml - Sprint with sync point
name: Sprint with Parallel Docs
description: Development with non-blocking documentation updates
phases:
  - id: development
    for-each: step
    workflow: feature-with-docs

  - id: sync
    prompt: "Verify all documentation updates completed..."
    wait-for-parallel: true

  - id: qa
    prompt: "Run final QA checks..."
```

```yaml
# feature-with-docs.yaml - Step workflow with parallel sub-phase
name: Feature with Docs
phases:
  - id: plan
    prompt: "Plan implementation for: {{step.prompt}}"

  - id: implement
    prompt: "Implement: {{step.prompt}}"

  - id: test
    prompt: "Test the implementation..."

  - id: update-docs
    prompt: "Update documentation for {{step.prompt}}..."
    parallel: true
```

## Invalid Examples

### Missing Required Fields

```yaml
# INVALID: Missing name
phases:
  - id: task
    prompt: "Do something"
```

```yaml
# INVALID: Empty phases
name: Empty Workflow
phases: []
```

### Invalid Phase Configuration

```yaml
# INVALID: Simple phase missing prompt
phases:
  - id: task
```

```yaml
# INVALID: For-each phase missing workflow
phases:
  - id: development
    for-each: step
```

```yaml
# INVALID: Mixed phase types (both prompt and for-each)
phases:
  - id: hybrid
    prompt: "Do something"
    for-each: step
    workflow: some-workflow
```

## File Naming Convention

| Pattern | Example | Description |
|---------|---------|-------------|
| `<purpose>-<type>.yaml` | `feature-standard.yaml` | Purpose-based naming |
| `<type>-<variant>.yaml` | `sprint-default.yaml` | Type with variant |
| `<action>-workflow.yaml` | `bugfix-workflow.yaml` | Action-focused |

## Schema Evolution

Current schema version supports:
- Simple phases with prompts
- For-each phases iterating over steps
- Template variable substitution
- Parallel execution with `parallel` and `wait-for-parallel`

Future versions may add:
- Conditional phases
- Phase dependencies
