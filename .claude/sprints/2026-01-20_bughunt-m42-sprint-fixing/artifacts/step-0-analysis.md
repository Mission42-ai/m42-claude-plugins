# BUG-018 Analysis: Runtime Loop Must Create Per-Phase Log Files

## Summary

The runtime loop does not pass `outputFile` to `runClaude()`, preventing the status server from displaying real-time Claude execution logs.

---

## 1. Root Cause Location

**File**: `plugins/m42-sprint/runtime/src/loop.ts`

**Function**: `runLoop()`

**Lines**: 372-376

```typescript
// Execute SPAWN_CLAUDE action directly
const spawnResult = await deps.runClaude({
  prompt,
  cwd: sprintDir,
  // MISSING: outputFile for logs!
});
```

**Supporting File**: `plugins/m42-sprint/runtime/src/claude-runner.ts`

The `ClaudeRunOptions` interface (lines 17-34) already defines `outputFile?: string` and `buildArgs()` (lines 128-166) correctly maps it to `--output-file` CLI flag. The infrastructure is ready but unused.

---

## 2. Conditions That Trigger the Bug

The bug is triggered **every time** the sprint loop executes a phase:

1. **Sprint starts** via `runLoop()`
2. **Loop enters main iteration** (line 336: `while (!isTerminalState(state) && state.status === 'in-progress')`)
3. **Phase/step/sub-phase prompt is extracted** (lines 365-370)
4. **`runClaude()` is called** without `outputFile` (lines 373-376)
5. **Claude executes** but output goes only to stdout capture, not to a file
6. **Status server** at `{sprintDir}/logs/{phaseId}.log` finds no file
7. **Dashboard shows no logs** - users cannot see execution progress

### Affected Scenarios

| Scenario | Impact |
|----------|--------|
| Any sprint execution | No phase logs created |
| Status page refresh | "No log available" for all phases |
| Debugging failed phases | No persistent record of Claude's output |
| Long-running sprints | No real-time visibility into progress |

---

## 3. What a Proper Test Should Verify

### Unit Test Requirements

1. **Logs directory creation**
   - Verify `logs/` directory is created if it doesn't exist
   - Verify no error if `logs/` already exists

2. **Log file path generation**
   - Verify correct filename based on phase ID: `{phaseId}.log`
   - Verify special characters in phase ID are sanitized (replace non-alphanumeric with `_`)
   - Verify sub-phase IDs are used when present

3. **outputFile parameter passing**
   - Verify `runClaude()` receives `outputFile` in options
   - Verify correct full path: `{sprintDir}/logs/{phaseId}.log`

4. **Log file creation**
   - Verify log file exists after Claude execution
   - Verify log file contains Claude's output

### Test Cases

```typescript
describe('BUG-018: Per-phase log file creation', () => {
  it('should create logs directory if it does not exist', async () => {
    // Setup: sprintDir with no logs/ subdirectory
    // Execute: runLoop()
    // Assert: logs/ directory exists
  });

  it('should pass outputFile to runClaude with correct path', async () => {
    // Setup: mock runClaude, phase with id "prepare"
    // Execute: runLoop()
    // Assert: runClaude called with outputFile = "{sprintDir}/logs/prepare.log"
  });

  it('should sanitize phase IDs with special characters', async () => {
    // Setup: phase with id "step-1/sub-phase-2"
    // Execute: runLoop()
    // Assert: outputFile = "{sprintDir}/logs/step-1_sub-phase-2.log"
  });

  it('should use most specific ID (sub-phase > step > phase)', async () => {
    // Setup: phase with step with sub-phase, each with different IDs
    // Execute: runLoop()
    // Assert: outputFile uses sub-phase ID
  });
});
```

### Integration Test Requirements

1. **End-to-end log creation**
   - Run actual sprint with test phases
   - Verify each phase creates corresponding log file
   - Verify log content matches Claude execution output

2. **Status server integration**
   - Start status server
   - Run sprint
   - Verify status API can read log files
   - Verify dashboard displays log content

---

## 4. Fix Implementation Checklist

- [ ] Import `fs` and `path` in loop.ts (already imported)
- [ ] Before the `runClaude()` call (after line 370):
  - [ ] Create `logsDir = path.join(sprintDir, 'logs')`
  - [ ] Create directory with `fs.mkdirSync(logsDir, { recursive: true })`
  - [ ] Sanitize phaseId: `phaseId.replace(/[^a-zA-Z0-9-_]/g, '_')`
  - [ ] Generate `outputFile = path.join(logsDir, `${sanitizedId}.log`)`
- [ ] Pass `outputFile` to `runClaude()` options (line 373-376)
- [ ] Add unit tests for log file creation
- [ ] Verify status server can read created logs

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Log directory creation race | Low | Low | `recursive: true` handles existing dirs |
| Disk space exhaustion | Medium | Medium | Add log rotation in future |
| File permissions | Low | High | Use same perms as PROGRESS.yaml |
| Long phase IDs | Low | Low | Truncate if > 200 chars |

---

## 6. Dependencies

- **Upstream**: None (infrastructure already in place in claude-runner.ts)
- **Downstream**: Status server expects logs at `{sprintDir}/logs/{phaseId}.log`
