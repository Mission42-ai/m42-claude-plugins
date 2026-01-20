# Bug Discovery Log

**Target**: plugins/m42-sprint
**Date**: 2026-01-20
**Status**: In Progress

## Bugs Found

| ID | Severity | Feature | Summary | Method | Status |
|----|----------|---------|---------|--------|--------|
| BUG-001 | medium | compiler | Workflow cache persists globally causing stale data between compilations | static-analysis |
| BUG-002 | medium | runtime/loop | Race condition: no lock on PROGRESS.yaml during read-modify-write cycle | static-analysis | **FIXED** |
| BUG-003 | low | runtime/cli | parseInt without radix validation allows invalid numeric values | static-analysis |
| BUG-004 | medium | runtime/loop | Empty phases array not checked before accessing phases[0] in pointer creation | static-analysis |
| BUG-005 | low | compiler/error-classifier | Logic error category patterns are too broad, will match before specific patterns | static-analysis |
| BUG-006 | medium | status-server | No validation of phaseId parameter allows path traversal in log endpoints | static-analysis | **FIXED** |
| BUG-007 | low | runtime/yaml-ops | writeProgressAtomic is async but doesn't await fs.writeFileSync | static-analysis |
| BUG-008 | medium | runtime/transition | advancePointer may return null step but phases[0] is accessed without check | static-analysis |
| BUG-009 | low | compiler/expand-foreach | Non-null assertion on phase.steps! may throw if steps is undefined | static-analysis |
| BUG-010 | medium | status-server | Signal files (.pause-requested etc) not cleaned up on sprint completion | static-analysis | **FIXED** |
| BUG-011 | medium | status-server | Negative page parameter causes incorrect pagination results | manual-exploration |
| BUG-012 | low | status-server | Path traversal sanitization lacks explicit containment check | manual-exploration | **FIXED** |
| BUG-013 | low | runtime/cli | Delay parameter accepts negative values without validation | manual-exploration |
| BUG-014 | low | status-server | Page=0 returns empty results with hasMore=true | ui-testing |
| BUG-015 | low | status-server | Non-numeric page parameter returns page: null instead of error | ui-testing |
| BUG-016 | medium | status-server | Negative limit parameter returns more results than expected | ui-testing |

## Bug Details

---

### BUG-001: Workflow cache persists globally causing stale data between compilations

**File**: `compiler/src/resolve-workflows.ts:20-38`

**Description**: The workflow cache is a module-level `Map` that persists across multiple compilations in the same process. If a workflow file is modified after being cached, subsequent compilations will use the stale cached version.

**Code**:
```typescript
const workflowCache = new Map<string, LoadedWorkflow>();

export function loadWorkflow(
  name: string,
  workflowsDir: string,
  errors?: CompilerError[]
): LoadedWorkflow | null {
  // Check cache first
  const cacheKey = `${workflowsDir}:${name}`;
  if (workflowCache.has(cacheKey)) {
    return workflowCache.get(cacheKey)!;
  }
  // ... loads and caches
}
```

**Impact**: In long-running processes (e.g., watch mode or server), modified workflow files won't be reloaded.

**Recommendation**: Clear cache at the start of each compilation, or add file modification timestamp checking.

---

### BUG-002: Race condition on PROGRESS.yaml during read-modify-write cycle

**Status**: ✅ **FIXED** (2026-01-20)

**File**: `runtime/src/loop.ts:361-417`

