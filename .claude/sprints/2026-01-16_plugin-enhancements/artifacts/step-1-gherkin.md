# Gherkin Scenarios: step-1

## Step Task
Track A - Step 2: Add Button UI Components to Status Page

Implement interactive control buttons in the status page UI.

Requirements:
- Add control bar below header with Pause/Resume/Stop buttons
- Button visibility based on sprint status (show Pause when running, Resume when paused)
- Stop button should be red and always visible when sprint is active
- Add confirmation modal for Stop button with warning about incomplete work
- Implement click handlers that call the new API endpoints
- Add loading states during API calls
- Add toast notifications for success/error feedback
- Ensure buttons are styled consistently with existing GitHub dark theme

Files to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: Control bar HTML element exists
```gherkin
Scenario: Control bar HTML element exists in page template
  Given the page.ts file has been modified
  When I check the generated HTML structure
  Then a control bar element with appropriate class exists below the header

Verification: `grep -q 'class="control-bar"\|class=\\"control-bar\\"' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Pause button element exists
```gherkin
Scenario: Pause button exists in control bar
  Given the control bar exists
  When I check for the pause button
  Then a button with pause functionality identifier exists

Verification: `grep -E 'id="pause-btn"|id=\\"pause-btn\\"|pause-btn|pauseBtn' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Resume button element exists
```gherkin
Scenario: Resume button exists in control bar
  Given the control bar exists
  When I check for the resume button
  Then a button with resume functionality identifier exists

Verification: `grep -E 'id="resume-btn"|id=\\"resume-btn\\"|resume-btn|resumeBtn' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Stop button element exists with red styling
```gherkin
Scenario: Stop button exists with danger/red styling
  Given the control bar exists
  When I check for the stop button
  Then a stop button exists with danger/red styling indicator

Verification: `grep -E 'stop-btn.*danger|danger.*stop|stop.*red|--accent-red.*stop|stop.*accent-red' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Confirmation modal exists for stop action
```gherkin
Scenario: Stop confirmation modal exists with warning message
  Given the stop button exists
  When I check for a confirmation modal
  Then a modal with confirmation dialog and warning exists

Verification: `grep -E 'confirm.*modal|modal.*confirm|stop.*confirm|incomplete|warning' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: API endpoint calls are implemented
```gherkin
Scenario: Click handlers call API endpoints
  Given buttons exist in the control bar
  When I check for API call implementations
  Then fetch calls to /api/pause, /api/resume, and /api/stop exist

Verification: `grep -E "fetch.*['\"]/?api/(pause|resume|stop)" plugins/m42-sprint/compiler/src/status-server/page.ts | wc -l | xargs test 2 -le`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Loading states during API calls
```gherkin
Scenario: Loading state management exists
  Given API call handlers are implemented
  When I check for loading state logic
  Then loading state variables or CSS classes are present

Verification: `grep -E 'loading|disabled|isLoading|setLoading|\.loading' plugins/m42-sprint/compiler/src/status-server/page.ts | grep -v '// ' | head -1`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Toast notification system exists
```gherkin
Scenario: Toast notifications for feedback
  Given API calls return success or error
  When I check for toast notification system
  Then toast/notification display functions or elements exist

Verification: `grep -E 'toast|notification|showMessage|showError|showSuccess|alert.*success|alert.*error' plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Summary

| # | Scenario | Verification Target |
|---|----------|---------------------|
| 1 | Control bar exists | HTML structure with control-bar class |
| 2 | Pause button exists | Button element for pause action |
| 3 | Resume button exists | Button element for resume action |
| 4 | Stop button (red) exists | Stop button with danger styling |
| 5 | Confirmation modal | Modal for stop confirmation |
| 6 | API calls implemented | fetch() calls to control endpoints |
| 7 | Loading states | Loading indicator management |
| 8 | Toast notifications | User feedback system |

All 8 scenarios verify distinct, binary-testable requirements from the step specification.
