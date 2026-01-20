# Bug Prioritization

**Target**: plugins/m42-sprint
**Date**: 2026-01-20
**Total Bugs**: 16

## Priority Summary

| Priority | Count | Bug IDs |
|----------|-------|---------|
| Critical | 0 | - |
| High | 3 | BUG-002, BUG-006, BUG-010 |
| Medium | 6 | BUG-001, BUG-004, BUG-008, BUG-011, BUG-014, BUG-016 |
| Low | 7 | BUG-003, BUG-005, BUG-007, BUG-009, BUG-012, BUG-013, BUG-015 |

---

## Critical (Must Fix)

*None identified - no crashes, data loss, or security vulnerabilities that can be actively exploited.*

---

## High (Should Fix)

### BUG-002: Race condition on PROGRESS.yaml during read-modify-write cycle
- **Feature**: runtime/loop
- **Impact**: Data loss - concurrent modifications from status server may be silently overwritten
- **Complexity**: High - requires implementing file locking or compare-and-swap mechanism
- **Dependencies**: None
- **Why High**: Active data loss during normal operation when using status server controls

### BUG-006: No validation of phaseId parameter allows potential path traversal
- **Feature**: status-server
- **Impact**: Security - while current sanitization works, lack of explicit containment check is defense-in-depth failure
- **Complexity**: Low - add resolved path verification
- **Dependencies**: Related to BUG-012 (both are path traversal issues)
- **Why High**: Security-related issues should be addressed proactively

### BUG-010: Signal files not cleaned up on sprint completion
- **Feature**: status-server
- **Impact**: Unexpected behavior - leftover signals cause issues on sprint restart
- **Complexity**: Low - add cleanup in sprint completion handler
- **Dependencies**: None
- **Why High**: Affects reliability of sprint restart workflows, common user scenario

---

## Medium (Nice to Fix)

### BUG-001: Workflow cache persists globally causing stale data
- **Feature**: compiler
- **Impact**: Stale workflows used in long-running processes
- **Complexity**: Low - add cache clearing at compilation start
- **Dependencies**: None
- **Why Medium**: Only affects watch mode/server scenarios, not typical CLI usage

### BUG-004: Empty phases array not checked before accessing phases[0]
- **Feature**: runtime/transition
- **Impact**: Potential crash on malformed input
- **Complexity**: Low - add bounds checking
- **Dependencies**: Related to BUG-008, BUG-009 (all involve null/undefined access)
- **Why Medium**: Edge case that requires malformed SPRINT.yaml

### BUG-008: advancePointer may return invalid pointer for edge cases
- **Feature**: runtime/transition
- **Impact**: Undefined behavior when step has no sub-phases
- **Complexity**: Medium - requires understanding pointer state machine
- **Dependencies**: Related to BUG-004
- **Why Medium**: Edge case in state transitions

### BUG-011: Negative page parameter causes incorrect pagination
- **Feature**: status-server
- **Impact**: Bad UX - confusing API response
- **Complexity**: Low - add parameter validation
- **Dependencies**: Related to BUG-014, BUG-015, BUG-016 (all pagination validation)
- **Why Medium**: API inconsistency, not a security issue

### BUG-014: Page=0 returns empty results with hasMore=true
- **Feature**: status-server
- **Impact**: Bad UX - misleading pagination
- **Complexity**: Low - coerce to valid range
- **Dependencies**: Part of pagination validation group (BUG-011, BUG-015, BUG-016)
- **Why Medium**: API inconsistency

### BUG-016: Negative limit parameter returns unexpected results
- **Feature**: status-server
- **Impact**: Confusing API behavior
- **Complexity**: Low - add parameter validation
- **Dependencies**: Part of pagination validation group
- **Why Medium**: API inconsistency

---

## Low (Can Defer)

### BUG-003: parseInt without radix validation allows NaN
- **Feature**: runtime/cli
- **Impact**: Silent failure with invalid CLI args
- **Complexity**: Low - add isNaN check
- **Dependencies**: Related to BUG-013 (both CLI validation)
- **Why Low**: Rare scenario - requires user to pass invalid numeric args

