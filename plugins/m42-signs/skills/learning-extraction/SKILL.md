---
name: learning-extraction
description: Domain knowledge for extracting learnings from session transcripts. Provides learning taxonomy (8 categories), quality criteria, extraction patterns (linguistic/tool signals), and confidence scoring. Used by subagents during transcript analysis to identify and classify actionable insights.
---

# Learning Extraction

Domain knowledge for identifying and extracting actionable learnings (signs) from Claude Code session transcripts.

## Purpose

This skill provides comprehensive domain knowledge for extracting signs - contextual learnings that help future agents work more effectively. Signs capture architectural insights, project conventions, pitfalls, effective strategies, file relationships, API patterns, build/test patterns, and domain knowledge discovered during sessions.

## When to Use

Invoke this skill when analyzing transcripts to:
- Understand what constitutes a learning-worthy insight
- Classify learnings into appropriate categories
- Apply quality criteria to filter valuable insights
- Score confidence based on evidence strength
- Identify linguistic and behavioral patterns indicating learnings

## Core Concepts

### Signs vs Generic Knowledge

**Extract**: Insights specific to this codebase/context that would save future agents time
**Skip**: Generic programming knowledge, one-time typos, obvious patterns already in code

### Evidence Sources

Learnings come from three primary sources:
1. **Assistant reasoning** - Explanations, discoveries, decisions, corrections in text blocks
2. **Tool sequences** - Error recovery, multi-file investigations, iterative refinement
3. **Successful operations** - Complex commands that worked, integration patterns that connected

## Learning Taxonomy

Eight categories of learnings to extract. See `references/learning-taxonomy.md` for detailed definitions and examples.

| Category | What to Extract |
|----------|----------------|
| Architectural Patterns | Component relationships, design decisions, module boundaries, data flow |
| Project Conventions | Naming patterns, file organization, code style, commit/PR patterns |
| Pitfalls & Gotchas | Things that look right but fail, edge cases, subtle bugs, common mistakes |
| Effective Strategies | Approaches that worked, debugging techniques, testing strategies, refactoring patterns |
| File Relationships | Files that work together, dependency patterns, files that must change together |
| API & Library Patterns | Correct API usage, external library gotchas, configuration patterns, integration points |
| Build & Test Patterns | Build commands and order, test organization, CI/CD considerations, environment requirements |
| Domain Knowledge | Business logic rules, terminology, constraints, user-facing behavior |

## Quality Criteria

Evaluate each potential learning against these criteria. See `references/quality-criteria.md` for detailed scoring framework.

### Good Sign Characteristics

| Attribute | Criteria |
|-----------|----------|
| Actionable | Reader knows what specific action to take |
| Specific | Applies to this codebase/context, not universal |
| Reusable | Helps with similar future tasks |
| Concise | Easy to scan and understand quickly |

### Anti-Patterns to Avoid

- Generic programming knowledge (e.g., "use async/await")
- One-time typos or simple mistakes
- Context-specific decisions that won't recur
- Obvious patterns already documented in code
- Duplicates of existing signs in target CLAUDE.md

## Extraction Patterns

Identify learning-worthy moments using linguistic and behavioral signals. See `references/extraction-patterns.md` for comprehensive pattern catalog.

### Linguistic Signals

**In assistant text blocks**, look for:
- Explanations: "This works because...", "The pattern here is..."
- Discoveries: "I notice...", "I see that...", "This means..."
- Decisions: "I'll use X because...", "The right approach is..."
- Corrections: "Actually...", "I need to...", "This should be..."

### Tool Sequence Patterns

**In tool call sequences**, look for:
- Error → investigation → resolution sequences
- Multiple file reads to understand a concept
- Iterative refinement of an approach
- Build/test failures and their fixes

### Successful Operations

**In successful tool calls**, look for:
- Complex commands that worked on first try
- Multi-step processes that succeeded
- Integration patterns that connected correctly

## Confidence Scoring

Assign confidence levels based on evidence strength. See `references/confidence-scoring.md` for detailed rubric.

| Level | Criteria |
|-------|----------|
| High | Clear pattern, explicitly verified (tests/execution), highly reusable across similar tasks |
| Medium | Good insight, reasonable evidence (reasoning/tool success), somewhat reusable |
| Low | Possible pattern, limited evidence (speculation/single occurrence), context-specific |

## Extraction Workflow

1. **Identify candidate moments** - Use linguistic signals and tool sequences
2. **Classify by category** - Match to one of 8 taxonomy categories
3. **Apply quality criteria** - Evaluate actionability, specificity, reusability, conciseness
4. **Score confidence** - Assess evidence strength (high/medium/low)
5. **Format extraction** - Structure as: id, title, problem, solution, category, confidence, evidence

### Complete Example

**Raw Transcript Snippet**:
```
Assistant: "I need to run the build after changing the TypeScript compiler code."
[Tool: Bash] npm run build
[Result: Error] TS18048: 'options' is possibly 'undefined'
Assistant: "Actually, I made the 'options' field optional in WorkflowDefinition but
forgot that compile.ts accesses it without null checks. Let me fix that."
[Tool: Read] plugins/m42-sprint/compiler/src/types.ts
[Tool: Edit] plugins/m42-sprint/compiler/src/compile.ts (add null check)
[Tool: Bash] npm run build
[Result: Success]
```

**Identified Signals**:
- Correction pattern: "Actually, I made... but forgot..."
- Error recovery sequence: Build error → Read → Edit → Build success
- Tool sequence verification: Error resolved through fix

**Classification Decision**:
- Category: Pitfalls & Gotchas (thing that looks right but fails)
- Rationale: Optional field without null checks is non-obvious error

**Quality Evaluation**:
- Actionable: Yes (add null checks to consumers)
- Specific: Yes (TypeScript optional fields, TS18048 error)
- Reusable: Yes (applies to all optional interface field changes)
- Concise: Can be stated in 1-2 sentences
- Score: 2.75/3 (High quality)

**Confidence Scoring**:
- Evidence: Error → investigation → fix → verification (Strongest)
- Reusability: Broadly applicable to TypeScript changes
- Confidence: High

**Final Structured Extraction**:
```yaml
id: typescript-optional-fields-null-checks
title: Add null checks when making interface fields optional
problem: |
  When making TypeScript interface fields optional, the compiler doesn't
  force existing code to handle undefined values, leading to TS18048 errors.
solution: |
  After making a field optional, search for all consumers and add null checks.
  Use: rg 'interface.*\{' -A 20 to find interface usages.
category: pitfalls-gotchas
confidence: high
evidence:
  type: error-recovery
  details: Build failed with TS18048, added null checks, build succeeded
target: plugins/m42-sprint/CLAUDE.md
```

## Target Assignment

Match learnings to the most specific applicable CLAUDE.md:

| Learning Scope | Target |
|---------------|--------|
| Single file/directory | `path/to/dir/CLAUDE.md` |
| Feature area | `feature-area/CLAUDE.md` |
| Plugin/package | `plugin-name/CLAUDE.md` |
| Project-wide | `./CLAUDE.md` (root) |

## Success Criteria

Effective extraction results in:
- Every significant insight in the transcript is considered
- Learnings are classified accurately by taxonomy category
- Confidence levels reflect actual evidence strength
- Quality criteria filter out noise and duplicates
- Future agents reading the signs work more effectively
