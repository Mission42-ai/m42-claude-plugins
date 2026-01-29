---
title: Sprint Schema Reference
description: Complete YAML schema for SPRINT.yaml definitions including all fields, types, and validation rules.
keywords: sprint, schema, yaml, steps, validation, types, SPRINT.yaml
skill: creating-sprints
---

# Sprint Schema Reference

## File Structure

Sprint files are YAML documents stored in sprint directories.

```yaml
# .claude/sprints/<sprint-dir>/SPRINT.yaml
name: <string>           # Optional
workflow: <string>       # Required
collections: <object>    # Required - named collections of items
sprint-id: <string>      # Optional (auto-generated)
created: <string>        # Optional (ISO date)
owner: <string>          # Optional
config: <object>         # Optional
```

## Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Human-readable sprint name |
| `workflow` | string | Yes | Workflow reference (without .yaml extension) |
| `collections` | object | Yes | Named collections of items (e.g., step, feature, bug) |
| `sprint-id` | string | No | Unique identifier (auto-generated if absent) |
| `created` | string | No | ISO 8601 date when sprint was created |
| `owner` | string | No | Sprint owner identifier |
| `config` | Config | No | Sprint configuration options |

## Collection Schema

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

## Item Schema

### Simple Item

```yaml
collections:
  step:
    - prompt: "Implement feature X"
    - prompt: "Add tests for feature X"
```

### Item with Metadata

```yaml
collections:
  step:
    - prompt: "Implement feature X"
      id: feature-x
      workflow: feature-standard  # Optional per-item workflow override
```

## Item Fields Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Item description/instructions |
| `id` | string | No | Unique item identifier (auto-generated: step-0, step-1) |
| `workflow` | string | No | Per-item workflow override |
| `<custom>` | any | No | Custom properties accessible as `{{item.<custom>}}` |

## Config Schema

```yaml
config:
  max-tasks: <number>      # Optional
  time-box: <string>       # Optional (duration)
  auto-commit: <boolean>   # Optional
```

### Config Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `max-tasks` | number | - | Maximum tasks before pause |
| `time-box` | string | - | Time limit (e.g., "2h", "30m") |
| `auto-commit` | boolean | false | Auto-commit after each step |

## TypeScript Interface

```typescript
interface SprintDefinition {
  workflow: string;
  collections: Record<string, CollectionItem[]>;
  'sprint-id'?: string;
  name?: string;
  created?: string;
  owner?: string;
  config?: {
    'max-tasks'?: number;
    'time-box'?: string;
    'auto-commit'?: boolean;
  };
}

interface CollectionItem {
  prompt: string;
  workflow?: string;
  id?: string;
  [key: string]: unknown;  // Custom properties
}
```

## Validation Rules

### Sprint Level

1. `workflow` must be non-empty string
2. `collections` must have at least one collection with items
3. File must be valid YAML
4. `sprint-id` if present must be unique

### Collection Level

1. Collection names match `for-each` references in workflows
2. Each collection must have at least one item

### Item Level

1. Items must have `prompt` field
2. Item `id` if present should be kebab-case
3. Per-item `workflow` overrides sprint workflow

### Reference Resolution

1. Workflow resolves from `.claude/workflows/<name>.yaml`
2. References should not include `.yaml` extension
3. Per-item workflow takes precedence over sprint workflow

## Valid Examples

### Minimal Sprint

```yaml
workflow: sprint-default
collections:
  step:
    - prompt: Implement the feature
```

### Standard Sprint

```yaml
name: User Authentication
workflow: sprint-default

collections:
  step:
    - prompt: Create User model
    - prompt: Implement login endpoint
    - prompt: Add authentication middleware
    - prompt: Create logout endpoint
```

### Sprint with Custom IDs

```yaml
name: API Development
workflow: gherkin-verified-execution

collections:
  step:
    - prompt: Design API schema
      id: schema-design
    - prompt: Implement endpoints
      id: implementation
    - prompt: Add integration tests
      id: testing
```

### Sprint with Config

```yaml
name: Complex Feature
workflow: sprint-default

config:
  max-tasks: 50
  time-box: "4h"
  auto-commit: true

collections:
  step:
    - prompt: Phase 1 implementation
    - prompt: Phase 2 implementation
    - prompt: Integration and testing
```

### Sprint with Per-Item Workflows

```yaml
name: Mixed Workflow Sprint
workflow: sprint-default

collections:
  step:
    - prompt: Research best practices
      workflow: execute-step  # Simple execution
    - prompt: Implement feature
      workflow: gherkin-verified-execution  # Full verification
    - prompt: Quick bug fix
      workflow: bugfix-workflow  # Fast fix flow
```

### Sprint with Multiple Collections

```yaml
name: Mixed Development Sprint
workflow: mixed-workflow

collections:
  feature:
    - prompt: User authentication
      priority: high
    - prompt: Dashboard UI
      priority: medium
  bug:
    - prompt: Fix session timeout
      severity: critical
    - prompt: Fix UI alignment
      severity: low
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
collections:
  step:
    - id: my-step
```

```yaml
# INVALID: Invalid workflow reference
workflow: non-existent-workflow
collections:
  step:
    - prompt: Something
```

## Directory Convention

```text
.claude/sprints/
├── YYYY-MM-DD_sprint-name/
│   ├── SPRINT.yaml       # Definition (you write)
│   ├── PROGRESS.yaml     # Compiled (generated)
│   ├── artifacts/        # Sprint artifacts
│   └── context/          # Context files
```

### Naming Pattern

| Pattern | Example | Description |
|---------|---------|-------------|
| `YYYY-MM-DD_name` | `2024-01-15_auth-feature` | Date-prefixed name |
| `sprint-N_name` | `sprint-1_initial-setup` | Sequential numbering |
| `epic-name_story` | `auth_login-flow` | Epic/story grouping |

## Schema Evolution

Current schema version supports:
- Named collections with flexible item types
- Custom properties on items
- Workflow reference resolution
- Per-item workflow overrides
- Sprint configuration options

Future versions may add:
- Item dependencies
- Conditional items
- Parallel item groups
- Item templates
