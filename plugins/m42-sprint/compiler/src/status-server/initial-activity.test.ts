/**
 * Test for BUG-003: Live Activity Always Shows "Waiting for activity"
 *
 * ROOT CAUSE: When an SSE client connects, the StatusServer sends initial
 * `status-update` and `log-entry` events, but does NOT send historical
 * activity events from .sprint-activity.jsonl.
 *
 * The ActivityWatcher correctly reads initial content and emits 'activity'
 * events during server startup. However, no SSE clients are connected at
 * that time, so the historical activity is lost.
 *
 * When a client later connects, it only receives status updates and shows
 * "Waiting for activity..." because no activity events are sent.
 *
 * EXPECTED: When an SSE client connects, it should receive:
 * 1. status-update (current progress)
 * 2. log-entry (connection message)
 * 3. activity-event (for each historical activity entry, up to tailLines)
 *
 * This test verifies that historical activity is sent to newly connected clients.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as http from 'http';

import { StatusServer } from './server.js';
import type { ActivityEvent } from './activity-types.js';

// ============================================================================
// Test Framework
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
  skipped?: boolean;
}

const testResults: TestResult[] = [];
let currentTest = '';

function test(name: string, fn: () => void | Promise<void>): void {
  currentTest = name;
  const result = fn();
  if (result instanceof Promise) {
    result
      .then(() => {
        console.log(`✓ ${name}`);
        testResults.push({ name, passed: true });
      })
      .catch((error) => {
        console.error(`✗ ${name}`);
        console.error(`  ${error.message}`);
        testResults.push({ name, passed: false, error });
        process.exitCode = 1;
      });
  } else {
    console.log(`✓ ${name}`);
    testResults.push({ name, passed: true });
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a minimal PROGRESS.yaml for StatusServer
 */
function createMinimalProgressYaml(): string {
  return `
sprint-id: test-sprint
status: in-progress
stats:
  started-at: "2026-01-20T12:00:00Z"
  total-phases: 0
  completed-phases: 0
current:
  phase: 0
  step: null
  sub-phase: null
phases: []
`.trim();
}

/**
 * Create activity event JSONL entries
 */
function createActivityEvents(count: number): string {
  const events: string[] = [];
  for (let i = 0; i < count; i++) {
    const event: ActivityEvent = {
      ts: new Date(Date.now() - (count - i) * 1000).toISOString(),
      type: 'tool',
      tool: ['Read', 'Write', 'Edit', 'Bash', 'Grep'][i % 5],
      level: 'basic',
      file: `/test/file-${i}.ts`,
    };
    events.push(JSON.stringify(event));
  }
  return events.join('\n') + '\n';
}

/**
 * Create a temp directory with required files
 */
async function createTestSprintDir(options?: { activityCount?: number }): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-initial-activity-test-'));
  fs.writeFileSync(path.join(tmpDir, 'PROGRESS.yaml'), createMinimalProgressYaml());

  if (options?.activityCount && options.activityCount > 0) {
    const activityFile = path.join(tmpDir, '.sprint-activity.jsonl');
    fs.writeFileSync(activityFile, createActivityEvents(options.activityCount));
  }

  return tmpDir;
}

/**
 * Cleanup temp directory
 */
function cleanupTestDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Collect SSE events from a server
 */
interface CollectedEvents {
  statusUpdates: unknown[];
  logEntries: unknown[];
  activityEvents: unknown[];
}

