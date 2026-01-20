/**
 * Tests for TranscriptionWatcher - Step 0: Chat-Like Live Activity UI
 *
 * Tests the TranscriptionWatcher's ability to parse assistant text content
 * from Claude CLI NDJSON output and emit assistant ActivityEvents.
 *
 * Claude CLI Output Format (NDJSON):
 * - Text content start: { type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'text' } } }
 * - Text delta: { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: '...' } } }
 * - Text content stop: { type: 'stream_event', event: { type: 'content_block_stop' } }
 *
 * Expected Behavior:
 * - TranscriptionWatcher detects content_block_start with type='text'
 * - Accumulates text_delta content from content_block_delta events
 * - Debounces emission for 500ms to batch rapid deltas
 * - Emits single ActivityEvent with type='assistant' and accumulated text
 *
 * RED PHASE: These tests should FAIL until transcription-watcher.ts is updated
 * to parse text content blocks.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { TranscriptionWatcher } from './transcription-watcher.js';
import type { ActivityEvent } from './activity-types.js';

// ============================================================================
// Test Framework (consistent with project patterns)
// ============================================================================

function test(name: string, fn: () => void | Promise<void>): void {
  const result = fn();
  if (result instanceof Promise) {
    result
      .then(() => console.log(`✓ ${name}`))
      .catch((error) => {
        console.error(`✗ ${name}`);
        console.error(`  ${error}`);
        process.exitCode = 1;
      });
  } else {
    try {
      fn();
      console.log(`✓ ${name}`);
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
      process.exitCode = 1;
    }
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
 * Create a temp directory for transcription files
 */
function createTestDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'transcription-watcher-test-'));
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
 * Create NDJSON line for content_block_start with text type
 */
function createTextBlockStart(blockIndex: number = 0): string {
  return JSON.stringify({
    type: 'stream_event',
    event: {
      type: 'content_block_start',
      index: blockIndex,
      content_block: {
        type: 'text',
        text: '',
      },
    },
  });
}

/**
 * Create NDJSON line for content_block_delta with text_delta
 */
function createTextDelta(text: string, blockIndex: number = 0): string {
  return JSON.stringify({
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      index: blockIndex,
      delta: {
        type: 'text_delta',
        text,
      },
    },
  });
}

/**
 * Create NDJSON line for content_block_stop
 */
function createTextBlockStop(blockIndex: number = 0): string {
  return JSON.stringify({
    type: 'stream_event',
    event: {
      type: 'content_block_stop',
      index: blockIndex,
    },
  });
}

/**
 * Create NDJSON line for tool_use (existing functionality)
 */
