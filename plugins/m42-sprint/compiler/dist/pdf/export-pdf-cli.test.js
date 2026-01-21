"use strict";
/**
 * Tests for Export PDF CLI Module
 *
 * Tests for the CLI that exports sprint progress to PDF format.
 * Tests cover: argument parsing, file output, error handling, and options.
 *
 * RED PHASE: These tests are written BEFORE implementation.
 * They should FAIL until export-pdf-cli.ts is created.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
// Import from CLI module (WILL FAIL - module doesn't exist yet)
const export_pdf_cli_js_1 = require("./export-pdf-cli.js");
// ============================================================================
// Test Infrastructure
// ============================================================================
let testsPassed = 0;
let testsFailed = 0;
const testQueue = [];
let testsStarted = false;
function test(name, fn) {
    testQueue.push({ name, fn });
    if (!testsStarted) {
        testsStarted = true;
        setImmediate(runTests);
    }
}
async function runTests() {
    for (const { name, fn } of testQueue) {
        try {
            await fn();
            testsPassed++;
            console.log(`✓ ${name}`);
        }
        catch (error) {
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
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
function assertEqual(actual, expected, message) {
    const msg = message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    if (actual !== expected)
        throw new Error(msg);
}
function assertIncludes(haystack, needle, message) {
    const msg = message || `Expected "${haystack}" to include "${needle}"`;
    if (!haystack.includes(needle))
        throw new Error(msg);
}
// ============================================================================
// Test Fixtures
// ============================================================================
function createTestProgress(overrides = {}) {
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
    };
}
function createTestSprintDir() {
    const testDir = `/tmp/test-export-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    fs.mkdirSync(testDir, { recursive: true });
    return testDir;
}
function cleanupTestDir(testDir) {
    try {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup errors
    }
}
function writeProgress(sprintDir, progress) {
    const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
    const content = yaml.dump(progress);
    fs.writeFileSync(progressPath, content, 'utf8');
}
// ============================================================================
// Scenario 1: Export PDF command accepts sprint path argument
// ============================================================================
test('should parse sprint path argument', () => {
    const args = ['node', 'export-pdf-cli.js', '/path/to/sprint'];
    const result = (0, export_pdf_cli_js_1.parseExportArgs)(args);
    assertEqual(result.sprintPath, '/path/to/sprint', 'Sprint path should be parsed');
});
test('should parse relative sprint path argument', () => {
    const args = ['node', 'export-pdf-cli.js', './.claude/sprints/2026-01-21_test'];
    const result = (0, export_pdf_cli_js_1.parseExportArgs)(args);
    assertEqual(result.sprintPath, './.claude/sprints/2026-01-21_test', 'Relative path should be parsed');
});
test('should report error when sprint path is missing', () => {
    const args = ['node', 'export-pdf-cli.js'];
    const result = (0, export_pdf_cli_js_1.parseExportArgs)(args);
    assert(result.error !== undefined, 'Should report error for missing sprint path');
    assertIncludes(result.error, 'path', 'Error should mention missing path');
});
// ============================================================================
// Scenario 2: Export PDF command outputs to artifacts directory
// ============================================================================
test('should output PDF to artifacts directory by default', async () => {
    const testDir = createTestSprintDir();
    try {
        const artifactsDir = path.join(testDir, 'artifacts');
        fs.mkdirSync(artifactsDir, { recursive: true });
        writeProgress(testDir, createTestProgress());
        const result = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, { includeCharts: false });
        assert(result.success, 'Export should succeed');
        assert(result.outputPath !== undefined, 'Should have output path');
        assertIncludes(result.outputPath, 'artifacts', 'Output should be in artifacts directory');
        assertIncludes(result.outputPath, '.pdf', 'Output should be a PDF file');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('should include sprint-id in PDF filename', async () => {
    const testDir = createTestSprintDir();
    try {
        const artifactsDir = path.join(testDir, 'artifacts');
        fs.mkdirSync(artifactsDir, { recursive: true });
        writeProgress(testDir, createTestProgress({
            'sprint-id': 'my-custom-sprint-id',
        }));
        const result = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, { includeCharts: false });
        assert(result.success, 'Export should succeed');
        assertIncludes(result.outputPath, 'my-custom-sprint-id', 'Filename should include sprint-id');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('should create valid PDF file on disk', async () => {
    const testDir = createTestSprintDir();
    try {
        const artifactsDir = path.join(testDir, 'artifacts');
        fs.mkdirSync(artifactsDir, { recursive: true });
        writeProgress(testDir, createTestProgress());
        const result = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, { includeCharts: false });
        assert(result.success, 'Export should succeed');
        assert(fs.existsSync(result.outputPath), 'PDF file should exist');
        // Verify PDF magic bytes
        const content = fs.readFileSync(result.outputPath);
        const magic = content.slice(0, 5).toString('ascii');
        assertEqual(magic, '%PDF-', 'File should be valid PDF');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Scenario 3: Export PDF command shows error for missing PROGRESS.yaml
// ============================================================================
test('should report error when PROGRESS.yaml is missing', async () => {
    const testDir = createTestSprintDir();
    try {
        // Don't create PROGRESS.yaml
        const result = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, { includeCharts: false });
        assert(!result.success, 'Export should fail without PROGRESS.yaml');
        assert(result.error !== undefined, 'Should have error message');
        assertIncludes(result.error.toLowerCase(), 'progress', 'Error should mention PROGRESS.yaml');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('should return non-zero exit code for missing PROGRESS.yaml', async () => {
    const testDir = createTestSprintDir();
    try {
        const result = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, { includeCharts: false });
        assert(!result.success, 'Should indicate failure');
        assertEqual(result.exitCode, 1, 'Exit code should be 1');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Scenario 4: Export PDF command shows error for invalid sprint path
// ============================================================================
test('should report error when sprint path does not exist', async () => {
    const result = await (0, export_pdf_cli_js_1.runExportCommand)('/nonexistent/path/to/sprint', { includeCharts: false });
    assert(!result.success, 'Export should fail for nonexistent path');
    assert(result.error !== undefined, 'Should have error message');
});
test('should include path in error message for nonexistent directory', async () => {
    const result = await (0, export_pdf_cli_js_1.runExportCommand)('/nonexistent/sprint/directory', { includeCharts: false });
    assert(!result.success, 'Should fail');
    assertIncludes(result.error, 'not found', 'Error should indicate directory not found');
});
test('should return exit code 1 for invalid path', async () => {
    const result = await (0, export_pdf_cli_js_1.runExportCommand)('/invalid/path', { includeCharts: false });
    assertEqual(result.exitCode, 1, 'Exit code should be 1 for invalid path');
});
// ============================================================================
// Scenario 5: Export PDF command creates artifacts directory if missing
// ============================================================================
test('should create artifacts directory if it does not exist', async () => {
    const testDir = createTestSprintDir();
    try {
        // Don't create artifacts directory
        writeProgress(testDir, createTestProgress());
        const artifactsDir = path.join(testDir, 'artifacts');
        assert(!fs.existsSync(artifactsDir), 'Artifacts should not exist initially');
        const result = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, { includeCharts: false });
        assert(result.success, 'Export should succeed');
        assert(fs.existsSync(artifactsDir), 'Artifacts directory should be created');
        assert(fs.existsSync(result.outputPath), 'PDF should exist in new artifacts directory');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Scenario 6: Export PDF command includes charts when --charts flag is passed
// ============================================================================
test('should accept --charts flag in argument parsing', () => {
    const args = ['node', 'export-pdf-cli.js', '/path/to/sprint', '--charts'];
    const result = (0, export_pdf_cli_js_1.parseExportArgs)(args);
    assertEqual(result.options.includeCharts, true, 'includeCharts should be true');
});
test('should accept -c shorthand for charts', () => {
    const args = ['node', 'export-pdf-cli.js', '/path/to/sprint', '-c'];
    const result = (0, export_pdf_cli_js_1.parseExportArgs)(args);
    assertEqual(result.options.includeCharts, true, 'includeCharts should be true with -c');
});
test('should default includeCharts to false', () => {
    const args = ['node', 'export-pdf-cli.js', '/path/to/sprint'];
    const result = (0, export_pdf_cli_js_1.parseExportArgs)(args);
    assertEqual(result.options.includeCharts, false, 'includeCharts should default to false');
});
test('should generate larger PDF when charts are included', async () => {
    const testDir = createTestSprintDir();
    try {
        const artifactsDir = path.join(testDir, 'artifacts');
        fs.mkdirSync(artifactsDir, { recursive: true });
        writeProgress(testDir, createTestProgress());
        const resultWithoutCharts = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, { includeCharts: false });
        const sizeWithout = fs.statSync(resultWithoutCharts.outputPath).size;
        // Clean up the first PDF
        fs.unlinkSync(resultWithoutCharts.outputPath);
        const resultWithCharts = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, { includeCharts: true });
        const sizeWith = fs.statSync(resultWithCharts.outputPath).size;
        assert(sizeWith > sizeWithout, 'PDF with charts should be larger than without');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Scenario 7: Export PDF command shows success message with output path
// ============================================================================
test('should return success message with output path', async () => {
    const testDir = createTestSprintDir();
    try {
        const artifactsDir = path.join(testDir, 'artifacts');
        fs.mkdirSync(artifactsDir, { recursive: true });
        writeProgress(testDir, createTestProgress());
        const result = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, { includeCharts: false });
        assert(result.success, 'Should succeed');
        assert(result.message !== undefined, 'Should have success message');
        assertIncludes(result.message, result.outputPath, 'Message should include output path');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('should return exit code 0 on success', async () => {
    const testDir = createTestSprintDir();
    try {
        const artifactsDir = path.join(testDir, 'artifacts');
        fs.mkdirSync(artifactsDir, { recursive: true });
        writeProgress(testDir, createTestProgress());
        const result = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, { includeCharts: false });
        assertEqual(result.exitCode, 0, 'Exit code should be 0 on success');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Scenario 8: Export PDF command shows help with --help flag
// ============================================================================
test('should recognize --help flag', () => {
    const args = ['node', 'export-pdf-cli.js', '--help'];
    const result = (0, export_pdf_cli_js_1.parseExportArgs)(args);
    assertEqual(result.showHelp, true, 'showHelp should be true');
});
test('should recognize -h shorthand for help', () => {
    const args = ['node', 'export-pdf-cli.js', '-h'];
    const result = (0, export_pdf_cli_js_1.parseExportArgs)(args);
    assertEqual(result.showHelp, true, 'showHelp should be true with -h');
});
test('should recognize --version flag', () => {
    const args = ['node', 'export-pdf-cli.js', '--version'];
    const result = (0, export_pdf_cli_js_1.parseExportArgs)(args);
    assertEqual(result.showVersion, true, 'showVersion should be true');
});
// ============================================================================
// Additional Options Tests
// ============================================================================
test('should accept --output/-o option for custom output path', () => {
    const args = ['node', 'export-pdf-cli.js', '/path/to/sprint', '--output', '/custom/output.pdf'];
    const result = (0, export_pdf_cli_js_1.parseExportArgs)(args);
    assertEqual(result.options.outputPath, '/custom/output.pdf', 'Custom output path should be parsed');
});
test('should accept -o shorthand for output', () => {
    const args = ['node', 'export-pdf-cli.js', '/path/to/sprint', '-o', './my-report.pdf'];
    const result = (0, export_pdf_cli_js_1.parseExportArgs)(args);
    assertEqual(result.options.outputPath, './my-report.pdf', 'Output path from -o should be parsed');
});
test('should write PDF to custom output path when specified', async () => {
    const testDir = createTestSprintDir();
    const customOutput = path.join(testDir, 'custom-report.pdf');
    try {
        writeProgress(testDir, createTestProgress());
        const result = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, {
            includeCharts: false,
            outputPath: customOutput,
        });
        assert(result.success, 'Export should succeed');
        assertEqual(result.outputPath, customOutput, 'Should use custom output path');
        assert(fs.existsSync(customOutput), 'PDF should exist at custom path');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
// ============================================================================
// Edge Cases
// ============================================================================
test('should handle sprint with special characters in ID', async () => {
    const testDir = createTestSprintDir();
    try {
        const artifactsDir = path.join(testDir, 'artifacts');
        fs.mkdirSync(artifactsDir, { recursive: true });
        writeProgress(testDir, createTestProgress({
            'sprint-id': 'sprint-with-special_chars.2026',
        }));
        const result = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, { includeCharts: false });
        assert(result.success, 'Should handle special characters');
        assert(fs.existsSync(result.outputPath), 'PDF should be created');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('should handle empty phases array', async () => {
    const testDir = createTestSprintDir();
    try {
        const artifactsDir = path.join(testDir, 'artifacts');
        fs.mkdirSync(artifactsDir, { recursive: true });
        writeProgress(testDir, createTestProgress({ phases: [] }));
        const result = await (0, export_pdf_cli_js_1.runExportCommand)(testDir, { includeCharts: false });
        assert(result.success, 'Should handle empty phases');
    }
    finally {
        cleanupTestDir(testDir);
    }
});
test('should handle sprint path with trailing slash', () => {
    const args = ['node', 'export-pdf-cli.js', '/path/to/sprint/'];
    const result = (0, export_pdf_cli_js_1.parseExportArgs)(args);
    assertEqual(result.sprintPath, '/path/to/sprint/', 'Should handle trailing slash');
    assert(result.error === undefined, 'Should not error on trailing slash');
});
// ============================================================================
// CLI Module Exports
// ============================================================================
test('should export parseExportArgs function', () => {
    assert(typeof export_pdf_cli_js_1.parseExportArgs === 'function', 'parseExportArgs should be exported');
});
test('should export runExportCommand function', () => {
    assert(typeof export_pdf_cli_js_1.runExportCommand === 'function', 'runExportCommand should be exported');
});
test('should export CLI_VERSION constant', () => {
    assert(typeof export_pdf_cli_js_1.CLI_VERSION === 'string', 'CLI_VERSION should be a string');
    assert(export_pdf_cli_js_1.CLI_VERSION.length > 0, 'CLI_VERSION should not be empty');
});
// ============================================================================
// Run Tests Summary
// ============================================================================
// Tests run sequentially via runTests() triggered by setImmediate
// No setTimeout needed - runTests() handles summary output
//# sourceMappingURL=export-pdf-cli.test.js.map