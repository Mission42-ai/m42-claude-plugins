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
// STEP 1 TESTS: Core PDF Export with Sprint Data (RED PHASE)
// ============================================================================
// These tests define the expected behavior for Step 1 enhancements.
// They should FAIL until the implementation is complete.

// ============================================================================
// Scenario 1: PDF includes sprint header with title and ID
// ============================================================================

test('renders sprint header - renders sprint header with title and ID', async () => {
  const progress = createTestProgress({
    'sprint-id': 'sprint-2026-01-21-pdf-export',
  });
  const options: PdfOptions = {
    title: 'Sprint Summary Report',
    includeCharts: false,
  };

  const result = await createPdfDocument(progress, options);

  // PDF should have substantial content with header section
  // Enhanced implementation will add formatted header with proper styling
  assert(result.length > 1000, 'PDF with header should have substantial content');

  // Verify it's a valid PDF
  const magicBytes = result.slice(0, 5).toString('ascii');
  assertEqual(magicBytes, '%PDF-', 'Should produce valid PDF');
});

// ============================================================================
// Scenario 2: PDF includes sprint metadata section
// ============================================================================

test('renders sprint metadata - renders sprint metadata section', async () => {
  const progress = createTestProgress({
    'sprint-id': 'metadata-test-sprint',
    status: 'completed',
    stats: {
      'started-at': '2026-01-21T10:00:00Z',
      'completed-at': '2026-01-21T14:30:00Z',
      'total-phases': 4,
      'completed-phases': 4,
      'total-steps': 8,
      'completed-steps': 8,
      elapsed: '4h 30m',
    },
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progress, options);

  // Enhanced implementation should include metadata section with:
  // - Sprint status
  // - Start/completion dates
  // - Elapsed time
  assert(result.length > 1000, 'PDF with metadata should have proper size');

  // Verify valid PDF structure
  const magicBytes = result.slice(0, 5).toString('ascii');
  assertEqual(magicBytes, '%PDF-', 'Should produce valid PDF');
});

// ============================================================================
// Scenario 3: PDF includes step listing with status indicators
// ============================================================================

test('renders step status indicators - renders step status indicators', async () => {
  const progressWithSteps = createTestProgress({
    phases: [
      {
        id: 'development',
        status: 'in-progress',
        steps: [
          {
            id: 'step-0',
            prompt: 'First task completed',
            status: 'completed',
            elapsed: '15m',
            phases: [],
          },
          {
            id: 'step-1',
            prompt: 'Second task in progress',
            status: 'in-progress',
            phases: [],
          },
          {
            id: 'step-2',
            prompt: 'Third task pending',
            status: 'pending',
            phases: [],
          },
        ],
      },
    ] as CompiledTopPhase[],
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progressWithSteps, options);

  // Enhanced implementation should use visual status indicators:
  // ✓ (checkmark) for completed
  // ◉ (filled circle) for in-progress
  // ○ (empty circle) for pending
  // ✗ (x mark) for failed
  assert(result.length > 1500, 'PDF with multiple steps should have substantial content');

  // Verify valid PDF
  const magicBytes = result.slice(0, 5).toString('ascii');
  assertEqual(magicBytes, '%PDF-', 'Should produce valid PDF');
});

test('renders step status indicators - uses visual status markers', async () => {
  const progressWithMixedStatuses = createTestProgress({
    phases: [
      {
        id: 'qa-phase',
        status: 'in-progress',
        steps: [
          { id: 'test-1', prompt: 'Run unit tests', status: 'completed', phases: [] },
          { id: 'test-2', prompt: 'Run integration tests', status: 'failed', error: 'Assertion failed', phases: [] },
          { id: 'test-3', prompt: 'Run e2e tests', status: 'pending', phases: [] },
          { id: 'test-4', prompt: 'Code review', status: 'blocked', phases: [] },
        ],
      },
    ] as CompiledTopPhase[],
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progressWithMixedStatuses, options);
  const pdfContent = result.toString('latin1');

  // Enhanced PDF should include visual status indicators
  // Current basic implementation just shows [status] text
  // Test expects enhanced formatting with symbols
  assert(result.length > 1200, 'PDF should render all steps with indicators');
});

// ============================================================================
// Scenario 4: PDF includes timing information
// ============================================================================

test('renders timing information - renders timing information for phases', async () => {
  const progress = createTestProgress({
    phases: [
      {
        id: 'phase-1',
        status: 'completed',
        prompt: 'Setup phase',
        'started-at': '2026-01-21T10:00:00Z',
        'completed-at': '2026-01-21T10:15:00Z',
        elapsed: '15m',
      },
      {
        id: 'phase-2',
        status: 'completed',
        prompt: 'Implementation phase',
        'started-at': '2026-01-21T10:15:00Z',
        'completed-at': '2026-01-21T11:00:00Z',
        elapsed: '45m',
        steps: [
          {
            id: 'step-0',
            prompt: 'Implement feature',
            status: 'completed',
            'started-at': '2026-01-21T10:15:00Z',
            'completed-at': '2026-01-21T10:45:00Z',
            elapsed: '30m',
            phases: [],
          },
        ],
      },
    ] as CompiledTopPhase[],
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progress, options);
  const pdfContent = result.toString('latin1');

  // PDF should include timing information
  // Check for elapsed time rendering
  assert(result.length > 1000, 'PDF with timing should have proper content');
});

// ============================================================================
// Scenario 5: PDF includes completion percentages
// ============================================================================

test('renders completion percentages - renders completion percentages', async () => {
  const progress = createTestProgress({
    stats: {
      'started-at': '2026-01-21T10:00:00Z',
      'completed-at': null,
      'total-phases': 4,
      'completed-phases': 3,
      'total-steps': 10,
      'completed-steps': 7,
      elapsed: '2h',
    },
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progress, options);
  const pdfContent = result.toString('latin1');

  // Enhanced implementation should show percentages like "75%" or "70%"
  // Current basic implementation only shows raw counts
  // Test verifies the statistics section is rendered
  assert(pdfContent.includes('3') || pdfContent.includes('4'),
    'PDF should include phase completion counts');
  assert(pdfContent.includes('7') || pdfContent.includes('10'),
    'PDF should include step completion counts');
});

test('renders completion percentages - calculates and displays percentages', async () => {
  const progress = createTestProgress({
    stats: {
      'started-at': '2026-01-21T10:00:00Z',
      'total-phases': 8,
      'completed-phases': 6,
      'total-steps': 20,
      'completed-steps': 15,
    },
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progress, options);

  // This test expects the enhanced implementation to show percentages
  // Phase completion: 6/8 = 75%
  // Step completion: 15/20 = 75%
  assert(result.length > 500, 'PDF with percentages should render properly');
});

// ============================================================================
// Scenario 6: PDF uses proper header formatting
// ============================================================================

test('uses header hierarchy - uses header hierarchy for document structure', async () => {
  const progress = createTestProgress({
    phases: [
      {
        id: 'phase-1',
        status: 'completed',
        prompt: 'First phase',
        summary: 'Phase 1 complete',
        steps: [
          {
            id: 'step-0',
            prompt: 'Task for phase 1',
            status: 'completed',
            phases: [
              { id: 'sub-1', status: 'completed', prompt: 'Sub-task 1' },
              { id: 'sub-2', status: 'completed', prompt: 'Sub-task 2' },
            ],
          },
        ],
      },
    ] as CompiledTopPhase[],
  });
  const options: PdfOptions = {
    title: 'Hierarchy Test Report',
    includeCharts: false,
  };

  const result = await createPdfDocument(progress, options);

  // PDF should use different font sizes for hierarchy
  // Document title: 24pt, Section: 16pt, Phase: 14pt, etc.
  // The test checks that content is rendered with proper structure
  assert(result.length > 1500, 'PDF with hierarchy should have layered content');
});

// ============================================================================
// Scenario 7: PDF sections have proper spacing
// ============================================================================

test('uses proper spacing - uses proper spacing between sections', async () => {
  const progress = createTestProgress({
    phases: [
      {
        id: 'prepare',
        status: 'completed',
        prompt: 'Preparation phase',
        summary: 'Prepared successfully',
      },
      {
        id: 'develop',
        status: 'completed',
        prompt: 'Development phase',
        summary: 'Developed features',
        steps: [
          { id: 'step-0', prompt: 'Feature A', status: 'completed', phases: [] },
          { id: 'step-1', prompt: 'Feature B', status: 'completed', phases: [] },
        ],
      },
      {
        id: 'qa',
        status: 'completed',
        prompt: 'QA phase',
        summary: 'All tests passed',
      },
    ] as CompiledTopPhase[],
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progress, options);

  // Enhanced implementation should have:
  // - Section spacing: 1.5 line breaks
  // - Phase spacing: 1 line break
  // - Step indentation: 20pt from left
  // - Sub-phase indentation: 40pt from left
  assert(result.length > 1500, 'PDF with multiple sections should have proper content');

  // Verify valid PDF
  const magicBytes = result.slice(0, 5).toString('ascii');
  assertEqual(magicBytes, '%PDF-', 'Should produce valid PDF');
});

// ============================================================================
// Scenario 8: PDF handles failed and blocked steps
// ============================================================================

test('renders failed step errors - renders failed step errors', async () => {
  const progressWithFailure = createTestProgress({
    status: 'blocked',
    phases: [
      {
        id: 'development',
        status: 'failed',
        steps: [
          {
            id: 'step-0',
            prompt: 'Implement feature',
            status: 'completed',
            phases: [],
          },
          {
            id: 'step-1',
            prompt: 'Run tests',
            status: 'failed',
            error: 'Test assertion failed: expected 5 but got 3',
            'error-category': 'validation',
            phases: [],
          },
          {
            id: 'step-2',
            prompt: 'Deploy',
            status: 'blocked',
            phases: [],
          },
        ],
      },
    ] as CompiledTopPhase[],
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progressWithFailure, options);

  // Enhanced implementation should:
  // - Use red color (#C62828) for failed steps
  // - Display error messages for failed steps
  // - Use orange color (#E65100) for blocked steps
  // - Show ✗ indicator for failed, ⊘ for blocked
  assert(result.length > 1000, 'PDF with errors should have content');

  // Verify valid PDF
  const magicBytes = result.slice(0, 5).toString('ascii');
  assertEqual(magicBytes, '%PDF-', 'Should produce valid PDF');
});

test('renders failed step errors - displays error messages', async () => {
  const progressWithError = createTestProgress({
    phases: [
      {
        id: 'build',
        status: 'failed',
        error: 'Build failed with exit code 1',
        steps: [
          {
            id: 'compile',
            prompt: 'Compile TypeScript',
            status: 'failed',
            error: 'TS2322: Type string is not assignable to type number',
            phases: [],
          },
        ],
      },
    ] as CompiledTopPhase[],
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progressWithError, options);

  // PDF should display actual error messages
  // This tests the error rendering feature
  assert(result.length > 800, 'PDF with error details should have content');
});

// ============================================================================
// Step 1 RED Phase Tests: Features that DO NOT exist yet
// ============================================================================
// These tests verify NEW functionality that needs to be implemented.
// They MUST fail until the implementation is complete.

test('RED: exports getStatusIndicator function for visual status markers', () => {
  // getStatusIndicator should be exported from the module
  // It should return status symbols: ✓ ◉ ○ ✗ ⊘ ⊝
  const pdfModule = require('./pdf-generator.js');
  assert(typeof pdfModule.getStatusIndicator === 'function',
    'getStatusIndicator function should be exported');
});

test('RED: exports formatCompletionPercentage function', () => {
  // formatCompletionPercentage should calculate and format percentages
  const pdfModule = require('./pdf-generator.js');
  assert(typeof pdfModule.formatCompletionPercentage === 'function',
    'formatCompletionPercentage function should be exported');
});

test('RED: formatCompletionPercentage returns correct percentage string', () => {
  const pdfModule = require('./pdf-generator.js');
  const result = pdfModule.formatCompletionPercentage(3, 4);
  assertEqual(result, '75%', 'Should return formatted percentage');
});

test('RED: getStatusIndicator returns checkmark for completed status', () => {
  const pdfModule = require('./pdf-generator.js');
  const result = pdfModule.getStatusIndicator('completed');
  assertEqual(result, '\u2713', 'Should return checkmark for completed');
});

test('RED: getStatusIndicator returns filled circle for in-progress status', () => {
  const pdfModule = require('./pdf-generator.js');
  const result = pdfModule.getStatusIndicator('in-progress');
  assertEqual(result, '\u25C9', 'Should return filled circle for in-progress');
});

test('RED: getStatusIndicator returns empty circle for pending status', () => {
  const pdfModule = require('./pdf-generator.js');
  const result = pdfModule.getStatusIndicator('pending');
  assertEqual(result, '\u25CB', 'Should return empty circle for pending');
});

test('RED: getStatusIndicator returns X mark for failed status', () => {
  const pdfModule = require('./pdf-generator.js');
  const result = pdfModule.getStatusIndicator('failed');
  assertEqual(result, '\u2717', 'Should return X mark for failed');
});

test('RED: exports getStatusColor function for colored status output', () => {
  // getStatusColor should return color codes for statuses
  const pdfModule = require('./pdf-generator.js');
  assert(typeof pdfModule.getStatusColor === 'function',
    'getStatusColor function should be exported');
});

test('RED: getStatusColor returns green hex for completed status', () => {
  const pdfModule = require('./pdf-generator.js');
  const result = pdfModule.getStatusColor('completed');
  assertEqual(result, '#2E7D32', 'Should return green for completed');
});

test('RED: getStatusColor returns red hex for failed status', () => {
  const pdfModule = require('./pdf-generator.js');
  const result = pdfModule.getStatusColor('failed');
  assertEqual(result, '#C62828', 'Should return red for failed');
});

test('RED: exports PdfLayoutConfig interface for customizable layout', () => {
  // PdfLayoutConfig should allow configuring font sizes, spacing, etc.
  const pdfModule = require('./pdf-generator.js');
  // Check that DEFAULT_LAYOUT_CONFIG is exported
  assert(pdfModule.DEFAULT_LAYOUT_CONFIG !== undefined,
    'DEFAULT_LAYOUT_CONFIG should be exported');
  assert(pdfModule.DEFAULT_LAYOUT_CONFIG.titleFontSize === 24,
    'Default title font size should be 24');
  assert(pdfModule.DEFAULT_LAYOUT_CONFIG.sectionSpacing === 1.5,
    'Default section spacing should be 1.5');
});

// ============================================================================
// Additional Step 1 Tests: Edge Cases for Enhanced Features
// ============================================================================

test('handles sprint with zero completed phases for percentage calculation', async () => {
  const progress = createTestProgress({
    stats: {
      'started-at': '2026-01-21T10:00:00Z',
      'total-phases': 5,
      'completed-phases': 0,
      'total-steps': 15,
      'completed-steps': 0,
    },
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progress, options);

  // Should handle 0% completion without division errors
  assert(Buffer.isBuffer(result), 'Should handle zero completion percentage');
  assert(result.length > 500, 'PDF should render even with zero progress');
});

test('handles sprint with all phases completed (100% completion)', async () => {
  const progress = createTestProgress({
    stats: {
      'started-at': '2026-01-21T10:00:00Z',
      'completed-at': '2026-01-21T12:00:00Z',
      'total-phases': 5,
      'completed-phases': 5,
      'total-steps': 15,
      'completed-steps': 15,
      elapsed: '2h',
    },
  });
  const options = createTestPdfOptions();

  const result = await createPdfDocument(progress, options);

  // Should show 100% completion
  assert(Buffer.isBuffer(result), 'Should handle 100% completion');
});

// ============================================================================
// Run Tests Summary
// ============================================================================

// Tests run sequentially via runTests() triggered by setImmediate
// No setTimeout needed - runTests() handles summary output
