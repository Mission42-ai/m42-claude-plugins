# Step Context: step-5

## Task
Implement operator request system for discovered issues.

## Overview
Claude can submit requests to the operator when it discovers issues during execution.
All requests go to the operator queue - no auto-handling modes. The operator (a
dedicated Claude instance) reviews requests, makes decisions with reasoning, and
uses dynamic step injection to add work to the sprint.

## Implementation Plan
Based on gherkin scenarios, implement in this order:

1. **Runtime Types** (`types.ts`) - Add OperatorRequest, QueuedRequest, OperatorDecision types
2. **Claude Runner Parsing** (`claude-runner.ts`) - Parse operatorRequests from JSON results
3. **Backlog Module** (`backlog.ts`) - Implement BACKLOG.yaml read/write operations
4. **Operator Module** (`operator.ts`) - Implement operator request processing and decision execution
5. **Loop Integration** (`loop.ts`) - Queue requests, trigger operator for critical priority
6. **Sprint Operator Skill** (`skills/sprint-operator/skill.md`) - Default operator prompt

## Related Code Patterns

### Pattern from: runtime/src/yaml-ops.ts
```typescript
// Atomic YAML operations with backup and checksum
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export function readYamlFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content) as T;
}

export function writeYamlFileAtomic(filePath: string, data: unknown): void {
  // Create backup, write temp, rename atomic, cleanup
  const content = yaml.dump(data, { lineWidth: -1 });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}
```

### Pattern from: runtime/src/loop.ts
```typescript
// Mock dependencies injection for testing
interface LoopDependencies {
  runClaude: (options: ClaudeRunOptions) => Promise<ClaudeResult>;
}

export async function runLoop(
  sprintDir: string,
  options: LoopOptions,
  deps?: LoopDependencies
): Promise<LoopResult>
```

### Pattern from: compiler/src/types.ts
```typescript
// InsertPosition type already exists
export type InsertPosition = 'after-current' | 'end-of-phase';

// StepQueueItem pattern for injected steps
export interface StepQueueItem {
  id: string;
  prompt: string;
  proposedBy: string;
  proposedAt: string;
  reasoning?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}
```

### Pattern from: runtime/src/claude-runner.ts
```typescript
// JSON extraction from Claude output
export function extractJson(output: string): unknown | undefined {
  const match = output.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}
```

## Required Imports

### Internal
- `yaml-ops.ts`: `readYamlFile`, `writeYamlFileAtomic` for PROGRESS.yaml and BACKLOG.yaml
- `transition.ts`: `SprintState`, `SprintEvent`, `CompiledProgress`, `CurrentPointer`
- `claude-runner.ts`: `runClaude`, `ClaudeRunOptions`, `ClaudeResult`
- `prompt-builder.ts`: `buildPrompt` (for operator context prompt generation)

### External
- `js-yaml`: YAML parsing and serialization (version ^4.1.0)
- `nanoid`: Generate unique IDs for requests (need to add or use existing pattern)
- `path`: File path operations
- `fs`: File system operations

## Types/Interfaces to Use

### From existing compiler/src/types.ts
```typescript
// Already defined - reuse
export type InsertPosition = 'after-current' | 'end-of-phase';
export type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';
export type PhaseStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped' | 'failed';

// Already partially defined in operator.ts stub
interface OperatorRequest {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'bug' | 'improvement' | 'refactor' | 'test' | 'docs' | 'security';
  context?: OperatorRequestContext;
}
```

### Types already stubbed in operator.ts
```typescript
// These exist as stubs - need implementation
export interface OperatorRequest { ... }
export interface QueuedRequest extends OperatorRequest { ... }
export interface OperatorDecision { ... }
export interface OperatorResponse { ... }
export interface OperatorConfig { ... }
export interface InjectionConfig { ... }
export interface InsertPosition { ... }
export interface BacklogEntryConfig { ... }
```

### Types already stubbed in backlog.ts
```typescript
// These exist as stubs - need implementation
export interface BacklogItem { ... }
export interface BacklogFile { ... }
export interface BacklogItemSource { ... }
```

## Integration Points

### Called by:
- `loop.ts`: Queue operator requests from Claude results, trigger operator processing
- `cli.ts`: Manual operator trigger (future)
- Status server: Dashboard display of operator queue (future)

