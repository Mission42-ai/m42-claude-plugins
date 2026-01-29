---
name: validating-workflows
description: Validates sprint workflow YAML files and displays formatted results. This skill should be used when users request workflow validation, when Claude detects potential workflow issues before sprint execution, or when troubleshooting workflow errors. Triggers on "validate workflow", "check workflow", "workflow validation", "is this workflow valid", or "workflow errors".
---

# Validating Workflows

## Overview

To validate a sprint workflow file using the compiler's validation system and display results in a user-friendly format. This skill provides immediate feedback on workflow structure, schema compliance, phase configurations, and potential issues.

## When to Use This Skill

Use this skill when:

1. **User explicitly requests validation**: "validate this workflow", "check workflow syntax", "is my workflow valid"
2. **Before starting sprints**: Proactively validate workflow files before compilation
3. **During workflow development**: Help users fix errors as they create/edit workflows
4. **Troubleshooting workflow issues**: Investigate why a workflow won't compile
5. **Claude detects workflow problems**: Auto-trigger when workflow errors are suspected

## Validation Workflow

### Step 1: Identify the Workflow File

**If workflow path provided as argument:**
- Use the provided path directly
- Support both relative and absolute paths

**If no explicit path:**
- Check conversation context for workflow file references
- Look for recently mentioned workflow files
- If still unclear, ask user for the workflow path

**Path resolution:**
```bash
# Relative paths are resolved from current working directory
.claude/workflows/my-workflow.yaml

# Absolute paths work directly
/full/path/to/workflow.yaml
```

### Step 2: Run Compiler Validation

Execute the compiler's validation command:

```bash
node "plugins/m42-sprint/compiler/dist/index.js" validate "$WORKFLOW_PATH"
```

**Expected JSON output:**
```json
{
  "valid": true|false,
  "errors": [
    {
      "code": "ERROR_CODE",
      "message": "Description of the error",
      "path": "workflow.phases[0].id"
    }
  ],
  "warnings": [
    {
      "code": "WARNING_CODE",
      "message": "Description of the warning",
      "path": "workflow.field"
    }
  ]
}
```

**Error handling:**
- If command fails (exit code non-zero), parse stderr for error details
- If file not found, report helpful error with path attempted
- If JSON parsing fails, show raw compiler output

### Step 3: Format and Display Results

Transform the JSON output into user-friendly format following these patterns:

**Success (no issues):**
```text
Validating: my-workflow.yaml

✓ Schema structure valid
✓ All phase IDs unique
✓ Workflow references resolve

Validation: PASS
```

**Success (with warnings):**
```text
Validating: my-workflow.yaml

✓ Schema structure valid
✓ All phase IDs unique
✓ Workflow references resolve
⚠ Schema version 1.0 (current: 2.0) - consider updating
⚠ Phase 'deploy' missing description field

Validation: PASS (2 warnings)
```

**Failure (with errors):**
```text
Validating: my-workflow.yaml

✗ Missing required field 'name'
  at: workflow.name
✗ Phase 'dev' has both prompt and for-each (mutually exclusive)
  at: workflow.phases[2].id
⚠ Unresolved template variable {sprint-id}
  at: workflow.phases[0].prompt

Validation: FAIL (2 errors, 1 warning)
```

**Formatting rules:**
1. Start with "Validating: [filename]" header
2. Show success checks (✓) for aspects that passed
3. Show errors (✗) before warnings (⚠)
4. Indent path information with "at: [path]"
5. End with summary: "Validation: PASS/FAIL (counts)"

### Step 4: Provide Helpful Context

**For common errors:**
- Reference `references/common-workflow-errors.md` to provide explanations and fixes
- Show specific fix suggestions based on error code
- Example: "ERROR: MISSING_PHASE_ID → Add id: 'phase-name' to each phase"

**For errors without fixes:**
- Display the full error message from compiler
- Show the path to help user locate the issue
- Suggest checking workflow schema documentation

**For multiple errors:**
- Group related errors together when possible
- Prioritize structural errors before detail errors
- Suggest fixing errors in order presented

**Troubleshooting workflow file not found:**
- Check common workflow locations: `.claude/workflows/`, `plugins/m42-sprint/workflows/`
- Verify file extension is `.yaml` or `.yml`
- Try absolute path if relative path fails
- Use `ls .claude/workflows/` to list available workflows

**Troubleshooting validation vs compilation errors:**
- Validation errors: structural issues in workflow definition
- Compilation errors: issues when combining SPRINT.yaml + workflow
- If validation passes but compilation fails, check SPRINT.yaml configuration

## Command Structure

The validate command is a standalone operation:

```bash
# Basic validation
node plugins/m42-sprint/compiler/dist/index.js validate path/to/workflow.yaml

# The command:
# - Loads the workflow YAML file
# - Validates structure and schema
# - Checks for common issues
# - Outputs JSON result
# - Exits with code 0 (pass) or 1 (fail)
```

## Success Criteria

Validation is considered successful when:
- JSON output is properly parsed
- Results are formatted according to display rules
- Error/warning counts match JSON contents
- User receives actionable feedback
- Exit code correctly indicates pass/fail status

## Reference Materials

See `references/` directory for detailed information:

- **references/validation-output-format.md**: Complete format specification for display with symbols, priority rules, and example transformations
- **references/common-workflow-errors.md**: Catalog of error codes with fixes

## Example Invocations

**Explicit validation:**
```
User: "validate .claude/workflows/feature-standard.yaml"
→ Skill identifies path, runs validation, formats output
```

**Context-based:**
```
User: "is this workflow valid?" [after discussing feature-standard.yaml]
→ Skill infers workflow from context, validates, shows results
```

**Proactive check:**
```
User: "run sprint with workflow bugfix-workflow"
→ Claude: Detects workflow reference, invokes skill to validate before starting
```
