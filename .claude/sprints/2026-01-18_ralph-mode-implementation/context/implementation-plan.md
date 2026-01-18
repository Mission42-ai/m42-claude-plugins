# Ralph Mode Implementation Plan (Hybrid Workflow)

## Ziel
Erweiterung des m42-sprint Moduls um einen autonomen "Ralph Mode" als **Workflow-Definition** mit:
- **Freier Loop**: Claude erkundet autonom und entscheidet selbst
- **Deterministische Hooks**: Pro Iteration konfigurierbare parallele Tasks

## Architektur-Diagramm

```
┌──────────────────────────────────────────────────────────────┐
│                      RALPH LOOP                               │
│                    (Endlosschleife)                           │
└──────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  FREI (Claude)  │ │ DETERMINISTISCH │ │ DETERMINISTISCH │
│                 │ │   (Hook 1)      │ │   (Hook 2)      │
│ - Analysiert    │ │                 │ │                 │
│ - Plant Steps   │ │ - Learning      │ │ - Documentation │
│ - Führt aus     │ │ - parallel: ✓   │ │ - parallel: ✓   │
│ - Reflektiert   │ │                 │ │                 │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         │              (non-blocking)      (non-blocking)
         │                   │                   │
         ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    PROGRESS.yaml                              │
│  - dynamic-steps[] (von Claude)                               │
│  - hook-tasks[] (deterministisch)                             │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │    RALPH_COMPLETE?     │
              │                        │
              │  Ja → Exit             │
              │  Nein → Nächste Iter.  │
              └────────────────────────┘
```

## Kernkonzept

```yaml
# .claude/workflows/ralph.yaml
name: Ralph Mode
mode: ralph                    # NEU: Aktiviert Ralph-Verhalten

goal-prompt: |                 # NEU: Initiale Goal-Analyse
  Analyze the goal and create initial steps...

reflection-prompt: |           # NEU: Reflection wenn keine Steps
  No pending steps. Reflect and either RALPH_COMPLETE or add steps...

# NEU: Deterministische parallele Tasks pro Iteration
per-iteration-hooks:
  - id: learning
    workflow: m42-signs:learning-extraction  # Referenz auf externes Plugin
    parallel: true
    enabled: true
  - id: documentation
    workflow: doc-update
    parallel: true
    enabled: false                            # Optional aktivierbar
  - id: custom
    prompt: "Custom per-iteration task..."    # Inline prompt statt workflow
    parallel: true
    enabled: false
```

```yaml
# SPRINT.yaml
workflow: ralph
goal: |
  Build authentication system with JWT tokens

# Optional: Override per-iteration hooks
per-iteration-hooks:
  learning:
    enabled: true
  documentation:
    enabled: true
```

## Änderungen am Workflow-System

### 1. Workflow-Schema erweitern

In `compiler/src/types.ts`:

```typescript
interface PerIterationHook {
  id: string;
  workflow?: string;       // Referenz auf Workflow (z.B. "m42-signs:learning-extraction")
  prompt?: string;         // ODER inline prompt
  parallel: boolean;       // true = non-blocking
  enabled: boolean;        // Default-Status
}

interface Workflow {
  name: string;
  description?: string;
  phases?: Phase[];        // Optional bei ralph mode

  // NEU: Ralph Mode
  mode?: 'standard' | 'ralph';
  "goal-prompt"?: string;
  "reflection-prompt"?: string;
  "per-iteration-hooks"?: PerIterationHook[];
}
```

### 2. PROGRESS.yaml Schema erweitern

