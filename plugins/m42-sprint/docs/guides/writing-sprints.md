# Writing Effective Sprints

This guide covers best practices for writing SPRINT.yaml files that execute reliably and produce high-quality results.

## Sprint Sizing Guidelines

### The Sweet Spot: 3-8 Steps

| Size | Steps | Best For |
|------|-------|----------|
| **Small** | 3-5 | Bug fixes, documentation updates, focused features |
| **Medium** | 5-8 | New features, refactoring tasks, multi-file changes |
| **Large** | 8-12 | Complex features (consider breaking into multiple sprints) |

**Why 3-8 steps?**

- **Under 3 steps**: Often too simple to need automated orchestration
- **3-8 steps**: Ideal balance of complexity and manageability
- **Over 8 steps**: Risk of scope creep, harder to debug failures

### When to Split a Sprint

Split into multiple sprints when you see:

```yaml
# TOO BIG - Split this!
steps:
  - Create database models for users, orders, products, inventory
  - Implement user authentication with JWT, refresh tokens, OAuth
  - Build REST API with 15 endpoints
  - Create admin dashboard with 6 pages
  - Add email notifications, push notifications, webhooks
  - Write 200+ tests
```

Better approach - **one sprint per logical unit**:

```yaml
# Sprint 1: User Authentication
steps:
  - Create User model with email/password fields
  - Implement login/logout endpoints with JWT
  - Add authentication middleware
  - Write authentication tests

# Sprint 2: REST API
# Sprint 3: Admin Dashboard
# Sprint 4: Notifications
```

### Estimating Sprint Size

| Indicator | Suggests |
|-----------|----------|
| Single file change per step | Small sprint (3-5 steps) |
| 2-3 files per step | Medium sprint (5-8 steps) |
| Many files, new modules | Large sprint (8+ steps) - consider splitting |
| New architectural patterns | Medium-to-large, needs careful planning |

## Step Writing Best Practices

### The Anatomy of a Good Step

```yaml
steps:
  - prompt: |
      Create TypeScript interfaces for status events.

      File: compiler/src/status-server/status-types.ts

      Requirements:
      - StatusUpdate interface with sprint state, phase tree, current task
      - LogEntry interface for activity feed entries
      - ServerConfig interface with port, host, sprint directory
      - SSE event types (status-update, log-entry, keep-alive)
```

**Key elements:**
1. **Clear action** - "Create", "Implement", "Update", "Fix"
2. **Specific location** - Which file(s) to create/modify
3. **Concrete requirements** - Bulleted, verifiable criteria

### Step Writing Checklist

| Element | Why It Matters |
|---------|----------------|
| **Action verb first** | "Create X", "Implement Y", "Add Z" - clear intent |
| **File path specified** | Reduces ambiguity, helps Claude navigate |
| **Requirements list** | Concrete, verifiable success criteria |
| **No implementation details** | Let Claude choose the approach |
| **Single responsibility** | One logical unit of work per step |

### Good vs. Bad Steps

**Bad - Too vague:**
```yaml
- Make the authentication better
```

**Good - Specific and actionable:**
```yaml
- prompt: |
    Add rate limiting to the login endpoint.

    File: src/auth/login.ts

    Requirements:
    - Limit to 5 attempts per minute per IP
    - Return 429 status when limit exceeded
    - Add X-RateLimit-* headers to responses
```

**Bad - Multiple concerns:**
```yaml
- Add user authentication, email verification, password reset, and 2FA
```

**Good - Single responsibility:**
```yaml
- prompt: |
    Implement password reset flow.

    Files:
    - src/auth/password-reset.ts (new)
    - src/email/templates/reset-password.html (new)

    Requirements:
    - Generate secure reset token (expires in 1 hour)
    - Send reset email with link
    - Validate token and allow password change
```

**Bad - Prescriptive implementation:**
```yaml
- Create a function called validateUser that takes req.body and uses bcrypt.compare
  to check the password, then returns a JWT token using jsonwebtoken.sign
```

**Good - Outcome-focused:**
```yaml
- prompt: |
    Implement user authentication with JWT tokens.

    Requirements:
    - Validate email/password credentials
    - Return JWT access token on success
    - Use secure password hashing
```

### Multi-File Steps

When a step touches multiple files, list them explicitly:

```yaml
- prompt: |
    Create the file watcher module with debounce.

    Files to create:
    - compiler/src/status-server/watcher.ts (main module)
    - compiler/src/status-server/watcher.test.ts (tests)

    Files to modify:
    - compiler/src/status-server/index.ts (import and use watcher)

    Requirements:
    - Watch PROGRESS.yaml for changes using fs.watch
    - Implement 100ms debounce to prevent excessive updates
    - Export WatcherEvents type for consumers
```

## Workflow Selection Guide

Choose the right workflow for your task type:

### Decision Tree

```
What are you building?
│
├── Quick change, no verification needed?
│   └── execute-step
│
├── Bug fix with diagnosis needed?
│   └── bugfix-workflow
│
├── Feature needing QA per step?
│   └── flat-foreach-qa
│
├── Complex feature with full TDD cycle?
│   └── gherkin-verified-execution
│
└── Documentation or simple multi-step?
    └── flat-foreach
```