### Calls:
- `yaml-ops.ts`: Read/write PROGRESS.yaml with operator-queue section
- `claude-runner.ts`: Run operator Claude instance with operator prompt
- `prompt-builder.ts`: Generate operator context prompts

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `runtime/src/types.ts` | Modify | Add/export operator types (or rely on operator.ts exports) |
| `runtime/src/claude-runner.ts` | Modify | Parse `operatorRequests` from JSON result, update `SPRINT_RESULT_SCHEMA` |
| `runtime/src/backlog.ts` | Implement | Replace stubs with actual BACKLOG.yaml operations |
| `runtime/src/operator.ts` | Implement | Replace stubs with operator processing logic |
| `runtime/src/loop.ts` | Modify | Add queue management, trigger operator for critical |
| `plugins/m42-sprint/skills/sprint-operator/skill.md` | Create | Default operator prompt |

## Test File Analysis

### runtime/src/claude-runner.test.ts
- Already has tests for `extractJson` parsing `operatorRequests`
- Tests verify nested request structure, multiple requests, empty arrays
- Tests verify backward compatibility (results without operatorRequests)

### runtime/src/operator.test.ts
- Tests for `processOperatorRequests`, `executeOperatorDecision`
- Tests all decision types: approve, reject, defer, backlog
- Tests operator prompt loading from skill
- Tests operator context creation
- Tests injection execution for approved requests

### runtime/src/backlog.test.ts
- Tests for `readBacklog`, `writeBacklog`, `addBacklogItem`, `updateBacklogItem`
- Tests BACKLOG.yaml creation if not exists
- Tests proper item structure validation
- Tests status updates for backlog items

### runtime/src/loop.test.ts
- Already has operator-related tests:
  - `runLoop should parse operatorRequests from Claude JSON result`
  - `runLoop should trigger operator for critical priority requests`
  - `runLoop should add discovered-in and created-at to queued requests`
  - `runLoop should handle empty operatorRequests array`
  - `runLoop should handle result without operatorRequests field`
  - `runLoop should accumulate requests across multiple phases`

## Key Implementation Details

### 1. Update SPRINT_RESULT_SCHEMA in claude-runner.ts
```typescript
// Add operatorRequests to the schema
export const SPRINT_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['completed', 'failed', 'needs-human'] },
    summary: { type: 'string' },
    error: { type: 'string' },
    humanNeeded: { type: 'object', properties: {...}, required: ['reason'] },
    operatorRequests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          type: { type: 'string', enum: ['bug', 'improvement', 'refactor', 'test', 'docs', 'security'] },
          context: { type: 'object' }
        },
        required: ['id', 'title', 'description', 'priority', 'type']
      }
    }
  },
  required: ['status', 'summary']
};
```

### 2. Operator Queue in PROGRESS.yaml Structure
```yaml
operator-queue:
  - id: req_abc123
    title: "Fix memory leak in parser"
    description: "Found a memory leak..."
    priority: high
    type: bug
    status: pending
    created-at: 2026-01-20T10:00:00Z
    discovered-in: development-step-2
    context:
      relatedFiles: ["src/parser.ts"]
```

### 3. BACKLOG.yaml Structure
```yaml
items:
  - id: req_abc123
    title: "Refactor authentication"
    description: "Current auth is basic..."
    category: tech-debt
    suggested-priority: medium
    operator-notes: "Valid but out of scope"
    source:
      request-id: req_abc123
      discovered-in: development-step-3
      discovered-at: 2026-01-20T10:00:00Z
    created-at: 2026-01-20T10:05:00Z
    status: pending-review
```

### 4. Operator Trigger Logic
```typescript
// In loop.ts after phase completion
if (result.jsonResult?.operatorRequests?.length > 0) {
  // Queue all requests
  queueOperatorRequests(sprintDir, result.jsonResult.operatorRequests, phaseId);

  // Check for critical - trigger immediate operator
  const hasCritical = result.jsonResult.operatorRequests.some(
    r => r.priority === 'critical'
  );

  if (hasCritical) {
    await triggerOperator(sprintDir, operatorConfig);
  }
}
```

### 5. Unique ID Generation
Use timestamp + random suffix pattern (similar to existing StepQueueItem):
```typescript
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}${random}`;
}
```

## Operator Skill Location

Create directory and skill file:
```
plugins/m42-sprint/skills/sprint-operator/
└── skill.md
```

The skill content is already specified in the step specification - provides decision guidelines for approve/reject/defer/backlog.

## Error Handling Patterns

Follow existing patterns from loop.ts:
- Wrap operator execution in try/catch
- Log errors but don't crash the sprint
- Mark failed requests appropriately
- Continue with sprint execution even if operator fails
