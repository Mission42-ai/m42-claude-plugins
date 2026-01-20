/**
 * Tests for transforms.ts - Data transformation for status server
 * BUG-001: Sprint Steps Show No Progress Indicators
 *
 * Issue: Steps in the sprint review show no progress indicators - all empty circles
 * regardless of their actual status (completed, in-progress, pending).
 *
 * Expected: Steps should show visual indicators based on status:
 * - Completed steps: filled/checked circle (✓)
 * - In-progress steps: animated/partial circle (● with pulse)
 * - Pending steps: empty circle (○)
 *
 * ROOT CAUSE ANALYSIS:
 * The transforms correctly pass through step.status values. However, the runtime
 * (loop.ts) only updates:
 * 1. progress.status (sprint-level)
 * 2. phase.status (only when sprint completes at line 228)
 *
 * It NEVER updates:
 * - step.status (remains 'pending' forever)
 * - subPhase.status (remains 'pending' forever)
 *
 * This test verifies the transforms work correctly (they do), but the real bug
 * is in the runtime which should update step statuses as phases progress.
 *
 * These tests verify that:
 * 1. Step status is correctly passed through buildStepNode
 * 2. Phase tree nodes have correct status values
 * 3. Different step statuses are properly represented
 */
export {};
//# sourceMappingURL=transforms.test.d.ts.map