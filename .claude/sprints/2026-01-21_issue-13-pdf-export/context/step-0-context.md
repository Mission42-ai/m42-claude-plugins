# Step Context: step-0

## Task
Step 1: Research and setup PDF generation infrastructure.

Tasks:
- Analyze existing sprint summary structure and data available
- Research PDF generation options (puppeteer, pdfkit, jspdf, etc.)
- Choose library that supports both text and chart/image embedding
- Add required dependencies to the plugin
- Create basic PDF generation utility module

Output: Working PDF generation setup with dependency installed.

## Implementation Plan
Based on gherkin scenarios, implement in this order:

1. **Install pdfkit dependency** (Scenario 1)
   - Add `pdfkit` to `plugins/m42-sprint/compiler/package.json` dependencies
   - Add `@types/pdfkit` to devDependencies for TypeScript support
   - Run `npm install` to fetch packages

2. **Create PDF module structure** (Scenario 2)
   - Create `plugins/m42-sprint/compiler/src/pdf/pdf-generator.ts`
   - Export `createPdfDocument` async function
   - Export `PdfOptions` interface
   - Export `SprintPdfData` type (wrapping CompiledProgress)

3. **Implement basic PDF generation** (Scenarios 3, 4)
   - Use PDFKit to create a document
   - Return a `Buffer` with valid PDF magic bytes (`%PDF-`)
   - Accept `CompiledProgress` data structure
   - Handle different sprint statuses gracefully

4. **Add text content embedding** (Scenario 5)
   - Render sprint-id and title
   - Render phase information with status
   - Handle nested steps structure
   - Include timing/stats information

5. **Ensure file system compatibility** (Scenario 6)
   - Buffer output is directly writable via `fs.writeFileSync`
   - PDF contains valid EOF marker (`%%EOF`)

## Related Code Patterns

### Pattern from: compiler/src/validate.test.ts
```typescript
// Simple test runner pattern (synchronous)
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error}`);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
```

### Pattern from: compiler/src/compile.ts (import structure)
```typescript
import * as fs from 'fs';
import * as path from 'path';
import type {
  CompiledProgress,
  CompiledTopPhase,
  SprintStats,
  // etc.
} from './types.js';
```

### Pattern from: compiler/tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```
Note: Use `.js` extension in imports (NodeNext resolution).

## Required Imports

### Internal
- `./types.js`: Import `CompiledProgress`, `CompiledTopPhase`, `CompiledStep`, `CompiledPhase`, `SprintStats`, `SprintStatus`

### External
- `pdfkit`: Default import for PDFKit class
- `stream`: For working with Buffer streams

## Types/Interfaces to Use

### From types.ts (key structures for PDF data)
```typescript
interface CompiledProgress {
  'sprint-id': string;
  status: SprintStatus;  // 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'paused' | 'needs-human' | 'interrupted'
  phases?: CompiledTopPhase[];
  current: CurrentPointer;
  stats: SprintStats;
  mode?: 'standard' | 'ralph';
  goal?: string;
}

interface SprintStats {
  'started-at': string | null;
  'completed-at'?: string | null;
  'total-phases': number;
  'completed-phases': number;
  'total-steps'?: number;
  'completed-steps'?: number;
  elapsed?: string;
}

interface CompiledTopPhase {
  id: string;
  status: PhaseStatus;
  prompt?: string;
  steps?: CompiledStep[];
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  summary?: string;
}

interface CompiledStep {
  id: string;
  prompt: string;
  status: PhaseStatus;
  phases: CompiledPhase[];
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
}

interface CompiledPhase {
  id: string;
  status: PhaseStatus;
  prompt: string;
  'started-at'?: string;
  'completed-at'?: string;
  elapsed?: string;
  summary?: string;
}
```

### New types to create (in pdf-generator.ts)
```typescript
/**
 * Options for PDF document generation
 */
export interface PdfOptions {
  /** Document title shown in header */
  title?: string;
  /** Whether to include visual charts (Phase 2 feature) */
  includeCharts?: boolean;
  /** Output page size */
  pageSize?: 'A4' | 'Letter';
  /** Custom margins in points */
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

/**
 * Sprint data wrapper for PDF generation
 * Extends CompiledProgress with any PDF-specific metadata
 */
export interface SprintPdfData extends CompiledProgress {
  /** Optional override for document title */
  documentTitle?: string;
}
```

## Integration Points

### Called by
- Future: CLI command `sprint-pdf` (Step 3)
- Future: Dashboard "Export PDF" button (Step 5)
- Future: Post-sprint summary generation hook

### Calls
- PDFKit library for document creation
- Types from `../types.js` for data structures

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `plugins/m42-sprint/compiler/package.json` | Modify | Add pdfkit dependency |
| `plugins/m42-sprint/compiler/src/pdf/pdf-generator.ts` | Create | Main PDF generation module |
| (test file already exists) | - | `pdf-generator.test.ts` is pre-written |

## PDFKit Usage Pattern

```typescript
import PDFDocument from 'pdfkit';

export async function createPdfDocument(
  progress: CompiledProgress,
  options: PdfOptions = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: options.pageSize || 'A4',
      margin: 50,
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Add content
    doc.fontSize(20).text(options.title || 'Sprint Summary', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Sprint ID: ${progress['sprint-id']}`);
    // ... more content

    doc.end();
  });
}
```

## Error Handling Pattern

Follow existing codebase pattern - throw errors for invalid input:
```typescript
if (!progress || !progress['sprint-id']) {
  throw new Error('Invalid progress data: missing sprint-id');
}
```

## Verification Commands

After implementation, run these to verify:

```bash
# Scenario 1: Check dependency installed
grep -q '"pdfkit"' plugins/m42-sprint/compiler/package.json && echo "PASS" || echo "FAIL"

# Scenario 2-6: Run tests
cd plugins/m42-sprint/compiler && npm run build && node dist/pdf/pdf-generator.test.js
```

## Library Decision Rationale

**Selected: PDFKit**

| Library | Pros | Cons |
|---------|------|------|
| **PDFKit** ✓ | Pure Node.js, no Chromium, precise layout control, image/vector support | Lower-level API |
| Puppeteer | HTML-to-PDF, familiar web styling | Large Chromium dependency, heavyweight |
| jsPDF | Browser-compatible | Primarily browser-focused, less Node.js integration |
| pdf-lib | Editing existing PDFs | Less suited for document creation from scratch |

PDFKit is the best fit because:
1. No external binary dependencies (unlike Puppeteer's Chromium)
2. Direct programmatic control over layout
3. Built-in support for images (charts in Step 2)
4. Well-documented, stable API
5. Used in production by many Node.js projects
