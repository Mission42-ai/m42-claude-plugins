/**
 * Tests for resolve-workflows module
 *
 * BUG-001: Workflow Cache Staleness
 * The module-level workflow cache persists across compilations.
 * In watch mode or long-running processes, modified workflow files
 * use stale cached versions.
 *
 * FIX: clearWorkflowCache() is called at the start of compile() to ensure
 * each compilation starts with a fresh cache.
 */
export {};
//# sourceMappingURL=resolve-workflows.test.d.ts.map