---
title: Workflow Definitions
description: Workflow YAML schema including phase types, template variables, and for-each expansion.
keywords: workflow, phases, for-each, template, variables, expansion
skill: orchestrating-sprints
---

# Workflow Definitions

## Workflow Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Workflow identifier |
| `description` | string | No | Human-readable summary |
| `phases` | list | Yes | Ordered phase definitions |

## Phase Types

### Simple Phase

Direct prompt execution within current context.

```yaml
- id: review
  prompt: "Review changes and verify quality"
```

### For-Each Phase

Iterates over steps, spawning workflow per step.

```yaml
- id: implement
  for-each: step
  workflow: step-default
```

## Phase Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique phase identifier |
| `prompt` | string | Conditional | Prompt text (for simple phases) |
| `for-each` | string | Conditional | Collection name to iterate (e.g., 'step', 'feature', 'bug') |
| `workflow` | string | Conditional | Workflow reference (for for-each phases) |
| `break` | boolean | No | Pause execution after phase for human review |
| `gate` | object | No | Quality gate check configuration |

**Conditional rules:**
- Simple phase: requires `prompt`
- For-each phase: requires `for-each` + `workflow`

## Breakpoints (`break: true`)

Phases with `break: true` pause sprint execution after completion, allowing human review:

```yaml
phases:
  - id: implement
    for-each: step
    workflow: feature-standard

  - id: review-checkpoint
    prompt: "Summarize changes for human review"
    break: true  # Sprint pauses here after completion
```

When a breakpoint is reached:
- Sprint status becomes `paused-at-breakpoint`
- Human can review artifacts and progress
- Use `/resume-sprint` to continue execution

## Quality Gates (`gate:`)

Quality gates run validation scripts after phase completion:

```yaml
phases:
  - id: implement
    prompt: "Implement the feature"
    gate:
      script: "npm test && npm run lint"
      on-fail:
        prompt: "Tests or linting failed. Fix the issues."
        max-retries: 3
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `gate.script` | string | - | Shell command returning 0 (pass) or non-0 (fail) |
| `gate.timeout` | number | 60 | Timeout in seconds |
| `gate.on-fail.prompt` | string | - | Instructions for fixing failures |
| `gate.on-fail.max-retries` | number | 3 | Maximum retry attempts |

Gate execution flow:
1. Phase completes
2. Gate script runs
3. If pass (exit 0): continue to next phase
4. If fail: run fix prompt, then retry gate (up to max-retries)
5. If max retries exceeded: sprint becomes `blocked`

## Template Variables

| Variable | Context | Value |
|----------|---------|-------|
| `{{step.prompt}}` | For-each phases | The prompt from SPRINT.yaml step |
| `{{step.id}}` | For-each phases | Step ID (e.g., step-1) |
| `{{step.index}}` | For-each phases | 0-based step index |
| `{{phase.id}}` | Any phase | Current phase ID |
| `{{sprint.id}}` | Any phase | Sprint identifier |

## Example Workflows

### sprint-default

Standard sprint workflow with planning, implementation, and review phases.

```yaml
name: sprint-default
description: Default sprint workflow with planning and review
phases:
  - id: planning
    prompt: "Analyze sprint goals and create implementation plan"

  - id: implement
    for-each: step
    workflow: step-default

  - id: review
    prompt: "Review all changes, run tests, verify sprint completion"
```

### feature-standard

Feature implementation workflow for step-level execution.

```yaml
name: feature-standard
description: Standard feature implementation workflow
phases:
  - id: context
    prompt: "Load context for {{step.id}}: {{step.prompt}}"

  - id: implement
    prompt: "Implement the feature following the step requirements"

  - id: verify
    prompt: "Run tests and verify implementation for {{step.id}}"

  - id: commit
    prompt: "Commit changes with descriptive message referencing {{step.id}}"
```
