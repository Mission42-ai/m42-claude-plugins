# SPRINT.yaml Schema Reference

Complete schema specification for SPRINT.yaml definition files. SPRINT.yaml is what you write to define your sprint - the list of tasks to accomplish and which workflow to use.

## Quick Reference

```yaml
# Required fields
workflow: <string>     # Workflow reference (without .yaml)
steps: <list>          # List of steps to execute

# Optional fields
name: <string>         # Human-readable sprint name
sprint-id: <string>    # Unique identifier (auto-generated)
created: <string>      # ISO 8601 date
owner: <string>        # Sprint owner
config: <object>       # Configuration options
```

## Examples

### Minimal Example

The simplest valid SPRINT.yaml requires only `workflow` and `steps`:

```yaml
workflow: sprint-default
steps:
  - Implement the feature
```

This creates a single-step sprint using the default workflow.

### Standard Example

A typical sprint with multiple steps:

```yaml
name: User Authentication
workflow: sprint-default

steps:
  - Create User model with email and password fields
  - Implement login endpoint with JWT tokens
  - Add authentication middleware
  - Create logout endpoint
  - Write integration tests
```

### Full Example (All Options)

Complete example demonstrating all available fields:

```yaml
name: API Development Sprint
workflow: gherkin-verified-execution
sprint-id: api-dev-2024-01
created: 2024-01-15T10:00:00Z
owner: dev-team

config:
  max-tasks: 50
  time-box: "4h"
  auto-commit: true

steps:
  # String format (simple)
  - Design API schema and data models

  # Object format with metadata
  - prompt: Implement CRUD endpoints
    id: crud-endpoints

  # Object format with workflow override
  - prompt: Add input validation
    id: validation
    workflow: execute-step  # Override sprint workflow for this step

  # Object format with different workflow
  - prompt: Write integration tests
    id: testing
    workflow: gherkin-verified-execution
```

## Field Reference

### Top-Level Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `workflow` | string | **Yes** | - | Workflow to use (resolves from `.claude/workflows/<name>.yaml`) |
| `steps` | list | **Yes** | - | Ordered list of step definitions |
| `name` | string | No | - | Human-readable sprint name for display |
| `sprint-id` | string | No | auto | Unique identifier (generated from directory name if absent) |
| `created` | string | No | - | ISO 8601 timestamp of sprint creation |
| `owner` | string | No | - | Sprint owner identifier |
| `config` | object | No | {} | Sprint configuration options |

### Step Fields

Steps can be either strings or objects. String steps are normalized to objects during compilation.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `prompt` | string | **Yes** | - | Step description and instructions |
| `id` | string | No | step-N | Unique step identifier (auto: step-0, step-1, etc.) |
| `workflow` | string | No | - | Per-step workflow override |

### Config Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `max-tasks` | number | - | Maximum tasks before automatic pause |
| `time-box` | string | - | Time limit (e.g., "2h", "30m", "1h30m") |
| `auto-commit` | boolean | false | Automatically commit after each step |
| `max-iterations` | number|string | null | unlimited | Override max iterations (0, "unlimited", or specific number) |

## Step Format Variants

### String Format (Simple)

Use string format for straightforward steps without metadata:

```yaml
steps:
  - Implement feature X
  - Add tests for feature X
  - Update documentation
```

**Normalization:** String steps become `{ prompt: "<string>" }` during compilation.

### Object Format (With Metadata)

Use object format when you need:
- Custom step IDs
- Per-step workflow overrides
- Future extensibility

```yaml
steps:
  - prompt: Implement feature X
    id: feature-x

  - prompt: Add tests for feature X
    id: feature-x-tests
    workflow: test-focused-workflow
```

### Mixed Format

You can mix string and object formats in the same sprint:

```yaml
steps:
  - Simple step as string
  - prompt: Complex step with metadata
    id: complex-step
    workflow: different-workflow
  - Another simple string step
```

## Validation Rules

### Sprint-Level Validation

| Rule | Description |
|------|-------------|
| `workflow` required | Must be a non-empty string |
| `steps` required | Must be a non-empty array |
| Valid YAML | File must parse as valid YAML |
| Unique `sprint-id` | If provided, must be unique across sprints |
| Valid `created` | If provided, must be ISO 8601 format |

### Step-Level Validation

| Rule | Description |
|------|-------------|
| `prompt` required | Object steps must have `prompt` field |
| Valid `id` format | Should be kebab-case (e.g., `my-step-id`) |
| Workflow exists | Referenced workflow must exist in `.claude/workflows/` |

