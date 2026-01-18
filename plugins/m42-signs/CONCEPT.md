# m42-signs: Learning Loop for Agent Evolution

> Status: **Planning** | Created: 2026-01-17 | Revised: 2026-01-18

## Origin

This concept emerged from studying the [Ralph Loop](https://ghuntley.com/ralph/) pattern:

> "Each time Ralph does something bad, Ralph gets tuned."

Like adding signs to a playground ("SLIDE DOWN, DON'T JUMP"), we accumulate guidance that makes agents increasingly effective. This is **not ML** - it's explicit, human-curated wisdom extracted from real failures.

## Core Insight

**Claude Code natively injects CLAUDE.md files** when accessing subfolders. This eliminates the need for custom hooks or query APIs. The plugin's value is in the **learning loop** - extracting, reviewing, and applying learnings.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LEARNING LOOP                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CAPTURE              2. REVIEW            3. APPLY          │
│  ┌────────────┐         ┌──────────┐        ┌──────────┐       │
│  │ Session    │────────▶│ Learning │───────▶│ Update   │       │
│  │ transcript │         │ backlog  │        │ CLAUDE.md│       │
│  │ (JSONL)    │         │ (YAML)   │        │ files    │       │
│  └────────────┘         └──────────┘        └──────────┘       │
│        │                      │                   │             │
│        ▼                      ▼                   ▼             │
│  Analyze errors          Human review       Native injection   │
│  & retry patterns        & approval         when folder accessed│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Sign Storage (CLAUDE.md-based)

Signs live in `CLAUDE.md` files throughout the codebase. When Claude accesses any file in a folder, that folder's `CLAUDE.md` is automatically injected into context.

### Directory Pattern

```
project/
├── CLAUDE.md                    # Project-wide signs
├── api/
│   ├── CLAUDE.md                # API-specific signs (auto-injected in api/*)
│   └── routes/
├── frontend/
│   ├── CLAUDE.md                # Frontend signs (auto-injected in frontend/*)
│   └── components/
├── scripts/
│   ├── CLAUDE.md                # Tooling signs (auto-injected in scripts/*)
│   └── build.sh
└── .claude/
    └── learnings/
        └── backlog.yaml         # Pending learnings awaiting approval
```

### CLAUDE.md Sign Format

```markdown
# Project Instructions

... existing project instructions ...

## Signs (Accumulated Learnings)

### yq Variable Quoting
**Problem**: yq fails silently when shell variables aren't quoted
**Solution**: Use `yq '.key['"$VAR"']'` pattern
**Origin**: sprint/2026-01-16, step-3

### API Rate Limiting
**Problem**: Batch requests hit rate limits
**Solution**: Add 100ms delay between requests, max 10 concurrent
**Origin**: sprint/2026-01-14, api-integration
```

---

## 2. Learning Extraction

### Session Transcript Source

Claude Code stores full session transcripts at:
```
~/.claude/projects/{encoded-project-path}/{session-id}.jsonl
```

Or stream JSON directly:
```bash
claude -p "task" --output-format stream-json --verbose > session.jsonl
```

See [SESSION-TRACKING.md](./SESSION-TRACKING.md) for complete format documentation.

### Transcript Format (JSONL)

Each line is a JSON object:

| Type | Description |
|------|-------------|
| `system/init` | Session metadata (model, tools, cwd) |
| `assistant` | Claude's responses (text or tool_use) |
| `user` | User input or tool_result (includes `is_error` flag) |
| `result` | Final outcome with stats |

### Error Detection Patterns

```bash
# Find all tool errors
jq 'select(.type=="user") | .content[]? | select(.is_error==true)' transcript.jsonl

# Correlate failed tool calls with their inputs
jq -s '
  [.[] | select(.type=="assistant" or .type=="user")] |
  group_by(.message.content[0].id // .content[0].tool_use_id) |
  .[] | select(length == 2) |
  {
    tool: .[0].message.content[0].name,
    input: .[0].message.content[0].input,
    is_error: .[1].content[0].is_error,
    result: .[1].content[0].content
  } | select(.is_error == true)
' transcript.jsonl
```

### m42-sprint Integration

Add a workflow step that receives the session transcript and extracts learnings:

```yaml
# In sprint workflow
phases:
  - id: development
    for-each: step
    workflow: feature-standard

  - id: extract-learnings
    prompt: |
      ## Learning Extraction

      Analyze the provided session transcript for learnings.

      ### Task
      1. Find tool errors (is_error: true in tool results)
      2. Identify retry patterns (same operation failed then succeeded)
      3. Extract what changed between failure and success
      4. Write learnings to .claude/learnings/backlog.yaml

      ### Output Format
      Each learning needs:
      - id: kebab-case identifier
      - title: short description
      - problem: what went wrong
      - solution: how to fix/avoid
      - target: path to CLAUDE.md where this belongs
      - confidence: low | medium | high

      ### Only extract learnings that are:
      - Reusable (not one-off fixes)
      - Actionable (clear solution)
      - Scoped (belongs to a specific folder/CLAUDE.md)
```

---

## 3. Learning Backlog

### Schema

```yaml
# .claude/learnings/backlog.yaml
version: 1
extracted-from: session-abc123  # or sprint-id
extracted-at: 2026-01-17T15:30:00Z

learnings:
  - id: yq-variable-quoting
    status: pending              # pending | approved | rejected | applied
    title: Quote Variables in yq Expressions
    problem: |
      yq commands fail silently when shell variables aren't quoted.
      ```bash
      yq '.phases[$IDX].status' file.yaml  # Returns empty
      ```
    solution: |
      Use shell quote escape pattern:
      ```bash
      yq '.phases['"$IDX"'].status' file.yaml
      ```
    target: scripts/CLAUDE.md
    confidence: high
    source:
      tool: Bash
      command: "yq '.phases[$IDX].status' PROGRESS.yaml"
      error: "returned empty string"

  - id: api-batch-rate-limit
    status: approved
    title: Rate Limit Batch API Requests
    problem: |
      Sending many API requests in parallel triggers rate limiting.
    solution: |
      - Add 100ms delay between requests
      - Max 10 concurrent requests
    target: api/CLAUDE.md
    confidence: medium
    source:
      tool: Bash
      error: "429 Too Many Requests"
```

### Workflow

```
/signs extract <transcript>  →  backlog.yaml (pending)
                                      ↓
                    /signs review  →  approve/reject each
                                      ↓
                    /signs apply   →  update CLAUDE.md files
```

---

## 4. Commands

| Command | Description |
|---------|-------------|
| `/extract` | Analyze transcript, propose learnings to backlog |
| `/review` | Interactive review: approve/reject pending learnings |
| `/apply` | Apply approved learnings to target CLAUDE.md files |
| `/add` | Manually add a learning |
| `/list` | List all signs across CLAUDE.md files |
| `/status` | Show backlog summary |

### /signs extract

Analyze a session transcript and propose learnings.

**Input**: Session ID (looks up in `~/.claude/projects/`) or transcript file path

**Process**:
1. Parse JSONL transcript
2. Find all errors (`is_error: true`)
3. Identify retry patterns (failure → success)
4. Extract the diff that made it work
5. Infer target CLAUDE.md from file paths in context
6. Write to `.claude/learnings/backlog.yaml`

**Output**: Summary of proposed learnings

### /signs review

Interactive review of pending learnings.

**For each pending learning**:
1. Display: title, problem, solution, target, confidence
2. Options: Approve / Reject / Edit / Skip
3. Update status in backlog.yaml

### /signs apply

Apply approved learnings to CLAUDE.md files.

**Process**:
1. Filter backlog to `status: approved`
2. Group by target CLAUDE.md
3. For each target:
   - Read or create CLAUDE.md
   - Find or create `## Signs` section
   - Append formatted learning
4. Update backlog: `status → applied`
5. Optional: Create git commit

### /signs add

Manually add a learning (outside of extraction workflow).

**Interactive prompts**:
1. What problem did you encounter?
2. What's the solution?
3. Which folder/CLAUDE.md should this go in?
4. (Optional) Add to backlog or apply directly?

### /signs list

List all signs across CLAUDE.md files in the project.

**Output**: Table of signs with location, title, and origin

### /signs status

Show backlog summary.

**Output**:
```
Learning Backlog Status
=======================
Pending:  3 learnings
Approved: 2 learnings (ready to apply)
Applied:  12 learnings
Rejected: 1 learning
```

---

## 5. Plugin Structure

```
plugins/m42-signs/
├── .claude-plugin/
│   └── plugin.json
├── CONCEPT.md                    # This file
├── SESSION-TRACKING.md           # Transcript format documentation
├── README.md
│
├── commands/
│   ├── extract.md                # /signs extract <transcript>
│   ├── review.md                 # /signs review
│   ├── apply.md                  # /signs apply
│   ├── add.md                    # /signs add (manual)
│   ├── list.md                   # /signs list
│   ├── status.md                 # /signs status
│   └── help.md
│
├── skills/
│   └── managing-signs/
│       ├── SKILL.md
│       └── references/
│           ├── transcript-format.md
│           ├── backlog-schema.md
│           └── claude-md-format.md
│
├── scripts/
│   ├── parse-transcript.sh       # Extract errors from JSONL
│   └── validate-backlog.sh
│
└── assets/
    └── backlog-template.yaml
```

---

## 6. Implementation Phases

### Phase 1: Foundation
- [x] CONCEPT.md (this document)
- [x] SESSION-TRACKING.md (transcript format research)
- [ ] Plugin structure (.claude-plugin/plugin.json)
- [ ] Backlog schema and template
- [ ] /signs add command (manual entry)
- [ ] /signs list command
- [ ] /signs status command

### Phase 2: Extraction
- [ ] Transcript parsing logic
- [ ] /signs extract command
- [ ] Error pattern detection
- [ ] Retry pattern identification
- [ ] Target CLAUDE.md inference

### Phase 3: Review & Apply
- [ ] /signs review command (interactive)
- [ ] /signs apply command
- [ ] Git integration (optional commit)

### Phase 4: Sprint Integration
- [ ] Workflow step template for learning extraction
- [ ] Session transcript passing from sprint loop
- [ ] End-of-sprint learning summary

---

## 7. Examples

### Example: Extracting from Sprint Session

```bash
/signs extract e8411bdc-4a21-4070-944c-76acb850a62d

# Output:
# Analyzed 847 messages, found 3 errors with retry patterns.
#
# Proposed learnings:
# 1. yq-variable-quoting (high) → scripts/CLAUDE.md
# 2. git-add-specific-files (medium) → CLAUDE.md
# 3. yaml-multiline-escaping (low) → scripts/CLAUDE.md
#
# Run /signs review to approve or reject.
```

### Example: Review Flow

```
/signs review

Learning 1/3: yq-variable-quoting
Target: scripts/CLAUDE.md | Confidence: high

Problem:
  yq '.phases[$IDX].status' returns empty

Solution:
  Use yq '.phases['"$IDX"'].status' instead

[A]pprove / [R]eject / [E]dit / [S]kip? A
✓ Approved

Learning 2/3: git-add-specific-files
...
```

### Example: Apply Results

```
/signs apply

Applying 2 approved learnings...

✓ scripts/CLAUDE.md: Added "yq Variable Quoting"
✓ CLAUDE.md: Added "Git Add Specific Files"

Run: git add -A && git commit -m "signs: apply 2 learnings"
```

---

## Open Questions

1. **Automatic extraction trigger**: Should extraction run automatically after every sprint?
2. **Confidence threshold**: Should low-confidence learnings require extra validation?
3. **Sign deduplication**: How to handle similar learnings from different sessions?
4. **Effectiveness tracking**: Track if applied signs reduce future errors?
5. **Cross-project signs**: Share learnings across projects via `~/.claude/signs/`?

---

## Related

- [SESSION-TRACKING.md](./SESSION-TRACKING.md) - Transcript format and CLI options
- [Ralph Loop](../m42-sprint/docs/concepts/ralph-loop.md) - Execution pattern that benefits from signs
- [m42-sprint workflows](../m42-sprint/skills/creating-workflows/) - Integration point

---

*This plugin transforms failures into permanent improvements - each error teaches the system to be better.*
