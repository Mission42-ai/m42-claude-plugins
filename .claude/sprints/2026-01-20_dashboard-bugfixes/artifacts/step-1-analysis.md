# BUG-002 Analysis: Worktree Filter Shows No Sprints

## Summary

When selecting a specific worktree from the filter dropdown (anything except "All Worktrees"), no sprints are displayed in the list, even when sprints exist in that worktree.

## Root Cause Location

| File | Line | Function |
|------|------|----------|
| `dashboard-page.ts` | 316 | `generateSprintRow()` - server-side row generation |
| `dashboard-page.ts` | 1182 | Client-side dynamic row addition |
| `dashboard-page.ts` | 1103-1127 | `applyWorktreeFilter()` - filter logic |

## Root Cause

**Mismatch in worktree naming between data attributes and filter options.**

### The Problem

When generating sprint table rows, the worktree name **was** extracted from the sprint path using `extractWorktreeName()`:

```typescript
// dashboard-page.ts:350-360
function extractWorktreeName(sprintPath: string): string {
  const parts = sprintPath.split('/.claude/sprints/');
  if (parts.length > 0) {
    const worktreeRoot = parts[0];
    const basename = worktreeRoot.split('/').pop() || 'main';
    return basename;  // Returns "m42-claude-plugins" for main worktree
  }
  return 'main';
}
```

However, when the `/api/worktrees` endpoint returns worktree data, it uses a different naming convention:

```typescript
// server.ts:692
name: worktree.isMain ? 'main' : worktree.name
// Returns "main" for the main worktree
```

And the `SprintSummary.worktree` field also normalizes correctly:

```typescript
// sprint-scanner.ts:212
name: worktreeInfo.isMain ? 'main' : worktreeInfo.name
```

### Result

- Sprint rows had `data-worktree="m42-claude-plugins"` (actual directory basename)
- Filter dropdown has `value="main"` for the main worktree
- Filter comparison fails: `"m42-claude-plugins" !== "main"` → all rows hidden

## Triggering Conditions

1. User opens the sprint dashboard
2. User selects any specific worktree in the filter dropdown (not "All Worktrees")
3. The filter attempts to match `data-worktree` attributes against the selected value
4. **For the main worktree**: `"m42-claude-plugins" !== "main"` → no match
5. **For linked worktrees**: May also fail if `worktree.name` differs from path basename

## The Fix

**Applied at**: `dashboard-page.ts:316`

```typescript
// FIX: Use normalized worktree name from server, fallback to path extraction
const worktreeName = sprint.worktree?.name ?? extractWorktreeName(sprint.path);
```

This ensures:
- Main worktrees show as `"main"` (from `sprint.worktree.name`)
- Linked worktrees show their directory name (from `sprint.worktree.name`)
- Fallback to path extraction only when worktree info is missing (legacy data)

## Test Verification Points

A proper test should verify:

1. **Main worktree filter works**: Selecting "main" shows all main worktree sprints
2. **Linked worktree filter works**: Selecting a linked worktree shows only its sprints
3. **"All Worktrees" shows everything**: No filtering when "all" is selected
4. **Mixed worktrees filter correctly**: Sprints from other worktrees are hidden
5. **Fallback path extraction**: Works when `sprint.worktree` is undefined (legacy)
6. **Normalization consistency**: Both server dropdown and row attributes use same naming

## Existing Test Coverage

Test file: `worktree-filter.test.ts`
Contains 7 test cases verifying the fix:
- Main worktree sprints use "main" from worktree.name
- Filter works when "main" worktree is selected
- Linked worktree sprints use worktree directory name
- Filter correctly shows all main worktree sprints
- Filter correctly hides sprints from other worktrees
- Fallback to path extraction when worktree info missing
- "All Worktrees" filter shows everything

## Severity Assessment

- **Severity**: HIGH (usability issue)
- **Impact**: Worktree filtering was completely non-functional
- **Scope**: Affects all dashboard users with worktrees
- **Fix Complexity**: Low - single line change
