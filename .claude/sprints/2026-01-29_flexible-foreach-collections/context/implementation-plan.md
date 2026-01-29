# Plan: Flexible For-Each Collections im Sprint Plugin

## Ziel
Erweiterung des `for-each` Mechanismus, sodass er nicht nur auf `step` beschränkt ist, sondern beliebige Kategorien wie `feature`, `bug`, `chore` etc. unterstützt.

## Design-Entscheidung

- **Keine Rückwärtskompatibilität** - `steps:` Array wird nicht mehr unterstützt
- **Collections unter Namespace** - Alle Collections unter `collections:` gruppiert
- **Exact Match** - `for-each: feature` → sucht in `collections.feature` (keine Transformation)

---

## Neues Schema

### SPRINT.yaml

```yaml
workflow: mixed-workflow

collections:
  feature:                       # Singular - exact match mit for-each
    - prompt: "Feature A"
      priority: high

  bug:
    - prompt: "Bug fix 1"
      severity: critical

  step:
    - prompt: "Generic task"
```

### Workflow

```yaml
phases:
  - id: feature-dev
    for-each: feature           # → collections.feature (exact match)
    workflow: feature-workflow

  - id: bugfix
    for-each: bug               # → collections.bug
    workflow: bugfix-workflow

  - id: other
    for-each: step              # → collections.step
    workflow: step-workflow
```

### Template-Variablen

| Variable | Beschreibung |
|----------|-------------|
| `{{item.prompt}}` | Generischer Accessor (immer verfügbar) |
| `{{item.id}}` | Generische Item-ID |
| `{{item.index}}` | Index in der Collection |
| `{{feature.prompt}}` | Typ-spezifisch bei `for-each: feature` |
| `{{bug.severity}}` | Custom Properties zugänglich über Typ-Name |

---

## Implementierungsplan

### Phase 1: Type System (types.ts)

**1.1 `SprintStep` → `CollectionItem` umbenennen** (Zeile 382)
```typescript
// Vorher: SprintStep
// Nachher:
export interface CollectionItem {
  prompt: string;
  workflow?: string;
  id?: string;
  model?: ClaudeModel;
  [key: string]: unknown;  // Custom properties erlauben
}

// Alias für Klarheit
export type SprintStep = CollectionItem;
```

**1.2 SprintDefinition ändern** (Zeile 413)
```typescript
export interface SprintDefinition {
  workflow: string;
  // ENTFERNT: steps?: SprintStep[];
  collections: {                 // Required, nicht optional
    [name: string]: CollectionItem[];
  };
  // ... rest unchanged
}
```

**1.3 WorkflowPhase ändern** (Zeile 467)
```typescript
export interface WorkflowPhase {
  id: string;
  'for-each'?: string;          // War: literal 'step'
  collection?: string;          // Optional: Explizite Collection-Referenz
  // ... rest unchanged
}
```

**1.4 TemplateContext erweitern** (ca. Zeile 710)
```typescript
export interface TemplateContext {
  item?: {
    prompt: string;
    id: string;
    index: number;
    type: string;               // Der Collection-Typ (feature, bug, etc.)
    [key: string]: unknown;
  };
  // ENTFERNT: step?: { ... };
  phase?: { id: string; index: number };
  sprint?: { id: string; name?: string };
}
```

### Phase 2: Validation (validate.ts)

**2.1 `validateSprintDefinition` anpassen**
- `steps` Validierung entfernen
- `collections` als required validieren
- Mindestens eine Collection mit mindestens einem Item

**2.2 Collection-Item-Validierung** (neue Funktion)
```typescript
export function validateCollectionItem(
  item: unknown,
  index: number,
  collectionName: string
): CompilerError[]
```

**2.3 For-Each-Validierung anpassen**
- `for-each` als beliebigen String akzeptieren
- Validieren dass `collection:` (wenn angegeben) existiert

**2.4 Cross-Reference-Validierung** (neue Funktion)
```typescript
export function validateCollectionReferences(
  workflow: WorkflowDefinition,
  sprint: SprintDefinition
): CompilerError[]
```

**2.5 Collection-Auflösung (Exact Match)**
```typescript
export function resolveCollectionName(
  forEachType: string,
  explicitCollection?: string
): string {
  // Explicit collection überschreibt, sonst exact match
  return explicitCollection ?? forEachType;
}
```

### Phase 3: Compiler (compile.ts)

**3.1 Collection-Auflösung** (neue Funktion)
```typescript
// Exact match - keine Transformation
function resolveCollectionName(
  forEachType: string,
  explicitCollection?: string
): string {
  return explicitCollection ?? forEachType;
}

function getCollectionItems(
  sprintDef: SprintDefinition,
  collectionName: string
): CollectionItem[] {
  return sprintDef.collections[collectionName] ?? [];
}
```

**3.2 Phase-Loop anpassen** (Zeile 222-253)
```typescript
if (phase['for-each']) {
  const itemType = phase['for-each'];
  const collectionName = resolveCollectionName(itemType, phase.collection);
  const items = getCollectionItems(sprintDef, collectionName);

  const expandedPhase = expandForEach(
    phase,
    items,
    itemType,
    config.workflowsDir,
    defaultStepWorkflow,
    context,
    errors,
    modelContext
  );
  compiledPhases.push(expandedPhase);
}
```

**3.3 `validateStandardModeSprint` anpassen**
- Prüft jetzt auf `collections` statt `steps`

