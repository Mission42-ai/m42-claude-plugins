# SPRINT.yaml Schema Reference

Complete schema specification for SPRINT.yaml definition files. SPRINT.yaml is what you write to define your sprint - the list of tasks to accomplish and which workflow to use.

## Quick Reference

```yaml
# Required fields
workflow: <string>     # Workflow reference (without .yaml)
collections: <object>  # Named collections of items (e.g., step, feature, bug)

# Optional fields
name: <string>         # Human-readable sprint name
sprint-id: <string>    # Unique identifier (auto-generated)
created: <string>      # ISO 8601 date
owner: <string>        # Sprint owner
config: <object>       # Configuration options
worktree: <object>     # Worktree isolation settings
```

## Examples

### Minimal Example

The simplest valid SPRINT.yaml requires only `workflow` and `collections`:

```yaml
workflow: sprint-default
collections:
  step:
    - prompt: Implement the feature
```

This creates a single-step sprint using the default workflow.

### Standard Example

A typical sprint with multiple steps:

```yaml
name: User Authentication
workflow: sprint-default

collections:
  step:
    - prompt: Create User model with email and password fields
    - prompt: Implement login endpoint with JWT tokens
    - prompt: Add authentication middleware
    - prompt: Create logout endpoint
    - prompt: Write integration tests
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

collections:
  step:
    # Object format with metadata
    - prompt: Design API schema and data models

    - prompt: Implement CRUD endpoints
      id: crud-endpoints

    # Object format with workflow override
    - prompt: Add input validation
      id: validation
      workflow: execute-step  # Override sprint workflow for this item

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
| `collections` | object | **Yes** | - | Named collections of items (e.g., `step`, `feature`, `bug`) |
| `name` | string | No | - | Human-readable sprint name for display |
| `sprint-id` | string | No | auto | Unique identifier (generated from directory name if absent) |
| `created` | string | No | - | ISO 8601 timestamp of sprint creation |
| `owner` | string | No | - | Sprint owner identifier |
| `model` | string | No | - | Default Claude model for all phases (`'sonnet'` \| `'opus'` \| `'haiku'`) |
| `config` | object | No | {} | Sprint configuration options |
| `worktree` | object | No | - | Worktree isolation configuration (see [Worktree Fields](#worktree-fields)) |

### Collections Schema

Collections are named groups of items. Each collection name is referenced by `for-each` phases in workflows.

```yaml
collections:
  step:                    # Collection name (referenced by for-each: step)
    - prompt: "..."        # Item with prompt
    - prompt: "..."
      id: custom-id        # Optional custom ID
      workflow: other-wf   # Optional per-item workflow override
  feature:                 # Another collection (referenced by for-each: feature)
    - prompt: "..."
      priority: high       # Custom properties available as {{item.priority}}
```

### Item Fields

Items within collections have these fields:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `prompt` | string | **Yes** | - | Item description and instructions |
| `id` | string | No | step-N | Unique item identifier (auto: step-0, step-1, etc.) |
| `workflow` | string | No | - | Per-item workflow override |
| `model` | string | No | - | Model override for this item (`'sonnet'` \| `'opus'` \| `'haiku'`) |
| `depends-on` | string[] | No | - | IDs of items that must complete before this item starts (for parallel execution) |
| `<custom>` | any | No | - | Custom properties accessible as `{{item.<custom>}}` |

### Config Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `max-tasks` | number | - | Maximum tasks before automatic pause |
| `time-box` | string | - | Time limit (e.g., "2h", "30m", "1h30m") |
| `auto-commit` | boolean | false | Automatically commit after each step |
| `max-iterations` | number|string | null | unlimited | Override max iterations (0, "unlimited", or specific number) |

### Worktree Fields

Configure dedicated git worktree for sprint isolation. Enables parallel sprint execution.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable dedicated worktree for this sprint |
| `branch` | string | `sprint/{sprint-id}` | Git branch name (supports template variables) |
| `path` | string | `../{sprint-id}-worktree` | Worktree directory path (supports template variables) |
| `cleanup` | string | `on-complete` | When to remove worktree: `never`, `on-complete`, `on-merge` |

#### Template Variables

Use these variables in `branch` and `path` fields:

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `{sprint-id}` | `2026-01-20_feature-auth` | Full sprint identifier |
| `{sprint-name}` | `feature-auth` | Sprint name (without date prefix) |
| `{date}` | `2026-01-20` | Sprint creation date |
| `{workflow}` | `ralph` | Workflow name |

#### Cleanup Modes

| Mode | Behavior |
|------|----------|
| `never` | Worktree persists indefinitely; manual cleanup required |
| `on-complete` | Remove when sprint status becomes `completed` |
| `on-merge` | Remove after sprint branch is merged to main/master |

## Item Format Variants

### Simple Item Format

Use simple format for straightforward items without metadata:

```yaml
collections:
  step:
    - prompt: Implement feature X
    - prompt: Add tests for feature X
    - prompt: Update documentation
