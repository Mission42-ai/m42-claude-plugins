# Simplification Audit Workflow for m42-sprint

## Overview

Create a workflow focused on **identifying what to remove**, not what to add. This embodies the principle that the best code is no code - ruthless simplification guided by YAGNI, KISS, Rule of Three, and lean principles.

**Key insight**: This is an **analysis workflow** (produces reports), not a development workflow (produces code). Each phase generates analysis artifacts that feed into a final prioritized removal plan.

## Workflow Architecture

```
simplification-audit.yaml (top-level)
├── Phase 1: preflight (setup branch, load target)
├── Phase 2: inventory (map everything)
├── Phase 3: analysis (for-each using analysis-step-workflow)
│   └── Steps: dead-code, abstractions, dependencies, patterns, config
└── Phase 4: synthesis (prioritized removal plan)
```

## Files to Create

### 1. Top-Level Workflow
**Path**: `.claude/workflows/simplification-audit.yaml`

4 phases:
1. **preflight** - Create audit branch, identify target scope
2. **inventory** - Map all exports, files, dependencies
3. **analysis** - For-each step through 5 analysis dimensions
4. **synthesis** - Consolidate into prioritized removal plan

### 2. Analysis Step Workflow
**Path**: `.claude/workflows/analysis-step-workflow.yaml`

3 phases per analysis step:
1. **investigate** - Run analysis commands, gather data
2. **document** - Create structured findings artifact
3. **score** - Classify findings by severity/confidence/effort

### 3. Sprint Skill (Documentation)
**Path**: `plugins/m42-sprint/skills/simplification-audit/SKILL.md`

Comprehensive guide for running simplification audits with:
- When to use (after features stabilize, before major releases)
- Step definitions for 5 analysis dimensions
- Severity/confidence/effort classification system
- Example SPRINT.yaml for different audit scopes

## Analysis Dimensions (5 Steps)

| Step ID | Focus | Key Questions |
|---------|-------|---------------|
| `dead-code` | Unused exports, unreachable paths | What's exported but never imported? |
| `abstractions` | Over-engineering, premature abstraction | Does this have 3+ implementations? |
| `dependencies` | External bloat, single-use packages | Can this be replaced with stdlib? |
| `patterns` | Duplicate code, inconsistent approaches | Are there 2+ ways to do this? |
| `config` | Dead flags, constant configuration | Does this value ever change? |

## Audit Scope Configuration

The workflow supports both scoped and whole-codebase audits via optional `target` config:

```yaml
# Scoped audit (recommended for large codebases)
target:
  path: src/utils           # Directory to analyze
  include: "**/*.ts"        # Glob pattern for files
  exclude: "**/*.test.ts"   # Files to skip

# Whole codebase audit (default if target omitted)
# Analyzes everything except node_modules, dist, .git
```

## Output Artifacts

Each phase produces markdown artifacts in `artifacts/`:

```
artifacts/
├── audit-inventory.md        # Phase 2: Complete codebase map
├── dead-code-findings.md     # Step 1: Unused code analysis
├── abstractions-findings.md  # Step 2: Over-engineering analysis
├── dependencies-findings.md  # Step 3: Dependency bloat analysis
├── patterns-findings.md      # Step 4: Duplication analysis
├── config-findings.md        # Step 5: Dead configuration analysis
├── simplification-plan.md    # Phase 4: Prioritized removal queue
└── removal-sprint.yaml       # Phase 4: Auto-generated follow-up sprint
```

### Auto-Generated Follow-Up Sprint

The synthesis phase generates `artifacts/removal-sprint.yaml` - a ready-to-run sprint for executing the safe removals:

```yaml
# Auto-generated from simplification audit
workflow: removal-workflow
sprint-id: {{sprint.id}}-removal

steps:
  # Tier 1: Safe immediate deletions (auto-generated)
  - id: remove-dead-exports
    prompt: |
      Remove unused exports identified in audit:
      - src/utils/legacy.ts (entire file)
      - src/helpers/unused.ts:formatLegacy (function)
      [... generated from findings ...]

  # Tier 2: Simple removals with updates
  - id: consolidate-duplicates
    prompt: |
      Consolidate duplicate utilities:
      - Merge formatDate from 3 locations into src/utils/date.ts
      [... generated from findings ...]
```

