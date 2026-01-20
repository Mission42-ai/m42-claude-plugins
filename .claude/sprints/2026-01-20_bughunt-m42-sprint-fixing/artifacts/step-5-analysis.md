# Bug Analysis: BUG-001 - Workflow Cache Staleness

## Root Cause Analysis

### Location
- **File**: `plugins/m42-sprint/compiler/src/resolve-workflows.ts`
- **Function**: `loadWorkflow()`
- **Lines**: 20-38 (cache declaration and lookup)

### Root Cause
The workflow cache is a **module-level singleton** (`const workflowCache = new Map<string, LoadedWorkflow>();` at line 20) that persists across multiple `compile()` invocations within the same process.

While a `clearWorkflowCache()` function exists (lines 172-174), it is:
1. **Never imported** in `compile.ts` (line 28 only imports `loadWorkflow` and `resolveWorkflowRefs`)
2. **Never called** at compilation start
3. Only documented as "useful for testing"

### Trigger Conditions
The bug manifests when:
1. **Watch mode**: A long-running process monitors for changes and recompiles
2. **Multiple compilations**: Same Node.js process calls `compile()` multiple times
3. **Workflow file modification**: User edits a `.yaml` workflow file between compilations
4. **Same cache key**: The modified workflow uses the same `workflowsDir:name` combination

### Code Flow
```
1. First compile() call → loadWorkflow("feature-standard", dir)
   - Cache miss → reads file from disk
   - Stores in workflowCache["dir:feature-standard"]

2. User modifies feature-standard.yaml on disk

3. Second compile() call → loadWorkflow("feature-standard", dir)
   - Cache HIT → returns stale cached version (line 37-38)
   - File on disk is never re-read
```

## What Tests Should Verify

### Test 1: Cache Returns Stale Data Without Clear
**Purpose**: Confirm the bug exists (regression test)
```
1. Create temp workflow file with content A
2. Call compile() - workflow loads content A
3. Modify workflow file to content B
4. Call compile() again WITHOUT clearing cache
5. VERIFY: Compiled output still reflects content A (stale)
```

### Test 2: Cache Clear Resolves Staleness
**Purpose**: Verify the fix works
```
1. Create temp workflow file with content A
2. Call compile() - workflow loads content A
3. Modify workflow file to content B
4. Call clearWorkflowCache()
5. Call compile() again
6. VERIFY: Compiled output reflects content B (fresh)
```

### Test 3: Compile Function Clears Cache Automatically (After Fix)
**Purpose**: Verify the fix is integrated correctly
```
1. Create temp workflow file with content A
2. Call compile() - workflow loads content A
3. Modify workflow file to content B
4. Call compile() again (NO explicit cache clear)
5. VERIFY: Compiled output reflects content B (automatic refresh)
```

### Test 4: Multiple Workflows - Partial Staleness
**Purpose**: Ensure all workflows are refreshed, not just main
```
1. Create main workflow referencing sub-workflow
2. Call compile()
3. Modify ONLY the sub-workflow file
4. Call compile() again
5. VERIFY: Sub-workflow changes are reflected
```

## Recommended Fix

**Option 1 (Minimal Change)**: Call `clearWorkflowCache()` at `compile()` entry point

```typescript
// In compile.ts, line 28
import { loadWorkflow, resolveWorkflowRefs, clearWorkflowCache } from './resolve-workflows.js';

// At start of compile() function, around line 80
export async function compile(config: CompilerConfig): Promise<CompilerResult> {
  // Clear workflow cache to ensure fresh reads
  clearWorkflowCache();

  const errors: CompilerError[] = [];
  // ... rest of function
}
```

**Rationale**:
- Simplest fix with lowest risk
- No API changes
- Cache still provides benefit within a single compilation (referenced workflows)
- Each new compilation gets fresh data

## Risk Assessment

| Factor | Rating | Notes |
|--------|--------|-------|
| Fix Complexity | Low | Single line addition + import |
| Test Coverage | Medium | Need to add cache staleness test |
| Regression Risk | Low | Cache clearing is additive |
| Performance Impact | Negligible | Disk reads on compilation start only |
