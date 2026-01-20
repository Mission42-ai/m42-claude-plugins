# Bug Analysis: BUG-006 + BUG-012 - Path Traversal Hardening

## 1. Root Cause Location

- **File**: `compiler/src/status-server/server.ts`
- **Function**: `getLogFilePath` (private method)
- **Lines**: 1295-1299

```typescript
private getLogFilePath(phaseId: string): string {
  // Convert phase ID to log filename format
  const sanitized = phaseId.replace(/ > /g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(this.config.sprintDir, 'logs', `${sanitized}.log`);
}
```

## 2. Conditions That Trigger the Bug

### Data Flow

1. **User Input Entry Points**:
   - `GET /api/logs/:phaseId` → `handleLogContentRequest()` (line 1318)
   - `GET /api/logs/download/:phaseId` → `handleLogDownloadRequest()` (line 1352)

2. **Input Extraction** (lines 327-337):
   ```typescript
   const logContentMatch = url.match(/^\/api\/logs\/([^/]+)$/);
   const logDownloadMatch = url.match(/^\/api\/logs\/download\/([^/]+)$/);
   const phaseId = decodeURIComponent(logContentMatch[1]);
   ```

3. **Vulnerable Path Construction**:
   - The `phaseId` is URL-decoded, then sanitized with regex
   - The sanitization replaces ` > ` with `-` and non-alphanumeric chars with `_`
   - Result is joined with `sprintDir/logs/` to form the final path

### Attack Vectors Considered

| Attack | Input | After Sanitization | Result |
|--------|-------|-------------------|--------|
| Basic traversal | `../../../etc/passwd` | `_______etc_passwd` | Blocked |
| URL-encoded | `%2e%2e%2fetc/passwd` | `___etc_passwd` | Blocked |
| Double-encoded | `%252e%252e%252f` | `_252e_252e_252f` | Blocked |
| Null byte | `valid%00../secret` | `valid__secret` | Blocked |
| Unicode normalization | `\u002e\u002e/` | `___` | Blocked |

### Why Current Regex Appears Sufficient

The regex `[^a-zA-Z0-9-_]` is a **whitelist approach** that only allows:
- Letters (a-z, A-Z)
- Numbers (0-9)
- Hyphen (-)
- Underscore (_)

All other characters, including `.`, `/`, `\`, null bytes, and special Unicode, are replaced with `_`.

### Why Defense-in-Depth is Still Required

1. **Edge Cases**: Unusual unicode normalization or encoding issues in Node.js could potentially bypass regex
2. **Maintenance Risk**: Future code changes might weaken the sanitization
3. **Symlink Attacks**: If `logs/` directory contains symlinks, the sanitized path could still escape
4. **Security Best Practice**: OWASP recommends explicit path containment verification as a final check
5. **Minimal Cost**: Adding path validation is low effort with high security value

## 3. What a Proper Test Should Verify

### Unit Tests for `getLogFilePath`

1. **Valid Phase IDs**:
   - Normal phase: `"development > step-0 > context"` → `"development-step-0-context.log"`
   - Simple phase: `"prepare"` → `"prepare.log"`

2. **Traversal Attempts** (should be sanitized, path must stay in logs dir):
   - `"../../../etc/passwd"` → path within `logs/` directory
   - `"%2e%2e%2fetc%2fpasswd"` (already decoded by URL handler)
   - `"....//....//etc"` → sanitized, contained
   - `"valid/../../../secret"` → sanitized, contained

3. **Boundary Cases**:
   - Empty string: should produce valid path in logs/
   - Very long string: should handle gracefully
   - Unicode characters: should be sanitized
   - Null bytes embedded: should be sanitized

4. **Path Containment Verification** (the fix):
   - After constructing path, verify `path.resolve(result)` starts with `path.resolve(logsDir) + path.sep`
   - If verification fails, throw an error

### Integration Tests

1. **HTTP API Tests**:
   - `GET /api/logs/development-step-0-context` → 200 or 404 (valid)
   - `GET /api/logs/..%2F..%2Fetc%2Fpasswd` → Error (blocked)
   - `GET /api/logs/download/valid-phase` → 200 or 404 (valid)

2. **Error Response Verification**:
   - Traversal attempts should return appropriate error (400 or 403)
   - Error message should not leak sensitive path information

## 4. Recommended Fix

```typescript
private getLogFilePath(phaseId: string): string {
  // Convert phase ID to log filename format
  const sanitized = phaseId.replace(/ > /g, '-').replace(/[^a-zA-Z0-9-_]/g, '_');
  const logPath = path.join(this.config.sprintDir, 'logs', `${sanitized}.log`);

  // Defense-in-depth: verify path is contained within logs directory
  const resolved = path.resolve(logPath);
  const logsDir = path.resolve(this.config.sprintDir, 'logs');
  if (!resolved.startsWith(logsDir + path.sep)) {
    throw new Error('Invalid log path');
  }

  return logPath;
}
```

## 5. Test File Location

Tests should be added to:
- `compiler/src/status-server/server.test.ts` (if exists)
- Or create new: `compiler/src/status-server/path-security.test.ts`

The test should:
1. Mock the config with a known `sprintDir`
2. Call `getLogFilePath` with various malicious inputs
3. Verify returned path is always within the logs directory
4. Verify an error is thrown when path containment fails (after fix is applied)
