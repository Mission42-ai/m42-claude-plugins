# Sprint Context - Ralph Terminology Cleanup

## Project Info

- **Test framework**: Custom homegrown framework (no Jest/Vitest)
- **Test location**: `*.test.ts` files co-located with source
- **Build command**: `npm run build` (runs `tsc`)
- **Test commands**:
  - Compiler: `cd plugins/m42-sprint/compiler && npm test`
  - Runtime: `cd plugins/m42-sprint/runtime && npm test`
  - E2E: `cd plugins/m42-sprint/e2e && npm test`
- **Lint command**: None configured
- **TypeScript**: Strict mode, ES2022, NodeNext modules

## Package Structure

```
plugins/m42-sprint/
├── compiler/           # Workflow compilation engine
│   └── src/
│       ├── types.ts        # Type definitions (30.5 KB)
│       ├── compile.ts      # Compilation logic (21.9 KB)
│       ├── validate.ts     # Validation engine (41.2 KB)
│       ├── index.ts        # CLI entry point
│       └── status-server/  # Dashboard server (42 files)
├── runtime/            # Sprint execution runtime
│   └── src/
│       ├── transition.ts   # State machine (28.3 KB)
│       ├── loop.ts         # Main sprint loop (69 KB)
│       └── worktree.ts     # Git worktree management
├── e2e/                # End-to-end tests
├── commands/           # CLI commands (markdown)
├── skills/             # Claude skills
├── docs/               # Documentation
└── schemas/            # JSON schemas
```

## Patterns to Follow

1. **Test Pattern**: Each test file defines its own `test()` and `assert()` helpers:
   ```typescript
   function test(name: string, fn: () => void): void {
     try { fn(); console.log(`✓ ${name}`); }
     catch (e) { console.error(`✗ ${name}`); process.exitCode = 1; }
   }
   ```

2. **TypeScript Conventions**:
   - Interfaces use PascalCase
   - Optional fields marked with `?`
   - YAML field names use kebab-case in types: `'goal-prompt'?`
   - Re-exports from `types.ts` in `index.ts`

3. **Code Removal Best Practices**:
   - Remove types/interfaces before removing usage
   - Update imports after removing exports
   - Keep tests passing after each change
   - Run `npm run build` to verify no type errors

## Sprint Steps Overview

| Step | Scope | Dependencies |
|------|-------|--------------|
| **schema-fix** | Fix `steps:` → `collections:` in commands | None |
| **ts-types** | Remove Ralph types from `types.ts` | None |
| **ts-compile** | Remove Ralph from `compile.ts` | ts-types |
| **ts-validate** | Remove Ralph from `validate.ts` | ts-types |
| **ts-other** | Remove Ralph from `index.ts`, `transition.ts` | ts-types |
| **status-server** | Remove Ralph from status-server files | ts-types |
| **commands** | Simplify commands, remove --ralph | schema-fix |
| **skills** | Update skills, remove Ralph sections | None |
| **delete-and-readme** | Delete ralph files, update README | commands, skills |
| **docs** | Update all documentation | delete-and-readme |
| **tests** | Update test files | ts-* steps |
| **discovery** | Find remaining references, verify build | All |

## Key Goal

Remove all "Ralph" terminology and consolidate to a single workflow mode:
- No `--ralph` flag
- No `mode: ralph` vs `mode: standard`
- Keep "fresh context loop" as implementation detail without special name
- Only workflow-based sprints with `collections:`

## Verification Commands

```bash
# Build all packages
cd plugins/m42-sprint/compiler && npm run build
cd plugins/m42-sprint/runtime && npm run build

# Run tests
cd plugins/m42-sprint/compiler && npm test
cd plugins/m42-sprint/runtime && npm test

# Find remaining Ralph references
grep -ri "ralph" plugins/m42-sprint/ --include="*.ts" --include="*.md" --include="*.yaml" --include="*.json" --include="*.sh"
```
