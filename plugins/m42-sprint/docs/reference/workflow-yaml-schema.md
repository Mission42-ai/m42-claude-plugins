# Workflow YAML Schema Reference

Complete schema specification for workflow definition files. Workflows define the execution pattern for sprints - the sequence of phases that each step goes through.

## Quick Reference

```yaml
# Required fields
name: <string>           # Human-readable workflow name
phases: <list>           # Ordered list of phase definitions

# Optional fields
description: <string>    # Brief description of workflow purpose
```

## How Workflows Fit the Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       SPRINT.yaml                           │
│  workflow: my-workflow    ◀─── References workflow by name  │
│  steps:                                                     │
│    - Step A                                                 │
│    - Step B                                                 │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│               .claude/workflows/my-workflow.yaml            │
│  Defines HOW steps are processed (phases, iteration)        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     PROGRESS.yaml                           │
│  Expanded phases with steps iterated per for-each          │
└─────────────────────────────────────────────────────────────┘
```

## Examples

### Minimal Example

The simplest valid workflow requires only `name` and `phases`:

```yaml
name: Minimal
phases:
  - id: execute
    prompt: "Execute the task: {{step.prompt}}"
```

### Standard Example

A typical workflow with multiple phases:

```yaml
name: Plan Execute Verify
description: Implementation with deliberate planning and verification

phases:
  - id: plan
    prompt: |
      Analyze and plan:
      {{step.prompt}}

      Create implementation plan in context/{{step.id}}-plan.md

  - id: execute
    prompt: |
      Execute based on plan:
      1. Read context/{{step.id}}-plan.md
      2. Implement the solution
      3. Commit changes

  - id: verify
    prompt: |
      Verify implementation:
      1. Run related tests
      2. Check for regressions
      3. Validate against requirements
```

### Sprint-Level Workflow (With For-Each)

Workflow that iterates over all SPRINT.yaml steps:

```yaml
name: Standard Sprint
description: Full sprint lifecycle with step iteration

phases:
  - id: prepare
    prompt: |
      Initialize sprint environment:
      1. Create branch: sprint/{{sprint.id}}
      2. Set up project context
      3. Document setup in context/_shared.md

  - id: execute-all
    for-each: step
    workflow: implement-and-verify

  - id: finalize
    prompt: |
      Finalize sprint:
      1. Run full test suite
      2. Create PR with summary
      3. Clean up temporary files
```

### Full Example (All Options)

Complete example demonstrating all available fields:

```yaml
name: Gherkin Verified Execution
description: TDD workflow with Gherkin scenarios and verification

phases:
  # Simple phase - runs once at start
  - id: prepare
    prompt: |
      Sprint: {{sprint.id}}
      Initialize sprint environment and gather context.

  # For-each phase - runs for each step in SPRINT.yaml
  - id: development
    for-each: step
    workflow: gherkin-step  # References another workflow

  # Simple phase - runs once at end
  - id: qa
    prompt: |
      Quality assurance:
      - Run full test suite
      - Verify all Gherkin scenarios pass
      - Create final report
```

## Field Reference

### Top-Level Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | **Yes** | - | Human-readable workflow name |
| `phases` | list | **Yes** | - | Ordered list of phase definitions |
| `description` | string | No | - | Brief description of workflow purpose |

### Phase Types

Workflows support two types of phases:

| Type | Identifying Fields | Description |
|------|-------------------|-------------|
| **Simple Phase** | `id` + `prompt` | Executes once with a direct prompt |
| **For-Each Phase** | `id` + `for-each` + `workflow` | Iterates over steps, runs workflow per step |

### Simple Phase Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **Yes** | Unique phase identifier (kebab-case recommended) |
| `prompt` | string | **Yes** | Instructions for phase execution |

### For-Each Phase Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **Yes** | Unique phase identifier (kebab-case recommended) |
| `for-each` | `'step'` | **Yes** | Iteration mode (only `step` supported) |
| `workflow` | string | **Yes** | Workflow reference (without `.yaml` extension) |

## Phase Type Details

### Simple Phases

Simple phases execute once with a direct prompt. Use them for setup, teardown, or singleton operations.

```yaml
phases:
  - id: setup
    prompt: |
      Set up the development environment:
      1. Check prerequisites
      2. Initialize project
      3. Create branch: sprint/{{sprint.id}}

  - id: cleanup
    prompt: |
      Clean up after sprint completion:
      1. Remove temporary files
      2. Archive logs
```

**When to use:**
- Sprint initialization and finalization
- One-time operations
- Operations that don't depend on specific steps

### For-Each Phases

For-each phases iterate over all steps defined in SPRINT.yaml, running a nested workflow for each step.

```yaml
phases:
  - id: execute-all
    for-each: step        # Iterate over SPRINT.yaml steps
    workflow: feature-dev # Run this workflow for each step
