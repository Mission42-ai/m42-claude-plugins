# Step Context: step-1

## Task
Create chunk-analyzer subagent for parallel transcript analysis.

Create: plugins/m42-signs/agents/chunk-analyzer.md

Subagent spec:
- name: chunk-analyzer
- description: Analyze preprocessed transcript chunk for learning extraction
- tools: Read, Bash
- model: sonnet
- color: cyan (research/analysis)

The subagent should analyze preprocessed reasoning chunks and extract
learnings in backlog YAML format.

## Implementation Plan
Based on gherkin scenarios, implement in this order:
1. Create `plugins/m42-signs/agents/` directory
2. Create `chunk-analyzer.md` with valid YAML frontmatter
3. Include all required frontmatter fields (name, description, tools, model, color)
4. Add body instructions for chunk analysis workflow and YAML output

## Related Code Patterns

### Pattern from: plugins/m42-meta-toolkit/agents/artifact-quality-reviewer.md
```markdown
---
name: artifact-quality-reviewer
description: Reviews Claude Code meta-tooling artifacts (commands, skills, hooks, subagents) using artifact-specific quality criteria from creating-skills, creating-commands, creating-subagents, creating-hooks reference materials. Provides structured quality feedback with scores and actionable improvements. Use when independent review is requested during artifact creation workflows.
tools: Read, Bash, Grep, Glob, Skill
model: inherit
color: purple
---

# Artifact Quality Reviewer

Review Claude Code artifacts using type-specific quality frameworks.
[... body instructions ...]
```

### Pattern from: plugins/m42-meta-toolkit/agents/skill-creator.md
```markdown
---
name: skill-creator
description: Creates skills programmatically when other agents need skill creation, when batch-creating skills from specifications, or when quick skill drafting is needed without /create-skill's review cycle.
tools: Skill, Read, Write, Edit, Bash
model: inherit
color: blue
---

Create skills programmatically using streamlined workflow.
[... concise body instructions ...]
```

### Pattern from: plugins/m42-meta-toolkit/agents/doc-writer.md
```markdown
---
name: doc-writer
description: Create or improve documentation files following AI-ready principles. Use proactively when creating guides, API docs, tutorials, or any documentation that needs to be AI-readable.
tools: Read, Write, Bash, Skill
model: inherit
color: yellow
---

Create AI-ready documentation files using structured workflows and validation.
[... workflow steps ...]
```

## Required Inputs/Outputs

### Input Format (from extract-reasoning.sh)
JSONL file with preprocessed reasoning blocks:
```jsonl
{"text": "I notice that the error occurs because..."}
{"text": "The pattern here suggests we should..."}
{"text": "This works because the configuration..."}
```

### Output Format (backlog-compatible YAML)
```yaml
learnings:
  - id: kebab-case-id
    status: pending
    title: Short description (5-10 words)
    problem: |
      Multi-line description of what went wrong
    solution: |
      Multi-line description of how to fix/avoid
    target: path/to/CLAUDE.md
    confidence: low | medium | high
    source:
      tool: <tool name>
      command: <command that failed>
      error: <error message>
```

## Types/Interfaces to Use

### Backlog Schema (from docs/reference/backlog-format.md)

Required learning entry fields:
- `id` (string): Unique identifier in kebab-case format
- `status` (enum): `pending` | `approved` | `rejected` | `applied`
- `title` (string): Short description (5-10 words)
- `problem` (string): What went wrong (multi-line supported)
- `solution` (string): How to fix/avoid (multi-line supported)
- `target` (string): Path to destination CLAUDE.md file

Optional fields:
- `confidence` (enum): `low` | `medium` | `high` (default: `medium`)
- `source` (object): Origin information with tool, command, error

### Confidence Scoring Heuristics
- **high**: Error → retry → success sequence detected
- **medium**: Error with clear message and identifiable tool
- **low**: Ambiguous error or unclear resolution

## Integration Points

### Called by
- `plugins/m42-signs/commands/extract.md` - Via Task() tool for parallel processing
- Used when transcript has 100+ reasoning blocks after preprocessing

### Calls/Uses
- `Read` tool - To read the chunk file
- `Bash` tool - To run validation (e.g., validate-backlog.sh)

### Related Scripts (from step-0)
- `extract-reasoning.sh` - Creates input for chunk-analyzer
- `transcript-summary.sh` - Provides context about source transcript
- `find-learning-lines.sh` - Identifies high-value patterns
- `validate-backlog.sh` - Validates output YAML

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `plugins/m42-signs/agents/` | Create directory | New agents directory for m42-signs plugin |
| `plugins/m42-signs/agents/chunk-analyzer.md` | Create | Subagent definition for chunk analysis |

## Implementation Notes

1. **Subagent frontmatter must include**:
   - `name: chunk-analyzer` (exact match)
   - `description:` with meaningful text
   - `tools: Read, Bash` (minimal permissions)
   - `model: sonnet` (as specified in task)
   - `color: cyan` (research/analysis category)

2. **Body content must**:
   - Describe the analysis workflow
   - Mention "chunk" (input type)
   - Mention "learning" or "learnings" (extraction target)
   - Mention "YAML" or "yaml" (output format)
   - Define what makes content learning-worthy:
     - Architectural insights
     - Pitfalls discovered
     - Effective strategies
     - File relationships
     - Domain knowledge
   - Specify to skip generic programming knowledge

3. **Key differences from other subagents**:
   - Minimal tools (Read, Bash only)
   - Uses `model: sonnet` not `model: inherit`
   - Focus on structured YAML output
   - Designed for parallel spawning by extract command

## Verification Commands

```bash
# Run all scenarios
./tests/step-1-chunk-analyzer.sh

# Individual checks
test -d plugins/m42-signs/agents && echo "PASS: directory exists"
test -f plugins/m42-signs/agents/chunk-analyzer.md && echo "PASS: file exists"
head -1 plugins/m42-signs/agents/chunk-analyzer.md  # Should be "---"
grep "^name: chunk-analyzer" plugins/m42-signs/agents/chunk-analyzer.md
grep "^tools:" plugins/m42-signs/agents/chunk-analyzer.md | grep -q "Read"
grep -qi "yaml" plugins/m42-signs/agents/chunk-analyzer.md
```
