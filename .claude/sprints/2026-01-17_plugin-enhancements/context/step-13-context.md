# Step Context: step-13

## Task
Phase 4 - Step 5: Add Navigation Header to Sprint Detail Page

Add navigation between dashboard and sprint detail views.

Requirements:
- Add navigation bar at top of sprint detail page
- Include "← Back to Dashboard" link
- Show breadcrumb: Dashboard > Sprint: <sprint-id>
- Add sprint switcher dropdown (last 10 sprints)
- Style navigation consistent with existing header
- Update dashboard page with same navigation pattern

Files to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts
- plugins/m42-sprint/compiler/src/status-server/dashboard-page.ts

## Related Code Patterns

### Header Structure in page.ts (lines 23-46)
```typescript
<header class="header">
  <div class="header-left">
    <h1 class="sprint-name" id="sprint-name">Loading...</h1>
    <span class="status-badge" id="status-badge">--</span>
  </div>
  <div class="header-right">
    <div class="iteration" id="iteration"></div>
    <div class="progress-container">...</div>
    <div class="header-actions">
      <button class="header-download-btn" id="download-all-logs-btn" title="Download All Logs">⬇ All Logs</button>
      <button class="header-notification-btn" id="notification-settings-btn" title="Notification Settings">🔔</button>
    </div>
  </div>
</header>
```

### Header Structure in dashboard-page.ts (lines 47-70)
```typescript
function generateHeader(activeSprint: string | null): string {
  const activeSprintLink = activeSprint
    ? `<a href="/sprint/${activeSprint}" class="nav-link active-sprint-link">
        <span class="active-sprint-indicator"></span>
        View Active Sprint
      </a>`
    : '';

  return `
    <header class="header">
      <div class="header-left">
        <h1 class="dashboard-title">Sprint Dashboard</h1>
      </div>
      <div class="header-right">
        ${activeSprintLink}
        <a href="..." class="nav-link docs-link">Documentation</a>
      </div>
    </header>`;
}
```

### Nav Link Styles in dashboard-page.ts (lines 311-322)
```css
.nav-link {
  color: var(--accent-blue);
  text-decoration: none;
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 6px;
  transition: background-color 0.15s;
}

.nav-link:hover {
  background-color: var(--bg-tertiary);
}
```

## Required Imports
### Internal
- No new imports needed - both files are self-contained HTML generators

### External
- No new external packages needed

## Types/Interfaces to Use
Both page.ts and dashboard-page.ts are template-based HTML generators using template literals. Key function signatures:

```typescript
// From page.ts
export function getPageHtml(): string
function getStyles(): string
function getScript(): string

// From dashboard-page.ts
export function generateDashboardPage(
  sprints: SprintSummary[],
  metrics: AggregateMetrics,
  activeSprint: string | null
): string
function generateHeader(activeSprint: string | null): string
function getDashboardStyles(): string
function getDashboardScript(): string
```

## Integration Points
- **Called by**: `server.ts` via `handleSprintDetailPageRequest()` (line 450) and `handleDashboardPageRequest()` (line 419)
- **Calls**: No external modules - pure HTML generation
- **Tests**: No dedicated test files for these generators

## Sprint Data for Navigation
From server.ts, the sprint list is obtained via:
```typescript
const scanner = new SprintScanner(sprintsDir);
const sprints = scanner.scan();  // Returns SprintSummary[]
```

The current sprint ID comes from:
```typescript
this.getCurrentSprintId()  // Returns path.basename(this.config.sprintDir)
```

## Implementation Notes

### For page.ts (Sprint Detail Page)
1. Add navigation bar **above** existing `<header class="header">` element
2. Navigation bar should include:
   - `← Back to Dashboard` link (href="/dashboard")
   - Breadcrumb: `Dashboard > Sprint: ${sprintId}`
   - Sprint switcher dropdown (needs sprint list passed to getPageHtml)
3. Consider adding sprintId and available sprints as parameters to `getPageHtml()`

### For dashboard-page.ts
1. Navigation pattern is simpler - already has header with nav links
2. May need to add consistent navigation bar styling above existing header for uniformity
3. Consider adding breadcrumb showing just "Dashboard" (active state)

### CSS Patterns to Follow
- Use CSS variables: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--border-color`
- Colors: `--text-primary` (#c9d1d9), `--text-secondary` (#8b949e), `--accent-blue` (#58a6ff)
- Padding: `12px 20px` for header, `6px 12px` for nav links
- Border: `1px solid var(--border-color)`
- Border radius: `6px` for buttons/links, `4px` for small elements

### Page Signature Changes Needed
Current: `getPageHtml(): string`
Needed: `getPageHtml(sprintId?: string, allSprints?: SprintSummary[]): string`

The server already has access to sprint data via `SprintScanner` - we need to pass this data to the page generator.

### Key Server Routes (from server.ts)
- `/` and `/dashboard` → `handleDashboardPageRequest()` → `generateDashboardPage()`
- `/sprint/:id` → `handleSprintDetailPageRequest()` → `getPageHtml()`

### Gherkin Verification Patterns
The verification commands check for:
1. `nav-bar|navigation-bar|class="nav"|<nav` - navigation container
2. `href.*dashboard.*Back|Back.*href.*dashboard|←.*Dashboard|Back to Dashboard` - back link
3. `breadcrumb|Dashboard.*>.*Sprint|Sprint.*breadcrumb` - breadcrumb structure
4. `sprint-switcher|sprint-select|select.*sprint|dropdown.*sprint` - sprint switcher
5. `.nav-bar|.navigation|.breadcrumb|.sprint-switcher` - CSS classes
