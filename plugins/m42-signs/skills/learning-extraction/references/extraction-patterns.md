---
title: Extraction Patterns - Linguistic and Tool Signals
description: Patterns that indicate learning-worthy moments in transcripts, including linguistic markers and tool sequence signals
keywords: extraction, patterns, linguistic signals, tool sequences, indicators
file-type: reference
skill: learning-extraction
---

# Extraction Patterns

Systematic patterns for identifying learning-worthy moments in session transcripts.

## Linguistic Signals

### Explanatory Patterns
**Indicators**: "This works because...", "The pattern here is...", "The reason for..."
**Reveals**: Architectural understanding, design rationale

**Example**: "The compiler has three phases: parse → validate → emit. Validation must complete before emit because emit relies on validated AST nodes."
→ **Extract**: Architectural Pattern about phase dependencies

### Discovery Patterns
**Indicators**: "I notice...", "I see that...", "This means...", "After reading..."
**Reveals**: Non-obvious insights, revealed relationships

**Example**: "I notice that changes to WorkflowDefinition affect three systems: compiler, validator, and status server."
→ **Extract**: File Relationships about coupled changes

### Decision Patterns
**Indicators**: "I'll use X because...", "The right approach is...", "Best to..."
**Reveals**: Effective strategies, justified selections

**Example**: "I'll use git worktree because it allows testing each plugin independently."
→ **Extract**: Effective Strategy for large refactors

### Correction Patterns
**Indicators**: "Actually...", "I need to...", "Let me correct...", "That won't work because..."
**Reveals**: Pitfalls, gotchas

**Example**: "Actually, yq requires `yq '.key['"'"'"$VAR"'"'"']'` not `yq '.key[$VAR]'`. The second form treats $VAR as yq syntax."
→ **Extract**: Pitfall about yq syntax

### Pattern Recognition
**Indicators**: "The pattern is...", "This follows...", "Consistent with..."
**Reveals**: Project conventions, recurring patterns

**Example**: "All API handlers follow: parse → validate → execute → format response. Validation errors return 400."
→ **Extract**: Project Convention for error handling

### Constraint Statements
**Indicators**: "Must...", "Cannot...", "Always...", "Never...", "Required..."
**Reveals**: Domain rules, system invariants

**Example**: "Changes to SKILL.md take effect immediately, but bundled scripts require re-packaging."
→ **Extract**: Build Pattern for skill deployment

## Tool Sequence Patterns

### Error Recovery Sequence
**Pattern**: Error → Read/Grep → Analysis → Fix → Success
**Reliability**: High

**Example**:
```
Bash: npm run build → Error: TS18048
Read: src/types.ts
Grep: TS18048
Edit: Add null checks
Bash: npm run build → Success
```
→ **Extract**: "When making TypeScript interface fields optional, ALL consumers must add null checks or build fails with TS18048."

### Investigation Sequence
**Pattern**: Read file A → Read file B → Read file C (related files)
**Reliability**: Medium-High

**Example**: Read types.ts → compile.ts → validate.ts → status-server.ts
→ **Extract**: "Changes to WorkflowDefinition require updates to: validate.ts, compile.ts, status-server.ts."

### Iterative Refinement
**Pattern**: Try A → Adjust to B → Adjust to C → Success
**Reliability**: Medium

**Example**:
```
find . | xargs grep → find plugins/ | xargs grep → Grep with --glob
```
→ **Extract**: "Use Grep with glob patterns rather than find + xargs for skill/command search."

### Build/Test Failure Resolution
**Pattern**: Build/Test → Fail → Investigate → Fix → Success
**Reliability**: High

**Example**:
```
npm test → Error: Cannot find @types/node
Read: package.json
Bash: npm install --save-dev @types/node
npm test → Success
```
→ **Extract**: "Integration tests require @types/node dev dependency."

### Multi-File Coordinated Change
**Pattern**: Edit A → Edit B → Edit C (related changes)
**Reliability**: Medium-High

**Example**: Edit types.ts → compile.ts → validate.ts → status-server.ts
→ **Extract**: "When adding optional fields to WorkflowDefinition, update all consumers."

## Successful Operations

### Complex Commands
**Pattern**: Multi-step command succeeds first try
**Reliability**: Medium

**Example**: `yq '.phases[] | select(.id == "dev") | .for-each.steps[]'` → Success
→ **Extract**: "Extract for-each steps with: `yq '.phases[] | select(.id == \"PHASE\") | .for-each.steps[]'`"

### Integration Success
**Pattern**: Two systems connect correctly on first attempt
**Reliability**: Medium

**Example**: Write WebSocket listener → Bash: npm start → Real-time updates work
→ **Extract**: "Status server emits 'progress-update' events. Subscribe to this event name in dashboard."

### First-Time Workflow Success
**Pattern**: New workflow executes correctly without iteration
**Reliability**: Medium-High

**Example**: Write SPRINT.yaml → compile-sprint → run-sprint → Success
→ **Extract**: "Sprint workflow: write SPRINT.yaml, compile-sprint, then run-sprint."

## Negative Signals (Skip)

| Pattern | Why Skip |
|---------|----------|
| Single typo fix | Not reusable |
| Generic acknowledgment | No insight |
| Tool call with no follow-up | Insufficient info |
| Repetitive identical ops | No new learning |
| Success without explanation | No rationale |

## Pattern Priority

1. **Error Recovery** (highest - verified through fix)
2. **Explanation + Tool Success** (high - reasoning + validation)
3. **Correction Statement** (medium-high - explicit catch)
4. **Multi-File Investigation** (medium - reveals relationships)
5. **Single Observation** (lower - needs context)
