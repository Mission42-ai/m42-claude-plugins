# Prompt Extraction Concept: Configurable Runtime Prompts

**Date:** 2026-01-19
**Sprint:** unified-sprint-loop
**Status:** Research Complete

## Executive Summary

Die **Runtime-Prompts** aus `build-sprint-prompt.sh` konfigurierbar machen:
- Via `prompts:` Section in SPRINT.yaml
- Mit sinnvollen Defaults
- Ohne die Workflow-Templates zu ändern (die bleiben wie sie sind)

## 1. Aktuelle Hardcoded Prompts in build-sprint-prompt.sh

### Prompt-Bausteine (Zeilen 126-186, 221-276)

| Baustein | Zeilen | Inhalt |
|----------|--------|--------|
| **header** | 126-128 | `# Sprint Workflow Execution\nSprint: $ID \| Iteration: $N` |
| **position** | 130-134 | `## Current Position\n- Phase: X/Y\n- Step: X/Y\n- Sub-Phase: X/Y` |
| **retry-warning** | 138-144 | `## ⚠️ RETRY ATTEMPT N\nPrevious error: ...` |
| **step-context** | 147-150 | `## Step Context\n$STEP_PROMPT` |
| **task** | 152-154 | `## Your Task: $ID\n$PROMPT` |
| **instructions** | 156-160 | `## Instructions\n1. Execute...\n2. Commit...\n3. EXIT immediately` |
| **files** | 162-165 | `## Files\n- Progress: ...\n- Sprint: ...` |
| **result-reporting** | 167-186 | `## Result Reporting\n...JSON format...` |

### Was NICHT extrahiert wird
- **Workflow-Prompts** (in gherkin-step-workflow.yaml) → bleiben dort
- **Phase/Step-Prompts** (in SPRINT.yaml) → User-definiert, bleiben dort

## 2. Konfigurierbare Prompts via SPRINT.yaml

### Schema-Erweiterung
```yaml
# SPRINT.yaml
prompts:
  header: |
    # Sprint: {{sprint-id}}
    Iteration: {{iteration}}

  position: |
    ## Position
    - Phase: **{{phase.id}}** ({{phase.index}}/{{phase.total}})
    - Step: **{{step.id}}** ({{step.index}}/{{step.total}})
    - Sub-Phase: **{{sub-phase.id}}** ({{sub-phase.index}}/{{sub-phase.total}})

  retry-warning: |
    ## ⚠️ Retry {{retry-count}}
    Previous error: {{error}}

  instructions: |
    ## Instructions
    1. Execute this task
    2. Commit changes
    3. **EXIT immediately** - do NOT continue

  result-reporting: |
    ## Result Reporting
    Report as JSON:
    \`\`\`json
    {"status": "completed|failed|needs-human", "summary": "..."}
    \`\`\`
```

### Defaults (wenn nicht spezifiziert)
Die aktuellen Prompts aus `build-sprint-prompt.sh` werden als Defaults verwendet.

### Variable Substitution
| Variable | Beschreibung |
|----------|--------------|
| `{{sprint-id}}` | Sprint ID aus PROGRESS.yaml |
| `{{iteration}}` | Aktuelle Iteration |
| `{{phase.id}}` | Phase ID |
| `{{phase.index}}` | Phase Index (1-based) |
| `{{phase.total}}` | Anzahl Phases |
| `{{step.id}}` | Step ID |
| `{{step.index}}` | Step Index (1-based) |
| `{{step.total}}` | Anzahl Steps |
| `{{step.prompt}}` | Step Prompt aus SPRINT.yaml |
| `{{sub-phase.id}}` | Sub-Phase ID |
| `{{sub-phase.prompt}}` | Sub-Phase Prompt aus Workflow |
| `{{retry-count}}` | Retry-Zähler |
| `{{error}}` | Letzte Fehlermeldung |

## 3. Workflow-Templates (unverändert kopierbar)

Die bestehenden Workflow-Dateien bleiben wie sie sind:

