---
allowed-tools: Bash(test:*, mkdir:*, ls:*, find:*, wc:*), Read(*), Write(*), Edit(*), Glob(*), Grep(*)
argument-hint: "<transcript-path> [--dry-run] [--focus <area>]"
description: Extract learnings from session transcript using LLM analysis
model: sonnet
---

# Extract Learnings from Session Transcript

Analyze a Claude Code session transcript comprehensively to extract **signs** - contextual learnings that help future agents work more effectively in this codebase.

## Philosophy

Signs are NOT just error fixes. They capture:
- **Architectural insights** discovered during implementation
- **Project conventions** that aren't obvious from code alone
- **Pitfalls and gotchas** that could trip up future agents
- **Effective strategies** that worked well
- **File relationships** and component interactions
- **Domain knowledge** specific to this project

The goal: A future agent reading the target CLAUDE.md should be more effective at similar tasks.

## Preflight Checks

1. Check if learnings directory exists:
   !`test -d .claude/learnings && echo "EXISTS" || echo "NOT_EXISTS"`

2. List existing CLAUDE.md files for target inference:
   !`find . -name "CLAUDE.md" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -20`

3. Assess transcript size:
   !`wc -l "$TRANSCRIPT_PATH" && (stat --printf="%s" "$TRANSCRIPT_PATH" 2>/dev/null || stat -f%z "$TRANSCRIPT_PATH")`

4. Large transcript detection (>100 lines or >500KB activates preprocessing mode)

## Arguments

Parse `$ARGUMENTS` for:
- **Transcript path** (required): Path to `.jsonl` transcript file
- `--dry-run`: Preview learnings without writing to backlog
- `--focus <area>`: Focus extraction on specific area (e.g., "api", "testing", "build")
- `--preprocess-only`: Generate preprocessing artifacts without LLM analysis
- `--parallel`: Enable parallel chunk processing for large transcripts

## Transcript Schema

Each line in a `.jsonl` transcript is one of these message types:

### system/init
Session metadata - tells you what project, tools available, model used:
```json
{"type": "system", "subtype": "init", "cwd": "/path/to/project", "model": "claude-...", "tools": ["Bash", "Read", ...]}
```

### assistant
Claude's responses - **PRIMARY SOURCE OF LEARNINGS**. Contains reasoning and tool calls:
```json
{
  "type": "assistant",
  "message": {
    "content": [
      {"type": "text", "text": "Let me analyze this... I notice that..."},
      {"type": "tool_use", "id": "toolu_xxx", "name": "Read", "input": {"file_path": "..."}}
    ]
  }
}
```

**Key insight**: The `text` blocks contain Claude's reasoning - architectural decisions, problem-solving strategies, discoveries about the codebase.

### user
User input OR tool results. Tool results show what happened:
```json
{
  "type": "user",
  "message": {
    "content": [
      {"type": "tool_result", "tool_use_id": "toolu_xxx", "content": "...", "is_error": false}
    ]
  }
}
```

Errors have `"is_error": true` - but successful operations often contain MORE valuable learnings.

### result
Session end with stats (can ignore for learning extraction).

## Learning Types Taxonomy

Extract learnings across ALL these categories:

### 1. Architectural Patterns
- How components relate to each other
- Why certain design decisions were made
- Module boundaries and responsibilities
- Data flow patterns

**Example**: "The compiler has three phases: parse → validate → emit. Validation must complete before emit because emit relies on validated AST nodes."

### 2. Project Conventions
- Naming patterns not obvious from code
- File organization rules
- Code style beyond linting
- Commit/PR conventions

**Example**: "All API handlers follow the pattern: parse request → validate → execute → format response. Validation errors return 400, execution errors return 500."

### 3. Pitfalls & Gotchas
- Things that look right but fail
- Edge cases that aren't obvious
- Common mistakes and how to avoid them
- Subtle bugs discovered

**Example**: "When making TypeScript interface fields optional, ALL consumers must add null checks or the build fails with TS18048."

### 4. Effective Strategies
- Approaches that worked well
- Debugging techniques for this codebase
- Testing strategies
- Refactoring patterns

**Example**: "To understand workflow compilation, read the types first (types.ts), then the main flow (compile.ts), then validation (validate.ts)."

### 5. File Relationships
- Which files work together
- Import/dependency patterns
- Files that must change together
- Entry points and their consumers

**Example**: "Changes to WorkflowDefinition in types.ts require updates to: validate.ts (validation), compile.ts (compilation), and all status-server consumers."

### 6. API & Library Patterns
- How to correctly use project APIs
- External library gotchas
- Configuration patterns
- Integration points

**Example**: "yq requires shell variable expansion with single quotes: `yq '.key['"$VAR"']'` not `yq '.key[$VAR]'`"

### 7. Build & Test Patterns
- Build commands and their order
- Test organization and naming
- CI/CD considerations
- Environment requirements

**Example**: "Always run `npm run build` in plugins/m42-sprint/compiler after TypeScript changes - the sprint loop uses compiled JS."

### 8. Domain Knowledge
- Business logic rules
- Terminology definitions
- Constraints and invariants
- User-facing behavior

**Example**: "Ralph Mode is iteration-based, not phase-based. It requires a 'goal' field and generates PROGRESS.yaml dynamically."

## Extraction Process

### Step 1: Read and Parse Transcript

Read the transcript file. For large transcripts (>25k tokens), process in chunks using offset/limit.

```bash
wc -l "$TRANSCRIPT_PATH"  # Check line count
```

