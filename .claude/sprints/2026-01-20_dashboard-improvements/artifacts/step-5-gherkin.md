# Gherkin Scenarios: step-5

## Step Task
Implement operator request system for discovered issues.

## Overview
Claude can submit requests to the operator when it discovers issues during execution.
All requests go to the operator queue - no auto-handling modes. The operator (a
dedicated Claude instance) reviews requests, makes decisions with reasoning, and
uses dynamic step injection to add work to the sprint.

---

## Scenario 1: Claude Runner Parses operatorRequests from JSON Result
```gherkin
Scenario: operatorRequests are parsed from Claude JSON result
  Given a phase execution returns JSON with operatorRequests
  When the claude-runner processes the response
  Then the result should contain the parsed operatorRequests array
  And each request should have id, title, description, priority, and type

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "(operatorRequests|operator request)" | head -5`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: Operator Requests Queued in PROGRESS.yaml
```gherkin
Scenario: Operator requests are added to the queue in PROGRESS.yaml
  Given a phase completes with operatorRequests in the JSON result
  When the loop processes the phase completion
  Then the requests should be added to operator-queue in PROGRESS.yaml
  And each request should have status "pending"
  And each request should have a created-at timestamp
  And each request should have discovered-in set to the current phase ID

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "(queue|PROGRESS)" | head -5`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Operator Processes Pending Requests with Decision and Reasoning
```gherkin
Scenario: Operator makes decisions with reasoning for pending requests
  Given there are pending requests in the operator queue
  When the operator handler is triggered
  Then the operator should process each pending request
  And each decision should include a reasoning field
  And the decision should be one of: approve, reject, defer, backlog
  And the request status should be updated to match the decision

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "(decision|reasoning)" | head -5`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: Approved Requests Trigger Step Injection
```gherkin
Scenario: Approved requests trigger dynamic step injection
  Given an operator decision approves a request
  And the decision includes injection configuration
  When the operator executes the decision
  Then a new step should be injected into the sprint
  And the injected step should have the specified position
  And the injected step should be marked as injected: true
  And the request status should be "approved"

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "(inject|approved)" | head -5`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: Rejected Requests Are Logged with Reason
```gherkin
Scenario: Rejected requests are logged with rejection reason
  Given an operator decision rejects a request
  And the decision includes a rejection reason
  When the operator executes the decision
  Then the request status should be "rejected"
  And the rejection reason should be stored with the request
  And no step injection should occur

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "(reject|reason)" | head -5`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: Deferred Requests Are Queued for Later
```gherkin
Scenario: Deferred requests are queued for later processing
  Given an operator decision defers a request
  And the decision includes deferredUntil timestamp
  When the operator executes the decision
  Then the request status should be "deferred"
  And the deferredUntil value should be stored with the request
  And no immediate step injection should occur

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "(defer|later)" | head -5`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 7: Backlog Requests Are Written to BACKLOG.yaml
```gherkin
Scenario: Backlog decisions create entries in BACKLOG.yaml
  Given an operator decision backlogs a request
  And the decision includes backlogEntry configuration
  When the operator executes the decision
  Then an entry should be created in BACKLOG.yaml
  And the entry should include category and suggested-priority
  And the entry should include operator-notes from the decision
  And the entry should have status "pending-review"
  And the original request should have status "backlog"

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "(backlog|BACKLOG)" | head -5`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 8: Critical Priority Requests Trigger Immediate Operator
```gherkin
Scenario: Critical priority requests trigger immediate operator processing
  Given a phase completes with a critical priority operatorRequest
  When the loop processes the phase completion
  Then the operator should be triggered immediately
  And the critical request should be processed before the next phase
  And normal priority requests should remain pending

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime && npm test 2>&1 | grep -E "(critical|immediate)" | head -5`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Unit Test Coverage

| Test File | Test Cases | Scenarios Covered |
|-----------|------------|-------------------|
| runtime/src/claude-runner.test.ts | 6 | 1 |
| runtime/src/operator.test.ts | 18 | 2, 3, 4, 5, 6, 8 |
| runtime/src/backlog.test.ts | 8 | 7 |
| runtime/src/loop.test.ts | 6 | 2, 8 |

---

## RED Phase Verification
Tests are expected to FAIL at this point:
```bash
cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/runtime
npm test
# Expected: FAIL (no implementation yet - operator.ts and backlog.ts don't exist)
```

---

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8
