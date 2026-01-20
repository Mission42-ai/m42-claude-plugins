# Bugs Discovered

## BUG-001: Workflow Cache Staleness

**Status**: FIXED

**Severity**: medium

**Feature**: compiler

**File**: `compiler/src/resolve-workflows.ts:20-38`

### Issue Description

Module-level workflow cache persists across compilations. In watch mode or long-running processes, modified workflow files use stale cached versions.

### Original Code

```typescript
const workflowCache = new Map<string, LoadedWorkflow>();

export function loadWorkflow(name: string, workflowsDir: string, errors?: CompilerError[]): LoadedWorkflow | null {
  const cacheKey = `${workflowsDir}:${name}`;
  if (workflowCache.has(cacheKey)) {
    return workflowCache.get(cacheKey)!;
  }
  // ... loads and caches
}
```

### Root Cause

The workflow cache (`workflowCache`) is a module-level `Map` that persists for the lifetime of the Node.js process. When users modify workflow YAML files between compilations (common in watch mode or iterative development), the cache returns stale data because:

1. Cache lookups happen before any file read
2. No cache invalidation mechanism existed
3. No mtime checking was implemented

### Solution Implemented

Added `clearWorkflowCache()` function and called it at the start of `compile()`:

**resolve-workflows.ts** (lines 169-174):
```typescript
/**
 * Clear the workflow cache (useful for testing)
 */
export function clearWorkflowCache(): void {
  workflowCache.clear();
}
```

**compile.ts** (lines 83-84):
```typescript
// Clear workflow cache at compilation start to prevent stale data in watch mode
clearWorkflowCache();
```

### Tests Added

**File**: `compiler/src/resolve-workflows.test.ts`

Three comprehensive tests:

1. `testCompileClearsCache()` - Verifies multiple compile() calls pick up workflow changes
2. `testLoadWorkflowCachingBehavior()` - Documents that loadWorkflow() caching is expected (low-level)
3. `testClearWorkflowCache()` - Verifies clearWorkflowCache() resets the cache correctly

### Verification

All tests pass:
- `compiler/dist/resolve-workflows.test.js`: 3/3 passed
- `compiler/dist/validate.test.js`: 9/9 passed
- `compiler/dist/types.test.js`: 46/46 passed
- `compiler/dist/compiler.e2e.test.js`: 5/5 passed
- `compiler/dist/status-server/server.test.js`: 12/12 passed
- Runtime tests: All passing

### Follow-up Items

None required. The fix is minimal, safe, and well-tested.

---

## BUG-011: Negative Page Returns Incorrect Results

**Status**: FIXED

**Severity**: medium

**Feature**: status-server

**File**: `compiler/src/status-server/server.ts:556-606`

### Issue Description

When requesting `/api/sprints?page=-1`, the server returns an empty result set with misleading metadata (`hasMore: true`, `page: -1`). This occurs because negative page values create negative offsets, causing `Array.slice()` to behave unexpectedly.

### Original Code

```typescript
const page = parseInt(params.get('page') || '1', 10);
const limit = parseInt(params.get('limit') || '20', 10);
const offset = (page - 1) * limit;
const sprints = allSprints.slice(offset, offset + limit);
```

### Root Cause

No validation was performed on pagination parameters. When `page=-1`:
- `offset = (-1 - 1) * 20 = -40`
- `slice(-40, -20)` returns unexpected results from the end of the array
- Metadata shows `page: -1` which is semantically invalid

### Verification

- Manual test: `GET /api/sprints?page=-1` returns HTTP 400 with `{"error":"page must be a positive integer"}`
- Unit test: `server.test.ts` - "BUG-011: negative page should return error"
- Integration test: "BUG-011/014/015/016: Server API should return 400 for invalid pagination"

---

## BUG-014: Page=0 Returns Empty Results

**Status**: FIXED

**Severity**: medium

**Feature**: status-server

**File**: `compiler/src/status-server/server.ts:556-606`

### Issue Description

When requesting `/api/sprints?page=0`, the server returns an empty result set with confusing metadata (`page: 0`). This occurs because page=0 creates a negative offset.

### Original Code

Same as BUG-011 - no validation on `page` parameter.

### Root Cause

When `page=0`:
- `offset = (0 - 1) * 20 = -20`
- `slice(-20, 0)` returns empty array
- Metadata shows `page: 0` which is semantically invalid (pages are 1-indexed)

### Verification

- Manual test: `GET /api/sprints?page=0` returns HTTP 400 with `{"error":"page must be a positive integer"}`
- Unit test: `server.test.ts` - "BUG-014: page=0 should return error"
- Integration test: "BUG-011/014/015/016: Server API should return 400 for invalid pagination"

---

## BUG-015: Non-numeric Page Returns Null

**Status**: FIXED

**Severity**: medium

