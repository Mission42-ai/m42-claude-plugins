---
allowed-tools: Bash(node:*), Bash(ls:*), Read(*)
argument-hint: <sprint-path> [--charts]
description: Export sprint progress to PDF
---

# Export PDF Command

Export a sprint's progress to a professional PDF document with optional visual charts.

## Preflight Checks

Find the sprint directory:
!`ls -d "$ARGUMENTS" 2>/dev/null || ls -dt .claude/sprints/*/ 2>/dev/null | head -1 || echo "NO_SPRINT"`

## Context

From the preflight output, identify the sprint directory path.

Then verify:
- Sprint directory exists
- PROGRESS.yaml exists in the sprint directory

Use the Read tool to read the PROGRESS.yaml file to understand sprint status.

## Arguments

Parse `$ARGUMENTS`:
- **Sprint path**: First positional argument (required if not defaulting to most recent)
- **--charts / -c**: Include visual progress charts in PDF
- **--output / -o <path>**: Custom output path (default: artifacts/<sprint-id>.pdf)

## Task Instructions

### Step 1: Validate Sprint Directory

1. Check that sprint directory exists
2. Verify PROGRESS.yaml is present
3. If missing, report error: "No PROGRESS.yaml found. Run /run-sprint to compile first."

### Step 2: Generate PDF

Use the PDF generator from the compiler module:

```bash
node plugins/m42-sprint/compiler/dist/pdf/export-pdf-cli.js <sprint-path> [options]
```

Options:
- `--charts` or `-c`: Include progress pie chart and bar chart
- `--output <path>` or `-o <path>`: Custom output path

### Step 3: Report Results

On success, display:
```
PDF exported successfully!

Output: <full-path-to-pdf>
```

On failure, display the error message from the CLI.

## Examples

Export most recent sprint:
```
/export-pdf
```

Export specific sprint:
```
/export-pdf .claude/sprints/2026-01-21_feature-auth/
```

Export with charts:
```
/export-pdf .claude/sprints/2026-01-21_feature-auth/ --charts
```

Export to custom path:
```
/export-pdf .claude/sprints/2026-01-21_feature-auth/ -o ./reports/auth-sprint.pdf
```

## Error Handling

| Error | Message |
|-------|---------|
| No sprint directory | "No sprint found. Provide a path or create one with /init-sprint" |
| Missing PROGRESS.yaml | "PROGRESS.yaml not found. Run /run-sprint to compile the sprint first." |
| Invalid path | "Sprint directory not found: <path>" |
| PDF generation failure | Show error from PDF generator |

## Success Criteria

- PDF file created in artifacts/ directory (or custom path)
- PDF contains sprint metadata, phases, and status
- PDF is readable and well-formatted
- Success message displays output path
