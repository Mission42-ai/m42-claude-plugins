# Gherkin Scenarios: step-4

## Step Task
Phase 2 - Step 2: Add EventEmitter Pattern to StatusServer

Implement ready signal using EventEmitter pattern to eliminate race condition.

Requirements:
- Import EventEmitter from 'events' in server.ts
- Make StatusServer extend EventEmitter (or add as property)
- Emit 'ready' event AFTER server.listen() callback fires
- Add `waitForReady(): Promise<void>` method that resolves on 'ready' event
- Write port file ONLY after server is confirmed listening
- Add timeout handling (fail after 10 seconds if server doesn't start)

Verification:
- Call waitForReady() before sprint loop starts
- Verify port file exists only after server is ready
- Verify timeout triggers if server fails to start

File to modify:
- plugins/m42-sprint/compiler/src/status-server/server.ts

## Success Criteria
All scenarios must pass (score = 1) for the step to be complete.
Total scenarios: 7
Required score: 7/7

---

## Scenario 1: EventEmitter is imported from events module
```gherkin
Scenario: EventEmitter is imported from events module
  Given the server.ts file exists
  When I check for EventEmitter import
  Then the import statement is present

Verification: `grep -q "import.*EventEmitter.*from 'events'\|import { EventEmitter } from 'events'\|import \* as events from 'events'" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 2: StatusServer extends EventEmitter or has EventEmitter property
```gherkin
Scenario: StatusServer uses EventEmitter pattern
  Given the server.ts file exists
  When I check for EventEmitter integration
  Then StatusServer extends EventEmitter or has emitter property

Verification: `grep -qE "(class StatusServer extends EventEmitter|private.*emitter.*EventEmitter|private readonly emitter.*=.*new EventEmitter)" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 3: Ready event is emitted after server.listen callback
```gherkin
Scenario: Ready event is emitted after server starts listening
  Given StatusServer uses EventEmitter pattern
  When I check the start() method
  Then a 'ready' event is emitted in the listen callback

Verification: `grep -qE "emit\(['\"]ready['\"]|this\.emit\(['\"]ready['\"]" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 4: waitForReady method exists
```gherkin
Scenario: waitForReady method is defined
  Given the server.ts file exists
  When I check for waitForReady method
  Then the method signature is present returning Promise<void>

Verification: `grep -qE "waitForReady\(\).*:.*Promise<void>|async waitForReady\(\)|waitForReady\s*=\s*\(\)" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 5: waitForReady has timeout handling
```gherkin
Scenario: waitForReady includes timeout handling
  Given waitForReady method exists
  When I check for timeout implementation
  Then timeout handling with rejection is present

Verification: `grep -qE "(setTimeout|timeout).*10.*000|10_?000.*ms|DEFAULT_READY_TIMEOUT|READY_TIMEOUT" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Scenario 6: TypeScript compiles without errors
```gherkin
Scenario: TypeScript compiles without errors
  Given the server.ts modifications are complete
  When I run the TypeScript compiler
  Then no compilation errors occur

Verification: `cd plugins/m42-sprint/compiler && npx tsc --noEmit 2>&1; echo $?`
Pass: Last line = 0 → Score 1
Fail: Last line ≠ 0 → Score 0
```

---

## Scenario 7: StatusServer exports are compatible
```gherkin
Scenario: StatusServer class is properly exported
  Given the EventEmitter pattern is implemented
  When I check for class export
  Then StatusServer is exported and usable

Verification: `grep -q "export class StatusServer" plugins/m42-sprint/compiler/src/status-server/server.ts && grep -q "export.*createStatusServer" plugins/m42-sprint/compiler/src/status-server/server.ts`
Pass: Exit code = 0 → Score 1
Fail: Exit code ≠ 0 → Score 0
```

---

## Notes

### Port File Requirement
The port file writing is handled in `index.ts` (the CLI entry point), not in `server.ts`. The server itself focuses on the HTTP server lifecycle. The port file integration will be verified in Step 5 when browser auto-open is integrated.

### waitForReady Usage Pattern
```typescript
const server = new StatusServer(config);
await server.start();
await server.waitForReady(); // Now safe to open browser or write port file
```

### Timeout Error Handling
The timeout should reject with a clear error message indicating the server failed to start within the expected timeframe. This enables proper error handling in consumers.
