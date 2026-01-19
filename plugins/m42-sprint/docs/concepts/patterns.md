# Patterns: Workflow Templates for Consistent Execution

**Note**: This document describes the recommended approach for consistent execution patterns in m42-sprint. The previous hardcoded pattern system has been removed in favor of the more flexible workflow template approach.

---

## The Philosophy: Freedom + Patterns

Ralph Mode provides freedom for deep thinking and dynamic planning. For consistent execution, use **workflow templates** and **well-structured steps** rather than fixed pattern files.

The key insight: **Patterns aren't a separate system - they're how you structure your steps and workflows.**

---

## How Patterns Work Now

Instead of invoking predefined patterns, create steps with clear structure:

### Example: Implementing a Feature (TDD)

```yaml
- prompt: |
    ## Feature: User Authentication

    ### Requirements
    - Implement JWT token generation and validation
    - Add login and logout endpoints
    - Include refresh token mechanism

    ### Process (TDD)
    1. Write comprehensive tests first
    2. Implement to make tests pass
    3. Commit atomically with clear messages

    ### Verification
    - All tests pass (`npm test`)
    - Working tree is clean (`git status`)
    - Implementation matches requirements

    ### Files
    - src/auth/token.ts
    - src/auth/routes.ts
    - tests/auth/*.test.ts
```

### Example: Bug Fix

```yaml
- prompt: |
    ## Bug Fix: Token Refresh Failure

    ### Issue
    Token refresh fails when clock skew exceeds 30 seconds

    ### Process
    1. Reproduce the bug with a test case
    2. Understand the root cause
    3. Implement minimal fix
    4. Verify no regressions

    ### Verification
    - Regression test added
    - All tests pass
    - Fix is committed with explanation

    ### Files
    - src/auth/token.ts
    - tests/auth/token.test.ts
```

---

## Workflow Templates

Use `workflow:` in your SPRINT.yaml to apply execution patterns to all steps:

```yaml
workflow: gherkin-verified-execution

steps:
  - prompt: |
      Step 1: Implement user registration...
```

See `.claude/sprints/2026-01-17_plugin-enhancements/SPRINT.yaml` for a complete example of well-structured steps with a workflow template.

---

## Creating Custom Workflow Templates

Workflow templates live in the compiler and define how steps are executed. To create custom execution patterns:

1. Define the workflow in the compiler's workflow directory
2. Reference it in your SPRINT.yaml with `workflow: your-workflow-name`
3. Each step inherits the workflow's execution approach

---

## Benefits of This Approach

| Workflow Templates | vs | Hardcoded Patterns |
|-------------------|----|--------------------|
| Flexible, customizable | | Fixed, limited |
| Project-specific | | One-size-fits-all |
| Steps are self-documenting | | Separate pattern files |
| No additional infrastructure | | Pattern discovery/execution code |

---

## Migration from Pattern Invocation

If you were using `invokePattern` in Ralph mode results, migrate to structured steps:

**Before** (removed):
```json
{
  "invokePattern": {
    "name": "implement-feature",
    "params": { "feature": "auth" }
  }
}
```

**After** (recommended):
```json
{
  "status": "continue",
  "pendingSteps": [
    {
      "id": null,
      "prompt": "Implement auth feature using TDD: 1) Write tests first 2) Implement to pass 3) Commit atomically"
    }
  ]
}
```

Ralph can dynamically create well-structured steps that embody pattern principles without needing a separate pattern system.

---

## Related Concepts

- [Ralph Mode](ralph-mode.md) - Autonomous execution with dynamic steps
- [Workflow Templates](../reference/workflows.md) - How to define and use workflows
- [SPRINT.yaml Reference](../reference/sprint-yaml-schema.md) - Sprint definition format

---

[← Back to Concepts](overview.md) | [← Back to Documentation Index](../index.md)