### Reference Resolution

| Rule | Description |
|------|-------------|
| Workflow path | Resolves from `.claude/workflows/<name>.yaml` |
| No extension | Workflow references should NOT include `.yaml` |
| Step override | Per-step workflow takes precedence over sprint workflow |

## Common Patterns

### Feature Development Sprint

```yaml
name: Feature Implementation
workflow: gherkin-verified-execution

steps:
  - Research existing codebase and identify integration points
  - Design component architecture and interfaces
  - Implement core feature logic
  - Add comprehensive tests
  - Update documentation
```

### Bug Fix Sprint

```yaml
name: Bug Fix Sprint
workflow: bugfix-workflow

steps:
  - Reproduce and document the bug
  - Identify root cause through debugging
  - Implement fix with minimal changes
  - Add regression tests
  - Verify fix in staging environment
```

### Refactoring Sprint

```yaml
name: Code Refactoring
workflow: sprint-default

config:
  auto-commit: true

steps:
  - Analyze current code structure and identify issues
  - Create comprehensive test coverage for existing behavior
  - Refactor module A while maintaining tests green
  - Refactor module B while maintaining tests green
  - Update documentation and clean up unused code
```

### Multi-Workflow Sprint

Use per-step workflow overrides for different execution strategies:

```yaml
name: Mixed Workflow Sprint
workflow: sprint-default

steps:
  - prompt: Research best practices
    workflow: execute-step          # Simple, no verification needed

  - prompt: Implement core feature
    workflow: gherkin-verified-execution  # Full TDD cycle

  - prompt: Quick configuration update
    workflow: execute-step          # Simple change

  - prompt: Add integration tests
    workflow: gherkin-verified-execution  # Needs verification
```

### Documentation Sprint

```yaml
name: Documentation Update
workflow: execute-step

steps:
  - Audit existing documentation for accuracy
  - Create missing API documentation
  - Add code examples and tutorials
  - Update README with new features
  - Add troubleshooting section
```

## Invalid Examples

### Missing Required Fields

```yaml
# INVALID: Missing workflow
steps:
  - Do something
```

```yaml
# INVALID: Missing steps
workflow: sprint-default
```

```yaml
# INVALID: Empty steps array
workflow: sprint-default
steps: []
```

### Invalid Step Configuration

```yaml
# INVALID: Object step missing prompt
workflow: sprint-default
steps:
  - id: my-step
    workflow: some-workflow
```

### Invalid References

```yaml
# INVALID: Workflow with .yaml extension
workflow: sprint-default.yaml  # Should be: sprint-default
steps:
  - Something
```

## Directory Convention

Sprint files live in `.claude/sprints/` with this structure:

```
.claude/sprints/
├── 2024-01-15_auth-feature/
│   ├── SPRINT.yaml       # You write this
│   ├── PROGRESS.yaml     # Generated by compiler
│   ├── artifacts/        # Sprint artifacts
│   └── context/          # Context files
├── 2024-01-16_api-refactor/
│   └── ...
```

### Naming Patterns

| Pattern | Example | Use Case |
|---------|---------|----------|
| `YYYY-MM-DD_name` | `2024-01-15_auth-feature` | Date-prefixed (recommended) |
| `sprint-N_name` | `sprint-1_initial-setup` | Sequential numbering |
| `epic-name_story` | `auth_login-flow` | Epic/story grouping |

## TypeScript Interface

For developers building tools around SPRINT.yaml:

```typescript
interface SprintDefinition {
  workflow: string;
  steps: SprintStep[];
  'sprint-id'?: string;
  name?: string;
  created?: string;
  owner?: string;
  config?: SprintConfig;
}

interface SprintStep {
  prompt: string;
  workflow?: string;
  id?: string;
}

interface SprintConfig {
  'max-tasks'?: number;
  'time-box'?: string;
  'auto-commit'?: boolean;
}

// Raw input format (string steps normalized during parsing)
type RawStep = string | SprintStep;
```

**Source of Truth:** `compiler/src/types.ts`

## See Also

- [PROGRESS.yaml Schema](./progress-yaml-schema.md) - Generated execution state
- [Workflow YAML Schema](./workflow-yaml-schema.md) - Workflow definitions
- [Writing Sprints Guide](../guides/writing-sprints.md) - Best practices
- [Commands Reference](./commands.md) - Sprint management commands