**Feature**: status-server

**File**: `compiler/src/status-server/server.ts:556-606`

### Issue Description

When requesting `/api/sprints?page=abc`, the server returns a result with `page: null` (NaN serialized to JSON). This causes client-side confusion and potential crashes.

### Original Code

Same as BUG-011 - no validation on `page` parameter.

### Root Cause

- `parseInt('abc', 10)` returns `NaN`
- `offset = (NaN - 1) * 20 = NaN`
- `slice(NaN, NaN)` returns empty array
- JSON serialization of `NaN` produces `null`

### Verification

- Manual test: `GET /api/sprints?page=abc` returns HTTP 400 with `{"error":"page must be a positive integer"}`
- Unit test: `server.test.ts` - "BUG-015: non-numeric page should return error"
- Integration test: "BUG-011/014/015/016: Server API should return 400 for invalid pagination"

---

## BUG-016: Negative Limit Causes Unexpected Behavior

**Status**: FIXED

**Severity**: medium

**Feature**: status-server

**File**: `compiler/src/status-server/server.ts:556-606`

### Issue Description

When requesting `/api/sprints?limit=-5`, the server returns an empty result set with `limit: -5`. This also exposes the system to potential DoS via extremely large `limit` values.

### Original Code

Same as BUG-011 - no validation on `limit` parameter.

### Root Cause

- Negative `limit` creates invalid slice ranges
- No upper bound on `limit` allows requests like `limit=1000000`
- Response metadata shows invalid values

### Solution Implemented

Added `validatePagination()` utility function and applied to `/api/sprints` endpoint:

**server.ts** (lines 100-111):
```typescript
/**
 * Validate pagination parameters from query string
 * Returns validated page/limit or an error message
 *
 * Constraints:
 * - page: must be a positive integer (>= 1)
 * - limit: must be between 1 and 100 (prevents excessive memory usage)
 *
 * Fixes: BUG-011 (negative page), BUG-014 (page=0), BUG-015 (non-numeric), BUG-016 (negative limit)
 */
function validatePagination(params: URLSearchParams): { page: number; limit: number } | { error: string } {
  const pageStr = params.get('page') || '1';
  const limitStr = params.get('limit') || '20';

  const page = parseInt(pageStr, 10);
  const limit = parseInt(limitStr, 10);

  if (isNaN(page) || page < 1) return { error: 'page must be a positive integer' };
  if (isNaN(limit) || limit < 1 || limit > 100) return { error: 'limit must be between 1 and 100' };

  return { page, limit };
}
```

**server.ts** (lines 556-563):
```typescript
private handleSprintsApiRequest(res: http.ServerResponse, params: URLSearchParams): void {
  // Validate pagination parameters first
  const pagination = validatePagination(params);
  if ('error' in pagination) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: pagination.error }));
    return;
  }
  // ... rest of handler uses pagination.page and pagination.limit
}
```

### Tests Added

**File**: `compiler/src/status-server/server.test.ts`

Tests added (lines 492-829):
1. `BUG-011: negative page should return error, not empty results with hasMore: true`
2. `BUG-014: page=0 should return error, not empty results`
3. `BUG-015: non-numeric page should return error, not page: null/NaN`
4. `BUG-016: negative limit should return error, not unexpected results`
5. `BUG-016: limit > 100 should be rejected or capped`
6. `BUG-011/014/015/016: Server API should return 400 for invalid pagination`
7. `Valid pagination parameters should work correctly`

### Verification

All tests pass:
- `node dist/status-server/server.test.js`: 20/20 passed
- Manual verification of all edge cases via HTTP requests
- Response structure verified for valid requests

### Follow-up Items

None required. The fix is comprehensive and covers all edge cases.

---

## BUG-003: --max-iterations Accepts Non-Numeric Values

**Status**: FIXED

**Severity**: low

**Feature**: runtime/cli

**File**: `runtime/src/cli.ts:111-120`

### Issue Description

The `--max-iterations` CLI flag accepts non-numeric values like `"abc"`, resulting in `NaN` being stored. This causes unexpected behavior when the loop checks iteration count (e.g., `iteration < maxIterations` is always false when `maxIterations` is `NaN`).

### Original Code

```typescript
if (arg === '--max-iterations' || arg === '-n') {
  const value = cliArgs[++i];
  if (value !== undefined) {
    result.options.maxIterations = parseInt(value, 10);
    // No NaN check
  }
}
```

### Root Cause

`parseInt('abc', 10)` returns `NaN`, which was stored directly without validation. The same issue affected:
- Empty strings: `parseInt('', 10)` returns `NaN`
- Negative values: `parseInt('-5', 10)` returns `-5` (semantically invalid for iteration count)

### Solution Implemented

Added `parseNonNegativeInt()` validation helper and applied to all numeric parameters:

