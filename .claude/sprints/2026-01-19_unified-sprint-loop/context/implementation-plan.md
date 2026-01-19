# Unified Sprint Loop: Dynamic Step Injection

## Vision

Verschmelzung von Standard Mode und Ralph Mode zu einem **Unified Loop** mit optionaler **dynamischer Step-Injection**. Claude kann in jedem Step neue Aufgaben vorschlagen, die von einer Orchestration-Iteration analysiert und eingefügt werden.

```
[Step ausführen] → [proposedSteps in Output?] → [Orchestration-Iteration] → [Steps einfügen] → [Weiter]
```

## Architektur-Änderungen

### 1. SPRINT.yaml Schema erweitern

**Datei**: `plugins/m42-sprint/compiler/src/types.ts`

```yaml
# Neue Felder in SPRINT.yaml
orchestration:
  enabled: true                    # Aktiviert dynamische Step-Injection
  prompt: |                        # Custom Orchestration-Prompt
    Analysiere die vorgeschlagenen Steps und entscheide:
    - Wo im Workflow sie eingefügt werden sollen
    - Ob sie relevant sind oder verworfen werden
    - Welche Priorität sie haben
  insert-strategy: after-current   # after-current | end-of-phase | custom
  auto-approve: false              # true = Steps werden direkt eingefügt ohne Orchestration
```

### 2. PROGRESS.yaml Schema erweitern

**Datei**: `plugins/m42-sprint/compiler/src/types.ts`

```yaml
# Neue Felder in PROGRESS.yaml
step-queue:                        # Vorgeschlagene Steps warten auf Orchestration
  - id: "proposed-1"
    prompt: "Implement caching layer"
    proposed-by: "develop-step-2"  # Welcher Step hat das vorgeschlagen
    proposed-at: "2026-01-19T..."
    reasoning: "Performance bottleneck entdeckt"
    priority: medium               # low | medium | high | critical

orchestration:
  last-run-at: "2026-01-19T..."
  total-injected: 5
  total-rejected: 2
```

### 3. JSON Result Schema erweitern

**Dateien**:
- `plugins/m42-sprint/scripts/build-sprint-prompt.sh`
- `plugins/m42-sprint/scripts/build-ralph-prompt.sh` (wird obsolet/merged)

```json
{
  "status": "completed",
  "summary": "Feature implemented successfully",

  "proposedSteps": [
    {
      "prompt": "Add error handling for edge case X",
      "reasoning": "Discovered during implementation",
      "priority": "medium",
      "insertAfter": "current"
    }
  ]
}
```

### 4. Sprint Loop Refactoring

**Datei**: `plugins/m42-sprint/scripts/sprint-loop.sh`

#### Änderungen:

1. **Mode-Unterscheidung entfernen** (Zeilen 2106-2112)
   - Kein `case "$SPRINT_MODE"` mehr
   - Ein unified `run_loop()` statt `run_standard_loop()` / `run_ralph_loop()`

2. **Nach jeder Iteration: Queue prüfen** (neue Funktion)
   ```bash
   process_proposed_steps() {
     local transcript_file="$1"

     # Extract proposedSteps from JSON result
     local proposed=$(extract_json_result "$transcript_file" | jq -c '.proposedSteps // []')

     if [[ "$proposed" != "[]" ]]; then
       # Add to step-queue in PROGRESS.yaml
       add_to_step_queue "$proposed" "$current_step_id"

       # Check if orchestration should run
       if should_run_orchestration; then
         run_orchestration_iteration
       fi
     fi
   }
   ```

3. **Orchestration-Iteration** (neue Funktion)
   ```bash
   run_orchestration_iteration() {
     # Build orchestration prompt from SPRINT.yaml config
     local orch_prompt=$(build_orchestration_prompt)

     # Execute Claude with orchestration prompt
     claude -p "$orch_prompt" --dangerously-skip-permissions ...

     # Parse result and insert approved steps into phases
     process_orchestration_result "$transcript"
   }
   ```

4. **Step-Insertion Logic** (neue Funktion)
   ```bash
   insert_step_at_position() {
     local step_data="$1"
     local target_phase="$2"
     local target_step="$3"
     local position="$4"  # after | before | end

     # Use yq to insert step into phases hierarchy
     yq -i "..." "$PROGRESS_FILE"
   }
   ```

### 5. Prompt Templates anpassen

**Datei**: `plugins/m42-sprint/scripts/build-sprint-prompt.sh`

Jeder Step-Prompt bekommt am Ende:

