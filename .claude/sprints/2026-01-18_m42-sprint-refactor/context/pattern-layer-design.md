# Pattern Layer Design

**Created**: 2026-01-18 (Iteration 2)
**Purpose**: Design the "patterns" part of "Freedom + Patterns"

---

## The Core Question

How does Ralph invoke patterns when ready to execute?

The vision shows:
```
RALPH (thinking) --> decides to execute --> PATTERN (quality execution) --> RALPH (reflection)
```

We need to design what happens at that "decides to execute" boundary.

---

## Design Principles

1. **Patterns are declarative** - Ralph says WHAT pattern to use, not HOW to execute it
2. **Patterns are atomic** - A pattern either succeeds completely or fails cleanly
3. **Patterns are learnable** - Each execution can generate insights that improve the pattern
4. **Patterns integrate with skills** - Leverage existing Claude Code skill system where appropriate
5. **Patterns don't break fresh context** - Each pattern execution maintains the fresh context principle

---

## Candidate Approaches

### Approach A: Patterns as Skill Invocations

Ralph's result JSON includes a pattern invocation:
```json
{
  "status": "continue",
  "summary": "Designed the authentication module",
  "invokePattern": {
    "name": "implement-feature",
    "params": {
      "feature": "JWT authentication",
      "testFirst": true,
      "scope": ["src/auth/**"]
    }
  }
}
```

The sprint loop:
1. Sees `invokePattern` in the result
2. Spawns a new fresh-context session with pattern-specific prompt
3. Pattern skill runs to completion
4. Result feeds back to Ralph's next iteration

**Pros**:
- Skills already exist
- Fresh context preserved
- Clear boundary between thinking and execution

**Cons**:
- Requires skills designed for pattern use
- Pattern might need multiple steps (skill is single invocation)
- Skill doesn't know about sprint context

### Approach B: Patterns as Workflow Fragments

Define reusable workflow fragments:
```yaml
# patterns/implement-feature.yaml
name: implement-feature
description: TDD implementation pattern
steps:
  - id: write-tests
    prompt: "Write tests for {{feature}} based on the specification..."
  - id: implement
    prompt: "Implement {{feature}} to make the tests pass..."
  - id: verify
    prompt: "Verify all tests pass and commit atomically..."
```

Ralph invokes:
```json
{
  "status": "continue",
  "invokePattern": {
    "workflow": "implement-feature",
    "params": { "feature": "JWT authentication" }
  }
}
```

The sprint loop:
1. Loads the pattern workflow
2. Executes each step as fresh-context invocations
3. Returns aggregate result to Ralph

**Pros**:
- Multi-step patterns naturally supported
- Reusable across sprints
- Testable independently

**Cons**:
- New artifact type to manage
- More complexity in sprint loop
- How do patterns access sprint context?

### Approach C: Patterns as Prompt Templates with Guarantees

Patterns are prompt templates that encode:
1. What to do
2. Quality guarantees (must pass tests, must commit atomically)
3. How to report completion

```yaml
# patterns/implement-feature.md
---
name: implement-feature
guarantees:
  - tests-pass
  - atomic-commits
  - documentation-updated
---

You are implementing a feature using TDD principles.

Feature: {{feature}}
Scope: {{scope}}

## Process
1. Write comprehensive tests first
2. Implement to make tests pass
3. Commit atomically with clear messages
4. Update relevant documentation

## Completion
You MUST verify all guarantees before marking complete:
- [ ] All tests pass (run `npm test`)
- [ ] Each change is atomic commit
- [ ] Documentation reflects changes
```

**Pros**:
- Simplest to implement
- Leverages Claude's instruction-following
- Easy to iterate on patterns

**Cons**:
- Guarantees enforced by honor system (Claude following instructions)
- No hard verification that guarantees were met
- Single invocation might not be enough for complex patterns

### Approach D: Hybrid - Patterns with Verification

Combine prompt templates with verification:

```yaml
# patterns/implement-feature.yaml
name: implement-feature
template: implement-feature.md
verify:
  - type: bash
    command: "npm test"
    expect: exit-code-0
  - type: bash
    command: "git diff --cached --name-only"
    expect: non-empty
```

