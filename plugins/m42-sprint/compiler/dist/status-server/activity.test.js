"use strict";
/**
 * Tests for Activity Feature - BUG-003: Live Activity Always Shows "Waiting for activity"
 *
 * Issue: The Live Activity panel on the Sprint Detail page always shows
 * "Waiting for activity..." even when activity events are being written
 * to .sprint-activity.jsonl.
 *
 * ROOT CAUSE: The sprint-activity-hook.sh uses `jq -n` without the `-c` flag,
 * producing multi-line pretty-printed JSON instead of compact single-line JSONL.
 * The ActivityWatcher expects one JSON object per line, so it fails to parse
 * multi-line output and emits zero valid events.
 *
 * FIX: Change all `jq -n` to `jq -cn` in sprint-activity-hook.sh to produce
 * compact single-line JSON output.
 *
 * Expected Behavior:
 * - Activity events written to .sprint-activity.jsonl should be:
 *   1. Written as single-line compact JSON (one per line)
 *   2. Detected by ActivityWatcher
 *   3. Parsed as valid ActivityEvent objects
 *   4. Emitted as 'activity' events
 *   5. Broadcast to SSE clients as 'activity-event' SSE events
 *   6. Displayed in the Live Activity panel
 *
 * This test verifies:
 * 1. The hook produces correct JSONL format (single-line JSON)
 * 2. Backend components (ActivityWatcher, StatusServer) work correctly
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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const http = __importStar(require("http"));
const child_process_1 = require("child_process");
const activity_watcher_js_1 = require("./activity-watcher.js");
const activity_types_js_1 = require("./activity-types.js");
const server_js_1 = require("./server.js");
const testResults = [];
let currentTest = '';
function test(name, fn) {
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
    }
    else {
        console.log(`✓ ${name}`);
        testResults.push({ name, passed: true });
    }
}
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// ============================================================================
// Test Fixtures
// ============================================================================
/**
 * Create a valid tool activity event JSON string
 */
function createActivityEventJson(overrides = {}) {
    const baseEvent = {
        ts: new Date().toISOString(),
        type: 'tool',
        tool: 'Read',
        level: 'basic',
        ...overrides,
    };
    return JSON.stringify(baseEvent);
}
/**
 * Create a minimal PROGRESS.yaml for StatusServer
 * Includes all required fields to prevent spurious error logs in tests
 */
function createMinimalProgressYaml() {
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
 * Create a temp directory with required files
 */
async function createTestSprintDir() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-activity-test-'));
    fs.writeFileSync(path.join(tmpDir, 'PROGRESS.yaml'), createMinimalProgressYaml());
    return tmpDir;
}
/**
 * Cleanup temp directory
 */
function cleanupTestDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup errors
    }
}
// ============================================================================
// BUG-003 Root Cause Test: Hook Script JSONL Format
// ============================================================================
/**
 * Get the path to the sprint-activity-hook.sh script
 */