```

### Object Format (With Metadata)

Use object format when you need:
- Custom item IDs
- Per-item workflow overrides
- Custom properties

```yaml
collections:
  step:
    - prompt: Implement feature X
      id: feature-x

    - prompt: Add tests for feature X
      id: feature-x-tests
      workflow: test-focused-workflow
```

### Mixed Collections

You can define multiple collection types in the same sprint:

```yaml
collections:
  feature:
    - prompt: User authentication
      priority: high
    - prompt: Dashboard UI
      priority: medium
  bug:
    - prompt: Fix login timeout
      severity: critical
    - prompt: Fix UI alignment
      severity: low
```

## Validation Rules

### Sprint-Level Validation

| Rule | Description |
|------|-------------|
| `workflow` required | Must be a non-empty string |
| `collections` required | Must have at least one collection with items |
| Valid YAML | File must parse as valid YAML |
| Unique `sprint-id` | If provided, must be unique across sprints |
| Valid `created` | If provided, must be ISO 8601 format |

### Collection-Level Validation

| Rule | Description |
|------|-------------|
| Non-empty | Each collection must have at least one item |
| Name matches | Collection names match `for-each` references in workflows |

### Item-Level Validation

| Rule | Description |
|------|-------------|
| `prompt` required | Items must have `prompt` field |
| Valid `id` format | Should be kebab-case (e.g., `my-step-id`) |
| Workflow exists | Referenced workflow must exist in `.claude/workflows/` |

### Reference Resolution

| Rule | Description |
|------|-------------|
| Workflow path | Resolves from `.claude/workflows/<name>.yaml` |
| No extension | Workflow references should NOT include `.yaml` |
| Item override | Per-item workflow takes precedence over sprint workflow |

## Common Patterns

### Feature Development Sprint

```yaml
name: Feature Implementation
workflow: gherkin-verified-execution

collections:
  step:
    - prompt: Research existing codebase and identify integration points
    - prompt: Design component architecture and interfaces
    - prompt: Implement core feature logic
    - prompt: Add comprehensive tests
    - prompt: Update documentation
```

### Bug Fix Sprint

```yaml
name: Bug Fix Sprint
workflow: bugfix-workflow

collections:
  step:
    - prompt: Reproduce and document the bug
    - prompt: Identify root cause through debugging
    - prompt: Implement fix with minimal changes
    - prompt: Add regression tests
    - prompt: Verify fix in staging environment
```

### Refactoring Sprint

```yaml
name: Code Refactoring
workflow: sprint-default

config:
  auto-commit: true

collections:
  step:
    - prompt: Analyze current code structure and identify issues
    - prompt: Create comprehensive test coverage for existing behavior
    - prompt: Refactor module A while maintaining tests green
    - prompt: Refactor module B while maintaining tests green
    - prompt: Update documentation and clean up unused code
```

### Multi-Workflow Sprint

Use per-item workflow overrides for different execution strategies:

```yaml
name: Mixed Workflow Sprint
workflow: sprint-default

collections:
  step:
    - prompt: Research best practices
      workflow: execute-step          # Simple, no verification needed

    - prompt: Implement core feature
      workflow: gherkin-verified-execution  # Full TDD cycle

    - prompt: Quick configuration update
      workflow: execute-step          # Simple change

    - prompt: Add integration tests
      workflow: gherkin-verified-execution  # Needs verification
```

### Model Selection Sprint

Use model overrides for different task complexities:

```yaml
name: Architecture and Implementation
workflow: sprint-default
model: sonnet                    # Default for most phases

collections:
  step:
    - prompt: Design system architecture and document key decisions
      model: opus                  # Use opus for complex reasoning

    - prompt: Implement the core module
      # Uses sonnet (sprint default)

    - prompt: Validate implementation with quick checks
      model: haiku                 # Use haiku for fast validation

    - prompt: Write comprehensive tests
      # Uses sonnet (sprint default)
```

Model selection follows precedence (highest to lowest):
1. Item-level `model` field
2. Workflow phase-level `model` field
3. Sprint-level `model` field
4. Workflow-level `model` field
5. CLI default (typically sonnet)

### Documentation Sprint

```yaml
name: Documentation Update
workflow: execute-step

