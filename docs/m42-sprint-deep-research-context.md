# M42-Sprint Plugin: Deep Research Context

> Dieses Dokument dient als vollständige Kontextquelle für Deep Research mit Claude, um Development Best-Practices in Workflow-Templates zu kodieren.

---

## 1. Plugin-Übersicht

### Was ist m42-sprint?

Das **m42-sprint** Plugin ermöglicht autonome, mehrstufige Sprint-Ausführung mit Claude Code. Es löst das fundamentale Problem der **Context-Akkumulation** bei langen AI-Sessions durch das **Ralph Loop Pattern** - jede Phase wird in einem frischen Claude-Aufruf ausgeführt.

### Kernkonzepte

| Konzept | Beschreibung |
|---------|--------------|
| **SPRINT.yaml** | Benutzer-Input: Definiert Workflow-Referenz und Steps |
| **Workflow YAML** | Template: Definiert Phasen, die Steps durchlaufen |
| **PROGRESS.yaml** | Runtime-State: Kompiliertes Ergebnis + Execution Pointer |
| **Ralph Loop** | Bash-Loop: Frischer Claude-Aufruf pro Phase |
| **Fresh Context** | Keine akkumulierte History zwischen Phasen |

### Architektur (3-Tier)

```
Tier 1: INPUT
┌─────────────────────────────────────────────────────────────┐
│  SPRINT.yaml                  Workflow YAML                 │
│  - workflow: <name>           - phases: [...]               │
│  - steps: [...]               - for-each: step              │
│  - config: {...}              - nested workflows            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Compilation (TypeScript)
Tier 2: RUNTIME STATE
┌─────────────────────────────────────────────────────────────┐
│  PROGRESS.yaml                                              │
│  - status: in-progress                                      │
│  - phases: [hierarchical structure]                         │
│  - current: { phase, step, sub-phase }  ← Pointer          │
│  - stats: { started-at, elapsed, ... }                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Ralph Loop (Bash)
Tier 3: EXECUTION
┌─────────────────────────────────────────────────────────────┐
│  sprint-loop.sh                                             │
│  while status == "in-progress":                             │
│      prompt = build_prompt(current_position)                │
│      claude -p "$prompt"  ← FRISCHER KONTEXT               │
│      check_status_and_advance()                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Das Ralph Loop Pattern

### Problem: Context-Akkumulation

Bei traditionellen langen AI-Sessions:

```
Session Start    Task 5         Task 10        Task 20
     │             │              │              │
     ▼             ▼              ▼              ▼
   [Fresh]     [Tasks 1-5]   [Tasks 1-10]   [Full Context!]
   Schnell      Langsamer     Sehr langsam   Timeout-Risiko
```

**Symptome:**
- Langsamere Antworten (mehr Tokens pro Turn)
- Höhere Kosten (akkumulierter Kontext wird wiederholt bezahlt)
- Qualitätsverlust (relevante Info in Noise begraben)
- Timeout-Fehler (Context-Limit überschritten)

### Lösung: Fresh Context pro Phase

```
Phase 1:  [Fresh] → Execute → Update Pointer → Exit
Phase 2:  [Fresh] → Execute → Update Pointer → Exit
Phase 3:  [Fresh] → Execute → Update Pointer → Exit
  ...
Phase N:  [Fresh] → Execute → Mark Completed → Exit
```

**Jeder `claude -p` Aufruf erhält nur:**
1. Context-Files (explizit, kontrolliert)
2. Aktueller Phase-Prompt (aus PROGRESS.yaml)
3. Position-Information (wo im Hierarchy)
4. Instructions (was tun und wie Progress updaten)

**NICHT übergeben:** Output vorheriger Phasen.

### Kosten-Vergleich

```
Traditionell (akkumuliert):           Ralph Loop (frisch):
Phase 1:  1,000 tokens → $0.003       Phase 1: 1,500 tokens → $0.005
Phase 2:  2,500 tokens → $0.008       Phase 2: 1,500 tokens → $0.005
Phase 3:  4,500 tokens → $0.014       Phase 3: 1,500 tokens → $0.005
Phase 4:  7,000 tokens → $0.021       Phase 4: 1,500 tokens → $0.005
Phase 5: 10,000 tokens → $0.030       Phase 5: 1,500 tokens → $0.005
                        ────────                            ────────
                  Total: $0.076                       Total: $0.025
                  (exponentiell)                      (linear)
