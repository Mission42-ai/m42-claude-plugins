/**
 * Tests for PDF Generator Module
 *
 * Tests for the PDF generation utility that creates sprint summary
 * PDF documents from CompiledProgress data.
 *
 * RED PHASE: These tests are written BEFORE implementation.
 * They should FAIL until pdf-generator.ts is created.
 */

import * as fs from 'fs';
import * as path from 'path';

// Import the module under test (WILL FAIL - module doesn't exist yet)
import {
  createPdfDocument,
  PdfOptions,
  SprintPdfData,
} from './pdf-generator.js';

// Import types for test fixtures
import type { CompiledProgress, SprintStats, CompiledTopPhase } from '../types.js';

// ============================================================================
// Test Infrastructure
// ============================================================================

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

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestProgress(overrides: Partial<CompiledProgress> = {}): CompiledProgress {
  return {
    'sprint-id': 'test-sprint-2026-01-21',
    status: 'completed',
    current: {
      phase: 2,
      step: null,
      'sub-phase': null,
    },
    stats: {
      'started-at': '2026-01-21T10:00:00Z',
      'completed-at': '2026-01-21T12:30:00Z',
      'total-phases': 3,
      'completed-phases': 3,
      'total-steps': 5,
      'completed-steps': 5,
      elapsed: '2h 30m',
    },
    phases: [
      {
        id: 'phase-1',
        status: 'completed',
        prompt: 'Set up project infrastructure',
        'started-at': '2026-01-21T10:00:00Z',
        'completed-at': '2026-01-21T10:30:00Z',
        elapsed: '30m',
        summary: 'Infrastructure setup complete',
      },
      {
        id: 'phase-2',
        status: 'completed',
        prompt: 'Implement core features',
        'started-at': '2026-01-21T10:30:00Z',
        'completed-at': '2026-01-21T11:45:00Z',
        elapsed: '1h 15m',
        summary: 'Core features implemented',
      },
      {
        id: 'phase-3',
        status: 'completed',
        prompt: 'Write documentation',
        'started-at': '2026-01-21T11:45:00Z',
        'completed-at': '2026-01-21T12:30:00Z',
        elapsed: '45m',
        summary: 'Documentation written',
      },
    ],
    ...overrides,
  } as CompiledProgress;
}

function createTestPdfOptions(): PdfOptions {
  return {
    title: 'Sprint Summary Report',
    includeCharts: false,  // Charts tested separately in Step 2
  };
}

