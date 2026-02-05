# Plan: Simple In-Iteration Learning Capture for Sprints

## Problem

Current learning extraction uses per-iteration hooks that analyze full transcripts asynchronously. This produces:
- Too many learnings (overkill)
- Lower quality learnings (context lost in transcript analysis)
- Delayed review (happens after the fact)

## Proposed Solution

Add an optional `learnings` array to the step result JSON that agents can populate during execution. These learnings are:
- Captured in real-time as part of structured output
- Simple format (title + insight)
- Appended to a sprint-specific backlog for post-sprint review

## Changes Required

### 1. Extend Step Result Schema

**File:** `plugins/m42-sprint/schemas/step-result.json`

Add optional `learnings` property:

```json
"learnings": {
  "type": "array",
  "description": "Simple learnings discovered during this step",
  "items": {
    "type": "object",
    "properties": {
      "title": { "type": "string", "description": "Short learning title" },
      "insight": { "type": "string", "description": "What was learned and why it matters" },
      "source": { "type": "string", "description": "File path for repo patterns, or 'workflow'/'skill:name' for workflow observations" }
    },
    "required": ["title", "insight", "source"]
  }
}
```

### 2. Update SPRINT_RESULT_SCHEMA

**File:** `plugins/m42-sprint/runtime/src/claude-runner.ts` (lines 71-105)

Add `learnings` to the schema object.

### 3. Update Loop to Persist Learnings

**File:** `plugins/m42-sprint/runtime/src/loop.ts`

After extracting JSON result (around line 1854-1859):
1. Extract `learnings` from result
2. Append to `{sprint-dir}/LEARNINGS.yaml`

New file format for `LEARNINGS.yaml`:
```yaml
version: 1
sprint-id: my-sprint
learnings:
  # Repository pattern (file source)
  - title: "Use node --check for CLI modules"
    insight: "CLI files execute on require(), use syntax check instead"
    source: "runtime/src/loop.ts"
    phase: "qa"
    step: "test-integration"
    captured-at: "2026-02-02T10:00:00Z"

  # Workflow observation
  - title: "TDD phase prompts could be more specific"
    insight: "Agents often miss edge cases in test generation"
    source: "workflow"
    phase: "development"
    step: "implement-feature"
    captured-at: "2026-02-02T10:05:00Z"
```

### 4. Add Persistence Function

**File:** `plugins/m42-sprint/runtime/src/yaml-ops.ts`

Add `appendLearning()` function:
```typescript
export async function appendLearning(
  learningsPath: string,
  learning: { title: string; insight: string },
  context: { phase: string; step?: string; sprintId: string }
): Promise<void>
```

### 5. Update Prompt Template (Optional)

**File:** `plugins/m42-sprint/runtime/src/prompt-builder.ts`

Add brief guidance in `result-reporting` section:
```
Optionally include learnings: {"learnings": [{"title": "...", "insight": "..."}]}
```

## Design Decision

**Two learning types with source tracking:**

1. **Repository patterns** - architecture, best practices, conventions
   - Source: file path (e.g., `src/utils/auth.ts`)
   - Target: project CLAUDE.md files

2. **Workflow observations** - improvements to skills, commands, workflows
   - Source: `workflow` or skill/command name
   - Target: plugin development, examined in dedicated run

**Minimal format with source:**
```json
{
  "title": "Short title",
  "insight": "What was learned",
  "source": "src/auth.ts" | "workflow" | "skill:creating-sprints"
}
```

- Low friction for agents
- Source enables categorization for review
- Observations can be examined more deeply later

## Files to Modify

| File | Change |
|------|--------|
| `schemas/step-result.json` | Add `learnings` property |
| `runtime/src/claude-runner.ts` | Update SPRINT_RESULT_SCHEMA |
| `runtime/src/yaml-ops.ts` | Add appendLearning() |
| `runtime/src/loop.ts` | Extract and persist learnings |
| `runtime/src/prompt-builder.ts` | Add learning guidance to prompt |

## Verification

1. Run a test sprint step that returns learnings in JSON output
2. Verify LEARNINGS.yaml is created/updated
3. Verify learnings include correct phase/step metadata
