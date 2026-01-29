---
title: Validation Output Format Reference
description: Structure and formatting guidelines for workflow validation results
keywords: validation, output format, error display, workflow errors
file-type: reference
skill: validating-workflows
---

# Validation Output Format Reference

## Compiler JSON Structure

```json
{
  "valid": true|false,
  "errors": [{"code": "ERROR_CODE", "message": "...", "path": "workflow.field", "details": {}}],
  "warnings": [{"code": "WARNING_CODE", "message": "...", "path": "workflow.field"}]
}
```

## Display Format Patterns

| Result Type | Format | Example |
|-------------|--------|---------|
| **Success (no issues)** | Header + checks + PASS | `Validating: workflow.yaml`<br>`✓ Schema structure valid`<br>`✓ All phase IDs unique`<br>`Validation: PASS` |
| **Success (warnings)** | Header + checks + warnings + PASS(N) | `Validating: workflow.yaml`<br>`✓ Schema structure valid`<br>`⚠ Schema version 1.0 (current: 2.0)`<br>`Validation: PASS (1 warning)` |
| **Failure** | Header + errors + warnings + FAIL(N,M) | `Validating: workflow.yaml`<br>`✗ Missing required field 'name'`<br>`  at: workflow.name`<br>`Validation: FAIL (1 error)` |

## Formatting Rules

| Element | Symbol | Format | Notes |
|---------|--------|--------|-------|
| Passed check | `✓` | Single line | Show successful validations |
| Error | `✗` | Message + indented path | Blocks validation |
| Warning | `⚠` | Message + indented path | Informational only |
| Path | `at:` | Indented 2 spaces | Only when present in JSON |
| Summary PASS | `Validation: PASS` | Last line | Add `(N warnings)` if warnings exist |
| Summary FAIL | `Validation: FAIL` | Last line | Format: `(N errors)` or `(N errors, M warnings)` |

## Priority & Ordering

1. Display all errors first (severity order)
2. Display warnings second
3. End with summary line
4. Exit code: 0 (PASS), 1 (FAIL)

## Example Transformations

**JSON Input:**
```json
{"valid": false, "errors": [{"code": "MISSING_WORKFLOW_NAME", "message": "Workflow must have a name", "path": "workflow.name"}], "warnings": []}
```

**Formatted Output:**
```text
Validating: my-workflow.yaml

✗ Workflow must have a name
  at: workflow.name

Validation: FAIL (1 error)
```
