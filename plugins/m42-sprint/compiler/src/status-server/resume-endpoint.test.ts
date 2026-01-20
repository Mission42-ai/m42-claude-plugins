/**
 * Tests for Resume Endpoint - Step 2
 *
 * These tests verify that:
 * 1. POST /api/sprint/:id/resume endpoint exists
 * 2. Resume creates a signal file for the sprint runner to pick up
 * 3. Resume rejects non-resumable sprints (completed, etc.)
 * 4. Resume returns appropriate success/error responses
 *
 * GREEN Phase: Tests should PASS now that implementation is complete.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { StatusServer } from './server.js';

// Simple test runner (consistent with project patterns)
let testsPassed = 0;
let testsFailed = 0;
const testQueue: Array<{ name: string; fn: () => void | Promise<void> }> = [];
let testsStarted = false;

function test(name: string, fn: () => void | Promise<void>): void {
  testQueue.push({ name, fn });

  if (!testsStarted) {
    testsStarted = true;
    setImmediate(runTests);
  }
}

async function runTests(): Promise<void> {
  for (const { name, fn } of testQueue) {
    try {
      await fn();
      testsPassed++;
      console.log(`✓ ${name}`);
    } catch (error) {
      testsFailed++;
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
    }
  }

  console.log('');
  console.log(`Tests completed: ${testsPassed} passed, ${testsFailed} failed`);
  if (testsFailed > 0) {
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  const msg = message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
  if (actual !== expected) throw new Error(msg);
}

console.log('\n--- Step 2: Resume Endpoint Tests ---\n');

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestSprintDir(): string {
  const testDir = `/tmp/test-resume-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

function createProgressYaml(sprintDir: string, status: string): void {
  const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
  const content = yaml.dump({
    'sprint-id': 'test-sprint',
    status,
    current: { phase: 0, step: null, 'sub-phase': null },
    stats: { 'started-at': '2025-01-20T10:00:00Z', 'total-phases': 1, 'completed-phases': 0 },
    phases: [{ id: 'phase-1', status: 'pending', prompt: 'Test' }],
  });
  fs.writeFileSync(progressPath, content);
}

/**
 * Make an HTTP request and return the response
 */
function makeRequest(
  port: number,
  method: string,
  path: string
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 500, body });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

// ============================================================================
// Test: Source code has resume endpoint
// ============================================================================

test('server.ts should have /api/sprint/:id/resume route', async () => {
  // Read the server.ts source code
  const distDir = __dirname;
  const srcDir = distDir.replace(/[/\\]dist[/\\]/, '/src/');
  const srcPath = path.join(srcDir, 'server.ts');

  let sourceCode = '';
  if (fs.existsSync(srcPath)) {
    sourceCode = fs.readFileSync(srcPath, 'utf-8');
  }

  // Check for resume endpoint pattern
  const hasResumeRoute =
    sourceCode.includes('/api/sprint') && sourceCode.includes('resume') ||
    sourceCode.includes("'/resume'") ||
    sourceCode.includes('resumeMatch') ||
    sourceCode.includes('handleResumeRequest');

  assert(
    hasResumeRoute,
    'server.ts should have /api/sprint/:id/resume route (RED: expected to fail)'
  );
});

test('resume endpoint should create signal file', async () => {
  // Read the server.ts source code
  const distDir = __dirname;
  const srcDir = distDir.replace(/[/\\]dist[/\\]/, '/src/');
  const srcPath = path.join(srcDir, 'server.ts');

  let sourceCode = '';
  if (fs.existsSync(srcPath)) {
    sourceCode = fs.readFileSync(srcPath, 'utf-8');
  }

  // The resume handler should create a signal file
  const createsSignalFile =
    sourceCode.includes('.resume-requested') ||
    sourceCode.includes('resume-signal') ||
    sourceCode.includes('RESUME');

  assert(
    createsSignalFile,
    'Resume endpoint should create signal file (RED: expected to fail)'
  );
});

