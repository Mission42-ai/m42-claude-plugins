# Step Context: step-0

## Task
Implement chat-like Live Activity UI showing assistant messages alongside tool calls.

Requirements:
1. Extend ActivityEvent type in activity-types.ts:
   - Add 'assistant' event type
   - Add text, isThinking fields

2. Modify TranscriptionWatcher in transcription-watcher.ts:
   - Parse content_block_start with type "text"
   - Parse content_block_delta with text_delta
   - Accumulate text deltas with 500ms debouncing
   - Emit ActivityEvent with type='assistant'

3. Update page.ts renderLiveActivity():
   - Assistant messages: chat bubble style, full content
   - Tool calls: grey/secondary style with better descriptions
   - TodoWrite → "Updated task list"
   - Edit → "Editing {filename}"
   - Read → "Reading {filename}"

4. Add CSS styling for chat-like appearance

Files:
- plugins/m42-sprint/compiler/src/status-server/activity-types.ts
- plugins/m42-sprint/compiler/src/status-server/transcription-watcher.ts
- plugins/m42-sprint/compiler/src/status-server/page.ts

Verification: Start a sprint and verify assistant messages appear in chat style

## Implementation Plan
Based on gherkin scenarios, implement in this order:

1. **activity-types.ts** - Extend ActivityEvent type (Scenarios 1, 2)
   - Add 'assistant' to type union
   - Add optional `text: string` field
   - Add optional `isThinking: boolean` field
   - Update `isActivityEvent()` type guard for new type

2. **transcription-watcher.ts** - Parse text content blocks (Scenarios 3, 4, 5)
   - Add text block state tracking (current block index, accumulated text)
   - Parse `content_block_start` with `content_block.type === 'text'`
   - Parse `content_block_delta` with `delta.type === 'text_delta'`
   - Parse `content_block_stop` to finalize text block
   - Implement 500ms text debouncing (separate from file debounce)
   - Emit assistant ActivityEvent with accumulated text

3. **page.ts** - Update renderLiveActivity() (Scenarios 6, 7, 8)
   - Add CSS classes for chat styling (`.activity-assistant`, `.activity-bubble`, etc.)
   - Add `getToolDescription()` function for human-readable descriptions
   - Update `renderLiveActivity()` to handle assistant events
   - Add thinking animation CSS

## Related Code Patterns

### Pattern from: activity-types.ts (type guard pattern)
```typescript
export function isActivityEvent(obj: unknown): obj is ActivityEvent {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const event = obj as Record<string, unknown>;

  // Required fields
  if (typeof event.ts !== 'string') return false;
  if (event.type !== 'tool') return false;  // UPDATE: Add 'assistant' check
  if (typeof event.tool !== 'string') return false;
  if (!isVerbosityLevel(event.level)) return false;

  // Optional fields must be correct type if present
  if (event.file !== undefined && typeof event.file !== 'string') return false;
  if (event.params !== undefined && typeof event.params !== 'string') return false;

  return true;
}
```

### Pattern from: transcription-watcher.ts (NDJSON parsing)
```typescript
// Existing tool_use parsing pattern to follow
if (event.type === 'stream_event' &&
    event.event?.type === 'content_block_start' &&
    event.event?.content_block?.type === 'tool_use') {
  const toolUse = event.event.content_block;
  toolUses.push({
    id: toolUse.id,
    name: toolUse.name,
    input: toolUse.input || {},
  });
}

// NEW: Add text block parsing following same pattern
// content_block_start with type='text'
// content_block_delta with delta.type='text_delta'
// content_block_stop to finalize
```

### Pattern from: transcription-watcher.ts (debouncing)
```typescript
// Existing file debounce pattern (100ms for file changes)
private handleFileEvent(filename: string): void {
  if (this.debounceTimer) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }
  this.debounceTimer = setTimeout(() => {
    this.debounceTimer = null;
    const filePath = path.join(this.transcriptionsDir, filename);
    this.processFile(filePath, true);
  }, this.debounceDelay);
}

// NEW: Text accumulation needs separate 500ms debounce timer
// This accumulates rapid text_delta events into single emission
```

### Pattern from: page.ts (renderLiveActivity)
```typescript
function renderLiveActivity() {
  const filtered = liveActivityLog.filter(function(event) {
    return shouldShowActivityEvent(event.level);
  });

  const html = filtered.map(function(event) {
    const icon = getToolIcon(event.tool);
    const eventDate = new Date(event.ts);
    const timeStr = eventDate.toLocaleTimeString('en-US', { hour12: false });
    const fullDateTime = eventDate.toLocaleString();

    // Current: Only handles tool events
    // NEW: Add assistant event handling with chat bubble style
    return '<div class="activity-entry">' +
      '<span class="activity-time" title="' + escapeHtml(fullDateTime) + '">' + escapeHtml(timeStr) + '</span>' +
      '<span class="activity-icon">' + icon + '</span>' +
      '<span class="activity-tool">' + escapeHtml(event.tool) + '</span>' +
      '<span class="activity-desc">' + desc + '</span>' +
      '</div>';
  }).join('');
}
```

