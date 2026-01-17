# Step Context: step-16

## Task
Phase 5 - Step 2: Add Mobile Responsive CSS

Make status page usable on mobile and tablet devices.

Requirements:
- Add media queries for mobile (<768px) and tablet (<1024px)
- Stack layout elements vertically on mobile
- Reduce font sizes and padding on smaller screens
- Make buttons touch-friendly (min 44px tap target)
- Hide non-essential elements on mobile (e.g., keyboard shortcut hints)
- Ensure log viewer is scrollable horizontally
- Test activity panel collapse/expand on mobile

Verification:
- Open status page on mobile device or Chrome DevTools mobile view
- Verify all content is accessible and readable
- Verify touch interactions work correctly

File to modify:
- plugins/m42-sprint/compiler/src/status-server/page.ts (CSS section)

## Related Code Patterns

### Current Layout Structure
The page uses flexbox for layout with these key components:
- `.container`: flex column, 100vh height
- `.main`: flex row containing sidebar and content
- `.sidebar`: fixed 320px width, flex-shrink: 0
- `.content`: flex: 1, takes remaining space

### CSS Location: `page.ts:300-2093`
```typescript
function getStyles(): string {
  return `
    // CSS variables defined at :root (lines 302-317)
    // Layout styles start at line 334 (.container)
    // Sidebar at line 577 (width: 320px)
    // Control buttons at line 1287 (padding: 6px 12px)
    // Keyboard hints at line 2089 (.kbd-hint)
    // Log viewer at line 1544-1788
  `;
}
```

### Key Layout Elements to Make Responsive

**Main Layout (line 569-574, 577-585):**
```css
.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 320px;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}
```

**Navigation Bar (line 341-360):**
```css
.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
}

.nav-left, .nav-right {
  display: flex;
  align-items: center;
  gap: 16px / 12px;
}
```

**Header (line 438-458):**
```css
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
}
```

**Control Buttons (line 1287-1345):**
```css
.control-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;  /* Need 44px min for touch */
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
}
```

**Keyboard Hint (line 2089-2092):**
```css
.kbd-hint {
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

**Log Viewer Body (line 1658-1663):**
```css
.log-viewer-body {
  flex: 1;
  overflow: auto;
  padding: 12px;
  background-color: var(--bg-primary);
}
```

**Activity Panel (line 1061-1074):**
```css
.live-activity {
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  max-height: 300px;
  transition: max-height 0.2s ease;
}

.live-activity.collapsed {
  max-height: 36px;
  overflow: hidden;
}
```

## Required Imports
### Internal
No additional imports needed - CSS is embedded in template literal.

### External
No additional packages needed.

## Types/Interfaces to Use
No type changes required - this is pure CSS modification.

## Integration Points
- Called by: `getPageHtml()` function embeds `getStyles()` output in `<style>` tag
- Calls: None (returns CSS string)
- Tests: Manual verification via Chrome DevTools mobile view

## Implementation Notes

1. **Insert location**: Add media queries at the end of `getStyles()`, before the closing backtick (line 2093).

2. **Breakpoints to implement**:
   - Tablet: `@media (max-width: 1024px)` - slight adjustments
   - Mobile: `@media (max-width: 768px)` - major layout changes

3. **Mobile layout changes needed**:
   - `.main`: change to `flex-direction: column`
   - `.sidebar`: `width: 100%`, remove border-right, add border-bottom
   - `.nav-bar`, `.header`: reduce padding, stack on very small screens
   - `.control-btn`: increase padding for 44px touch target
   - `.kbd-hint`: `display: none` to hide keyboard hints
   - `.log-viewer-body`: add `overflow-x: auto` for horizontal scroll
   - Reduce font sizes for readability on small screens

4. **Touch-friendly sizing**:
   - Buttons need min-height: 44px for accessibility
   - Use `padding: 12px 16px` to achieve this size
   - Phase action buttons also need enlarging

5. **CSS conventions from shared context**:
   - Use kebab-case class names
   - GitHub dark theme colors already defined in :root
   - Consistent spacing: `1rem`, `0.75rem`, `0.5rem`

6. **Activity panel on mobile**:
   - Collapse/expand should still work (uses max-height transition)
   - May need larger collapse button tap target

7. **No JavaScript changes required**:
   - CSS-only solution using media queries
   - Existing toggle functionality will work

## Gherkin Verification Commands
From step-16-gherkin.md:
```bash
# Scenario 1: Mobile media query
grep -q "@media.*max-width.*768px" plugins/m42-sprint/compiler/src/status-server/page.ts

# Scenario 2: Tablet media query
grep -q "@media.*max-width.*1024px" plugins/m42-sprint/compiler/src/status-server/page.ts

# Scenario 3: Sidebar responsive
grep -A 50 "@media.*max-width.*768px" ... | grep -q "\.sidebar\|\.main\|flex-direction"

# Scenario 4: Touch buttons (44px via padding)
grep -A 100 "@media.*max-width.*768px" ... | grep -qE "min-height:\s*44px|padding.*10px|padding.*12px"

# Scenario 5: kbd-hint hidden
grep -A 100 "@media.*max-width.*768px" ... | grep -qE "\.kbd-hint.*display:\s*none"

# Scenario 6: Log viewer scroll
grep -B 5 -A 100 "@media.*max-width.*768px" ... | grep -qE "overflow-x:\s*(auto|scroll)"

# Scenario 7: Reduced padding
grep -A 100 "@media.*max-width.*768px" ... | grep -qE "padding:\s*(4px|6px|8px|10px|12px)"

# Scenario 8: TypeScript compiles
cd plugins/m42-sprint/compiler && npx tsc --noEmit
```
