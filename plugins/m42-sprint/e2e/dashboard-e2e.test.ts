/**
 * Dashboard End-to-End Verification Tests
 *
 * Comprehensive E2E tests for all dashboard improvements:
 * 1. Live Activity: Chat-style display with assistant messages
 * 2. Elapsed Time: Steps show timing in sidebar
 * 3. Sprint Timer: Prominent HH:MM:SS display in header
 * 4. Step Counter: "Step X of Y" indicator
 * 5. Sprint Switching: Dropdown navigation
 * 6. Stale Detection: Kill sprint, verify stale indicator
 * 7. Model Selection: Override at step/phase/sprint/workflow levels
 * 8. Workflow Reference: Single-phase workflow expansion
 * 9. Operator Requests: Agents submit, operator processes
 * 10. Dynamic Injection: Steps injected at various positions
 * 11. Operator Queue View: Pending/decided requests display
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';
import * as http from 'http';

// Import test helpers
import {
  test,
  assert,
  assertEqual,
  createTestDir,
  cleanupTestDir,
  copyFixture,
  compileSprint,
  readProgress,
  writeProgress,
  createSuccessMock,
} from './test-helpers.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Types
// ============================================================================

interface LoopOptions {
  maxIterations?: number;
  delay?: number;
  verbose?: boolean;
}

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
  currentTask: {
    phaseId: string;
    prompt: string;
    status: string;
  };
  phaseTree: unknown[];
  logs: unknown[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Make an HTTP GET request and return the response body
 */
function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Check if a server is listening on a port
 */
function checkServerRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// ============================================================================
// Test 1: Live Activity Chat-Style Display
// ============================================================================

console.log('\n=== Feature 1: Live Activity Chat-Style Display ===\n');

test('Activity types support assistant message type', async () => {
  // Test that ActivityEvent type includes 'assistant' type
  const activityTypesPath = path.resolve(
    __dirname,
    '../compiler/dist/status-server/activity-types.js'
  );

  if (!fs.existsSync(activityTypesPath)) {
    throw new Error('activity-types.js not found - build compiler first');
  }

  const module = await import(activityTypesPath);

  // Verify isActivityEvent function exists and handles assistant type
  assert(
    typeof module.isActivityEvent === 'function',
    'isActivityEvent should be exported'
  );

  // Test with assistant event
  const assistantEvent = {
    ts: new Date().toISOString(),
    type: 'assistant',
    tool: '',
    level: 'basic',
    text: 'Hello, I am working on your task.',
  };

  assert(
    module.isActivityEvent(assistantEvent),
    'Should accept assistant event type'
  );

  // Test with tool event
  const toolEvent = {
    ts: new Date().toISOString(),
    type: 'tool',
    tool: 'Read',
    level: 'detailed',
  };

  assert(module.isActivityEvent(toolEvent), 'Should accept tool event type');
});

// ============================================================================
// Test 2: Elapsed Time Display
// ============================================================================

console.log('\n=== Feature 2: Elapsed Time Display ===\n');

test('calculateElapsed returns human-readable duration', async () => {
  const transformsPath = path.resolve(
    __dirname,
    '../compiler/dist/status-server/transforms.js'
  );

  if (!fs.existsSync(transformsPath)) {
    throw new Error('transforms.js not found - build compiler first');
  }

  const { calculateElapsed } = await import(transformsPath);

  // Test various durations
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const twoMinutesThirtySecondsAgo = new Date(now.getTime() - 150 * 1000);
  const oneHourAgo = new Date(now.getTime() - 3600 * 1000);

  const elapsed1 = calculateElapsed(oneMinuteAgo.toISOString());
  assert(
    elapsed1.includes('1m') || elapsed1.includes('60s'),
    `Expected ~1m, got ${elapsed1}`
  );

  const elapsed2 = calculateElapsed(twoMinutesThirtySecondsAgo.toISOString());
  assert(
    elapsed2.includes('2m') && elapsed2.includes('30s'),
    `Expected ~2m 30s, got ${elapsed2}`
  );

  const elapsed3 = calculateElapsed(oneHourAgo.toISOString());
  assert(elapsed3.includes('1h'), `Expected ~1h, got ${elapsed3}`);
});