// ============================================================================
// Test: Resume endpoint integration (with actual server)
// ============================================================================

test('POST /api/sprint/:id/resume should return 200 for interrupted sprint', async () => {
  const testDir = createTestSprintDir();
  const port = 3500 + Math.floor(Math.random() * 100);
  try {
    // Create progress with interrupted status
    createProgressYaml(testDir, 'interrupted');

    const server = new StatusServer({
      sprintDir: testDir,
      port,
      host: 'localhost',
    });

    await server.start();
    await server.waitForReady();

    try {
      // Make POST request to resume endpoint
      const sprintId = path.basename(testDir);
      const response = await makeRequest(port, 'POST', `/api/sprint/${sprintId}/resume`);

      // Should return 200 OK
      assertEqual(
        response.statusCode,
        200,
        'Resume endpoint should return 200 for interrupted sprint (RED: expected to fail)'
      );

      // Response should indicate success
      const body = JSON.parse(response.body);
      assert(
        body.success === true,
        'Response should indicate success'
      );
    } finally {
      await server.stop();
    }
  } finally {
    cleanupTestDir(testDir);
  }
});

test('POST /api/sprint/:id/resume should return 400 for completed sprint', async () => {
  const testDir = createTestSprintDir();
  const port = 3600 + Math.floor(Math.random() * 100);
  try {
    // Create progress with completed status
    createProgressYaml(testDir, 'completed');

    const server = new StatusServer({
      sprintDir: testDir,
      port,
      host: 'localhost',
    });

    await server.start();
    await server.waitForReady();

    try {
      // Make POST request to resume endpoint
      const sprintId = path.basename(testDir);
      const response = await makeRequest(port, 'POST', `/api/sprint/${sprintId}/resume`);

      // Should return 400 Bad Request
      assertEqual(
        response.statusCode,
        400,
        'Resume endpoint should return 400 for completed sprint (RED: expected to fail)'
      );

      // Response should indicate error
      const body = JSON.parse(response.body);
      assert(
        body.success === false || body.error !== undefined,
        'Response should indicate error'
      );
    } finally {
      await server.stop();
    }
  } finally {
    cleanupTestDir(testDir);
  }
});

test('resume should create .resume-requested signal file', async () => {
  const testDir = createTestSprintDir();
  const port = 3700 + Math.floor(Math.random() * 100);
  try {
    // Create progress with interrupted status
    createProgressYaml(testDir, 'interrupted');

    const server = new StatusServer({
      sprintDir: testDir,
      port,
      host: 'localhost',
    });

    await server.start();
    await server.waitForReady();

    try {
      // Make POST request to resume endpoint
      const sprintId = path.basename(testDir);
      await makeRequest(port, 'POST', `/api/sprint/${sprintId}/resume`);

      // Check for signal file
      const signalPath = path.join(testDir, '.resume-requested');
      assert(
        fs.existsSync(signalPath),
        'Resume should create .resume-requested signal file (RED: expected to fail)'
      );
    } finally {
      await server.stop();
    }
  } finally {
    cleanupTestDir(testDir);
  }
});

test('GET /api/sprint/:id/resume should return 405 Method Not Allowed', async () => {
  const testDir = createTestSprintDir();
  const port = 3800 + Math.floor(Math.random() * 100);
  try {
    createProgressYaml(testDir, 'interrupted');

    const server = new StatusServer({
      sprintDir: testDir,
      port,
      host: 'localhost',
    });

    await server.start();
    await server.waitForReady();

    try {
      // Make GET request (should be rejected)
      const sprintId = path.basename(testDir);
      const response = await makeRequest(port, 'GET', `/api/sprint/${sprintId}/resume`);

      // Should return 405 Method Not Allowed
      assertEqual(
        response.statusCode,
        405,
        'GET /resume should return 405 Method Not Allowed (RED: expected to fail)'
      );
    } finally {
      await server.stop();
    }
  } finally {
    cleanupTestDir(testDir);
  }
});

console.log('\nResume endpoint tests completed.\n');
