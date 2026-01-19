# Sprint Plan: 2026-01-19_m42-signs-large-transcript-handling

## Goal

Enable the m42-signs plugin to handle large session transcripts (>100 lines or >500KB) that exceed token limits by adding preprocessing scripts, a chunk analyzer subagent, and enhanced extract command workflow. This allows learning extraction from arbitrarily large transcripts through intelligent preprocessing and optional parallel chunk analysis.

## TDD Approach

Each step follows: **RED → GREEN → REFACTOR → QA**

Since this sprint involves bash scripts and markdown files (not TypeScript), the "test" concept translates to:
- **RED**: Define expected behavior and test commands
- **GREEN**: Implement to pass test commands
- **REFACTOR**: Clean up implementation
- **QA**: Verify with real transcript files

## Success Criteria

- [ ] All 3 preprocessing scripts execute without errors
- [ ] Scripts reduce file size significantly (5-10x for extract-reasoning.sh)
- [ ] chunk-analyzer subagent is properly defined
- [ ] Extract command detects large transcripts automatically
- [ ] Extract command activates preprocessing workflow for large files
- [ ] Documentation is complete and follows AI-ready principles
- [ ] All gherkin scenarios pass (100% score)

## Step Breakdown

### Step 0: Create Preprocessing Scripts

**Scope**: Create 3 bash scripts for transcript preprocessing

**Files to Create**:
- `plugins/m42-signs/scripts/extract-reasoning.sh`
- `plugins/m42-signs/scripts/transcript-summary.sh`
- `plugins/m42-signs/scripts/find-learning-lines.sh`

**Tests to Write**:
```bash
# Test extract-reasoning.sh
./plugins/m42-signs/scripts/extract-reasoning.sh .claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl | wc -l
# Expected: outputs JSON lines with {text: ...} objects

# Test transcript-summary.sh
./plugins/m42-signs/scripts/transcript-summary.sh .claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl
# Expected: JSON with total_lines, assistant_messages, text_blocks, error_count, tool_sequence

# Test find-learning-lines.sh
./plugins/m42-signs/scripts/find-learning-lines.sh .claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl
# Expected: JSON lines with {snippet: ...} matching learning patterns
```

**Implementation Details**:
- All scripts use `jq` for JSON processing
- All scripts check for `jq` availability
- All scripts are executable (`chmod +x`)
- Follow patterns from `parse-transcript.sh` (deprecated but good reference)

**Docs Impact**: None for this step

---

### Step 1: Create Chunk Analyzer Subagent

**Scope**: Create subagent definition for parallel chunk analysis

**Files to Create**:
- `plugins/m42-signs/agents/chunk-analyzer.md`

**Tests to Write**:
```bash
# Verify frontmatter is valid
head -10 plugins/m42-signs/agents/chunk-analyzer.md
# Expected: Valid YAML frontmatter with name, description, tools, model, color

# Verify file structure
test -f plugins/m42-signs/agents/chunk-analyzer.md && echo "EXISTS"
```

**Implementation Details**:
- name: chunk-analyzer
- description: Analyze preprocessed transcript chunk for learning extraction
- tools: Read, Bash
- model: sonnet
- color: cyan (research/analysis)
- Instructions for analyzing text blocks and outputting backlog YAML format

**Docs Impact**: None directly, but mentioned in extract.md and how-to guide

---

### Step 2: Enhance Extract Command

**Scope**: Modify extract.md to detect large transcripts and activate preprocessing

**Files to Modify**:
- `plugins/m42-signs/commands/extract.md`

**Changes**:
1. Add size detection to preflight checks (after line 30)
2. Add new arguments: `--preprocess-only`, `--parallel`
3. Add "Large Transcript Handling" section with full workflow
4. Instructions for using chunk-analyzer subagent

**Tests to Write**:
```bash
# Verify preflight checks include size detection
grep -A5 "Assess transcript size" plugins/m42-signs/commands/extract.md
# Expected: wc -l and stat commands

# Verify new arguments documented
grep "preprocess-only\|--parallel" plugins/m42-signs/commands/extract.md
# Expected: Both arguments documented

# Verify Large Transcript Handling section exists
grep "## Large Transcript Handling" plugins/m42-signs/commands/extract.md
# Expected: Section header found
```

**Implementation Details**:
- Size detection: `wc -l` + `stat` for bytes
- Thresholds: >100 lines OR >500KB
- 5-step preprocessing workflow documented
- Chunk analysis with optional `--parallel` flag

**Docs Impact**: commands.md reference may need update for new arguments

---

### Step 3: Create Documentation

**Scope**: Create how-to guide for large transcript handling

**Files to Create**:
- `plugins/m42-signs/docs/how-to/handle-large-transcripts.md`

**Tests to Write**:
```bash
# Verify file exists with proper structure
test -f plugins/m42-signs/docs/how-to/handle-large-transcripts.md && echo "EXISTS"

# Verify frontmatter
head -10 plugins/m42-signs/docs/how-to/handle-large-transcripts.md
# Expected: Valid YAML frontmatter with title, description, keywords

# Verify sections exist
grep "## " plugins/m42-signs/docs/how-to/handle-large-transcripts.md
# Expected: Multiple section headers
```

**Implementation Details**:
- Follow AI-ready documentation principles
- Include frontmatter with title, description, keywords
- Document automatic preprocessing activation
- Document manual preprocessing workflow
- Include size thresholds table
- List artifacts generated

**Docs Impact**: Update getting-started.md or docs/how-to index if exists

---

### Step 4: Integration Testing

**Scope**: End-to-end test of the complete workflow

**Files to Test**:
- All 3 scripts
- Extract command with large transcript
- Verify preprocessing artifacts

**Tests to Execute**:
```bash
# 1. Test scripts individually
./plugins/m42-signs/scripts/transcript-summary.sh .claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl
./plugins/m42-signs/scripts/extract-reasoning.sh .claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl | wc -l
./plugins/m42-signs/scripts/find-learning-lines.sh .claude/sprints/2026-01-18_parallel-execution/transcripts/development-step-0-execute.jsonl

# 2. Test file size detection in extract command
# Run /m42-signs:extract on large transcript with --dry-run

# 3. Verify preprocessing artifacts created
ls /tmp/reasoning-*.jsonl 2>/dev/null || echo "Artifacts cleaned up"
```

**Expected Results**:
- Scripts execute without errors
- Summary shows correct stats
- Extract command detects file size
- Preprocessing creates smaller working files

**Docs Impact**: Fix any issues discovered in documentation

---

## Documentation Update Plan

| Doc | Status | Updates Needed |
|-----|--------|----------------|
| `docs/how-to/handle-large-transcripts.md` | **new** | Create complete guide |
| `docs/reference/commands.md` | exists | Add --preprocess-only and --parallel args |
| `docs/how-to/extract-from-session.md` | exists | Add link to large transcript guide |
| `docs/getting-started.md` | exists | Optional: mention large transcript handling |

## Risk Considerations

1. **jq availability**: All scripts require jq - documented as dependency
2. **Transcript format variations**: Scripts handle standard JSONL format
3. **Chunking edge cases**: Split may create partial JSON - extract-reasoning outputs complete lines
4. **Parallel execution**: Task() invocation requires proper subagent definition

## Definition of Done

- [ ] All 3 scripts created and executable
- [ ] Scripts pass all test commands
- [ ] chunk-analyzer subagent properly defined
- [ ] extract.md enhanced with size detection and workflow
- [ ] Documentation created following AI-ready principles
- [ ] Integration test passes with real transcript
- [ ] All files committed to sprint branch