Human reviews audit findings → approves follow-up sprint → executes removals with full verification.

## Simplification Plan Output Format

The final `simplification-plan.md` categorizes findings into tiers:

| Tier | Definition | Action |
|------|------------|--------|
| **Tier 1** | No dependents, safe deletion | Delete immediately |
| **Tier 2** | Few dependents, clear migration | Remove with local updates |
| **Tier 3** | Requires migration path | Plan migration first |
| **Tier 4** | Breaking change | Deprecate, schedule removal |

Each item includes:
- **Severity**: Critical / High / Medium / Low
- **Confidence**: High (static proof) / Medium (strong indicators) / Low (needs runtime verification)
- **Effort**: Trivial (<5min) / Small (5-30min) / Medium (30min-2hr) / Large (2-8hr)

## Implementation Steps

1. **Create `simplification-audit.yaml`** - Top-level workflow with 4 phases, target scope handling
2. **Create `analysis-step-workflow.yaml`** - Per-step workflow for analysis dimensions
3. **Create `removal-workflow.yaml`** - Workflow for executing removal sprints (generated from audits)
4. **Create SKILL.md** - Documentation and guidance for running audits
5. **Create example SPRINT.yaml** - Ready-to-run audit sprint definitions (scoped + full)
6. **Add analysis scripts** (optional) - Shell scripts for common checks (depcheck, dead export finder)

## Key Design Decisions

### Why sequential phases (not parallel)?
Each analysis builds on the inventory. Dead code analysis needs the export map. Abstraction analysis references dead code findings to avoid flagging already-dead abstractions.

### Why for-each on analysis steps?
Fresh context per analysis dimension prevents cognitive overload. Each dimension has distinct verification commands and output formats.

### Why artifact-based communication?
Fresh context per phase means all state passes through files. This also creates an audit trail for human review.

### Why no code changes in the workflow?
This is a discovery workflow. Actual removal is a separate sprint using the simplification-plan.md as input. Separation prevents accidental deletions.

## Verification

After implementation:
1. Run `/sprint-status` to verify workflow compiles
2. Create a test SPRINT.yaml targeting a small module
3. Execute preflight and inventory phases
4. Verify artifacts are created correctly
5. Full end-to-end on a real codebase module

## Example Usage

### Scoped Audit (Single Module)
```yaml
# SPRINT.yaml for auditing src/utils module
workflow: simplification-audit
sprint-id: 2026-01-17_utils-simplification

target:
  path: src/utils
  include: "**/*.ts"
  exclude: "**/*.test.ts"

steps:
  - id: dead-code
    prompt: Identify unused exports and unreachable code paths
  - id: abstractions
    prompt: Find over-abstracted patterns violating Rule of Three
  - id: dependencies
    prompt: Identify removable dependencies
  - id: patterns
    prompt: Find duplicate utilities and inconsistent patterns
  - id: config
    prompt: Identify dead configuration and constant flags
```

### Whole Codebase Audit
```yaml
# SPRINT.yaml for full codebase simplification audit
workflow: simplification-audit
sprint-id: 2026-01-17_full-simplification

# No target = entire codebase (excludes node_modules, dist, .git)

steps:
  - id: dead-code
    prompt: Identify unused exports and unreachable code paths across entire codebase
  - id: abstractions
    prompt: Find over-abstracted patterns violating Rule of Three
  - id: dependencies
    prompt: Identify removable or replaceable dependencies
  - id: patterns
    prompt: Find duplicate code and inconsistent patterns
  - id: config
    prompt: Identify dead configuration and always-constant flags
```

### Running the Follow-Up Sprint
```bash
# After audit completes and human reviews findings:
cp artifacts/removal-sprint.yaml .claude/sprints/2026-01-17_removal/SPRINT.yaml
/run-sprint  # Execute the safe removals with full verification
```
