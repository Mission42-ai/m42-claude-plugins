# Operator System

The operator system enables dynamic work discovery and injection during sprint execution. When Claude discovers issues, improvements, or bugs during a phase, it can submit operator requests that are triaged and potentially injected as new steps.

---

## Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    Sprint Execution Flow                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│   │   Phase 1   │────▶│   Phase 2   │────▶│   Phase 3   │       │
│   └─────────────┘     └──────┬──────┘     └─────────────┘       │
│                              │                                    │
│                              │ Discovers issue                    │
│                              ▼                                    │
│                     ┌─────────────────┐                          │
│                     │ Operator Request │                          │
│                     │   (in queue)     │                          │
│                     └────────┬────────┘                          │
│                              │                                    │
│                              ▼                                    │
│                     ┌─────────────────┐                          │
│                     │    Decision     │                          │
│                     │ approve/reject/ │                          │
│                     │ defer/backlog   │                          │
│                     └────────┬────────┘                          │
│                              │                                    │
│           ┌──────────────────┼──────────────────┐                │
│           ▼                  ▼                  ▼                 │
│    ┌──────────┐      ┌──────────┐       ┌──────────┐            │
│    │ Approved │      │ Deferred │       │ Backlog  │            │
│    │ (inject) │      │ (later)  │       │ (human)  │            │
│    └──────────┘      └──────────┘       └──────────┘            │
│           │                                                       │
│           ▼                                                       │
│   ┌───────────────┐                                              │
│   │ Injected Step │  ◀── New step added to sprint                │
│   └───────────────┘                                              │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Request Lifecycle

### 1. Discovery

During phase execution, Claude may discover:
- **Bugs**: Broken functionality that needs fixing
- **Security issues**: Vulnerabilities requiring immediate attention
- **Improvements**: Enhancements that would benefit the codebase
- **Refactoring**: Technical debt worth addressing
- **Documentation**: Missing or outdated docs
- **Tests**: Missing test coverage

Claude creates an operator request with:
```yaml
id: req-abc123
title: "Fix null pointer in login function"
description: "The login function crashes when email is undefined..."
priority: high
type: bug
context:
  discoveredIn: "development > step-2 > implement"
  relatedFiles:
    - src/auth/login.ts
  codeSnippet: "user.email.toLowerCase()"
  suggestedWorkflow: "bugfix"
```

### 2. Queue

Requests are added to `operator-queue` in PROGRESS.yaml with status `pending`:
```yaml
operator-queue:
  - id: req-abc123
    title: "Fix null pointer in login function"
    # ... request fields
    status: pending
    created-at: "2026-01-20T10:30:00Z"
    discovered-in: "development > step-2 > implement"
```

### 3. Decision

Decisions can be made:
- **Automatically**: Based on priority and type (default behavior)
- **Manually**: Via dashboard UI or API

| Decision | Effect |
|----------|--------|
| `approve` | Inject as new step(s) in current sprint |
| `reject` | Decline with documented reason |
| `defer` | Delay until end-of-phase, end-of-sprint, or next-sprint |
| `backlog` | Add to BACKLOG.yaml for human review |

### 4. Action

**Approved requests** trigger step injection:
- New phase(s) created with `injected: true` flag
- Inserted at specified position (after-current or end-of-phase)
- Sprint continues with injected work

**Backlogged requests** are saved to BACKLOG.yaml:
```yaml
items:
  - id: req-def456
    title: "Refactor database layer"
    description: "..."
    category: tech-debt
    suggested-priority: low
    operator-notes: "Valid but out of scope for current sprint"
    source:
      request-id: req-def456
      discovered-in: "development > step-3 > implement"
      discovered-at: "2026-01-20T10:35:00Z"
    status: pending-review
```

---

## Request Types

