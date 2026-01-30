---
name: creating-gherkin-scenarios
description: Guides writing behavioral Gherkin scenarios that test observable outcomes rather than code structure. Use when writing acceptance criteria, test strategies, or verification approaches. Emphasizes end-to-end testing, integration test requirements, and TDD workflow integration. Triggers on "write gherkin", "create scenarios", "write acceptance criteria", "test strategy", "verification approach".
---

# Creating Gherkin Scenarios

## Core Principle

**Test observable behavior, not code structure.**

Structural verification (checking code exists) provides false confidence. Behavioral verification (executing features and verifying outcomes) catches real bugs.

## When to Use This Skill

Use this skill when:
- Writing Gherkin scenarios for new features or bug fixes
- Defining acceptance criteria for stories or epics
- Planning test strategies for complex features
- Determining verification approaches for implementation work
- Reviewing existing tests for behavioral completeness
- Integrating Gherkin scenarios into TDD workflows

## The Behavioral Testing Principle

### Anti-Pattern: Structural Verification ❌

**Problem:** Testing that code exists, not that it works.

Examples of structural verification (wrong approach):
- `grep "function_name"` to verify function exists
- Checking file contains specific pattern
- Verifying module exports function
- Confirming code compiles without errors
- Searching for hook registration code

**Why this fails:** Code can exist but never execute, execute incorrectly, or fail silently.

**Real example from codebase:**
```gherkin
# ❌ WRONG - ralph-mode-implementation sprint
Scenario: Hook spawning function exists
  Given the codebase at src/hooks/
  When I search for "spawn_per_iteration_hooks"
  Then the function is found in hooks.ts
```

**Result:** Tests passed, but hooks never executed in production. Function existed but was never called, had incorrect arguments, and failed silently.

### Correct Pattern: Behavioral Verification ✅

**Solution:** Execute the feature and verify observable outcomes.

Examples of behavioral verification (correct approach):
- Call function with input → verify output
- Trigger event → verify hook transcript exists
- Apply config → run feature → verify outcome
- Spawn process → verify process output captured
- Modify state → restart → verify state retained

**Real example from codebase:**
```gherkin
# ✅ CORRECT - compile.test.ts
Scenario: Compilation produces valid PROGRESS.yaml
  Given a SPRINT.yaml with 3 tasks
  When I run compile workflow
  Then PROGRESS.yaml is created
  And PROGRESS.yaml contains 3 task entries
  And each task has status: pending
  And PROGRESS.yaml schema validation passes
```

**Result:** Tests actual compilation behavior, file creation, content structure, and schema validity.

## Quick Decision Guide

Before writing a Gherkin scenario, ask:

| Question | Structural (Wrong) | Behavioral (Correct) |
|----------|-------------------|---------------------|
| Could this test pass even if feature is broken? | Yes → ❌ Bad test | No → ✅ Good test |
| Does it execute the feature? | No (just checks code) | Yes (runs and verifies) |
| Does it verify observable outcomes? | No (checks structure) | Yes (checks results) |
| Would this catch real bugs? | Unlikely | Yes |

**Rule of thumb:** Verification with `grep` alone is not a behavioral test.

For detailed decision matrices and anti-pattern examples, see `references/behavioral-vs-structural-testing.md`.

## Gherkin Patterns by Feature Type

Different feature types require different verification patterns. Select the pattern matching the feature type.

### Pattern Selection

| Feature Type | Pattern | Reference |
|--------------|---------|-----------|
| New user-facing feature | End-to-end workflow | `references/gherkin-patterns-by-feature-type.md` (Pattern 1) |
| External process (hooks, subagents) | Process lifecycle | Pattern 2 |
| State persistence | State modification cycle | Pattern 3 |
| API/integration | Request → response | Pattern 4 |
| Async/parallel operations | Concurrency scenario | Pattern 5 |
| Error handling/recovery | Failure injection | Pattern 6 |

### Pattern 1: End-to-End Feature Workflow

**Use when:** Testing new user-facing features.

**Template:** See `assets/scenario-template-feature.md`

