---
title: Template Variables Reference
description: Complete reference for all available template variables in workflow prompts.
keywords: template, variables, substitution, item, phase, sprint, context
skill: creating-workflows
---

# Template Variables Reference

Template variables are placeholders in workflow prompts that get replaced with actual values at runtime.

## Syntax

Variables use double curly braces: `{{variable.property}}`

```yaml
prompt: |
  Implement: {{item.prompt}}
  Current phase: {{phase.id}}
```

## Variable Categories

### Item Variables

Available only in for-each phases and their nested workflows.

| Variable | Type | Description | Example Value |
|----------|------|-------------|---------------|
| `{{item.prompt}}` | string | Item description from collection | "Implement user auth" |
| `{{item.id}}` | string | Item identifier | "step-0" |
| `{{item.index}}` | number | 0-based item index | 0, 1, 2... |
| `{{item.<prop>}}` | any | Any custom property from the item | (varies) |

### Type-Specific Aliases

When using `for-each: <type>`, a type-specific alias is available:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{step.prompt}}` | Alias when `for-each: step` | Same as `{{item.prompt}}` |
| `{{feature.prompt}}` | Alias when `for-each: feature` | Same as `{{item.prompt}}` |
| `{{bug.prompt}}` | Alias when `for-each: bug` | Same as `{{item.prompt}}` |

### Phase Variables

Available in all phases.

| Variable | Type | Description | Example Value |
|----------|------|-------------|---------------|
| `{{phase.id}}` | string | Current phase identifier | "development" |
| `{{phase.index}}` | number | 0-based phase index | 0, 1, 2... |

### Sprint Variables

Available in all phases.

| Variable | Type | Description | Example Value |
|----------|------|-------------|---------------|
| `{{sprint.id}}` | string | Sprint identifier | "2024-01-15_auth-feature" |
| `{{sprint.name}}` | string | Sprint name (optional) | "Authentication Feature" |

## Availability Matrix

| Variable | Simple Phase | For-Each Phase | Nested Workflow |
|----------|--------------|----------------|-----------------|
| `{{item.*}}` | No | Yes | Yes |
| `{{<type>.*}}` | No | Yes | Yes |
| `{{phase.*}}` | Yes | Yes | Yes |
| `{{sprint.*}}` | Yes | Yes | Yes |

## TypeScript Interface

```typescript
interface TemplateContext {
  item?: {
    prompt: string;
    id: string;
    index: number;
    [key: string]: unknown;  // Custom properties
  };
  // Type-specific alias (e.g., step, feature, bug)
  [type: string]?: {
    prompt: string;
    id: string;
    index: number;
    [key: string]: unknown;
  };
  phase?: {
    id: string;
    index: number;
  };
  sprint?: {
    id: string;
    name?: string;
  };
}
```

## Usage Examples

### Item Context in For-Each

```yaml
# Top-level workflow with for-each
phases:
  - id: development
    for-each: step
    workflow: feature-workflow

# feature-workflow.yaml (nested)
phases:
  - id: implement
    prompt: |
      ## Task
      {{item.prompt}}

      ## Instructions
      Implement item {{item.id}} (index: {{item.index}})
```

### Type-Specific Alias

When `for-each: step`, both `{{item.prompt}}` and `{{step.prompt}}` work:

```yaml
phases:
  - id: execute
    prompt: |
      Task: {{step.prompt}}    # Type-specific alias
      Same as: {{item.prompt}} # Generic form
```

### Sprint Context

```yaml
phases:
  - id: prepare
    prompt: |
      Initialize sprint: {{sprint.id}}
      Create branch: sprint/{{sprint.id}}
```

### Phase Context

```yaml
phases:
  - id: qa
    prompt: |
      Running phase: {{phase.id}}
      Phase index: {{phase.index}}
```

### Combined Variables

```yaml
phases:
  - id: verify
    prompt: |
      Verifying {{item.id}} in phase {{phase.id}}
      Sprint: {{sprint.id}}
      Task: {{item.prompt}}
```

### Custom Properties

When items have custom properties, access them via `{{item.<prop>}}`:

```yaml
# SPRINT.yaml
collections:
  feature:
    - prompt: User authentication
      priority: high

# Workflow
phases:
  - id: implement
    prompt: |
      Feature: {{item.prompt}}
      Priority: {{item.priority}}
```

## Output Artifacts Pattern

Use variables to create consistent artifact paths:

```yaml
phases:
  - id: plan
    prompt: |
      Write implementation plan to:
      context/{{item.id}}-plan.md

  - id: implement
    prompt: |
      Read plan from: context/{{item.id}}-plan.md
      Implement the requirements.
```

## Unresolved Variables

### Default Behavior

Unresolved variables remain as literal text in the output.

```yaml
# If item context is missing:
prompt: "Task: {{item.prompt}}"
# Outputs: "Task: {{item.prompt}}"
```

### Strict Mode

With compiler strict mode enabled, unresolved variables cause compilation errors.

## Common Patterns

### File Naming

```yaml
prompt: |
  Save to: artifacts/{{item.id}}-output.md
  Log to: logs/{{phase.id}}.log
```

### Git Operations

```yaml
prompt: |
  git checkout -b sprint/{{sprint.id}}
  git commit -m "{{phase.id}}: {{item.prompt}}"
```

### Progress Tracking

```yaml
prompt: |
  Processing item {{item.index}} of the sprint.
  Item ID: {{item.id}}
```

## Best Practices

1. **Use item.id for files** - Creates unique, traceable artifacts
2. **Include item.prompt in context** - Ensures task clarity
3. **Use sprint.id for branches** - Maintains sprint isolation
4. **Test variable resolution** - Verify substitution before deployment
5. **Prefer {{item.*}} for portability** - Works regardless of collection type

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Variable not replaced | Wrong context (item.* in simple phase) | Check availability matrix |
| Empty value | Missing field in collection | Verify source data |
| Literal `{{...}}` in output | Typo in variable name | Check spelling |
| Compilation error (strict) | Missing required context | Provide context or disable strict mode |
