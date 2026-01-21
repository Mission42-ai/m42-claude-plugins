# Step Context: step-5

## Task
Step 5: Documentation and final polish.

Tasks:
- Add documentation for PDF export feature
- Update README or relevant docs
- Add usage examples
- Test end-to-end workflow
- Close GitHub Issue #13 with summary of implementation

Output: Feature complete with documentation, issue closed.

## Implementation Plan
Based on documentation test requirements (docs.test.ts), implement in this order:

1. **Update README.md** - Add PDF export to Commands table and feature mention
2. **Update docs/reference/commands.md** - Add full /export-pdf command section
3. **Run documentation tests** - Verify all tests pass (currently 8 failing)
4. **End-to-end workflow test** - Export actual PDF from a sprint
5. **Close GitHub Issue #13** - With implementation summary

## Related Code Patterns

### Pattern from: docs/reference/commands.md (command documentation format)
```markdown
### /command-name

Description of the command.

**Usage:**
\`\`\`bash
/command-name <required-arg> [optional-arg]
\`\`\`

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `<arg>` | Yes | Description |

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--flag` | - | Description |

**Examples:**
\`\`\`bash
# Example with description
/command-name arg --flag
\`\`\`

**Output:**
\`\`\`
Expected output...
\`\`\`
```

### Pattern from: README.md (commands table)
```markdown
| Command | Description |
|---------|-------------|
| `/start-sprint <name> [--ralph\|--workflow <name>]` | Initialize new sprint |
...
```

## Required Imports
No imports needed - documentation only.

## Types/Interfaces to Document
```typescript
// From export-pdf-cli.ts
export interface ExportPdfOptions {
  includeCharts: boolean;
  outputPath?: string;
}

// CLI flags:
// -c, --charts  Include visual progress charts
// -o, --output  Custom output path
// -h, --help    Display help message
// --version     Display version number
```

## Integration Points
- CLI: `node dist/pdf/export-pdf-cli.js <sprint-path> [options]`
- Output: `<sprint-path>/artifacts/<sprint-id>.pdf`

## Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| `plugins/m42-sprint/README.md` | Modify | Add /export-pdf to Commands table, mention feature |
| `plugins/m42-sprint/docs/reference/commands.md` | Modify | Add full /export-pdf command documentation |

## Documentation Tests (from docs.test.ts)
Tests currently failing that must pass:

1. `README.md mentions PDF export feature` - Must contain "pdf" (case insensitive)
2. `README.md includes export-pdf in commands table` - Must reference "export-pdf"
3. `commands.md contains /export-pdf section` - Must document "export-pdf"
4. `commands.md documents sprint-path argument for export-pdf` - Must mention sprint-path
5. `commands.md documents --output option` - Must mention "--output" or "-o"
6. `commands.md includes basic export-pdf usage example` - Must show example with sprint path
7. `commands.md includes example with --charts flag` - Must show example with --charts
8. `commands.md includes example with --output option` - Must show example with --output

## GitHub Issue #13
- **Title**: Feature Request: PDF Export Sprint Summary
- **Body**: "Ich möchte gerne für einen Sprint Summary ein PDF exportieren können."
- **Translation**: "I would like to be able to export a PDF for a sprint summary."
- **State**: OPEN
- **URL**: https://github.com/Mission42-ai/m42-claude-plugins/issues/13

## Commit
```bash
git add context/step-5-context.md
git commit -m "context(step-5): gather implementation context"
```
