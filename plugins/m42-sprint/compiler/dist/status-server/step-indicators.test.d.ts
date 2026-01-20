/**
 * Tests for BUG-001: Sprint Steps Show No Progress Indicators
 *
 * This test verifies that step status indicators are correctly rendered
 * in the sprint detail page. The bug was that all steps showed as empty
 * circles (pending) regardless of their actual status.
 *
 * The test flow:
 * 1. Create a PROGRESS.yaml-like structure with mixed step statuses
 * 2. Transform it via buildPhaseTree/toStatusUpdate
 * 3. Simulate the client-side renderTreeNode logic
 * 4. Verify the HTML contains correct CSS classes for each status
 *
 * This test targets the rendering layer to ensure status CSS classes
 * are correctly applied to step icons.
 */
export {};
//# sourceMappingURL=step-indicators.test.d.ts.map