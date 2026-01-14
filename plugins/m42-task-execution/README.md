# M42 Task Execution Plugin

Reusable 6-phase task execution workflow for Claude Code.

## Installation

```bash
claude plugin install m42-task-execution
```

Or from URL:
```bash
claude plugin add https://github.com/mission42-ai/m42-task-execution-plugin
```

## Overview

This plugin provides a fixed 6-phase workflow that executes for ANY task type. It's used by the m42-sprint plugin but can also be invoked standalone.

## 6-Phase Workflow

```
┌─────────────────┐
│ 1. CONTEXT      │ Gather task-specific context
│    GATHERING    │ Load skills, explore architecture
└────────┬────────┘
         ▼
┌─────────────────┐
│ 2. PLANNING     │ Use TodoWrite for task breakdown
│                 │ 15-30 minute implementation steps
└────────┬────────┘
         ▼
┌─────────────────┐
│ 3. EXECUTION    │ Implement with atomic commits
│                 │ Delegate to subagents as needed
└────────┬────────┘
         ▼
┌─────────────────┐
│ 4. QUALITY      │ Run: build, typecheck, lint, tests
│    CHECK        │ Fix failures, iterate until pass
└────────┬────────┘
         ▼
┌─────────────────┐
│ 5. PROGRESS     │ Update tracking files
│    UPDATE       │ Mark task done or record blockers
└────────┬────────┘
         ▼
┌─────────────────┐
│ 6. LEARNING     │ Document what worked/didn't
│    DOCUMENTATION│ Record for future iterations
└─────────────────┘
```

## Phase Details

### Phase 1: Context Gathering

Based on task type:
- **implement-issue**: Fetch from GitHub, parse gherkin
- **refactor**: Read target files, identify patterns
- **update-docs**: Read current docs, find related code
- **custom**: Parse description, explore relevant areas

### Phase 2: Planning

Use TodoWrite with 15-30 minute task granularity:

```javascript
TodoWrite([
  {content: "Add User aggregate", status: "pending", activeForm: "Adding aggregate"},
  {content: "Add CreateUserCommand", status: "pending", activeForm: "Adding command"},
  {content: "Write unit tests", status: "pending", activeForm: "Writing tests"}
])
```

### Phase 3: Execution

- TDD workflow for implement-issue
- Create new → migrate → remove old for refactor
- Atomic commits with conventional format

### Phase 4: Quality Check

```bash
npm run build      # Must pass
npm run typecheck  # Must pass
npm run lint       # Must pass
npm test -- --run  # Must pass
```

### Phase 5: Progress Update

- Update task status in tracking files
- Record completion time and commit SHA
- Add GitHub issue comment if applicable

### Phase 6: Learning Documentation

Document:
- What worked well
- Challenges encountered
- Skill effectiveness
- Technical debt discovered
- Information findability

## Structure

```
m42-task-execution-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── task-execution/
│       ├── SKILL.md
│       ├── references/
│       │   ├── phase-1-context.md
│       │   ├── phase-2-planning.md
│       │   ├── phase-3-execution.md
│       │   ├── phase-4-quality.md
│       │   ├── phase-5-progress.md
│       │   └── phase-6-learning.md
│       └── assets/
└── README.md
```

## License

MIT
