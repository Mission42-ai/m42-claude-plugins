# BUG-002 Fix Summary: Worktree Filter Shows No Sprints

## Root Cause

**Mismatch in worktree naming between row data attributes and filter dropdown options.**

The dashboard page request in `server.ts` was creating a `SprintScanner` **without** the `includeWorktreeInfo: true` option. This caused sprints to NOT have the `worktree` field populated.

Without `worktree.name`, the code fell back to `extractWorktreeName(sprint.path)` which extracts the directory basename from the path. For the main worktree, this returns the actual directory name (e.g., `m42-claude-plugins`).

However, the `/api/worktrees` endpoint normalizes the main worktree name to `'main'`:
```typescript
// server.ts:692
name: worktree.isMain ? 'main' : worktree.name
```

Result:
- Sprint rows had `data-worktree="m42-claude-plugins"` (actual directory basename)
- Filter dropdown had `value="main"` for the main worktree
- Filter comparison failed: `"m42-claude-plugins" !== "main"` -> all rows hidden

## Solution Implemented

### Primary Fix: Enable worktree info in dashboard page request (server.ts:471)
```typescript
// Before (BROKEN):
const scanner = new SprintScanner(sprintsDir);

// After (FIXED):
const scanner = new SprintScanner(sprintsDir, { includeWorktreeInfo: true });
```

This ensures sprints have the properly normalized `worktree.name` field populated.

### Secondary: Use worktree.name in row generation (dashboard-page.ts:316)
```typescript
// Uses normalized name from sprint data with fallback:
const worktreeName = sprint.worktree?.name ?? extractWorktreeName(sprint.path);
```

### Client-side JS for Dynamic Rows (dashboard-page.ts:1181)
```typescript
// Same pattern for dynamically loaded rows:
const worktreeName = (sprint.worktree && sprint.worktree.name) || extractWorktreeName(sprint.path || '');
```

## Key Insight

The `sprint-scanner.ts` correctly normalizes the worktree name (line 212):
```typescript
name: worktreeInfo.isMain ? 'main' : worktreeInfo.name,
```

But this normalization only happens when `options.includeWorktreeInfo` is `true`. The fix ensures the dashboard page request enables this option.

## Tests Added

File: `compiler/src/status-server/worktree-filter.test.ts`

7 test cases covering:
1. Main worktree sprints use "main" from worktree.name
2. Filter works when "main" worktree is selected
3. Linked worktree sprints use worktree directory name
4. Filter correctly shows all main worktree sprints
5. Filter correctly hides sprints from other worktrees
6. Fallback to path extraction when worktree info is missing
7. "All Worktrees" filter shows everything

All tests pass:
```
--- BUG-002: Worktree Filter Shows No Sprints Tests ---

✓ BUG-002 FIXED: main worktree sprints use "main" from worktree.name
✓ BUG-002 FIXED: filter works when "main" worktree is selected
✓ BUG-002 FIXED: linked worktree sprints use worktree directory name
✓ BUG-002 FIXED: filter correctly shows all main worktree sprints
✓ BUG-002 FIXED: filter correctly hides sprints from other worktrees
✓ BUG-002 FIXED: fallback to path extraction when worktree info missing
✓ BUG-002 FIXED: "All Worktrees" filter shows everything

BUG-002 tests completed.
```

## Files Changed

| File | Change |
|------|--------|
| `server.ts:471` | Add `{ includeWorktreeInfo: true }` to SprintScanner |
| `dashboard-page.ts:316` | Use `sprint.worktree?.name` with fallback |
| `dashboard-page.ts:1181` | Use `sprint.worktree.name` with fallback (client-side JS) |
| `worktree-filter.test.ts` | New test file with 7 test cases |

## Verification Completed

1. **Test Suite**: All 7 worktree filter tests pass
2. **Root Cause Analysis**: Confirmed mismatch between path-based extraction and API normalization
3. **Edge Cases Verified**:
   - Main worktree uses "main" (normalized)
   - Linked worktrees use directory basename (no normalization needed)
   - "All Worktrees" filter shows all sprints
   - Fallback to path extraction works when worktree info is missing

## Follow-up Items

None. The fix is complete and backward compatible:
- Primary fix ensures worktree info is always populated for dashboard
- Fallback path extraction handles legacy data
- Both server and client code use same naming convention