### BUG-005: Logic error category patterns too broad
- **Feature**: compiler/error-classifier
- **Impact**: Potentially confusing error classification
- **Complexity**: Medium - requires restructuring pattern matching
- **Dependencies**: None
- **Why Low**: Current code works, issue is maintainability/clarity

### BUG-007: writeProgressAtomic is async but uses sync operations
- **Feature**: runtime/yaml-ops
- **Impact**: Event loop blocking during file I/O
- **Complexity**: Low - change to fs.promises or rename function
- **Dependencies**: None
- **Why Low**: Misleading API, but doesn't cause functional issues

### BUG-009: Non-null assertion on potentially undefined steps array
- **Feature**: compiler/expand-foreach
- **Impact**: Potential crash if assumptions violated
- **Complexity**: Low - use optional chaining
- **Dependencies**: Related to BUG-004 (both involve null assertions)
- **Why Low**: TypeScript safety issue, unlikely runtime failure

### BUG-012: Path traversal sanitization lacks explicit containment check
- **Feature**: status-server
- **Impact**: Defense-in-depth improvement needed
- **Complexity**: Low - add path.resolve check
- **Dependencies**: Related to BUG-006 (duplicate issue)
- **Why Low**: Current sanitization is effective; this is a hardening measure

### BUG-013: Delay parameter accepts negative values
- **Feature**: runtime/cli
- **Impact**: Semantically confusing but functionally benign
- **Complexity**: Low - add validation
- **Dependencies**: Related to BUG-003 (both CLI validation)
- **Why Low**: setTimeout treats negative as 0, no actual harm

### BUG-015: Non-numeric page parameter returns null
- **Feature**: status-server
- **Impact**: Confusing API response
- **Complexity**: Low - add NaN check
- **Dependencies**: Part of pagination validation group
- **Why Low**: Unlikely scenario - requires malformed request

---

## Recommended Fix Order

### Phase 1: High Priority (Security & Data Integrity)
1. **BUG-006** + **BUG-012** - Path traversal hardening (fix together, same pattern)
2. **BUG-010** - Signal file cleanup
3. **BUG-002** - Race condition (most complex, plan carefully)

### Phase 2: Medium Priority (Reliability)
4. **BUG-004** + **BUG-008** + **BUG-009** - Null/undefined access issues (fix together)
5. **BUG-001** - Workflow cache staleness
6. **BUG-011** + **BUG-014** + **BUG-015** + **BUG-016** - Pagination validation (fix together)

### Phase 3: Low Priority (Polish)
7. **BUG-003** + **BUG-013** - CLI parameter validation (fix together)
8. **BUG-007** - Async/sync API consistency
9. **BUG-005** - Error classifier pattern ordering

---

## Bug Dependencies

```
BUG-006 ←→ BUG-012 (duplicate: path traversal)
    └── Fix together with shared path containment utility

BUG-004 ── BUG-008 ── BUG-009 (related: null/undefined access)
    └── All involve pointer/phase access safety

BUG-011 ── BUG-014 ── BUG-015 ── BUG-016 (related: pagination validation)
    └── Fix with single validation utility function

BUG-003 ←→ BUG-013 (related: CLI numeric validation)
    └── Fix with shared parsePositiveInt utility
```

---

## Complexity Estimates

| Complexity | Bugs | Description |
|------------|------|-------------|
| **Low** | BUG-001, BUG-003, BUG-006, BUG-007, BUG-009, BUG-010, BUG-011, BUG-012, BUG-013, BUG-014, BUG-015, BUG-016 | Simple validation or cleanup additions |
| **Medium** | BUG-004, BUG-005, BUG-008 | Requires understanding control flow and state |
| **High** | BUG-002 | Requires file locking mechanism or architectural change |

---

## Notes

1. **No Critical Bugs**: The codebase is reasonably robust - no crashes, data corruption, or exploitable security holes identified
2. **Batch Fixes Recommended**: Several bugs are related and should be fixed together for consistency
3. **BUG-002 Needs Design**: The race condition fix requires careful design to avoid introducing new issues
4. **Quick Wins**: BUG-006, BUG-010, BUG-012, and the pagination bugs are all low-complexity fixes with good impact
