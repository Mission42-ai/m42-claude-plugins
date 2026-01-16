# Sprint Plan: M42-Sprint Plugin Documentation

## Goal

Create comprehensive "awesome-level" developer and user documentation for the m42-sprint plugin. The documentation will transform the existing scattered reference materials into a cohesive, user-friendly documentation system with clear architecture explanations, progressive learning paths, and unified reference documentation. The outcome enables new users to understand the system in 30 seconds, get started in 5 minutes, and master advanced features through well-organized deep-dive materials.

## Architecture Overview

```
                    Documentation Structure
                    ========================

plugins/m42-sprint/
├── README.md                 ← Entry Point (30-sec hook)
│   └── Links to →
│
├── docs/
│   ├── index.md              ← Navigation Hub (user-type routing)
│   │   ├── "New here?" →
│   │   ├── "Architecture" →
│   │   ├── "Building" →
│   │   └── "Reference" →
│   │
│   ├── concepts/             ← Deep Understanding (15min+)
│   │   ├── overview.md       ← Three-Tier Model, Why This Architecture
│   │   ├── ralph-loop.md     ← Fresh Context Pattern, Problem/Solution
│   │   └── workflow-compilation.md ← Compilation Pipeline
│   │
│   ├── reference/            ← Technical Specs (lookup)
│   │   ├── commands.md       ← All 10 Commands Unified
│   │   ├── sprint-yaml-schema.md
│   │   ├── progress-yaml-schema.md
│   │   └── workflow-yaml-schema.md
│   │
│   ├── getting-started/      ← Tutorials (5-15min)
│   │   ├── quick-start.md    ← 5-min "Hello World"
│   │   └── first-sprint.md   ← 15-min Complete Walkthrough
│   │
│   ├── guides/               ← How-To Guides
│   │   ├── writing-sprints.md
│   │   └── writing-workflows.md
│   │
│   └── troubleshooting/
│       └── common-issues.md


                 Three-Tier Architecture (Key Concept)
                 ======================================

┌─────────────────────────────────────────────────────────────┐
│                       SPRINT.yaml                           │
│  (User writes: workflow reference + steps with prompts)     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript Compiler                       │
│  compiler/src/                                               │
│  ├── compile.ts    (orchestration)                          │
│  ├── resolve-workflows.ts (load .yaml workflows)            │
│  ├── expand-foreach.ts (iterate steps through phases)       │
│  └── validate.ts   (schema validation)                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     PROGRESS.yaml                            │
│  (Generated: hierarchical phases, current pointer, stats)   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Sprint Loop (Ralph Loop)                   │
│  scripts/sprint-loop.sh                                      │
│  - Reads PROGRESS.yaml                                       │
│  - Builds prompt for current phase                           │
│  - Invokes `claude -p` with fresh context                    │
│  - Updates PROGRESS.yaml                                     │
│  - Loops until completed/blocked/paused                      │
└─────────────────────────────────────────────────────────────┘
```

## Integration Points

### Source Materials (existing content to consolidate)

| Source Location | Target Document | Content Type |
|-----------------|-----------------|--------------|
| `README.md` (current) | `README.md` (streamlined) | Entry point |
| `docs/USER-GUIDE.md` | Split into multiple docs | Full guide |
| `skills/orchestrating-sprints/references/progress-schema.md` | `docs/reference/progress-yaml-schema.md` | Schema spec |
| `skills/creating-sprints/references/sprint-schema.md` | `docs/reference/sprint-yaml-schema.md` | Schema spec |
| `skills/creating-workflows/references/workflow-schema.md` | `docs/reference/workflow-yaml-schema.md` | Schema spec |
| `skills/creating-workflows/references/template-variables.md` | `docs/concepts/workflow-compilation.md` | Variables |
| `skills/creating-workflows/references/workflow-patterns.md` | `docs/guides/writing-workflows.md` | Patterns |
| Individual command files in `commands/` | `docs/reference/commands.md` | Unified reference |

### File Dependencies

```
README.md
  └── links to docs/index.md

docs/index.md
  ├── getting-started/quick-start.md
  ├── getting-started/first-sprint.md
  ├── concepts/overview.md
  └── reference/commands.md

docs/concepts/overview.md
  ├── concepts/ralph-loop.md
  └── concepts/workflow-compilation.md

docs/getting-started/quick-start.md
  └── getting-started/first-sprint.md (for more details)

docs/guides/writing-sprints.md
  └── reference/sprint-yaml-schema.md

docs/guides/writing-workflows.md
  └── reference/workflow-yaml-schema.md
```

## Step Success Criteria