**Description**: The loop performs backup → Claude execution → write without holding a lock on PROGRESS.yaml. If another process (e.g., status server's skip/retry endpoints) modifies the file concurrently, changes may be lost.

**Original Code**:
```typescript
// Transaction: backup before Claude execution
backupProgress(progressPath);  // Line 362

// ... Claude execution happens here (can take minutes)

// Commit transaction
await writeProgressAtomic(progressPath, progress);  // Line 416
cleanupBackup(progressPath);  // Line 417
```

**Impact**: Status server modifications via /api/skip or /api/retry may be overwritten by the loop's next write.

**Resolution**: Implemented compare-and-swap mechanism with checksum verification:

1. **Checksum before Claude execution** (`loop.ts:467`):
   ```typescript
   const preExecChecksum = getFileChecksum(progressPath);
   ```

2. **Compare-and-swap after Claude execution** (`loop.ts:495-507`):
   ```typescript
   const postExecChecksum = getFileChecksum(progressPath);
   if (postExecChecksum !== preExecChecksum) {
     // File was modified externally - merge changes
     const diskProgress = readProgressWithoutChecksumValidation(progressPath);
     mergeExternalChanges(progress, diskProgress);
   }
   ```

3. **Intelligent merge of external changes** (`loop.ts:267-313`):
   - `mergeExternalChanges()` function traverses the full hierarchy (phases → steps → sub-phases)
   - Preserves 'skipped' status from external writes (e.g., /api/skip)
   - Preserves 'retry-count' from external writes (e.g., /api/retry)
   - If retry was requested on a failed/blocked phase, resets status to 'pending'

4. **Helper function for item-level merging** (`loop.ts:240-258`):
   ```typescript
   function mergeItemChanges(localItem, diskItem): void {
     // Preserve 'skipped' status from external writes
     if (diskItem?.status === 'skipped' && localItem?.status !== 'completed') {
       localItem.status = 'skipped';
     }
     // Preserve retry-count from external writes
     if (diskItem?.['retry-count'] !== undefined) {
       localItem['retry-count'] = diskItem['retry-count'];
       // If retry was requested, reset status to pending
       if (diskItem.status === 'pending' &&
           (localItem.status === 'failed' || localItem.status === 'blocked')) {
         localItem.status = 'pending';
       }
     }
   }
   ```

5. **Checksum-free reading for merge** (`loop.ts:328-331`):
   ```typescript
   function readProgressWithoutChecksumValidation(filePath: string): CompiledProgress {
     const content = fs.readFileSync(filePath, 'utf8');
     return yaml.load(content) as unknown as CompiledProgress;
   }
   ```
   External processes (status server) may write without updating checksums, so the merge reads without validation.

**Tests Added** (`loop.test.ts:1168-1445`):
- `BUG-002: External writes during Claude execution are lost (race condition)` - Verifies skip action persists
- `BUG-002: Skip actions from status server are preserved (compare-and-swap)` - Verifies skipped phases aren't re-executed
- `BUG-002: Retry actions from status server are preserved` - Verifies retry-count is preserved

---

### BUG-003: parseInt without radix validation allows invalid numeric values

**File**: `runtime/src/cli.ts:101-108`

**Description**: The CLI uses `parseInt(value, 10)` but doesn't validate that the parsed result is a valid number. Values like `"abc"` will result in `NaN` being stored in options.

**Code**:
```typescript
if (arg === '--max-iterations' || arg === '-n') {
  const value = cliArgs[++i];
  if (value !== undefined) {
    result.options.maxIterations = parseInt(value, 10);
    // No check for NaN!
  }
}
```

**Impact**: Invalid numeric arguments silently produce `NaN`, causing unexpected behavior in comparisons (`NaN > 0` is false).

**Recommendation**: Add validation: `if (isNaN(parsed)) { result.error = 'Invalid number for --max-iterations'; }`

---

### BUG-004: Empty phases array not checked before accessing phases[0]

**File**: `runtime/src/transition.ts:330-339`

**Description**: `createPointerForPhase` accesses `context.phases?.[phaseIndex]` but doesn't handle the case where phases array is empty before accessing `phase.steps` and `phase.steps![0].phases`.

**Code**:
```typescript
function createPointerForPhase(phaseIndex: number, context: CompiledProgress): CurrentPointer {
  const phase = context.phases?.[phaseIndex];
  const hasSteps = phase?.steps && phase.steps.length > 0;
  const hasSubPhases = hasSteps && phase.steps![0].phases && phase.steps![0].phases.length > 0;
  // ...
}
```

**Impact**: If called with an empty phases array or invalid phaseIndex, may cause undefined access.

**Recommendation**: Add explicit bounds checking before accessing array elements.

---

### BUG-005: Logic error category patterns match too broadly

**File**: `compiler/src/error-classifier.ts:83-89, 126-144`

**Description**: The 'logic' category patterns `/error/i`, `/failed/i`, `/exception/i` will match almost any error message, but the code iterates patterns in priority order and returns on first match. Due to the loop structure, these generic patterns may match before more specific patterns are checked.

**Code**:
```typescript
const categoryPriority: ErrorCategory[] = [
  'network', 'rate-limit', 'timeout', 'validation',
  'logic', // Fallback last
];

// But the loop structure:
for (const category of categoryPriority) {
  const patterns = errorPatterns[category];
  for (const pattern of patterns) {
    if (pattern.test(errorMessage)) {
      // Early logic check at line 132 tries to skip but logic is flawed
```

**Impact**: Error classification is correct but the skip logic at line 132 is confusing and may not work as intended in all cases.

**Recommendation**: Move 'logic' patterns to be checked only after all other categories fail, or restructure to check all specific patterns first.

---

### BUG-006: No validation of phaseId parameter in log endpoints

**Status**: ✅ **FIXED** (2026-01-20)

**File**: `compiler/src/status-server/server.ts:1295-1308`

**Description**: The `getLogFilePath` method sanitizes the phaseId but the regex replacement `[^a-zA-Z0-9-_]` with `_` may still allow crafted inputs to escape the logs directory through sequences like `..` being converted to `__`.

**Original Code**:
```typescript
private getLogFilePath(phaseId: string): string {
  const sanitized = phaseId.replace(/ > /g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(this.config.sprintDir, 'logs', `${sanitized}.log`);
}
```

**Fixed Code**:
```typescript
private getLogFilePath(phaseId: string): string {
  const sanitized = phaseId.replace(/ > /g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
  const logPath = path.join(this.config.sprintDir, 'logs', `${sanitized}.log`);

  // Defense-in-depth: verify path is within expected logs directory
  const resolved = path.resolve(logPath);
  const logsDir = path.resolve(this.config.sprintDir, 'logs');
  if (!resolved.startsWith(logsDir + path.sep)) {
    throw new Error('Invalid log path');
  }

  return logPath;
}
```

**Impact**: While the current sanitization prevents most path traversal, the lack of explicit path containment verification is a defense-in-depth issue.

**Resolution**: Added explicit path containment check using `path.resolve()` and prefix checking. Tests added in `server.test.ts`.

---

### BUG-007: writeProgressAtomic is async but uses sync file operations

**File**: `runtime/src/yaml-ops.ts:106-139`

**Description**: The function is declared `async` but uses `fs.writeFileSync` and `fs.renameSync`. This is not a bug per se, but misleading API design.

**Code**:
```typescript
export async function writeProgressAtomic(
  filePath: string,
  progress: CompiledProgress
): Promise<void> {
  // ...
  fs.writeFileSync(tempPath, content, 'utf8');  // Sync!
  fs.renameSync(tempPath, filePath);            // Sync!
  // ...
}
```

**Impact**: The async signature implies non-blocking behavior, but the function blocks the event loop during file I/O.

**Recommendation**: Either make the function truly async with `fs.promises.*`, or change the signature to sync and rename to `writeProgressAtomicSync`.

---

### BUG-008: advancePointer may return invalid pointer for edge cases

**File**: `runtime/src/transition.ts:346-416`

**Description**: When advancing pointer in a step with sub-phases that has just completed its last sub-phase, the code correctly advances to the next step and resets sub-phase to 0. However, if the new step has no sub-phases (empty phases array), setting sub-phase to 0 is invalid.

**Code**:
```typescript
// Try to advance step (reset sub-phase to 0)
const steps = phase?.steps;
if (steps && current.step < steps.length - 1) {
  return {
    nextPointer: { ...current, step: current.step + 1, 'sub-phase': 0 },
    hasMore: true,
  };
}
```

**Impact**: May create a pointer with `sub-phase: 0` when the step has no sub-phases, causing undefined behavior when dereferencing.

**Recommendation**: Check if the next step has sub-phases before setting `sub-phase: 0` vs `null`.

---

### BUG-009: Non-null assertion on potentially undefined steps array

**File**: `compiler/src/expand-foreach.ts:103`

**Description**: The code uses non-null assertion `phase.steps!` after checking `hasSteps`, but between the check and use, there's no guarantee another code path hasn't modified the value.

**Code**:
```typescript
const hasSteps = phase?.steps && phase.steps.length > 0;
const hasSubPhases = hasSteps && phase.steps![0].phases && phase.steps![0].phases.length > 0;
```

**Impact**: TypeScript non-null assertions bypass safety checks; if assumptions are violated at runtime, will throw.

**Recommendation**: Use explicit null checks: `phase.steps?.[0]?.phases` instead of assertions.

---

### BUG-010: Signal files not cleaned up on sprint completion

**Status**: ✅ **FIXED** (2026-01-20)

**File**: `compiler/src/status-server/server.ts:896-989`

**Description**: The status server creates signal files (.pause-requested, .resume-requested, .stop-requested, .force-retry-requested) in response to API calls, but there was no cleanup mechanism when the sprint completes normally or abnormally.

**Original Problem**:
```typescript
const signalPath = path.join(this.config.sprintDir, '.pause-requested');
fs.writeFileSync(signalPath, new Date().toISOString());
// No cleanup on sprint completion
```

**Impact**: Leftover signal files could cause unexpected behavior if a sprint is restarted or if the directory is reused.

**Resolution**: Added `cleanupSignalFiles()` method that removes all signal files. This method is called:
1. On server `start()` - to clean up leftover files from crashed sprints
2. On server `stop()` - to clean up files when sprint completes

**Fixed Code**:
```typescript
// Signal file names defined as constants (lines 79-88)
const SIGNAL_FILES = {
  PAUSE: '.pause-requested',
  RESUME: '.resume-requested',
  STOP: '.stop-requested',
  FORCE_RETRY: '.force-retry-requested',
} as const;

// Cleanup method (lines 1642-1651)
private cleanupSignalFiles(): void {
  for (const signal of Object.values(SIGNAL_FILES)) {
    const signalPath = path.join(this.config.sprintDir, signal);
    try {
      fs.unlinkSync(signalPath);
    } catch {
      // Ignore errors (file may not exist)
    }
  }
}

// Called on start() - line 142
// Clean up any leftover signal files from crashed sprints
this.cleanupSignalFiles();

// Called on stop() - lines 206-208
async stop(): Promise<void> {
  // Clean up signal files
  this.cleanupSignalFiles();
  // ...
}
```

**Tests Added**: `server.test.ts` includes:
- `BUG-010: StatusServer should have cleanupSignalFiles method`
- `BUG-010: stop() method should call cleanupSignalFiles`
- `BUG-010: signal files should be removed when server stops`
- `BUG-010: leftover signal files should be cleaned on server start`

---

### BUG-011: Negative page parameter causes incorrect pagination results

**File**: `compiler/src/status-server/server.ts:516-537`

**Description**: The `/api/sprints` endpoint accepts a negative `page` parameter without validation, causing incorrect pagination behavior.

**Reproduction**:
```bash
curl "http://localhost:3100/api/sprints?page=-1"
```

**Expected**: Error response or page coerced to 1

**Actual**:
```json
{
  "sprints": [],
  "total": 1,
  "page": -1,
  "limit": 20,
  "hasMore": true  // Logically incorrect
}
```

**Code**:
```typescript
const page = parseInt(params.get('page') || '1', 10);
const limit = parseInt(params.get('limit') || '20', 10);
const offset = (page - 1) * limit;  // With page=-1, offset = -40

// Apply pagination
const sprints = allSprints.slice(offset, offset + limit);  // slice(-40, -20) returns []
```

**Impact**: API returns empty results with misleading metadata when negative page is provided. `hasMore: true` is incorrect since there are no more results.

**Recommendation**: Validate page >= 1 and limit >= 1 with sensible bounds, or return 400 Bad Request for invalid values.

---

### BUG-012: Path traversal sanitization lacks explicit containment check

**Status**: ✅ **FIXED** (2026-01-20) - Same fix as BUG-006

**File**: `compiler/src/status-server/server.ts:1295-1308`

**Description**: While the `getLogFilePath` method sanitizes path components, it doesn't perform an explicit check that the resulting path is within the expected directory.

**Reproduction**:
```bash
curl "http://localhost:3100/api/logs/..%2F..%2Fetc%2Fpasswd"
```

**Current sanitization result**: Converts `../../etc/passwd` to `______etc_passwd.log`

**Resolution**: Added defense-in-depth path containment verification. See BUG-006 for implementation details.

---

### BUG-013: Delay parameter accepts negative values without validation

**File**: `runtime/src/cli.ts:105-109`

**Description**: The CLI accepts negative values for `--delay` parameter without validation, which could cause unpredictable sleep behavior.

**Reproduction**:
```bash
node plugins/m42-sprint/runtime/dist/cli.js run ./sprint -d -5000
```

**Code**:
```typescript
} else if (arg === '--delay' || arg === '-d') {
  const value = cliArgs[++i];
  if (value !== undefined) {
    result.options.delay = parseInt(value, 10);
    // No validation that delay is non-negative
  }
}
```

**Impact**: While `setTimeout` with negative value is equivalent to `setTimeout(fn, 0)`, allowing negative values is semantically confusing and may lead to unexpected rapid iteration.

**Recommendation**: Validate delay is non-negative: `if (parsed < 0) { result.error = 'Delay must be non-negative'; }`

---

### BUG-014: Page=0 returns empty results with hasMore=true

**File**: `compiler/src/status-server/server.ts:516-537`

**Description**: Similar to BUG-011, the `/api/sprints` endpoint accepts `page=0` without validation, causing incorrect pagination behavior.

**Reproduction**:
```bash
curl "http://localhost:3200/api/sprints?page=0"
```

**Expected**: Error response or page coerced to 1

**Actual**:
```json
{
  "sprints": [],
  "total": 13,
  "page": 0,
  "limit": 20,
  "hasMore": true  // Incorrect - implies more data exists when page 0 is invalid
}
```

**Impact**: Page 0 is semantically invalid (pages should be 1-indexed) but is accepted silently, returning misleading metadata.

**Recommendation**: Add validation: `if (page < 1) page = 1;` or return 400 Bad Request.

---

### BUG-015: Non-numeric page parameter returns page: null instead of error

**File**: `compiler/src/status-server/server.ts:524`

**Description**: When a non-numeric string is passed as the `page` parameter, `parseInt` returns `NaN`, which becomes `null` in JSON serialization.

**Reproduction**:
```bash
curl "http://localhost:3200/api/sprints?page=abc"
```

**Expected**: Error response indicating invalid parameter

**Actual**:
```json
{
  "sprints": [],
  "total": 13,
  "page": null,  // NaN serialized as null
  "limit": 20,
  "hasMore": false
}
```

**Code**:
```typescript
const page = parseInt(params.get('page') || '1', 10);  // Returns NaN for "abc"
const offset = (page - 1) * limit;  // NaN - 1 * 20 = NaN
const sprints = allSprints.slice(offset, offset + limit);  // slice(NaN, NaN) = []
```

**Impact**: Invalid input silently produces null in response rather than a clear error message.

**Recommendation**: Add NaN check: `if (isNaN(page)) { return res.status(400).json({ error: 'Invalid page parameter' }); }`

---

### BUG-016: Negative limit parameter returns more results than expected

**File**: `compiler/src/status-server/server.ts:525`

**Description**: The `/api/sprints` endpoint accepts negative `limit` values, which causes `Array.slice()` to use JavaScript's negative index behavior, potentially returning unexpected results.

**Reproduction**:
```bash
curl "http://localhost:3200/api/sprints?limit=-5"
```

**Expected**: Error response or limit coerced to positive value

**Actual**: Returns 8 sprints (with page=1, offset=0, limit=-5), because `slice(0, -5)` returns all but the last 5 elements.
```json
{
  "sprints": [...8 items...],
  "total": 13,
  "page": 1,
  "limit": -5,
  "hasMore": true  // Also misleading
}
```

**Code**:
```typescript
const limit = parseInt(params.get('limit') || '20', 10);
const sprints = allSprints.slice(offset, offset + limit);  // slice(0, 0 + (-5)) = slice(0, -5)
```

**Impact**: Negative limits produce counterintuitive results. `hasMore: true` is also misleading since we're already showing most of the data.

**Recommendation**: Validate limit bounds: `if (limit < 1) limit = 20; if (limit > 100) limit = 100;`
