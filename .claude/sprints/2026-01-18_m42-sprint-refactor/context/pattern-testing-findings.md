# Pattern Testing Findings

**Created**: 2026-01-19 (Iteration 3)
**Purpose**: Document findings from testing the pattern invocation mechanism

---

## Summary

Testing the pattern verification mechanism (Phase 2 of pattern layer design) revealed two bugs that would have caused verification to silently pass when it should fail.

---

## Bugs Found and Fixed

### Bug 1: Exit Code Capture

**Location**: `sprint-loop.sh:744` (run_pattern_verification function)

**Original code**:
```bash
cmd_output=$(eval "$verify_cmd" 2>&1) || true
cmd_exit_code=$?
```

**Problem**: The `|| true` suffix ensures the compound command always succeeds, so `$?` is always 0. This means verification commands that fail (exit non-zero) are incorrectly reported as passing.

**Fixed code**:
```bash
local cmd_exit_code=0
cmd_output=$(eval "$verify_cmd" 2>&1) || cmd_exit_code=$?
```

**Why this works**: The exit code is captured in the `|| cmd_exit_code=$?` fallback, which only executes when the command fails. If the command succeeds, `cmd_exit_code` stays 0.

### Bug 2: yq Boolean Handling

**Location**: `sprint-loop.sh:733`

**Original code**:
```bash
verify_required=$(echo "$verify_yaml" | yq -r ".verify[$i].required // \"true\"")
```

**Problem**: yq's alternative operator (`//`) treats boolean `false` as a falsy value and returns the default. So `false // "true"` returns `"true"`, not `"false"`.

**Example**:
```yaml
verify:
  - id: check1
    required: true   # yq returns "true" ✓
  - id: check2
    required: false  # yq returns "true" ✗ (should be false!)
  - id: check3
    # no required     # yq returns "true" ✓ (correct default)
```

**Fixed code**:
```bash
verify_required=$(echo "$verify_yaml" | yq -r ".verify[$i].required")
[[ "$verify_required" == "null" || -z "$verify_required" ]] && verify_required="true"
```

**Why this works**: Extract the raw value, then handle the default case in bash where we can properly distinguish `false` from `null`.

---

## Test Suite Created

Added `test-pattern-verification.sh` with 8 test cases covering:

1. Pattern with no verify section (should pass)
2. All required checks pass
3. Required check fails (should fail overall)
4. Optional check fails, required passes (should still pass)
5. Non-empty expectation type
6. Empty expectation type
7. Real-world pattern in clean git repo
8. Real-world pattern in dirty git repo

All tests now pass.

---

## Impact

Without these fixes, the pattern verification mechanism would have been **silently broken**:
- Commands that fail would be reported as passing
- Optional checks would incorrectly be treated as required

This would undermine the "hard guarantees" promise of Phase 2 of the pattern layer design.

---

## Remaining Work

The pattern invocation mechanism is now validated at the unit test level. To fully test it:

1. **Integration test**: Invoke a pattern from Ralph mode and verify end-to-end flow
2. **Error handling**: What happens when pattern invocation fails mid-execution?
3. ~~**Result context**: Step-3 will add pattern results to Ralph's next iteration~~ ✓ COMPLETED (Iteration 4)

### Pattern Result Context (Completed)

In iteration 4, we added pattern result context to Ralph's prompts:

- `get_pattern_results()` function extracts pattern results from PROGRESS.yaml
- Uses yq v4-compatible syntax (extract as TSV, format in bash)
- Three modes of extraction:
  - `recent`: Results from previous iteration (shown in executing/planning modes)
  - `all`: All results with iteration numbers (shown in reflecting mode)
  - Specific iteration number for targeted queries
- Results include:
  - Pattern name
  - Verification status (✓ verified / ✗ verification failed)
  - Verification message (if any)
  - Iteration number (in "all" mode)

---

## Learnings

1. **Test infrastructure before relying on it**: The pattern verification was added in iteration 2 but had these bugs
2. **yq quirks**: Boolean handling with alternatives is surprising - extract raw and default in bash
3. **Exit code patterns**: The `|| true` pattern is common but breaks `$?` - use `|| code=$?` instead
4. **Comprehensive tests matter**: Edge cases (optional checks, empty output) caught real issues

---

*Test-driven verification of new infrastructure is essential for "hard guarantees".*