```yaml
# Generiert wenn mode: ralph
mode: ralph
goal: |
  Build authentication system with JWT tokens

ralph:
  idle-threshold: 3           # Iterationen ohne Progress → Reflection

# Deterministische Hooks (aus Workflow + SPRINT.yaml merged)
per-iteration-hooks:
  - id: learning
    workflow: "m42-signs:learning-extraction"
    parallel: true
    enabled: true
  - id: documentation
    workflow: "doc-update"
    parallel: true
    enabled: true

# Dynamische Steps (von Claude generiert)
dynamic-steps:
  - id: step-0
    prompt: "Initialize auth module structure"
    status: completed
    added-at: "2026-01-18T10:00:00Z"
    added-in-iteration: 1
  - id: step-1
    prompt: "Implement JWT token generation"
    status: pending
    added-at: "2026-01-18T10:05:00Z"
    added-in-iteration: 1

# Parallel Hook Tasks (pro Iteration)
hook-tasks:
  - iteration: 1
    hook-id: learning
    status: completed
    pid: null
    transcript: transcripts/iter-1-learning.jsonl
  - iteration: 1
    hook-id: documentation
    status: completed
    pid: null
  - iteration: 2
    hook-id: learning
    status: in-progress
    pid: 12345

# Exit-Tracking
ralph-exit:
  detected-at: null
  iteration: null
  final-summary: null
```

## Änderungen an sprint-loop.sh

### Ralph Mode Detection

```bash
# Am Anfang der Loop
MODE=$(yq -r '.mode // "standard"' "$PROGRESS_FILE")

if [[ "$MODE" == "ralph" ]]; then
  run_ralph_loop
else
  run_standard_loop  # Bestehende Logik
fi
```

### Ralph Loop Funktion

```bash
run_ralph_loop() {
  local iteration=0
  local idle_count=0
  local IDLE_THRESHOLD=$(yq -r '.ralph."idle-threshold" // 3' "$PROGRESS_FILE")

  while true; do
    iteration=$((iteration + 1))

    # 1. Bestimme Modus basierend auf pending Steps
    local PENDING_COUNT=$(yq '[.dynamic-steps[] | select(.status == "pending")] | length' "$PROGRESS_FILE")

    if [[ $PENDING_COUNT -eq 0 ]]; then
      idle_count=$((idle_count + 1))
      if [[ $idle_count -ge $IDLE_THRESHOLD ]]; then
        MODE="reflecting"
      else
        MODE="planning"
      fi
    else
      MODE="executing"
      idle_count=0
    fi

    # 2. Baue Prompt (FREIER Teil - Claude entscheidet)
    PROMPT=$("$SCRIPT_DIR/build-ralph-prompt.sh" "$SPRINT_DIR" "$MODE" "$iteration")

    # 3. Spawn per-iteration hooks (DETERMINISTISCHER Teil)
    spawn_per_iteration_hooks "$iteration"

    # 4. Führe Haupt-Iteration aus
    OUTPUT=$(claude -p "$PROMPT" --dangerously-skip-permissions --output-format stream-json \
      2>&1 | tee "$SPRINT_DIR/transcripts/iteration-$iteration.jsonl")

    # 5. Prüfe auf RALPH_COMPLETE
    if echo "$OUTPUT" | grep -qE "RALPH_COMPLETE:"; then
      SUMMARY=$(echo "$OUTPUT" | grep -oP "RALPH_COMPLETE:\s*\K.*")
      record_ralph_completion "$iteration" "$SUMMARY"
      wait  # Warte auf alle parallelen hooks
      exit 0
    fi

    # 6. Update Iteration Counter
    yq -i ".stats.\"current-iteration\" = $iteration" "$PROGRESS_FILE"
  done
}
```

### Per-Iteration Hooks (Deterministisch)

