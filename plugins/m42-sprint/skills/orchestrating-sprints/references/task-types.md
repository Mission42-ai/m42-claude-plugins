---
title: Task Types
description: Specifications for polymorphic task types including required parameters, optional fields, and done-when patterns.
keywords: issue, refactor, docs, custom, polymorphic, parameters
skill: orchestrating-sprints
---

# Task Types

## Type Specifications

### implement-issue

| Field | Required | Description |
|-------|----------|-------------|
| `issue-number` | Yes | GitHub issue number |
| `repo` | No | Repository (default: current) |
| `branch` | No | Target branch (auto-generated) |
| `pr-template` | No | PR description template |

**Done-when:** PR merged OR issue closed
**Context:** Issue body, comments, linked issues, related code

### refactor

| Field | Required | Description |
|-------|----------|-------------|
| `target-path` | Yes | File or directory to refactor |
| `goal` | Yes | Refactoring objective |
| `constraints` | No | Boundaries (no API changes, etc.) |
| `test-command` | No | Validation command |

**Done-when:** Tests pass AND goal achieved
**Context:** Target code, test files, dependencies

### update-docs

| Field | Required | Description |
|-------|----------|-------------|
| `doc-path` | Yes | Documentation file path |
| `changes` | Yes | Required changes description |
| `source-files` | No | Code files to reference |
| `validate` | No | Validation script |

**Done-when:** Docs updated AND validation passes
**Context:** Existing docs, source code, style guide

### custom

| Field | Required | Description |
|-------|----------|-------------|
| `description` | Yes | Task description |
| `done-when` | Yes | Completion criteria |
| `context-files` | No | Files to gather context from |
| `output-path` | No | Expected output location |

**Done-when:** Custom criteria met
**Context:** Specified files only

## Common Optional Fields

| Field | Applies To | Description |
|-------|------------|-------------|
| `command` | All | Task-specific workflow command (e.g., /implement-issue) |
| `priority` | All | high, medium, low |
| `depends-on` | All | Task ID dependencies |
| `estimate` | All | Time estimate (15m, 1h, etc.) |
| `labels` | All | Categorization tags |
| `blocked-by` | All | External blocker description |

## Command Field Usage

The optional `command` field allows tasks to define custom workflow instructions:

```yaml
- id: implement-issue-42
  type: implement-issue
  command: /implement-issue  # Invoked to get workflow instructions
  issue-number: 42
```

**How it works:**
1. Sprint loop reads task from queue
2. If `command` field exists, loop invokes it
3. Command provides task-specific context and workflow
4. Agent follows those instructions instead of generic workflow

**Benefits:**
- Different sprint types (dev, docs, cleanup) use different workflows
- Task-specific context loaded by specialized commands
- Flexible and extensible without modifying loop logic