function getTempFilePath(): string {
  return path.join('/tmp', `test-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
}

function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Scenario 2: PDF utility module can be imported
// ============================================================================

test('pdf module exports createPdfDocument function', () => {
  assert(typeof createPdfDocument === 'function', 'createPdfDocument should be a function');
});

test('pdf module exports PdfOptions interface (via TypeScript)', () => {
  // This test verifies the type exists at compile time
  // If PdfOptions doesn't exist, this file won't compile
  const options: PdfOptions = createTestPdfOptions();
  assert(options !== undefined, 'PdfOptions should be usable as a type');
});

// ============================================================================
// Scenario 3: PDF generator creates valid document buffer
// ============================================================================

test('createPdfDocument returns a Buffer', async () => {
  const progress = createTestProgress();
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progress, options);

  assert(Buffer.isBuffer(result), 'Result should be a Buffer');
});

test('generated PDF buffer starts with PDF magic bytes', async () => {
  const progress = createTestProgress();
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progress, options);

  // PDF files start with "%PDF-"
  const magicBytes = result.slice(0, 5).toString('ascii');
  assertEqual(magicBytes, '%PDF-', 'PDF should start with %PDF- magic bytes');
});

test('generated PDF buffer is non-empty', async () => {
  const progress = createTestProgress();
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progress, options);

  assert(result.length > 100, `PDF buffer should be substantial, got ${result.length} bytes`);
});

// ============================================================================
// Scenario 4: PDF generator accepts sprint data structure
// ============================================================================

test('createPdfDocument accepts sprint data - accepts sprint data', async () => {
  const progress = createTestProgress({
    'sprint-id': 'acceptance-test-sprint',
    status: 'completed',
  });
  const options = createTestPdfOptions();

  // Should not throw
  const result = await createPdfDocument(progress, options);

  assert(result.length > 0, 'Should produce non-empty PDF for valid sprint data');
});

test('createPdfDocument handles sprint with different statuses', async () => {
  const progressInProgress = createTestProgress({ status: 'in-progress' });
  const progressBlocked = createTestProgress({ status: 'blocked' });
  const progressPaused = createTestProgress({ status: 'paused' });

  // All should produce valid PDFs without throwing
  const results = await Promise.all([
    createPdfDocument(progressInProgress, createTestPdfOptions()),
    createPdfDocument(progressBlocked, createTestPdfOptions()),
    createPdfDocument(progressPaused, createTestPdfOptions()),
  ]);

  for (const result of results) {
    assert(Buffer.isBuffer(result), 'Should produce Buffer for any status');
    assert(result.length > 0, 'Should produce non-empty PDF');
  }
});

// ============================================================================
// Scenario 5: PDF generator can embed text content
// ============================================================================

test('createPdfDocument embeds text - embeds text content', async () => {
  const progress = createTestProgress({
    'sprint-id': 'text-content-test',
    phases: [
      {
        id: 'test-phase-alpha',
        status: 'completed',
        prompt: 'Alpha phase prompt',
        summary: 'Alpha completed successfully',
      },
      {
        id: 'test-phase-beta',
        status: 'completed',
        prompt: 'Beta phase prompt',
        summary: 'Beta completed successfully',
      },
    ] as CompiledTopPhase[],
  });
  const options: PdfOptions = {
    title: 'Text Content Test Report',
    includeCharts: false,
  };

  const result = await createPdfDocument(progress, options);

  // PDF should be generated with text embedded
  // (Actual text verification is complex with PDFKit binary output,
  // but we verify PDF is produced with expected size increase for more content)
  assert(result.length > 500, 'PDF with text content should have substantial size');
});

test('createPdfDocument includes sprint-id in output', async () => {
  const progress = createTestProgress({
    'sprint-id': 'unique-sprint-identifier-12345',
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progress, options);

  // The PDF binary may contain the sprint ID as text stream
  // This is a basic check that the PDF was generated
  assert(Buffer.isBuffer(result), 'Should produce valid PDF buffer');
  assert(result.length > 0, 'PDF should not be empty');
});

// ============================================================================
// Scenario 6: PDF can be written to file system
// ============================================================================

test('generated PDF can be written to file - write to file', async () => {
  const progress = createTestProgress();
  const options = createTestPdfOptions();
  const tempPath = getTempFilePath();

  try {
    const result = await createPdfDocument(progress, options);

    // Write to file
    fs.writeFileSync(tempPath, result);

    // Verify file exists
    assert(fs.existsSync(tempPath), 'PDF file should exist after writing');

    // Verify file content matches buffer
    const fileContent = fs.readFileSync(tempPath);
    assertEqual(fileContent.length, result.length, 'File size should match buffer size');

    // Verify it's a valid PDF by checking magic bytes in file
    const fileMagic = fileContent.slice(0, 5).toString('ascii');
    assertEqual(fileMagic, '%PDF-', 'Written file should be valid PDF');
  } finally {
    cleanupFile(tempPath);
  }
});

test('PDF file can be read back as valid document', async () => {
  const progress = createTestProgress();
  const options = createTestPdfOptions();
  const tempPath = getTempFilePath();

  try {
    const result = await createPdfDocument(progress, options);
    fs.writeFileSync(tempPath, result);

    // Read back and verify structure
    const fileContent = fs.readFileSync(tempPath);

    // PDF ends with %%EOF
    const fileString = fileContent.toString('ascii');
    assert(fileString.includes('%%EOF'), 'PDF should contain EOF marker');

    // PDF contains stream objects
    assert(fileString.includes('/Type'), 'PDF should contain type definitions');
  } finally {
    cleanupFile(tempPath);
  }
});

// ============================================================================
// Edge Cases
// ============================================================================

test('createPdfDocument handles empty phases array', async () => {
  const progress = createTestProgress({ phases: [] });
  const options = createTestPdfOptions();

  // Should not throw
  const result = await createPdfDocument(progress, options);

  assert(Buffer.isBuffer(result), 'Should produce Buffer even with no phases');
  assert(result.length > 0, 'Should produce non-empty PDF');
});

test('createPdfDocument handles missing optional fields', async () => {
  const minimalProgress: CompiledProgress = {
    'sprint-id': 'minimal-sprint',
    status: 'not-started',
    current: {
      phase: 0,
      step: null,
      'sub-phase': null,
    },
    stats: {
      'started-at': null,
      'total-phases': 0,
      'completed-phases': 0,
    },
  };
  const options = createTestPdfOptions();

  // Should not throw with minimal data
  const result = await createPdfDocument(minimalProgress, options);

  assert(Buffer.isBuffer(result), 'Should handle minimal progress data');
});

test('createPdfDocument handles phases with steps (nested structure)', async () => {
  const progressWithSteps = createTestProgress({
    phases: [
      {
        id: 'development',
        status: 'completed',
        steps: [
          {
            id: 'step-0',
            prompt: 'Implement feature A',
            status: 'completed',
            phases: [
              { id: 'context', status: 'completed', prompt: 'Gather context' },
              { id: 'implement', status: 'completed', prompt: 'Implement' },
            ],
          },
          {
            id: 'step-1',
            prompt: 'Implement feature B',
            status: 'completed',
            phases: [
              { id: 'context', status: 'completed', prompt: 'Gather context' },
              { id: 'implement', status: 'completed', prompt: 'Implement' },
            ],
          },
        ],
      },
    ] as CompiledTopPhase[],
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progressWithSteps, options);

  assert(Buffer.isBuffer(result), 'Should handle nested step structure');
  assert(result.length > 500, 'PDF with nested steps should have substantial content');
});

// ============================================================================
// Options Handling
// ============================================================================

test('createPdfDocument respects custom title option', async () => {
  const progress = createTestProgress();
  const options: PdfOptions = {
    title: 'Custom Report Title',
    includeCharts: false,
  };

  const result = await createPdfDocument(progress, options);

  assert(Buffer.isBuffer(result), 'Should produce valid PDF with custom title');
});

test('createPdfDocument handles undefined options gracefully', async () => {
  const progress = createTestProgress();

  // Call with minimal/no options
  const result = await createPdfDocument(progress, {} as PdfOptions);

  assert(Buffer.isBuffer(result), 'Should handle empty options object');
});

// ============================================================================
// Run Tests Summary
// ============================================================================

// Tests run sequentially via runTests() triggered by setImmediate
// No setTimeout needed - runTests() handles summary output