**cli.ts** (lines 49-54):
```typescript
/**
 * Parse and validate a non-negative integer parameter.
 * @returns The parsed number, or an error message string if invalid.
 */
function parseNonNegativeInt(value: string, paramName: string): number | string {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return `Invalid number for ${paramName}: "${value}"`;
  if (parsed < 0) return `${paramName} must be non-negative`;
  return parsed;
}
```

**cli.ts** (lines 111-120):
```typescript
if (arg === '--max-iterations' || arg === '-n') {
  const value = cliArgs[++i];
  if (value !== undefined) {
    const parsed = parseNonNegativeInt(value, 'max-iterations');
    if (typeof parsed === 'string') {
      result.error = parsed;
      return result;
    }
    result.options.maxIterations = parsed;
  }
}
```

### Tests Added

**File**: `runtime/src/cli.test.ts` (lines 489-603)

Tests added:
1. `BUG-003: should error when --max-iterations receives non-numeric value`
2. `BUG-003: should error when -n receives non-numeric value`
3. `BUG-003: should error when --max-iterations receives empty string`
4. `BUG-003: should error when --max-iterations receives negative value`
5. `Valid numeric parameters should still work after fix`
6. `Zero values should be valid for both parameters`

### Verification

- Manual test: `parseArgs(['node', 'cli.js', 'run', '/path', '-n', 'abc'])` returns `error: "Invalid number for max-iterations: \"abc\""`
- All CLI tests pass: 39/39 passed

---

## BUG-013: --delay Accepts Negative Values

**Status**: FIXED

**Severity**: low

**Feature**: runtime/cli

**File**: `runtime/src/cli.ts:121-130`

### Issue Description

The `--delay` CLI flag accepts negative values like `-1000`, which don't make sense semantically (negative delay between iterations). This also had the same NaN vulnerability as BUG-003.

### Original Code

```typescript
} else if (arg === '--delay' || arg === '-d') {
  const value = cliArgs[++i];
  if (value !== undefined) {
    result.options.delay = parseInt(value, 10);
    // No validation
  }
}
```

### Root Cause

- `parseInt('-1000', 10)` returns `-1000` (semantically invalid for delay)
- `parseInt('fast', 10)` returns `NaN` (same as BUG-003)

### Solution Implemented

Reused the same `parseNonNegativeInt()` helper from BUG-003:

**cli.ts** (lines 121-130):
```typescript
} else if (arg === '--delay' || arg === '-d') {
  const value = cliArgs[++i];
  if (value !== undefined) {
    const parsed = parseNonNegativeInt(value, 'delay');
    if (typeof parsed === 'string') {
      result.error = parsed;
      return result;
    }
    result.options.delay = parsed;
  }
}
```

### Tests Added

**File**: `runtime/src/cli.test.ts` (lines 533-572)

Tests added:
1. `BUG-013: should error when --delay receives negative value`
2. `BUG-013: should error when -d receives negative value`
3. `BUG-013: should error when --delay receives non-numeric value`

### Verification

- Manual test: `parseArgs(['node', 'cli.js', 'run', '/path', '-d', '-1000'])` returns `error: "delay must be non-negative"`
- Manual test: `parseArgs(['node', 'cli.js', 'run', '/path', '-d', 'fast'])` returns `error: "Invalid number for delay: \"fast\""`
- All CLI tests pass: 39/39 passed

### Follow-up Items

None required. The fix is minimal and comprehensive, using a shared validation helper for all numeric CLI parameters.

---

## BUG-007: Async/Sync API Consistency

**Status**: FIXED

**Severity**: low

**Feature**: runtime/yaml-ops

**File**: `runtime/src/yaml-ops.ts:106-139`

### Issue Description

`writeProgressAtomic` is declared `async` and returns `Promise<void>`, but internally uses synchronous `fs.writeFileSync` and `fs.renameSync`. This misleads callers into thinking the function yields to the event loop during I/O, when it actually blocks.

### Original Code

```typescript
export async function writeProgressAtomic(
  filePath: string,
  progress: CompiledProgress
): Promise<void> {
  const content = yaml.dump(progress, { ... });
  const tempPath = getTempPath(filePath);
  const checksumPath = getChecksumPath(filePath);

  try {
    // BLOCKING - blocks event loop
    fs.writeFileSync(tempPath, content, 'utf8');

    // BLOCKING - blocks event loop
    fs.renameSync(tempPath, filePath);

    const checksum = calculateChecksum(content);
    fs.writeFileSync(checksumPath, checksum, 'utf8');
  } finally {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch { /* ignore */ }
  }
}
```

### Root Cause

The function was declared `async` for API consistency (to allow future async operations) but used synchronous fs operations for simplicity. This created a contract mismatch:

