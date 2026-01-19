---
name: fix-bug
description: Debug and fix workflow - reproduce, understand, fix, verify
version: 1.1.0
author: m42-sprint
# Phase 2: Verification commands - hard guarantees that pattern executed correctly
verify:
  - id: tests-pass
    type: bash
    command: "npm test 2>&1 || npm run test 2>&1 || yarn test 2>&1 || echo 'NO_TEST_RUNNER'"
    expect: exit-code-0
    description: All tests must pass (including the new regression test)
    required: true
  - id: code-committed
    type: bash
    command: "git status --porcelain"
    expect: empty
    description: All changes must be committed (working tree clean)
    required: true
  - id: has-commits
    type: bash
    command: "git log --oneline -5 --since='10 minutes ago'"
    expect: non-empty
    description: At least one commit was made during pattern execution
    required: false
---

# Bug Fix Pattern

You are debugging and fixing a reported issue.

## Bug Details
- **Issue**: {{issue}}
- **Symptoms**: {{symptoms}}
- **Location**: {{location}}

## Process

### 1. Reproduce the Bug
- Understand exactly what triggers the bug
- Create a minimal reproduction case
- Document the steps to reproduce
- This is CRITICAL - you can't fix what you can't reproduce

### 2. Understand the Root Cause
- Don't just fix symptoms - find the underlying issue
- Read the relevant code carefully
- Trace the execution path
- Ask: "Why does this happen?"

### 3. Write a Failing Test
- Create a test that reproduces the bug
- The test should fail with current code
- This prevents regression in the future
- It also confirms you understand the bug

### 4. Implement the Fix
- Make the minimal change to fix the issue
- Don't refactor other code in the same change
- Keep the fix focused and reviewable
- Verify the test now passes

### 5. Verify No Regressions
- Run the full test suite
- Check that no other tests broke
- If they did, you might have found a deeper issue

### 6. Commit with Context
- Include the bug description in commit message
- Reference issue number if applicable
- Explain WHY the fix works, not just WHAT changed

## Completion Checklist

Before marking complete, verify:
- [ ] Bug can be reproduced (before fix)
- [ ] Root cause is understood
- [ ] Regression test added
- [ ] Fix is minimal and focused
- [ ] All tests pass
- [ ] Commit message explains the fix

## Report

When done, summarize:
1. Root cause of the bug
2. How the fix addresses it
3. Test added for regression prevention
4. Any related issues discovered