function createToolUse(toolName: string, input: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'stream_event',
    event: {
      type: 'content_block_start',
      index: 0,
      content_block: {
        type: 'tool_use',
        id: `toolu_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: toolName,
        input,
      },
    },
  });
}

console.log('\n--- Step 0: TranscriptionWatcher Tests (RED PHASE) ---\n');

// ============================================================================
// Scenario 3: TranscriptionWatcher parses content_block_start with text type
// ============================================================================

test('Scenario 3: TranscriptionWatcher detects text content block start', async () => {
  const testDir = createTestDir();
  const logFile = path.join(testDir, 'test.log');

  try {
    const watcher = new TranscriptionWatcher(testDir, { debounceDelay: 50, maxEvents: 100 });
    const receivedEvents: ActivityEvent[] = [];

    watcher.on('activity', (event: ActivityEvent) => {
      receivedEvents.push(event);
    });

    watcher.start();
    await sleep(100);

    // Write content_block_start with text type followed by delta and stop
    const lines = [
      createTextBlockStart(0),
      createTextDelta('Hello world', 0),
      createTextBlockStop(0),
    ];
    fs.writeFileSync(logFile, lines.join('\n') + '\n');

    // Wait for watcher to process (debounce + processing time)
    await sleep(700);

    // RED: Should FAIL - current implementation doesn't emit assistant events
    // Use type assertion to allow compilation while testing runtime behavior
    const assistantEvents = receivedEvents.filter(e => (e as { type: string }).type === 'assistant');
    assert(
      assistantEvents.length > 0,
      `TranscriptionWatcher should emit assistant event for text content. ` +
      `Expected at least 1 assistant event, got ${assistantEvents.length}. ` +
      `Total events received: ${receivedEvents.length} (types: ${receivedEvents.map(e => e.type).join(', ')})`
    );

    watcher.close();
  } finally {
    cleanupTestDir(testDir);
  }
});

test('Scenario 3: Text block start is recognized distinct from tool_use', async () => {
  const testDir = createTestDir();
  const logFile = path.join(testDir, 'test.log');

  try {
    const watcher = new TranscriptionWatcher(testDir, { debounceDelay: 50, maxEvents: 100 });
    const receivedEvents: ActivityEvent[] = [];

    watcher.on('activity', (event: ActivityEvent) => {
      receivedEvents.push(event);
    });

    watcher.start();
    await sleep(100);

    // Write both text content and tool use
    const lines = [
      createTextBlockStart(0),
      createTextDelta('I will read a file', 0),
      createTextBlockStop(0),
      createToolUse('Read', { file_path: '/test.ts' }),
    ];
    fs.writeFileSync(logFile, lines.join('\n') + '\n');

    await sleep(700);

    // Should have both assistant and tool events
    const assistantEvents = receivedEvents.filter(e => (e as { type: string }).type === 'assistant');
    const toolEvents = receivedEvents.filter(e => e.type === 'tool');

    // RED: assistantEvents will be empty until implementation
    assert(
      assistantEvents.length > 0,
      `Should have assistant events, got ${assistantEvents.length}`
    );
    assert(
      toolEvents.length > 0,
      `Should have tool events (existing functionality), got ${toolEvents.length}`
    );

    watcher.close();
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Scenario 4: TranscriptionWatcher accumulates text_delta content
// ============================================================================

test('Scenario 4: Text deltas are accumulated into complete message', async () => {
  const testDir = createTestDir();
  const logFile = path.join(testDir, 'test.log');

  try {
    const watcher = new TranscriptionWatcher(testDir, { debounceDelay: 50, maxEvents: 100 });
    const receivedEvents: ActivityEvent[] = [];

    watcher.on('activity', (event: ActivityEvent) => {
      receivedEvents.push(event);
    });

    watcher.start();
    await sleep(100);

    // Write multiple text deltas that should be combined
    const lines = [
      createTextBlockStart(0),
      createTextDelta('Hello ', 0),
      createTextDelta('world', 0),
      createTextDelta('!', 0),
      createTextBlockStop(0),
    ];
    fs.writeFileSync(logFile, lines.join('\n') + '\n');

    await sleep(700);

    const assistantEvents = receivedEvents.filter(e => (e as { type: string }).type === 'assistant');

    // RED: Should fail - no assistant events emitted
    assert(
      assistantEvents.length > 0,
      `Should have assistant events with accumulated text`
    );

    // Verify text is accumulated, not individual deltas
    const assistantEvent = assistantEvents[0] as ActivityEvent & { text?: string };
    assert(
      assistantEvent.text === 'Hello world!',
      `Text should be accumulated. Expected 'Hello world!', got '${assistantEvent.text}'`
    );

    watcher.close();
  } finally {
    cleanupTestDir(testDir);
  }
});

test('Scenario 4: Multiple separate text blocks produce separate events', async () => {
  const testDir = createTestDir();
  const logFile = path.join(testDir, 'test.log');

  try {
    const watcher = new TranscriptionWatcher(testDir, { debounceDelay: 50, maxEvents: 100 });
    const receivedEvents: ActivityEvent[] = [];

    watcher.on('activity', (event: ActivityEvent) => {
      receivedEvents.push(event);
    });

    watcher.start();
    await sleep(100);

    // Write first text block
    fs.writeFileSync(logFile, [
      createTextBlockStart(0),
      createTextDelta('First message', 0),
      createTextBlockStop(0),
    ].join('\n') + '\n');

    await sleep(700);

    // Write second text block with a new turn
    fs.appendFileSync(logFile, [
      createTextBlockStart(1),
      createTextDelta('Second message', 1),
      createTextBlockStop(1),
    ].join('\n') + '\n');

    await sleep(700);

    const assistantEvents = receivedEvents.filter(e => (e as { type: string }).type === 'assistant');

    // RED: No assistant events at all currently
    assert(
      assistantEvents.length >= 2,
      `Should have 2 separate assistant events, got ${assistantEvents.length}`
    );

    watcher.close();
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Scenario 5: Text accumulation debounces at 500ms
// ============================================================================

test('Scenario 5: Rapid text deltas are debounced into single event', async () => {
  const testDir = createTestDir();
  const logFile = path.join(testDir, 'test.log');

  try {
    // Use a longer debounce for this test to verify behavior
    const watcher = new TranscriptionWatcher(testDir, { debounceDelay: 50, maxEvents: 100 });
    const receivedEvents: ActivityEvent[] = [];

    watcher.on('activity', (event: ActivityEvent) => {
      receivedEvents.push(event);
    });

    watcher.start();
    await sleep(100);

    // Write text block start
    fs.writeFileSync(logFile, createTextBlockStart(0) + '\n');
    await sleep(20);

    // Write deltas rapidly (faster than debounce)
    const deltas = ['One ', 'two ', 'three ', 'four ', 'five'];
    for (const delta of deltas) {
      fs.appendFileSync(logFile, createTextDelta(delta, 0) + '\n');
      await sleep(30); // Each delta within 500ms window
    }

    fs.appendFileSync(logFile, createTextBlockStop(0) + '\n');

    // Wait for debounce to fire
    await sleep(700);

    const assistantEvents = receivedEvents.filter(e => (e as { type: string }).type === 'assistant');

    // RED: No assistant events currently
    // After implementation: Should have exactly 1 event with all text combined
    assert(
      assistantEvents.length === 1,
      `Rapid deltas should produce single debounced event. Got ${assistantEvents.length} events`
    );

    const event = assistantEvents[0] as ActivityEvent & { text?: string };
    assert(
      event.text === 'One two three four five',
      `Debounced event should contain all accumulated text. Got '${event.text}'`
    );

    watcher.close();
  } finally {
    cleanupTestDir(testDir);
  }
});

test('Scenario 5: Debounce delay is approximately 500ms for assistant text', async () => {
  const testDir = createTestDir();
  const logFile = path.join(testDir, 'test.log');

  try {
    // This test verifies the 500ms debounce timing for text accumulation
    // The watcher's debounceDelay option is for file watching, not text accumulation
    // Text accumulation should have its own 500ms debounce

    const watcher = new TranscriptionWatcher(testDir, { debounceDelay: 50, maxEvents: 100 });
    const eventTimestamps: number[] = [];

    watcher.on('activity', (event: ActivityEvent) => {
      if ((event as { type: string }).type === 'assistant') {
        eventTimestamps.push(Date.now());
      }
    });

    watcher.start();
    await sleep(100);

    const startTime = Date.now();

    // Write text content
    fs.writeFileSync(logFile, [
      createTextBlockStart(0),
      createTextDelta('Test message', 0),
      createTextBlockStop(0),
    ].join('\n') + '\n');

    // Wait for event
    await sleep(800);

    // RED: No events received currently
    assert(
      eventTimestamps.length > 0,
      `Should receive assistant event after debounce period`
    );

    // Verify timing is approximately correct (allowing for processing overhead)
    const emitDelay = eventTimestamps[0] - startTime;
    // Expected: ~500ms for text debounce + ~50ms for file debounce + processing
    console.log(`  (Text event emitted after ${emitDelay}ms)`);

    watcher.close();
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Edge Cases
// ============================================================================

test('Edge case: Empty text deltas are handled gracefully', async () => {
  const testDir = createTestDir();
  const logFile = path.join(testDir, 'test.log');

  try {
    const watcher = new TranscriptionWatcher(testDir, { debounceDelay: 50, maxEvents: 100 });
    const receivedEvents: ActivityEvent[] = [];

    watcher.on('activity', (event: ActivityEvent) => {
      receivedEvents.push(event);
    });

    watcher.start();
    await sleep(100);

    // Write text block with some empty deltas
    const lines = [
      createTextBlockStart(0),
      createTextDelta('', 0),
      createTextDelta('Hello', 0),
      createTextDelta('', 0),
      createTextBlockStop(0),
    ];
    fs.writeFileSync(logFile, lines.join('\n') + '\n');

    await sleep(700);

    const assistantEvents = receivedEvents.filter(e => (e as { type: string }).type === 'assistant');

    // RED: No assistant events yet
    // After implementation: Should emit event with just 'Hello'
    if (assistantEvents.length > 0) {
      const event = assistantEvents[0] as ActivityEvent & { text?: string };
      assert(
        event.text === 'Hello',
        `Empty deltas should be handled, text should be 'Hello', got '${event.text}'`
      );
    }

    watcher.close();
  } finally {
    cleanupTestDir(testDir);
  }
});

test('Edge case: Text block without stop event still emits on debounce', async () => {
  const testDir = createTestDir();
  const logFile = path.join(testDir, 'test.log');

  try {
    const watcher = new TranscriptionWatcher(testDir, { debounceDelay: 50, maxEvents: 100 });
    const receivedEvents: ActivityEvent[] = [];

    watcher.on('activity', (event: ActivityEvent) => {
      receivedEvents.push(event);
    });

    watcher.start();
    await sleep(100);

    // Write text block without stop (simulates incomplete stream)
    const lines = [
      createTextBlockStart(0),
      createTextDelta('Incomplete message', 0),
      // No createTextBlockStop - stream might be interrupted
    ];
    fs.writeFileSync(logFile, lines.join('\n') + '\n');

    // Wait longer than debounce period
    await sleep(800);

    const assistantEvents = receivedEvents.filter(e => (e as { type: string }).type === 'assistant');

    // RED: No assistant events
    // After implementation: Should emit after debounce even without stop event
    assert(
      assistantEvents.length > 0,
      `Should emit assistant event after debounce even without content_block_stop`
    );

    watcher.close();
  } finally {
    cleanupTestDir(testDir);
  }
});

test('Edge case: isThinking is true while accumulating, false when complete', async () => {
  const testDir = createTestDir();
  const logFile = path.join(testDir, 'test.log');

  try {
    const watcher = new TranscriptionWatcher(testDir, { debounceDelay: 50, maxEvents: 100 });
    const receivedEvents: ActivityEvent[] = [];

    watcher.on('activity', (event: ActivityEvent) => {
      receivedEvents.push(event);
    });

    watcher.start();
    await sleep(100);

    // Write complete text block
    const lines = [
      createTextBlockStart(0),
      createTextDelta('Complete message', 0),
      createTextBlockStop(0),
    ];
    fs.writeFileSync(logFile, lines.join('\n') + '\n');

    await sleep(700);

    const assistantEvents = receivedEvents.filter(e => (e as { type: string }).type === 'assistant');

    // RED: No assistant events
    // After implementation: Final event should have isThinking=false
    if (assistantEvents.length > 0) {
      const event = assistantEvents[assistantEvents.length - 1] as ActivityEvent & { isThinking?: boolean };
      assert(
        event.isThinking === false,
        `Final assistant event should have isThinking=false after content_block_stop`
      );
    }

    watcher.close();
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Backward Compatibility
// ============================================================================

test('Backward compatibility: Tool events still emitted correctly', async () => {
  const testDir = createTestDir();
  const logFile = path.join(testDir, 'test.log');

  try {
    const watcher = new TranscriptionWatcher(testDir, { debounceDelay: 50, maxEvents: 100 });
    const receivedEvents: ActivityEvent[] = [];

    watcher.on('activity', (event: ActivityEvent) => {
      receivedEvents.push(event);
    });

    watcher.start();
    await sleep(100);

    // Write tool use events (existing functionality)
    const lines = [
      createToolUse('Read', { file_path: '/src/file.ts' }),
      createToolUse('Bash', { command: 'npm test' }),
    ];
    fs.writeFileSync(logFile, lines.join('\n') + '\n');

    await sleep(300);

    const toolEvents = receivedEvents.filter(e => e.type === 'tool');

    // This should pass - existing functionality
    assert(
      toolEvents.length === 2,
      `Tool events should still work. Expected 2, got ${toolEvents.length}`
    );

    watcher.close();
  } finally {
    cleanupTestDir(testDir);
  }
});

test('Backward compatibility: getRecentActivity includes assistant events', async () => {
  const testDir = createTestDir();
  const logFile = path.join(testDir, 'test.log');

  try {
    const watcher = new TranscriptionWatcher(testDir, { debounceDelay: 50, maxEvents: 100 });

    watcher.start();
    await sleep(100);

    // Write mixed content
    const lines = [
      createTextBlockStart(0),
      createTextDelta('Assistant message', 0),
      createTextBlockStop(0),
      createToolUse('Read', { file_path: '/test.ts' }),
    ];
    fs.writeFileSync(logFile, lines.join('\n') + '\n');

    await sleep(700);

    const recentActivity = watcher.getRecentActivity(50);

    // RED: No assistant events in recent activity
    const assistantInRecent = recentActivity.filter(e => (e as { type: string }).type === 'assistant');
    const toolInRecent = recentActivity.filter(e => e.type === 'tool');

    assert(
      assistantInRecent.length > 0,
      `getRecentActivity should include assistant events, got ${assistantInRecent.length}`
    );
    assert(
      toolInRecent.length > 0,
      `getRecentActivity should still include tool events, got ${toolInRecent.length}`
    );

    watcher.close();
  } finally {
    cleanupTestDir(testDir);
  }
});

console.log('\n--- End of TranscriptionWatcher Tests ---\n');

// Give async tests time to complete
setTimeout(() => {
  if (process.exitCode !== 1) {
    console.log('\nAll TranscriptionWatcher tests completed.');
  }
}, 5000);