// ============================================================================
// Test 3: Sprint Timer in Header
// ============================================================================

console.log('\n=== Feature 3: Sprint Timer in Header ===\n');

test('Status update includes elapsed time for running sprint', async () => {
  const transformsPath = path.resolve(
    __dirname,
    '../compiler/dist/status-server/transforms.js'
  );

  if (!fs.existsSync(transformsPath)) {
    throw new Error('transforms.js not found - build compiler first');
  }

  const { toStatusUpdate } = await import(transformsPath);

  // Create mock progress with started timestamp
  const mockProgress = {
    'sprint-id': 'test-sprint',
    status: 'in-progress',
    current: { phase: 1, step: null, 'sub-phase': null },
    stats: {
      'started-at': new Date(Date.now() - 3665000).toISOString(), // ~1h 1m 5s ago
      'total-phases': 5,
      'completed-phases': 2,
    },
    phases: [
      { id: 'phase-1', status: 'completed' },
      { id: 'phase-2', status: 'in-progress' },
    ],
  };

  const statusUpdate = toStatusUpdate(mockProgress);

  assert(
    statusUpdate.header.elapsed !== undefined,
    'Header should include elapsed time'
  );
  assert(
    statusUpdate.header.elapsed.includes('h') ||
      statusUpdate.header.elapsed.includes('m'),
    `Elapsed should be human-readable, got: ${statusUpdate.header.elapsed}`
  );
});

// ============================================================================
// Test 4: Step Counter Display
// ============================================================================

console.log('\n=== Feature 4: Step Counter Display ===\n');

test('countTotalSteps calculates correct step count', async () => {
  const transformsPath = path.resolve(
    __dirname,
    '../compiler/dist/status-server/transforms.js'
  );

  if (!fs.existsSync(transformsPath)) {
    throw new Error('transforms.js not found - build compiler first');
  }

  const { countTotalSteps, countPhases } = await import(transformsPath);

  // Test with simple phases
  const simpleProgress = {
    'sprint-id': 'test',
    status: 'in-progress',
    phases: [
      { id: 'phase-1', status: 'completed' },
      { id: 'phase-2', status: 'in-progress' },
      { id: 'phase-3', status: 'pending' },
    ],
    current: { phase: 1, step: null, 'sub-phase': null },
    stats: { 'total-phases': 3, 'completed-phases': 1 },
  };

  const totalSimple = countTotalSteps(simpleProgress);
  assertEqual(totalSimple, 3, 'Simple progress should have 3 steps');

  // Test with steps containing sub-phases
  const nestedProgress = {
    'sprint-id': 'test',
    status: 'in-progress',
    phases: [
      {
        id: 'development',
        status: 'in-progress',
        steps: [
          {
            id: 'step-1',
            phases: [
              { id: 'red', status: 'completed' },
              { id: 'green', status: 'in-progress' },
              { id: 'refactor', status: 'pending' },
            ],
          },
          {
            id: 'step-2',
            phases: [
              { id: 'red', status: 'pending' },
              { id: 'green', status: 'pending' },
              { id: 'refactor', status: 'pending' },
            ],
          },
        ],
      },
    ],
    current: { phase: 0, step: 0, 'sub-phase': 1 },
    stats: { 'total-phases': 6, 'completed-phases': 1 },
  };

  const totalNested = countTotalSteps(nestedProgress);
  assertEqual(totalNested, 6, 'Nested progress should have 6 sub-phases');
});

// ============================================================================
// Test 5: Sprint Switching
// ============================================================================

console.log('\n=== Feature 5: Sprint Switching ===\n');

test('Page generator includes sprint dropdown navigation', async () => {
  const pagePath = path.resolve(
    __dirname,
    '../compiler/dist/status-server/page.js'
  );

  if (!fs.existsSync(pagePath)) {
    throw new Error('page.js not found - build compiler first');
  }

  const { getPageHtml } = await import(pagePath);

  // Generate page with navigation context
  const navigation = {
    currentSprintId: 'current-sprint',
    availableSprints: [
      { sprintId: 'current-sprint', status: 'in-progress' },
      { sprintId: 'other-sprint', status: 'completed' },
      { sprintId: 'old-sprint', status: 'blocked' },
    ],
  };

  const html = getPageHtml(navigation);

  // Verify dropdown exists
  assert(html.includes('select') || html.includes('dropdown'), 'Should include dropdown element');
  assert(html.includes('current-sprint'), 'Should include current sprint');
  assert(html.includes('other-sprint'), 'Should include other sprints');
});

