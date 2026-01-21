"use strict";
/**
 * Documentation Tests for PDF Export Feature
 *
 * Verifies that PDF export documentation exists and is complete.
 * These tests ensure the feature is properly documented in:
 * - README.md (feature mention)
 * - docs/reference/commands.md (command reference)
 * - Usage examples
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
// ============================================================================
// Test Harness (following project patterns)
// ============================================================================
let testsPassed = 0;
let testsFailed = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result instanceof Promise) {
            result.then(() => {
                testsPassed++;
                console.log(`\u2713 ${name}`);
            }).catch((error) => {
                testsFailed++;
                console.error(`\u2717 ${name}`);
                console.error(`  ${error}`);
            });
        }
        else {
            testsPassed++;
            console.log(`\u2713 ${name}`);
        }
    }
    catch (error) {
        testsFailed++;
        console.error(`\u2717 ${name}`);
        console.error(`  ${error}`);
    }
}
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
function assertContains(text, substring, message) {
    const msg = message || `Expected text to contain "${substring}"`;
    if (!text.includes(substring))
        throw new Error(msg);
}
function assertMatches(text, pattern, message) {
    const msg = message || `Expected text to match ${pattern}`;
    if (!pattern.test(text))
        throw new Error(msg);
}
// ============================================================================
// Path Resolution
// ============================================================================
// Resolve paths relative to plugin root
const pluginRoot = path.resolve(__dirname, '../../..');
const docsRoot = path.join(pluginRoot, 'docs');
const readmePath = path.join(pluginRoot, 'README.md');
const commandsRefPath = path.join(docsRoot, 'reference', 'commands.md');
// ============================================================================
// Tests: README.md
// ============================================================================
test('README.md exists', () => {
    assert(fs.existsSync(readmePath), `README.md not found at ${readmePath}`);
});
test('README.md mentions PDF export feature', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    assertMatches(content, /pdf/i, 'README should mention PDF');
});
test('README.md includes export-pdf in commands table', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    assertMatches(content, /export.pdf/i, 'README should reference export-pdf command');
});
// ============================================================================
// Tests: Commands Reference
// ============================================================================
test('commands.md exists in docs/reference/', () => {
    assert(fs.existsSync(commandsRefPath), `commands.md not found at ${commandsRefPath}`);
});
test('commands.md contains /export-pdf section', () => {
    const content = fs.readFileSync(commandsRefPath, 'utf8');
    assertMatches(content, /export-pdf/i, 'commands.md should document export-pdf');
});
test('commands.md documents sprint-path argument for export-pdf', () => {
    const content = fs.readFileSync(commandsRefPath, 'utf8');
    // Should document the required sprint-path argument
    assertMatches(content, /sprint.path|<sprint-path>/i, 'Should document sprint-path argument');
});
test('commands.md documents --charts option', () => {
    const content = fs.readFileSync(commandsRefPath, 'utf8');
    assertMatches(content, /--charts|-c/i, 'Should document --charts option');
});
test('commands.md documents --output option', () => {
    const content = fs.readFileSync(commandsRefPath, 'utf8');
    assertMatches(content, /--output|-o/i, 'Should document --output option');
});
// ============================================================================
// Tests: Usage Examples
// ============================================================================
test('commands.md includes basic export-pdf usage example', () => {
    const content = fs.readFileSync(commandsRefPath, 'utf8');
    // Should have example like: /export-pdf .claude/sprints/...
    assertMatches(content, /export-pdf.*\.claude\/sprints|export-pdf.*sprint/i, 'Should include basic usage example with sprint path');
});
test('commands.md includes example with --charts flag', () => {
    const content = fs.readFileSync(commandsRefPath, 'utf8');
    assertMatches(content, /export-pdf.*--charts|export-pdf.*-c/i, 'Should include example with --charts flag');
});
test('commands.md includes example with --output option', () => {
    const content = fs.readFileSync(commandsRefPath, 'utf8');
    assertMatches(content, /export-pdf.*--output|export-pdf.*-o/i, 'Should include example with --output option');
});
// ============================================================================
// Tests: Integration Checks
// ============================================================================
test('export-pdf-cli.ts exports required functions', async () => {
    // Dynamic import to check module exports
    const cliModule = await import('./export-pdf-cli.js');
    assert(typeof cliModule.parseExportArgs === 'function', 'Should export parseExportArgs');
    assert(typeof cliModule.runExportCommand === 'function', 'Should export runExportCommand');
    assert(typeof cliModule.CLI_VERSION === 'string', 'Should export CLI_VERSION');
});
test('pdf-generator.ts exports createPdfDocument function', async () => {
    const pdfModule = await import('./pdf-generator.js');
    assert(typeof pdfModule.createPdfDocument === 'function', 'Should export createPdfDocument');
});
// ============================================================================
// Summary
// ============================================================================
setTimeout(() => {
    console.log(`\nTests completed: ${testsPassed} passed, ${testsFailed} failed`);
    if (testsFailed > 0)
        process.exitCode = 1;
}, 100);
//# sourceMappingURL=docs.test.js.map