/**
 * Tests for BUG-001: Sprint Steps Show No Progress Indicators
 *
 * This test file validates the COMPLETE data flow from PROGRESS.yaml structure
 * through to the final HTML rendering, ensuring step status indicators are
 * correctly displayed in the sprint detail page.
 *
 * Issue: Steps in the sprint review show no progress indicators - all empty circles
 * regardless of their actual status (completed, in-progress, pending).
 *
 * Expected behavior:
 * - Completed steps: green checkmark (class="tree-icon completed")
 * - In-progress steps: blue pulsing circle (class="tree-icon in-progress")
 * - Pending steps: gray empty circle (class="tree-icon pending")
 * - Failed steps: red X (class="tree-icon failed")
 *
 * Root cause identified in loop.ts comments: The runtime historically only updated
 * progress.status (sprint-level) and phase.status (only on completion). It never
 * updated step.status or subPhase.status which remained 'pending' forever.
 *
 * This test verifies the fix by checking that:
 * 1. buildPhaseTree correctly transforms step statuses
 * 2. toStatusUpdate includes phaseTree with correct step statuses
 * 3. The page.ts rendering would produce correct CSS classes
 */
export {};
//# sourceMappingURL=step-progress.test.d.ts.map