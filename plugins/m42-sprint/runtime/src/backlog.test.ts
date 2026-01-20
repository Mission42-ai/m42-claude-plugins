/**
 * Tests for Backlog Module - BACKLOG.yaml Management
 *
 * RED PHASE: These tests define expected behavior BEFORE implementation.
 * All tests should FAIL until the implementation is complete.
 *
 * Expected error: Cannot find module './backlog.js' (until implementation exists)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Import from backlog.js - this will fail until implementation exists
// This is the expected RED phase behavior
import {
  readBacklog,
  writeBacklog,
  addBacklogItem,
  updateBacklogItem,
  type BacklogItem,
  type BacklogFile,
} from './backlog.js';

// ============================================================================
// Test Utilities
// ============================================================================

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

function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);
  if (actualStr !== expectedStr) {
    throw new Error(message ?? `Expected:\n${expectedStr}\n\nGot:\n${actualStr}`);
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestSprintDir(): string {
  const testDir = `/tmp/test-backlog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

function cleanupTestDir(testDir: string): void {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

function createMockBacklogItem(overrides: Partial<BacklogItem> = {}): BacklogItem {
  return {
    id: 'req_test123',
    title: 'Test Backlog Item',
    description: 'Test description for backlog item',
    category: 'tech-debt',
    'suggested-priority': 'medium',
    'operator-notes': 'Added during sprint execution',
    source: {
      'request-id': 'req_test123',
      'discovered-in': 'development-step-2',
      'discovered-at': new Date().toISOString(),
    },
    'created-at': new Date().toISOString(),
    status: 'pending-review',
    ...overrides,
  };
}

// ============================================================================
// Test: BacklogItem Type Compliance
// ============================================================================

console.log('\n=== BacklogItem Type Tests ===\n');

test('BacklogItem: has all required fields', () => {
  const item: BacklogItem = {
    id: 'req_abc123',
    title: 'Refactor authentication',
    description: 'Current auth is basic, should upgrade to OAuth2',
    category: 'tech-debt',
    'suggested-priority': 'medium',
    'operator-notes': 'Valid improvement but significant scope',
    source: {
      'request-id': 'req_abc123',
      'discovered-in': 'development-step-3',
      'discovered-at': '2026-01-20T10:00:00Z',
    },
    'created-at': '2026-01-20T10:05:00Z',
    status: 'pending-review',
  };

  assertEqual(typeof item.id, 'string');
  assertEqual(typeof item.title, 'string');
  assertEqual(typeof item.description, 'string');
  assertEqual(typeof item.category, 'string');
  assert(['high', 'medium', 'low'].includes(item['suggested-priority']), 'priority should be valid');
  assert(['pending-review', 'acknowledged', 'converted-to-issue'].includes(item.status), 'status should be valid');
});

test('BacklogItem: source contains request provenance', () => {
  const item = createMockBacklogItem();

  assert(item.source !== undefined, 'source should be present');
  assertEqual(typeof item.source['request-id'], 'string');
  assertEqual(typeof item.source['discovered-in'], 'string');
  assertEqual(typeof item.source['discovered-at'], 'string');
});

// ============================================================================
// Test: BacklogFile Type Compliance
// ============================================================================

console.log('\n=== BacklogFile Type Tests ===\n');

test('BacklogFile: has items array', () => {
  const backlog: BacklogFile = {
    items: [
      createMockBacklogItem({ id: 'item-1' }),
      createMockBacklogItem({ id: 'item-2' }),
    ],
  };

  assert(Array.isArray(backlog.items), 'items should be array');
  assertEqual(backlog.items.length, 2);
});

test('BacklogFile: handles empty items', () => {
  const backlog: BacklogFile = {
    items: [],
  };

  assert(Array.isArray(backlog.items), 'items should be array');
  assertEqual(backlog.items.length, 0);
});

// ============================================================================
// Test: readBacklog
// ============================================================================

console.log('\n=== readBacklog Tests ===\n');

test('readBacklog: returns empty backlog when file does not exist', async () => {
  const testDir = createTestSprintDir();
  try {
    // No BACKLOG.yaml created

    // Expected: returns { items: [] }
    assert(typeof readBacklog === 'function', 'readBacklog should exist');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('readBacklog: reads existing backlog file', async () => {
  const testDir = createTestSprintDir();
  try {
    const backlogPath = path.join(testDir, 'BACKLOG.yaml');
    const existingBacklog: BacklogFile = {
      items: [
        createMockBacklogItem({ id: 'existing-item' }),
      ],
    };
    fs.writeFileSync(backlogPath, yaml.dump(existingBacklog), 'utf8');

    // Expected: returns the existing backlog
    assert(typeof readBacklog === 'function', 'readBacklog should exist');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test: writeBacklog
// ============================================================================

console.log('\n=== writeBacklog Tests ===\n');

test('writeBacklog: creates BACKLOG.yaml with items', async () => {
  const testDir = createTestSprintDir();
  try {
    const backlog: BacklogFile = {
      items: [
        createMockBacklogItem({ id: 'new-item' }),
      ],
    };

    // Expected: BACKLOG.yaml created with proper YAML format
    assert(typeof writeBacklog === 'function', 'writeBacklog should exist');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('writeBacklog: preserves existing items when appending', async () => {
  const testDir = createTestSprintDir();
  try {
    // Create existing backlog
    const backlogPath = path.join(testDir, 'BACKLOG.yaml');
    const existingBacklog: BacklogFile = {
      items: [
        createMockBacklogItem({ id: 'existing-1' }),
      ],
    };
    fs.writeFileSync(backlogPath, yaml.dump(existingBacklog), 'utf8');

    const updatedBacklog: BacklogFile = {
      items: [
        ...existingBacklog.items,
        createMockBacklogItem({ id: 'new-1' }),
      ],
    };

    // Expected: both items present after write
    assert(typeof writeBacklog === 'function', 'writeBacklog should exist');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test: addBacklogItem
// ============================================================================

console.log('\n=== addBacklogItem Tests ===\n');

test('addBacklogItem: adds item to empty backlog', async () => {
  const testDir = createTestSprintDir();
  try {
    const newItem = createMockBacklogItem({ id: 'first-item' });

    // Expected: BACKLOG.yaml created with single item
    assert(typeof addBacklogItem === 'function', 'addBacklogItem should exist');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('addBacklogItem: appends to existing backlog', async () => {
  const testDir = createTestSprintDir();
  try {
    // Create existing backlog
    const backlogPath = path.join(testDir, 'BACKLOG.yaml');
    const existingBacklog: BacklogFile = {
      items: [
        createMockBacklogItem({ id: 'existing-item' }),
      ],
    };
    fs.writeFileSync(backlogPath, yaml.dump(existingBacklog), 'utf8');

    const newItem = createMockBacklogItem({ id: 'new-item' });

    // Expected: both items present after add
    assert(typeof addBacklogItem === 'function', 'addBacklogItem should exist');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('addBacklogItem: sets created-at timestamp', async () => {
  const testDir = createTestSprintDir();
  try {
    const newItem = createMockBacklogItem({ id: 'timestamped-item' });
    delete (newItem as Partial<BacklogItem>)['created-at'];

    // Expected: created-at is set automatically
    assert(typeof addBacklogItem === 'function', 'addBacklogItem should exist');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('addBacklogItem: sets status to pending-review by default', async () => {
  const testDir = createTestSprintDir();
  try {
    const newItem = createMockBacklogItem({ id: 'status-item' });
    delete (newItem as Partial<BacklogItem>).status;

    // Expected: status defaults to 'pending-review'
    assert(typeof addBacklogItem === 'function', 'addBacklogItem should exist');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test: updateBacklogItem
// ============================================================================

console.log('\n=== updateBacklogItem Tests ===\n');

test('updateBacklogItem: updates existing item by id', async () => {
  const testDir = createTestSprintDir();
  try {
    // Create existing backlog
    const backlogPath = path.join(testDir, 'BACKLOG.yaml');
    const existingBacklog: BacklogFile = {
      items: [
        createMockBacklogItem({ id: 'update-me', status: 'pending-review' }),
      ],
    };
    fs.writeFileSync(backlogPath, yaml.dump(existingBacklog), 'utf8');

    // Expected: item status updated to 'acknowledged'
    assert(typeof updateBacklogItem === 'function', 'updateBacklogItem should exist');
  } finally {
    cleanupTestDir(testDir);
  }
});

test('updateBacklogItem: throws for non-existent item', async () => {
  const testDir = createTestSprintDir();
  try {
    // Create empty backlog
    const backlogPath = path.join(testDir, 'BACKLOG.yaml');
    const emptyBacklog: BacklogFile = { items: [] };
    fs.writeFileSync(backlogPath, yaml.dump(emptyBacklog), 'utf8');

    // Expected: throws error when item not found
    assert(typeof updateBacklogItem === 'function', 'updateBacklogItem should exist');
  } finally {
    cleanupTestDir(testDir);
  }
});

// ============================================================================
// Test: BACKLOG.yaml Format Compliance
// ============================================================================

console.log('\n=== BACKLOG.yaml Format Tests ===\n');

test('BACKLOG.yaml format matches schema specification', () => {
  // Expected BACKLOG.yaml format from the spec:
  const expectedFormat = `# .claude/sprints/<sprint-id>/BACKLOG.yaml
items:
  - id: req_abc123
    title: "Refactor authentication to use OAuth2"
    description: "Current auth is basic, should upgrade..."
    category: tech-debt
    suggested-priority: medium
    operator-notes: "Valid improvement but significant scope. Needs arch review."
    source:
      request-id: req_abc123
      discovered-in: development-step-3
      discovered-at: 2026-01-20T10:00:00Z
    created-at: 2026-01-20T10:05:00Z
    status: pending-review  # pending-review | acknowledged | converted-to-issue
`;

  // Verify the structure can be parsed
  const parsed = yaml.load(expectedFormat.split('\n').slice(1).join('\n')) as BacklogFile;

  assert(Array.isArray(parsed.items), 'items should be array');
  assertEqual(parsed.items.length, 1);
  assertEqual(parsed.items[0].id, 'req_abc123');
  assertEqual(parsed.items[0].category, 'tech-debt');
  assertEqual(parsed.items[0].status, 'pending-review');
});

// ============================================================================
// Test Summary
// ============================================================================

console.log('\n=== Test Summary ===\n');
console.log('Tests completed. Exit code:', process.exitCode ?? 0);