```

---

## 3. SPRINT.yaml Schema

### Grundstruktur

```yaml
# ============================================================================
# PFLICHTFELDER
# ============================================================================
workflow: <string>          # Workflow-Referenz (ohne .yaml Endung)
steps:                      # Liste von Steps
  - "Step als String"
  - id: step-id
    prompt: "Step als Objekt mit ID"

# ============================================================================
# OPTIONALE FELDER
# ============================================================================
name: <string>              # Human-readable Name
sprint-id: <string>         # Auto-generiert wenn nicht angegeben
created: <ISO timestamp>    # Erstellungszeitpunkt
owner: <string>             # Sprint-Besitzer

# ============================================================================
# KONFIGURATION
# ============================================================================
config:
  max-tasks: <number>       # Max. parallele Tasks
  time-box: <string>        # Zeit-Limit (z.B. "4h", "30m")
  auto-commit: <boolean>    # Automatische Commits
  max-iterations: <number>  # Max. Loop-Iterationen

# ============================================================================
# RALPH MODE (Goal-driven)
# ============================================================================
goal: |                     # Goal-Beschreibung (mehrzeilig)
  Beschreibung des Ziels...

ralph:
  idle-threshold: 3         # Iterationen ohne Fortschritt
  min-iterations: 15        # Minimum vor goal-complete

per-iteration-hooks:        # Hooks pro Iteration
  - id: learning
    prompt: "/m42-signs:extract $ITERATION_TRANSCRIPT"
    parallel: true
    enabled: true
```

### Step-Formate

```yaml
# Format 1: Einfacher String
steps:
  - "Implementiere Feature X"
  - "Schreibe Tests für Feature X"

# Format 2: Objekt mit ID
steps:
  - id: feature-x
    prompt: "Implementiere Feature X"
  - id: tests-x
    prompt: "Schreibe Tests für Feature X"

# Format 3: Objekt mit Nested Workflow
steps:
  - id: complex-feature
    prompt: "Komplexes Feature mit eigenem Workflow"
    workflow: custom-step-workflow
```

### Praxisbeispiel: Vollständiger Sprint

```yaml
# SPRINT.yaml - Feature Implementation Sprint
workflow: gherkin-verified-execution
sprint-id: 2026-01-19_user-auth
name: User Authentication Feature
created: 2026-01-19T10:00:00Z
owner: konstantin

config:
  auto-commit: true
  max-iterations: 100

steps:
  - id: foundation
    prompt: |
      GIVEN the project needs user authentication
      WHEN implementing the auth service
      THEN create login/logout functionality

      ## Acceptance Criteria
      - [ ] AuthService class with login() and logout() methods
      - [ ] JWT token generation and validation
      - [ ] Password hashing with bcrypt
      - [ ] Unit tests for all methods

  - id: api-endpoints
    prompt: |
      GIVEN the AuthService is implemented
      WHEN creating REST endpoints
      THEN expose /auth/login and /auth/logout

      ## Acceptance Criteria
      - [ ] POST /auth/login returns JWT on success
      - [ ] POST /auth/logout invalidates session
      - [ ] Proper error handling (401, 403, 422)
      - [ ] Integration tests

  - id: middleware
    prompt: |
      GIVEN the auth endpoints work
      WHEN creating auth middleware
      THEN protect routes requiring authentication

      ## Acceptance Criteria
      - [ ] requireAuth middleware validates JWT
      - [ ] Attaches user to request context
      - [ ] Returns 401 on invalid/missing token
```

---

## 4. Workflow YAML Schema

### Grundstruktur

```yaml
# ============================================================================
# METADATEN
# ============================================================================
name: <string>              # Human-readable Name
description: |              # Beschreibung des Workflows
  Mehrzeilige Beschreibung...