### Workflow Comparison

| Workflow | Phases per Step | Best For | Overhead |
|----------|----------------|----------|----------|
| `execute-step` | 1 (execute only) | Quick changes, scripts, docs | Minimal |
| `bugfix-workflow` | 3 (diagnose → fix → verify) | Bug fixes, debugging | Low |
| `flat-foreach` | 1 (execute only, iterated) | Simple multi-step tasks | Low |
| `flat-foreach-qa` | 2 (implement → QA) | Features needing verification | Medium |
| `gherkin-verified-execution` | 5+ (plan → context → execute → qa → verify) | Complex features, TDD | High |

### Workflow Details

#### `execute-step` - Direct Execution
```yaml
workflow: execute-step
```
- Single phase, no verification
- Use for: Config changes, documentation, scripts
- Phases: execute

#### `bugfix-workflow` - Bug Hunting
```yaml
workflow: bugfix-workflow
```
- Structured diagnosis before fixing
- Prevents jumping to conclusions
- Phases: diagnose → fix → verify

#### `flat-foreach-qa` - Feature with QA
```yaml
workflow: flat-foreach-qa
```
- Creates sprint plan first (for context)
- Each step gets implement + QA phases
- Good balance of speed and quality

#### `gherkin-verified-execution` - Full TDD
```yaml
workflow: gherkin-verified-execution
```
- Full preflight analysis
- Per-step: plan → context → execute → qa → verify
- Final QA + summary + PR creation
- Use for: Production features, complex changes

## Per-Step Workflow Overrides

Override the sprint workflow for individual steps when needed:

```yaml
workflow: gherkin-verified-execution  # Default: full verification

steps:
  # Uses default workflow - full TDD cycle
  - prompt: |
      Implement core authentication logic.
      ...

  # Override: This step is just documentation
  - prompt: |
      Update README with authentication docs.
      ...
    workflow: execute-step  # No verification needed

  # Override: Quick config change
  - prompt: |
      Add auth environment variables to .env.example
      ...
    workflow: execute-step

  # Back to default: full verification
  - prompt: |
      Implement authorization middleware.
      ...
```

### When to Override

| Override To | When To Use |
|-------------|------------|
| `execute-step` | Documentation, config files, simple changes |
| `bugfix-workflow` | One step needs bug diagnosis in a feature sprint |
| `flat-foreach-qa` | Step needs QA but not full TDD |

## Context File Usage

Context files help Claude maintain understanding across steps.

### Directory Structure

```
.claude/sprints/2024-01-15_my-sprint/
├── SPRINT.yaml           # Your sprint definition
├── PROGRESS.yaml         # Generated execution state
├── context/              # Shared context files
│   ├── sprint-plan.md    # Created by workflow preflight
│   ├── _shared-context.md # Project patterns (gherkin workflow)
│   └── research.md       # Your custom context
├── artifacts/            # Generated outputs
└── logs/                 # Execution logs
```

### Adding Custom Context

Add research or reference materials before starting:

```bash
# Add context files
mkdir -p .claude/sprints/2024-01-15_my-sprint/context

# Research notes
cat > .claude/sprints/2024-01-15_my-sprint/context/research.md << 'EOF'
# Authentication Research

## Decided Approach
- JWT tokens with 15-minute expiry
- Refresh tokens stored in httpOnly cookies
- bcrypt for password hashing (cost factor 12)

## Reference Implementation
See: https://example.com/auth-guide
EOF
```

Reference in steps:

```yaml
steps:
  - prompt: |
      Implement authentication following our research.

      Context: Read context/research.md for decided approach.

      Requirements:
      - Follow the JWT strategy documented
      - Implement refresh token rotation
```

### Context Best Practices

| Do | Don't |
|----|-------|
| Add architectural decisions upfront | Duplicate info already in codebase |
| Include API contracts/schemas | Add implementation code |
| Document constraints/requirements | Write step-by-step instructions |
| Reference external resources | Copy entire external docs |

## Real Examples from Production Sprints

### Example 1: Documentation Sprint (14 steps)

From the actual documentation sprint creating these guides:

```yaml
# SPRINT.yaml - M42-Sprint Plugin Documentation
workflow: flat-foreach-qa

steps:
  - prompt: |
      Phase 1.1: Überarbeite README.md

      Ziel: Streamlined Entry Point - Hook in 30 Sekunden

      Datei: plugins/m42-sprint/README.md

      Aufgaben:
      - README auf Essentials reduzieren (Ziel: ~100 Zeilen)
      - Klare Struktur: Was ist M42? → Quick Links → 30-Second Example
      - ASCII Diagramm der Three-Tier Architecture
      - Memorable Terminology: "Ralph Loop", "Fresh Context Pattern"

      Erfolg:
      - README ist scanbar und führt Nutzer schnell weiter
      - Kernkonzept in 30 Sekunden verständlich

  - prompt: |
      Phase 1.2: Erstelle docs/index.md

      Ziel: Navigation Hub für verschiedene User-Typen
      ...
```

