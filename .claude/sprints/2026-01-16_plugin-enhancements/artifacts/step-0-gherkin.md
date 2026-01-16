# Gherkin Scenarios: step-0

## Step Task
Track A - Step 1: Add API Endpoints for Status Page Controls

Add pause/resume/stop control API endpoints to the status server.

Requirements:
- Add POST /api/pause endpoint that creates .pause-requested signal file
- Add POST /api/resume endpoint that creates .resume-requested signal file
- Add POST /api/stop endpoint that creates .stop-requested signal file
- Add GET /api/controls endpoint that returns available actions based on current sprint state
- Signal files should be created in the sprint directory
- Endpoints should read current PROGRESS.yaml to determine valid actions
- Return appropriate HTTP status codes and JSON responses

Files to modify:
- compiler/src/status-server/server.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 8
Required score: 8/8

---

## Scenario 1: TypeScript compiles without errors
```gherkin
Scenario: TypeScript compiles without errors
  Given the server.ts file has been modified with new endpoints
  When I run the TypeScript compiler
  Then no compilation errors occur
```

Verification: `cd /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler && npm run build 2>&1 | tail -1 | grep -q "^$" && echo "PASS" || (npm run build 2>&1; exit 1)`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 2: POST /api/pause endpoint exists and accepts POST requests
```gherkin
Scenario: POST /api/pause endpoint exists
  Given the status server is running
  When I send a POST request to /api/pause
  Then the endpoint responds with a JSON response (not 404 or 405)
```

Verification: `grep -E "case.*['\"]\/api\/pause['\"]|url\s*===?\s*['\"]\/api\/pause['\"]|\.(post|all)\(['\"]\/api\/pause['\"]" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 3: POST /api/resume endpoint exists and accepts POST requests
```gherkin
Scenario: POST /api/resume endpoint exists
  Given the status server is running
  When I send a POST request to /api/resume
  Then the endpoint responds with a JSON response (not 404 or 405)
```

Verification: `grep -E "case.*['\"]\/api\/resume['\"]|url\s*===?\s*['\"]\/api\/resume['\"]|\.(post|all)\(['\"]\/api\/resume['\"]" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 4: POST /api/stop endpoint exists and accepts POST requests
```gherkin
Scenario: POST /api/stop endpoint exists
  Given the status server is running
  When I send a POST request to /api/stop
  Then the endpoint responds with a JSON response (not 404 or 405)
```

Verification: `grep -E "case.*['\"]\/api\/stop['\"]|url\s*===?\s*['\"]\/api\/stop['\"]|\.(post|all)\(['\"]\/api\/stop['\"]" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 5: GET /api/controls endpoint exists
```gherkin
Scenario: GET /api/controls endpoint exists
  Given the status server is running
  When I send a GET request to /api/controls
  Then the endpoint responds with available actions based on sprint state
```

Verification: `grep -E "case.*['\"]\/api\/controls['\"]|url\s*===?\s*['\"]\/api\/controls['\"]|\.(get|all)\(['\"]\/api\/controls['\"]" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 6: Signal file creation logic for pause
```gherkin
Scenario: Pause endpoint creates .pause-requested signal file
  Given the pause endpoint handler is implemented
  When the handler executes
  Then it writes a .pause-requested file to the sprint directory
```

Verification: `grep -E "\.pause-requested|pause-requested" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 7: Signal file creation logic for resume
```gherkin
Scenario: Resume endpoint creates .resume-requested signal file
  Given the resume endpoint handler is implemented
  When the handler executes
  Then it writes a .resume-requested file to the sprint directory
```

Verification: `grep -E "\.resume-requested|resume-requested" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0

---

## Scenario 8: Signal file creation logic for stop
```gherkin
Scenario: Stop endpoint creates .stop-requested signal file
  Given the stop endpoint handler is implemented
  When the handler executes
  Then it writes a .stop-requested file to the sprint directory
```

Verification: `grep -E "\.stop-requested|stop-requested" /home/konstantin/projects/m42-claude-plugins/plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