collections:
  step:
    - prompt: Audit existing documentation for accuracy
    - prompt: Create missing API documentation
    - prompt: Add code examples and tutorials
    - prompt: Update README with new features
    - prompt: Add troubleshooting section
```

### Parallel Execution with Dependencies

Use `depends-on` to enable parallel execution of independent steps while maintaining order for dependent ones:

```yaml
name: Parallel Feature Development
workflow: sprint-default

collections:
  step:
    # Foundation step - no dependencies, runs first
    - prompt: Set up project structure and shared types
      id: foundation

    # These two can run in parallel (both depend only on foundation)
    - prompt: Implement user authentication module
      id: auth
      depends-on:
        - foundation

    - prompt: Implement database layer
      id: database
      depends-on:
        - foundation

    # This depends on both auth and database
    - prompt: Implement user API endpoints
      id: user-api
      depends-on:
        - auth
        - database

    # Final step depends on the API
    - prompt: Write integration tests
      id: tests
      depends-on:
        - user-api
```

The scheduler will:
1. Run `foundation` first
2. Run `auth` and `database` in parallel (both ready once foundation completes)
3. Run `user-api` after both `auth` and `database` complete
4. Run `tests` after `user-api` completes

### Worktree-Isolated Sprint

Run sprint in a dedicated git worktree for parallel development:

```yaml
name: User Authentication
workflow: ralph

worktree:
  enabled: true
  branch: feature/{sprint-name}
  path: ../features/{sprint-name}
  cleanup: on-complete

goal: |
  Implement user authentication with JWT tokens.
  Success: Login, logout, and token refresh working with tests.
```

When started with `/init-sprint auth --worktree`:
- Creates branch: `feature/auth`
- Creates worktree: `../features/auth`
- Sprint executes in worktree, isolated from main repo

### Minimal Worktree Example

Use defaults for quick worktree setup:

```yaml
name: Quick Feature
workflow: sprint-default

worktree:
  enabled: true
  # Uses defaults:
  # branch: sprint/2026-01-20_quick-feature
  # path: ../2026-01-20_quick-feature-worktree
  # cleanup: on-complete

collections:
  step:
    - prompt: Implement the feature
    - prompt: Add tests
```

## Invalid Examples

### Missing Required Fields

```yaml
# INVALID: Missing workflow
collections:
  step:
    - prompt: Do something
```

```yaml
# INVALID: Missing collections
workflow: sprint-default
```

```yaml
# INVALID: Empty collections
workflow: sprint-default
collections: {}
```

```yaml
# INVALID: Empty collection
workflow: sprint-default
collections:
  step: []
```

### Invalid Item Configuration

```yaml
# INVALID: Item missing prompt
workflow: sprint-default
collections:
  step:
    - id: my-step
      workflow: some-workflow
```

### Invalid References

```yaml
# INVALID: Workflow with .yaml extension
workflow: sprint-default.yaml  # Should be: sprint-default
collections:
  step:
    - prompt: Something
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
/** Valid Claude model identifiers */
type ClaudeModel = 'sonnet' | 'opus' | 'haiku';

interface SprintDefinition {
  workflow: string;
  collections: Record<string, CollectionItem[]>;
  'sprint-id'?: string;
  name?: string;
  created?: string;
  owner?: string;
  model?: ClaudeModel;
  config?: SprintConfig;
  worktree?: WorktreeConfig;
}

interface CollectionItem {
  prompt: string;
  workflow?: string;
  id?: string;
  model?: ClaudeModel;
  'depends-on'?: string[];  // Dependencies for parallel execution
  [key: string]: unknown;   // Custom properties
}

interface SprintConfig {
  'max-tasks'?: number;
  'time-box'?: string;
  'auto-commit'?: boolean;
}

// Worktree configuration for isolated parallel development
interface WorktreeConfig {
  enabled: boolean;
  branch?: string;   // Default: sprint/{sprint-id}
  path?: string;     // Default: ../{sprint-id}-worktree
  cleanup?: 'never' | 'on-complete' | 'on-merge';
}
```

**Source of Truth:** `compiler/src/types.ts`

## See Also

- [PROGRESS.yaml Schema](./progress-yaml-schema.md) - Generated execution state
- [Workflow YAML Schema](./workflow-yaml-schema.md) - Workflow definitions
- [Writing Sprints Guide](../guides/writing-sprints.md) - Best practices
- [Worktree Sprints Guide](../guides/worktree-sprints.md) - Parallel development with git worktrees
- [Commands Reference](./commands.md) - Sprint management commands
