---
title: Real-World Examples from Codebase
description: Concrete examples of good vs bad Gherkin scenarios from actual m42-claude-plugins development, with lessons learned
keywords: examples, case studies, lessons learned, anti-patterns, best practices
file-type: reference
skill: creating-gherkin-scenarios
---

# Real-World Examples from Codebase

## Case Study 1: ralph-mode-implementation Sprint (Bad)

### What Happened

Sprint tested that `spawn_per_iteration_hooks()` function **existed** but not that it **worked**.

**Gherkin written:**
```gherkin
Scenario: Hook spawning function exists
  Given the codebase at src/hooks/
  When I search for "spawn_per_iteration_hooks"
  Then the function is found in hooks.ts
  And the function is exported from the module
```

**Verification used:**
```bash
# Structural check only
grep -r "spawn_per_iteration_hooks" src/
```

**Result:** Tests passed, but hooks never executed in production.

### Root Cause

Structural verification gave **false confidence**. The function existed but:
- Was never called during sprint loop
- Had incorrect Claude CLI arguments (wrong model specified)
- Didn't capture output to transcript files
- Failed silently without error reporting

### What Should Have Been Written

```gherkin
Scenario: Learning hook executes after iteration
  Given a sprint with learning hook enabled in SPRINT.yaml
  And iteration 1 completes successfully
  When the sprint loop transitions to iteration 2
  Then a Claude CLI process is spawned
  And the hook transcript exists at .claude/sprints/{sprint}/hooks/learning/iteration-1.md
  And the transcript contains "## Extracted Learnings" section
  And learnings appear in backlog.yaml
```

**Verification required:**
```typescript
// Integration test
const sprint = await setupTestSprint({ hooks: ['learning'] });
await sprint.completeIteration(1);

const transcript = await fs.readFile(
  `.claude/sprints/${sprint.id}/hooks/learning/iteration-1.md`
);
expect(transcript).toContain('## Extracted Learnings');
```

### Lesson Learned

**Never verify code existence. Always verify behavior.**

---

## Case Study 2: compile.test.ts (Good)

### What Was Done Right

Tests that compilation **produces valid PROGRESS.yaml** with correct schema.

**Gherkin:**
```gherkin
Scenario: Compilation produces valid PROGRESS.yaml
  Given a SPRINT.yaml with 3 tasks
  When I run compile workflow
  Then PROGRESS.yaml is created
  And PROGRESS.yaml contains 3 task entries
  And each task has status: pending
  And PROGRESS.yaml schema validation passes
  And PROGRESS.yaml checksum file is created
```

**Implementation:**
```typescript
describe('[Integration] Sprint compilation', () => {
  it('produces valid PROGRESS.yaml from SPRINT.yaml', async () => {
    await fs.writeFile('SPRINT.yaml', validSprintContent);
    await compileWorkflow('SPRINT.yaml');

    // Behavioral verification: actual file created
    const progressContent = await fs.readFile('PROGRESS.yaml', 'utf-8');
    const progress = yaml.parse(progressContent);

    expect(progress.tasks).toHaveLength(3);
    expect(progress.tasks[0].status).toBe('pending');
    expect(progress.tasks[0].id).toBe('task-1');

    // Schema validation
    await expect(validateSchema(progress)).resolves.not.toThrow();

    // Checksum verification
    const checksumExists = await fs.access('PROGRESS.yaml.checksum');
    expect(checksumExists).toBeTruthy();
  });
});
```

### Why This Works

- **End-to-end:** Reads real SPRINT.yaml, runs real compilation, writes real PROGRESS.yaml
- **Observable outputs:** Verifies file creation, content structure, schema validity
- **Integration test:** Uses actual file system, YAML parsing, schema validation
- **No mocking:** Tests real compilation behavior, not code structure

---

## Case Study 3: loop.test.ts with Mocked Runner (Good)

### What Was Done Right

Tests sprint loop execution with **mocked Claude runner** to avoid external API calls.