```

**Expansion behavior:**

If SPRINT.yaml has 3 steps:
```yaml
steps:
  - Implement feature A
  - Implement feature B
  - Implement feature C
```

The for-each phase expands to:
```
execute-all/
├── step-0 → feature-dev workflow → sub-phases
├── step-1 → feature-dev workflow → sub-phases
└── step-2 → feature-dev workflow → sub-phases
```

**When to use:**
- Processing multiple items with the same workflow
- Development phases that apply to each task
- Any repeated operation across steps

## Template Variables

Workflow prompts support template variable substitution using `{{variable}}` syntax.

### Available Variables

| Variable | Availability | Description | Example |
|----------|--------------|-------------|---------|
| `{{step.prompt}}` | For-each phases, nested workflows | Step description from SPRINT.yaml | "Implement login" |
| `{{step.id}}` | For-each phases, nested workflows | Step identifier | "step-0" |
| `{{step.index}}` | For-each phases, nested workflows | 0-based step index | 0, 1, 2... |
| `{{phase.id}}` | All phases | Current phase identifier | "implement" |
| `{{phase.index}}` | All phases | 0-based phase index | 0, 1, 2... |
| `{{sprint.id}}` | All phases | Sprint identifier | "2024-01-15_feature" |
| `{{sprint.name}}` | All phases | Sprint name (optional) | "Feature Sprint" |

### Variable Availability Matrix

| Variable | Simple Phase | For-Each Phase | Nested Workflow |
|----------|--------------|----------------|-----------------|
| `{{step.*}}` | No | Yes | Yes |
| `{{phase.*}}` | Yes | Yes | Yes |
| `{{sprint.*}}` | Yes | Yes | Yes |

### Usage Examples

**File naming with step context:**
```yaml
prompt: |
  Save implementation plan to: context/{{step.id}}-plan.md
  Log to: logs/{{phase.id}}.log
```

**Git operations:**
```yaml
prompt: |
  git checkout -b sprint/{{sprint.id}}
  git commit -m "{{phase.id}}: {{step.prompt}}"
```

**Progress tracking:**
```yaml
prompt: |
  Processing step {{step.index}} ({{step.id}})
  Task: {{step.prompt}}
```

## Nested Workflows

For-each phases reference other workflows, enabling composition and reuse.

### How Nesting Works

```yaml
# sprint-workflow.yaml (top-level)
name: Sprint Workflow
phases:
  - id: develop
    for-each: step
    workflow: step-impl    # ← References step-impl.yaml

# step-impl.yaml (nested workflow)
name: Step Implementation
phases:
  - id: implement
    prompt: "Implement: {{step.prompt}}"   # Has access to step context
  - id: verify
    prompt: "Verify implementation"
```

### Resulting Structure in PROGRESS.yaml

```
phases:
├── develop (for-each phase)
│   └── steps:
│       ├── step-0
│       │   └── phases:    # From step-impl workflow
│       │       ├── implement
│       │       └── verify
│       ├── step-1
│       │   └── phases:
│       │       ├── implement
│       │       └── verify
```

### Multi-Level Nesting

Workflows can reference workflows that also contain for-each phases, but avoid deep nesting for maintainability.

```yaml
# Recommended: 2 levels max
sprint-workflow → step-workflow → (simple phases)

# Avoid: 3+ levels becomes hard to debug
sprint-workflow → step-workflow → task-workflow → ...
```

## Workflow Patterns

### Pattern 1: Minimal Execute

Single-phase workflow for straightforward tasks.

```yaml
name: Minimal Execute
description: Direct task execution
phases:
  - id: execute
    prompt: |
      Execute the following task:
      {{step.prompt}}
```

**Use when:** Tasks are self-contained, no planning or verification needed.

### Pattern 2: Plan-Execute

Two-phase workflow with deliberate planning.

```yaml
name: Plan Execute
description: Plan then implement
phases:
  - id: plan
    prompt: |
      Analyze and plan: {{step.prompt}}
      Create plan in context/{{step.id}}-plan.md

  - id: execute
    prompt: |
      Execute based on plan:
      1. Read context/{{step.id}}-plan.md
      2. Implement the solution
      3. Commit changes
```

**Use when:** Tasks benefit from upfront analysis, spans multiple files.

### Pattern 3: Plan-Execute-Verify

Three-phase workflow with verification.

```yaml
name: Plan Execute Verify
description: Implementation with testing
phases:
  - id: plan
    prompt: |
      Plan implementation for: {{step.prompt}}
      Output: context/{{step.id}}-plan.md

  - id: execute
    prompt: |
      Implement following context/{{step.id}}-plan.md
      Commit logical units separately.

  - id: verify
    prompt: |
      Verify implementation:
      1. Run related tests
      2. Check for regressions
      3. Validate against requirements