### Phase 1: Entry & Navigation (Steps 1-2)

#### Step 1 (Phase 1.1): README.md Overhaul
- [ ] README reduced to ~100 lines (from 143)
- [ ] Clear structure: What is M42? → Quick Links → 30-Second Example → Installation
- [ ] ASCII diagram of Three-Tier Architecture visible
- [ ] Quick Links to docs/ paths working
- [ ] "Ralph Loop" and "Fresh Context Pattern" terminology introduced
- [ ] Core concept understandable in 30 seconds

#### Step 2 (Phase 1.2): docs/index.md Navigation Hub
- [ ] File created at `plugins/m42-sprint/docs/index.md`
- [ ] Sections: "New here?", "Architecture", "Building", "Reference", "Troubleshooting"
- [ ] Each section has 2-3 links to relevant docs
- [ ] Progressive disclosure indicated (5min → 15min → Deep Dive)
- [ ] User types can find appropriate path immediately

### Phase 2: Concepts (Steps 3-5)

#### Step 3 (Phase 1.3): docs/concepts/overview.md
- [ ] Three-Tier Model diagram (ASCII) present
- [ ] Ralph Loop visualization included
- [ ] Component map of directory structure
- [ ] "Why this architecture?" section answers the question
- [ ] Key Benefits table
- [ ] Links to deep dive docs (ralph-loop.md, workflow-compilation.md)

#### Step 4 (Phase 1.4): docs/concepts/ralph-loop.md
- [ ] Problem explained: Context Accumulation in long sessions
- [ ] Solution explained: Fresh Context per Task
- [ ] Sequence diagram (ASCII) showing execution flow
- [ ] Key Benefits table
- [ ] Implementation details reference sprint-loop.sh
- [ ] Code examples from actual implementation
- [ ] "Ralph Loop" name is memorable and explained

#### Step 5 (Phase 1.5): docs/concepts/workflow-compilation.md
- [ ] Compilation pipeline visualized
- [ ] Step-by-step: Load → Resolve → Expand → Substitute → Generate
- [ ] Example expansion (SPRINT.yaml → Workflow → PROGRESS.yaml)
- [ ] Template variables documented ({{step.prompt}}, {{step.id}}, etc.)
- [ ] Compiler module overview (compile.ts, resolve-workflows.ts, expand-foreach.ts)

### Phase 3: Reference (Steps 6-9)

#### Step 6 (Phase 2.1): docs/reference/commands.md
- [ ] All 10 commands consolidated in one file
- [ ] Quick reference table at top
- [ ] Sections: Lifecycle, Control, Monitoring, Step Management
- [ ] Per command: Usage, Description, Options, Examples
- [ ] Copy-paste ready examples

#### Step 7 (Phase 2.2): docs/reference/sprint-yaml-schema.md
- [ ] Minimal example
- [ ] Full example with all options
- [ ] Field reference table
- [ ] Validation rules documented
- [ ] Common patterns
- [ ] Step format variants (string vs object)

#### Step 8 (Phase 2.3): docs/reference/progress-yaml-schema.md
- [ ] Generated structure explained
- [ ] Status values documented (pending, in-progress, completed, blocked, skipped)
- [ ] Current pointer explained (phase, step, sub-phase)
- [ ] Stats tracking documented
- [ ] Phase hierarchy visualization (ASCII tree)

#### Step 9 (Phase 2.4): docs/reference/workflow-yaml-schema.md
- [ ] Workflow structure documented
- [ ] Phase types (simple vs for-each)
- [ ] Template variables reference
- [ ] Workflow patterns with examples
- [ ] Nested workflows explained

### Phase 4: Tutorials (Steps 10-11)

#### Step 10 (Phase 3.1): docs/getting-started/quick-start.md
- [ ] 4 steps: start-sprint → add-step (2x) → run-sprint → observe status
- [ ] Each step has command and expected output
- [ ] Prerequisites check (yq, Node.js)
- [ ] "What happens now?" explanations
- [ ] Link to first-sprint.md for details
- [ ] Tutorial completable in < 5 minutes

#### Step 11 (Phase 3.2): docs/getting-started/first-sprint.md
- [ ] Prerequisites with installation commands (yq, Node.js)
- [ ] Step-by-step guided walkthrough
- [ ] SPRINT.yaml editing and understanding
- [ ] Workflow selection and understanding
- [ ] Output interpretation (PROGRESS.yaml, status)
- [ ] Troubleshooting tips inline
- [ ] User can create own sprints after completion

### Phase 5: Guides & Troubleshooting (Steps 12-14)