**Structure:**
```gherkin
Scenario: [Feature name] works end-to-end
  Given [precondition - environment setup]
  When [user action - feature invocation]
  Then [primary outcome - main result]
  And [verification 1 - side effect]
  And [verification 2 - state change]
```

**Example:**
```gherkin
Scenario: Story detailing generates complete specification
  Given an epic with 5 story outlines in stories.md
  When I run /detail-story story-1
  Then a story folder .claude/stories/story-1/ is created
  And the folder contains 8 required files
  And story.md has complete frontmatter
  And gherkin.md contains full scenario catalogue
```

### Pattern 2: External Process Interaction

**Use when:** Feature spawns external processes (Claude CLI, bash scripts, hooks).

**Template:** See `assets/scenario-template-process.md`

**Structure:**
```gherkin
Scenario: [Process name] spawns and executes
  Given [trigger condition setup]
  When [event that triggers process]
  Then [process spawned - verify existence]
  And [output captured - transcript file]
  And [output correct - verify content]
  And [side effects - file system changes]
```

**Example:**
```gherkin
Scenario: Learning hook executes after iteration
  Given a sprint with learning hook enabled
  When iteration 1 completes
  Then a Claude CLI process is spawned
  And the hook transcript exists at .claude/sprints/{sprint}/hooks/learning/iteration-1.md
  And the transcript contains "## Extracted Learnings"
  And learnings are added to backlog.yaml
```

**Critical:** Process spawning scenarios **always require integration tests** (see Integration Test Requirements below).

### Pattern 3: State Persistence

**Use when:** Feature maintains state across boundaries (restarts, external edits).

**Template:** See `assets/scenario-template-state.md`

**Structure:**
```gherkin
Scenario: [State] persists across [boundary]
  Given [initial state setup]
  When [state modification]
  And [boundary crossed - restart, external edit]
  Then [state retained - verify integrity]
  And [no conflicts - verify merge logic]
```

**Example:**
```gherkin
Scenario: External PROGRESS.yaml edits are preserved
  Given a sprint with PROGRESS.yaml
  When I add custom field externally
  And I update checksum to match
  And sprint continues to next task
  Then custom field remains in PROGRESS.yaml
  And no checksum errors are logged
```

**Critical:** State persistence scenarios **always require integration tests**.

### Additional Patterns

For API integration, async/parallel operations, and error handling patterns, see `references/gherkin-patterns-by-feature-type.md`.

## Integration Test Requirements

### When Integration Tests Are Required

Integration tests (not unit tests) are **mandatory** for these feature types:

| Feature Type | Why Integration Test Required |
|--------------|------------------------------|
| External process spawning | Platform-specific behavior, IPC testing, output capture |
| File system state changes | File permissions, locks, atomicity, race conditions |
| Inter-process communication | Timing issues, serialization edge cases, connection handling |
| Async/parallel operations | Real race conditions, lock contention, ordering guarantees |
| Transaction/recovery | Crash scenarios, checksum validation, rollback logic |

**Decision rule:** If feature interacts with external systems (file system, processes, APIs), integration test is required.

### Unit Tests vs Integration Tests

| Characteristic | Unit Test | Integration Test |
|----------------|-----------|------------------|
| Scope | Single function in isolation | Multiple components or external systems |
| Dependencies | Mocked/stubbed | Real (file system, processes) |
| Speed | Fast (<10ms) | Slower (100ms-10s) |
| Use for | Pure functions, business logic | I/O, processes, state persistence |

**Example (Integration test required):**
```typescript
// ✅ CORRECT - Integration test with real file system
describe('[Integration] Sprint compilation', () => {
  it('creates PROGRESS.yaml with correct schema', async () => {
    await fs.writeFile('SPRINT.yaml', validContent);
    await compile('SPRINT.yaml');

    const progress = await fs.readFile('PROGRESS.yaml', 'utf-8');
    const parsed = yaml.parse(progress);
    expect(parsed.tasks).toHaveLength(3);
  });
});
```

