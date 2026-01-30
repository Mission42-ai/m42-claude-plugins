---
title: Integration Test Requirements
description: Criteria for when integration tests are required vs unit tests, with decision logic and implementation patterns
keywords: integration tests, unit tests, test strategy, external processes, file system
file-type: reference
skill: creating-gherkin-scenarios
---

# Integration Test Requirements

## Decision: Unit vs Integration Test

| Characteristic | Unit Test | Integration Test |
|----------------|-----------|------------------|
| Scope | Single function/module in isolation | Multiple components or external systems |
| Dependencies | Mocked/stubbed | Real (file system, processes, APIs) |
| Speed | Fast (<10ms) | Slower (100ms-10s) |
| Determinism | Fully deterministic | May have timing/environment variability |
| Complexity | Simple setup/teardown | Complex environment setup |

## When Integration Tests Are Required

### 1. External Process Spawning

**Scenario:** Feature spawns Claude CLI, bash scripts, or other processes.

**Why integration test required:**
- Process spawning has platform-specific behavior
- IPC mechanisms must be tested (stdin/stdout/files)
- Process lifecycle (spawn → execute → terminate) must be verified
- Output capture and error handling are critical paths

**Example:**
```typescript
// Integration test required (not unit test)
describe('Learning hook execution', () => {
  it('spawns Claude process and captures output', async () => {
    const sprint = await setupTestSprint({ hooks: ['learning'] });
    await sprint.completeIteration(1);

    // Verify actual process spawned
    const hookTranscript = await fs.readFile(
      `.claude/sprints/${sprint.id}/hooks/learning/iteration-1.md`
    );
    expect(hookTranscript).toContain('## Extracted Learnings');
  });
});
```

**Cannot mock:** Process spawning, file I/O, subprocess communication.

### 2. File System State Changes

**Scenario:** Feature creates/modifies/deletes files or directories.

**Why integration test required:**
- File permissions, locks, and race conditions are platform-specific
- Atomic operations (rename, temp file) must be tested in real environment
- File watching and change detection require actual file system events
- Error cases (disk full, permission denied) need real scenarios

**Example:**
```typescript
// Integration test required
describe('Sprint compilation', () => {
  it('creates PROGRESS.yaml with correct schema', async () => {
    await fs.writeFile('SPRINT.yaml', validSprintYaml);
    await compile('SPRINT.yaml');

    // Verify actual file created
    const progress = await fs.readFile('PROGRESS.yaml', 'utf-8');
    const parsed = yaml.parse(progress);
    expect(parsed.tasks).toHaveLength(3);
    expect(parsed.tasks[0].status).toBe('pending');
  });
});
```

**Cannot mock:** File creation, schema validation against real files, checksum generation.

### 3. Inter-Process Communication

**Scenario:** Components communicate via files, sockets, or message queues.

**Why integration test required:**
- Timing issues (race conditions, message ordering) only appear with real IPC
- Serialization/deserialization edge cases
- Connection handling (retries, timeouts, cleanup)

**Example:**
```typescript
// Integration test required
describe('Hook-to-sprint communication', () => {
  it('hook writes backlog entries that sprint reads', async () => {
    const hook = await spawnLearningHook({ iteration: 1 });
    await hook.complete();

    // Verify IPC via file system
    const backlog = await readBacklog();
    expect(backlog.pending).toHaveLength(3);
    expect(backlog.pending[0].source).toBe('iteration-1');
  });
});
```

**Cannot mock:** File-based IPC, timing of writes/reads, concurrent access.

### 4. Async/Parallel Operations

**Scenario:** Multiple operations run concurrently with shared state.

**Why integration test required:**
- Race conditions only manifest with real async execution
- Lock contention and deadlock scenarios
- Ordering guarantees under parallelism

**Example:**
```typescript
// Integration test required
describe('Parallel story detailing', () => {
  it('handles concurrent writes without corruption', async () => {
    const promises = [1, 2, 3].map(id => detailStory(`story-${id}`));
    await Promise.all(promises);

    // Verify all succeeded without file conflicts
    for (const id of [1, 2, 3]) {
      const story = await fs.readFile(`.claude/stories/story-${id}/story.md`);
      expect(story).toContain(`story-${id}`); // Correct content, not mixed
    }
  });
});
```

**Cannot mock:** True parallelism, file system race conditions, lock behavior.

### 5. Transaction/Recovery Scenarios

**Scenario:** Feature must maintain consistency across failures.

**Why integration test required:**
- Partial writes, crash recovery, rollback logic require real file system
- Checksum validation, backup/restore mechanisms
- Idempotency under retries

**Example:**
```typescript
// Integration test required
describe('Sprint crash recovery', () => {
  it('restores state from checkpoint after crash', async () => {
    const sprint = await startSprint();
    await sprint.completeTask(1);

    // Simulate crash
    await sprint.kill();

    // Verify recovery
    const resumed = await resumeSprint(sprint.id);
    expect(resumed.currentTask).toBe(2); // Continued from checkpoint
  });
});
```

**Cannot mock:** Crash scenarios, file corruption, state restoration.

## When Unit Tests Are Sufficient

### Pure Functions
```typescript
// Unit test sufficient
describe('parseSprintYaml', () => {
  it('extracts tasks from valid YAML', () => {
    const result = parseSprintYaml('tasks:\n  - id: 1\n    name: Test');
    expect(result.tasks).toHaveLength(1);
  });
});
```

### Business Logic (No I/O)
```typescript
// Unit test sufficient
describe('estimateTaskDuration', () => {
  it('calculates DEEP estimate correctly', () => {
    const estimate = estimateTaskDuration({ complexity: 'high', uncertainty: 0.5 });
    expect(estimate.hours).toBeGreaterThan(4);
  });
});
```

### Mocked External Dependencies
```typescript
// Unit test sufficient (mocked Claude API)
describe('ClaudeRunner', () => {
  it('sends correct prompt to API', async () => {
    const mockApi = jest.fn().mockResolvedValue({ result: 'success' });
    const runner = new ClaudeRunner({ api: mockApi });

    await runner.run('Test prompt');
    expect(mockApi).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'Test prompt'
    }));
  });
});
```

## Implementation Pattern

### Directory Structure
```
tests/
├─ unit/              # Fast, isolated tests
│  ├─ parse.test.ts
│  ├─ validate.test.ts
│  └─ estimate.test.ts
└─ integration/       # Slower, real dependencies
   ├─ compile.test.ts
   ├─ loop.test.ts
   └─ hooks.test.ts
```

### Test Naming Convention
```typescript
// Integration tests clearly marked
describe('[Integration] Sprint compilation', () => { ... });
describe('[Integration] Hook execution', () => { ... });

// Unit tests default (no marker needed)
describe('YAML parsing', () => { ... });
```

### Setup/Teardown
```typescript
// Integration test: Real file system cleanup
beforeEach(async () => {
  testDir = await createTempDir();
  process.chdir(testDir);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true });
});
```

## Decision Logic

```
Does feature interact with external systems? (file system, processes, APIs, databases)
├─ Yes → Integration test required
└─ No → Unit test sufficient

Can behavior be fully verified with mocks?
├─ Yes → Unit test sufficient
└─ No (timing, platform-specific behavior, actual I/O needed) → Integration test required

Does feature spawn processes or use IPC?
└─ Yes → Integration test required (always)

Does feature modify file system state?
└─ Yes → Integration test required (always)

Is feature pure logic/computation?
└─ Yes → Unit test sufficient
```