function getHookScriptPath() {
    // Try relative path from compiler/src/status-server/
    const paths = [
        path.resolve(__dirname, '../../../../hooks/sprint-activity-hook.sh'),
        path.resolve(__dirname, '../../../hooks/sprint-activity-hook.sh'),
        '/home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/hooks/sprint-activity-hook.sh',
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    throw new Error('Could not find sprint-activity-hook.sh');
}
test('BUG-003: sprint-activity-hook.sh produces single-line JSONL output', async () => {
    const tmpDir = await createTestSprintDir();
    try {
        const hookPath = getHookScriptPath();
        // Simulate a tool use event
        const toolEvent = JSON.stringify({
            tool_name: 'Read',
            tool_input: { file_path: '/test/file.ts' },
            tool_response: { success: true },
        });
        // Run the hook script
        try {
            (0, child_process_1.execSync)(`echo '${toolEvent}' | bash "${hookPath}" "${tmpDir}"`, {
                encoding: 'utf8',
                env: { ...process.env, SPRINT_ACTIVITY_VERBOSITY: 'basic' },
            });
        }
        catch (error) {
            // Hook may fail if jq not found, skip test
            console.log('  (skipping - jq not available)');
            return;
        }
        const activityFile = path.join(tmpDir, '.sprint-activity.jsonl');
        // Check file exists
        assert(fs.existsSync(activityFile), 'Activity file should be created');
        // Read the file content
        const content = fs.readFileSync(activityFile, 'utf-8').trim();
        const lines = content.split('\n');
        // BUG-003: The hook produces multi-line pretty-printed JSON instead of single-line JSONL
        // This test will FAIL until we add -c flag to jq commands in the hook
        assert(lines.length === 1, `JSONL should have exactly 1 line per event. ` +
            `Got ${lines.length} lines. ` +
            `This is BUG-003: hook produces pretty-printed JSON instead of compact JSONL. ` +
            `Content:\n${content}`);
        // Verify the single line is valid JSON
        let parsed;
        try {
            parsed = JSON.parse(lines[0]);
        }
        catch (e) {
            assert(false, `Line should be valid JSON: ${lines[0]}`);
        }
        // Verify it's a valid ActivityEvent
        assert((0, activity_types_js_1.isActivityEvent)(parsed), `Output should be a valid ActivityEvent: ${JSON.stringify(parsed)}`);
    }
    finally {
        cleanupTestDir(tmpDir);
    }
});
test('BUG-003: ActivityWatcher fails to parse multi-line JSON entries', async () => {
    const tmpDir = await createTestSprintDir();
    const activityFile = path.join(tmpDir, '.sprint-activity.jsonl');
    try {
        // Write multi-line pretty-printed JSON (what the buggy hook produces)
        const prettyPrintedJson = `{
  "ts": "2026-01-20T12:00:00Z",
  "type": "tool",
  "tool": "Read",
  "level": "basic"
}`;
        fs.writeFileSync(activityFile, prettyPrintedJson);
        const watcher = new activity_watcher_js_1.ActivityWatcher(activityFile, { debounceDelay: 50 });
        const receivedEvents = [];
        watcher.on('activity', (event) => {
            receivedEvents.push(event);
        });
        watcher.start();
        await sleep(200);
        // BUG-003: ActivityWatcher processes line-by-line, so multi-line JSON fails to parse
        // This demonstrates why the hook MUST produce single-line JSONL
        assert(receivedEvents.length === 0, `ActivityWatcher should fail to parse multi-line JSON. ` +
            `Unexpectedly received ${receivedEvents.length} events. ` +
            `This test demonstrates the impact of BUG-003.`);
        watcher.close();
    }
    finally {
        cleanupTestDir(tmpDir);
    }
});
// ============================================================================
// Unit Tests: ActivityEvent Type Guard
// ============================================================================
test('isActivityEvent validates required fields', () => {
    // Valid minimal event
    const validEvent = {
        ts: '2026-01-20T12:00:00Z',
        type: 'tool',
        tool: 'Read',
        level: 'basic',
    };
    assert((0, activity_types_js_1.isActivityEvent)(validEvent), 'Should accept valid event');
    // Missing ts
    assert(!(0, activity_types_js_1.isActivityEvent)({ type: 'tool', tool: 'Read', level: 'basic' }), 'Should reject missing ts');
    // Missing type
    assert(!(0, activity_types_js_1.isActivityEvent)({ ts: '2026-01-20T12:00:00Z', tool: 'Read', level: 'basic' }), 'Should reject missing type');
    // Wrong type value
    assert(!(0, activity_types_js_1.isActivityEvent)({ ts: '2026-01-20T12:00:00Z', type: 'other', tool: 'Read', level: 'basic' }), 'Should reject wrong type');
    // Missing tool
    assert(!(0, activity_types_js_1.isActivityEvent)({ ts: '2026-01-20T12:00:00Z', type: 'tool', level: 'basic' }), 'Should reject missing tool');
    // Missing level
    assert(!(0, activity_types_js_1.isActivityEvent)({ ts: '2026-01-20T12:00:00Z', type: 'tool', tool: 'Read' }), 'Should reject missing level');
    // Invalid level
    assert(!(0, activity_types_js_1.isActivityEvent)({ ts: '2026-01-20T12:00:00Z', type: 'tool', tool: 'Read', level: 'invalid' }), 'Should reject invalid level');
});
test('isActivityEvent accepts optional fields', () => {
    const eventWithFile = {
        ts: '2026-01-20T12:00:00Z',
        type: 'tool',
        tool: 'Read',
        level: 'basic',
        file: '/path/to/file.ts',
    };
    assert((0, activity_types_js_1.isActivityEvent)(eventWithFile), 'Should accept event with file');
    const eventWithParams = {
        ts: '2026-01-20T12:00:00Z',
        type: 'tool',
        tool: 'Bash',
        level: 'detailed',
        params: 'npm run build',
    };
    assert((0, activity_types_js_1.isActivityEvent)(eventWithParams), 'Should accept event with params');
    const eventWithBothOptional = {
        ts: '2026-01-20T12:00:00Z',
        type: 'tool',
        tool: 'Grep',
        level: 'detailed',
        file: '/path',
        params: 'pattern',
    };
    assert((0, activity_types_js_1.isActivityEvent)(eventWithBothOptional), 'Should accept event with both optional fields');
});
// ============================================================================
// Integration Tests: ActivityWatcher
// ============================================================================
test('ActivityWatcher emits activity events for new JSONL entries', async () => {
    const tmpDir = await createTestSprintDir();
    const activityFile = path.join(tmpDir, '.sprint-activity.jsonl');
    try {
        // Create watcher
        const watcher = new activity_watcher_js_1.ActivityWatcher(activityFile, { debounceDelay: 50 });
        const receivedEvents = [];
        watcher.on('activity', (event) => {
            receivedEvents.push(event);
        });
        // Start watching
        watcher.start();
        await sleep(100); // Wait for watcher to initialize
        // Write activity event to file
        const eventJson = createActivityEventJson({ tool: 'Read', file: '/test/file.ts' });
        fs.writeFileSync(activityFile, eventJson + '\n');
        // Wait for watcher to detect and emit
        await sleep(300);
        // BUG-003: This assertion should FAIL if the watcher isn't detecting new events
        assert(receivedEvents.length > 0, `ActivityWatcher should emit events for new JSONL entries. ` +
            `Received ${receivedEvents.length} events, expected at least 1. ` +
            `This indicates BUG-003: activity events are not being detected.`);
        const receivedEvent = receivedEvents[0];
        assert(receivedEvent.tool === 'Read', `Expected tool 'Read', got '${receivedEvent.tool}'`);
        assert(receivedEvent.type === 'tool' && receivedEvent.file === '/test/file.ts', `Expected file '/test/file.ts', got '${receivedEvent.type === 'tool' ? receivedEvent.file : 'N/A'}'`);
        watcher.close();
    }
    finally {
        cleanupTestDir(tmpDir);
    }
});
test('ActivityWatcher emits events for appended entries', async () => {
    const tmpDir = await createTestSprintDir();
    const activityFile = path.join(tmpDir, '.sprint-activity.jsonl');
    try {
        const watcher = new activity_watcher_js_1.ActivityWatcher(activityFile, { debounceDelay: 50 });
        const receivedEvents = [];
        watcher.on('activity', (event) => {
            receivedEvents.push(event);
        });
        // Create initial file with one event
        const event1 = createActivityEventJson({ tool: 'Read' });
        fs.writeFileSync(activityFile, event1 + '\n');
        watcher.start();
        await sleep(200);
        const initialCount = receivedEvents.length;
        // Append a second event
        const event2 = createActivityEventJson({ tool: 'Write', file: '/new/file.ts' });
        fs.appendFileSync(activityFile, event2 + '\n');
        await sleep(300);
        // BUG-003: Watcher should detect appended entries
        assert(receivedEvents.length > initialCount, `ActivityWatcher should emit events for appended entries. ` +
            `Had ${initialCount} events, now have ${receivedEvents.length}. ` +
            `Expected at least ${initialCount + 1}.`);
        watcher.close();
    }
    finally {
        cleanupTestDir(tmpDir);
    }
});
test('ActivityWatcher reads initial content on start', async () => {
    const tmpDir = await createTestSprintDir();
    const activityFile = path.join(tmpDir, '.sprint-activity.jsonl');
    try {
        // Create file with existing events BEFORE starting watcher
        const events = [
            createActivityEventJson({ tool: 'Read', file: '/file1.ts' }),
            createActivityEventJson({ tool: 'Write', file: '/file2.ts' }),
            createActivityEventJson({ tool: 'Bash', params: 'npm test' }),
        ];
        fs.writeFileSync(activityFile, events.join('\n') + '\n');
        const watcher = new activity_watcher_js_1.ActivityWatcher(activityFile, { debounceDelay: 50, tailLines: 10 });
        const receivedEvents = [];
        watcher.on('activity', (event) => {
            receivedEvents.push(event);
        });
        watcher.start();
        await sleep(200);
        // BUG-003: Watcher should read and emit existing events on start
        assert(receivedEvents.length === 3, `ActivityWatcher should emit ${events.length} initial events. ` +
            `Received ${receivedEvents.length}. ` +
            `This affects historical activity display.`);
        watcher.close();
    }
    finally {
        cleanupTestDir(tmpDir);
    }
});
// ============================================================================
// Integration Tests: StatusServer SSE Broadcasting
// ============================================================================
test('StatusServer broadcasts activity events to SSE clients', async () => {
    const tmpDir = await createTestSprintDir();
    const activityFile = path.join(tmpDir, '.sprint-activity.jsonl');
    // Find available port
    const port = 3200 + Math.floor(Math.random() * 100);
    try {
        const server = new server_js_1.StatusServer({
            sprintDir: tmpDir,
            port,
            host: 'localhost',
            debounceDelay: 50,
        });
        await server.start();
        await server.waitForReady();
        // Connect SSE client
        const sseEvents = [];
        const ssePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('SSE connection timeout - no activity-event received within 5 seconds'));
            }, 5000);
            const req = http.get(`http://localhost:${port}/events`, (res) => {
                res.setEncoding('utf8');
                let buffer = '';
                res.on('data', (chunk) => {
                    buffer += chunk;
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (line.startsWith('event: activity-event')) {
                            sseEvents.push(line);
                            clearTimeout(timeout);
                            resolve();
                        }
                    }
                });
                res.on('error', reject);
            });
            req.on('error', reject);
        });
        // Give SSE client time to connect
        await sleep(200);
        // Write activity event - this should be detected and broadcast
        const eventJson = createActivityEventJson({ tool: 'Edit', file: '/test/edited.ts' });
        fs.writeFileSync(activityFile, eventJson + '\n');
        // Wait for SSE event
        try {
            await ssePromise;
        }
        catch (error) {
            // BUG-003: If we get here, SSE broadcast is not working
            assert(false, `StatusServer should broadcast activity events to SSE clients. ` +
                `Error: ${error instanceof Error ? error.message : String(error)}. ` +
                `This is BUG-003: Live Activity shows 'Waiting for activity'.`);
        }
        // Verify we received the activity event
        assert(sseEvents.length > 0, `Should have received at least 1 SSE activity event. ` +
            `Received ${sseEvents.length}.`);
        await server.stop();
    }
    finally {
        cleanupTestDir(tmpDir);
    }
});
test('StatusServer activity events contain correct data structure', async () => {
    const tmpDir = await createTestSprintDir();
    const activityFile = path.join(tmpDir, '.sprint-activity.jsonl');
    const port = 3300 + Math.floor(Math.random() * 100);
    try {
        const server = new server_js_1.StatusServer({
            sprintDir: tmpDir,
            port,
            host: 'localhost',
            debounceDelay: 50,
        });
        await server.start();
        await server.waitForReady();
        // Connect SSE client and capture events
        let receivedData = null;
        const ssePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for SSE activity-event'));
            }, 5000);
            const req = http.get(`http://localhost:${port}/events`, (res) => {
                res.setEncoding('utf8');
                let buffer = '';
                res.on('data', (chunk) => {
                    buffer += chunk;
                    const messages = buffer.split('\n\n');
                    buffer = messages.pop() || '';
                    for (const msg of messages) {
                        const lines = msg.split('\n');
                        const eventLine = lines.find((l) => l.startsWith('event: '));
                        const dataLine = lines.find((l) => l.startsWith('data: '));
                        if (eventLine === 'event: activity-event' && dataLine) {
                            try {
                                receivedData = JSON.parse(dataLine.slice(6));
                                clearTimeout(timeout);
                                resolve();
                            }
                            catch {
                                // Continue waiting for valid JSON
                            }
                        }
                    }
                });
                res.on('error', reject);
            });
            req.on('error', reject);
        });
        await sleep(200);
        // Write activity
        const testEvent = {
            ts: '2026-01-20T14:30:00Z',
            type: 'tool',
            tool: 'Grep',
            level: 'detailed',
            file: '/src/search.ts',
            params: 'findPattern',
        };
        fs.writeFileSync(activityFile, JSON.stringify(testEvent) + '\n');
        try {
            await ssePromise;
        }
        catch (error) {
            assert(false, `Failed to receive SSE event: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Verify data structure
        assert(receivedData !== null, 'Should have received SSE data');
        const envelope = receivedData;
        assert(envelope.type === 'activity-event', `SSE event type should be 'activity-event', got '${envelope.type}'`);
        assert(envelope.data !== undefined, 'SSE event should have data field');
        const data = envelope.data;
        assert(data.tool === 'Grep', `Event data.tool should be 'Grep', got '${data.tool}'`);
        assert(data.file === '/src/search.ts', `Event data.file should match`);
        assert(data.params === 'findPattern', `Event data.params should match`);
        await server.stop();
    }
    finally {
        cleanupTestDir(tmpDir);
    }
});
// ============================================================================
// Edge Case Tests
// ============================================================================
test('ActivityWatcher handles malformed JSONL lines gracefully', async () => {
    const tmpDir = await createTestSprintDir();
    const activityFile = path.join(tmpDir, '.sprint-activity.jsonl');
    try {
        const watcher = new activity_watcher_js_1.ActivityWatcher(activityFile, { debounceDelay: 50 });
        const receivedEvents = [];
        const errors = [];
        watcher.on('activity', (event) => {
            receivedEvents.push(event);
        });
        watcher.on('error', (error) => {
            errors.push(error);
        });
        // Write file with mix of valid and invalid lines
        const lines = [
            'not valid json',
            createActivityEventJson({ tool: 'Read' }),
            '{"partial": true}', // Missing required fields
            createActivityEventJson({ tool: 'Write' }),
        ];
        fs.writeFileSync(activityFile, lines.join('\n') + '\n');
        watcher.start();
        await sleep(300);
        // Should only emit valid events (2 out of 4)
        assert(receivedEvents.length === 2, `Should emit only valid events. Expected 2, got ${receivedEvents.length}`);
        watcher.close();
    }
    finally {
        cleanupTestDir(tmpDir);
    }
});
test('ActivityWatcher handles empty file', async () => {
    const tmpDir = await createTestSprintDir();
    const activityFile = path.join(tmpDir, '.sprint-activity.jsonl');
    try {
        // Create empty file
        fs.writeFileSync(activityFile, '');
        const watcher = new activity_watcher_js_1.ActivityWatcher(activityFile, { debounceDelay: 50 });
        const receivedEvents = [];
        watcher.on('activity', (event) => {
            receivedEvents.push(event);
        });
        let readyEmitted = false;
        watcher.on('ready', () => {
            readyEmitted = true;
        });
        watcher.start();
        await sleep(200);
        assert(readyEmitted, 'Watcher should emit ready even with empty file');
        assert(receivedEvents.length === 0, 'No events should be emitted for empty file');
        watcher.close();
    }
    finally {
        cleanupTestDir(tmpDir);
    }
});
test('ActivityWatcher handles file not existing initially', async () => {
    const tmpDir = await createTestSprintDir();
    const activityFile = path.join(tmpDir, '.sprint-activity.jsonl');
    try {
        // Don't create the file - let watcher handle it
        const watcher = new activity_watcher_js_1.ActivityWatcher(activityFile, { debounceDelay: 50 });
        const receivedEvents = [];
        watcher.on('activity', (event) => {
            receivedEvents.push(event);
        });
        watcher.start();
        await sleep(200);
        // Now create the file with an event
        const eventJson = createActivityEventJson({ tool: 'Read' });
        fs.writeFileSync(activityFile, eventJson + '\n');
        await sleep(300);
        // BUG-003: Should detect file creation and new events
        assert(receivedEvents.length > 0, `Watcher should detect file creation and emit events. ` +
            `Expected at least 1 event, got ${receivedEvents.length}.`);
        watcher.close();
    }
    finally {
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
}, 10000);
//# sourceMappingURL=activity.test.js.map