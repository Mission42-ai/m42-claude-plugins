# Gherkin Scenarios: step-6

## Step Task
Track C - Step 3: Add Live Activity UI Panel to Status Page

Implement Live Activity display panel in the status page.

Requirements:
- Add "Live Activity" panel below current task section
- Subscribe to activity SSE events from server
- Display activity entries with timestamps, icons, and descriptions
- Add verbosity dropdown selector (Minimal/Basic/Detailed/Verbose)
- Store verbosity preference in localStorage
- Implement auto-scroll behavior with manual scroll lock
- Add "Clear Activity" button to reset display
- Use appropriate icons for different tool types (Read=📖, Write=✏️, Bash=⚡, etc.)
- Limit displayed entries (e.g., last 100) for performance
- Style consistently with existing GitHub dark theme

Files to modify:
- compiler/src/status-server/page.ts

Design considerations:
- Activity panel should be collapsible to save space
- Timestamps should be relative (e.g., "2s ago") with tooltip showing absolute time
- Long file paths should be truncated with tooltip showing full path


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Live Activity section exists in HTML
  Given the page.ts file has been modified
  When I examine the generated HTML structure
  Then a "Live Activity" section exists with proper structure

Verification: `grep -q 'Live Activity\|live-activity\|liveActivity' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Verbosity dropdown selector is present
  Given the Live Activity panel exists
  When I examine the HTML elements
  Then a verbosity dropdown/select with options Minimal, Basic, Detailed, Verbose exists

Verification: `grep -E "(select|dropdown).*verbosity|verbosity.*(select|dropdown)" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE "minimal|basic|detailed|verbose" || grep -E "minimal.*basic.*detailed.*verbose|Minimal.*Basic.*Detailed.*Verbose" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: localStorage is used for verbosity preference
  Given the page.ts contains JavaScript code
  When I check for verbosity persistence logic
  Then localStorage is used to save and load verbosity preference

Verification: `grep -q "localStorage.*verbosity\|verbosity.*localStorage" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Clear Activity button exists
  Given the Live Activity panel exists
  When I examine the UI controls
  Then a Clear Activity button or clear functionality exists

Verification: `grep -qE "clear.*activity|Clear Activity|clearActivity|clear-activity" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Tool-specific icons are implemented
  Given the page.ts handles activity display
  When I check for tool icon mappings
  Then icons exist for Read, Write, Bash, and Edit tools

Verification: `grep -E "📖|📝|✏️|⚡|Read.*icon|Write.*icon|Bash.*icon|Edit.*icon|getToolIcon|toolIcon|tool-icon" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts | grep -qE "Read|Write|Bash|Edit"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Activity event SSE subscription is implemented
  Given the page.ts contains JavaScript code
  When I check for SSE event handling
  Then an event listener for 'activity-event' type exists

Verification: `grep -q "activity-event" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Entry limit of 100 is implemented
  Given activity events are being stored
  When I check the entry management logic
  Then a limit of approximately 100 entries is enforced

Verification: `grep -qE "100|maxActivity|MAX_ACTIVITY|activityLimit|ACTIVITY_LIMIT" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: TypeScript compiles without errors
  Given the page.ts file has been modified
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build 2>&1 | grep -v "^>" | tail -1 | grep -qvE "error|Error" && test -f dist/status-server/page.js`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