#### Step 12 (Phase 4.1): docs/troubleshooting/common-issues.md
- [ ] Categories: Compilation, Execution, Environment, Status
- [ ] Per issue: Symptom, Cause, Solution, Prevention
- [ ] Most frequent problems first
- [ ] Debug commands for diagnostics

#### Step 13 (Phase 4.2): docs/guides/writing-sprints.md
- [ ] Sprint sizing guidelines (3-8 steps optimal)
- [ ] Step writing best practices
- [ ] Workflow selection guide
- [ ] Per-step workflow overrides
- [ ] Context file usage
- [ ] Real examples from actual sprints

#### Step 14 (Phase 4.3): docs/guides/writing-workflows.md
- [ ] Workflow authoring guide
- [ ] Phase types (simple, for-each)
- [ ] Template variables usage
- [ ] Workflow patterns (from existing patterns doc)
- [ ] Testing and validation
- [ ] Migration guidance if applicable

## Dependencies

```
Sequential dependencies (must complete in order):
─────────────────────────────────────────────────

1. README.md (Step 1)
   └── Must exist before index.md can link to it
       └── 2. index.md (Step 2)
           └── Must exist before concept docs can back-link
               ├── 3. overview.md (Step 3)
               │   └── 4. ralph-loop.md (Step 4)
               │   └── 5. workflow-compilation.md (Step 5)
               │
               └── 6-9. Reference docs (Steps 6-9)
                   └── Can be done in parallel
                       └── 10-11. Tutorials (Steps 10-11)
                           └── Need reference docs for links
                               └── 12-14. Guides/Troubleshooting (Steps 12-14)


Parallel opportunities:
───────────────────────
- Steps 6, 7, 8, 9 (Reference docs) - no interdependencies
- Steps 10, 11 (Tutorials) - could be parallel after references
- Steps 12, 13, 14 (Guides) - could be parallel
```

## Risk Areas

### 1. Content Duplication
**Risk:** New docs might duplicate content from USER-GUIDE.md
**Mitigation:** Each step should explicitly reference what content to consolidate and where to remove duplicates. USER-GUIDE.md may become obsolete or serve as archive.

### 2. Link Rot
**Risk:** Links between documents may break if paths change
**Mitigation:** Use relative paths consistently. QA phase should validate all internal links.

### 3. ASCII Diagram Rendering
**Risk:** ASCII diagrams may not render well in all markdown viewers
**Mitigation:** Use simple, standard ASCII characters. Test in GitHub preview.

### 4. Schema Drift
**Risk:** Reference docs may become outdated if types.ts changes
**Mitigation:** Reference docs should note "source of truth" as compiler/src/types.ts

### 5. Missing Source Content
**Risk:** Some steps reference "existing" content that may not exist in specified location
**Mitigation:** QA step should verify source content exists. If missing, create minimal version.

### 6. Scope Creep
**Risk:** Documentation improvements could expand into code changes
**Mitigation:** This sprint is documentation-only. Code changes should be tracked separately.

## Terminology Guide (for consistency)

| Term | Usage |
|------|-------|
| **Ralph Loop** | The fresh-context execution pattern (bash loop invoking `claude -p`) |
| **Fresh Context Pattern** | Each phase gets clean Claude context (no accumulation) |
| **Three-Tier Architecture** | SPRINT.yaml → Compiler → PROGRESS.yaml |
| **Step** | User-defined work item in SPRINT.yaml |
| **Phase** | Compiled execution unit in PROGRESS.yaml |
| **Sub-phase** | Nested phase within a step (from step workflow) |
| **Current Pointer** | PROGRESS.yaml's `current:` object tracking position |
| **Compilation** | Process of expanding SPRINT.yaml through workflows |

## File Creation Order

1. `docs/index.md` (creates docs/ directory)
2. `docs/concepts/overview.md` (creates concepts/)
3. `docs/concepts/ralph-loop.md`
4. `docs/concepts/workflow-compilation.md`
5. `docs/reference/commands.md` (creates reference/)
6. `docs/reference/sprint-yaml-schema.md`
7. `docs/reference/progress-yaml-schema.md`
8. `docs/reference/workflow-yaml-schema.md`
9. `docs/getting-started/quick-start.md` (creates getting-started/)
10. `docs/getting-started/first-sprint.md`
11. `docs/troubleshooting/common-issues.md` (creates troubleshooting/)
12. `docs/guides/writing-sprints.md` (creates guides/)
13. `docs/guides/writing-workflows.md`
14. Update README.md (last, to ensure all links work)

Note: Step order in SPRINT.yaml starts with README.md, but actual creation should ensure directories exist first.
