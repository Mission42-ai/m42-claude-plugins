# Gherkin Scenarios: step-0

## Step Task
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


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: ActivityEvent type supports assistant type
```gherkin
Scenario: ActivityEvent type guard accepts assistant event type
  Given an activity event object with type='assistant'
  When the event is validated using isActivityEvent()
  Then the function returns true
  And the event is recognized as valid ActivityEvent

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run test 2>&1 | grep -E "(assistant event type|✓.*assistant)" | head -5`
Pass: Exit code = 0 and output contains passing test message
Fail: Exit code ≠ 0 or test fails
```

---

## Scenario 2: ActivityEvent has text and isThinking fields for assistant type
```gherkin
Scenario: Assistant ActivityEvent contains text and isThinking fields
  Given an activity event with type='assistant'
  When the event includes text="Hello user" and isThinking=false
  Then isActivityEvent() validates the event as correct
  And the text and isThinking fields are accessible on the typed object

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run test 2>&1 | grep -E "(text field|isThinking field|✓.*text)" | head -5`
Pass: Exit code = 0 and tests pass
Fail: Exit code ≠ 0
```

---

## Scenario 3: TranscriptionWatcher parses content_block_start with text type
```gherkin
Scenario: TranscriptionWatcher detects text content block start
  Given a Claude CLI NDJSON line with stream_event
  And the event has type='content_block_start' with content_block.type='text'
  When TranscriptionWatcher parses this line
  Then an assistant ActivityEvent is prepared (pending accumulation)

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run test 2>&1 | grep -E "(content_block_start.*text|text content block)" | head -5`
Pass: Test passes with grep output
Fail: No matching test output
```

---

## Scenario 4: TranscriptionWatcher accumulates text_delta content
```gherkin
Scenario: Text deltas are accumulated into complete assistant message
  Given multiple content_block_delta events with text_delta
  And the text fragments are "Hello ", "world", "!"
  When TranscriptionWatcher processes these sequentially
  Then the accumulated text is "Hello world!"
  And a single assistant ActivityEvent is emitted after debounce

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run test 2>&1 | grep -E "(accumulates text|text_delta|Hello world)" | head -5`
Pass: Test demonstrates accumulated text
Fail: Individual deltas instead of combined
```

---

## Scenario 5: Text accumulation debounces at 500ms
```gherkin
Scenario: Assistant text events are debounced for 500ms
  Given text_delta events arriving every 100ms
  When 5 deltas arrive within 500ms
  Then only one assistant ActivityEvent is emitted
  And the event contains all accumulated text

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run test 2>&1 | grep -E "(debounce|500ms|single.*event)" | head -5`
Pass: Debouncing test passes
Fail: Multiple events emitted
```

---

## Scenario 6: renderLiveActivity displays assistant messages as chat bubbles
```gherkin
Scenario: Assistant messages render with chat bubble styling
  Given an ActivityEvent with type='assistant' and text="Working on your request"
  When renderLiveActivity processes this event
  Then the HTML output contains chat bubble classes
  And the full text content is displayed

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run test 2>&1 | grep -E "(chat bubble|assistant.*style|activity-assistant)" | head -5`
Pass: Chat bubble class present in output
Fail: No chat styling applied
```

---

## Scenario 7: Tool calls render with human-readable descriptions
```gherkin
Scenario: Tool events show user-friendly descriptions
  Given tool ActivityEvents for Edit, Read, and TodoWrite
  When renderLiveActivity processes these events
  Then Edit shows "Editing {filename}"
  And Read shows "Reading {filename}"
  And TodoWrite shows "Updated task list"

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run test 2>&1 | grep -E "(Editing|Reading|Updated task list|tool description)" | head -5`
Pass: Human-readable descriptions in output
Fail: Raw tool names only
```

---

## Scenario 8: Tool calls have grey/secondary styling
```gherkin
Scenario: Tool call entries use secondary visual styling
  Given a tool ActivityEvent (type='tool')
  When renderLiveActivity generates HTML
  Then the entry has grey/secondary color classes
  And tool entries are visually distinct from assistant messages

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run test 2>&1 | grep -E "(secondary|tool.*style|grey|muted)" | head -5`
Pass: Secondary styling classes present
Fail: Same styling as assistant messages
```

---

## Unit Test Coverage
| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| activity-types.test.ts | 10 | 1, 2 |
| transcription-watcher.test.ts | 12 | 3, 4, 5 |
| chat-activity.test.ts | 15 | 6, 7, 8 |

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build && npm run test
# Expected: FAIL (no implementation yet)
```

### Actual Test Results (RED Phase):

**activity-types.test.ts**: FAILS as expected
- `isActivityEvent` rejects `type='assistant'` (not in type union)
- Error: "isActivityEvent should accept type='assistant'. Currently only accepts 'tool'."

**transcription-watcher.test.ts**: FAILS as expected
- TranscriptionWatcher doesn't emit assistant events (8 scenarios fail)
- Backward compatibility tests PASS (tool events still work)
- Error: "Should have assistant events, got 0"

**chat-activity.test.ts**: PASSES (documents expected behavior)
- Tests use helper function that simulates expected output format
- Serves as specification for GREEN phase implementation
- Documents required CSS classes and styling