# ============================================================================
# PHASEN
# ============================================================================
phases:
  # Simple Phase
  - id: <string>
    prompt: |
      Prompt mit Template-Variablen:
      {{step.prompt}}
      {{step.id}}
      {{step.index}}
      {{phase.id}}
      {{sprint.id}}

  # For-Each Phase (iteriert über Steps)
  - id: <string>
    for-each: step
    workflow: <nested-workflow-reference>

# ============================================================================
# RALPH MODE (Optional)
# ============================================================================
mode: ralph                 # Aktiviert Ralph Mode

goal-prompt: |              # Wie Goal analysiert wird
  ...

reflection-prompt: |        # Wann als complete markiert
  ...

per-iteration-hooks:        # Hooks pro Iteration
  - id: <string>
    workflow: "plugin:name"
    prompt: <string>
    parallel: <boolean>
    enabled: <boolean>
```

### Template-Variablen

| Variable | Verfügbar in | Beschreibung |
|----------|--------------|--------------|
| `{{step.prompt}}` | for-each, nested | Der Step-Prompt |
| `{{step.id}}` | for-each, nested | Die Step-ID |
| `{{step.index}}` | for-each, nested | Step-Index (0-basiert) |
| `{{phase.id}}` | alle Phasen | Die Phase-ID |
| `{{phase.index}}` | alle Phasen | Phase-Index (0-basiert) |
| `{{sprint.id}}` | alle Phasen | Die Sprint-ID |
| `{{sprint.name}}` | alle Phasen | Der Sprint-Name |

---

## 5. Workflow-Beispiele

### Beispiel 1: Minimal Workflow (Direkte Ausführung)

```yaml
# minimal-workflow.yaml
name: Minimal Workflow
description: Direct step execution without sub-phases

phases:
  - id: execute
    for-each: step
    prompt: |
      Execute the following task:

      {{step.prompt}}

      ## Instructions
      - Complete the task fully
      - Make atomic commits
      - Update PROGRESS.yaml when done
```

**Anwendungsfall:** Einfache, unabhängige Tasks ohne QA-Overhead.

### Beispiel 2: Execute with QA (Zwei-Phasen)

```yaml
# execute-with-qa.yaml
name: Execute with QA
description: Two-phase workflow with quality assurance

phases:
  - id: implement
    prompt: |
      Execute the following task:

      {{step.prompt}}

      ## Before Starting
      1. Read context/sprint-plan.md
      2. Understand how this step fits

      ## Guidelines
      - Follow existing patterns
      - Make atomic commits
      - If blocked, set status to needs-human

  - id: qa
    prompt: |
      Quality Assurance for step: {{step.id}}

      ## Context
      Task: {{step.prompt}}

      ## Checks
      1. TypeScript build (if applicable)
      2. Script validation (if applicable)
      3. Integration verification
      4. Smoke test

      ## Generate QA Report
      Write to: artifacts/{{step.id}}-qa-report.md

      ## If FAIL
      Inject fix phases into PROGRESS.yaml using yq
```

**Anwendungsfall:** Tasks, die Verifizierung benötigen, aber kein volles Gherkin-TDD.

### Beispiel 3: Gherkin-Verified Execution (5-Phasen TDD)

```yaml
# gherkin-verified-execution.yaml
name: Gherkin-Verified Execution
description: |
  Comprehensive sprint workflow with binary gherkin scenarios for verification.
  Each step goes through 5 sub-phases: plan → context → execute → qa → verify