```

**Use when:** Quality assurance is important, automated tests exist.

### Pattern 4: Full Sprint

Top-level sprint workflow with for-each development.

```yaml
name: Full Sprint
description: Complete sprint with step iteration
phases:
  - id: prepare
    prompt: |
      Initialize sprint:
      1. Create branch: sprint/{{sprint.id}}
      2. Gather initial context

  - id: development
    for-each: step
    workflow: plan-execute-verify

  - id: qa
    prompt: |
      Sprint quality assurance:
      1. Run full test suite
      2. Security audit
      3. Review all changes

  - id: deploy
    prompt: |
      Finalize sprint:
      1. Push all changes
      2. Create PR: gh pr create
```

**Use when:** Running full development sprints with multiple steps.

### Pattern 5: Bug Fix

Focused workflow for diagnosing and fixing bugs.

```yaml
name: Bug Fix
description: Diagnose, fix, verify
phases:
  - id: diagnose
    prompt: |
      ## Bug
      {{step.prompt}}

      1. Reproduce the bug
      2. Analyze logs and errors
      3. Identify root cause
      Output: context/{{step.id}}-diagnosis.md

  - id: fix
    prompt: |
      Fix based on context/{{step.id}}-diagnosis.md
      - Minimal change required
      - No scope creep

  - id: verify
    prompt: |
      Verify fix:
      1. Confirm bug is resolved
      2. Run regression tests
```

**Use when:** Fixing reported bugs, root cause analysis required.

### Pattern Selection Guide

```
How complex is the task?
│
├─ Very simple (single action)
│  └─ Pattern 1: Minimal Execute
│
├─ Needs planning
│  │
│  ├─ No verification needed
│  │  └─ Pattern 2: Plan-Execute
│  │
│  └─ Needs verification
│     └─ Pattern 3: Plan-Execute-Verify
│
├─ Multiple steps (sprint)
│  └─ Pattern 4: Full Sprint
│
└─ Bug fix
   └─ Pattern 5: Bug Fix
```

## Validation Rules

### Workflow-Level Validation

| Rule | Description |
|------|-------------|
| `name` required | Must be non-empty string |
| `phases` required | Must be non-empty array |
| Valid YAML | File must parse as valid YAML |
| Unique phase IDs | Each phase `id` must be unique within workflow |

### Phase-Level Validation

| Rule | Description |
|------|-------------|
| `id` required | All phases must have an `id` field |
| ID format | Should be kebab-case (lowercase, hyphens) |
| Simple phase | Must have `prompt`, must NOT have `for-each` or `workflow` |
| For-each phase | Must have `for-each` and `workflow`, must NOT have `prompt` |

### Reference Resolution

| Rule | Description |
|------|-------------|
| Workflow path | Resolves from `.claude/workflows/<name>.yaml` |
| No extension | References should NOT include `.yaml` |
| Circular prevention | Circular workflow references are invalid |

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

### Invalid References

```yaml
# INVALID: Workflow with .yaml extension
phases:
  - id: dev
    for-each: step
    workflow: my-workflow.yaml  # Should be: my-workflow
```

## File Location and Naming

Workflow files live in `.claude/workflows/`:

```
.claude/
└── workflows/
    ├── sprint-default.yaml     # Default sprint workflow
    ├── execute-step.yaml       # Simple step execution
    ├── plan-execute.yaml       # Two-phase planning
    ├── gherkin-verified.yaml   # TDD with Gherkin
    └── bugfix-workflow.yaml    # Bug fix pattern
```

### Naming Conventions

| Pattern | Example | Description |
|---------|---------|-------------|
| `<purpose>-<type>.yaml` | `feature-standard.yaml` | Purpose-based naming |
| `<type>-<variant>.yaml` | `sprint-default.yaml` | Type with variant |
| `<action>-workflow.yaml` | `bugfix-workflow.yaml` | Action-focused |

## TypeScript Interface

For developers building tools around workflow files:

```typescript
interface WorkflowDefinition {
  name: string;
  description?: string;
  phases: WorkflowPhase[];
}

type WorkflowPhase = SimplePhase | ForEachPhase;

interface SimplePhase {
  id: string;
  prompt: string;
}

interface ForEachPhase {
  id: string;
  'for-each': 'step';
  workflow: string;
}
```

**Source of Truth:** `compiler/src/types.ts`

## See Also

- [SPRINT.yaml Schema](./sprint-yaml-schema.md) - Input sprint definition
- [PROGRESS.yaml Schema](./progress-yaml-schema.md) - Generated execution state
- [Commands Reference](./commands.md) - Sprint management commands
- [Writing Workflows Guide](../guides/writing-workflows.md) - Best practices
- [Workflow Compilation](../concepts/workflow-compilation.md) - How workflows are processed
