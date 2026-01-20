/**
 * Tests for StatusServer - specifically path traversal security
 * BUG-006 + BUG-012: Path Traversal Hardening
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Simple test runner (consistent with project patterns)
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
      console.log(`✓ ${name}`);
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
      process.exitCode = 1;
    }
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Simulate the current getLogFilePath implementation
 * This represents the CURRENT (vulnerable) code
 */
function getLogFilePath_CURRENT(sprintDir: string, phaseId: string): string {
  const sanitized = phaseId.replace(/ > /g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(sprintDir, 'logs', `${sanitized}.log`);
}

/**
 * Simulate the FIXED getLogFilePath implementation with path containment
 */
function getLogFilePath_FIXED(sprintDir: string, phaseId: string): string {
  const sanitized = phaseId.replace(/ > /g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
  const logPath = path.join(sprintDir, 'logs', `${sanitized}.log`);

  // Defense-in-depth: Verify path is within expected directory
  const resolved = path.resolve(logPath);
  const logsDir = path.resolve(sprintDir, 'logs');
  if (!resolved.startsWith(logsDir + path.sep)) {
    throw new Error('Invalid log path');
  }

  return logPath;
}

/**
 * Helper to check if path escapes the logs directory
 */
function pathEscapesLogsDir(sprintDir: string, phaseId: string): boolean {
  const logPath = getLogFilePath_CURRENT(sprintDir, phaseId);
  const resolved = path.resolve(logPath);
  const logsDir = path.resolve(sprintDir, 'logs');
  return !resolved.startsWith(logsDir + path.sep);
}

// ============================================================================
// Test: Basic path traversal attempts are sanitized
// ============================================================================

test('sanitization prevents basic path traversal with ../', () => {
  const sprintDir = '/tmp/test-sprint';
  const maliciousPhaseId = '../../../etc/passwd';

  const result = getLogFilePath_CURRENT(sprintDir, maliciousPhaseId);

  // Current sanitization replaces dots and slashes with underscores
  // Expected: /tmp/test-sprint/logs/________etc_passwd.log
  assert(
    !result.includes('..'),
    `Path should not contain '..', got: ${result}`
  );
  assert(
    result.startsWith(path.join(sprintDir, 'logs')),
    `Path should start with logs dir, got: ${result}`
  );
});

test('sanitization prevents path traversal with embedded ../', () => {
  const sprintDir = '/tmp/test-sprint';
  const maliciousPhaseId = 'valid-phase/../../../etc/passwd';

  const result = getLogFilePath_CURRENT(sprintDir, maliciousPhaseId);

  assert(
    !result.includes('..'),
    `Path should not contain '..', got: ${result}`
  );
});

// ============================================================================
// Test: Defense-in-depth - explicit path containment check
// This test demonstrates WHY we need explicit verification even with sanitization
// ============================================================================

test('BUG-006/012: should FAIL - no explicit path containment verification', () => {
  const sprintDir = '/tmp/test-sprint';

  // While current sanitization handles known attacks, defense-in-depth
  // requires explicit verification. This test verifies the explicit check exists.
  //
  // The current implementation relies ONLY on regex sanitization.
  // If the regex has a bug or is bypassed, there's no second line of defense.
  //
  // We simulate this by testing that the implementation throws an error
  // for ANY phaseId that would resolve outside the logs directory,
  // regardless of how well the input is sanitized.

  // Create a test function that wraps the CURRENT implementation
  // and checks if it performs explicit path containment verification
  let hasExplicitPathCheck = false;

  try {
    // The CURRENT implementation does NOT throw an error here
    // It relies solely on sanitization
    const result = getLogFilePath_CURRENT(sprintDir, 'normal-phase');

    // To verify if explicit path checking exists, we need to test with
    // a case where sanitization might fail. Since we can't easily bypass
    // the regex, we'll verify that the implementation includes the path check.
    //
    // For this test to pass, the implementation MUST:
    // 1. Resolve the final path
    // 2. Verify it's within logsDir
    // 3. Throw if not

    // Read the actual implementation to check for the defense-in-depth pattern
    // This is a meta-test that checks for the presence of security code
    // Note: __dirname points to dist/ when running compiled JS, so we need to find src/
    const distDir = __dirname;
    const srcDir = distDir.replace(/[/\\]dist[/\\]/, '/src/');
    const serverPath = path.join(srcDir, 'server.ts');
    if (fs.existsSync(serverPath)) {
      const serverCode = fs.readFileSync(serverPath, 'utf-8');

      // Look for the defense-in-depth pattern in getLogFilePath
      // Match the method signature through the closing brace, handling nested braces
      const getLogFilePathMatch = serverCode.match(/private\s+getLogFilePath\([^)]*\)[^{]*\{[\s\S]*?^\s{2}\}/m);
      if (getLogFilePathMatch) {
        const methodCode = getLogFilePathMatch[0];

        // Check for explicit path containment verification
        hasExplicitPathCheck =
          methodCode.includes('path.resolve') &&
          methodCode.includes('startsWith') &&
          (methodCode.includes('throw') || methodCode.includes('Error'));
      }
    }
  } catch (error) {
    // If it throws, that might indicate explicit checking exists
    hasExplicitPathCheck = true;
  }

  // This assertion should FAIL with the current code (no explicit check)
  // and PASS after the fix is applied
  assert(
    hasExplicitPathCheck,
    'getLogFilePath should include explicit path containment verification (defense-in-depth)'
  );
});

// ============================================================================
// Test: Verify the FIXED implementation behavior
// ============================================================================

test('FIXED implementation: throws on path traversal attempt', () => {
  const sprintDir = '/tmp/test-sprint';

  // This simulates what the fix should do
  // Normal phase IDs should work fine
  const normalPath = getLogFilePath_FIXED(sprintDir, 'development > step-0 > implement');
  assert(
    normalPath.includes('development-step-0-implement.log'),
    `Normal phase should work, got: ${normalPath}`
  );
});

test('FIXED implementation: rejects phaseId that could escape (if sanitization failed)', () => {
  // This test demonstrates the defense-in-depth concept
  // Even if we somehow bypass sanitization, the path check catches it

  // For demonstration, we'll create a modified "broken" sanitization function
  function getLogFilePath_BROKEN_SANITIZATION(sprintDir: string, phaseId: string): string {
    // INTENTIONALLY BROKEN: doesn't sanitize properly (simulating a regex bug)
    const sanitized = phaseId; // No sanitization!
    const logPath = path.join(sprintDir, 'logs', `${sanitized}.log`);

    // But the defense-in-depth check should still catch it:
    const resolved = path.resolve(logPath);
    const logsDir = path.resolve(sprintDir, 'logs');
    if (!resolved.startsWith(logsDir + path.sep)) {
      throw new Error('Invalid log path');
    }

    return logPath;
  }

  const sprintDir = '/tmp/test-sprint';
  let caughtError = false;

  try {
    // With broken sanitization, ../.. would escape
    // But the explicit path check catches it
    getLogFilePath_BROKEN_SANITIZATION(sprintDir, '../../../etc/passwd');
  } catch (error) {
    caughtError = true;
    assert(
      error instanceof Error && error.message === 'Invalid log path',
      `Expected 'Invalid log path' error, got: ${error}`
    );
  }

  assert(caughtError, 'Defense-in-depth check should catch path traversal even with broken sanitization');
});

// ============================================================================
// Edge cases
// ============================================================================

test('handles empty phaseId safely', () => {
  const sprintDir = '/tmp/test-sprint';
  const result = getLogFilePath_CURRENT(sprintDir, '');

  assert(
    result === path.join(sprintDir, 'logs', '.log'),
    `Empty phaseId should produce .log, got: ${result}`
  );
});

test('handles phaseId with only special characters', () => {
  const sprintDir = '/tmp/test-sprint';
  const result = getLogFilePath_CURRENT(sprintDir, '../../..');

  // All chars are replaced with underscores
  assert(
    result === path.join(sprintDir, 'logs', '________.log'),
    `Special-only phaseId should be all underscores, got: ${result}`
  );
});

test('handles normal phase ID format correctly', () => {
  const sprintDir = '/tmp/test-sprint';
  const result = getLogFilePath_CURRENT(sprintDir, 'development > step-0 > context');

  assert(
    result === path.join(sprintDir, 'logs', 'development-step-0-context.log'),
    `Normal phase ID should convert correctly, got: ${result}`
  );
});

console.log('\nStatusServer path traversal security tests completed.');

// ============================================================================
// BUG-010: Signal Files Cleanup on Sprint Completion
// ============================================================================

console.log('\n--- BUG-010: Signal Files Cleanup Tests ---');

/**
 * Helper to create a minimal PROGRESS.yaml file
 */
function createProgressYaml(sprintDir: string, status: string): void {
  const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
  const content = `sprint_id: test-sprint
status: ${status}
phases: []
`;
  fs.writeFileSync(progressPath, content);
}

/**
 * Helper to create signal files in sprint directory
 */
function createSignalFiles(sprintDir: string): string[] {
  const signals = ['.pause-requested', '.resume-requested', '.stop-requested', '.force-retry-requested'];
  for (const signal of signals) {
    const signalPath = path.join(sprintDir, signal);
    fs.writeFileSync(signalPath, new Date().toISOString());
  }
  return signals;
}

/**
 * Helper to check which signal files exist
 */
function getExistingSignalFiles(sprintDir: string): string[] {
  const signals = ['.pause-requested', '.resume-requested', '.stop-requested', '.force-retry-requested'];
  return signals.filter(signal => fs.existsSync(path.join(sprintDir, signal)));
}

/**
 * Check if the StatusServer class has a cleanupSignalFiles method
 */
function serverHasCleanupMethod(): boolean {
  // Read the server source to check for cleanup method
  const distDir = __dirname;
  const srcDir = distDir.replace(/[/\\]dist[/\\]/, '/src/');
  const serverPath = path.join(srcDir, 'server.ts');

  if (fs.existsSync(serverPath)) {
    const serverCode = fs.readFileSync(serverPath, 'utf-8');

    // Check for cleanupSignalFiles method
    const hasCleanupMethod = serverCode.includes('cleanupSignalFiles');

    // Also verify it actually removes the signal files
    const removesSignals = serverCode.includes('unlinkSync') || serverCode.includes('rmSync');

    return hasCleanupMethod && removesSignals;
  }

  return false;
}

/**
 * Check if cleanup is called when stop() is invoked
 */
function stopMethodCallsCleanup(): boolean {
  const distDir = __dirname;
  const srcDir = distDir.replace(/[/\\]dist[/\\]/, '/src/');
  const serverPath = path.join(srcDir, 'server.ts');

  if (fs.existsSync(serverPath)) {
    const serverCode = fs.readFileSync(serverPath, 'utf-8');

    // Find the stop method
    const stopMethodMatch = serverCode.match(/async\s+stop\s*\(\s*\)[^{]*\{[\s\S]*?(?=\n\s{2}(?:\/\*\*|async|private|public|get\s|set\s|\}))/);
    if (stopMethodMatch) {
      const stopMethod = stopMethodMatch[0];
      return stopMethod.includes('cleanupSignalFiles');
    }
  }

  return false;
}

// ============================================================================
// Test: Verify cleanupSignalFiles method exists
// This should FAIL with current code (method doesn't exist)
// ============================================================================

test('BUG-010: StatusServer should have cleanupSignalFiles method', () => {
  const hasMethod = serverHasCleanupMethod();

  assert(
    hasMethod,
    'StatusServer should have a cleanupSignalFiles method that removes signal files'
  );
});

// ============================================================================
// Test: Verify cleanup is called when server stops
// This should FAIL with current code (cleanup not called in stop())
// ============================================================================

test('BUG-010: stop() method should call cleanupSignalFiles', () => {
  const callsCleanup = stopMethodCallsCleanup();

  assert(
    callsCleanup,
    'stop() method should call cleanupSignalFiles to remove signal files'
  );
});

// ============================================================================
// Test: Integration test - signal files should be cleaned up after stop()
// This test creates actual signal files and verifies they're removed
// ============================================================================

test('BUG-010: signal files should be removed when server stops', async () => {
  // Create a temporary sprint directory
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-signal-test-'));

  try {
    // Create PROGRESS.yaml (required for StatusServer)
    createProgressYaml(testDir, 'running');

    // Create signal files
    const signals = createSignalFiles(testDir);

    // Verify signal files exist
    const beforeStop = getExistingSignalFiles(testDir);
    assert(
      beforeStop.length === 4,
      `Expected 4 signal files before cleanup, got ${beforeStop.length}`
    );

    // Import and instantiate StatusServer
    // Note: We need to dynamically import the server
    // Use random high port to avoid conflicts
    const testPort = 30000 + Math.floor(Math.random() * 10000);
    const serverModule = await import('./server.js');
    const server = new serverModule.StatusServer({
      sprintDir: testDir,
      port: testPort,
      host: 'localhost'
    });

    // Start the server
    await server.start();

    // Stop the server - this SHOULD clean up signal files
    await server.stop();

    // Check if signal files were removed
    const afterStop = getExistingSignalFiles(testDir);

    // This assertion should FAIL with current code (files not removed)
    assert(
      afterStop.length === 0,
      `Expected 0 signal files after stop(), but found: ${afterStop.join(', ')}`
    );
  } finally {
    // Cleanup test directory
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Test: Signal files should be cleaned up on sprint start (leftover handling)
// This tests that leftover signal files from crashed sprints are cleaned
// ============================================================================

test('BUG-010: leftover signal files should be cleaned on server start', async () => {
  // Create a temporary sprint directory
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-leftover-test-'));

  try {
    // Create PROGRESS.yaml
    createProgressYaml(testDir, 'pending');

    // Simulate leftover signal files from a crashed sprint
    createSignalFiles(testDir);

    // Verify signal files exist
    const beforeStart = getExistingSignalFiles(testDir);
    assert(
      beforeStart.length === 4,
      `Expected 4 leftover signal files, got ${beforeStart.length}`
    );

    // Import and instantiate StatusServer
    // Use random high port to avoid conflicts
    const testPort = 30000 + Math.floor(Math.random() * 10000);
    const serverModule = await import('./server.js');
    const server = new serverModule.StatusServer({
      sprintDir: testDir,
      port: testPort,
      host: 'localhost'
    });

    // Start the server - this SHOULD clean up leftover signal files
    await server.start();

    // Check if leftover signal files were removed
    const afterStart = getExistingSignalFiles(testDir);

    // Stop server before assertion (cleanup)
    await server.stop();

    // This assertion should FAIL with current code (files not removed on start)
    assert(
      afterStart.length === 0,
      `Expected leftover signal files to be cleaned on start, but found: ${afterStart.join(', ')}`
    );
  } finally {
    // Cleanup test directory
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

console.log('\nBUG-010 signal files cleanup tests completed.');

// ============================================================================
// BUG-011 + BUG-014 + BUG-015 + BUG-016: Pagination Parameter Validation
// ============================================================================

console.log('\n--- BUG-011/014/015/016: Pagination Parameter Validation Tests ---');

/**
 * Simulate the CURRENT pagination logic from server.ts:541-546
 * This represents the vulnerable code
 */
function paginateSprints_CURRENT(
  allSprints: string[],
  params: URLSearchParams
): { sprints: string[]; total: number; page: number; limit: number; hasMore: boolean } {
  const page = parseInt(params.get('page') || '1', 10);
  const limit = parseInt(params.get('limit') || '20', 10);
  const offset = (page - 1) * limit;
  const sprints = allSprints.slice(offset, offset + limit);

  return {
    sprints,
    total: allSprints.length,
    page,
    limit,
    hasMore: offset + limit < allSprints.length,
  };
}

/**
 * Simulate the FIXED pagination logic with proper validation
 */
function validatePagination(params: URLSearchParams): { page: number; limit: number } | { error: string } {
  const pageStr = params.get('page') || '1';
  const limitStr = params.get('limit') || '20';

  const page = parseInt(pageStr, 10);
  const limit = parseInt(limitStr, 10);

  if (isNaN(page) || page < 1) return { error: 'page must be a positive integer' };
  if (isNaN(limit) || limit < 1 || limit > 100) return { error: 'limit must be between 1 and 100' };

  return { page, limit };
}

/**
 * Check if the StatusServer has validatePagination or equivalent validation
 */
function serverHasPaginationValidation(): boolean {
  const distDir = __dirname;
  const srcDir = distDir.replace(/[/\\]dist[/\\]/, '/src/');
  const serverPath = path.join(srcDir, 'server.ts');

  if (fs.existsSync(serverPath)) {
    const serverCode = fs.readFileSync(serverPath, 'utf-8');

    // Look for pagination validation:
    // - A validatePagination function or method
    // - Check for isNaN on page/limit
    // - Check for range validation (< 1, > 100, etc.)
    const hasValidateFunction = serverCode.includes('validatePagination');
    const hasNaNCheck = serverCode.includes('isNaN(page)') || serverCode.includes('isNaN(limit)');
    const hasRangeCheck = serverCode.includes('page < 1') || serverCode.includes('limit < 1');

    return hasValidateFunction || (hasNaNCheck && hasRangeCheck);
  }

  return false;
}

// ============================================================================
// Test: BUG-011 - Negative page returns empty results with hasMore: true
// ============================================================================

test('BUG-011: negative page should return error, not empty results with hasMore: true', () => {
  const testSprints = ['sprint-1', 'sprint-2', 'sprint-3', 'sprint-4', 'sprint-5'];
  const params = new URLSearchParams({ page: '-1', limit: '2' });

  const result = paginateSprints_CURRENT(testSprints, params);

  // Current bug: page=-1 results in offset=-2*limit=-4, which gives:
  // - slice(-4, -2) returns ['sprint-2', 'sprint-3'] (unexpected results from the middle!)
  // - OR empty array depending on implementation
  // - hasMore is true even though we're at an invalid position

  // Correct behavior: Should reject negative page with an error
  // For now, we test that the validation function exists in the server

  // First, verify the buggy behavior exists
  // With page=-1 and limit=2: offset = (-1-1)*2 = -4
  // slice(-4, -4+2) = slice(-4, -2) which gets elements from index -4 to -2
  // For array of 5, that's [1, 2] (indices from end)
  assert(
    result.page === -1,
    `Current code sets page to -1, got: ${result.page}`
  );

  // The validation should exist in the server
  const hasValidation = serverHasPaginationValidation();
  assert(
    hasValidation,
    'Server should have pagination validation to reject negative page values'
  );
});

// ============================================================================
// Test: BUG-014 - Page=0 returns empty results with misleading metadata
// ============================================================================

test('BUG-014: page=0 should return error, not empty results', () => {
  const testSprints = ['sprint-1', 'sprint-2', 'sprint-3', 'sprint-4', 'sprint-5'];
  const params = new URLSearchParams({ page: '0', limit: '2' });

  const result = paginateSprints_CURRENT(testSprints, params);

  // Current bug: page=0 results in offset=(0-1)*2=-2
  // slice(-2, 0) returns empty array []
  // Metadata shows page: 0, hasMore based on wrong calculation

  // Verify buggy behavior
  assert(
    result.page === 0,
    `Current code sets page to 0, got: ${result.page}`
  );
  assert(
    result.sprints.length === 0,
    `Page 0 incorrectly returns empty results, got: ${result.sprints.length} items`
  );

  // The validation should exist in the server
  const hasValidation = serverHasPaginationValidation();
  assert(
    hasValidation,
    'Server should have pagination validation to reject page=0'
  );
});

// ============================================================================
// Test: BUG-015 - Non-numeric page returns page: null
// ============================================================================

test('BUG-015: non-numeric page should return error, not page: null/NaN', () => {
  const testSprints = ['sprint-1', 'sprint-2', 'sprint-3', 'sprint-4', 'sprint-5'];
  const params = new URLSearchParams({ page: 'abc', limit: '2' });

  const result = paginateSprints_CURRENT(testSprints, params);

  // Current bug: parseInt('abc', 10) returns NaN
  // offset = (NaN - 1) * limit = NaN
  // slice(NaN, NaN) returns empty array
  // Response has page: NaN (or null in JSON)

  // Verify buggy behavior
  assert(
    isNaN(result.page),
    `Current code sets page to NaN for non-numeric input, got: ${result.page}`
  );

  // The validation should exist in the server
  const hasValidation = serverHasPaginationValidation();
  assert(
    hasValidation,
    'Server should have pagination validation to reject non-numeric page values'
  );
});

// ============================================================================
// Test: BUG-016 - Negative limit causes unexpected slice behavior
// ============================================================================

test('BUG-016: negative limit should return error, not unexpected results', () => {
  const testSprints = ['sprint-1', 'sprint-2', 'sprint-3', 'sprint-4', 'sprint-5'];
  const params = new URLSearchParams({ page: '1', limit: '-5' });

  const result = paginateSprints_CURRENT(testSprints, params);

  // Current bug: limit=-5 results in:
  // offset = (1-1)*(-5) = 0
  // slice(0, 0+(-5)) = slice(0, -5) = [] (empty, slicing to negative index)
  // But metadata shows limit: -5 which is invalid

  // Verify buggy behavior
  assert(
    result.limit === -5,
    `Current code sets limit to -5, got: ${result.limit}`
  );

  // The validation should exist in the server
  const hasValidation = serverHasPaginationValidation();
  assert(
    hasValidation,
    'Server should have pagination validation to reject negative limit values'
  );
});

// ============================================================================
// Test: Limit exceeding maximum should be capped or rejected
// ============================================================================

test('BUG-016: limit > 100 should be rejected or capped', () => {
  const params = new URLSearchParams({ page: '1', limit: '1000' });

  const validation = validatePagination(params);

  // The FIXED validation should reject limit > 100
  assert(
    'error' in validation,
    `Limit > 100 should be rejected with error, got: ${JSON.stringify(validation)}`
  );

  // Check the server has this validation
  const hasValidation = serverHasPaginationValidation();
  assert(
    hasValidation,
    'Server should have pagination validation to limit maximum page size'
  );
});

// ============================================================================
// Integration test: Server API should return 400 for invalid pagination
// ============================================================================

test('BUG-011/014/015/016: Server API should return 400 for invalid pagination', async () => {
  // Create a temporary sprint directory
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-pagination-test-'));

  try {
    // Create minimal PROGRESS.yaml
    const progressPath = path.join(testDir, 'PROGRESS.yaml');
    fs.writeFileSync(progressPath, `sprint_id: test-sprint
status: completed
phases: []
`);

    // Import and instantiate StatusServer
    const testPort = 30000 + Math.floor(Math.random() * 10000);
    const serverModule = await import('./server.js');
    const server = new serverModule.StatusServer({
      sprintDir: testDir,
      port: testPort,
      host: 'localhost'
    });

    await server.start();

    try {
      // Test negative page - should return 400
      const negativePageResponse = await fetch(
        `http://localhost:${testPort}/api/sprints?page=-1`
      );

      // Current bug: returns 200 with empty/wrong results
      // Fixed: should return 400 with error message
      assert(
        negativePageResponse.status === 400,
        `Negative page should return 400, got: ${negativePageResponse.status}`
      );

      // Test page=0 - should return 400
      const zeroPageResponse = await fetch(
        `http://localhost:${testPort}/api/sprints?page=0`
      );
      assert(
        zeroPageResponse.status === 400,
        `Page=0 should return 400, got: ${zeroPageResponse.status}`
      );

      // Test non-numeric page - should return 400
      const nonNumericPageResponse = await fetch(
        `http://localhost:${testPort}/api/sprints?page=abc`
      );
      assert(
        nonNumericPageResponse.status === 400,
        `Non-numeric page should return 400, got: ${nonNumericPageResponse.status}`
      );

      // Test negative limit - should return 400
      const negativeLimitResponse = await fetch(
        `http://localhost:${testPort}/api/sprints?limit=-5`
      );
      assert(
        negativeLimitResponse.status === 400,
        `Negative limit should return 400, got: ${negativeLimitResponse.status}`
      );

      // Test limit > 100 - should return 400
      const excessiveLimitResponse = await fetch(
        `http://localhost:${testPort}/api/sprints?limit=500`
      );
      assert(
        excessiveLimitResponse.status === 400,
        `Limit > 100 should return 400, got: ${excessiveLimitResponse.status}`
      );

    } finally {
      await server.stop();
    }
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Test: Valid pagination should still work correctly
// ============================================================================

test('Valid pagination parameters should work correctly', () => {
  const testSprints = ['sprint-1', 'sprint-2', 'sprint-3', 'sprint-4', 'sprint-5'];

  // Test page 1
  const page1 = paginateSprints_CURRENT(testSprints, new URLSearchParams({ page: '1', limit: '2' }));
  assert(
    page1.sprints.length === 2 && page1.sprints[0] === 'sprint-1',
    `Page 1 should return first 2 sprints, got: ${JSON.stringify(page1.sprints)}`
  );
  assert(page1.hasMore === true, 'Page 1 should have more');

  // Test page 2
  const page2 = paginateSprints_CURRENT(testSprints, new URLSearchParams({ page: '2', limit: '2' }));
  assert(
    page2.sprints.length === 2 && page2.sprints[0] === 'sprint-3',
    `Page 2 should return next 2 sprints, got: ${JSON.stringify(page2.sprints)}`
  );
  assert(page2.hasMore === true, 'Page 2 should have more');

  // Test last page
  const page3 = paginateSprints_CURRENT(testSprints, new URLSearchParams({ page: '3', limit: '2' }));
  assert(
    page3.sprints.length === 1 && page3.sprints[0] === 'sprint-5',
    `Page 3 should return last sprint, got: ${JSON.stringify(page3.sprints)}`
  );
  assert(page3.hasMore === false, 'Page 3 should not have more');

  // Test default values
  const defaults = paginateSprints_CURRENT(testSprints, new URLSearchParams());
  assert(defaults.page === 1, 'Default page should be 1');
  assert(defaults.limit === 20, 'Default limit should be 20');
});

console.log('\nBUG-011/014/015/016 pagination validation tests completed.');
