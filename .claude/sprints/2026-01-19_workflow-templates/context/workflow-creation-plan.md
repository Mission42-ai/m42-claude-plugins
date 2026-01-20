# Plan: Basic Workflow Templates aus Deep Research

## Ziel
Erstellen von **einfachen, wiederverwendbaren** Workflow-Templates basierend auf dem Deep Research zu AI-native Development Workflows.

## Key Insights aus dem Research

Das Research identifiziert drei Säulen:
1. **Binary Verification** - Exit Code 0/non-0 für autonome Iteration
2. **Fresh Context** - YAML-Artifacts für Handoffs (Ralph Loop)
3. **Encoded Architecture** - Machine-readable Guardrails

## Vorgeschlagene Basic Workflows

### 1. `tdd-workflow.yaml` - Test-Driven Development
**Inspiration:** Research Section "TDD workflow adapted for AI agents"

```
Phasen: write-test → verify-fails → implement → verify-passes → refactor
```

- Einfacher Red-Green-Refactor Zyklus
- Binäre Verifikation: Test muss erst FAIL, dann PASS
- Atomic Commits pro Zyklus

### 2. `verify-first-workflow.yaml` - Verification Pipeline
**Inspiration:** Research Section "Multi-stage verification creates defense in depth"

```
Phasen: verify-baseline → implement → verify-after
```

- Baseline-Check vor Änderungen (lint, typecheck, tests)
- Implementation
- Gleiche Checks danach → Regression-Detection

### 3. `explore-then-implement.yaml` - Research-First
**Inspiration:** Research Section "Context files structure AI agent behavior"

```
Phasen: explore → document-findings → implement → verify
```

- Erst Codebase erkunden
- Findings in context/ dokumentieren
- Dann implementieren mit vollem Kontext

### 4. `commit-per-phase.yaml` - Atomic Commits
**Inspiration:** Research Section "Atomic commits with phase traceability"

```
Phasen: implement → verify → commit
```

- Jeder Step = 1 atomarer Commit
- Commit-Message mit Phase-ID
- Verification vor Commit obligatorisch

### 5. `self-healing-qa.yaml` - Self-Healing Pattern
**Inspiration:** Research Section "Self-healing through dynamic phase injection"

```
Phasen: implement → qa → (auto-inject: fix → re-verify bei Failure)
```

- Vereinfachte Version des bestehenden execute-with-qa
- Generischer (nicht m42-sprint-spezifisch)
- Klare yq-Injection-Patterns

## Workflow-Komplexitätsstufen

| Level | Workflow | Phasen | Use Case |
|-------|----------|--------|----------|
| 1 | flat-foreach | 1 | Einfache unabhängige Tasks |
| 2 | verify-first | 3 | Tasks mit Regression-Risiko |
| 3 | tdd | 5 | Neue Features mit Tests |
| 4 | explore-then-implement | 4 | Unbekannte Codebase-Bereiche |
| 5 | self-healing-qa | 2+ | Komplexe Tasks mit Auto-Fix |

## Dateien zu erstellen

```
.claude/workflows/
├── tdd-workflow.yaml           # NEU
├── verify-first-workflow.yaml  # NEU
├── explore-then-implement.yaml # NEU
├── commit-per-phase.yaml       # NEU
└── self-healing-qa.yaml        # NEU (generische Version)
```

## Entscheidungen

- **Scope:** Alle 5 Workflows
- **Prompt-Style:** Minimal - kurze, fokussierte Prompts

## Template-Struktur (Minimal Style)

### Beispiel: tdd-workflow.yaml

```yaml
name: TDD Workflow
description: Red-Green-Refactor cycle for test-driven development

phases:
  - id: write-test
    prompt: |
      Write a failing test for: {{step.prompt}}
      Run tests to confirm failure (exit code ≠ 0).

  - id: implement
    prompt: |
      Implement minimum code to pass the test.
      Only what's needed - no extras.

  - id: verify
    prompt: |
      Run tests. Must pass (exit code = 0).
      If failing, fix and re-run.

  - id: refactor
    prompt: |
      Refactor while keeping tests green.
      Commit: "feat({{step.id}}): [description]"
```

### Beispiel: verify-first-workflow.yaml

```yaml
name: Verify First
description: Check baseline, implement, verify no regressions

phases:
  - id: baseline
    prompt: |
      Run verification checks (lint, typecheck, test).
      Document current state in artifacts/{{step.id}}-baseline.md

  - id: implement
    prompt: |
      {{step.prompt}}
      Make atomic commits.

  - id: verify
    prompt: |
      Re-run same checks as baseline.
      Compare results - no regressions allowed.
```

## Verification

Nach Erstellung:
1. YAML-Syntax validieren: `yq '.' workflow.yaml`
2. Template-Variablen prüfen: `{{step.prompt}}`, `{{step.id}}`
3. Dry-Run mit Test-Sprint

## Nicht im Scope

- Komplexe State-Machine-Workflows (XState)
- Contract Testing Workflows (Pact.js)
- Mutation Testing Integration
- Property-Based Testing Workflows

Diese können später als "Advanced Workflows" hinzugefügt werden.