Sprint loop:
1. Renders pattern template with params
2. Executes as fresh-context invocation
3. Runs verification commands
4. Only marks complete if verification passes
5. If verification fails, can retry or escalate

**Pros**:
- Hard verification of guarantees
- Pattern author defines what "success" means
- Loop can enforce quality

**Cons**:
- More complexity
- Verification might not capture all quality aspects
- What if verification is flaky?

---

## Recommended Approach: Start Simple, Enable Evolution

**Phase 1: Patterns as Prompt Templates (Approach C)**
- Low implementation cost
- Validates the concept
- Learn what patterns are useful

**Phase 2: Add Verification (Approach D)**
- Once we know what patterns matter
- Add verification to high-impact patterns
- Keep verification optional

**Phase 3: Consider Workflow Fragments (Approach B)**
- If patterns need multiple fresh-context steps
- Evaluate based on Phase 1-2 learnings
- May not be needed if single-invocation patterns work

---

## Pattern Integration Points

### 1. Sprint Loop Changes

```bash
# In sprint-loop.sh
if echo "$RESULT_JSON" | jq -e '.invokePattern' > /dev/null 2>&1; then
    pattern_name=$(echo "$RESULT_JSON" | jq -r '.invokePattern.name')
    pattern_params=$(echo "$RESULT_JSON" | jq -c '.invokePattern.params')

    # Load pattern template
    pattern_file="patterns/${pattern_name}.md"

    # Render template with params
    pattern_prompt=$(render_pattern "$pattern_file" "$pattern_params")

    # Execute in fresh context
    pattern_result=$(claude -p "$pattern_prompt" --dangerously-skip-permissions)

    # Parse and handle result
    # ...
fi
```

### 2. Pattern Discovery

Ralph needs to know what patterns exist. Options:
- Hardcode in Ralph's prompt
- Pattern manifest file
- Scan patterns/ directory

### 3. Pattern Results

Pattern execution should return structured result:
```json
{
  "status": "completed" | "failed" | "partial",
  "summary": "What was accomplished",
  "artifacts": ["file1.ts", "file2.ts"],
  "commits": ["abc123"],
  "learnings": ["Discovered that X works better than Y"]
}
```

### 4. Learning Integration

Pattern learnings flow to m42-signs:
- Pattern prompt includes instruction to note learnings
- Learning hook extracts from pattern execution transcript
- Learnings tagged with pattern name for targeted improvement

---

## Open Questions

1. **Where do patterns live?**
   - Per-sprint? (in sprint directory)
   - Per-project? (in .claude/patterns/)
   - Global? (in plugin)

2. **Who creates patterns?**
   - Developers pre-define patterns
   - Ralph can propose new patterns
   - System evolves patterns from learnings

3. **How does Ralph know when to invoke a pattern vs. work directly?**
   - Explicit instruction in goal
   - Ralph judges based on context
   - Loop suggests patterns when relevant

4. **What's the minimum viable pattern set?**
   - `implement-feature` - TDD implementation
   - `fix-bug` - Debug and fix workflow
   - `refactor` - Safe refactoring with tests
   - `document` - Documentation update

---

## Next Steps

1. Implement Phase 1 (prompt template patterns) in sprint loop
2. Create initial pattern set (3-4 core patterns)
3. Test with a real feature implementation
4. Evaluate and iterate

---

## Relationship to Existing System

The pattern layer fits between Ralph and execution:

```
Goal (human intent)
    |
    v
Ralph (deep thinking, shaping work)
    |
    v  <-- NEW: Pattern invocation decision
PATTERN (consistent execution)
    |
    v
Sprint Loop (orchestration, state management)
    |
    v
Claude Execution (fresh context)
    |
    v
Learnings (m42-signs extraction)
    |
    v
CLAUDE.md (organizational memory)
```

The pattern layer doesn't replace anything - it fills the gap between Ralph's decisions and Claude's execution, ensuring quality execution of Ralph's intent.

---

*This design is a starting point. Implementation will reveal what works and what needs adjustment.*
