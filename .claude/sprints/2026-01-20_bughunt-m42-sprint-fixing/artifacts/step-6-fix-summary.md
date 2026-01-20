# Fix Summary: BUG-011 + BUG-014 + BUG-015 + BUG-016 - Pagination Parameter Validation

## Root Cause

The `/api/sprints` endpoint in `server.ts` parsed pagination parameters using `parseInt()` without any validation:

```typescript
const page = parseInt(params.get('page') || '1', 10);
const limit = parseInt(params.get('limit') || '20', 10);
const offset = (page - 1) * limit;
const sprints = allSprints.slice(offset, offset + limit);
```

This created four distinct failure modes:

1. **BUG-011**: Negative page (e.g., `page=-5`) → negative offset causing `slice()` to return data from the end of array
2. **BUG-014**: Page=0 → offset = -20, `slice(-20, 0)` returns empty array with misleading metadata
3. **BUG-015**: Non-numeric page (e.g., `page=abc`) → `parseInt()` returns `NaN`, serialized as `null` in JSON
4. **BUG-016**: Negative limit → unexpected `slice()` behavior; no upper bound allowed potential DoS

## Solution Implemented

**Approach**: Add a centralized validation utility function that returns either validated parameters or an error

### Code Changes

**File: `compiler/src/status-server/server.ts`**

Added `validatePagination()` utility function at lines 100-111:

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

Updated `handleSprintsApiRequest()` at lines 556-563 to use the validation:

```typescript
private handleSprintsApiRequest(res: http.ServerResponse, params: URLSearchParams): void {
  // Validate pagination parameters first
  const pagination = validatePagination(params);
  if ('error' in pagination) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: pagination.error }));
    return;
  }

  try {
    const sprintsDir = this.getSprintsDir();
    const includeWorktreeInfo = params.get('includeWorktree') === 'true';
    const scanner = new SprintScanner(sprintsDir, { includeWorktreeInfo });
    const allSprints = scanner.scan();

    // Apply pagination
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    const sprints = allSprints.slice(offset, offset + limit);
    // ... rest of response building
```

## Tests Added

**File: `compiler/src/status-server/server.test.ts`**

Added comprehensive tests at lines 492-829:

1. **BUG-011**: `negative page should return error, not empty results with hasMore: true`
2. **BUG-014**: `page=0 should return error, not empty results`
3. **BUG-015**: `non-numeric page should return error, not page: null/NaN`
4. **BUG-016**: `negative limit should return error, not unexpected results`
5. **BUG-016**: `limit > 100 should be rejected or capped`
6. **Integration**: `Server API should return 400 for invalid pagination`
7. **Regression**: `Valid pagination parameters should work correctly`

## Test Results

```
--- BUG-011/014/015/016: Pagination Parameter Validation Tests ---
✓ BUG-011: negative page should return error, not empty results with hasMore: true
✓ BUG-014: page=0 should return error, not empty results
✓ BUG-015: non-numeric page should return error, not page: null/NaN
✓ BUG-016: negative limit should return error, not unexpected results
✓ BUG-016: limit > 100 should be rejected or capped
✓ Valid pagination parameters should work correctly

BUG-011/014/015/016 pagination validation tests completed.
✓ BUG-010: signal files should be removed when server stops
✓ BUG-010: leftover signal files should be cleaned on server start
✓ BUG-011/014/015/016: Server API should return 400 for invalid pagination
```

All 20 server tests pass.

## Manual Verification

Ran comprehensive HTTP request tests against live server:

```
--- BUG-011: Negative page ---
✓ page=-1: status=400 (expected 400)
✓ page=-100: status=400 (expected 400)

--- BUG-014: Page=0 ---
✓ page=0: status=400 (expected 400)

--- BUG-015: Non-numeric page ---
✓ page=abc: status=400 (expected 400)
✓ page=null: status=400 (expected 400)

--- BUG-016: Negative/invalid limit ---
✓ limit=-1: status=400 (expected 400)
✓ limit=0: status=400 (expected 400)
✓ limit=101: status=400 (expected 400)
✓ limit=1000: status=400 (expected 400)
✓ limit=abc: status=400 (expected 400)

--- Valid requests should still work ---
✓ page=1: status=200 (expected 200)
✓ page=1&limit=10: status=200 (expected 200)
✓ page=2&limit=50: status=200 (expected 200)
✓ limit=100 (max): status=200 (expected 200)
✓ defaults: status=200 (expected 200)

--- Sample error response body ---
Status: 400
Body: {"error":"page must be a positive integer"}
```

## Edge Cases Considered

1. **Very large page numbers** (e.g., `page=999999`): Returns 200 with empty `sprints` array and `hasMore: false` - this is valid behavior
2. **Infinity/NaN strings**: Both `page=Infinity` and `page=NaN` correctly return 400
3. **Whitespace**: `page= ` (space only) returns 400
4. **Trailing characters**: `page=1 ` with trailing space is accepted (parseInt behavior) - acceptable edge case
5. **Combined invalid params**: First invalid param triggers error (page checked before limit)

## Risk Assessment

| Factor | Rating | Notes |
|--------|--------|-------|
| Fix Complexity | Low | Single utility function + one usage site |
| Test Coverage | High | 7 new tests covering all edge cases |
| Regression Risk | Low | Only affects invalid inputs |
| Performance Impact | None | Simple integer validation |
| Breaking Change | Yes, intentional | Clients sending invalid params now get 400 instead of unpredictable results |

## Performance Impact

Negligible. The validation adds:
- Two `parseInt()` calls (already being done)
- Two `isNaN()` checks
- Four integer comparisons

This is O(1) constant time work with no memory allocation.

## Follow-up Items

1. **Future endpoints**: The `validatePagination()` function should be applied to any future paginated endpoints for consistency
2. **API documentation**: Should document valid ranges:
   - `page`: positive integer >= 1 (default: 1)
   - `limit`: integer 1-100 (default: 20)
3. **Client updates**: Any clients that accidentally sent invalid params will now receive proper error responses

## Summary

The fix is:
- **Minimal**: Single function addition + one call site change
- **Focused**: Only affects invalid input handling
- **Well-tested**: 7 new tests + manual verification
- **Low risk**: No changes to valid request handling
- **Consistent**: Error response format matches existing error responses
- **Backwards compatible**: Valid requests work identically
