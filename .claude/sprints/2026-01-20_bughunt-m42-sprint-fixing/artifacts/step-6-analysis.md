# Bug Analysis: BUG-011 + BUG-014 + BUG-015 + BUG-016 - Pagination Parameter Validation

## Root Cause Analysis

### Location
- **File**: `plugins/m42-sprint/compiler/src/status-server/server.ts`
- **Function**: `handleSprintsApiRequest()`
- **Lines**: 541-554 (pagination parameter parsing and application)

### Root Cause
The pagination parameter parsing at lines 541-542 uses `parseInt()` directly without validation:

```typescript
const page = parseInt(params.get('page') || '1', 10);
const limit = parseInt(params.get('limit') || '20', 10);
const offset = (page - 1) * limit;
const sprints = allSprints.slice(offset, offset + limit);
```

This code has **four distinct failure modes**:

1. **BUG-011: Negative page values** → `parseInt("-5")` returns `-5`, causing `offset = (-5 - 1) * 20 = -120`, making `slice(-120, -100)` return unexpected results with `hasMore: true` being misleading.

2. **BUG-014: Page=0** → `offset = (0 - 1) * 20 = -20`, making `slice(-20, 0)` return empty array, while metadata claims valid pagination.

3. **BUG-015: Non-numeric page** → `parseInt("abc")` returns `NaN`, causing `page: NaN` in response (serialized as `null` in JSON).

4. **BUG-016: Negative limit** → `parseInt("-10")` returns `-10`, causing `slice(offset, offset + (-10))` to return unexpected results due to negative end index.

### Trigger Conditions

| Bug ID | Trigger | Example Request | Incorrect Behavior |
|--------|---------|-----------------|-------------------|
| BUG-011 | `page < 0` | `GET /api/sprints?page=-5` | Empty results, `hasMore: true` |
| BUG-014 | `page = 0` | `GET /api/sprints?page=0` | Empty results, misleading metadata |
| BUG-015 | Non-numeric | `GET /api/sprints?page=abc` | `page: null` in response |
| BUG-016 | `limit < 0` | `GET /api/sprints?limit=-10` | Unexpected slice behavior |

### Code Flow for Each Bug

**BUG-011 (Negative page):**
```
1. Request: GET /api/sprints?page=-5
2. parseInt("-5") = -5
3. offset = (-5 - 1) * 20 = -120
4. allSprints.slice(-120, -100)
   - If array has <120 items: returns from start
   - hasMore = -100 < total → true (misleading!)
```

**BUG-014 (Page zero):**
```
1. Request: GET /api/sprints?page=0
2. parseInt("0") = 0
3. offset = (0 - 1) * 20 = -20
4. allSprints.slice(-20, 0) → [] (always empty!)
5. Response shows page: 0 with empty results
```

**BUG-015 (Non-numeric):**
```
1. Request: GET /api/sprints?page=abc
2. parseInt("abc") = NaN
3. offset = (NaN - 1) * 20 = NaN
4. allSprints.slice(NaN, NaN) → [] (empty)
5. JSON.stringify({page: NaN}) → {page: null}
```

**BUG-016 (Negative limit):**
```
1. Request: GET /api/sprints?limit=-10
2. parseInt("-10") = -10
3. offset = 0, end = 0 + (-10) = -10
4. allSprints.slice(0, -10) → all except last 10!
5. Arbitrary data returned, unintended behavior
```

## What Tests Should Verify

### Test 1: Negative Page Returns 400 Error
**Purpose**: Verify invalid page values are rejected
```
1. Start server with test sprint data
2. Request: GET /api/sprints?page=-1
3. VERIFY: Response status = 400
4. VERIFY: Response body contains error message about page validation
```

### Test 2: Page Zero Returns 400 Error
**Purpose**: Verify page=0 is rejected (pages are 1-indexed)
```
1. Start server with test sprint data
2. Request: GET /api/sprints?page=0
3. VERIFY: Response status = 400
4. VERIFY: Error message indicates page must be >= 1
```

### Test 3: Non-Numeric Page Returns 400 Error
**Purpose**: Verify non-numeric values are rejected
```
1. Start server with test sprint data
2. Request: GET /api/sprints?page=abc
3. VERIFY: Response status = 400
4. VERIFY: Error message indicates page must be a positive integer
```

### Test 4: Negative Limit Returns 400 Error
**Purpose**: Verify negative limit is rejected
```
1. Start server with test sprint data
2. Request: GET /api/sprints?limit=-5
3. VERIFY: Response status = 400
4. VERIFY: Error message about limit validation
```

### Test 5: Limit Exceeding Maximum Returns 400 Error
**Purpose**: Verify excessive limit values are capped/rejected
```
1. Start server with test sprint data
2. Request: GET /api/sprints?limit=1000
3. VERIFY: Either 400 error OR limit capped to 100
```

### Test 6: Valid Pagination Works Correctly
**Purpose**: Ensure fix doesn't break valid requests
```
1. Create 50 test sprints
2. Request: GET /api/sprints?page=2&limit=10
3. VERIFY: Returns items 11-20
4. VERIFY: page=2, limit=10, hasMore=true (if total > 20)
```

### Test 7: Empty Results on Valid High Page
**Purpose**: Verify correct behavior for valid but out-of-range page
```
1. Create 5 test sprints
2. Request: GET /api/sprints?page=100&limit=10
3. VERIFY: Returns empty array (valid response)
4. VERIFY: hasMore=false
5. VERIFY: page=100 (valid number, not null)
```

## Recommended Fix

**Create a pagination validation utility function:**

```typescript
interface PaginationResult {
  page: number;
  limit: number;
}

interface PaginationError {
  error: string;
}

function validatePagination(params: URLSearchParams): PaginationResult | PaginationError {
  const pageStr = params.get('page') || '1';
  const limitStr = params.get('limit') || '20';

  const page = parseInt(pageStr, 10);
  const limit = parseInt(limitStr, 10);

  if (isNaN(page) || page < 1) {
    return { error: 'page must be a positive integer' };
  }
  if (isNaN(limit) || limit < 1 || limit > 100) {
    return { error: 'limit must be between 1 and 100' };
  }

  return { page, limit };
}
```

**Apply to handleSprintsApiRequest():**

```typescript
private handleSprintsApiRequest(res: http.ServerResponse, params: URLSearchParams): void {
  try {
    // Validate pagination parameters
    const pagination = validatePagination(params);
    if ('error' in pagination) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: pagination.error }));
      return;
    }

    const { page, limit } = pagination;
    const sprintsDir = this.getSprintsDir();
    // ... rest of implementation
```

**Rationale:**
- Centralized validation can be reused for any future paginated endpoints
- Returns proper 400 status for client errors (not 500)
- Clear error messages help API consumers debug issues
- Limit cap (100) prevents resource exhaustion attacks
- Type guards (`'error' in pagination`) provide TypeScript safety

## Risk Assessment

| Factor | Rating | Notes |
|--------|--------|-------|
| Fix Complexity | Low | New utility function + usage at one location |
| Test Coverage | High | Multiple edge cases easy to test |
| Regression Risk | Low | Only affects invalid inputs |
| Performance Impact | None | Simple integer validation |
| Breaking Change | Potentially | Clients sending invalid params will now get 400 instead of unpredictable results |

## Additional Considerations

1. **Consistent behavior**: The same validation should apply to any future paginated endpoints
2. **Documentation**: API docs should specify valid parameter ranges
3. **Default values**: Current defaults (page=1, limit=20) are reasonable and should be preserved for missing params
