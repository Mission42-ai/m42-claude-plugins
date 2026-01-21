# Step Context: step-8

## Task
Run complete end-to-end verification of all dashboard improvements.

Test all features:
1. Live Activity: Start sprint, verify chat-style display with assistant messages
2. Elapsed time: Verify steps show timing in sidebar
3. Sprint timer: Verify prominent HH:MM:SS display in header
4. Step count: Verify "Step X of Y" indicator
5. Sprint switching: Use dropdown to switch sprints
6. Stale detection: Kill a sprint and verify stale indicator
7. Model selection: Verify model override works at step/phase/sprint/workflow levels
8. Workflow reference: Verify single-phase workflow references expand correctly
9. Operator requests: Verify agents can submit requests, operator processes them
10. Dynamic injection: Verify steps can be injected at various positions
11. Operator queue view: Verify pending/decided requests display with reasoning

Build and test:
- Run npm run build in plugins/m42-sprint/compiler
- Run npm run build in plugins/m42-sprint/runtime
- Reinstall plugin and verify all features work

## Implementation Plan
Based on gherkin scenarios, execute verification in this order:
1. Build both compiler and runtime packages
2. Verify all unit test files pass (11 scenario-specific test files)
3. Run E2E test suite in plugins/m42-sprint/e2e
4. Verify build artifacts contain all required modules
5. Document any failing tests and required fixes

## Related Code Patterns

### Pattern from: e2e/test-helpers.ts
```typescript
// Test utility pattern used across all E2E tests
function test(name: string, fn: () => void | Promise<void>): void {
  Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`✓ ${name}`);
    })
    .catch((error) => {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
      process.exitCode = 1;
    });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
```

### Pattern from: e2e/dashboard-e2e.test.ts
```typescript
// Dynamic import pattern for compiled modules
const activityTypesPath = path.resolve(
  __dirname,
  '../compiler/dist/status-server/activity-types.js'
);
const module = await import(activityTypesPath);
assert(
  typeof module.isActivityEvent === 'function',
  'isActivityEvent should be exported'
);
```

### Pattern from: e2e/runtime.e2e.test.ts
```typescript
// Mock Claude runner for testing
const mockDeps = createSuccessMock();
const options: LoopOptions = { maxIterations: 10, delay: 0, verbose: false };
const result = await runLoop(testDir, options, mockDeps);
assertEqual(result.finalState.status, 'completed', 'Should complete');
```

## Required Imports
### Internal
- `test-helpers.ts`: test, assert, assertEqual, createTestDir, cleanupTestDir, copyFixture, compileSprint, readProgress, writeProgress, createSuccessMock

### External
- `fs`: File system operations
- `path`: Path resolution
- `yaml (js-yaml)`: YAML parsing/serialization
- `http`: HTTP requests for server tests

## Types/Interfaces to Use
```typescript
// From e2e/test-helpers.ts
interface MockClaudeResponse {
  success: boolean;
  output: string;
  exitCode: number;
  error?: string;
  jsonResult?: Record<string, unknown>;
}

interface MockClaudeRunner {
  runClaude: (options: { prompt: string; cwd?: string }) => Promise<MockClaudeResponse>;
}

// From dashboard-e2e.test.ts
interface StatusUpdate {
  header: {
    sprintId: string;
    status: string;
    progressPercent: number;
    iteration: number;
    elapsed?: string;
    totalSteps?: number;
    currentStep?: number;
  };
  currentTask: { phaseId: string; prompt: string; status: string };
  phaseTree: unknown[];
  logs: unknown[];
}

// From operator-queue-page.test.ts
interface OperatorQueueData {
  pending: QueuedRequest[];
  history: QueuedRequest[];
  backlog: BacklogItem[];
  stats: OperatorQueueStats;
}
```

## Integration Points
- Called by: Sprint verification step (final step in sprint)
- Calls: compiler/dist modules, runtime/dist modules, E2E test harness

## Files to Verify Exist

| File | Package | Purpose |
|------|---------|---------|
| `compiler/dist/index.js` | compiler | Main entry point |
| `compiler/dist/compile.js` | compiler | Compilation logic |
| `compiler/dist/types.js` | compiler | Type definitions |
| `compiler/dist/status-server/page.js` | compiler | Dashboard HTML generation |
| `compiler/dist/status-server/transforms.js` | compiler | PROGRESS.yaml transformations |
| `compiler/dist/status-server/activity-types.js` | compiler | Activity event types |
| `compiler/dist/status-server/operator-queue-page.js` | compiler | Operator queue view |
| `runtime/dist/loop.js` | runtime | Main execution loop |
| `runtime/dist/cli.js` | runtime | CLI entry point |
| `runtime/dist/claude-runner.js` | runtime | Claude CLI wrapper |
| `runtime/dist/operator.js` | runtime | Operator request processing |
| `runtime/dist/backlog.js` | runtime | Backlog management |
| `runtime/dist/progress-injector.js` | runtime | Dynamic step injection |

