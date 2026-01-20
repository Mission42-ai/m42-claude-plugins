# Bug Analysis: BUG-003 + BUG-013 - CLI Numeric Parameter Validation

## Summary

Two related bugs in the CLI argument parsing where numeric parameters lack proper validation:

- **BUG-003**: `--max-iterations` accepts non-numeric values, resulting in NaN
- **BUG-013**: `--delay` accepts negative values

## Root Cause Location

**File**: `runtime/src/cli.ts`
**Function**: `parseArgs()`
**Lines**: 100-109

## Detailed Analysis

### BUG-003: Non-numeric values for `--max-iterations`

**Location**: Lines 100-104

```typescript
if (arg === '--max-iterations' || arg === '-n') {
  const value = cliArgs[++i];
  if (value !== undefined) {
    result.options.maxIterations = parseInt(value, 10);
    // No NaN check - "abc" parses to NaN
  }
}
```

**Trigger Conditions**:
1. User passes `--max-iterations abc` or `-n foo`
2. `parseInt("abc", 10)` returns `NaN`
3. `NaN` is assigned to `maxIterations`
4. Downstream code using this value may behave unexpectedly

**Edge Cases**:
- `--max-iterations abc` → NaN
- `--max-iterations 10abc` → 10 (parseInt stops at first non-digit, partial parse)
- `--max-iterations ""` → NaN (empty string after flag)
- `-n` at end of args → value is undefined, maxIterations stays at default 0

### BUG-013: Negative values for `--delay`

**Location**: Lines 105-109

```typescript
} else if (arg === '--delay' || arg === '-d') {
  const value = cliArgs[++i];
  if (value !== undefined) {
    result.options.delay = parseInt(value, 10);
    // No validation - negative values accepted
  }
}
```

**Trigger Conditions**:
1. User passes `--delay -100` or `-d -5000`
2. `parseInt("-100", 10)` returns `-100`
3. Negative delay is passed to the loop
4. `setTimeout` with negative delay behaves as setTimeout with 0ms delay (immediate)

**Note**: While JavaScript's `setTimeout` clamps negative values to 0, accepting negative values is semantically incorrect and could cause issues in future refactoring.

## What Tests Should Verify

### For BUG-003 (NaN validation):

1. **Detection**: `parseArgs` should set `error` field when `--max-iterations` value is not a valid number
2. **Rejection cases**:
   - `--max-iterations abc` → should return error
   - `--max-iterations 10abc` → could be considered invalid (strict) or valid (lenient parseInt behavior)
   - `-n` at end of args without value → should return error
3. **Acceptance**: Valid integers like `10`, `0`, `100` should still work

### For BUG-013 (Negative validation):

1. **Detection**: `parseArgs` should set `error` field when `--delay` is negative
2. **Rejection cases**:
   - `--delay -100` → should return error
   - `--delay -1` → should return error
3. **Edge cases**:
   - `--delay 0` → should be valid (0ms delay is valid)
   - `--delay 1000` → should work normally
4. **Combined with NaN**: `--delay abc` → should return error (NaN case)

### For `--max-iterations` specifically:

- Negative values might be considered valid (interpreted as "no limit") or invalid depending on design
- The fix description says "non-negative" which includes 0, so negative should be rejected

## Test Structure

```typescript
describe('parseArgs numeric validation', () => {
  describe('--max-iterations', () => {
    it('should reject non-numeric values', () => {
      const result = parseArgs(['node', 'cli.js', 'run', '.', '--max-iterations', 'abc']);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('max-iterations');
    });

    it('should reject negative values', () => {
      const result = parseArgs(['node', 'cli.js', 'run', '.', '-n', '-5']);
      expect(result.error).toBeDefined();
    });

    it('should accept zero', () => {
      const result = parseArgs(['node', 'cli.js', 'run', '.', '--max-iterations', '0']);
      expect(result.error).toBeUndefined();
      expect(result.options.maxIterations).toBe(0);
    });

    it('should accept positive integers', () => {
      const result = parseArgs(['node', 'cli.js', 'run', '.', '-n', '10']);
      expect(result.error).toBeUndefined();
      expect(result.options.maxIterations).toBe(10);
    });
  });

  describe('--delay', () => {
    it('should reject non-numeric values', () => {
      const result = parseArgs(['node', 'cli.js', 'run', '.', '--delay', 'fast']);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('delay');
    });

    it('should reject negative values', () => {
      const result = parseArgs(['node', 'cli.js', 'run', '.', '-d', '-1000']);
      expect(result.error).toBeDefined();
    });

    it('should accept zero', () => {
      const result = parseArgs(['node', 'cli.js', 'run', '.', '--delay', '0']);
      expect(result.error).toBeUndefined();
      expect(result.options.delay).toBe(0);
    });

    it('should accept positive values', () => {
      const result = parseArgs(['node', 'cli.js', 'run', '.', '-d', '5000']);
      expect(result.error).toBeUndefined();
      expect(result.options.delay).toBe(5000);
    });
  });
});
```

## Proposed Fix

Add a validation helper function and use it for both numeric parameters:

```typescript
function parsePositiveInt(value: string, paramName: string): number | string {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return `Invalid number for ${paramName}: ${value}`;
  }
  if (parsed < 0) {
    return `${paramName} must be non-negative`;
  }
  return parsed;
}
```

Then update the parsing logic:

```typescript
if (arg === '--max-iterations' || arg === '-n') {
  const value = cliArgs[++i];
  if (value !== undefined) {
    const parsed = parsePositiveInt(value, 'max-iterations');
    if (typeof parsed === 'string') {
      result.error = parsed;
      return result;
    }
    result.options.maxIterations = parsed;
  }
}
```

## Impact Assessment

- **Severity**: Low - invalid arguments are uncommon in normal usage
- **User Impact**: Better error messages instead of silent failures or unexpected behavior
- **Breaking Changes**: None - previously invalid inputs now correctly report errors
