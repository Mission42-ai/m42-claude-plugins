# Sprint Context: Flexible For-Each Collections

## Project Info

| Property | Value |
|----------|-------|
| Test framework | Custom test runner (no vitest/jest) |
| Test location | `plugins/m42-sprint/compiler/src/*.test.ts` |
| Build command | `cd plugins/m42-sprint/compiler && npm run build` |
| Test command | `cd plugins/m42-sprint/compiler && npm test` |
| TypeScript | v5.3.0+, target ES2022, NodeNext modules |

## Key Patterns

### Error Handling
```typescript
export interface CompilerError {
  code: string;           // SCREAMING_SNAKE_CASE error code
  message: string;        // Human-readable message
  path?: string;          // YAML path for context
  details?: Record<string, unknown>;
}
```

### Validation Pattern
- Functions return `CompilerError[]`
- Multiple validation passes with error accumulation
- Error codes: `INVALID_*`, `MISSING_*`, `EMPTY_*`, `*_WARNING`

### Type Definitions (types.ts)
- `SprintDefinition`: SPRINT.yaml input format
- `WorkflowDefinition`: Workflow YAML format
- `CompiledProgress`: Runtime output format
- Discriminated unions for state machine types

### Test Pattern
```typescript
function test(name: string, fn: () => void | Promise<void>): void
function assert(condition: boolean, message: string): void
// Test names include error codes: 'EMPTY_WORKFLOW: should fail when...'
```

## Sprint Steps Overview

### Step 1: Core Implementation
**Goal**: Implement flexible for-each collections

**Files to modify**:
1. `plugins/m42-sprint/compiler/src/types.ts`
   - `SprintStep` → `CollectionItem` rename
   - `SprintDefinition.collections` (required, replaces `steps`)
   - `WorkflowPhase['for-each']` as string (not literal)
   - `TemplateContext.item` (generic accessor)

2. `plugins/m42-sprint/compiler/src/validate.ts`
   - Remove `steps` validation
   - Add `collections` validation (required, non-empty)
   - `validateCollectionItem()` function
   - `validateCollectionReferences()` cross-reference validation
   - `resolveCollectionName()` for exact match lookup

3. `plugins/m42-sprint/compiler/src/compile.ts`
   - `getCollectionItems()` helper
   - Update phase loop for collections
   - Update `validateStandardModeSprint()`

4. `plugins/m42-sprint/compiler/src/expand-foreach.ts`
   - `substituteTemplateVars()` - support `{{item.*}}` and `{{<type>.*}}`
   - `expandForEach()` - add `itemType` parameter
   - `expandStep()` → `expandItem()` rename

5. `plugins/m42-sprint/compiler/src/*.test.ts`
   - Update all tests from `steps:` to `collections: { step: [...] }`
   - Add tests for multiple collections, exact match, custom properties

**Verification**:
```bash
cd plugins/m42-sprint/compiler && npm run build
cd plugins/m42-sprint/compiler && npm test
```

### Step 2: Command Rename
**Goal**: Rename `start-sprint` command to `init-sprint`

**Files to modify**:
- `plugins/m42-sprint/commands/start-sprint.md` → `init-sprint.md`
- All references in skills, docs, README

**Verification**:
```bash
grep -r "start-sprint" plugins/m42-sprint/  # Should return no results
```

### Step 3: Template Migration
**Goal**: Update all templates to new collections syntax

**Files to modify**:
1. Workflow Templates (`.claude/workflows/`):
   - `{{step.*}}` → `{{item.*}}`

2. Plugin Templates (`plugins/m42-sprint/templates/`):
   - `minimal-workflow.yaml`
   - `gherkin-step-workflow.yaml`
   - `orchestrated-workflow.yaml`

3. Skill Documentation:
   - `creating-sprints.md`
   - `creating-workflows.md`
   - `orchestrating-sprints.md`

**Verification**:
- All workflow templates compile without errors
- Existing sprints show migration hints

## Breaking Changes

| Before | After |
|--------|-------|
| `steps: [...]` | `collections: { step: [...] }` |
| `{{step.prompt}}` | `{{item.prompt}}` or `{{step.prompt}}` (with `for-each: step`) |
| `for-each: step` (literal) | `for-each: <collection-name>` (any string) |

## Template Variable Reference

| Variable | Description |
|----------|-------------|
| `{{item.prompt}}` | Generic accessor (always available) |
| `{{item.id}}` | Generic item ID |
| `{{item.index}}` | Index in collection |
| `{{<type>.prompt}}` | Type-specific (e.g., `{{feature.prompt}}`) |
| `{{<type>.*}}` | Custom properties by type name |

## Collection Schema

```yaml
# SPRINT.yaml
workflow: mixed-workflow

collections:
  feature:                     # Exact match with for-each
    - prompt: "Feature A"
      priority: high           # Custom property
  bug:
    - prompt: "Bug fix"
      severity: critical       # Custom property
  step:
    - prompt: "Generic task"

# Workflow
phases:
  - id: feature-dev
    for-each: feature          # → collections.feature
    workflow: feature-workflow
```
