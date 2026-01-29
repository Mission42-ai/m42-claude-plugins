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
schema-version: "2.0"    # Recommended - schema version for compatibility
name: <string>           # Required
description: <string>    # Optional
phases: <list>           # Required
```

## Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema-version` | string | Recommended | Schema version for compatibility tracking (current: "2.0") |
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
  for-each: <string>     # Required - collection name (e.g., "step", "feature", "bug")
  workflow: <string>     # Required - workflow reference for each iteration
```

## Phase Fields Reference

| Field | Type | Required | Context | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | All phases | Unique phase identifier (kebab-case recommended) |
| `prompt` | string | Conditional | Simple phases | Instructions for phase execution |
| `for-each` | string | Conditional | For-each phases | Collection name to iterate (e.g., "step", "feature") |
| `workflow` | string | Conditional | For-each phases | Workflow reference (no `.yaml` extension) |
| `parallel` | boolean | No | Item workflow phases | Run in background, don't block next item |
| `wait-for-parallel` | boolean | No | Top-level phases | Wait for all parallel tasks before continuing |
| `break` | boolean | No | All phases | Pause execution after phase completes for human review |
| `gate` | GateCheck | No | All phases | Quality gate check to run after phase completion |

## Conditional Requirements

| Phase Type | Required Fields | Description |
|------------|-----------------|-------------|
| Simple | `id` + `prompt` | Direct prompt execution |
| For-Each | `id` + `for-each` + `workflow` | Iterates over collection items, runs workflow per item |

## TypeScript Interface

```typescript
interface WorkflowDefinition {
  name: string;
  description?: string;
  'schema-version'?: string;  // Recommended for compatibility tracking
  phases: WorkflowPhase[];
}

interface WorkflowPhase {
  id: string;
  prompt?: string;
  'for-each'?: string;  // Collection name (e.g., "step", "feature", "bug")
  workflow?: string;
  parallel?: boolean;
  'wait-for-parallel'?: boolean;
  break?: boolean;      // Pause for human review after completion
  gate?: GateCheck;     // Quality gate check
}

interface GateCheck {
  script: string;       // Shell command returning 0 (pass) or non-0 (fail)
  'on-fail': {
    prompt: string;     // Instructions for fixing the failure
    'max-retries'?: number;  // Default: 3
  };
  timeout?: number;     // Timeout in seconds (default: 60)
}
```

## Validation Rules

### Workflow Level

1. `name` must be non-empty string
2. `phases` must be non-empty array
3. File must be valid YAML
4. `schema-version` should be present (warning if missing)
5. `schema-version` should match current version "2.0" (warning if outdated)

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
3. `parallel: true` only works in item workflows (not on for-each phases)
4. `wait-for-parallel: true` only makes sense on top-level simple phases

## Valid Examples

### Minimal Workflow

```yaml
schema-version: "2.0"
name: Minimal
phases:
  - id: execute
    prompt: "Execute the task"
```

### Sprint Workflow

```yaml
schema-version: "2.0"
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
schema-version: "2.0"
name: Sprint with QA
phases:
  - id: develop
    for-each: step
    workflow: step-with-qa

# step-with-qa.yaml (referenced workflow)
schema-version: "2.0"
name: Step with QA
phases:
  - id: implement
    prompt: "Implement: {{item.prompt}}"
  - id: test
    prompt: "Test implementation"
```

### Parallel Execution

Use `parallel: true` on item workflow phases to run them in background without blocking the next item. Use `wait-for-parallel: true` on top-level phases to create sync points.

```yaml
# sprint-workflow.yaml - Sprint with sync point
schema-version: "2.0"
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
# feature-with-docs.yaml - Item workflow with parallel sub-phase
schema-version: "2.0"
name: Feature with Docs
phases:
  - id: plan
    prompt: "Plan implementation for: {{item.prompt}}"

  - id: implement
    prompt: "Implement: {{item.prompt}}"

  - id: test
    prompt: "Test the implementation..."

  - id: update-docs
    prompt: "Update documentation for {{item.prompt}}..."
    parallel: true
```

### Quality Gates

Use `gate` to run validation scripts after phase completion, with automatic retry on failure:

```yaml
schema-version: "2.0"
name: Workflow with Gate Checks
phases:
  - id: implement
    prompt: "Implement: {{item.prompt}}"

  - id: verify-build
    prompt: "Verify implementation meets requirements..."
    gate:
      script: "npm run build && npm run typecheck"
      on-fail:
        prompt: |
          The build or type check failed. Fix the issues:

          ## Error Output
          {{gate.output}}

          ## Instructions
          1. Analyze the error messages
          2. Fix the issues in the code
          3. The gate will re-run automatically
        max-retries: 3
      timeout: 120
```

**Gate Check Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `script` | string | Yes | Shell command that returns 0 on success |
| `on-fail.prompt` | string | Yes | Instructions for fixing failures ({{gate.output}} available) |
| `on-fail.max-retries` | number | No | Maximum retry attempts (default: 3) |
| `timeout` | number | No | Script timeout in seconds (default: 60) |

**Gate Status Flow:**
1. Phase completes → gate script runs
2. Script returns 0 → gate passes → continue to next phase
3. Script returns non-0 → `on-fail.prompt` executed → retry
4. After max retries exhausted → sprint status becomes `blocked`

### Breakpoints

Use `break: true` to pause execution after a phase completes for human review:

```yaml
schema-version: "2.0"
name: Workflow with Breakpoint
phases:
  - id: implement
    prompt: "Implement the feature..."

  - id: review-checkpoint
    prompt: "Prepare changes for human review..."
    break: true  # Sprint pauses here with status: paused-at-breakpoint

  - id: deploy
    prompt: "Deploy to production..."  # Only runs after human resumes
