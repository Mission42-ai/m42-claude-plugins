# Plan: Refactor m42-signs Extract Command

## Goal
Transform the `extract` command from a monolithic 400-line file mixing orchestration and domain logic into a clean operator pattern with parallel subagent processing.

## Current Problems
1. **Domain logic in command**: Learning taxonomy, quality criteria, extraction patterns all embedded in extract.md
2. **Broken thresholds**: Uses line count/file size instead of token count
3. **No structured analysis**: Relies on heuristic pattern matching, not comprehensive review
4. **Underutilized subagent**: chunk-analyzer exists but lacks skill invocation
5. **No "no learnings" handling**: Fails gracefully but without guidance

## Architecture Overview

```
extract.md (Operator)
    ├── Parses args, runs preflight
    ├── Spawns transcript-section-analyzer (parallel, per section)
    ├── Spawns context-matcher (matches to CLAUDE.md files)
    ├── Spawns quality-reviewer (scores and filters)
    └── Writes to backlog

learning-extraction (Skill)
    └── Domain knowledge loaded by subagents:
        - Learning taxonomy (8 categories)
        - Quality criteria
        - Extraction patterns
        - Confidence scoring
```

---

## Files to Create

### 1. Skill: `plugins/m42-signs/skills/learning-extraction/SKILL.md`
Core domain knowledge for extraction. Contains:
- 8-category learning taxonomy with criteria
- Quality criteria (what to extract, what to skip)
- Linguistic patterns ("I notice...", "Actually...", "This works because...")
- Tool sequence patterns (error recovery, multi-file changes)
- Confidence scoring rubric

### 2. Skill References
- `references/learning-taxonomy.md` - Detailed category definitions with examples
- `references/quality-criteria.md` - Good sign characteristics, anti-patterns
- `references/extraction-patterns.md` - Linguistic and tool sequence signals
- `references/confidence-scoring.md` - Scoring rubric with evidence types

### 3. Subagent: `plugins/m42-signs/agents/transcript-section-analyzer.md`
Replaces chunk-analyzer. Responsibilities:
- Invoke learning-extraction skill for domain knowledge
- Analyze transcript section systematically
- Extract candidates with: id, title, problem, solution, category, confidence, evidence
- Focus on completeness (quality-reviewer filters later)

### 4. Subagent: `plugins/m42-signs/agents/context-matcher.md`
Cross-references against existing documentation:
- Find all CLAUDE.md files in project
- Assign target based on learning scope
- Check for duplicates against existing signs
- Flag related documentation

### 5. Subagent: `plugins/m42-signs/agents/quality-reviewer.md`
Scores and filters candidates:
- Score on actionability, specificity, reusability, clarity
- Adjust confidence based on evidence strength
- Filter low-quality, exclude duplicates
- Provide summary with reasons

---

## Files to Modify

### 1. `plugins/m42-signs/commands/extract.md`
Reduce from ~400 lines to ~150 lines. Keep only:
- Argument parsing
- Preflight checks
- Section division logic
- Subagent orchestration (Task tool calls)
- Result aggregation
- Backlog writing

Remove all domain logic (taxonomy, patterns, etc.) - now in skill.

### 2. `plugins/m42-signs/agents/chunk-analyzer.md`
Add deprecation notice pointing to transcript-section-analyzer.

### 3. `plugins/m42-signs/scripts/find-learning-lines.sh`
Fix silent failure - output message when no matches found.

---

## Implementation Phases

### Phase 1: Create Skill (Day 1)
1. Create `skills/learning-extraction/` directory structure
2. Write SKILL.md with taxonomy and core guidance
3. Create reference files (taxonomy, quality, patterns, confidence)
4. Validate with creating-skills patterns

### Phase 2: Create Subagents (Day 1-2)
1. Create transcript-section-analyzer.md
2. Create context-matcher.md
3. Create quality-reviewer.md
4. Test each subagent individually with sample inputs

### Phase 3: Refactor Command (Day 2)
1. Backup current extract.md
2. Rewrite as pure operator (orchestration only)
3. Add Task tool to allowed-tools
4. Implement parallel section spawning
5. Test end-to-end

### Phase 4: Cleanup & Test (Day 2-3)
1. Deprecate chunk-analyzer.md
2. Fix find-learning-lines.sh
3. Run on sample transcripts (mechanical, exploratory, error-heavy)
4. Verify expected learnings extracted

---

## Operator Workflow (New extract.md)

```
1. Parse Arguments
   - transcript-path (required)
   - --dry-run, --focus, --min-confidence

2. Preflight Checks
   - Transcript exists
   - Learnings directory ready
   - List existing CLAUDE.md files

3. Preprocessing
   - Try reading transcript directly
   - If token error: run extract-reasoning.sh
   - Split into sections (~50 blocks each)

4. Parallel Analysis
   For each section:
     Task(transcript-section-analyzer, section-path, index)
   Collect all candidate learnings

5. Context Matching
   Task(context-matcher, candidates, project-root)
   Get targets and duplicate flags

6. Quality Review
   Task(quality-reviewer, annotated-candidates, min-confidence)
   Get final filtered learnings

7. Output
   If --dry-run: preview
   Else: write to backlog.yaml
```

---

## Edge Case Handling

| Case | Response |
|------|----------|
| Empty transcript | "No content to analyze" |
| No assistant messages | "Transcript contains no reasoning" |
| Mechanical task (all Edit, 0 errors) | "Session appears mechanical, no learning patterns detected" |
| All filtered by quality | "N candidates found, all filtered: [reasons]" |
| All duplicates | "N candidates identified, all duplicate existing signs" |

---

## Verification

1. **Skill validation**: Run /m42-meta-toolkit:create-skill validator
2. **Subagent test**: Process sample transcript section, verify YAML output
3. **E2E test**: Run on known transcript with expected learnings, verify extraction
4. **Edge case test**: Run on mechanical transcript (like the ralph-cleanup one), verify graceful "no learnings" response

---

## Notes

- Reuse existing references from `managing-signs/references/` where applicable (transcript-format.md, backlog-schema.md)
- The new skill should reference but not duplicate the transcript schema (already in managing-signs)
- Consider moving common references to a shared location later