phases:
  # ========================================
  # Phase 1: PREFLIGHT (Sprint-Level)
  # ========================================
  - id: preflight
    prompt: |
      Create comprehensive sprint context for ALL subsequent phases.

      ## Step 1: Create Sprint Branch
      git checkout -b sprint/{{sprint.id}}

      ## Step 2: Analyze Sprint Scope
      Read SPRINT.yaml to understand all steps

      ## Step 3: Research Project Context
      - Project architecture
      - Key patterns
      - Build/test commands

      ## Step 4: Generate Shared Context
      Create: context/_shared-context.md

      ## Step 5: Generate Sprint Plan
      Create: context/sprint-plan.md

      ## Step 6: Commit
      git add context/ && git commit -m "preflight: add shared context"

  # ========================================
  # Phase 2: DEVELOPMENT (For-Each Step)
  # ========================================
  - id: development
    for-each: step
    workflow: gherkin-step-workflow   # Nested 5-phase workflow

  # ========================================
  # Phase 3: FINAL-QA (Sprint-Level)
  # ========================================
  - id: final-qa
    prompt: |
      Comprehensive QA for entire sprint.

      ## Checks
      1. npm run build
      2. npm run typecheck
      3. npm run lint
      4. npm test
      5. Integration verification

      ## Generate Report
      Create: artifacts/sprint-qa-report.md

  # ========================================
  # Phase 4: SUMMARY
  # ========================================
  - id: summary
    prompt: |
      Generate sprint summary deliverable.

      ## Collect
      - Commit history: git log main..HEAD
      - File changes: git diff main..HEAD --stat

      ## Generate
      Create: artifacts/sprint-summary.md

  # ========================================
  # Phase 5: PR-CREATE
  # ========================================
  - id: pr-create
    prompt: |
      Push branch and create pull request.

      ## Steps
      1. git push -u origin sprint/{{sprint.id}}
      2. gh pr create --title "Sprint: {{sprint.id}}"
```

### Beispiel 4: Gherkin Step Workflow (Nested)

```yaml
# gherkin-step-workflow.yaml
name: Gherkin Step Workflow
description: |
  Per-step workflow with binary-verifiable gherkin scenarios.
  Each step goes through 5 phases: plan → context → execute → qa → verify

phases:
  # ========================================
  # Sub-Phase 1: PLAN
  # Generate 4-8 gherkin scenarios
  # ========================================
  - id: plan
    prompt: |
      Generate binary-verifiable gherkin scenarios for:

      {{step.prompt}}

      ## Read Context
      - context/_shared-context.md
      - context/sprint-plan.md

      ## Create 4-8 Scenarios
      Each MUST have:
      1. Given/When/Then structure
      2. Verification command (exit 0 = pass)
      3. Binary outcome (1 or 0)

      ## Format
      ```gherkin
      Scenario: [Name]
        Given [precondition]
        When [action]
        Then [outcome]

      Verification: `test -f src/file.ts`
      Pass: Exit code = 0 → Score 1
      Fail: Exit code ≠ 0 → Score 0
      ```

      ## Output
      Create: artifacts/{{step.id}}-gherkin.md
      Commit: "plan({{step.id}}): define gherkin scenarios"

  # ========================================
  # Sub-Phase 2: CONTEXT
  # Gather step-specific patterns
  # ========================================
  - id: context
    prompt: |
      Gather step-specific context for:

      {{step.prompt}}

      ## Research
      1. Related existing code patterns
      2. Required imports (internal/external)
      3. Types/interfaces to implement
      4. Integration points

      ## Output
      Create: context/{{step.id}}-context.md
      Commit: "context({{step.id}}): gather implementation context"

  # ========================================
  # Sub-Phase 3: EXECUTE
  # Implement following gherkin
  # ========================================
  - id: execute
    prompt: |
      Implement the step:

      {{step.prompt}}

      ## MUST READ FIRST
      1. context/_shared-context.md
      2. context/sprint-plan.md
      3. artifacts/{{step.id}}-gherkin.md
      4. context/{{step.id}}-context.md

      ## Rules
      - Implementation MUST satisfy ALL gherkin scenarios
      - Follow patterns from context
      - Make atomic commits

  # ========================================
  # Sub-Phase 4: QA
  # Verify each scenario
  # ========================================
  - id: qa
    prompt: |
      Verify implementation against gherkin scenarios.

      ## Read
      artifacts/{{step.id}}-gherkin.md

      ## For Each Scenario
      1. Run verification command
      2. Record result: 1 (pass) or 0 (fail)

      ## Calculate Score
      Score = passed / total
      - 100% → PASS
      - <100% → FAIL

      ## Generate Report
      Create: artifacts/{{step.id}}-qa-report.md

      ## If ANY FAIL
      Inject fix + reverify phases using yq:
      ```bash
      yq -i '.phases[...].phases += [fix, reverify]' PROGRESS.yaml
      ```

  # ========================================
  # Sub-Phase 5: VERIFY
  # Integration verification
  # ========================================
  - id: verify
    prompt: |
      Final integration verification for:

      {{step.prompt}}

      ## Checks
      1. npm run build
      2. npm run typecheck
      3. Integration (imports, no circular deps)
      4. Smoke test
