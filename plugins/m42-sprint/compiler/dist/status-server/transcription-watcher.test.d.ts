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
export {};
//# sourceMappingURL=transcription-watcher.test.d.ts.map