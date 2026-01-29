# Sprint Context: Workflow QA Improvements

## Project Info

| Key | Value |
|-----|-------|
| Test framework | Custom Node.js test runner (no vitest/jest) |
| Test file pattern | `*.test.ts` (compiled to `dist/*.test.js`) |
| Test location | Co-located with source: `plugins/*/compiler/src/*.test.ts`, `plugins/*/runtime/src/*.test.ts` |
| Build command | `npm run build` (per package: tsc) |
| Test command | `npm run test` (per package) |
| Lint command | `npm run lint` |
| Typecheck command | `npm run typecheck` (tsc --noEmit) |

## Key Packages

| Package | Location | Purpose |
|---------|----------|---------|
| @m42/sprint-compiler | `plugins/m42-sprint/compiler/` | SPRINT.yaml → PROGRESS.yaml compilation |
| @m42/sprint-runtime | `plugins/m42-sprint/runtime/` | Sprint execution loop (Ralph Loop) |
| @m42/sprint-e2e | `plugins/m42-sprint/e2e/` | End-to-end integration tests |

## Patterns to Follow

### Skill Structure
```
plugins/<plugin>/skills/<skill-name>/
├── SKILL.md              # Main skill doc with frontmatter
├── assets/               # Templates, examples
└── references/           # Detailed reference docs
```

**Frontmatter format:**
```yaml
name: skill-name
description: Triggers on keyword1, keyword2, phrase (max 1024 chars)
```

### Command Structure
```
plugins/<plugin>/commands/<command>.md
```

**Frontmatter format:**
```yaml
allowed-tools: [list of tools]
argument-hint: "command argument pattern"
description: "One-line description"
model: sonnet|opus|haiku
```

### Type Definitions
All types in `plugins/m42-sprint/compiler/src/types.ts`:
- `WorkflowDefinition` - Workflow YAML structure
- `PerIterationHook` - Hook configuration
- `HookTask` - Hook execution tracking
- `CompiledProgress` - Full PROGRESS.yaml structure

### Testing Pattern
Tests use Node.js built-in test runner with custom helpers:
```typescript
// plugins/m42-sprint/compiler/src/validate.test.ts pattern
import { validateWorkflow } from './validate.js';

const testCases = [
  { name: 'valid workflow', input: {...}, expected: {...} },
];

for (const tc of testCases) {
  const result = validateWorkflow(tc.input);
  assert.deepEqual(result, tc.expected, tc.name);
}
```

## Sprint Steps Overview

### Steps 1-2: QA/Testing Improvements

| Step | ID | Purpose | Output |
|------|------|---------|--------|
| 1 | creating-gherkin-scenarios | Skill for behavioral vs structural testing | `.claude/skills/creating-gherkin-scenarios/SKILL.md` |
| 2 | integration-test-workflow | Update plugin-development workflow | `.claude/workflows/plugin-development.yaml` |

**Dependencies**: Step 2 references concepts from Step 1.

### Step 3: Per-Iteration-Hooks Implementation

| Step | ID | Purpose | Output |
|------|------|---------|--------|
| 3 | per-iteration-hooks | Implement hook execution in runtime | `plugins/m42-sprint/runtime/src/loop.ts` + tests |

**Key files to modify:**
- `plugins/m42-sprint/runtime/src/loop.ts` - Add hook execution after iterations
- `plugins/m42-sprint/runtime/src/types.ts` - May need interface updates
- `plugins/m42-sprint/runtime/src/hooks.test.ts` - New integration tests

**Reference**: Bash implementation was in `sprint-loop.sh` (commit 882922d, deleted)

### Steps 4-6: Discoverability Improvements

| Step | ID | Purpose | Output |
|------|------|---------|--------|
| 4 | creating-workflows-improvement | Add inline schema + patterns to skill | `plugins/m42-sprint/skills/creating-workflows/SKILL.md` |
| 5 | schema-version | Add version field + compiler warnings | `compiler/src/types.ts`, `validate.ts` |
| 6 | validating-workflows | New skill for workflow validation | `plugins/m42-sprint/skills/validating-workflows/SKILL.md` |

### Steps 7-8: Command Refactoring

| Step | ID | Purpose | Output |
|------|------|---------|--------|
| 7 | run-sprint-refactor | Executable preflight checks | `plugins/m42-sprint/commands/run-sprint.md` |
| 8 | init-sprint-refactor | Executable preflight checks | `plugins/m42-sprint/commands/init-sprint.md` |

## Key Reference Files

| File | Purpose |
|------|---------|
| `context/sprint-overview.md` | Full problem analysis and sprint rationale |
| `context/skill-discoverability-feedback.md` | Agent feedback on skill usability |
| `plugins/m42-sprint/docs/reference/workflow-yaml-schema.md` | Workflow schema reference |
| `plugins/m42-sprint/skills/creating-workflows/SKILL.md` | Current workflow skill to improve |
| `plugins/m42-meta-toolkit/skills/creating-skills/SKILL.md` | How to create skills |
| `plugins/m42-meta-toolkit/skills/creating-commands/SKILL.md` | How to create commands |

## Critical Context: Per-Iteration-Hooks Gap

**Current state:**
- ✅ Types defined in `types.ts`
- ✅ Compilation works (hooks appear in PROGRESS.yaml)
- ✅ Validation passes
- ❌ **Runtime execution missing** - `loop.ts` never calls hooks

**Hook interface:**
```typescript
interface PerIterationHook {
  id: string;
  workflow?: string;       // External workflow ref
  prompt?: string;         // Inline prompt
  parallel: boolean;       // Run non-blocking
  enabled: boolean;
}
```

**Expected behavior:** After each iteration, if `parallel: true`, spawn Claude in background with hook prompt. Track in `hook-tasks` array.

## Build Verification Commands

```bash
# Full build
cd plugins/m42-sprint/compiler && npm run build
cd plugins/m42-sprint/runtime && npm run build

# Run tests
cd plugins/m42-sprint/compiler && npm run test
cd plugins/m42-sprint/runtime && npm run test
cd plugins/m42-sprint/e2e && npm run test

# Type check
cd plugins/m42-sprint/compiler && npm run typecheck
cd plugins/m42-sprint/runtime && npm run typecheck
```

## Working Directory

This sprint runs in worktree: `/home/konstantin/projects/m42-claude-plugins/trees/2026-01-29_workflow-qa-improvements`

Branch: `sprint/2026-01-29_workflow-qa-improvements`
