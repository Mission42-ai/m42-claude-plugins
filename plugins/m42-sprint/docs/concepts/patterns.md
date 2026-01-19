# Patterns: Consistent Execution in Ralph Mode

**Patterns** bridge the gap between Ralph's free thinking and consistent quality execution. When Ralph decides something needs to happen (implement a feature, fix a bug, refactor code), patterns ensure it happens the right way.

---

## The Philosophy: Freedom + Patterns

Ralph Mode provides freedom for deep thinking and dynamic planning. But freedom alone leads to inconsistency. Patterns solve this:

```text
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   RALPH (Deep Thinking)                                    │
│   ═══════════════════                                      │
│                                                            │
│   "I need to implement authentication"                     │
│   "This requires TDD with proper verification"             │
│   "Time to invoke the implement-feature pattern"           │
│                                                            │
│         │                                                  │
│         │ invokePattern                                    │
│         ▼                                                  │
│                                                            │
│   PATTERN (Consistent Execution)                           │
│   ══════════════════════════════                           │
│                                                            │
│   → Write tests first                                      │
│   → Implement to make tests pass                           │
│   → Commit atomically                                      │
│   → Verify: tests pass, working tree clean                 │
│                                                            │
│         │                                                  │
│         │ verification result                              │
│         ▼                                                  │
│                                                            │
│   RALPH (Next Iteration)                                   │
│   ═══════════════════════                                  │
│                                                            │
│   "Pattern completed with verification ✓"                  │
│   "Now I should tackle the next piece..."                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Ralph decides WHAT and WHY. Patterns ensure HOW is consistent.**

---

## How Patterns Work

### Invoking a Pattern

In Ralph Mode, include an `invokePattern` field in your JSON result:

```json
{
  "status": "continue",
  "summary": "Designed the authentication module, ready to implement",
  "invokePattern": {
    "name": "implement-feature",
    "params": {
      "feature": "JWT authentication with refresh tokens",
      "scope": "src/auth/",
      "context": "User story: As a user, I want secure authentication"
    }
  },
  "pendingSteps": [
    {"id": "step-1", "prompt": "Add logout endpoint after auth is working"}
  ]
}
```

### What Happens When a Pattern is Invoked

1. **Pattern Discovery**: Sprint loop finds the pattern in:
   - `$SPRINT_DIR/patterns/` (sprint-specific)
   - `.claude/patterns/` (project-level)
   - `$PLUGIN_DIR/patterns/` (plugin defaults)

2. **Template Rendering**: Parameters from `invokePattern.params` replace `{{placeholders}}`

3. **Fresh Context Execution**: Pattern runs in isolated Claude context

4. **Verification**: Verification commands from pattern frontmatter run to ensure quality

5. **Result Recording**: Pattern results stored in PROGRESS.yaml for Ralph's next iteration

---

## Built-in Patterns

M42 Sprint includes four core patterns:

### implement-feature

**Purpose**: TDD implementation - write tests first, implement, commit atomically.

**Parameters**:
- `feature`: What to implement
- `scope`: Which files/directories
- `context`: Background information

**Verification**:
- ✓ All tests pass
- ✓ Working tree is clean (changes committed)
- ○ Recent commits exist (optional)

**Example**:
```json
{
  "invokePattern": {
    "name": "implement-feature",
    "params": {
      "feature": "User registration with email verification",
      "scope": "src/auth/registration/",
      "context": "Part of authentication epic"
    }
  }
}
```

---

### fix-bug

**Purpose**: Debug and fix workflow - reproduce, understand, fix, verify with regression test.

**Parameters**:
- `issue`: The bug description
- `symptoms`: How it manifests
- `location`: Where in codebase

**Verification**:
- ✓ All tests pass (including new regression test)
- ✓ Working tree is clean
- ○ Recent commits exist (optional)

**Example**:
```json
{
  "invokePattern": {
    "name": "fix-bug",
    "params": {
      "issue": "Token refresh fails when clock skew > 30s",
      "symptoms": "Users logged out unexpectedly",
      "location": "src/auth/token.ts"
    }
  }
}
```

---

### refactor

**Purpose**: Safe refactoring - preserve behavior while improving structure.

**Parameters**:
- `target`: What to refactor
- `goal`: Why refactoring (e.g., "reduce duplication")
- `scope`: Affected areas

**Verification**:
- ✓ All tests pass (behavior unchanged)
- ✓ Working tree is clean

**Example**:
```json
{
  "invokePattern": {
    "name": "refactor",
    "params": {
      "target": "Auth middleware stack",
      "goal": "Extract common validation logic",
      "scope": "src/middleware/auth/"
    }
  }
}
```

---

### document

**Purpose**: Documentation updates - clear, accurate, maintainable docs.

**Parameters**:
- `subject`: What to document
- `type`: Type of docs (API, user guide, architecture)
- `audience`: Who reads this (developers, users, operators)

**Verification**:
- ✓ Documentation changes committed
- ○ No broken markdown links (optional)

**Example**:
```json
{
  "invokePattern": {
    "name": "document",
    "params": {
      "subject": "Authentication API endpoints",
      "type": "API reference",
      "audience": "Frontend developers"
    }
  }
}
```

---

## Pattern Results in Ralph's Context

After a pattern executes, Ralph sees the results in the next iteration:

```markdown
## Previous Iteration Pattern Results
- **implement-feature**: ✓ verified - 2/2 checks passed