function collectSSEEvents(port: number, timeout: number = 3000): Promise<CollectedEvents> {
  return new Promise((resolve, reject) => {
    const collected: CollectedEvents = {
      statusUpdates: [],
      logEntries: [],
      activityEvents: [],
    };

    const timeoutId = setTimeout(() => {
      req.destroy();
      resolve(collected);
    }, timeout);

    const req = http.get(`http://localhost:${port}/events`, (res) => {
      res.setEncoding('utf8');
      let buffer = '';

      res.on('data', (chunk) => {
        buffer += chunk;

        // Parse complete SSE messages
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || '';

        for (const msg of messages) {
          if (!msg.trim()) continue;

          const lines = msg.split('\n');
          const eventLine = lines.find((l) => l.startsWith('event: '));
          const dataLine = lines.find((l) => l.startsWith('data: '));

          if (!eventLine || !dataLine) continue;

          const eventType = eventLine.slice(7);
          try {
            const data = JSON.parse(dataLine.slice(6));

            switch (eventType) {
              case 'status-update':
                collected.statusUpdates.push(data);
                break;
              case 'log-entry':
                collected.logEntries.push(data);
                break;
              case 'activity-event':
                collected.activityEvents.push(data);
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      });

      res.on('error', reject);
    });

    req.on('error', reject);
  });
}

// ============================================================================
// BUG-003 Test: Historical Activity Not Sent on Connect
// ============================================================================

test('BUG-003: Historical activity should be sent to newly connected SSE clients', async () => {
  const activityCount = 5;
  const tmpDir = await createTestSprintDir({ activityCount });
  const port = 3400 + Math.floor(Math.random() * 100);

  try {
    // Create server - activity file already exists with events
    const server = new StatusServer({
      sprintDir: tmpDir,
      port,
      host: 'localhost',
      debounceDelay: 50,
    });

    await server.start();
    await server.waitForReady();

    // Wait a bit to ensure ActivityWatcher has read initial content
    await sleep(300);

    // NOW connect SSE client (after server has started and read initial content)
    const collected = await collectSSEEvents(port, 2000);

    await server.stop();

    // Verify we received status update
    assert(
      collected.statusUpdates.length > 0,
      'Should receive at least 1 status-update on connect'
    );

    // Verify we received log entry
    assert(
      collected.logEntries.length > 0,
      'Should receive at least 1 log-entry on connect'
    );

    // BUG-003: This assertion FAILS because historical activity is NOT sent
    // to newly connected SSE clients
    assert(
      collected.activityEvents.length > 0,
      `BUG-003: Historical activity should be sent to newly connected clients. ` +
        `Server had ${activityCount} activity events in .sprint-activity.jsonl, ` +
        `but SSE client received ${collected.activityEvents.length} activity-event messages. ` +
        `This is why Live Activity shows "Waiting for activity..." - ` +
        `historical events are lost when watcher starts before clients connect.`
    );

    // Verify we received all historical events
    assert(
      collected.activityEvents.length === activityCount,
      `Should receive all ${activityCount} historical activity events. ` +
        `Received ${collected.activityEvents.length}.`
    );
  } finally {
    cleanupTestDir(tmpDir);
  }
});

test('BUG-003: Activity events should include correct data structure', async () => {
  const tmpDir = await createTestSprintDir({ activityCount: 1 });
  const port = 3500 + Math.floor(Math.random() * 100);

  try {
    const server = new StatusServer({
      sprintDir: tmpDir,
      port,
      host: 'localhost',
      debounceDelay: 50,
    });

    await server.start();
    await server.waitForReady();
    await sleep(300);

    const collected = await collectSSEEvents(port, 2000);
    await server.stop();

    // This will fail if BUG-003 exists (no activity events)
    // But if the previous test's fix is in place, we can verify structure
    if (collected.activityEvents.length > 0) {
      const event = collected.activityEvents[0] as { type: string; data: ActivityEvent; timestamp: string };

      assert(event.type === 'activity-event', 'Event type should be activity-event');
      assert(event.data !== undefined, 'Event should have data');
      assert(typeof event.data.ts === 'string', 'Activity data should have ts');
      assert(event.data.type === 'tool', 'Activity data type should be tool');
      assert(typeof event.data.tool === 'string', 'Activity data should have tool');
    } else {
      // This is expected to fail while BUG-003 exists
      assert(
        false,
        'BUG-003: No activity events received. ' +
          'Historical activity is not sent to newly connected clients.'
      );
    }
  } finally {
    cleanupTestDir(tmpDir);
  }
});

test('Empty activity file should not break initial connection', async () => {
  const tmpDir = await createTestSprintDir({ activityCount: 0 });
  const port = 3600 + Math.floor(Math.random() * 100);

  try {
    // Create empty activity file
    fs.writeFileSync(path.join(tmpDir, '.sprint-activity.jsonl'), '');

    const server = new StatusServer({
      sprintDir: tmpDir,
      port,
      host: 'localhost',
      debounceDelay: 50,
    });

    await server.start();
    await server.waitForReady();
    await sleep(200);

    const collected = await collectSSEEvents(port, 1000);
    await server.stop();

    // Should still get status update even with empty activity
    assert(
      collected.statusUpdates.length > 0,
      'Should receive status-update even with empty activity file'
    );

    // Activity events being empty is OK here
    assert(
      collected.activityEvents.length === 0,
      'Should receive 0 activity events for empty activity file'
    );
  } finally {
    cleanupTestDir(tmpDir);
  }
});

test('No activity file should not break initial connection', async () => {
  const tmpDir = await createTestSprintDir({ activityCount: 0 });
  const port = 3700 + Math.floor(Math.random() * 100);

  try {
    // Ensure no activity file exists
    const activityFile = path.join(tmpDir, '.sprint-activity.jsonl');
    if (fs.existsSync(activityFile)) {
      fs.unlinkSync(activityFile);
    }

    const server = new StatusServer({
      sprintDir: tmpDir,
      port,
      host: 'localhost',
      debounceDelay: 50,
    });

    await server.start();
    await server.waitForReady();
    await sleep(200);

    const collected = await collectSSEEvents(port, 1000);
    await server.stop();

    // Should still get status update even without activity file
    assert(
      collected.statusUpdates.length > 0,
      'Should receive status-update even without activity file'
    );
  } finally {
    cleanupTestDir(tmpDir);
  }
});

// ============================================================================
// Print Summary
// ============================================================================

// Wait for async tests to complete
setTimeout(() => {
  console.log('\n--- Test Summary ---');
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}`);
        if (r.error) {
          console.log(`    ${r.error.message}`);
        }
      });
  }
}, 15000);
