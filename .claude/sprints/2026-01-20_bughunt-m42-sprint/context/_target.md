# Bug Hunt Target Information

**Target Plugin**: plugins/m42-sprint

## Test Commands

```bash
cd plugins/m42-sprint/compiler && npm test
cd plugins/m42-sprint/runtime && npm test
cd plugins/m42-sprint/e2e && npm test
```

## Run Commands (Slash Commands)

- `/sprint-status` - Show sprint progress dashboard
- `/run-sprint` - Start sprint execution loop
- `/compile-sprint` - Compile sprint YAML
- `/pause-sprint` - Pause sprint after current task
- `/resume-sprint` - Resume paused sprint execution
- `/add-step` - Add step to sprint SPRINT.yaml
- `/import-steps` - Bulk import steps to sprint SPRINT.yaml

## Focus Areas

### Compiler
- Workflow validation
- YAML parsing
- For-each expansion

### Runtime
- State machine transitions
- Loop execution
- Pause/resume functionality

### E2E
- Full sprint execution with mock Claude runner

### CLI
- Command argument parsing
- Validation

### Status
- Dashboard rendering
- Real-time updates
