# Gherkin Scenarios: step-10

## Step Task
Track D - Step 3: Add Desktop Notifications

Implement browser desktop notifications for sprint events.

Requirements:
- Use Browser Notification API for desktop alerts
- Notify on the following events:
  - Sprint completed (success)
  - Sprint failed
  - Phase blocked/stuck
  - Human intervention needed
- Add notification permission request flow on first visit
- Add optional sound alerts (configurable)
- Create notification settings panel in status page:
  - Enable/disable notifications toggle
  - Per-event notification toggles
  - Sound on/off toggle
  - Sound selection dropdown
- Persist notification preferences in localStorage
- Include sprint/phase info in notification body
- Add click handler to focus status page tab

Files to modify:
- compiler/src/status-server/page.ts (notification logic and settings UI)

Assets to add:
- compiler/src/status-server/assets/notification-sounds/ (optional sound files)


## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: Notification settings panel exists in HTML
  Given the page.ts file exists
  When I check for the notification settings panel
  Then the HTML includes a notification settings container with id "notification-settings"

Verification: `grep -q 'id="notification-settings"' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Notification permission request function exists
  Given the page.ts file exists
  When I check for the permission request implementation
  Then a function to request Notification permission is defined

Verification: `grep -q 'Notification.requestPermission' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Notification trigger functions exist for all required events
  Given the page.ts file exists
  When I check for notification trigger implementations
  Then functions exist to send notifications for sprint-completed, sprint-failed, phase-blocked, and needs-human events

Verification: `grep -E 'sendNotification.*completed|sendNotification.*failed|sendNotification.*blocked|sendNotification.*needs-human|triggerNotification.*completed|triggerNotification.*failed|triggerNotification.*blocked|triggerNotification.*human|showNotification.*(completed|failed|blocked|human)' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts | wc -l | xargs test 1 -le`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Notification preferences persisted to localStorage
  Given the page.ts file exists
  When I check for localStorage notification preference handling
  Then both reading and writing notification preferences to localStorage are implemented

Verification: `grep -q "localStorage.*notification" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts && grep -q "setItem.*notification\|notification.*setItem" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Settings UI includes enable/disable toggle
  Given the page.ts file exists
  When I check for the master notifications enable toggle
  Then an input element for enabling/disabling notifications exists

Verification: `grep -E 'notifications-enabled|enable-notifications|notification-toggle|notificationsEnabled' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts | grep -q -i 'checkbox\|toggle\|input'`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Click handler to focus tab is implemented
  Given the page.ts file exists
  When I check for notification click handler implementation
  Then the onclick handler includes window.focus() to bring the status page tab to front

Verification: `grep -q 'onclick.*focus\|notification.*onclick.*window.focus\|\.onclick.*function.*focus' /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: TypeScript compiles without errors
  Given the page.ts file has been modified with notification features
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build 2>&1 | tail -1 | grep -v "error"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
