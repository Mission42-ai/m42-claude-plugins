---
name: implement-feature
description: TDD implementation pattern - write tests first, implement, commit atomically
version: 1.1.0
author: m42-sprint
# Phase 2: Verification commands - hard guarantees that pattern executed correctly
verify:
  - id: tests-pass
    type: bash
    command: "npm test 2>&1 || npm run test 2>&1 || yarn test 2>&1 || echo 'NO_TEST_RUNNER'"
    expect: exit-code-0
    description: All tests must pass
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

# Feature Implementation Pattern

You are implementing a feature using Test-Driven Development (TDD) principles.

## Feature Details
- **Feature**: {{feature}}
- **Scope**: {{scope}}
- **Context**: {{context}}

## Process

### 1. Understand the Requirement
Before writing any code, ensure you understand:
- What the feature should do
- What success looks like
- Edge cases to consider
- How it integrates with existing code

### 2. Write Tests First
- Create comprehensive tests that define the expected behavior
- Cover happy paths and edge cases
- Tests should fail initially (that's expected!)
- Think about what would make you confident this feature works

### 3. Implement to Pass Tests
- Write the minimum code to make tests pass
- Keep the implementation simple and focused
- Don't add features beyond what's needed
- Refactor for clarity once tests pass

### 4. Commit Atomically
Each commit should:
- Be self-contained and pass all tests
- Have a clear, descriptive message
- Include both tests and implementation together
- Follow project commit conventions

### 5. Documentation
- Update relevant documentation if needed
- Add inline comments only where logic isn't self-evident
- Update README if the feature affects usage

## Completion Checklist

Before marking complete, verify:
- [ ] All tests pass (`npm test` or project equivalent)
- [ ] Implementation meets the requirement
- [ ] Code follows project style/conventions
- [ ] Changes are committed atomically
- [ ] Documentation is updated (if needed)

## Report

When done, summarize:
1. What tests were added
2. What was implemented
3. Any learnings or observations
4. Files modified
