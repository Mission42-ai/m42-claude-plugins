# Decision: Remove Hardcoded Patterns

**Created**: 2026-01-19 (Task: remove-hardcoded-patterns)
**Status**: IMPLEMENTING

---

## Context

The sprint implemented a "Freedom + Patterns" model where:
- Ralph (the thinking agent) has freedom to decide WHAT to do
- Patterns ensure consistent execution of HOW to do it

Four hardcoded patterns were created in `plugins/m42-sprint/patterns/`:
- `implement-feature.md` - TDD implementation
- `fix-bug.md` - Debug and fix workflow
- `refactor.md` - Safe refactoring
- `document.md` - Documentation updates

Each pattern included:
- Prompt templates with `{{param}}` substitution
- Verification commands (tests pass, working tree clean)
- Frontmatter metadata

The sprint-loop.sh was extended with ~350 lines of code to:
- Discover patterns in search paths
- Execute patterns in fresh context
- Run verification commands
- Report pattern results back to Ralph

---

## Operator Feedback

From `operator-feedback-round2.md`:

> **Problem**: The sprint implemented hardcoded pattern templates [...] This **limits developers** and goes against the customization philosophy.
>
> **Correct Approach**: Ralph should leverage **existing workflow templates** like `gherkin-verified-execution`.

The operator points to `.claude/sprints/2026-01-17_plugin-enhancements/SPRINT.yaml` as the exemplar:
- Steps have detailed prompts with Requirements, Verification, Files sections
- Workflow reference (`workflow: gherkin-verified-execution`)
- Each step is self-contained with clear success criteria

---

## Decision

**Remove the hardcoded pattern system entirely.**

### Rationale

1. **Workflow templates are more flexible**: Developers can create their own workflow templates that fit their needs, rather than being constrained to the 4 predefined patterns.

2. **Steps ARE the patterns**: The `gherkin-verified-execution` workflow shows that well-structured steps (with Requirements, Verification, Files) achieve the same quality guarantees that patterns were designed for.

3. **Less complexity**: The pattern layer adds ~350 lines of bash code with pattern discovery, rendering, verification, and result handling. This is maintenance burden.

4. **Customization philosophy**: The m42-sprint plugin should enable customization, not prescribe fixed approaches.

5. **The vision still holds**: "Freedom + Patterns" doesn't require hardcoded patterns. Workflow templates and well-structured steps ARE the patterns - they're just defined by users, not the plugin.

---

## What Gets Removed

### Files
- `plugins/m42-sprint/patterns/implement-feature.md`
- `plugins/m42-sprint/patterns/fix-bug.md`
- `plugins/m42-sprint/patterns/refactor.md`
- `plugins/m42-sprint/patterns/document.md`
- `plugins/m42-sprint/scripts/test-pattern-verification.sh` (tests removed functionality)

### Code in sprint-loop.sh
- `run_pattern_verification()` function
- `execute_pattern()` function
- Pattern invocation handling in `process_ralph_result()`
- Pattern result storage in PROGRESS.yaml
- Pattern result context in Ralph prompts

### Documentation
- `plugins/m42-sprint/docs/concepts/patterns.md` - Update to explain that patterns = workflow templates + structured steps

---

## What Remains

The workflow template system remains unchanged:
- Workflows defined in SPRINT.yaml (`workflow: gherkin-verified-execution`)
- Workflow compilation in the compiler
- Custom workflows can be created by developers

Ralph mode remains unchanged:
- Dynamic step management
- Reflection and iteration
- Learning integration

The verification concept moves to workflow templates:
- Each step's prompt can include verification requirements
- Workflow templates can enforce patterns through step structure

---

## Alternative Considered

**Keep patterns but make them optional/customizable**: Allow developers to create project-level patterns in `.claude/patterns/` without providing plugin defaults.

**Rejected because**: This still adds complexity without clear benefit over workflow templates. The workflow template approach is already proven (see 2026-01-17 sprint) and doesn't require additional infrastructure.

---

## Implementation

1. Delete pattern files
2. Remove pattern code from sprint-loop.sh
3. Update patterns.md documentation to redirect to workflow templates
4. Remove test-pattern-verification.sh

---

*This decision document captures the rationale for removing a significant feature. The change aligns with operator guidance and the plugin's customization philosophy.*