```

### Beispiel 5: Ralph Mode (Goal-Driven)

```yaml
# ralph.yaml
name: Ralph Mode Workflow
description: Autonomous goal-driven execution

mode: ralph

goal-prompt: |
  Analyze the goal and create initial implementation steps.
  Break down complex goals into concrete, actionable tasks.
  Consider dependencies between tasks.
  Start with investigation/research if problem space is unclear.

reflection-prompt: |
  No pending steps remain. Evaluate:
  1. Is the goal fully achieved?
  2. Are there edge cases or tests missing?
  3. Is documentation complete?
  4. Are there cleanup tasks needed?

  If complete: RALPH_COMPLETE: [summary]
  If not: add more steps to address gaps

per-iteration-hooks:
  - id: learning
    prompt: /m42-signs:extract $ITERATION_TRANSCRIPT
    parallel: true
    enabled: false
```

**Anwendungsfall:** Open-ended Goals ohne vordefinierte Steps.

---

## 6. PROGRESS.yaml Schema

### Struktur nach Compilation

```yaml
# ============================================================================
# SPRINT-IDENTIFIKATION
# ============================================================================
sprint-id: 2026-01-19_user-auth
status: in-progress         # not-started|in-progress|completed|blocked|paused|needs-human
mode: standard              # standard|ralph

# ============================================================================
# HIERARCHISCHE PHASEN-STRUKTUR
# ============================================================================
phases:
  # Top-Level Phase (Preflight)
  - id: preflight
    status: completed
    prompt: |
      Create comprehensive sprint context...
    started-at: 2026-01-19T10:00:00Z
    completed-at: 2026-01-19T10:15:00Z
    elapsed: 15m

  # For-Each Phase mit Steps
  - id: development
    status: in-progress
    steps:
      - id: step-0
        prompt: "GIVEN the project needs..."
        status: in-progress
        phases:
          - id: plan
            status: completed
            prompt: "Generate gherkin scenarios..."
          - id: context
            status: completed
            prompt: "Gather step-specific context..."
          - id: execute
            status: in-progress
            prompt: "Implement the step..."
          - id: qa
            status: pending
            prompt: "Verify against gherkin..."
          - id: verify
            status: pending
            prompt: "Final integration verification..."

      - id: step-1
        prompt: "GIVEN the AuthService is implemented..."
        status: pending
        phases: [...]

# ============================================================================
# EXECUTION POINTER
# ============================================================================
current:
  phase: 1                  # Index der aktuellen Top-Level Phase
  step: 0                   # Index des aktuellen Steps (null wenn keine Steps)
  sub-phase: 2              # Index der aktuellen Sub-Phase (null wenn keine)

# ============================================================================
# STATISTIKEN
# ============================================================================
stats:
  started-at: 2026-01-19T10:00:00Z
  completed-at: null
  total-phases: 5
  completed-phases: 1
  total-steps: 3
  completed-steps: 0
  elapsed: 45m
```

### Status-Übergänge

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │
              ┌───────────┐                                    │
              │not-started│                                    │
              └─────┬─────┘                                    │
                    │ /run-sprint                              │
                    ▼                                          │
              ┌───────────┐        ┌─────────┐                 │
              │in-progress│───────►│ paused  │─────────────────┘
              └─────┬─────┘        └─────────┘
                    │  /pause-sprint    ▲
                    │                   │ /resume-sprint
        ┌───────────┼───────────┬───────┘
        │           │           │
        ▼           ▼           ▼
  ┌───────────┐ ┌───────┐ ┌────────────┐
  │ completed │ │blocked│ │needs-human │
  └───────────┘ └───────┘ └────────────┘
```

---

## 7. Self-Healing: QA-Failure Handling

### Das Problem