### Step 2: Identify Learning-Worthy Moments

Scan for these patterns in the transcript:

**In assistant text blocks**:
- Explanations of how something works
- Discoveries ("I notice...", "I see that...", "This means...")
- Decisions ("I'll use X because...", "The right approach is...")
- Corrections ("Actually...", "I need to...", "This should be...")
- Patterns ("The pattern here is...", "This follows...")

**In tool sequences**:
- Error → investigation → resolution sequences
- Multiple file reads to understand a concept
- Iterative refinement of an approach
- Build/test failures and their fixes

**In successful operations**:
- Complex commands that worked
- Multi-step processes that succeeded
- Integration patterns that connected correctly

### Step 3: Extract Learnings

For each learning-worthy moment, extract:

1. **What was learned** - The insight or pattern
2. **Why it matters** - How it helps future agents
3. **Where it applies** - Which area of the codebase
4. **Confidence level** - How certain and reusable

### Step 4: Assign Target CLAUDE.md

Match each learning to the most specific applicable CLAUDE.md:

| Learning Scope | Target |
|---------------|--------|
| Single file/directory | `path/to/dir/CLAUDE.md` |
| Feature area | `feature-area/CLAUDE.md` |
| Plugin/package | `plugin-name/CLAUDE.md` |
| Project-wide | `./CLAUDE.md` (root) |

If target CLAUDE.md doesn't exist, suggest creating it.

### Step 5: Rate Confidence

| Level | Criteria |
|-------|----------|
| `high` | Clear pattern, explicitly verified, highly reusable |
| `medium` | Good insight, reasonable evidence, somewhat reusable |
| `low` | Possible pattern, limited evidence, context-specific |

### Step 6: Format as Backlog Entries

```yaml
- id: kebab-case-unique-id
  status: pending
  title: Short descriptive title (imperative mood)
  problem: |
    What situation or challenge does this address?
    What might a future agent struggle with?
  solution: |
    What's the key insight or approach?
    How should a future agent handle this?
  target: path/to/CLAUDE.md
  confidence: high|medium|low
  source:
    tool: Primary tool involved (if any)
    context: Brief context of discovery
```

## Output Format

### Dry Run Mode (--dry-run)

Display proposed learnings without writing:

```
## Extraction Preview

Transcript: <path>
Lines analyzed: <count>

### Proposed Learnings (<count>)

#### 1. <title> [<confidence>]
**Target**: <target-path>
**Problem**: <brief problem>
**Solution**: <brief solution>

#### 2. ...

---
Dry run complete - no changes written.
Run without --dry-run to save to backlog.
```

### Normal Mode

Write to backlog and show summary:

```
## Extraction Complete

Transcript: <path>
Lines analyzed: <count>

### Learnings Extracted: <count>

| # | Title | Confidence | Target |
|---|-------|------------|--------|
| 1 | <title> | <confidence> | <target> |
| 2 | ... | ... | ... |

Written to: .claude/learnings/backlog.yaml

### Next Steps
- Review learnings: `/m42-signs:review`
- Check status: `/m42-signs:status`
```

## Quality Guidelines

### DO Extract
- Insights that would save future agents time
- Patterns that aren't obvious from code alone
- Gotchas that caused real problems
- Strategies that worked effectively
- Relationships between components

### DON'T Extract
- Generic programming knowledge (e.g., "use async/await")
- One-time typos or simple mistakes
- Context-specific decisions that won't recur
- Obvious patterns already documented in code
- Duplicate of existing signs in target CLAUDE.md

### Good Sign Characteristics
- **Actionable**: Reader knows what to do
- **Specific**: Applies to this codebase/context
- **Reusable**: Helps with similar future tasks
- **Concise**: Easy to scan and understand

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Transcript too large | Process in chunks with offset/limit |
| No learning-worthy content | Report "No significant learnings found" |
| Focus area specified | Prioritize learnings in that area |
| Target CLAUDE.md missing | Note in output, suggest creation |
| Duplicate learning | Skip if similar sign exists in target |

## Success Criteria

- Every significant insight in the transcript is considered
- Learnings are categorized by type and targeted appropriately
- Confidence levels reflect actual certainty
- Output is actionable for the review step
- Signs will meaningfully help future agents

## Large Transcript Handling

When transcript exceeds 100 lines or 500KB, activate preprocessing mode:

### Step 1: Generate Summary
!`plugins/m42-signs/scripts/transcript-summary.sh "$TRANSCRIPT_PATH"`

Review stats to understand transcript scope.

### Step 2: Find High-Value Patterns
!`plugins/m42-signs/scripts/find-learning-lines.sh "$TRANSCRIPT_PATH"`

These snippets indicate where learnings concentrate.

### Step 3: Extract Reasoning Blocks
!`plugins/m42-signs/scripts/extract-reasoning.sh "$TRANSCRIPT_PATH" > /tmp/reasoning-$$.jsonl`

Creates a smaller file focused on learning-worthy content.

### Step 4: Analyze Reasoning File

If reasoning file has < 100 blocks, analyze directly using standard extraction.

If reasoning file has 100+ blocks, split into chunks:
```bash
split -l 50 /tmp/reasoning-$$.jsonl /tmp/chunk-$$-
```

- With `--parallel`: Spawn chunk-analyzer subagent per chunk via Task()
- Without: Analyze chunks sequentially

### Step 5: Aggregate and Deduplicate Results

Combine learnings from all chunks. Deduplicate by semantic similarity (same problem/solution).