**Gherkin:**
```gherkin
Scenario: Sprint loop executes tasks sequentially
  Given a compiled sprint with 3 tasks
  And a mocked Claude runner that returns success
  When I start the sprint loop
  Then task-1 executes first
  And task-1 status changes to completed
  And task-2 executes second
  And the loop stops after task-3
  And PROGRESS.yaml reflects all completions
```

**Implementation:**
```typescript
describe('[Integration] Sprint loop', () => {
  it('executes tasks sequentially', async () => {
    const mockRunner = jest.fn().mockResolvedValue({
      status: 'completed',
      summary: 'Task done'
    });

    const sprint = await setupTestSprint({
      tasks: ['task-1', 'task-2', 'task-3'],
      runner: mockRunner
    });

    await sprint.run();

    // Verify execution order
    expect(mockRunner).toHaveBeenCalledTimes(3);
    expect(mockRunner).toHaveBeenNthCalledWith(1, expect.objectContaining({
      taskId: 'task-1'
    }));

    // Verify state updates
    const progress = await sprint.readProgress();
    expect(progress.tasks[0].status).toBe('completed');
    expect(progress.tasks[1].status).toBe('completed');
  });
});
```

### Why Mocking Works Here

- **Non-deterministic component isolated:** Claude API responses are unpredictable
- **Behavioral verification still valid:** Tests loop logic, task ordering, state updates
- **Fast execution:** No external API calls
- **Controlled outcomes:** Can test success/failure/timeout scenarios

**Key insight:** Mock **external non-deterministic services** (APIs), but test **internal behavior** (loop logic, file updates) with real implementations.

---

## Case Study 4: Checksum Validation (Anti-Pattern Avoided)

### Anti-Pattern That Was Avoided

Could have written:
```gherkin
# ❌ WRONG - Structural only
Scenario: Checksum validation function exists
  Given the codebase
  When I search for "validateChecksum"
  Then the function is defined
  And the function imports crypto module
```

### What Was Actually Written

```gherkin
# ✅ CORRECT - Behavioral
Scenario: Checksum detects external modifications
  Given a PROGRESS.yaml with valid checksum
  When I modify PROGRESS.yaml externally (change status)
  And I do NOT update the checksum file
  And the sprint loop attempts to read PROGRESS.yaml
  Then a checksum validation error is reported
  And the sprint loop stops with error
  And the error message indicates checksum mismatch
```

**Implementation:**
```typescript
it('detects checksum mismatch', async () => {
  await sprint.writeProgress({ tasks: [...] });
  const checksumBefore = await fs.readFile('PROGRESS.yaml.checksum', 'utf-8');

  // External modification without checksum update
  await fs.writeFile('PROGRESS.yaml', modifiedContent);

  await expect(sprint.readProgress()).rejects.toThrow(/checksum mismatch/i);
});
```

### Why This Works

- **Tests actual failure scenario:** Modification without checksum update
- **Verifies error detection:** Not just "function exists"
- **Checks error messaging:** User gets actionable error
- **Integration test:** Real file I/O, real checksum computation

---

## Pattern Summary: Good vs Bad

| Bad (Structural) | Good (Behavioral) |
|------------------|-------------------|
| `grep` for function name | Execute function with input → verify output |
| Check export exists | Import and invoke → verify behavior |
| Verify file contains pattern | Run feature → verify file created with correct content |
| Type check passes | Integration test with real data |
| Code compiles | End-to-end scenario passes |

## General Principles from Examples

1. **If you can `grep` for it, it's not a behavioral test**
2. **Mocking is OK for external APIs, but test your code with real implementations**
3. **File system interactions require integration tests, always**
4. **"Function exists" ≠ "Function works"**
5. **False confidence from structural checks is worse than no tests**

## Quick Self-Check

Before finalizing a Gherkin scenario, ask:

- Could this test pass even if the feature is completely broken? → ❌ Structural
- Does this test execute the feature and verify observable outcomes? → ✅ Behavioral
- Would a developer trust this test to catch real bugs? → ✅ Good test
- Is this just documenting code structure? → ❌ Not a real test
