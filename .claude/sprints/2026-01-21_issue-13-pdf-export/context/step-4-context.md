# Step Context: step-4

## Task
Step 4: Create command/skill for PDF export.

Tasks:
- Add new command or extend existing command with --pdf flag
- Command should accept sprint path as argument
- Output PDF to sprint's artifacts/ directory
- Add proper error handling and user feedback
- Ensure command works from CLI

Output: Working /export-pdf command or --pdf flag on existing command.

## Implementation Plan
Based on gherkin scenarios, implement in this order:

1. **Create export-pdf-cli.ts CLI module** with:
   - `parseExportArgs()` function for argument parsing
   - `runExportCommand()` function for PDF generation orchestration
   - CLI entry point with Commander.js

2. **Implement argument parsing** (Scenarios 1, 6, 8):
   - Sprint path argument (positional)
   - `--charts / -c` flag for visual charts
   - `--output / -o <path>` for custom output
   - `--help / -h` for usage information
   - `--version` for version display

3. **Implement error handling** (Scenarios 3, 4):
   - Directory not found errors
   - Missing PROGRESS.yaml errors
   - Return proper exit codes (0 success, 1 failure)

4. **Implement output handling** (Scenarios 2, 5, 7):
   - Default output to `<sprint>/artifacts/<sprint-id>.pdf`
   - Create artifacts directory if missing
   - Include sprint-id in filename
   - Display success message with full output path

5. **Integrate with existing pdf-generator.ts** (Scenario 6):
   - Use `createPdfDocument()` with `includeCharts` option
   - Verify PDF is larger when charts included

## Related Code Patterns

### Pattern from: compiler/src/index.ts (CLI structure with Commander.js)
```typescript
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const program = new Command();

program
  .name('sprint-compile')
  .description('Compile sprint workflow definitions into PROGRESS.yaml')
  .version('1.0.0');

program
  .argument('<sprint-dir>', 'Path to the sprint directory containing SPRINT.yaml')
  .option('-w, --workflows <dir>', 'Path to workflows directory', '.claude/workflows')
  .option('-o, --output <file>', 'Output file path')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (sprintDir: string, options: {...}) => {
    // Validate paths
    if (!fs.existsSync(absoluteSprintDir)) {
      console.error(`Error: Sprint directory not found: ${absoluteSprintDir}`);
      process.exit(1);
    }
    // Process...
  });

program.parse();
```

### Pattern from: pdf-generator.ts (PDF generation)
```typescript
export async function createPdfDocument(
  progress: CompiledProgress,
  options: PdfOptions = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: options.pageSize || 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    // Render content...
    doc.end();
  });
}
```

### Pattern from: export-pdf-cli.test.ts (Expected API)
```typescript
// Functions to implement:
import {
  parseExportArgs,
  runExportCommand,
  ExportPdfOptions,
  ExportPdfResult,
  CLI_VERSION as EXPORT_CLI_VERSION,
} from './export-pdf-cli.js';

// parseExportArgs signature:
interface ParseResult {
  sprintPath: string;
  options: ExportPdfOptions;
  showHelp?: boolean;
  showVersion?: boolean;
  error?: string;
}

// runExportCommand signature:
interface ExportPdfResult {
  success: boolean;
  outputPath?: string;
  message?: string;
  error?: string;
  exitCode: number;
}
```

## Required Imports

### Internal
- `../types.js`: `CompiledProgress` type for YAML parsing
- `./pdf-generator.js`: `createPdfDocument`, `PdfOptions` for PDF generation

### External
- `commander`: `Command` for CLI parsing
- `fs`: File system operations
- `path`: Path manipulation
- `js-yaml`: YAML parsing (`yaml.load`)

## Types/Interfaces to Use

```typescript
// From pdf-generator.ts
export interface PdfOptions {
  title?: string;
  includeCharts?: boolean;
  pageSize?: 'A4' | 'Letter';
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
}

// New types for export-pdf-cli.ts
export interface ExportPdfOptions {
  includeCharts: boolean;
  outputPath?: string;
}

export interface ParsedArgs {
  sprintPath?: string;
  options: ExportPdfOptions;
  showHelp?: boolean;
  showVersion?: boolean;
  error?: string;
}

export interface ExportPdfResult {
  success: boolean;
  outputPath?: string;
  message?: string;
  error?: string;
  exitCode: number;
}

// From types.ts
export interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;
  phases?: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  // ... other fields
}
```

## Integration Points

- **Called by**:
  - `/export-pdf` command (plugins/m42-sprint/commands/export-pdf.md)
  - Direct CLI invocation: `node dist/pdf/export-pdf-cli.js <sprint-path>`

- **Calls**:
  - `createPdfDocument()` from `./pdf-generator.js`
  - `yaml.load()` from `js-yaml` for PROGRESS.yaml parsing

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `compiler/src/pdf/export-pdf-cli.ts` | Create | CLI module for PDF export command |
| `compiler/package.json` | Modify | Add bin entry for `export-pdf` CLI |

## Test Verification Commands

From the gherkin scenarios, these verification commands should pass after implementation:

```bash
# Scenario 1: Accepts sprint path
node dist/pdf/export-pdf-cli.js .claude/sprints/*/ --help 2>&1 | grep -v "Missing"

# Scenario 2: Outputs to artifacts
ls .claude/sprints/*/artifacts/*.pdf 2>/dev/null

# Scenario 3: Error for missing PROGRESS.yaml
node dist/pdf/export-pdf-cli.js /tmp/empty-sprint 2>&1 | grep -i "progress"

# Scenario 4: Error for invalid path
node dist/pdf/export-pdf-cli.js /nonexistent/path 2>&1; test $? -ne 0

# Scenario 5: Creates artifacts directory
test -d .claude/sprints/*/artifacts

# Scenario 6: Charts flag in help
node dist/pdf/export-pdf-cli.js --help 2>&1 | grep -i "chart"

# Scenario 7: Success message with path
node dist/pdf/export-pdf-cli.js .claude/sprints/*/ 2>&1 | grep -E "(Created|Generated|Output|\.pdf)"

# Scenario 8: Help output
node dist/pdf/export-pdf-cli.js --help 2>&1 | grep -E "(Usage|sprint|path)"
```

## Error Messages to Implement

| Condition | Error Message |
|-----------|---------------|
| Missing sprint path | "Error: Sprint path is required" |
| Directory not found | "Error: Sprint directory not found: <path>" |
| Missing PROGRESS.yaml | "Error: PROGRESS.yaml not found. Run /run-sprint to compile the sprint first." |
| PDF generation failure | Pass through underlying error |

## Success Output Format

```
PDF exported successfully!

Output: <full-path-to-pdf>
Sprint: <sprint-id>
Status: <sprint-status>
Phases: <completed>/<total> (<percentage>%)
```