Use these results to inform your next steps.
```

If verification failed:
```markdown
## Previous Iteration Pattern Results
- **implement-feature**: ✗ verification failed - Required verification(s) failed

Use these results to inform your next steps. If a pattern failed verification, consider what went wrong.
```

---

## Creating Custom Patterns

### Pattern File Structure

Create a markdown file with YAML frontmatter:

```markdown
---
name: my-pattern
description: What this pattern does
version: 1.0.0
verify:
  - id: check-1
    type: bash
    command: "npm test"
    expect: exit-code-0
    description: All tests must pass
    required: true
  - id: check-2
    type: bash
    command: "git status --porcelain"
    expect: empty
    description: Working tree must be clean
    required: true
---

# My Pattern

You are executing the my-pattern pattern.

## Context
- **Input**: {{input}}
- **Options**: {{options}}

## Process

1. Step one...
2. Step two...

## Completion Checklist

Before marking complete:
- [ ] First requirement
- [ ] Second requirement
```

### Verification Types

| `expect` Value | Meaning |
|----------------|---------|
| `exit-code-0` | Command must exit with code 0 |
| `empty` | Command output must be empty |
| `non-empty` | Command must produce output |
| `contains-ok-or-empty` | Output is empty or exactly "OK" |

### Required vs Optional Checks

- `required: true` - Pattern fails if check fails
- `required: false` - Check runs but doesn't block success

### Parameter Substitution

Use `{{paramName}}` in your pattern template. Parameters come from `invokePattern.params`:

```json
{
  "invokePattern": {
    "name": "my-pattern",
    "params": {
      "input": "something",
      "options": "some options"
    }
  }
}
```

---

## Pattern Discovery Order

The sprint loop searches for patterns in this order:

1. **Sprint-local**: `$SPRINT_DIR/patterns/pattern-name.md`
2. **Project-level**: `.claude/patterns/pattern-name.md`
3. **Plugin default**: `$PLUGIN_DIR/patterns/pattern-name.md`

This allows:
- Project customization of default patterns
- Sprint-specific patterns for special needs
- Fallback to sensible defaults

---

## When to Use Patterns vs. Direct Execution

| Use Pattern | Direct Execution |
|-------------|------------------|
| Complex multi-step work with quality gates | Simple, one-off tasks |
| Work needing verification (tests, commits) | Research or exploration |
| Repeatable processes (TDD, bug fixes) | Unique or novel tasks |
| Work benefiting from structure | Quick fixes or tweaks |

**Ralph's judgment**: Patterns are available, not mandatory. Ralph decides when structure helps vs. when freedom is better.

---

## Troubleshooting

### Pattern Not Found

```
Error: Pattern 'my-pattern' not found in search paths:
  - /sprint/dir/patterns/my-pattern.md
  - .claude/patterns/my-pattern.md
  - /plugin/patterns/my-pattern.md
```

**Solution**: Create the pattern file in one of the search paths.

### Verification Failing

Check the verification results in the pattern transcript:
```bash
cat $SPRINT_DIR/transcripts/patterns/iter1-implement-feature-verification.json
```

Common issues:
- Tests not running (wrong test command)
- Uncommitted changes
- Test failures from implementation bugs

### Pattern Execution Errors

Pattern transcripts are saved to `$SPRINT_DIR/transcripts/patterns/`:
```bash
cat $SPRINT_DIR/transcripts/patterns/iter1-implement-feature.jsonl
```

---

## Related Concepts

- [Ralph Mode](ralph-mode.md) - The autonomous execution mode that uses patterns
- [Ralph Loop Pattern](ralph-loop.md) - Fresh context execution
- [Progress Schema](../reference/progress-yaml-schema.md) - Where pattern results are stored

---

[← Back to Concepts](overview.md) | [← Back to Documentation Index](../index.md)
