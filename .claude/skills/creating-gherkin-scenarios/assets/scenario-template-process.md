# Gherkin Scenario Template: External Process Interaction

Use this template for features that spawn external processes (Claude CLI, bash scripts, hooks, subagents).

## Template

```gherkin
Scenario: [Process name] spawns and executes
  Given [trigger condition setup - config, initial state]
  When [event that triggers process - iteration complete, command run]
  Then [process spawned - verify process exists, PID, or process list]
  And [process output captured - verify transcript/log file exists]
  And [output contains expected data - verify content structure]
  And [side effects observable - file system changes, state updates]
```

## Example: Learning Hook Execution

```gherkin
Scenario: Learning extraction hook executes after iteration
  Given a sprint with learning hook enabled in SPRINT.yaml
  And iteration 1 completes successfully
  When the sprint loop transitions to iteration 2
  Then a Claude CLI process is spawned with learning extraction prompt
  And the hook transcript is written to .claude/sprints/{sprint}/hooks/learning/iteration-1.md
  And the transcript contains "## Extracted Learnings" section
  And learnings are added to the backlog at .claude/sprints/{sprint}/learnings/backlog.yaml
  And the backlog entry has status: pending
```

## Guidelines

- **Given:** Set up configuration that enables process spawning
- **When:** Trigger the event that should spawn the process
- **Then (first):** Verify process was actually spawned (PID, process list, or child process)
- **And (second):** Verify output capture mechanism (transcript file, log file, stdout)
- **And (third):** Verify output content structure and correctness
- **And (fourth):** Verify downstream effects (database updates, file system changes)

## Critical Verifications

1. **Process spawned:** Don't just check if code exists that would spawn a process
2. **Output captured:** Verify transcript/log files are created and writable
3. **Content correct:** Verify the spawned process produced expected output
4. **Side effects:** Verify any downstream actions (file writes, state updates)

## Common Mistakes

- ❌ Only checking that spawn code exists (grep verification)
- ❌ Not verifying transcript/log file creation
- ❌ Not checking output content, only file existence
- ❌ Missing verification of downstream effects

## Anti-Pattern to Avoid

```gherkin
# ❌ WRONG - Only verifies spawn code exists
Scenario: Hook spawn function exists
  Given the codebase
  When I search for "spawnHook"
  Then the function is found in hooks.ts
```

## Correct Pattern

```gherkin
# ✅ CORRECT - Verifies actual execution
Scenario: Hook executes and captures output
  Given hook configuration enabled
  When trigger event occurs
  Then hook process is spawned
  And output is captured to file
  And output contains expected structure
```

## Integration Test Required

Process spawning scenarios **always require integration tests**:

```typescript
describe('[Integration] Hook execution', () => {
  it('spawns Claude process and captures output', async () => {
    const sprint = await setupTestSprint({ hooks: ['learning'] });
    await sprint.completeIteration(1);

    // Verify actual file created by spawned process
    const hookTranscript = await fs.readFile(
      `.claude/sprints/${sprint.id}/hooks/learning/iteration-1.md`
    );
    expect(hookTranscript).toContain('## Extracted Learnings');
  });
});
```

**Why integration test required:**
- Process spawning is platform-specific
- IPC mechanisms must be tested with real processes
- Output capture requires actual file I/O
- Cannot mock process lifecycle behavior