**Example (Unit test sufficient):**
```typescript
// ✅ CORRECT - Unit test for pure function
describe('parseSprintYaml', () => {
  it('extracts tasks from valid YAML', () => {
    const result = parseSprintYaml('tasks:\n  - id: 1');
    expect(result.tasks).toHaveLength(1);
  });
});
```

For complete integration test criteria and decision logic, see `references/integration-test-requirements.md`.

## Integration with TDD Workflow

Gherkin scenarios integrate into each TDD phase:

### RED Phase: Write Behavioral Gherkin BEFORE Tests

1. Write Gherkin scenario describing desired behavior
2. Ensure scenario is behavioral (not structural)
3. Choose appropriate pattern (end-to-end, process, state, etc.)
4. Determine if integration test is required
5. Write failing test implementing the Gherkin scenario

**Example workflow:**
```markdown
1. Write Gherkin:
   Scenario: Hook executes after iteration
     Given sprint with hook enabled
     When iteration completes
     Then hook transcript exists

2. Identify: Process spawning → integration test required

3. Write failing integration test:
   it('spawns hook and captures output', async () => {
     await sprint.completeIteration();
     const transcript = await fs.readFile('hooks/learning/iteration-1.md');
     expect(transcript).toContain('## Extracted Learnings');
   });

4. Run test → RED (fails because hook not implemented)
```

### GREEN Phase: Verify Gherkin Scenarios Pass

1. Implement minimum code to make scenario pass
2. Run integration tests with real file system/processes
3. Verify all "Then" and "And" clauses are satisfied
4. Ensure no structural shortcuts (don't just make `grep` pass)

### REFACTOR Phase: Ensure Scenarios Still Pass

1. Refactor code while keeping tests green
2. Re-run integration tests after each change
3. Verify behavioral guarantees maintained
4. Update scenarios if behavior intentionally changes

## Real-World Examples

For detailed case studies from m42-claude-plugins development, see `references/real-world-examples.md`:

- **ralph-mode-implementation (Bad):** Structural verification with `grep` gave false confidence
- **compile.test.ts (Good):** Behavioral verification with real file creation
- **loop.test.ts (Good):** Mocked Claude API but tested real loop logic
- **Checksum validation (Good):** Tested actual failure detection, not just function existence

## Resources

This skill includes comprehensive reference materials and templates:

### references/
- `behavioral-vs-structural-testing.md` - Decision matrix, anti-patterns, selection logic
- `gherkin-patterns-by-feature-type.md` - 6 patterns with examples and selection guide
- `integration-test-requirements.md` - When integration tests are required, decision logic
- `real-world-examples.md` - Case studies from actual codebase with lessons learned

### assets/
- `scenario-template-feature.md` - Template for new user-facing features
- `scenario-template-process.md` - Template for external process interactions
- `scenario-template-state.md` - Template for state persistence scenarios

## Writing Process

To write effective Gherkin scenarios:

1. **Identify feature type:** New feature, process spawning, state persistence, API, etc.
2. **Choose pattern:** Select from 6 patterns in `references/gherkin-patterns-by-feature-type.md`
3. **Use template:** Start with template from `assets/scenario-template-feature.md`, `assets/scenario-template-process.md`, or `assets/scenario-template-state.md`
4. **Apply behavioral principle:** Ensure scenario tests execution, not code existence
5. **Determine test type:** Use decision logic in `references/integration-test-requirements.md`
6. **Write scenario:** Fill template with specific Given/When/Then/And clauses
7. **Verify behavioral:** Use quick decision guide above to confirm behavioral verification

## Self-Check Before Finalizing

Before considering a Gherkin scenario complete, verify:

- [ ] Scenario executes the feature (not just checks code exists)
- [ ] Observable outcomes are verified (files, state, output)
- [ ] Appropriate pattern used for feature type
- [ ] Integration test requirement determined
- [ ] No `grep` or structural verification shortcuts
- [ ] All "Then" and "And" clauses are specific and measurable
- [ ] Scenario would catch real bugs if feature breaks

**If any checkbox fails, revise using references and templates.**