1. Callers expect `await writeProgressAtomic()` to yield during I/O
2. Actually, the function runs synchronously and blocks the event loop
3. Concurrent writes don't truly parallelize - they serialize unexpectedly

### Solution Implemented

Changed all fs operations to use `fs.promises` API for truly asynchronous I/O:

**yaml-ops.ts** (lines 106-138):
```typescript
export async function writeProgressAtomic(
  filePath: string,
  progress: CompiledProgress
): Promise<void> {
  const content = yaml.dump(progress, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  const tempPath = getTempPath(filePath);
  const checksumPath = getChecksumPath(filePath);

  try {
    // Write to temp file first
    await fs.promises.writeFile(tempPath, content, 'utf8');

    // Atomic rename (atomic on POSIX)
    await fs.promises.rename(tempPath, filePath);

    // Calculate and write checksum
    const checksum = calculateChecksum(content);
    await fs.promises.writeFile(checksumPath, checksum, 'utf8');
  } finally {
    // Clean up temp file if it still exists
    try {
      await fs.promises.access(tempPath);
      await fs.promises.unlink(tempPath);
    } catch {
      // Ignore cleanup errors (file doesn't exist or other issues)
    }
  }
}
```

### Tests Added

**File**: `runtime/src/yaml-ops.test.ts` (lines 731-838)

Two tests verify the fix:

1. **`BUG-007: writeProgressAtomic should use fs.promises (truly async I/O)`**
   - Tests microtask timing to verify the function doesn't complete synchronously
   - A truly async function with I/O yields to the event loop
   - The sync version would complete in the same microtask as the call

2. **`BUG-007: concurrent writeProgressAtomic calls should not serialize (async I/O)`**
   - Tests that multiple concurrent writes allow event loop yields
   - With truly async I/O, `setInterval` callbacks fire during the writes
   - With sync I/O, the event loop is blocked and no callbacks fire

### Verification

All tests pass:
```
✓ BUG-007: writeProgressAtomic should use fs.promises (truly async I/O)
✓ BUG-007: concurrent writeProgressAtomic calls should not serialize (async I/O)
```

Full test suite: 31/31 loop tests, 35/35 yaml-ops tests, all other modules passing.

### Follow-up Items

None required. The fix is minimal, maintains the same API contract, and all callers were already correctly awaiting the function.

---

## BUG-005: Error Classifier Pattern Ordering

**Status**: NOT A BUG (Code Clarity Issue Only)

**Severity**: low

**Feature**: compiler/error-classifier

**File**: `compiler/src/error-classifier.ts:83-89, 126-144`

### Issue Description

The initial report suggested that the 'logic' category has overly broad patterns (`/error/i`, `/failed/i`) that could match before more specific patterns due to loop structure.

### Investigation

Careful code review and comprehensive testing revealed that the implementation is **correct as designed**.

### Why This Is Not A Bug

1. **Priority ordering is correct** (lines 94-100):
   ```typescript
   const categoryPriority: ErrorCategory[] = [
     'network', 'rate-limit', 'timeout', 'validation', 'logic' // 'logic' is last
   ];
   ```

2. **Loop structure ensures correct behavior** (lines 127-138):
   ```typescript
   for (const category of categoryPriority) {  // Iterates in priority order
     const patterns = errorPatterns[category];
     for (const pattern of patterns) {
       if (pattern.test(errorMessage)) {
         return { ... };  // Returns immediately on first match
       }
     }
   }
   ```

3. **The broad 'logic' patterns** (`/error/i`, `/failed/i`, `/exception/i`) are intentionally broad fallbacks. They are only checked **after** all specific categories (network, rate-limit, timeout, validation) have been tried and found no match.

### Test Verification

14 comprehensive tests were created/exist to verify correct behavior:

```
✓ BUG-005: network error containing "error" should match network, not logic
✓ BUG-005: validation failed should match validation, not logic
✓ BUG-005: connection failed should match network, not logic
✓ BUG-005: rate limit error should match rate-limit, not logic
✓ BUG-005: timeout exception should match timeout, not logic
✓ BUG-005: DNS failed error should match network, not logic
✓ BUG-005: schema validation error should match validation, not logic
✓ BUG-005: generic error should match logic category
✓ BUG-005: generic failure should match logic category
✓ BUG-005: specific category should have high confidence
✓ BUG-005: logic category should have lower confidence
✓ BUG-005: loop order ensures specific patterns are checked before logic fallback
✓ BUG-005: REGRESSION - messages with multiple category keywords should match most specific
✓ BUG-005: CODE CLARITY - implementation is clean and straightforward
```

### Conclusion

The code is working as intended. The 'logic' category correctly serves as a fallback that only matches errors that don't fit into any specific category. The test suite documents this expected behavior and provides regression protection.

### Follow-up Items

None required. The tests added during investigation serve as documentation and regression protection for the expected behavior.
