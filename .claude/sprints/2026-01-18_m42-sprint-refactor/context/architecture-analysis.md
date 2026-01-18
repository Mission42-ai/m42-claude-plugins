# M42-Sprint Architecture Analysis

**Created**: 2026-01-18 (Iteration 1)
**Purpose**: Deep understanding of current architecture and gaps to vision

---

## Executive Summary

The m42-sprint plugin is a sophisticated fresh-context workflow orchestration system with two execution modes: Standard (hierarchical phases) and Ralph (autonomous goal-driven). While the architecture is fundamentally sound, there's a gap between the current implementation and the vision's "Freedom + Patterns" model.

**Key Finding**: The plugin implements "Freedom + Structure" but not yet "Freedom + Patterns". Ralph can shape work freely, but there's no mechanism for invoking proven patterns during execution.

---

## Current Architecture

### Core Flow

```
SPRINT.yaml (user input)
    |
    v
Compiler (TypeScript)
    |
    v
PROGRESS.yaml (execution plan)
    |
    v
Sprint Loop (Bash) --> Mode Detection
    |                       |
    +-- Standard Mode       +-- Ralph Mode
        (hierarchical)          (goal-driven)
```

### Key Architectural Decisions

1. **Fresh Context Pattern**: Each task runs in a fresh Claude CLI invocation, preventing context accumulation slowdowns.

2. **Deterministic State**: The bash loop controls all YAML mutations; agents return JSON results that the loop interprets.

3. **Separation of Concerns**:
   - Compiler: Transforms declarative specs into executable plans
   - Loop: Orchestrates execution, handles errors, manages state
   - Prompts: Built dynamically based on current position

4. **Two Execution Modes**:
   - **Standard**: Hierarchical phases > steps > sub-phases
   - **Ralph**: Goal-driven with dynamic steps, idle detection, reflection

### File Structure

```
plugins/m42-sprint/
+-- compiler/              # TypeScript - compilation and status server
|   +-- src/
|       +-- index.ts       # CLI entry
|       +-- compile.ts     # Compilation logic
|       +-- types.ts       # Comprehensive types
|       +-- validate.ts    # Schema validation
|       +-- expand-foreach.ts
|       +-- status-server/ # Live dashboard
+-- scripts/               # Bash - execution
|   +-- sprint-loop.sh     # Main orchestration (~1800 lines)
|   +-- build-sprint-prompt.sh
|   +-- build-ralph-prompt.sh
|   +-- preflight-check.sh
+-- commands/              # User-facing slash commands
+-- skills/                # Claude Code skills
+-- docs/                  # Documentation
```

---

## The Vision Gap

### What the Vision Requires

The "Freedom + Patterns" model:
- **Ralph decides WHAT and WHY** - genuine freedom to think, shape work, iterate
- **Patterns ensure HOW** - when Ralph executes something, proven patterns kick in
- **Learnings compound** - m42-signs extracts insights that improve future sprints

### Current Reality

- **Freedom**: Ralph mode provides genuine autonomy (dynamic steps, idle detection, reflection modes)
- **Structure**: The loop enforces deterministic state updates, fresh context, JSON contracts
- **But no Patterns**: When Ralph decides to "implement a feature", there's no mechanism to invoke a proven implementation pattern

### The Missing Link

The vision shows this flow:
```
RALPH (thinking) --> decides to implement --> PATTERN (execution) --> RALPH (reflection)
```

Current reality:
```
RALPH (thinking) --> decides to implement --> Ralph implements directly --> RALPH (reflection)
```

**There's no "pattern layer" that Ralph can invoke.** The freedom exists, the structure exists, but the patterns that ensure consistent quality execution don't exist as invocable entities.

---

## Specific Gaps

### 1. Pattern Invocation Mechanism

**Gap**: No way for Ralph to say "I want to implement a feature using the TDD pattern"

**Options to explore**:
- Skills as patterns (Ralph invokes skills)
- Workflow fragments as patterns
- Sub-sprints as patterns
- Pattern prompts that encode best practices

### 2. Sprint Loop Error Handling

**Current state**: Error classification exists (network, rate-limit, timeout, validation, logic) with retry logic.

**Gap**: The vision mentions this is "fragile". Looking at the code:
- Error classification is regex-based (could miss edge cases)
- Backoff is hardcoded (not configurable per sprint)
- Error truncation to 1000 chars may lose important context
- No structured error reporting (intervention queue is JSONL but basic)

