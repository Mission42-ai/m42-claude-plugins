# Sprint Plan: 2026-01-18_m42-signs-implementation

## Goal

Implement the complete m42-signs plugin for learning loop agent evolution. This plugin extracts learnings from session transcripts, manages a review backlog, and applies approved signs to CLAUDE.md files throughout the codebase. The implementation follows the "Ralph Loop" pattern where failures are transformed into permanent, contextually-injected guidance.

## Success Criteria

- [ ] Plugin structure matches m42-sprint patterns with valid plugin.json
- [ ] Manual sign management works (/add, /list, /status commands)
- [ ] Session transcript parsing extracts errors and retry patterns
- [ ] Target CLAUDE.md inference is accurate for 90%+ of cases
- [ ] Interactive review flow is intuitive with batch operations
- [ ] Apply command properly formats and inserts signs
- [ ] Git integration for atomic sign commits
- [ ] Sprint workflow integration for automated extraction
- [ ] Documentation complete and tested

## Step Breakdown

### Step 0: Phase 1.1 - Plugin Structure Setup
**Scope**: Create foundational plugin structure
**Files**:
- `plugins/m42-signs/.claude-plugin/plugin.json` (create)
- `plugins/m42-signs/README.md` (create)
- `plugins/m42-signs/commands/` (create directory)
- `plugins/m42-signs/skills/managing-signs/` (create structure)
- `plugins/m42-signs/scripts/` (create directory)
- `plugins/m42-signs/docs/` (create directory)
**Dependencies**: None
**Risk**: Low - straightforward directory creation following existing patterns

### Step 1: Phase 1.2 - Backlog Schema and Templates
**Scope**: Define backlog YAML schema with validation
**Files**:
- `plugins/m42-signs/skills/managing-signs/assets/backlog-template.yaml` (create)
- `plugins/m42-signs/skills/managing-signs/references/backlog-schema.md` (create)
- `plugins/m42-signs/scripts/validate-backlog.sh` (create)
**Dependencies**: Step 0 (directory structure)
**Risk**: Low - schema design is documented in CONCEPT.md

### Step 2: Phase 1.3 - Manual Sign Management Commands
**Scope**: Implement /add, /list, /status, /help commands
**Files**:
- `plugins/m42-signs/commands/add.md` (create)
- `plugins/m42-signs/commands/list.md` (create)
- `plugins/m42-signs/commands/status.md` (create)
- `plugins/m42-signs/commands/help.md` (create)
**Dependencies**: Steps 0, 1 (structure + backlog schema)
**Risk**: Medium - command logic needs careful validation handling

### Step 3: Phase 2.1 - Transcript Parsing Logic
**Scope**: Parse JSONL session files for errors
**Files**:
- `plugins/m42-signs/scripts/parse-transcript.sh` (create)
- `plugins/m42-signs/skills/managing-signs/references/transcript-format.md` (create)
**Dependencies**: Step 0 (structure)
**Risk**: Medium - jq queries must handle all message types correctly

### Step 4: Phase 2.2 - Error Pattern Detection
**Scope**: Identify retry patterns (error → success sequences)
**Files**:
- `plugins/m42-signs/scripts/find-retry-patterns.sh` (create)
**Dependencies**: Step 3 (transcript parsing)
**Risk**: High - pattern matching heuristics may have edge cases

### Step 5: Phase 2.3 - Target CLAUDE.md Inference
**Scope**: Infer where signs should be stored
**Files**:
- `plugins/m42-signs/scripts/infer-target.sh` (create)
**Dependencies**: Steps 3, 4 (parsed transcripts with patterns)
**Risk**: Medium - needs good heuristics for path analysis

### Step 6: Phase 2.4 - Extraction Command
**Scope**: Implement /extract command with full pipeline
**Files**:
- `plugins/m42-signs/commands/extract.md` (create)
**Dependencies**: Steps 3, 4, 5 (full parsing pipeline)
**Risk**: Medium - orchestrating multiple scripts

### Step 7: Phase 3.1 - Interactive Review Command
**Scope**: Implement /review with approve/reject/edit flow
**Files**:
- `plugins/m42-signs/commands/review.md` (create)
**Dependencies**: Steps 1, 2 (backlog schema + add command)
**Risk**: Medium - interactive flow complexity

### Step 8: Phase 3.2 - Apply Command
**Scope**: Apply approved learnings to CLAUDE.md files
**Files**:
- `plugins/m42-signs/commands/apply.md` (create)
- `plugins/m42-signs/skills/managing-signs/references/claude-md-format.md` (create)
**Dependencies**: Steps 7 (reviewed learnings)
**Risk**: Medium - CLAUDE.md formatting must be consistent

### Step 9: Phase 3.3 - Git Integration
**Scope**: Optional git commit support for apply
**Files**:
- `plugins/m42-signs/commands/apply.md` (update)
**Dependencies**: Step 8 (apply command)
**Risk**: Low - git operations are straightforward