## Test Files to Run

| Test File | Scenario | Expected Pass Count |
|-----------|----------|---------------------|
| `compiler/src/status-server/activity-types.test.ts` | 1: Live Activity | 6+ |
| `compiler/src/status-server/transcription-watcher.test.ts` | 1: Live Activity | 5+ |
| `compiler/src/status-server/transforms.test.ts` | 2: Elapsed Time | 8+ |
| `compiler/src/status-server/total-duration.test.ts` | 3: Sprint Timer | 3+ |
| `compiler/src/status-server/step-progress.test.ts` | 4: Step Counter | 4+ |
| `compiler/src/status-server/dropdown-navigation.test.ts` | 5: Sprint Switching | 4+ |
| `compiler/src/status-server/resume-endpoint.test.ts` | 6: Stale Detection | 3+ |
| `compiler/src/model-selection.test.ts` | 7: Model Selection | 5+ |
| `compiler/src/workflow-reference.test.ts` | 8: Workflow Reference | 5+ |
| `runtime/src/operator.test.ts` | 9: Operator Requests | 6+ |
| `runtime/src/progress-injector.test.ts` | 10: Dynamic Injection | 6+ |
| `compiler/src/status-server/operator-queue-page.test.ts` | 11: Operator Queue View | 15+ |

## E2E Test File
- Location: `plugins/m42-sprint/e2e/dashboard-e2e.test.ts`
- Tests all 11 features integrated
- Uses mock Claude runner for reproducible testing
- Includes build verification tests

## Verification Commands

### Build Commands
```bash
# Build compiler
cd plugins/m42-sprint/compiler && npm run build

# Build runtime
cd plugins/m42-sprint/runtime && npm run build

# Build E2E tests
cd plugins/m42-sprint/e2e && npm run build
```

### Test Commands
```bash
# Run compiler unit tests
cd plugins/m42-sprint/compiler && npm run test

# Run runtime unit tests
cd plugins/m42-sprint/runtime && npm run test

# Run E2E tests
cd plugins/m42-sprint/e2e && npm run test
```

### Individual Scenario Verification
```bash
# Scenario 1: Live Activity
cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/activity-types.test.js

# Scenario 2: Elapsed Time
cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/transforms.test.js

# Scenario 3: Sprint Timer
cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/total-duration.test.js

# Scenario 4: Step Counter
cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/step-progress.test.js

# Scenario 5: Sprint Switching
cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/dropdown-navigation.test.js

# Scenario 6: Stale Detection
cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/resume-endpoint.test.js

# Scenario 7: Model Selection
cd plugins/m42-sprint/compiler && npm run build && node dist/model-selection.test.js

# Scenario 8: Workflow Reference
cd plugins/m42-sprint/compiler && npm run build && node dist/workflow-reference.test.js

# Scenario 9: Operator Requests
cd plugins/m42-sprint/runtime && npm run build && node dist/operator.test.js

# Scenario 10: Dynamic Injection
cd plugins/m42-sprint/runtime && npm run build && node dist/progress-injector.test.js

# Scenario 11: Operator Queue View
cd plugins/m42-sprint/compiler && npm run build && node dist/status-server/operator-queue-page.test.js
```

## Test Fixtures
- `e2e/fixtures/minimal-sprint/`: Minimal sprint for basic tests
- `e2e/fixtures/bugfix-sprint/`: Sprint with 3-level hierarchy (steps with sub-phases)
- `e2e/fixtures/workflows/`: Shared workflow definitions for tests

## Success Criteria
- All 11 gherkin scenarios must pass (score = 11/11)
- Both compiler and runtime builds must complete without errors
- All unit tests must pass (exit code 0)
- E2E dashboard tests must verify all features integrated correctly

## Notes
- Tests use Node.js native test runner (no external framework)
- Mock Claude runner returns predetermined responses for reproducibility
- File operations use temporary directories for isolation
- Checksum validation ensures PROGRESS.yaml integrity