### Pattern from: page.ts (CSS styling)
```css
/* Existing activity styling pattern */
.activity-entry {
  display: flex;
  padding: 4px 16px;
  gap: 8px;
  font-size: 12px;
  align-items: flex-start;
}

.activity-tool {
  color: var(--accent-purple);
  font-weight: 500;
  flex-shrink: 0;
  min-width: 60px;
}

/* NEW: Add assistant-specific styling */
/* .activity-assistant - chat bubble container */
/* .activity-bubble - text content wrapper */
/* .activity-thinking - pulsing animation */
/* .activity-tool-desc - human-readable tool description */
```

## Required Imports
### Internal
- `activity-types.ts`: No new imports needed
- `transcription-watcher.ts`: Already imports `ActivityEvent`, `VerbosityLevel`
- `page.ts`: No new imports (generates self-contained HTML)

### External
- None - all dependencies already in place

## Types/Interfaces to Use

### From activity-types.ts (to be extended)
```typescript
// CURRENT
export interface ActivityEvent {
  ts: string;
  type: 'tool';
  tool: string;
  level: VerbosityLevel;
  file?: string;
  params?: string;
  input?: unknown;
  response?: unknown;
}

// NEW: Discriminated union approach
export type ActivityEvent = ToolActivityEvent | AssistantActivityEvent;

interface BaseActivityEvent {
  ts: string;
  level: VerbosityLevel;
}

export interface ToolActivityEvent extends BaseActivityEvent {
  type: 'tool';
  tool: string;
  file?: string;
  params?: string;
  input?: unknown;
  response?: unknown;
}

export interface AssistantActivityEvent extends BaseActivityEvent {
  type: 'assistant';
  text: string;
  isThinking?: boolean;
}
```

### Text Block State (new internal type for transcription-watcher.ts)
```typescript
interface TextBlockState {
  index: number;
  text: string;
  startTime: number;
}
```

## Integration Points

### Called by:
- `server.ts`: Watches TranscriptionWatcher for 'activity' events
- `page.ts`: JavaScript handles SSE 'activity-event' messages

### Calls:
- `EventEmitter.emit('activity', event)` - emits to server.ts

### SSE Event Flow:
1. TranscriptionWatcher parses NDJSON from Claude CLI
2. Emits 'activity' event (tool or assistant)
3. Server.ts broadcasts via SSE: `event: activity-event\ndata: {...}\n\n`
4. Page.ts handleActivityEvent() receives and renders

## Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| `activity-types.ts` | Modify | Add 'assistant' type, text/isThinking fields, update type guard |
| `transcription-watcher.ts` | Modify | Parse text blocks, accumulate deltas, 500ms debounce, emit assistant events |
| `page.ts` | Modify | CSS classes, getToolDescription(), renderLiveActivity() for assistant |

## Claude CLI NDJSON Format Reference

### Text Content Events (to implement)
```json
// content_block_start - begins text block
{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}}

// content_block_delta - text fragment
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello "}}}
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"world!"}}}

// content_block_stop - ends text block
{"type":"stream_event","event":{"type":"content_block_stop","index":0}}
```

### Tool Use Events (existing support)
```json
{"type":"stream_event","event":{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_123","name":"Read","input":{"file_path":"/test.ts"}}}}
```

## Test Files (RED phase - already written)
| Test File | Scenarios | Status |
|-----------|-----------|--------|
| `activity-types.test.ts` | 1, 2 | FAILING (expected) |
| `transcription-watcher.test.ts` | 3, 4, 5 | FAILING (expected) |
| `chat-activity.test.ts` | 6, 7, 8 | PASSING (spec only) |

## CSS Classes to Add
```css
/* Assistant message styling */
.activity-assistant { }          /* Container for assistant entries */
.activity-bubble { }             /* Chat bubble wrapper */
.activity-thinking { }           /* Pulsing animation for typing */

/* Tool call styling (update existing) */
.activity-tool-entry { }         /* Renamed for clarity */
.activity-tool-desc { }          /* Human-readable description */
```

## Human-Readable Tool Descriptions
| Tool | Description Pattern |
|------|---------------------|
| TodoWrite | "Updated task list" |
| Edit | "Editing {filename}" |
| Read | "Reading {filename}" |
| Write | "Writing {filename}" |
| Bash | "{command}" (truncated at 50 chars) |
| Grep | "Searching: {pattern}" |
| Glob | "Finding: {pattern}" |
| Task | "{description}" |
| WebFetch | "Fetching web content" |
| AskUserQuestion | "Asking question" |
| default | "{toolName}" |