### Step 10: Phase 4.1 - Sprint Workflow Integration
**Scope**: Create workflow templates for sprint integration
**Files**:
- `plugins/m42-signs/skills/managing-signs/assets/learning-extraction-workflow.yaml` (create)
- `plugins/m42-signs/skills/managing-signs/assets/sprint-with-learning.yaml` (create)
- `plugins/m42-signs/skills/managing-signs/SKILL.md` (update)
**Dependencies**: Steps 6, 8 (extract + apply working)
**Risk**: Low - follows m42-sprint workflow patterns

### Step 11: Phase 5.1 - Getting Started Guide
**Scope**: Create primary user documentation
**Files**:
- `plugins/m42-signs/docs/getting-started.md` (create)
- `plugins/m42-signs/docs/how-to/` (create structure)
- `plugins/m42-signs/docs/reference/` (create structure)
- `plugins/m42-signs/README.md` (update)
**Dependencies**: Steps 0-10 (working plugin)
**Risk**: Low - documentation from tested functionality

### Step 12: Phase 5.2 - How-To Guides
**Scope**: Task-oriented how-to guides
**Files**:
- `plugins/m42-signs/docs/how-to/add-sign-manually.md` (create)
- `plugins/m42-signs/docs/how-to/extract-from-session.md` (create)
- `plugins/m42-signs/docs/how-to/review-and-apply.md` (create)
- `plugins/m42-signs/docs/how-to/integrate-with-sprint.md` (create)
**Dependencies**: Step 11 (getting started)
**Risk**: Low - documenting existing functionality

### Step 13: Phase 5.3 - Reference Documentation
**Scope**: Comprehensive reference docs
**Files**:
- `plugins/m42-signs/docs/reference/commands.md` (create)
- `plugins/m42-signs/docs/reference/backlog-format.md` (create)
- `plugins/m42-signs/docs/reference/sign-format.md` (create)
**Dependencies**: Step 11 (getting started)
**Risk**: Low - documenting existing functionality

### Step 14: Phase 5.4 - Final Polish and Testing
**Scope**: Complete documentation and full workflow test
**Files**:
- `plugins/m42-signs/CONCEPT.md` (update)
- `plugins/m42-signs/skills/managing-signs/SKILL.md` (update)
**Dependencies**: All previous steps
**Risk**: Low - validation and polish

## Step Dependency Graph

```
step-0 (structure)
   │
   ├── step-1 (backlog schema)
   │      │
   │      └── step-2 (manual commands)
   │             │
   │             └── step-7 (review) ─────────┐
   │                    │                     │
   │                    └── step-8 (apply) ───┼── step-10 (sprint integration)
   │                           │              │
   │                           └── step-9 (git)
   │
   └── step-3 (transcript parsing)
          │
          └── step-4 (retry patterns)
                 │
                 └── step-5 (target inference)
                        │
                        └── step-6 (extract command)
                               │
                               └── step-10 (sprint integration)

step-10 ─┬── step-11 (getting started)
         │      │
         │      ├── step-12 (how-to guides)
         │      │
         │      └── step-13 (reference docs)
         │
         └── step-14 (final polish)
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| jq queries fail on edge cases | Medium | Test with real session transcripts, add error handling |
| Retry pattern false positives | Medium | Conservative confidence scoring, human review as safety net |
| Target inference misses | Low | Default to project root CLAUDE.md, allow manual override |
| CLAUDE.md format conflicts | Low | Non-destructive append to ## Signs section |
| Session file not found | Low | Clear error messages, suggest session listing |

## Estimated Complexity

| Step | Complexity | Reason |
|------|------------|--------|
| step-0 | Low | Directory creation following patterns |
| step-1 | Low | Schema is well-defined in CONCEPT.md |
| step-2 | Medium | Four commands with validation logic |
| step-3 | Medium | jq queries for various message types |
| step-4 | High | Pattern matching heuristics are complex |
| step-5 | Medium | Path analysis heuristics |
| step-6 | Medium | Orchestrating parsing pipeline |
| step-7 | Medium | Interactive flow with edit mode |
| step-8 | Medium | CLAUDE.md manipulation |
| step-9 | Low | Standard git operations |
| step-10 | Low | Following m42-sprint patterns |
| step-11 | Low | Documentation from working code |
| step-12 | Low | Task-focused guides |
| step-13 | Low | Reference from code |
| step-14 | Low | Validation and updates |

## Workflow Used

**Workflow**: `gherkin-verified-execution`

This workflow includes:
1. **preflight** - Context generation (this phase)
2. **development** - Step implementation with sub-phases:
   - planning
   - implement
   - test
   - document
3. **qa** - Quality assurance
4. **postflight** - Cleanup and summary
5. **retrospective** - Sprint retrospective
