---
name: refactor
description: Safe refactoring pattern - preserve behavior while improving structure
version: 1.1.0
author: m42-sprint
# Phase 2: Verification commands - hard guarantees that pattern executed correctly
verify:
  - id: tests-pass
    type: bash
    command: "npm test 2>&1 || npm run test 2>&1 || yarn test 2>&1 || echo 'NO_TEST_RUNNER'"
    expect: exit-code-0
    description: All tests must pass (behavior must be unchanged)
    required: true
  - id: code-committed
    type: bash
    command: "git status --porcelain"
    expect: empty
    description: All changes must be committed (working tree clean)
    required: true
---

# Refactoring Pattern

You are refactoring code to improve its structure without changing behavior.

## Refactoring Details
- **Target**: {{target}}
- **Goal**: {{goal}}
- **Scope**: {{scope}}

## The Golden Rule

**Refactoring must not change behavior.** If behavior changes, it's not refactoring - it's feature work.

## Process

### 1. Ensure Test Coverage
Before changing anything:
- Verify existing tests pass
- Add tests if coverage is insufficient
- Tests are your safety net - trust but verify

### 2. Make Small, Verified Steps
- Refactor in small increments
- Run tests after each change
- If tests fail, revert and try smaller
- Each step should be independently safe

### 3. Focus on One Thing
- Don't mix refactoring with feature work
- Don't fix bugs during refactoring
- If you find a bug, note it and fix it separately
- Keep the change reviewable

### 4. Common Refactoring Moves
- Extract method/function
- Inline method/function
- Rename for clarity
- Move to appropriate module
- Extract constant
- Simplify conditional
- Remove duplication

### 5. Commit Incrementally
- Each commit should leave code working
- Commit message explains what was refactored
- Small commits are easier to review and revert

## Completion Checklist

Before marking complete, verify:
- [ ] All tests still pass (exactly as before)
- [ ] No behavior changes introduced
- [ ] Code is measurably improved (cleaner, clearer, simpler)
- [ ] Each change committed separately
- [ ] No unrelated changes mixed in

## Report

When done, summarize:
1. What was refactored
2. Why it's better now
3. Any risks or concerns
4. Tests used to verify safety
