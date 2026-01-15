---
title: Progress Schema
description: Compiled PROGRESS.yaml schema including phase hierarchy, current pointer, status values, and statistics.
keywords: progress, schema, compiled, hierarchy, pointer, status, statistics
skill: orchestrating-sprints
---

# Progress Schema

## Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `sprint-id` | string | Sprint identifier |
| `status` | enum | Sprint execution status |
| `phases` | list | Compiled phase hierarchy |
| `current` | object | Execution pointer |
| `stats` | object | Execution statistics |

## Status Enums

### Sprint Status

| Value | Description |
|-------|-------------|
| `not-started` | Sprint initialized but not begun |
| `in-progress` | Actively executing phases |
| `completed` | All phases finished |
| `blocked` | Cannot proceed, needs resolution |
| `paused` | Manually paused by user |
| `needs-human` | Requires human intervention |

### Phase Status

| Value | Description |
|-------|-------------|
| `pending` | Not yet started |
| `in-progress` | Currently executing |
| `completed` | Successfully finished |
| `blocked` | Cannot proceed |
| `skipped` | Intentionally skipped |

## Phase Hierarchy

Three-level structure supporting simple and for-each phases.

### CompiledTopPhase

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Phase identifier |
| `status` | enum | Phase status |
| `prompt` | string | Execution prompt (simple phase only) |
| `steps` | list | CompiledStep entries (for-each phase only) |

### CompiledStep

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Step identifier |
| `prompt` | string | Original prompt template |
| `status` | enum | Step status |
| `phases` | list | CompiledPhase entries |

### CompiledPhase

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Phase identifier |
| `status` | enum | Phase status |
| `prompt` | string | Interpolated execution prompt |

## Current Pointer

| Field | Type | Description |
|-------|------|-------------|
| `phase` | number | Index into phases array (0-based) |
| `step` | number\|null | Index into steps array (null if simple phase) |
| `sub-phase` | number\|null | Index into sub-phases array |

## Stats Object

| Field | Type | Description |
|-------|------|-------------|
| `started-at` | ISO 8601 | Sprint start timestamp |
| `completed-at` | ISO 8601 | Sprint end timestamp |
| `total-phases` | number | Total phase count |
| `completed-phases` | number | Completed count |
| `total-steps` | number | Total steps (for-each only) |
| `completed-steps` | number | Completed steps |

## Example PROGRESS.yaml

```yaml
sprint-id: feature-auth-2026-01
status: in-progress

phases:
  # Simple phase
  - id: setup-branch
    status: completed
    prompt: "Create feature branch and set up project structure"

  # For-each phase with expanded steps
  - id: implement-endpoints
    status: in-progress
    steps:
      - id: implement-endpoints-login
        prompt: "Implement {{endpoint}} endpoint"
        status: completed
        phases:
          - id: implement-endpoints-login-gather
            status: completed
            prompt: "Gather context for login endpoint"
          - id: implement-endpoints-login-execute
            status: completed
            prompt: "Implement login endpoint"
          - id: implement-endpoints-login-verify
            status: completed
            prompt: "Verify login endpoint implementation"

      - id: implement-endpoints-logout
        prompt: "Implement {{endpoint}} endpoint"
        status: in-progress
        phases:
          - id: implement-endpoints-logout-gather
            status: completed
            prompt: "Gather context for logout endpoint"
          - id: implement-endpoints-logout-execute
            status: in-progress
            prompt: "Implement logout endpoint"
          - id: implement-endpoints-logout-verify
            status: pending
            prompt: "Verify logout endpoint implementation"

      - id: implement-endpoints-refresh
        prompt: "Implement {{endpoint}} endpoint"
        status: pending
        phases:
          - id: implement-endpoints-refresh-gather
            status: pending
            prompt: "Gather context for refresh endpoint"
          - id: implement-endpoints-refresh-execute
            status: pending
            prompt: "Implement refresh endpoint"
          - id: implement-endpoints-refresh-verify
            status: pending
            prompt: "Verify refresh endpoint implementation"

  # Simple phase
  - id: final-review
    status: pending
    prompt: "Run full test suite and create PR"

current:
  phase: 1
  step: 1
  sub-phase: 1

stats:
  started-at: 2026-01-15T09:00:00Z
  completed-at: null
  total-phases: 3
  completed-phases: 1
  total-steps: 3
  completed-steps: 1
```
