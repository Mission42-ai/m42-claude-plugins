# BUG-006 + BUG-012 Fix Summary: Path Traversal Hardening

**Status**: FIXED
**Severity**: HIGH (security vulnerability - defense in depth)
**Feature**: status-server

---

## Root Cause

The `getLogFilePath` method in `server.ts` sanitized the `phaseId` parameter using regex, but lacked explicit path containment verification. While the regex sanitization (`[^a-zA-Z0-9-_]` → `_`) effectively blocked known traversal patterns, defense-in-depth security principles require explicit validation that the resolved path stays within the expected directory.

**Original Code** (server.ts:1295-1299):
```typescript
private getLogFilePath(phaseId: string): string {
  const sanitized = phaseId.replace(/ > /g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(this.config.sprintDir, 'logs', `${sanitized}.log`);
  // MISSING: Explicit path containment verification!
}
```

**Why This Matters**:
- Regex-only sanitization is brittle - a bug in the pattern could bypass protection
- Defense-in-depth requires multiple layers of security
- Explicit containment check catches traversal even if sanitization fails

---

## Solution Implemented

Added explicit path containment verification after constructing the path:

**Fixed Code** (server.ts:1295-1308):
```typescript
private getLogFilePath(phaseId: string): string {
  // Convert phase ID to log filename format
  const sanitized = phaseId.replace(/ > /g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
  const logPath = path.join(this.config.sprintDir, 'logs', `${sanitized}.log`);

  // Defense-in-depth: verify path is within expected logs directory
  const resolved = path.resolve(logPath);
  const logsDir = path.resolve(this.config.sprintDir, 'logs');
  if (!resolved.startsWith(logsDir + path.sep)) {
    throw new Error('Invalid log path');
  }

  return logPath;
}
```

---

## Edge Cases Handled

| Edge Case | Handling |
|-----------|----------|
| `../../../etc/passwd` | Sanitized to `_________etc_passwd.log`, containment check passes |
| `..%2F..%2Fetc%2Fpasswd` | URL-encoded dots sanitized to `___2F...` |
| `....//....//etc/passwd` | Double-dot bypass sanitized |
| Empty phaseId | Produces `.log` (empty filename) |
| Null byte injection `phase\0name` | Null byte sanitized to `_` |
| Newline injection `phase\nname` | Newline sanitized to `_` |
| Very long input (1000+ chars) | Passes through (filesystem may truncate) |
| Normal phase ID `development > step-0 > context` | Correctly converted to `development-step-0-context.log` |

---

## Tests Added

Created comprehensive test file `server.test.ts` with 8 tests:

1. **`sanitization prevents basic path traversal with ../`**
   - Verifies `../../../etc/passwd` doesn't contain `..` after sanitization

2. **`sanitization prevents path traversal with embedded ../`**
   - Verifies `valid-phase/../../../etc/passwd` doesn't escape

3. **`BUG-006/012: should FAIL - no explicit path containment verification`**
   - Meta-test that checks for presence of defense-in-depth pattern
   - Verifies `path.resolve`, `startsWith`, and `throw` exist in implementation

4. **`FIXED implementation: throws on path traversal attempt`**
   - Verifies normal phase IDs work correctly

5. **`FIXED implementation: rejects phaseId that could escape (if sanitization failed)`**
   - Simulates broken sanitization to prove containment check catches it

6. **`handles empty phaseId safely`**
   - Verifies empty string produces `.log`

7. **`handles phaseId with only special characters`**
   - Verifies `../../..` becomes `________.log`

8. **`handles normal phase ID format correctly`**
   - Verifies `development > step-0 > context` → `development-step-0-context.log`

---

## Verification

### Test Suite Results
```
✓ sanitization prevents basic path traversal with ../
✓ sanitization prevents path traversal with embedded ../
✓ BUG-006/012: should FAIL - no explicit path containment verification
✓ FIXED implementation: throws on path traversal attempt
✓ FIXED implementation: rejects phaseId that could escape (if sanitization failed)
✓ handles empty phaseId safely
✓ handles phaseId with only special characters
✓ handles normal phase ID format correctly

StatusServer path traversal security tests completed.
```

### Manual Edge Case Testing
```
Edge case testing for getLogFilePath:

✓ 'normal-phase' (should work)
  → /tmp/test-sprint/logs/normal-phase.log
✓ 'development > step-0 > context' (should work)
  → /tmp/test-sprint/logs/development-step-0-context.log
✓ '../../../etc/passwd' (sanitized to safe)
  → /tmp/test-sprint/logs/_________etc_passwd.log
✓ '..%2F..%2F..%2Fetc%2Fpasswd' (URL encoded traversal sanitized)
  → /tmp/test-sprint/logs/___2F___2F___2Fetc_2Fpasswd.log
✓ '....//....//etc/passwd' (double-dot bypass sanitized)
  → /tmp/test-sprint/logs/____________etc_passwd.log
✓ 'phase\0name' (null byte sanitized)
  → /tmp/test-sprint/logs/phase_name.log
✓ 'phase\nname' (newline sanitized)
  → /tmp/test-sprint/logs/phase_name.log
✓ 'aaa...(1000 chars)' (very long input)
  → /tmp/test-sprint/logs/aaa....log
```

---

## Follow-up Items

- [ ] Consider adding maximum path length validation
- [ ] Consider rate limiting log endpoint requests
- [ ] Consider adding logging/alerting for invalid path attempts

---

## Files Modified

- `plugins/m42-sprint/compiler/src/status-server/server.ts` (lines 1295-1308)
- `plugins/m42-sprint/compiler/src/status-server/server.test.ts` (new file, 269 lines)

## Note

BUG-006 and BUG-012 describe the same issue from different discovery methods (static-analysis vs manual-exploration). Both are fixed by this single change.
