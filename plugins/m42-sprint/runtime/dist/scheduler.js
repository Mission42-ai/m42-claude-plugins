/**
 * DAG-based Step Scheduler for Parallel Execution
 *
 * Manages step execution order based on dependency graphs from PROGRESS.yaml.
 * Provides methods for:
 * - Getting ready steps (all dependencies satisfied)
 * - Marking steps as in-progress/completed/failed
 * - Propagating failures to dependents
 * - Injecting new steps dynamically
 */
// ============================================================================
// StepScheduler Class
// ============================================================================
/**
 * DAG-based scheduler for managing step execution order
 *
 * The scheduler builds an internal dependency graph from PROGRESS.yaml
 * and provides methods for:
 * - Getting steps ready for execution (all deps satisfied)
 * - Managing step lifecycle (start, complete, fail)
 * - Propagating failures to dependent steps
 * - Dynamic step injection
 */
export class StepScheduler {
    /** All nodes in the graph, keyed by step ID */
    nodes = new Map();
    /** Reverse lookup: phase ID to step IDs */
    phaseSteps = new Map();
    /** Configuration options */
    options;
    /** Number of currently running steps */
    runningCount = 0;
    /**
     * Create a new scheduler from PROGRESS.yaml data
     *
     * @param progress - The compiled progress with dependency graphs
     * @param config - Parallel execution configuration (optional)
     */
    constructor(progress, config) {
        this.options = {
            onDependencyFailure: config?.onDependencyFailure ?? 'skip-dependents',
            maxConcurrent: config?.maxConcurrency ?? 0,
        };
        this.buildGraph(progress);
    }
    /**
     * Build the internal dependency graph from PROGRESS.yaml
     */
    buildGraph(progress) {
        const dependencyGraphs = progress['dependency-graph'] ?? [];
        // Create a map for quick lookup of dependency info
        const depNodeMap = new Map();
        for (const graph of dependencyGraphs) {
            for (const node of graph.nodes) {
                depNodeMap.set(node.id, node);
            }
        }
        // Process all phases that have steps
        for (const phase of progress.phases ?? []) {
            if (!phase.steps || phase.steps.length === 0) {
                continue;
            }
            const stepIds = [];
            for (const step of phase.steps) {
                const depNode = depNodeMap.get(step.id);
                const node = {
                    id: step.id,
                    phaseId: phase.id,
                    dependsOn: depNode?.['depends-on'] ?? step['depends-on'] ?? [],
                    blockedBy: [...(depNode?.['blocked-by'] ?? depNode?.['depends-on'] ?? step['depends-on'] ?? [])],
                    dependents: [], // Will be populated in second pass
                    status: this.mapPhaseStatus(step.status),
                };
                this.nodes.set(step.id, node);
                stepIds.push(step.id);
            }
            this.phaseSteps.set(phase.id, stepIds);
        }
        // Second pass: build reverse edges (dependents)
        for (const [, node] of this.nodes) {
            for (const depId of node.dependsOn) {
                const depNode = this.nodes.get(depId);
                if (depNode) {
                    depNode.dependents.push(node.id);
                }
            }
        }
        // Third pass: update blockedBy based on current status
        // (remove completed dependencies from blockedBy)
        for (const [, node] of this.nodes) {
            if (node.status === 'pending') {
                node.blockedBy = node.blockedBy.filter((depId) => {
                    const dep = this.nodes.get(depId);
                    return dep && dep.status !== 'completed';
                });
                // If all blockers are cleared, mark as ready
                if (node.blockedBy.length === 0) {
                    node.status = 'ready';
                }
            }
        }
    }
    /**
     * Map PhaseStatus to SchedulerStepStatus
     */
    mapPhaseStatus(status) {
        switch (status) {
            case 'pending':
            case 'blocked':
                return 'pending';
            case 'in-progress':
                return 'running';
            case 'completed':
                return 'completed';
            case 'failed':
                return 'failed';
            case 'skipped':
                return 'skipped';
            default:
                return 'pending';
        }
    }
    /**
     * Get all steps that are ready to execute
     *
     * A step is ready when:
     * 1. Its status is 'ready' (all dependencies completed)
     * 2. max-concurrent limit hasn't been reached
     *
     * @returns Array of ready steps with metadata
     */
    getReadySteps() {
        const ready = [];
        // Check max-concurrent limit
        const availableSlots = this.options.maxConcurrent > 0
            ? this.options.maxConcurrent - this.runningCount
            : Number.MAX_SAFE_INTEGER;
        if (availableSlots <= 0) {
            return ready;
        }
        for (const [, node] of this.nodes) {
            if (node.status === 'ready') {
                const phaseSteps = this.phaseSteps.get(node.phaseId) ?? [];
                const stepIndex = phaseSteps.indexOf(node.id);
                ready.push({
                    id: node.id,
                    phaseId: node.phaseId,
                    stepIndex,
                });
                if (ready.length >= availableSlots) {
                    break;
                }
            }
        }
        return ready;
    }
    /**
     * Mark a step as started (in-progress)
     *
     * @param stepId - ID of the step to start
     * @param workerId - Optional worker identifier
     * @returns True if successful, false if step not found or not ready
     */
    startStep(stepId, workerId) {
        const node = this.nodes.get(stepId);
        if (!node) {
            return false;
        }
        if (node.status !== 'ready') {
            return false;
        }
        node.status = 'running';
        node.workerId = workerId;
        node.startedAt = new Date().toISOString();
        this.runningCount++;
        return true;
    }
    /**
     * Mark a step as completed
     *
     * This will:
     * 1. Update the step's status to 'completed'
     * 2. Remove this step from blockedBy of all dependents
     * 3. Mark newly unblocked dependents as 'ready'
     *
     * @param stepId - ID of the step that completed
     * @returns True if successful, false if step not found or not running
     */
    completeStep(stepId) {
        const node = this.nodes.get(stepId);
        if (!node) {
            return false;
        }
        if (node.status !== 'running') {
            return false;
        }
        node.status = 'completed';
        node.completedAt = new Date().toISOString();
        this.runningCount--;
        // Unblock dependents
        for (const dependentId of node.dependents) {
            const dependent = this.nodes.get(dependentId);
            if (!dependent)
                continue;
            // Remove this step from the dependent's blockedBy list
            dependent.blockedBy = dependent.blockedBy.filter((id) => id !== stepId);
            // If dependent has no more blockers and is pending, mark as ready
            if (dependent.blockedBy.length === 0 && dependent.status === 'pending') {
                dependent.status = 'ready';
            }
        }
        return true;
    }
    /**
     * Mark a step as failed
     *
     * Based on the failure policy:
     * - 'skip-dependents': Mark all transitive dependents as skipped
     * - 'fail-phase': Mark the entire phase as failed (not implemented at scheduler level)
     * - 'continue': Do nothing, let other steps continue
     *
     * @param stepId - ID of the step that failed
     * @param error - Optional error message
     * @returns True if successful, false if step not found or not running
     */
    failStep(stepId, error) {
        const node = this.nodes.get(stepId);
        if (!node) {
            return false;
        }
        if (node.status !== 'running') {
            return false;
        }
        node.status = 'failed';
        node.completedAt = new Date().toISOString();
        node.error = error;
        this.runningCount--;
        // Apply failure policy
        if (this.options.onDependencyFailure === 'skip-dependents') {
            this.skipDependents(stepId);
        }
        // 'continue' does nothing - dependents remain pending/blocked
        // 'fail-phase' is handled at the loop level, not scheduler level
        return true;
    }
    /**
     * Recursively skip all dependents of a failed step
     */
    skipDependents(stepId) {
        const node = this.nodes.get(stepId);
        if (!node)
            return;
        for (const dependentId of node.dependents) {
            const dependent = this.nodes.get(dependentId);
            if (!dependent)
                continue;
            // Only skip if not already completed/running
            if (dependent.status === 'pending' || dependent.status === 'ready') {
                dependent.status = 'skipped';
                dependent.error = `Skipped due to failed dependency: ${stepId}`;
                // Recursively skip this dependent's dependents
                this.skipDependents(dependentId);
            }
        }
    }
    /**
     * Inject a new step into the graph
     *
     * The step can have dependencies on existing steps, and existing
     * steps can depend on it (though this requires careful coordination).
     *
     * @param step - The step to inject
     * @param phaseId - Phase to add the step to
     * @param dependsOn - IDs of steps this depends on (optional)
     * @returns Result indicating success or failure with reason
     */
    injectStep(step, phaseId, dependsOn) {
        // Check if step ID already exists
        if (this.nodes.has(step.id)) {
            return { success: false, error: `Step ID already exists: ${step.id}` };
        }
        const deps = dependsOn ?? [];
        // Check for self-reference first (before checking if deps exist)
        if (deps.includes(step.id)) {
            return { success: false, error: 'Step cannot depend on itself' };
        }
        // Validate dependencies exist
        for (const depId of deps) {
            if (!this.nodes.has(depId)) {
                return { success: false, error: `Dependency not found: ${depId}` };
            }
        }
        // Determine initial status based on dependencies
        let initialStatus = 'ready';
        const blockedBy = [];
        for (const depId of deps) {
            const depNode = this.nodes.get(depId);
            if (depNode.status !== 'completed') {
                blockedBy.push(depId);
                initialStatus = 'pending';
            }
        }
        // Create the new node
        const node = {
            id: step.id,
            phaseId,
            dependsOn: [...deps],
            blockedBy,
            dependents: [],
            status: initialStatus,
        };
        this.nodes.set(step.id, node);
        // Update phase steps map
        const phaseSteps = this.phaseSteps.get(phaseId) ?? [];
        phaseSteps.push(step.id);
        this.phaseSteps.set(phaseId, phaseSteps);
        // Add reverse edges to dependencies
        for (const depId of deps) {
            const depNode = this.nodes.get(depId);
            if (depNode) {
                depNode.dependents.push(step.id);
            }
        }
        return { success: true };
    }
    /**
     * Check if all steps are complete (or skipped/failed)
     *
     * @returns True if no steps are pending, ready, or running
     */
    isComplete() {
        for (const [, node] of this.nodes) {
            if (node.status === 'pending' ||
                node.status === 'ready' ||
                node.status === 'running') {
                return false;
            }
        }
        return true;
    }
    /**
     * Check if the scheduler has failed steps
     *
     * @returns True if any step has failed
     */
    hasFailed() {
        for (const [, node] of this.nodes) {
            if (node.status === 'failed') {
                return true;
            }
        }
        return false;
    }
    /**
     * Get status summary of all steps
     *
     * @returns Object with counts by status
     */
    getStatusSummary() {
        const summary = {
            pending: 0,
            ready: 0,
            running: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
        };
        for (const [, node] of this.nodes) {
            summary[node.status]++;
        }
        return summary;
    }
    /**
     * Get the internal node for a step (for testing/debugging)
     *
     * @param stepId - The step ID
     * @returns The scheduler node or undefined
     */
    getNode(stepId) {
        return this.nodes.get(stepId);
    }
    /**
     * Get all nodes (for testing/debugging)
     *
     * @returns Map of all scheduler nodes
     */
    getAllNodes() {
        return new Map(this.nodes);
    }
    /**
     * Get the number of currently running steps
     */
    getRunningCount() {
        return this.runningCount;
    }
    /**
     * Get the max concurrent limit
     */
    getMaxConcurrent() {
        return this.options.maxConcurrent;
    }
    /**
     * Update the blocked-by list in PROGRESS.yaml format
     *
     * @returns Array of dependency graphs with updated blocked-by
     */
    exportDependencyGraphs() {
        const graphs = [];
        // Group nodes by phase
        for (const [phaseId, stepIds] of this.phaseSteps) {
            const nodes = [];
            for (const stepId of stepIds) {
                const node = this.nodes.get(stepId);
                if (!node)
                    continue;
                nodes.push({
                    id: node.id,
                    'depends-on': node.dependsOn,
                    'blocked-by': node.blockedBy,
                });
            }
            if (nodes.length > 0) {
                graphs.push({
                    'phase-id': phaseId,
                    nodes,
                });
            }
        }
        return graphs;
    }
}
//# sourceMappingURL=scheduler.js.map