```bash
spawn_per_iteration_hooks() {
  local iteration=$1

  # Lese enabled hooks aus PROGRESS.yaml
  local HOOKS=$(yq -r '.per-iteration-hooks[] | select(.enabled == true) | @json' "$PROGRESS_FILE")

  echo "$HOOKS" | while read -r hook_json; do
    local hook_id=$(echo "$hook_json" | jq -r '.id')
    local workflow=$(echo "$hook_json" | jq -r '.workflow // empty')
    local prompt=$(echo "$hook_json" | jq -r '.prompt // empty')
    local parallel=$(echo "$hook_json" | jq -r '.parallel')

    # Registriere Task
    yq -i ".hook-tasks += [{\"iteration\": $iteration, \"hook-id\": \"$hook_id\", \"status\": \"in-progress\", \"pid\": $$}]" "$PROGRESS_FILE"

    # Baue Hook-Prompt
    local HOOK_PROMPT=""
    if [[ -n "$workflow" ]]; then
      # Workflow-Referenz (z.B. "m42-signs:learning-extraction")
      HOOK_PROMPT="/$workflow $SPRINT_DIR/transcripts/iteration-$iteration.jsonl"
    elif [[ -n "$prompt" ]]; then
      # Inline Prompt
      HOOK_PROMPT="$prompt"
    fi

    if [[ "$parallel" == "true" ]]; then
      # Non-blocking: spawn in background
      (
        claude -p "$HOOK_PROMPT" --dangerously-skip-permissions > /dev/null 2>&1
        yq -i "(.hook-tasks[] | select(.iteration == $iteration and .\"hook-id\" == \"$hook_id\")).status = \"completed\"" "$PROGRESS_FILE"
      ) &
    else
      # Blocking: warte auf Completion
      claude -p "$HOOK_PROMPT" --dangerously-skip-permissions > /dev/null 2>&1
      yq -i "(.hook-tasks[] | select(.iteration == $iteration and .\"hook-id\" == \"$hook_id\")).status = \"completed\"" "$PROGRESS_FILE"
    fi
  done
}
```

## Neues Script: build-ralph-prompt.sh

```bash
#!/bin/bash
# Build prompt for Ralph Mode iterations

SPRINT_DIR="$1"
MODE="$2"
ITERATION="$3"

PROGRESS_FILE="$SPRINT_DIR/PROGRESS.yaml"
GOAL=$(yq -r '.goal' "$PROGRESS_FILE")

case "$MODE" in
  planning)
    # Erste Iteration oder nach Reflection
    cat <<EOF
# Ralph Mode: Goal Analysis

## Your Goal
$GOAL

## Instructions
1. Analyze the goal and break it into concrete steps
2. Add steps to PROGRESS.yaml:
   \`\`\`bash
   yq -i '.dynamic-steps += [{"id": "step-N", "prompt": "...", "status": "pending", "added-at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)", "added-in-iteration": $ITERATION}]' "$PROGRESS_FILE"
   \`\`\`
3. Then execute the first pending step

## Completion
When goal is FULLY achieved: RALPH_COMPLETE: [summary]
EOF
    ;;

  executing)
    # Nächsten pending Step ausführen
    STEP_ID=$(yq -r '[.dynamic-steps[] | select(.status == "pending")][0].id' "$PROGRESS_FILE")
    STEP_PROMPT=$(yq -r "[.dynamic-steps[] | select(.id == \"$STEP_ID\")].prompt" "$PROGRESS_FILE")

    cat <<EOF
# Ralph Mode: Execute Step

## Goal (context)
$GOAL

## Current Task: $STEP_ID
$STEP_PROMPT

## Instructions
1. Execute this task
2. Mark complete:
   \`\`\`bash
   yq -i '(.dynamic-steps[] | select(.id == "$STEP_ID")).status = "completed"' "$PROGRESS_FILE"
   \`\`\`
3. Optionally add new steps if needed
4. EXIT after this task

## Completion
If this completes the entire goal: RALPH_COMPLETE: [summary]
EOF
    ;;

  reflecting)
    # Keine pending Steps mehr
    COMPLETED=$(yq -r '[.dynamic-steps[] | select(.status == "completed")] | length' "$PROGRESS_FILE")

    cat <<EOF
# Ralph Mode: Reflection Required

## Goal
$GOAL

## Completed: $COMPLETED steps
No pending steps remain.

## Choose:
A) Goal achieved → RALPH_COMPLETE: [detailed summary]
B) More work needed → add new steps
C) Blocked → yq -i '.status = "needs-human"' "$PROGRESS_FILE"
EOF
    ;;
esac
```

## Workflow-Datei erstellen