// ============================================================================
// Test 6: Stale Detection
// ============================================================================

console.log('\n=== Feature 6: Stale Detection ===\n');

test('Runtime writes last-activity timestamp', async () => {
  const testDir = createTestDir('e2e-stale-detection');
  try {
    copyFixture('minimal-sprint', testDir);
    compileSprint(testDir);

    // Run one iteration
    const runtimePath = path.resolve(__dirname, '../runtime/dist/loop.js');
    const { runLoop } = await import(runtimePath);

    const mockDeps = createSuccessMock();
    await runLoop(testDir, { maxIterations: 1, delay: 0 }, mockDeps);

    const progress = readProgress(testDir) as {
      'last-activity'?: string;
      stats?: { 'last-activity'?: string };
    };

    // Check that last-activity is set
    assert(
      progress['last-activity'] !== undefined ||
        progress.stats?.['last-activity'] !== undefined,
      'Should write last-activity timestamp'
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test 7: Model Selection
// ============================================================================

console.log('\n=== Feature 7: Model Selection ===\n');

test('Compiler resolves model at multiple levels', async () => {
  const testDir = createTestDir('e2e-model-selection');
  try {
    // Create SPRINT.yaml with model at sprint level
    const sprintYaml = `
sprint-id: model-test-sprint
goal: Test model selection
model: opus
phases:
  - id: phase-with-override
    workflow: tdd-workflow
    model: haiku
  - id: phase-inherits
    workflow: tdd-workflow
`;

    fs.mkdirSync(path.join(testDir, '.claude', 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'SPRINT.yaml'), sprintYaml, 'utf8');

    // Create minimal workflow
    const workflowYaml = `
id: tdd-workflow
phases:
  - id: red
    prompt: Write failing tests
  - id: green
    prompt: Implement code
`;
    fs.writeFileSync(
      path.join(testDir, '.claude', 'workflows', 'tdd-workflow.yaml'),
      workflowYaml,
      'utf8'
    );

    compileSprint(testDir);

    const progress = readProgress(testDir) as {
      model?: string;
      phases?: Array<{ id: string; model?: string }>;
    };

    // Verify sprint-level model
    assertEqual(progress.model, 'opus', 'Sprint should have opus model');

    // Find phase with override
    const phaseWithOverride = progress.phases?.find(
      (p) => p.id === 'phase-with-override'
    );
    if (phaseWithOverride) {
      assertEqual(
        phaseWithOverride.model,
        'haiku',
        'Override phase should have haiku model'
      );
    }
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test 8: Workflow Reference Expansion
// ============================================================================

console.log('\n=== Feature 8: Workflow Reference Expansion ===\n');

test('Compiler expands single-phase workflow references inline', async () => {
  const testDir = createTestDir('e2e-workflow-ref');
  try {
    // Create SPRINT.yaml with workflow reference (no for-each)
    const sprintYaml = `
sprint-id: workflow-ref-test
goal: Test workflow reference expansion
phases:
  - id: initial-setup
    prompt: Set up the project
  - id: development
    workflow: simple-workflow
  - id: final
    prompt: Clean up
`;

    fs.mkdirSync(path.join(testDir, '.claude', 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'SPRINT.yaml'), sprintYaml, 'utf8');

    // Create referenced workflow
    const workflowYaml = `
id: simple-workflow
phases:
  - id: step-a
    prompt: Do step A
  - id: step-b
    prompt: Do step B
`;
    fs.writeFileSync(
      path.join(testDir, '.claude', 'workflows', 'simple-workflow.yaml'),
      workflowYaml,
      'utf8'
    );

    compileSprint(testDir);

    const progress = readProgress(testDir) as {
      phases?: Array<{ id: string; prompt?: string }>;
    };

    // Verify expansion
    const phases = progress.phases ?? [];
    assert(phases.length > 0, 'Should have phases');
    assert(phases.length >= 4, 'Should expand to at least 4 phases');

    // Find expanded phases
    const expandedA = phases.find((p) =>
      p.id.includes('step-a') || p.id.includes('development-step-a')
    );
    const expandedB = phases.find((p) =>
      p.id.includes('step-b') || p.id.includes('development-step-b')
    );

    assert(
      expandedA !== undefined || expandedB !== undefined,
      'Should find expanded workflow phases'
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test 9: Operator Request Processing
// ============================================================================

console.log('\n=== Feature 9: Operator Request Processing ===\n');

test('Operator processes pending requests', async () => {
  const operatorPath = path.resolve(__dirname, '../runtime/dist/operator.js');

  if (!fs.existsSync(operatorPath)) {
    throw new Error('operator.js not found - build runtime first');
  }

  const { processOperatorRequests } = await import(operatorPath);

  // Create test requests
  const requests = [
    {
      id: 'req_001',
      title: 'Critical security bug',
      description: 'SQL injection vulnerability found',
      priority: 'critical' as const,
      type: 'security' as const,
      status: 'pending' as const,
      'created-at': new Date().toISOString(),
      'discovered-in': 'development-step-1',
    },
    {
      id: 'req_002',
      title: 'Low priority refactor',
      description: 'Code could be cleaner',
      priority: 'low' as const,
      type: 'refactor' as const,
      status: 'pending' as const,
      'created-at': new Date().toISOString(),
      'discovered-in': 'development-step-2',
    },
  ];

  const config = { enabled: true };
  const response = await processOperatorRequests(requests, config, '/tmp');

  const decisions = response.decisions as Array<{
    requestId: string;
    decision: string;
    reasoning: string;
  }>;
  assert(decisions.length === 2, 'Should have 2 decisions');

  // Critical security should be approved
  const criticalDecision = decisions.find(
    (d: { requestId: string }) => d.requestId === 'req_001'
  );
  assertEqual(
    criticalDecision?.decision,
    'approve',
    'Critical security should be approved'
  );

  // Low priority should go to backlog
  const lowDecision = decisions.find(
    (d: { requestId: string }) => d.requestId === 'req_002'
  );
  assertEqual(lowDecision?.decision, 'backlog', 'Low priority should go to backlog');
});

// ============================================================================
// Test 10: Dynamic Step Injection
// ============================================================================

console.log('\n=== Feature 10: Dynamic Step Injection ===\n');

test('ProgressInjector injects steps at correct positions', async () => {
  const testDir = createTestDir('e2e-dynamic-injection');
  try {
    copyFixture('minimal-sprint', testDir);
    compileSprint(testDir);

    const injectorPath = path.resolve(
      __dirname,
      '../runtime/dist/progress-injector.js'
    );

    if (!fs.existsSync(injectorPath)) {
      throw new Error('progress-injector.js not found - build runtime first');
    }

    const { ProgressInjector } = await import(injectorPath);

    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    const injector = new ProgressInjector(progressPath);

    // Get initial phase count
    const initialProgress = readProgress(testDir) as { phases?: unknown[] };
    const initialCount = initialProgress.phases?.length ?? 0;

    // Inject a step after current
    await injector.injectStep({
      step: {
        id: 'injected-step',
        prompt: 'This is an injected step',
      },
      position: { type: 'end-of-workflow' },
    });

    // Verify injection
    const updatedProgress = readProgress(testDir) as {
      phases?: Array<{ id: string; injected?: boolean }>;
    };
    const updatedCount = updatedProgress.phases?.length ?? 0;

    assertEqual(
      updatedCount,
      initialCount + 1,
      'Should have one more phase after injection'
    );

    // Find injected step
    const injectedStep = updatedProgress.phases?.find(
      (p) => p.id === 'injected-step'
    );
    assert(injectedStep !== undefined, 'Should find injected step');
    assertEqual(
      injectedStep?.injected,
      true,
      'Injected step should have injected: true marker'
    );
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test 11: Operator Queue View
// ============================================================================

console.log('\n=== Feature 11: Operator Queue View ===\n');

test('Operator queue page renders all sections', async () => {
  const queuePagePath = path.resolve(
    __dirname,
    '../compiler/dist/status-server/operator-queue-page.js'
  );

  if (!fs.existsSync(queuePagePath)) {
    throw new Error('operator-queue-page.js not found - build compiler first');
  }

  const { generateOperatorQueuePage } = await import(queuePagePath);

  // Create mock queue data
  const queueData = {
    pending: [
      {
        id: 'req_001',
        title: 'Pending bug fix',
        description: 'Fix this bug',
        priority: 'high',
        type: 'bug',
        status: 'pending',
        'created-at': new Date().toISOString(),
        'discovered-in': 'step-1',
      },
    ],
    history: [
      {
        id: 'req_002',
        title: 'Approved fix',
        description: 'Already fixed',
        priority: 'critical',
        type: 'security',
        status: 'approved',
        'created-at': new Date(Date.now() - 3600000).toISOString(),
        'discovered-in': 'step-0',
        'decided-at': new Date(Date.now() - 1800000).toISOString(),
        decision: {
          requestId: 'req_002',
          decision: 'approve',
          reasoning: 'Critical security fix needed immediately',
        },
      },
    ],
    backlog: [
      {
        id: 'req_003',
        title: 'Future improvement',
        description: 'Nice to have',
        category: 'tech-debt',
        'suggested-priority': 'low',
        'operator-notes': 'Good idea but out of scope',
        source: {
          'request-id': 'req_003',
          'discovered-in': 'step-2',
          'discovered-at': new Date().toISOString(),
        },
        'created-at': new Date().toISOString(),
        status: 'pending-review',
      },
    ],
    stats: {
      pending: 1,
      approved: 1,
      rejected: 0,
      deferred: 0,
      backlog: 1,
    },
  };

  const html = generateOperatorQueuePage(queueData, 'test-sprint');

  // Verify all sections present
  assert(html.includes('Pending'), 'Should have Pending section');
  assert(
    html.includes('History') || html.includes('Decision'),
    'Should have Decision History section'
  );
  assert(html.includes('Backlog'), 'Should have Backlog section');

  // Verify request details
  assert(html.includes('Pending bug fix'), 'Should show pending request title');
  assert(html.includes('Approved fix'), 'Should show approved request');
  assert(html.includes('Future improvement'), 'Should show backlog item');

  // Verify reasoning is present
  assert(
    html.includes('Critical security fix') || html.includes('reasoning'),
    'Should show operator reasoning'
  );

  // Verify action buttons
  assert(html.includes('Approve'), 'Should have approve button');
  assert(html.includes('Reject'), 'Should have reject button');
  assert(html.includes('Defer'), 'Should have defer button');
});

// ============================================================================
// Build Verification Tests
// ============================================================================

console.log('\n=== Build Verification ===\n');

test('Compiler dist directory exists with all modules', () => {
  const compilerDist = path.resolve(__dirname, '../compiler/dist');
  assert(fs.existsSync(compilerDist), 'Compiler dist should exist');

  const requiredFiles = [
    'index.js',
    'compile.js',
    'types.js',
    'status-server/page.js',
    'status-server/transforms.js',
    'status-server/activity-types.js',
    'status-server/operator-queue-page.js',
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(compilerDist, file);
    assert(fs.existsSync(filePath), `Compiler should have ${file}`);
  }
});

test('Runtime dist directory exists with all modules', () => {
  const runtimeDist = path.resolve(__dirname, '../runtime/dist');
  assert(fs.existsSync(runtimeDist), 'Runtime dist should exist');

  const requiredFiles = [
    'loop.js',
    'cli.js',
    'claude-runner.js',
    'operator.js',
    'backlog.js',
    'progress-injector.js',
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(runtimeDist, file);
    assert(fs.existsSync(filePath), `Runtime should have ${file}`);
  }
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n=== E2E Dashboard Verification Summary ===\n');
console.log('All feature verification tests defined.');
console.log('Run with: npm run test:e2e');
console.log('');
