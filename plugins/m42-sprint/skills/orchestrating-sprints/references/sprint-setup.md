---
title: Sprint Setup
description: Sprint initialization details including directory structure, default settings, and best practices for sprint configuration.
keywords: initialization, directory, template, setup, configuration
skill: orchestrating-sprints
---

# Sprint Setup

## Directory Structure

```text
sprints/YYYY-MM-DD_sprint-name/
  SPRINT.yaml          # Sprint metadata and configuration
  PROGRESS.yaml        # Task queue and execution state
  context/             # Cached context per task
    implement-issue-42.md
    refactor-auth.md
  artifacts/           # Generated outputs
    prs/
    commits/
    reports/
```

## Default Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `max-tasks` | 10 | Maximum tasks per sprint |
| `time-box` | 4h | Sprint duration limit |
| `auto-commit` | true | Commit after each task |
| `context-cache` | true | Cache gathered context |
| `parallel` | false | Sequential task execution |

## Initialization Command

```bash
# Create sprint directory
mkdir -p sprints/$(date +%Y-%m-%d)_sprint-name/{context,artifacts}

# Copy templates
cp assets/sprint-template.yaml sprints/.../SPRINT.yaml
cp assets/progress-template.yaml sprints/.../PROGRESS.yaml
```

## Best Practices

- Name sprints by date and focus: `2024-01-15_auth-improvements`
- Keep sprints focused: 5-10 related tasks maximum
- Time-box aggressively: 2-4 hours per sprint
- Cache context: avoid re-gathering for related tasks
- Commit atomically: one commit per task completion
- Track blockers: update PROGRESS.yaml immediately when blocked
