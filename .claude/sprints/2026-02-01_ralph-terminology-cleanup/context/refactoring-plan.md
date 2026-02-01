# Plan: Vereinfachung Sprint-System (YAGNI)

## Kernentscheidung

**Es gibt nur noch EINEN Modus.** Die Unterscheidung zwischen "Ralph Mode" und "Workflow Mode" wird entfernt.

- **Kein `--ralph` Flag mehr**
- **Kein `mode: ralph` vs `mode: standard`**
- **Nur workflow-basierte Sprints mit `collections:`**

Das "Fresh Context Loop" Konzept (jede Phase startet mit frischem Claude-Kontext) bleibt als Implementierungsdetail erhalten, braucht aber keinen eigenen Namen mehr.

---

## Phase 1: Schema-Fix (`steps:` → `collections:`)

**Kritisch - sollte sofort gefixt werden**

| Datei | Änderung |
|-------|----------|
| `commands/start-sprint.md` | Zeile 238, 265: `steps:` → `collections:` |
| `commands/add-step.md` | Zeilen 19, 32, 40, 44: "steps" → "collections.step" |
| `commands/import-steps.md` | Zeilen 24, 47, 61-67, 72, 121: "steps" → "collections.step" |

---

## Phase 2: Commands vereinfachen

### `commands/init-sprint.md`
- **Entfernen**: `--ralph` Flag, Ralph Mode Abschnitte
- **Behalten**: `--workflow <name>`, `--worktree`
- **Vereinfachen**: Nur ein Template für SPRINT.yaml (workflow-basiert mit `collections:`)

### `commands/start-sprint.md`
- Gleiche Änderungen wie init-sprint.md
- Oder: **Löschen** falls Duplikat von init-sprint

### `commands/help.md`
- Entfernen: "Ralph Loop pattern" Referenzen
- Ersetzen durch: Kurze Erklärung dass jede Phase frischen Kontext bekommt

### `commands/run-sprint.md`, `commands/pause-sprint.md`
- Entfernen: Ralph-Referenzen

---

## Phase 3: Dokumentation konsolidieren

### Zu löschen:
- `docs/concepts/ralph-mode.md` - nicht mehr relevant

### Zu aktualisieren:
| Datei | Änderung |
|-------|----------|
| `README.md` | Vereinfachen, nur workflow-basierte Sprints |
| `docs/USER-GUIDE.md` | Ralph-Referenzen entfernen |
| `docs/concepts/overview.md` | "Fresh Context" Konzept kurz beschreiben |
| `docs/index.md` | Links zu gelöschten Dateien entfernen |
| `docs/getting-started/quick-start.md` | Vereinfachen |
| `docs/getting-started/first-sprint.md` | Ralph-Referenzen entfernen |
| `docs/guides/worktree-sprints.md` | Ralph-Referenzen entfernen |
| `docs/reference/commands.md` | `--ralph` entfernen |

---

## Phase 4: Skills aktualisieren

| Datei | Änderung |
|-------|----------|
| `skills/creating-workflows/SKILL.md` | Ralph Mode Abschnitt entfernen |
| `skills/creating-workflows/references/workflow-schema.md` | Ralph-spezifische Felder dokumentieren als deprecated |
| `skills/orchestrating-sprints/SKILL.md` | Vereinfachen |
| `skills/orchestrating-sprints/references/progress-schema.md` | Ralph-Felder als deprecated markieren |
| `skills/validating-workflows/references/common-workflow-errors.md` | Ralph-Errors entfernen |

---

## Phase 5: TypeScript-Code (Option A: Vollständige Entfernung)

### 5.1 `compiler/src/types.ts`
**Zu entfernen:**
- `RalphConfig` Interface (Zeile 245-248)
- `RalphExitInfo` Interface (Zeile 253-260)
- `PerIterationHook` Interface (Zeile 191-202)
- `DynamicStep` Interface (Zeile 207-218)
- `HookTask` Interface (Zeile 223-240)
- `mode?: 'standard' | 'ralph'` aus `WorkflowDefinition` (Zeile 616)
- `'goal-prompt'?`, `'reflection-prompt'?`, `'per-iteration-hooks'?` aus `WorkflowDefinition` (Zeile 617-622)
- Ralph-Felder aus `CompiledProgress` (Zeile 836-850):
  - `mode?: 'standard' | 'ralph'`
  - `goal?: string`
  - `'dynamic-steps'?: DynamicStep[]`
  - `'hook-tasks'?: HookTask[]`
  - `'per-iteration-hooks'?: PerIterationHook[]`
  - `ralph?: RalphConfig`
  - `'ralph-exit'?: RalphExitInfo`

