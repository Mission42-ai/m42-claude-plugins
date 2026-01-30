# Gherkin Scenario Template: State Persistence

Use this template for features that maintain state across boundaries (restarts, external edits, crashes).

## Template

```gherkin
Scenario: [State] persists across [boundary]
  Given [initial state setup - create files, initialize data]
  When [state modification - user action that changes state]
  And [boundary crossed - restart, external edit, crash, power loss]
  Then [state retained - verify data integrity after boundary]
  And [no conflicts - verify merge logic or locking worked]
  And [consistency maintained - verify constraints still hold]
```

## Example: External PROGRESS.yaml Edits

```gherkin
Scenario: External PROGRESS.yaml modifications are preserved
  Given a sprint in progress with PROGRESS.yaml checksum
  When I add a custom field "notes: manual annotation" to PROGRESS.yaml externally
  And I update the checksum file to match
  And the sprint loop continues to next task
  Then the "notes" field remains in PROGRESS.yaml
  And no checksum validation errors are logged
  And subsequent loop iterations preserve the custom field
  And the sprint can still modify other fields (status, summary)
```

## Guidelines

- **Given:** Create initial state with specific, verifiable values
- **When (first):** Modify state in a specific way
- **And (second):** Cross a boundary (restart, external edit, crash simulation)
- **Then:** Verify state was preserved across the boundary
- **And:** Verify no data loss, corruption, or conflicts occurred

## State Boundaries to Test

| Boundary Type | Example Scenario |
|---------------|------------------|
| Process restart | Kill process → restart → verify state retained |
| External edit | Modify file outside process → verify changes preserved |
| Crash recovery | Simulate crash mid-write → verify rollback or recovery |
| Concurrent access | Two processes modify same file → verify no corruption |
| Power loss simulation | Incomplete write → verify atomicity or cleanup |

## Critical Verifications

1. **Data integrity:** Original data not lost or corrupted
2. **New data preserved:** Modifications survived the boundary
3. **No conflicts:** Merge logic or locking prevented corruption
4. **Constraints maintained:** Business rules still enforced

## Common Mistakes

- ❌ Only testing happy path (no boundary crossing)
- ❌ Not verifying preservation of externally added fields
- ❌ Missing conflict/corruption scenarios
- ❌ Not testing partial writes or crash scenarios

## Anti-Pattern to Avoid

```gherkin
# ❌ WRONG - No boundary crossing
Scenario: State modification works
  Given initial state
  When I modify state
  Then state is updated
```

## Correct Pattern

```gherkin
# ✅ CORRECT - Tests persistence across boundary
Scenario: State survives restart
  Given initial state persisted to disk
  When I modify state
  And I restart the application
  Then modified state is loaded correctly
  And no data loss occurred
```

## Example: Crash Recovery

```gherkin
Scenario: Sprint recovers from mid-task crash
  Given a sprint with 3 tasks
  And task-1 is completed
  And task-2 is in progress (50% complete)
  When the sprint process is killed (simulated crash)
  And the sprint is restarted
  Then task-1 remains completed (not re-run)
  And task-2 is resumed from checkpoint (or restarted if no checkpoint)
  And PROGRESS.yaml reflects correct current state
  And no duplicate task executions occur
```

## Integration Test Required

State persistence scenarios **always require integration tests**:

```typescript
describe('[Integration] State persistence', () => {
  it('preserves external edits across loop iterations', async () => {
    const sprint = await setupTestSprint();
    await sprint.startLoop();

    // External modification
    const progress = await sprint.readProgress();
    progress.customField = 'user annotation';
    await fs.writeFile('PROGRESS.yaml', yaml.stringify(progress));
    await sprint.updateChecksum();

    // Continue loop
    await sprint.completeNextTask();

    // Verify preservation
    const finalProgress = await sprint.readProgress();
    expect(finalProgress.customField).toBe('user annotation');
  });
});
```

**Why integration test required:**
- File system state must be tested with real I/O
- Atomicity and crash scenarios require actual file operations
- Locking and concurrent access are platform-specific
- Cannot mock checkpoint/recovery behavior