```markdown
## Optional: Neue Erkenntnisse

Falls du während der Arbeit neue Aufgaben entdeckst die nicht Teil
dieses Steps sind, gib sie im JSON Output als `proposedSteps` an:

\`\`\`json
{
  "status": "completed",
  "summary": "...",
  "proposedSteps": [
    {"prompt": "...", "reasoning": "...", "priority": "medium"}
  ]
}
\`\`\`
```

### 6. Orchestration Prompt Template

**Neue Datei**: `plugins/m42-sprint/scripts/build-orchestration-prompt.sh`

```bash
#!/bin/bash
# Builds the orchestration prompt for step-queue processing

build_orchestration_prompt() {
  local sprint_dir="$1"

  # Read step-queue from PROGRESS.yaml
  local queue=$(yq -r '.step-queue' "$PROGRESS_FILE")

  # Read custom orchestration prompt from SPRINT.yaml (or use default)
  local custom_prompt=$(yq -r '.orchestration.prompt // ""' "$SPRINT_YAML")

  cat << EOF
# Orchestration: Step Queue Processing

Du bist der Orchestrator für diesen Sprint. Analysiere die vorgeschlagenen
Steps und entscheide, wie sie in den Workflow integriert werden.

## Aktueller Sprint-Status
$(yq -r '.' "$PROGRESS_FILE" | head -50)

## Step Queue (zu verarbeiten)
$queue

## Deine Aufgabe
$custom_prompt

## Output Format
\`\`\`json
{
  "decisions": [
    {
      "proposedId": "proposed-1",
      "action": "insert",           // insert | reject | defer
      "insertAt": {
        "phase": 1,
        "step": 2,
        "position": "after"
      },
      "reasoning": "..."
    }
  ]
}
\`\`\`
EOF
}
```

## Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `compiler/src/types.ts` | Schema für orchestration, step-queue |
| `compiler/src/compile.ts` | Orchestration-Config kompilieren |
| `scripts/sprint-loop.sh` | Unified loop, proposedSteps processing, orchestration |
| `scripts/build-sprint-prompt.sh` | proposedSteps Anleitung in Prompts |
| `scripts/build-orchestration-prompt.sh` | **NEU** - Orchestration prompt builder |
| `scripts/build-ralph-prompt.sh` | Deprecation oder Merge |
| `skills/creating-sprints/references/sprint-schema.md` | Doku Update |

## Migration

1. **Bestehende Standard-Sprints**: Funktionieren weiter (orchestration: enabled: false default)
2. **Bestehende Ralph-Sprints**: Brauchen Migration zu neuem Format
3. **Backward Compatibility**: `mode: ralph` wird zu `orchestration: enabled: true` + dynamic initial steps

## Implementierungs-Reihenfolge

1. **Schema erweitern** (types.ts) - Grundlage für alles
2. **Compiler anpassen** (compile.ts) - Orchestration-Config verarbeiten
3. **Result Processing** (sprint-loop.sh) - proposedSteps extrahieren
4. **Step Queue Logic** (sprint-loop.sh) - Queue management
5. **Orchestration Iteration** (neue Funktion + Prompt Builder)
6. **Step Insertion** (PROGRESS.yaml manipulation)
7. **Prompt Templates** (proposedSteps Anleitung)
8. **Tests & Doku**

## Verifikation

1. Standard-Sprint ohne orchestration läuft wie bisher
2. Sprint mit `orchestration: enabled: true`:
   - Step schlägt neuen Step vor
   - Step erscheint in step-queue
   - Orchestration-Iteration läuft
   - Step wird an richtiger Stelle eingefügt
3. Custom orchestration-prompt wird verwendet
4. `auto-approve: true` fügt Steps direkt ein (kein Orchestration call)

## Entscheidungen

1. **Orchestration läuft automatisch** wenn `proposedSteps` im JSON-Result vorhanden sind
2. **Ralph Mode wird komplett entfernt** - clean break

## Aufräumen (Ralph Mode Entfernung)

| Datei | Aktion |
|-------|--------|
| `scripts/sprint-loop.sh` | `run_ralph_loop()` entfernen, Mode-Dispatch entfernen |
| `scripts/build-ralph-prompt.sh` | Löschen |
| `compiler/src/compile.ts` | `compileRalphMode()` entfernen |
| `compiler/src/types.ts` | Ralph-spezifische Felder entfernen |
| `.claude/workflows/ralph.yaml` | Löschen |
| `.claude/workflows/ralph-with-bookends.yaml` | Löschen |
| Dokumentation | Ralph-Referenzen entfernen |