Wenn QA fehlschlägt, soll der Sprint nicht einfach blocken, sondern automatisch Fix-Phasen einfügen.

### Die Lösung: Phase Injection

```yaml
# VORHER (QA hat gefailed)
phases:
  - id: development
    steps:
      - id: step-0
        phases:
          - id: execute
            status: completed
          - id: qa
            status: failed    # ← QA gefailed
            error: "Scenario 3 failed: TypeScript build error"

# NACHHER (Fix-Phasen injiziert)
phases:
  - id: development
    steps:
      - id: step-0
        phases:
          - id: execute
            status: completed
          - id: qa
            status: failed
            error: "..."
          - id: fix              # ← Injiziert
            status: pending
            prompt: |
              Fix failing scenarios for step-0.
              Read: artifacts/step-0-qa-report.md
          - id: reverify         # ← Injiziert
            status: pending
            prompt: |
              Re-verify all scenarios after fixes.
```

### yq-Befehl für Injection

```bash
yq -i '
  (.phases[] | select(.steps) | .steps[] | select(.status == "in-progress") | .phases) +=
  [
    {
      "id": "fix",
      "status": "pending",
      "prompt": "Fix the QA issues..."
    },
    {
      "id": "reverify",
      "status": "pending",
      "prompt": "Re-verify all scenarios..."
    }
  ]
' "$PROGRESS_FILE"
```

---

## 8. Sprint Directory Structure

```
.claude/sprints/YYYY-MM-DD_<name>/
├── SPRINT.yaml              # Input (du erstellst)
├── PROGRESS.yaml            # Generated (vom Compiler)
├── PROGRESS.yaml.checksum   # Integrity Check
├── .sprint-hooks.json       # Hook-Konfiguration
├── .sprint-activity.jsonl   # Activity Logs
├── .sprint-status.port      # Status Server Port
├── timing.jsonl             # Timing-Daten
├── context/                 # Input: Research, Notes
│   ├── _shared-context.md   # Shared Context für alle Phasen
│   ├── sprint-plan.md       # Sprint-Plan aus Preflight
│   └── step-0-context.md    # Step-spezifischer Context
├── artifacts/               # Output: Deliverables
│   ├── step-0-gherkin.md    # Gherkin-Szenarien
│   ├── step-0-qa-report.md  # QA-Report
│   ├── sprint-qa-report.md  # Sprint-Level QA
│   └── sprint-summary.md    # Sprint-Zusammenfassung
├── logs/                    # Execution Logs
└── transcripts/             # Claude Interaction Transcripts
```

---

## 9. Verfügbare Commands

| Command | Beschreibung |
|---------|--------------|
| `/start-sprint <name> [--workflow <name>]` | Sprint initialisieren |
| `/run-sprint <dir> [--max-iterations N]` | Sprint ausführen |
| `/sprint-status` | Progress Dashboard anzeigen |
| `/sprint-watch` | Live Dashboard öffnen |
| `/pause-sprint` | Sprint pausieren |
| `/resume-sprint` | Sprint fortsetzen |
| `/stop-sprint` | Sprint stoppen |
| `/add-step <prompt>` | Step hinzufügen |
| `/import-steps issues --label <label>` | GitHub Issues importieren |
| `/help` | Hilfe anzeigen |

---

## 10. Best Practices für Workflow-Design

### 1. Immer Shared Context generieren

```yaml
phases:
  - id: preflight
    prompt: |
      Create context/_shared-context.md with:
      - Project architecture
      - Key patterns
      - Build/test commands
      - Dependencies
```

**Warum:** Jede Phase läuft in frischem Context. Shared Context Files sind die einzige Möglichkeit, Wissen zu teilen.

### 2. Gherkin für verifizierbare Outcomes

```yaml
- id: plan
  prompt: |
    Generate gherkin with explicit verification commands:

    Verification: `test -f src/file.ts`
    Pass: Exit code = 0
```

**Warum:** Binäre Verifikation ermöglicht automatische QA ohne subjektive Beurteilung.

### 3. Self-Healing durch Phase Injection