```

When a breakpoint is reached:
- Sprint status changes to `paused-at-breakpoint`
- The `breakpointPhaseId` field indicates which phase triggered the pause
- Use `/resume-sprint` to continue execution

**Use Cases:**
- Human approval before deployment
- Manual verification of critical changes
- Checkpoint before irreversible operations

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

---

## Ralph Mode Workflow

When creating a Ralph mode workflow, use `mode: ralph` instead of defining `phases`. Ralph mode enables autonomous goal-driven execution.

### Ralph Mode Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | `'standard' \| 'ralph'` | No | Workflow mode (default: `standard`) |
| `goal-prompt` | string | Conditional | Prompt template for initial goal analysis (Ralph mode only) |
| `reflection-prompt` | string | Conditional | Prompt template for reflection when no pending steps (Ralph mode only) |
| `per-iteration-hooks` | list[PerIterationHook] | No | Hooks to run each iteration |

### Per-Iteration Hook Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique hook identifier |
| `workflow` | string | Conditional | Workflow reference (e.g., `"m42-signs:learning-extraction"`) |
| `prompt` | string | Conditional | Inline prompt (alternative to `workflow`) |
| `parallel` | boolean | Yes | If `true`, runs non-blocking in background |
| `enabled` | boolean | Yes | Default enabled state (can be overridden in SPRINT.yaml) |

**Note:** Either `workflow` or `prompt` is required, but not both.

### TypeScript Interface (Ralph Mode Extensions)

```typescript
interface WorkflowDefinition {
  name: string;
  description?: string;
  'schema-version'?: string;          // Recommended for compatibility tracking
  phases?: WorkflowPhase[];           // Optional for Ralph mode
  mode?: 'standard' | 'ralph';
  'goal-prompt'?: string;
  'reflection-prompt'?: string;
  'per-iteration-hooks'?: PerIterationHook[];
}

interface PerIterationHook {
  id: string;
  workflow?: string;
  prompt?: string;
  parallel: boolean;
  enabled: boolean;
}
```

### Ralph Mode Workflow Example

```yaml
schema-version: "2.0"
name: Ralph Mode Workflow
description: Autonomous goal-driven execution with configurable per-iteration hooks
mode: ralph

goal-prompt: |
  Analyze the goal and create initial implementation steps.
  Break down complex goals into concrete, actionable tasks.

reflection-prompt: |
  No pending steps remain. Evaluate:
  1. Is the goal fully achieved?
  2. Are there edge cases or tests missing?
  3. Is documentation complete?

  If complete: RALPH_COMPLETE: [summary]
  If not: add more steps

per-iteration-hooks:
  - id: learning
    workflow: "m42-signs:learning-extraction"
    parallel: true
    enabled: false

  - id: documentation
    prompt: |
      Review changes from this iteration and update relevant documentation.
    parallel: true
    enabled: false

  - id: tests
    prompt: |
      Analyze code changes and suggest additional test cases.
    parallel: true
    enabled: false
```

### SPRINT.yaml for Ralph Mode

```yaml
workflow: ralph
goal: |
  Build authentication system with JWT tokens

# Override hook defaults
per-iteration-hooks:
  learning:
    enabled: true
  documentation:
    enabled: true
```

### Validation Rules (Ralph Mode)

1. If `mode: ralph`, `phases` should be absent or empty
2. If `mode: ralph`, `goal-prompt` and `reflection-prompt` are recommended
3. Per-iteration hooks must have unique `id` values
4. Each hook must have either `workflow` or `prompt`, not both
5. Hook `parallel` and `enabled` fields are required

### Runtime Hook Execution

Per-iteration hooks are executed by the TypeScript runtime (`loop.ts`) with the following behavior:

1. **Execution Timing**: Hooks execute after each successful phase completion (PHASE_COMPLETE event)
2. **Template Variables**: Hook prompts support variable substitution:
   - `$ITERATION_TRANSCRIPT` → path to current iteration's transcript file
   - `$SPRINT_ID` → sprint identifier from PROGRESS.yaml
   - `$ITERATION` → current iteration number (1-based)
   - `$PHASE_ID` → current phase/step/sub-phase identifier
3. **Parallel Execution**: Hooks with `parallel: true` spawn in background without blocking the next iteration
4. **Sequential Execution**: Hooks with `parallel: false` block until completion
5. **Hook Task Tracking**: Each hook execution is recorded in `hook-tasks[]` with:
   - `iteration`: which iteration spawned the hook
   - `hook-id`: reference to the hook configuration
   - `status`: `running`, `completed`, or `failed`
   - `spawned-at`, `completed-at`: timestamps
   - `transcript`: path to hook's output file
   - `exit-code`: process exit code
6. **Failure Handling**: Hook failures are tracked but don't crash the sprint

---

## Schema Evolution

Current schema version supports:
- Simple phases with prompts
- For-each phases iterating over named collections
- Template variable substitution (`{{item.*}}`, `{{<type>.*}}`)
- Parallel execution with `parallel` and `wait-for-parallel`
- Quality gates with `gate`, `on-fail`, and `max-retries` configuration
- Breakpoints with `break: true` for human review pause points
- Status `paused-at-breakpoint` for breakpoint-triggered pauses
- Ralph mode with autonomous goal-driven execution
- Per-iteration hooks for deterministic parallel tasks

Future versions may add:
- Conditional phases
- Phase dependencies
