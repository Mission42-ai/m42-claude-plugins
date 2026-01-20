/**
 * Tests for BUG-007: Steps/Substeps Missing Duration and Clickable Logs
 *
 * Issue: Steps in the sprint detail view should show:
 * 1. Duration for each step/substep (elapsed time or running time)
 * 2. Clickable step rows to view logs (not just "View Log" button on leaf nodes)
 *
 * Expected behavior:
 * - In-progress steps show live duration (computed from startedAt to now)
 * - Completed steps show total duration (elapsed field)
 * - Step rows should be clickable to open log viewer
 * - Visual indication of clickability (hover cursor, etc.)
 *
 * Root cause analysis:
 * - transforms.ts only copies elapsed field from PROGRESS.yaml
 * - In-progress steps don't have elapsed computed server-side
 * - page.ts only renders elapsed if it exists in the node data
 * - Step rows are not clickable; only the "View Log" button is
 */
export {};
//# sourceMappingURL=step-duration-clickable.test.d.ts.map