```yaml
- id: qa
  prompt: |
    If ANY check FAILS:
    Inject fix + reverify phases using yq
```

**Warum:** Sprint blockiert nicht bei Fehlern, sondern heilt sich selbst.

### 4. Atomic Commits pro logische Einheit

```yaml
- id: execute
  prompt: |
    Make atomic commits:
    git commit -m "feat(step-0): implement auth service"
```

**Warum:** Ermöglicht Rollback, Debugging und Code Review.

### 5. Context vor Implementation lesen

```yaml
- id: execute
  prompt: |
    MUST READ BEFORE IMPLEMENTING:
    1. context/_shared-context.md
    2. context/sprint-plan.md
    3. artifacts/{{step.id}}-gherkin.md
    4. context/{{step.id}}-context.md
```

**Warum:** Claude hat keinen Zugriff auf vorherige Phasen - Context muss explizit gelesen werden.

### 6. Klare Status-Updates

```yaml
- id: execute
  prompt: |
    When complete:
    - Update PROGRESS.yaml status to "completed"
    - EXIT immediately - do NOT continue to next task
```

**Warum:** Die Bash-Loop verlässt sich auf Status-Updates um fortzufahren.

---

## 11. Workflow-Auswahl Guide

| Szenario | Empfohlener Workflow |
|----------|---------------------|
| Einfache, unabhängige Tasks | `minimal-workflow` |
| Tasks mit QA-Requirement | `execute-with-qa` |
| Komplexe Features mit TDD | `gherkin-verified-execution` |
| Open-ended Research/Goals | `ralph` |
| Bug Fixes | `bugfix-workflow` |

---

## 12. Fehlerbehandlung

### Error-Klassifizierung

| Error-Typ | Handling |
|-----------|----------|
| Network/Timeout | Retry mit Backoff |
| Rate Limit | Warten und Retry |
| Validation Error | Phase überspringen |
| Logic Error | needs-human Status |

### Retry-Strategie

```bash
# Exponential Backoff
backoff_delay() {
    local retry_count="$1"
    echo $((2 ** retry_count))  # 2, 4, 8, 16, ... Sekunden
}
```

---

## 13. Nützliche yq-Befehle

```bash
# Status lesen
yq -r '.status' PROGRESS.yaml

# Aktuellen Pointer lesen
yq -r '.current.phase' PROGRESS.yaml

# Phase als completed markieren
yq -i '.phases[0].status = "completed"' PROGRESS.yaml

# Pointer weiterbewegen
yq -i '.current.phase = 1' PROGRESS.yaml

# Neue Phase injizieren
yq -i '.phases[0].steps[0].phases += [{"id": "fix", "status": "pending", "prompt": "..."}]' PROGRESS.yaml
```

---

## 14. Zusammenfassung für Deep Research

### Kernprinzipien

1. **Fresh Context pro Phase** - Löst Context-Akkumulation
2. **Explizite State Machine** - PROGRESS.yaml ist Single Source of Truth
3. **Hierarchische Phasen** - Sprint → Step → Sub-Phase
4. **Self-Healing** - QA-Failures triggern automatische Fix-Phasen
5. **Template-Variablen** - `{{step.prompt}}` ermöglicht DRY Workflows

### Workflow-Design-Patterns

| Pattern | Beschreibung |
|---------|--------------|
| **Preflight** | Sprint-Level Context generieren |
| **For-Each** | Workflow auf jeden Step anwenden |
| **Nested Workflow** | Sub-Phasen aus separatem Workflow |
| **Binary Verification** | Exit-Code basierte Verifizierung |
| **Phase Injection** | Dynamisches Einfügen von Fix-Phasen |

### Datei-Referenzen

| Datei | Zweck |
|-------|-------|
| `SPRINT.yaml` | Benutzer-Input |
| `PROGRESS.yaml` | Runtime-State |
| `context/_shared-context.md` | Shared Knowledge |
| `context/sprint-plan.md` | Sprint-Plan |
| `artifacts/*.md` | Deliverables |

---

*Dieses Dokument dient als vollständige Kontextquelle für Deep Research mit Claude, um Development Best-Practices in Workflow-Templates zu kodieren.*