**Specific issues**:
- `classify_error()` relies on string pattern matching
- No way to recover from partial failures
- YAML mutations via `yq -i` without transactions (could corrupt on crash)

### 3. Status Server Worktree Awareness

**Current state**: Status server scans `.claude/sprints/` directory for active sprints.

**Gap**:
- No git worktree detection
- Multiple worktrees running sprints would have port conflicts
- Sprint scanner only looks in current directory tree

### 4. Commands Not Updated for Ralph Mode

**Current state**: `/start-sprint` creates templates but doesn't know about Ralph mode differences.

**Gap**:
- Template is for standard mode (has phases)
- Ralph mode needs different template (goal-based, no phases)
- No guidance in start-sprint for choosing mode

### 5. Testing Coverage

**Current state**:
- Unit tests for validation (custom test runner)
- 3 bash integration tests for prompt building

**Gap**:
- No tests for sprint loop itself
- No tests for Ralph mode
- No tests for error handling
- No tests for status server
- No end-to-end sprint execution tests

### 6. Sprint Hooks Status (Clarification Needed)

**Finding from CLAUDE.md**: "The sprint hooks are no longer in use. Should remove them."

**Investigation Result**: This finding appears to be incorrect or referring to something else.

Looking at the code, sprint-activity-hook.sh IS actively used:
- `run-sprint.md` installs the hook via Claude Code settings
- `sprint-loop.sh` cleanup function removes the hook on exit
- `stop-sprint.md` also handles hook cleanup
- Status server activity watcher reads the JSONL this hook produces

**Conclusion**: The sprint activity hook is a key part of the architecture (activity logging for dashboard). The "finding" in CLAUDE.md may refer to a different hook mechanism that was removed, or is simply incorrect. This needs clarification but should NOT be removed without understanding the dependency.

---

## Strengths to Preserve

1. **Fresh Context Pattern**: Elegant solution to context accumulation
2. **Deterministic State**: Loop controls YAML, agents return JSON - this is sound
3. **Comprehensive Types**: TypeScript types are well-defined
4. **Status Server**: Real-time visibility is valuable
5. **Error Classification**: The foundation is there, just needs hardening
6. **Ralph Mode**: The autonomous execution model is innovative

---

## Recommended Priorities

### High Impact, Foundational

1. **Define the Pattern Layer** (architectural)
   - How does Ralph invoke patterns?
   - What is a pattern? (skill? workflow fragment? prompt template?)
   - This unlocks the full vision

2. **Harden Error Handling** (reliability)
   - Transaction-safe YAML updates
   - Better error context preservation
   - Structured error reporting

3. **Worktree Foundation** (scalability)
   - Port discovery for worktrees
   - Multi-worktree sprint discovery
   - Isolation mechanisms

### Medium Impact, Quality of Life

4. **Testing Strategy** (maintainability)
   - Integration tests for sprint loop
   - End-to-end sprint execution tests
   - Mock-based tests for error scenarios

5. **Documentation Consolidation** (usability)
   - Single source of truth for concepts
   - Mode selection guidance
   - Pattern usage examples (once defined)

### Lower Priority, Cleanup

6. **Remove Unused Hook Code**
7. **Update Start-Sprint for Ralph Mode**

---

## Questions for Future Iterations

1. **Pattern Definition**: Should patterns be skills, workflows, or something new?

2. **Pattern Invocation**: How does Ralph signal "now execute this pattern"?
   - Explicit: `{"invoke": "pattern-name", "params": {...}}`
   - Implicit: Loop detects intent and selects pattern
   - Hybrid: Ralph suggests, loop confirms

3. **Learning Integration**: How do m42-signs extractions feed back into patterns?

4. **Worktree Scope**: Should one status server track all worktrees, or one per worktree?

5. **Testing Philosophy**: Unit tests vs integration tests vs end-to-end for a bash-heavy system?

---

## Conclusion

The m42-sprint plugin has solid architectural foundations. The fresh-context pattern and deterministic state management are sound. The primary gap is the "patterns" part of "Freedom + Patterns" - Ralph has freedom but no codified patterns to invoke.

Iteration 1 establishes this understanding. Future iterations should focus on:
1. Defining what a "pattern" is in this context
2. Hardening the foundations (error handling, transactions)
3. Enabling scaling (worktree support)

---

*This analysis is a living document. Update as understanding deepens.*
