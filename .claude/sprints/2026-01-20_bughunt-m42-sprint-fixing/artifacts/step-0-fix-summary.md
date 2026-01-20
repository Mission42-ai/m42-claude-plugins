# BUG-018 Fix Summary: Runtime Loop Must Create Per-Phase Log Files

**Status**: FIXED
**Severity**: CRITICAL (blocked status page functionality)
**Feature**: runtime/loop + claude-runner

---

## Root Cause

The runtime loop in `loop.ts` was calling `runClaude()` without passing the `outputFile` parameter. This meant:

1. Claude's output was only captured in memory via stdout
2. No persistent log files were created in `{sprintDir}/logs/`
3. The status server could not display real-time execution logs
4. Users had no visibility into what Claude was doing during sprint execution

**Original Code** (loop.ts:373-376):
```typescript
const spawnResult = await deps.runClaude({
  prompt,
  cwd: sprintDir,
  // MISSING: outputFile for logs!
});
```

---

## Solution Implemented

Added three key changes to `loop.ts`:

### 1. Create logs directory (lines 372-376)
```typescript
const logsDir = path.join(sprintDir, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
```

### 2. Generate sanitized log file path (lines 378-381)
```typescript
const sanitizedId = phaseId.replace(/[^a-zA-Z0-9-_]/g, '_') || `phase-${progress.current.phase}`;
const logFileName = `${sanitizedId}.log`;
const outputFile = path.join(logsDir, logFileName);
```

### 3. Pass outputFile to runClaude (lines 384-388)
```typescript
const spawnResult = await deps.runClaude({
  prompt,
  cwd: sprintDir,
  outputFile,  // NOW PASSES LOG FILE PATH
});
```

---

## Edge Cases Handled

| Edge Case | Handling |
|-----------|----------|
| Special characters in phase IDs | Replaced with `_` via regex `/[^a-zA-Z0-9-_]/g` |
| Empty phase ID | Falls back to `phase-${progress.current.phase}` |
| Logs directory already exists | `fs.existsSync()` check prevents duplicate creation |
| Logs directory doesn't exist | `fs.mkdirSync({ recursive: true })` creates it safely |

---

## Tests Added

Three new tests in `loop.test.ts`:

1. **`BUG-018: runLoop should pass outputFile to runClaude for phase logs`**
   - Verifies `outputFile` is passed to runClaude
   - Verifies path is in logs directory
   - Verifies filename includes phase ID
   - Verifies `.log` extension

2. **`BUG-018: runLoop should create logs directory if it does not exist`**
   - Removes logs directory before test
   - Verifies directory exists when runClaude is called

3. **`BUG-018: runLoop should generate unique log file per phase/step/sub-phase`**
   - Runs sprint with 2 phases
   - Verifies each phase gets a unique log file path

---

## Verification

### Test Suite
```
All tests pass:
- ✓ BUG-018: runLoop should pass outputFile to runClaude for phase logs
- ✓ BUG-018: runLoop should create logs directory if it does not exist
- ✓ BUG-018: runLoop should generate unique log file per phase/step/sub-phase
```

### Manual Verification Steps
After deploying this fix:
1. Run a sprint via `run-sprint` command
2. Check `{sprintDir}/logs/` directory
3. Verify log files exist for each executed phase
4. Verify status page can display log contents

---

## Follow-up Items

- [ ] Consider adding log rotation for long-running sprints
- [ ] Consider truncating very long phase IDs (> 200 chars)
- [ ] Add log file size limits to prevent disk exhaustion

---

## Files Modified

- `plugins/m42-sprint/runtime/src/loop.ts` (lines 372-388)
- `plugins/m42-sprint/runtime/src/loop.test.ts` (added 3 tests, lines 983-1162)
