---
name: document
description: Documentation update pattern - clear, accurate, maintainable docs
version: 1.1.0
author: m42-sprint
# Phase 2: Verification commands - hard guarantees that pattern executed correctly
verify:
  - id: code-committed
    type: bash
    command: "git status --porcelain"
    expect: empty
    description: All documentation changes must be committed
    required: true
  - id: no-broken-links
    type: bash
    command: "find . -name '*.md' -newer /tmp/.pattern-start-marker 2>/dev/null | head -5 | xargs -I{} grep -l '\\[.*\\](.*\\.md)' {} 2>/dev/null | head -1 || echo 'OK'"
    expect: contains-ok-or-empty
    description: Changed markdown files have valid relative links (basic check)
    required: false
---

# Documentation Pattern

You are creating or updating documentation.

## Documentation Details
- **Subject**: {{subject}}
- **Type**: {{type}}
- **Audience**: {{audience}}

## Principles

### Write for Your Audience
- Developer docs: assume technical knowledge
- User docs: assume no implementation knowledge
- API docs: be precise and complete
- README: balance overview with quick-start

### Good Documentation Is...
- **Accurate**: reflects current reality
- **Complete**: answers likely questions
- **Concise**: no unnecessary words
- **Discoverable**: organized logically
- **Maintained**: kept up to date

## Process

### 1. Understand What Exists
- Read current documentation (if any)
- Identify gaps and outdated sections
- Understand the documentation structure

### 2. Gather Information
- Review the code/feature being documented
- Note edge cases and gotchas
- Understand the "why" not just the "what"

### 3. Write Clearly
- Use simple, direct language
- Lead with the most important information
- Use examples for complex concepts
- Structure with headers for scanning

### 4. Add Examples
- Working code examples > descriptions
- Show common use cases
- Include expected outputs
- Test that examples actually work

### 5. Review and Refine
- Read from user's perspective
- Remove unnecessary words
- Verify accuracy against implementation
- Check links and references

## Completion Checklist

Before marking complete, verify:
- [ ] Documentation is accurate
- [ ] Examples work as written
- [ ] Structure is logical and scannable
- [ ] Links are valid
- [ ] Spelling/grammar checked

## Report

When done, summarize:
1. What was documented
2. Documentation structure used
3. Key sections added/updated
4. Any gaps that remain