### Template 1: `gherkin-step-workflow.yaml`
- Bereits vorhanden in `.claude/workflows/`
- 5 Phasen: plan → context → execute → qa → verify
- Prompts sind spezifisch für Gherkin-Ansatz
- **Kopierbar ohne Änderungen**

### Template 2: `minimal-workflow.yaml` (NEU)
```yaml
name: Minimal Workflow
description: Direct step execution without sub-phases

phases:
  - id: execute
    for-each: step
    prompt: |
      {{step.prompt}}
```

### Template 3: `orchestrated-workflow.yaml` (NEU)
```yaml
name: Orchestrated Workflow
description: Dynamic step injection based on discoveries

orchestration:
  enabled: true
  insert-strategy: after-current

phases:
  - id: execute
    for-each: step
    prompt: |
      {{step.prompt}}

      ## Optional: Neue Erkenntnisse
      Falls du neue Aufgaben entdeckst, gib sie als proposedSteps an:
      \`\`\`json
      {"proposedSteps": [{"prompt": "...", "reasoning": "...", "priority": "medium"}]}
      \`\`\`
```

## 4. Implementierung

### build-sprint-prompt.sh Änderungen

```bash
# Lade custom prompts aus SPRINT.yaml (oder nutze defaults)
load_prompt_template() {
  local key="$1"
  local default="$2"
  local custom=$(yq -r ".prompts.$key // \"null\"" "$SPRINT_DIR/SPRINT.yaml")
  if [[ "$custom" != "null" ]]; then
    echo "$custom"
  else
    echo "$default"
  fi
}

# Substituiere Variablen
substitute_variables() {
  local template="$1"
  echo "$template" \
    | sed "s/{{sprint-id}}/$SPRINT_ID/g" \
    | sed "s/{{iteration}}/$ITERATION/g" \
    | sed "s/{{phase.id}}/$PHASE_ID/g" \
    # ... etc
}

# Verwende Templates
HEADER_TPL=$(load_prompt_template "header" "$DEFAULT_HEADER")
HEADER=$(substitute_variables "$HEADER_TPL")
```

### TypeScript Schema (types.ts)

```typescript
interface SprintPrompts {
  header?: string;
  position?: string;
  'retry-warning'?: string;
  instructions?: string;
  'result-reporting'?: string;
}

interface SprintDefinition {
  // ... existing fields
  prompts?: SprintPrompts;
}
```

## 5. Customization Flow

### Für User: Workflow kopieren
```bash
# Gherkin-Workflow ins Projekt kopieren
cp .claude/workflows/gherkin-step-workflow.yaml \
   .claude/workflows/my-workflow.yaml

# In SPRINT.yaml referenzieren
# workflow: my-workflow
```

### Für User: Runtime-Prompts anpassen
```yaml
# In SPRINT.yaml
prompts:
  instructions: |
    ## Anweisungen
    1. Führe die Aufgabe aus
    2. Committe Änderungen mit deutschem Commit-Message
    3. Beende sofort nach Abschluss
```

### Für User: Komplett eigener Workflow
Eigene Workflow-YAML erstellen mit eigenen Phase-Prompts.

## 6. Benefits

| Aspekt | Vorher | Nachher |
|--------|--------|---------|
| Runtime-Prompts | Hardcoded in Bash | Via SPRINT.yaml konfigurierbar |
| Workflow-Templates | Manuell kopieren | Kopieren + in SPRINT.yaml referenzieren |
| Anpassbarkeit | Script editieren | YAML editieren |
| Defaults | Keine | Sinnvolle Defaults aus Script |

## 7. Was NICHT geändert wird

- **Workflow-Prompts bleiben in Workflow-Files** (gherkin-step-workflow.yaml etc.)
- **Claude löst Commands automatisch auf** - keine extra Implementierung
- **Keine neuen Commands nötig** für Basis-Funktionalität
- **Bestehende Sprints laufen weiter** (backward compatible)
