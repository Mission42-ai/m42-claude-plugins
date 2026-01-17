# Gherkin Scenarios: step-15

## Step Task
Phase 5 - Step 1: Enhanced Connection Status with Reconnection Info

Show reconnection attempt count and countdown timer when disconnected.

Requirements:
- Track reconnection attempt number
- Show countdown timer to next reconnection attempt
- Display format: "Reconnecting in 5s... (attempt 3/10)"
- Add visual indicator (pulsing dot, color change) for connection state
- Show toast when connection is restored
- Max 10 reconnection attempts before showing "Connection lost" with manual retry

Verification:
- Disconnect server, verify countdown displays
- Verify attempt counter increments
- Reconnect server, verify "Connected" toast shows

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: MAX_RECONNECT_ATTEMPTS constant defined
  Given the page.ts file contains connection handling code
  When I check for a maximum reconnection attempts constant
  Then a constant or variable for max attempts (10) exists

Verification: `grep -qE "(MAX_RECONNECT_ATTEMPTS|maxReconnectAttempts)\\s*=\\s*10" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Reconnection countdown timer variable exists
  Given the page.ts file contains reconnection logic
  When I check for a countdown timer variable
  Then variables for tracking countdown seconds and interval exist

Verification: `grep -qE "(reconnectCountdown|countdownTimer|reconnectTimer)" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Connection status displays attempt count format
  Given the updateConnectionStatus function handles disconnected state
  When I check for the attempt counter display format
  Then the format includes "attempt X/10" pattern

Verification: `grep -qE "attempt.*\\/" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: Countdown timer display with seconds format
  Given the connection status shows reconnection info
  When I check for countdown seconds display
  Then the format includes "Reconnecting in Xs" pattern

Verification: `grep -qE "Reconnecting in.*s" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: Connection lost state after max attempts
  Given the reconnection logic tracks attempt count
  When I check for connection lost handling after max attempts
  Then a "Connection lost" message with manual retry option exists

Verification: `grep -qE "Connection lost|connection-lost" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Manual retry button or mechanism exists
  Given max reconnection attempts can be exhausted
  When I check for manual retry functionality
  Then a retry button or manual reconnect handler exists

Verification: `grep -qE "(manualReconnect|retry-btn|retryConnection|Retry.*connection)" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Toast shown when connection restored
  Given the connection can be restored after disconnection
  When I check the connected state handling
  Then a success toast is shown for reconnection

Verification: `grep -qE "showToast.*['\"]success['\"].*[cC]onnect|[cC]onnect.*showToast.*success" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: TypeScript compiles without errors
  Given the enhanced connection status code is implemented
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; test $? -eq 0`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