| Type | Description | Default Handling |
|------|-------------|------------------|
| `bug` | Broken functionality | High priority: approve; Low: defer |
| `security` | Vulnerabilities | Critical: approve immediately |
| `improvement` | Enhancements | Medium: defer; Low: backlog |
| `refactor` | Technical debt | Usually backlog |
| `docs` | Documentation updates | Usually backlog |
| `test` | Missing tests | Medium: defer |

---

## Priority Levels

| Priority | Description | Auto-Decision |
|----------|-------------|---------------|
| `critical` | Blocks sprint progress | Approve if security; defer otherwise |
| `high` | Should be addressed soon | Approve if bug; defer otherwise |
| `medium` | Can wait until convenient | Defer to end-of-phase |
| `low` | Nice to have | Add to backlog |

---

## Viewing the Queue

### Dashboard UI

Navigate to `/sprint/<sprint-id>/operator` to see:
- **Pending**: Requests awaiting decision
- **Decided**: Recent approvals, rejections, deferrals
- **Backlog**: Items for human review

### API

```bash
# Get queue data
curl http://localhost:3100/api/sprint/<sprint-id>/operator-queue

# Submit manual decision
curl -X POST http://localhost:3100/api/sprint/<sprint-id>/operator-queue/<request-id>/decide \
  -H "Content-Type: application/json" \
  -d '{"decision": "approve", "reasoning": "Critical bug fix"}'
```

---

## Injection Configuration

When approving a request, specify injection details:

```yaml
decision: approve
reasoning: "Critical bug that blocks user flow"
injection:
  position:
    type: after-current    # or 'end-of-phase'
  prompt: "Fix the null pointer exception in login..."
  workflow: bugfix         # Optional: use specific workflow
  model: sonnet            # Optional: model override
  idPrefix: fix-req-abc    # Prefix for generated phase IDs
```

### Injection Positions

| Position | Description |
|----------|-------------|
| `after-current` | Immediately after current phase (default) |
| `end-of-phase` | At end of current top-level phase |

---

## BACKLOG.yaml

Items sent to backlog are persisted in `BACKLOG.yaml` for later review:

```yaml
items:
  - id: req-abc123
    title: "Add caching layer"
    description: "Performance could be improved with Redis caching"
    category: improvement
    suggested-priority: medium
    operator-notes: "Valid but scope is too large for current sprint"
    source:
      request-id: req-abc123
      discovered-in: "development > step-4 > implement"
      discovered-at: "2026-01-20T11:00:00Z"
    created-at: "2026-01-20T11:01:00Z"
    status: pending-review
```

### Backlog Item Status

| Status | Description |
|--------|-------------|
| `pending-review` | Awaiting human review |
| `acknowledged` | Human has seen it |
| `converted-to-issue` | Created as GitHub issue |

---

## Configuration

Enable operator system in workflow or sprint:

```yaml
# In workflow definition
orchestration:
  enabled: true
  autoApprove: true        # Auto-approve based on priority rules
  insertStrategy: after-current

# Or in SPRINT.yaml
orchestration:
  enabled: true
  autoApprove: false       # Require manual decisions
```

### Operator Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | false | Enable operator system |
| `autoApprove` | boolean | true | Auto-decide based on priority |
| `insertStrategy` | string | `after-current` | Where to inject approved steps |
| `model` | string | `sonnet` | Model for operator reasoning |
| `skill` | string | `sprint-operator` | Skill for operator prompts |

---

## Best Practices

1. **Be specific**: Include relevant context (files, code snippets) in requests
2. **Use appropriate priority**: Reserve `critical` for actual blockers
3. **Review backlog regularly**: Don't let it grow unbounded
4. **Trust the auto-triage**: It handles most cases correctly
5. **Use manual decisions sparingly**: For edge cases or complex trade-offs

---

## Related Documentation

- [API Reference - Operator Queue Endpoints](../reference/api.md#operator-queue-endpoints)
- [PROGRESS.yaml Schema - Operator Queue](../reference/progress-yaml-schema.md#operator-queue)
- [User Guide - Operator Queue](../USER-GUIDE.md#operator-queue)