### Phase 4: Expand-ForEach (expand-foreach.ts)

**4.1 substituteTemplateVars komplett überarbeiten**
```typescript
export function substituteTemplateVars(
  template: string,
  context: TemplateContext
): string {
  let result = template;

  if (context.item) {
    // Generisch: {{item.prompt}}, {{item.id}}, {{item.index}}
    result = result.replace(/\{\{item\.(\w+)\}\}/g, (_, prop) => {
      const value = context.item?.[prop];
      return value !== undefined ? String(value) : '';
    });

    // Typ-spezifisch: {{feature.prompt}}, {{bug.severity}}
    const itemType = context.item.type;
    if (itemType) {
      const typePattern = new RegExp(`\\{\\{${itemType}\\.(\\w+)\\}\\}`, 'g');
      result = result.replace(typePattern, (_, prop) => {
        const value = context.item?.[prop];
        return value !== undefined ? String(value) : '';
      });
    }
  }

  // Phase und Sprint Variablen (unchanged)
  // ...
}
```

**4.2 expandForEach Signatur ändern**
```typescript
export function expandForEach(
  phase: WorkflowPhase,
  items: CollectionItem[],
  itemType: string,
  workflowsDir: string,
  defaultWorkflow: LoadedWorkflow | null,
  context: TemplateContext,
  errors: CompilerError[],
  modelContext: ModelContext = {}
): CompiledTopPhase
```

**4.3 expandStep → expandItem umbenennen**
```typescript
export function expandItem(
  item: CollectionItem,
  itemIndex: number,
  itemType: string,
  workflow: WorkflowDefinition,
  context: TemplateContext,
  modelContext: ModelContext = {}
): CompiledStep
```

### Phase 5: Tests aktualisieren

**5.1 Bestehende Tests anpassen**
- Alle Tests die `steps:` verwenden auf `collections:` umstellen
- `for-each: step` → `for-each: step` mit `collections: { step: [...] }`

**5.2 Neue Tests hinzufügen**
- Exact Match: `for-each: feature` → `collections.feature`
- Custom Properties in Template-Variablen
- Mehrere Collections im selben Sprint
- Explizite `collection:` Referenz überschreibt for-each

### Phase 6: Templates/Workflows aktualisieren

**6.1 Workflow-Templates anpassen**
- `plugins/m42-sprint/templates/*.yaml`
- `{{step.prompt}}` → `{{item.prompt}}` (oder beides unterstützen?)

**6.2 Dokumentation aktualisieren**
- Skill-Dokumentation für Sprint-Erstellung

---

## Dateien zu modifizieren

| Datei | Änderungen |
|-------|------------|
| `plugins/m42-sprint/compiler/src/types.ts` | SprintStep→CollectionItem, SprintDefinition.collections required, WorkflowPhase.for-each string |
| `plugins/m42-sprint/compiler/src/validate.ts` | steps-Validierung entfernen, collections-Validierung, resolveCollectionName() |
| `plugins/m42-sprint/compiler/src/compile.ts` | getCollectionItems(), resolveCollectionName(), Phase-Loop anpassen |
| `plugins/m42-sprint/compiler/src/expand-foreach.ts` | itemType Parameter, Template-Vars für {{item.*}} und {{<type>.*}} |
| `plugins/m42-sprint/compiler/src/validate.test.ts` | Tests auf collections umstellen |
| `plugins/m42-sprint/compiler/src/compile.test.ts` | Tests auf collections umstellen |
| `plugins/m42-sprint/templates/*.yaml` | {{step.*}} → {{item.*}} |

---

## Breaking Changes

- **`steps:` wird nicht mehr unterstützt** - muss zu `collections: { step: [...] }` migriert werden
- **`{{step.prompt}}` wird nicht mehr unterstützt** - muss zu `{{item.prompt}}` oder `{{step.prompt}}` (mit for-each: step) werden
- Bestehende Sprints müssen manuell migriert werden
- Collection-Namen sind jetzt Singular (exact match mit for-each)

---

## Beispiel nach Implementierung

### SPRINT.yaml
```yaml
workflow: full-development

collections:
  step:
    - prompt: "Setup"

  feature:
    - prompt: "User authentication"
      priority: high

  bug:
    - prompt: "Fix timeout"
      severity: critical
```

### Workflow
```yaml
name: Full Development

phases:
  - id: setup
    for-each: step              # → collections.step (exact match)
    workflow: minimal

  - id: feature-dev
    for-each: feature           # → collections.feature (exact match)
    workflow: feature-workflow

  - id: bugfix
    for-each: bug               # → collections.bug (exact match)
    workflow: bugfix-workflow
```

### Feature-Workflow mit Custom Properties
```yaml
name: Feature Workflow

phases:
  - id: plan
    prompt: |
      Plan: {{item.prompt}}
      Priority: {{item.priority}}

      # Typ-spezifisch auch möglich:
      Feature: {{feature.prompt}}

  - id: implement
    prompt: |
      Implement item {{item.index}}: {{item.prompt}}
```

---

## Verifikation

1. **TypeScript Build**: `cd plugins/m42-sprint/compiler && npm run build`
2. **Tests**: `cd plugins/m42-sprint/compiler && npm test`
3. **Manueller Test**: Neuen Sprint mit `collections:` erstellen und kompilieren
4. **Template-Test**: Workflow mit `{{item.*}}` und `{{feature.*}}` Variablen testen
