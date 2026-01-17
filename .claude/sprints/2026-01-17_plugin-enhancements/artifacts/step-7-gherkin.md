# Gherkin Scenarios: step-7

## Step Task
Phase 3 - Step 2: Add Enhanced Error Messages with Recovery Actions

Show contextual error details with actionable recovery guidance.

Requirements:
- Create error classification system for phase failures
- Categories: network, rate-limit, timeout, validation, logic
- Display error category badge in failed phase cards
- Show recovery suggestions based on error type:
  - network: "Check internet connection and retry"
  - rate-limit: "Wait a few minutes before retrying"
  - timeout: "Phase took too long - try breaking into smaller steps"
  - validation: "Review input/output requirements"
  - logic: "Review Claude's reasoning in the log"
- Add "View Error Details" expandable section in phase cards
- Include stack trace or relevant error message

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: Recovery suggestions mapping exists in JavaScript
  Given the page.ts file contains the JavaScript code
  When I check for recovery suggestion mappings
  Then all 5 error categories have defined recovery suggestions

Verification: `grep -E "(network|rate-limit|timeout|validation|logic).*:.*['\"].*retry|connection|wait|review" plugins/m42-sprint/compiler/src/status-server/page.ts | grep -c ":" | grep -qE "^[5-9]|^[1-9][0-9]"`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: Network error recovery message is correct
  Given the page.ts contains recovery suggestion logic
  When I check for network error recovery text
  Then it contains "Check internet connection" or similar network-related suggestion

Verification: `grep -i "network.*check.*internet\|network.*connection" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: Rate-limit error recovery message is correct
  Given the page.ts contains recovery suggestion logic
  When I check for rate-limit error recovery text
  Then it contains "wait" or timing-related suggestion

Verification: `grep -i "rate-limit.*wait\|rate.limit.*minutes" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: View Error Details expandable section exists
  Given the page.ts contains phase tree rendering
  When I check for error details expandable UI
  Then there is a View Error Details button or expandable section

Verification: `grep -iE "error.details|view.*error|expand.*error|error.*expand" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: CSS styles for error details section exist
  Given the page.ts contains getStyles() function
  When I check for error details CSS classes
  Then appropriate styles for error details container exist

Verification: `grep -E "\.error-details|\.recovery-suggestion|error-message" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: TypeScript compiles without errors
  Given the page.ts has been modified
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; echo "EXIT:$?"`
Pass: Last line contains EXIT:0 → Score 1
Fail: Last line does not contain EXIT:0 → Score 0

---

## Scenario 7: Recovery suggestion function or mapping is defined
  Given the page.ts contains JavaScript logic
  When I check for recovery suggestion function or lookup
  Then a function getRecoverySuggestion or equivalent mapping exists

Verification: `grep -E "getRecoverySuggestion|recoverySuggestions|recovery.*Suggestions|RECOVERY_SUGGESTIONS" plugins/m42-sprint/compiler/src/status-server/page.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