```yaml
# .claude/workflows/ralph.yaml
name: Ralph Mode Workflow
description: Autonomous goal-driven execution with configurable per-iteration hooks

mode: ralph

goal-prompt: |
  Analyze the goal and create initial implementation steps.
  Break down complex goals into concrete, actionable tasks.

reflection-prompt: |
  No pending steps remain. Evaluate:
  1. Is the goal fully achieved?
  2. Are there edge cases or tests missing?
  3. Is documentation complete?

  If complete: RALPH_COMPLETE: [summary]
  If not: add more steps

# Deterministische Hooks - werden pro Iteration ausgeführt
per-iteration-hooks:
  - id: learning
    workflow: "m42-signs:learning-extraction"   # Externes Plugin
    parallel: true                               # Non-blocking
    enabled: false                               # Default aus, per SPRINT.yaml aktivierbar

  - id: documentation
    prompt: |
      Review changes from this iteration and update relevant documentation.
      Focus on API changes, new features, and breaking changes.
    parallel: true
    enabled: false

  - id: tests
    prompt: |
      Analyze code changes and suggest additional test cases.
    parallel: true
    enabled: false
```

## Beispiel SPRINT.yaml

```yaml
# SPRINT.yaml für Ralph Mode
workflow: ralph
goal: |
  Build a complete authentication system with JWT tokens.
  Include registration, login, token refresh, and logout.

# Override per-iteration hooks
per-iteration-hooks:
  learning:
    enabled: true      # Aktiviere learning für diesen Sprint
  documentation:
    enabled: true      # Aktiviere auch documentation updates
```

## Implementierungsreihenfolge

1. **types.ts** - Workflow-Schema um `mode`, `goal-prompt`, `reflection-prompt`, `learning` erweitern
2. **compile.ts** - Ralph Mode Detection und PROGRESS.yaml Generierung
3. **sprint-loop.sh** - `run_ralph_loop()` Funktion hinzufügen
4. **build-ralph-prompt.sh** - Neues Script erstellen
5. **ralph.yaml** - Workflow-Datei erstellen
6. Dokumentation aktualisieren

## Verifikation

```bash
# Test mit einfachem Ziel + aktivierten Hooks
mkdir -p .claude/sprints/test-ralph
cat > .claude/sprints/test-ralph/SPRINT.yaml << 'EOF'
workflow: ralph
goal: |
  Create a hello world TypeScript function with tests

per-iteration-hooks:
  learning:
    enabled: true
EOF

# Kompilieren
node plugins/m42-sprint/compiler/dist/index.js .claude/sprints/test-ralph

# Starten
/run-sprint .claude/sprints/test-ralph
```

Prüfen:
- [ ] Loop startet und erkennt `mode: ralph`
- [ ] Claude fügt Steps zu `dynamic-steps[]` hinzu (FREIER Teil)
- [ ] Per-iteration hooks werden parallel gespawned (DETERMINISTISCHER Teil)
- [ ] Hook-tasks werden in `hook-tasks[]` registriert
- [ ] Reflection triggert wenn keine pending Steps
- [ ] RALPH_COMPLETE wird erkannt und Loop endet
- [ ] Alle parallelen hooks completen bevor Exit

## Hook-Referenzen

Per-iteration hooks können auf verschiedene Arten definiert werden:

1. **Externes Plugin**: `workflow: "m42-signs:learning-extraction"`
   - Führt `/m42-signs:learning-extraction` Command aus
   - Transcript-Pfad wird automatisch als Argument übergeben

2. **Lokaler Workflow**: `workflow: "doc-update"`
   - Referenziert `.claude/workflows/doc-update.yaml`

3. **Inline Prompt**: `prompt: "..."`
   - Direkte Prompt-Anweisungen

## Kritische Dateien

| Datei | Aktion |
|-------|--------|
| `compiler/src/types.ts` | Schema erweitern (PerIterationHook, Workflow) |
| `compiler/src/compile.ts` | Ralph Mode Detection + Hook Merging |
| `scripts/sprint-loop.sh` | `run_ralph_loop()` + `spawn_per_iteration_hooks()` |
| `scripts/build-ralph-prompt.sh` | NEU erstellen |
| `.claude/workflows/ralph.yaml` | NEU erstellen |
| `docs/concepts/ralph-mode.md` | NEU: Dokumentation |