**What makes it good:**
- Clear phase numbering (1.1, 1.2, etc.)
- Explicit file targets
- Success criteria defined
- Manageable scope per step

### Example 2: Feature Sprint with Tracks (15 steps)

Multi-track feature development:

```yaml
# SPRINT.yaml - M42-Sprint Plugin Enhancements
workflow: gherkin-verified-execution

steps:
  # Track A: Status Page Interactive Buttons
  - prompt: |
      Track A - Step 1: Add API Endpoints for Status Page Controls

      Add pause/resume/stop control API endpoints to the status server.

      Requirements:
      - Add POST /api/pause endpoint
      - Add POST /api/resume endpoint
      - Add POST /api/stop endpoint
      - Return appropriate HTTP status codes

      Files to modify:
      - compiler/src/status-server/server.ts

  # Track B: Skills Development
  - prompt: |
      Track B - Step 1: Create creating-workflows Skill Structure

      Requirements:
      - Create skills/creating-workflows/ directory
      - Create references/ subdirectory with schema docs
      - Create assets/ with example workflows
      ...
```

**What makes it good:**
- Organized by tracks (parallel work streams)
- Each step is self-contained
- Files explicitly listed
- Clear requirements list

### Example 3: Bug Fix Sprint (3 steps)

Focused bug hunting sprint:

```yaml
# SPRINT.yaml - Bug-Hunting Sprint: Activity Feed Issue
workflow: bugfix-workflow

steps:
  - prompt: |
      Diagnose Activity Feed Bug on Status Page

      Issue: The Activity Feed on the Status Page is not functioning.

      Investigation tasks:
      - Locate the Activity Feed component
      - Identify which hook should trigger updates
      - Check if hook is properly registered
      - Document root cause

      Expected outputs:
      - Detailed diagnosis in context/diagnosis.md

  - prompt: |
      Fix Activity Feed Hook Implementation

      Based on the diagnosis, implement the fix.

      Fix tasks:
      - Apply code changes to fix the hook
      - Ensure hook is registered in settings
      - Add error handling if missing

  - prompt: |
      Verify Activity Feed Functionality

      Verification tasks:
      - Start status page server
      - Verify Activity Feed displays correctly
      - Test edge cases (empty feed, many updates)
      - Document verification results
```

**What makes it good:**
- Uses `bugfix-workflow` for structured diagnosis
- Only 3 steps - focused scope
- Clear phase progression: diagnose → fix → verify
- Expected outputs defined

### Example 4: Visual Status Page (12 steps)

Building a real-time status UI:

```yaml
# SPRINT.yaml - Visual Status Page
workflow: flat-foreach-qa

steps:
  - prompt: |
      Create TypeScript interfaces for status events.

      File: compiler/src/status-server/status-types.ts

      Requirements:
      - StatusUpdate interface with sprint state
      - LogEntry interface for activity feed
      - ServerConfig interface
      - SSE event types

  - prompt: |
      Create file watcher with debounce.

      File: compiler/src/status-server/watcher.ts

      Requirements:
      - Watch PROGRESS.yaml using fs.watch()
      - Implement 100ms debounce
      - Handle file deletion/recreation gracefully
  ...
```

**What makes it good:**
- Builds incrementally (types → watcher → transforms → UI → server)
- One file per step (clear boundaries)
- Specific technical requirements
- No over-specification of implementation

## Common Anti-Patterns

### Avoid These Mistakes

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| **Kitchen sink steps** | "Implement entire auth system" | Split into focused steps |
| **Vague requirements** | "Make it better" | Define concrete criteria |
| **Over-specification** | "Use function X with params Y" | Describe outcomes, not code |
| **Missing file paths** | "Update the component" | Specify which file |
| **Too many steps** | 20+ steps in one sprint | Split into multiple sprints |
| **No success criteria** | Just a task description | Add "Requirements:" section |

### Recovery Patterns

If a sprint gets stuck:

```yaml
# Add a recovery step
- prompt: |
    Recovery: Fix issues from previous step.

    Known issues:
    - [List specific errors]

    Requirements:
    - Address each issue
    - Run tests to verify fix
    workflow: execute-step  # Quick fix, no full QA
```

## Checklist: Before Running Your Sprint

- [ ] **Step count**: 3-8 steps (or have good reason for more)
- [ ] **Each step**: Has action verb, file path, requirements
- [ ] **Workflow choice**: Matches task complexity
- [ ] **Dependencies**: Steps in logical order
- [ ] **Context files**: Added if needed for research/decisions
- [ ] **Validation**: SPRINT.yaml is valid YAML

Run a quick syntax check using dry-run (compiler will report any YAML errors):
```bash
/run-sprint .claude/sprints/my-sprint --dry-run
```

## See Also

- [SPRINT.yaml Schema Reference](../reference/sprint-yaml-schema.md) - Complete field reference
- [Workflow YAML Schema](../reference/workflow-yaml-schema.md) - Workflow definitions
- [Writing Workflows Guide](./writing-workflows.md) - Creating custom workflows
- [Commands Reference](../reference/commands.md) - Sprint management commands
- [Troubleshooting](../troubleshooting/common-issues.md) - Common issues and solutions
