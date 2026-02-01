---
title: Learning Taxonomy - 8 Categories
description: Category definitions for classifying extracted learnings from session transcripts
keywords: learning categories, taxonomy, classification, architectural patterns, conventions
file-type: reference
skill: learning-extraction
---

# Learning Taxonomy

## Category Definitions

| Category | Definition | Qualifying Criteria |
|----------|-----------|---------------------|
| **Architectural Patterns** | Component relationships, design decisions, module boundaries, data flow | Describes system structure, explains design rationale, reveals non-obvious interactions |
| **Project Conventions** | Naming patterns, file organization, code style, commit/PR standards | Project-specific rules not enforced by linters, organizational patterns |
| **Pitfalls & Gotchas** | Edge cases, subtle bugs, failure modes, common mistakes | Caused actual error or near-miss, non-obvious from code inspection |
| **Effective Strategies** | Debugging techniques, testing approaches, refactoring patterns, investigation methods | Demonstrated success in session, generalizable to similar situations |
| **File Relationships** | Dependencies, coupled changes, import patterns, entry points | Reveals which files must change together, non-obvious dependencies |
| **API & Library Patterns** | Integration points, external library usage, configuration patterns | Correct usage of project APIs or external libraries, gotchas specific to libraries |
| **Build & Test Patterns** | Build commands, test organization, CI/CD considerations, environment requirements | Project-specific build/test knowledge, not generic engineering practices |
| **Domain Knowledge** | Business logic, terminology, constraints, invariants, user-facing behavior | Project/domain-specific rules, not software engineering concepts |

## Category Boundaries

### Architectural Patterns vs File Relationships
- **Architectural**: Why components are structured this way (design rationale)
- **File Relationships**: Which files change together (practical coupling)

### Project Conventions vs Domain Knowledge
- **Conventions**: How to write/organize code in this project
- **Domain Knowledge**: What the system does and business rules it enforces

### Pitfalls vs Effective Strategies
- **Pitfalls**: What NOT to do (failure modes)
- **Effective Strategies**: What TO do (success patterns)

## Examples by Category

### 1. Architectural Patterns

✅ **Good**: "The compiler has three phases: parse → validate → emit. Validation must complete before emit because emit relies on validated AST nodes with type information."

❌ **Too Generic**: "Use modular design for better maintainability."

✅ **Good**: "WorkflowDefinition types in types.ts are consumed by three systems: compiler (compile.ts), validator (validate.ts), and status server. Changes must satisfy all three."

### 2. Project Conventions

✅ **Good**: "All API handlers follow: parse request → validate → execute → format response. Validation errors return 400, execution errors return 500."

❌ **Too Obvious**: "Use camelCase for variables."

✅ **Good**: "Sprint IDs follow format: YYYY-MM-DD_kebab-case-name. This format is parsed by status server and workflow compiler."

### 3. Pitfalls & Gotchas

✅ **Good**: "When making TypeScript interface fields optional, ALL consumers must add null checks or the build fails with TS18048. Affects: compiler, validator, status server."

❌ **One-time Typo**: "Fixed typo in variable name 'lenght' → 'length'."

✅ **Good**: "yq requires shell variable expansion with single quotes: `yq '.key['"$VAR"']'` not `yq '.key[$VAR]'`. The second form fails silently."

### 4. Effective Strategies

✅ **Good**: "To understand workflow compilation: read types first (types.ts), then main flow (compile.ts), then validation (validate.ts). Reverse order is confusing."

❌ **Too Generic**: "Read code before modifying it."

✅ **Good**: "When debugging phase execution failures, check PROGRESS.yaml first for state, then transcript for error context. Status server shows PROGRESS.yaml live."

### 5. File Relationships

✅ **Good**: "Changes to WorkflowDefinition in types.ts require updates to: validate.ts (validation logic), compile.ts (compilation), and status-server.ts (display). Test all three."

❌ **Too Obvious**: "Import dependencies from node_modules."

✅ **Good**: "extract.md command invokes chunk-analyzer.md subagent. When changing extraction taxonomy, update both + quality-reviewer.md."

### 6. API & Library Patterns

✅ **Good**: "Task tool with subagent_type parameter requires skill invocation inside subagent prompt. Skills auto-load via trigger patterns in description."

❌ **Too Generic**: "Use await for async functions."

✅ **Good**: "YAML frontmatter in SKILL.md uses 'description' field for triggers, NOT 'trigger-on'. The field 'trigger-on' is invalid per schema."

### 7. Build & Test Patterns

✅ **Good**: "Always run `npm run build` in plugins/m42-sprint/compiler after TypeScript changes. Sprint loop uses compiled JS from dist/, not source TS."

❌ **Too Generic**: "Run tests before committing."

✅ **Good**: "Integration tests in tests/integration/ require real worktree setup. Use `git worktree add` pattern from test fixtures."

### 8. Domain Knowledge

✅ **Good**: "Ralph Mode is iteration-based, not phase-based. Requires 'goal' field in SPRINT.yaml and generates PROGRESS.yaml dynamically during execution."

❌ **Too Generic**: "Agile uses iterations."

✅ **Good**: "Signs in CLAUDE.md use imperative mood for titles (e.g., 'Use X for Y'), problem/solution structure. Applied via apply command after review approval."

## Multi-Category Learnings

Some learnings span multiple categories. Assign primary category based on dominant insight:

**Example**: "yq requires `yq '.key['"$VAR"']'` syntax (quoting pattern). Build scripts in scripts/ use this pattern. CI fails without it."

- Primary: **API & Library Patterns** (yq-specific syntax)
- Secondary: **Build & Test Patterns** (CI impact)
- Assign to primary category

## Edge Cases

| Scenario | Classification |
|----------|----------------|
| Generic software engineering principle | ❌ Skip - not project-specific |
| One-time typo fix | ❌ Skip - not reusable |
| Obvious from code comments | ❌ Skip - already documented |
| Same pattern as existing sign in target CLAUDE.md | ❌ Skip - duplicate |
| Context-specific decision unlikely to recur | ❌ Skip - low reusability |
| Architectural insight + implementation gotcha | ✅ Extract both as separate learnings |