### 5.2 `compiler/src/compile.ts`
**Zu entfernen:**
- Import von `RalphConfig` (Zeile 26)
- Import von `validateRalphModeSprint` (Zeile 40)
- Ralph-Mode-Check und Branching (Zeile 196-212)
- `compileRalphMode()` Funktion (Zeile 651-720)

### 5.3 `compiler/src/validate.ts`
**Zu entfernen:**
- `validateRalphModeSprint()` Funktion (Zeile 528-546)
- Ralph-Mode-Checks in `validateWorkflow()` (Zeile 385-408)
- Ralph-Mode-Checks in `validateProgress()` (Zeile 872-887)

### 5.4 `compiler/src/index.ts`
**Zu entfernen:**
- Ralph-Mode-Check (Zeile 198-200)

### 5.5 `runtime/src/transition.ts`
**Zu entfernen:**
- `mode?: 'standard' | 'ralph'` (Zeile 279)
- `ralph?` und `'ralph-exit'?` (Zeile 284-285)

### 5.6 Status-Server Dateien
**`compiler/src/status-server/transforms.ts`:**
- `countRalphTasks()` Funktion (Zeile 127-143)
- `buildRalphTaskTree()` Funktion (Zeile 417-435)
- Ralph-spezifische Logik in `transformProgressToStatus()` (Zeile 750-836)
- Hook-Task-Transformation (Zeile 671+)

**`compiler/src/status-server/status-types.ts`:**
- `mode?: 'standard' | 'ralph'` (Zeile 90-91)
- `goal?: string` (Zeile 92)
- `HookTaskStatus` Interface (Zeile 125-140)
- `hookTasks` aus `StatusUpdate` (Zeile 152)

**`compiler/src/status-server/page.ts`:**
- "Ralph Mode" Badge und UI-Elemente (Zeile 134, 1108, 1152)
- `updateRalphModeUI()` Funktion (Zeile 5025-5055)
- Ralph-spezifische CSS (Zeile 3479, 3524, 3743)

**`compiler/src/status-server/server.ts`:**
- Ralph-Mode-Kommentar (Zeile 1342)

**`compiler/src/status-server/timing-tracker.ts`:**
- Ralph-Kommentar (Zeile 211)

**`compiler/src/status-server/sprint-scanner.ts`:**
- Ralph-Kommentar (Zeile 185)

---

## Phase 6: Tests & Sonstiges

| Datei | Änderung |
|-------|----------|
| `runtime/src/worktree.test.ts` | Test-Cases mit 'ralph' durch anderen Workflow ersetzen |
| `schemas/ralph-result.json` | **Löschen** |
| `scripts/test-worktree-creation.sh` | 'ralph' durch anderen Workflow ersetzen |

---

## Phase 7: Build & Verify

```bash
cd plugins/m42-sprint/compiler
npm run build
npm test

# Verify keine Ralph-Referenzen mehr
grep -ri "ralph" plugins/m42-sprint/ --include="*.ts" --include="*.md" --include="*.yaml" --include="*.json"
```

---

## Zusammenfassung der zu löschenden Dateien

1. `docs/concepts/ralph-mode.md`
2. `docs/concepts/ralph-loop.md`
3. `schemas/ralph-result.json`

---

## Kritische Dateien (Priorität)

| Datei | Priorität | Umfang |
|-------|-----------|--------|
| `compiler/src/types.ts` | 1 | Groß |
| `compiler/src/compile.ts` | 2 | Mittel |
| `compiler/src/validate.ts` | 3 | Mittel |
| `commands/init-sprint.md` | 4 | Mittel |
| `commands/start-sprint.md` | 5 | Mittel (oder löschen) |
| `README.md` | 6 | Klein |
| Status-Server Dateien | 7 | Mittel |
| Dokumentation | 8 | Mittel |

---

## Verifikation

Nach allen Änderungen:
1. `npm run build` - keine Errors
2. `npm test` - alle Tests grün
3. `grep -ri "ralph" plugins/m42-sprint/` - keine Treffer
4. Manueller Test: `/init-sprint test-sprint --workflow plugin-development`
