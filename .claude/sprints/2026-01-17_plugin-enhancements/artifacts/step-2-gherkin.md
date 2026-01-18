# Gherkin Scenarios: step-2

## Step Task
Phase 1 - Step 3: Fix Desktop Notifications Not Working

Notifications are enabled but not appearing due to browser autoplay policy and missing error handling.

Requirements:
- Add try-catch error handling to `showNotification()` function
- Pre-initialize AudioContext on first user interaction (click handler)
- Add "Test Notification" button in the notification settings panel
- Show toast fallback when notification permission denied or fails
- Log notification errors to console for debugging
- Handle case where Notification API is not available

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts (~lines 1948-2169, notification section)

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 6
Required score: 6/6

---

## Scenario 1: showNotification function has try-catch error handling
```gherkin
Scenario: showNotification has try-catch wrapper
  Given the notification implementation exists in page.ts
  When I check the showNotification function
  Then it wraps Notification creation in a try-catch block

Verification: `grep -A 20 "function showNotification" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q "try {"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: AudioContext pre-initialization on user interaction
```gherkin
Scenario: AudioContext is pre-initialized on first user click
  Given the notification settings setup exists
  When I check for AudioContext initialization code
  Then there is a click handler that pre-initializes AudioContext

Verification: `grep -E "(audioContext|AudioContext).*resume|initAudioContext|preInitAudio" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q -E "click|interaction|user"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Test Notification button exists in settings panel
```gherkin
Scenario: Test Notification button is present
  Given the notification settings panel HTML exists
  When I search for a test notification button
  Then a button with test notification functionality is defined

Verification: `grep -E "test.*notification|testNotification|Test Notification" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q -i "button\|btn\|click"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Toast fallback when notifications fail or denied
```gherkin
Scenario: Toast fallback is implemented for notification failures
  Given the showNotification function exists
  When I check the catch block and permission handling
  Then showToast is called as a fallback

Verification: `grep -A 30 "function showNotification" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q "showToast"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Notification errors are logged to console
```gherkin
Scenario: Notification errors are logged for debugging
  Given the showNotification function has error handling
  When I check the catch block
  Then console.error or console.warn is called with notification context

Verification: `grep -A 30 "function showNotification" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q "console\.\(error\|warn\)"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: TypeScript compiles without errors
```gherkin
Scenario: TypeScript compilation succeeds
  Given all notification changes are complete
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0
```
