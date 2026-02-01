/**
 * Data transformation functions for converting CompiledProgress to StatusUpdate format
 * Used by the status server to send updates to connected browsers
 */

import type {
  CompiledProgress,
  CompiledTopPhase,
  CompiledStep,
  CompiledPhase,
  PhaseStatus,
  StatusUpdate,
  SprintHeader,
  CurrentTask,
  PhaseTreeNode,
  LogEntry,
  LogEntryType,
  GraphNode,
  GraphEdge,
  DependencyGraph,
  GraphNodeStatusColor,
  StatusUpdateWithGraph,
} from './status-types.js';

/**
 * Compiled dependency node from PROGRESS.yaml
 * (matches scheduler types)
 */
interface CompiledDependencyNode {
  id: string;
  'depends-on': string[];
  'blocked-by': string[];
}

/**
 * Dependency graph structure in PROGRESS.yaml
 */
interface CompiledDependencyGraph {
  'phase-id': string;
  nodes: CompiledDependencyNode[];
}

/**
 * Timing information passed to toStatusUpdate
 */
export interface TimingInfo {
  estimatedRemainingMs: number;
  estimatedRemaining: string;
  estimateConfidence: 'low' | 'medium' | 'high' | 'no-data';
  estimatedCompletionTime: string | null;
}

// ============================================================================
// Timestamp Formatting
// ============================================================================

/**
 * Format an ISO timestamp to a human-readable relative time
 * e.g., "2 minutes ago", "just now", "1 hour ago"
 */
export function formatRelativeTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Format an ISO timestamp to a display time (HH:MM:SS)
 */
export function formatDisplayTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Calculate elapsed time between two ISO timestamps
 * Returns human-readable format like "1m 30s" or "2h 15m"
 */
export function calculateElapsed(startIso: string, endIso?: string): string {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date();
  const diffMs = end.getTime() - start.getTime();

  if (diffMs < 0) return '0s';

  const seconds = Math.floor(diffMs / 1000) % 60;
  const minutes = Math.floor(diffMs / (1000 * 60)) % 60;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

// ============================================================================
// Progress Calculation
// ============================================================================

/**
 * Count total and completed phases in the progress structure
 */
export function countPhases(progress: CompiledProgress): { total: number; completed: number } {
  let total = 0;
  let completed = 0;

  for (const topPhase of progress.phases ?? []) {
    if (topPhase.steps) {
      // For-each phase: count sub-phases within each step
      for (const step of topPhase.steps) {
        for (const subPhase of step.phases) {
          total++;
          if (subPhase.status === 'completed' || subPhase.status === 'skipped') {
            completed++;
          }
        }
      }
    } else {
      // Simple phase (no steps)
      total++;
      if (topPhase.status === 'completed' || topPhase.status === 'skipped') {
        completed++;
      }
    }
  }

  return { total, completed };
}

/**
 * Calculate progress percentage (0-100)
 */
export function calculateProgressPercent(progress: CompiledProgress): number {
  const { total, completed } = countPhases(progress);
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Count total steps (leaf-level phases) for "Step X of Y" display
 * Returns the total number of leaf-level phases (sub-phases) across all steps
 */
export function countTotalSteps(progress: CompiledProgress): number {
  let total = 0;
  for (const topPhase of progress.phases ?? []) {
    if (topPhase.steps) {
      for (const step of topPhase.steps) {
        total += step.phases.length;
      }
    } else {
      total++; // Simple phase counts as 1
    }
  }
  return total;
}

// ============================================================================
// Phase Tree Building
// ============================================================================

/**
 * Get a short label from a phase/step ID
 * e.g., "execute-all" -> "execute-all", "step-0" -> "step-0"
 */
function getLabel(id: string, prompt?: string): string {
  // Use ID as label, but could enhance with prompt excerpt if needed
  if (prompt && prompt.length <= 30) {
    return prompt;
  }
  return id;
}

/**
 * Compute elapsed for in-progress nodes that have startedAt but no elapsed
 * BUG-007 FIX: In-progress steps now show duration computed from startedAt
 */
function computeElapsedIfNeeded(
  existingElapsed: string | undefined,
  startedAt: string | undefined,
  status: PhaseStatus
): string | undefined {
  // If we already have elapsed, use it
  if (existingElapsed) {
    return existingElapsed;
  }
  // Compute elapsed for in-progress nodes with a start time
  if (startedAt && status === 'in-progress') {
    return calculateElapsed(startedAt);
  }
  return undefined;
}

/**
 * Build a PhaseTreeNode from a CompiledPhase (leaf node)
 */
function buildSubPhaseNode(phase: CompiledPhase, depth: number): PhaseTreeNode {
  return {
    id: phase.id,
    label: getLabel(phase.id, phase.prompt),
    status: phase.status,
    type: 'sub-phase',
    depth,
    startedAt: phase['started-at'],
    completedAt: phase['completed-at'],
    elapsed: computeElapsedIfNeeded(phase.elapsed, phase['started-at'], phase.status),
    error: phase.error,
    'retry-count': phase['retry-count'],
    'next-retry-at': phase['next-retry-at'],
    'error-category': phase['error-category'],
  };
}

/**
 * Infer step status based on the current pointer position
 * This handles the case where the runtime hasn't updated step.status
 * but we can infer the correct status from the current pointer
 */
function inferStepStatus(
  step: CompiledStep,
  stepIndex: number,
  currentStepIndex: number | null,
  phaseStatus: PhaseStatus
): PhaseStatus {
  // If step already has a non-pending status, trust it
  if (step.status !== 'pending') {
    return step.status;
  }

  // If the phase is not in-progress, steps should remain pending
  if (phaseStatus !== 'in-progress') {
    return step.status;
  }

  // Infer status based on current pointer
  if (currentStepIndex === null) {
    return step.status;
  }

  if (stepIndex < currentStepIndex) {
    // Steps before current are completed (unless explicitly failed/blocked)
    return 'completed';
  } else if (stepIndex === currentStepIndex) {
    // Current step is in-progress
    return 'in-progress';
  }

  // Steps after current remain pending
  return step.status;
}

/**
 * Build a PhaseTreeNode from a CompiledStep (contains sub-phases)
 */
function buildStepNode(
  step: CompiledStep,
  depth: number,
  stepIndex?: number,
  currentStepIndex?: number | null,
  phaseStatus?: PhaseStatus
): PhaseTreeNode {
  // Infer status if current pointer info is provided
  const status =
    stepIndex !== undefined && currentStepIndex !== undefined && phaseStatus !== undefined
      ? inferStepStatus(step, stepIndex, currentStepIndex, phaseStatus)
      : step.status;

  return {
    id: step.id,
    label: getLabel(step.id, step.prompt),
    status,
    type: 'step',
    depth,
    children: step.phases.map((p) => buildSubPhaseNode(p, depth + 1)),
    startedAt: step['started-at'],
    completedAt: step['completed-at'],
    elapsed: computeElapsedIfNeeded(step.elapsed, step['started-at'], status),
    error: step.error,
    'retry-count': step['retry-count'],
    'next-retry-at': step['next-retry-at'],
    'error-category': step['error-category'],
  };
}

/**
 * Build a PhaseTreeNode from a CompiledTopPhase
 */
function buildTopPhaseNode(
  topPhase: CompiledTopPhase,
  depth: number,
  phaseIndex?: number,
  currentPhaseIndex?: number,
  currentStepIndex?: number | null
): PhaseTreeNode {
  const node: PhaseTreeNode = {
    id: topPhase.id,
    label: getLabel(topPhase.id, topPhase.prompt),
    status: topPhase.status,
    type: 'phase',
    depth,
    startedAt: topPhase['started-at'],
    completedAt: topPhase['completed-at'],
    elapsed: computeElapsedIfNeeded(topPhase.elapsed, topPhase['started-at'], topPhase.status),
    error: topPhase.error,
    'retry-count': topPhase['retry-count'],
    'next-retry-at': topPhase['next-retry-at'],
    'error-category': topPhase['error-category'],
  };

  if (topPhase.steps) {
    // Only pass current step index if this is the current phase
    const isCurrentPhase = phaseIndex !== undefined && phaseIndex === currentPhaseIndex;
    const stepCurrentIndex = isCurrentPhase ? currentStepIndex : null;

    node.children = topPhase.steps.map((s, idx) =>
      buildStepNode(s, depth + 1, idx, stepCurrentIndex, topPhase.status)
    );
  }

  return node;
}

/**
 * Build the complete phase tree from CompiledProgress
 * Uses the current pointer to infer step statuses when they haven't been
 * explicitly updated by the runtime (fixes BUG-001)
 */
export function buildPhaseTree(progress: CompiledProgress): PhaseTreeNode[] {
  const currentPhaseIndex = progress.current?.phase;
  const currentStepIndex = progress.current?.step;

  return (progress.phases ?? []).map((p, idx) =>
    buildTopPhaseNode(p, 0, idx, currentPhaseIndex, currentStepIndex)
  );
}

// ============================================================================
// Current Task Extraction
// ============================================================================

/**
 * Build the path string for the current task position
 */
function buildCurrentPath(
  progress: CompiledProgress,
  phaseIdx: number,
  stepIdx: number | null,
  subPhaseIdx: number | null
): string {
  const parts: string[] = [];

  if (phaseIdx >= 0 && phaseIdx < (progress.phases?.length ?? 0)) {
    const phase = progress.phases![phaseIdx];
    parts.push(phase.id);

    if (stepIdx !== null && phase.steps && stepIdx >= 0 && stepIdx < phase.steps.length) {
      const step = phase.steps[stepIdx];
      parts.push(step.id);

      if (subPhaseIdx !== null && subPhaseIdx >= 0 && subPhaseIdx < step.phases.length) {
        const subPhase = step.phases[subPhaseIdx];
        parts.push(subPhase.id);
      }
    }
  }

  return parts.join(' > ');
}

/**
 * Extract the current task from the progress pointer
 */
export function extractCurrentTask(progress: CompiledProgress): CurrentTask | null {
  const { phase: phaseIdx, step: stepIdx, 'sub-phase': subPhaseIdx } = progress.current;

  if (phaseIdx < 0 || phaseIdx >= (progress.phases?.length ?? 0)) {
    return null;
  }

  const phase = progress.phases![phaseIdx];

  // If we're not in-progress, no current task
  if (progress.status !== 'in-progress') {
    return null;
  }

  // Determine the prompt and started time
  let prompt: string | undefined;
  let startedAt: string | undefined;

  if (stepIdx !== null && phase.steps && stepIdx >= 0 && stepIdx < phase.steps.length) {
    const step = phase.steps[stepIdx];

    if (subPhaseIdx !== null && subPhaseIdx >= 0 && subPhaseIdx < step.phases.length) {
      const subPhase = step.phases[subPhaseIdx];
      prompt = subPhase.prompt;
      startedAt = subPhase['started-at'];
    } else {
      prompt = step.prompt;
      startedAt = step['started-at'];
    }
  } else {
    prompt = phase.prompt;
    startedAt = phase['started-at'];
  }

  if (!prompt) {
    return null;
  }

  const path = buildCurrentPath(progress, phaseIdx, stepIdx, subPhaseIdx);

  return {
    path,
    prompt,
    startedAt,
    elapsed: startedAt ? calculateElapsed(startedAt) : undefined,
  };
}

// ============================================================================
// Log Entry Generation
// ============================================================================

let logIdCounter = 0;

/**
 * Generate a unique log entry ID
 */
function generateLogId(): string {
  return `log-${Date.now()}-${++logIdCounter}`;
}

/**
 * Determine log entry type from phase status
 */
function statusToLogType(status: PhaseStatus): LogEntryType {
  switch (status) {
    case 'in-progress':
      return 'start';
    case 'completed':
      return 'complete';
    case 'failed':
    case 'blocked':
      return 'error';
    case 'skipped':
      return 'skip';
    default:
      return 'info';
  }
}

/**
 * Generate a log message for a status change
 */
function statusToMessage(status: PhaseStatus, context: string): string {
  switch (status) {
    case 'in-progress':
      return `Started: ${context}`;
    case 'completed':
      return `Completed: ${context}`;
    case 'failed':
      return `Failed: ${context}`;
    case 'blocked':
      return `Blocked: ${context}`;
    case 'skipped':
      return `Skipped: ${context}`;
    default:
      return `${status}: ${context}`;
  }
}

/**
 * Create a log entry for a status change
 */
export function createLogEntry(
  type: LogEntryType,
  message: string,
  context?: string,
  timestamp?: string
): LogEntry {
  return {
    id: generateLogId(),
    type,
    message,
    timestamp: timestamp || new Date().toISOString(),
    context,
  };
}

/**
 * Create a log entry from a phase status change
 */
export function createStatusLogEntry(
  status: PhaseStatus,
  phasePath: string,
  timestamp?: string
): LogEntry {
  return createLogEntry(
    statusToLogType(status),
    statusToMessage(status, phasePath),
    phasePath,
    timestamp
  );
}

/**
 * Compare two progress states and generate log entries for changes
 * This is useful for detecting status transitions
 */
export function generateDiffLogEntries(
  oldProgress: CompiledProgress | null,
  newProgress: CompiledProgress
): LogEntry[] {
  const entries: LogEntry[] = [];

  // Helper to track phase paths and statuses
  function collectPhaseStatuses(
    progress: CompiledProgress
  ): Map<string, { status: PhaseStatus; startedAt?: string; completedAt?: string }> {
    const result = new Map<
      string,
      { status: PhaseStatus; startedAt?: string; completedAt?: string }
    >();

    for (const phase of progress.phases ?? []) {
      const phasePath = phase.id;
      result.set(phasePath, {
        status: phase.status,
        startedAt: phase['started-at'],
        completedAt: phase['completed-at'],
      });

      if (phase.steps) {
        for (const step of phase.steps) {
          const stepPath = `${phasePath} > ${step.id}`;
          result.set(stepPath, {
            status: step.status,
            startedAt: step['started-at'],
            completedAt: step['completed-at'],
          });

          for (const subPhase of step.phases) {
            const subPhasePath = `${stepPath} > ${subPhase.id}`;
            result.set(subPhasePath, {
              status: subPhase.status,
              startedAt: subPhase['started-at'],
              completedAt: subPhase['completed-at'],
            });
          }
        }
      }
    }

    return result;
  }

  const oldStatuses = oldProgress ? collectPhaseStatuses(oldProgress) : new Map();
  const newStatuses = collectPhaseStatuses(newProgress);

  // Find status changes
  for (const [path, newInfo] of newStatuses) {
    const oldInfo = oldStatuses.get(path);

    if (!oldInfo || oldInfo.status !== newInfo.status) {
      // Status changed or new phase
      const timestamp =
        newInfo.status === 'completed'
          ? newInfo.completedAt
          : newInfo.status === 'in-progress'
            ? newInfo.startedAt
            : undefined;

      entries.push(createStatusLogEntry(newInfo.status, path, timestamp));
    }
  }

  return entries;
}

// ============================================================================
// Staleness Detection
// ============================================================================

/** Staleness threshold: 15 minutes in milliseconds */
const STALE_THRESHOLD_MS = 15 * 60 * 1000;

/**
 * Check if a sprint is stale based on last-activity timestamp.
 * A sprint is stale if it's in-progress but the last-activity was > 15 minutes ago.
 */
export function isSprintStale(progress: CompiledProgress): boolean {
  if (progress.status !== 'in-progress') {
    return false;
  }

  const lastActivity = (progress as unknown as { 'last-activity'?: string })['last-activity'];
  if (!lastActivity) {
    return false;
  }

  const elapsed = Date.now() - new Date(lastActivity).getTime();
  return elapsed > STALE_THRESHOLD_MS;
}

// ============================================================================
// Main Transform Function
// ============================================================================

/**
 * Convert CompiledProgress to StatusUpdate format
 * This is the main entry point for transforming progress data for the UI
 */
export function toStatusUpdate(
  progress: CompiledProgress,
  includeRaw: boolean = false,
  timingInfo?: TimingInfo
): StatusUpdate {
  const { total, completed } = countPhases(progress);

  // Build the header
  const header: SprintHeader = {
    sprintId: progress['sprint-id'],
    status: progress.status,
    progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    completedPhases: completed,
    totalPhases: total,
    startedAt: progress.stats['started-at'] || undefined,
    elapsed: progress.stats.elapsed,
  };

  // Add iteration info if available (from enhanced SprintStats)
  // Use type assertion through unknown to access potential extra fields
  const stats = progress.stats as unknown as Record<string, unknown>;
  if (typeof stats['current-iteration'] === 'number') {
    header.currentIteration = stats['current-iteration'];
  }
  if (typeof stats['max-iterations'] === 'number') {
    header.maxIterations = stats['max-iterations'];
  }

  // Add timing estimates if available
  if (timingInfo) {
    header.estimatedRemainingMs = timingInfo.estimatedRemainingMs;
    header.estimatedRemaining = timingInfo.estimatedRemaining;
    header.estimateConfidence = timingInfo.estimateConfidence;
    if (timingInfo.estimatedCompletionTime) {
      header.estimatedCompletionTime = timingInfo.estimatedCompletionTime;
    }
  }

  // Add step progress info for "Step X of Y" display
  const totalSteps = countTotalSteps(progress);
  header.totalSteps = totalSteps;
  // currentStep is 1-indexed: completed + 1 (for display "Step 3 of 5")
  header.currentStep = progress.status === 'in-progress' ? completed + 1 : completed;

  // Add staleness detection
  header.isStale = isSprintStale(progress);

  // Build the phase tree
  const phaseTree = buildPhaseTree(progress);

  // Extract current task
  const currentTask = extractCurrentTask(progress);

  const update: StatusUpdate = {
    header,
    phaseTree,
    currentTask,
  };

  // Optionally include raw progress data for debugging
  if (includeRaw) {
    update.raw = progress;
  }

  return update;
}

// ============================================================================
// Dependency Graph Transformation
// ============================================================================

/**
 * Map PhaseStatus to a visualization color
 */
export function statusToColor(status: PhaseStatus): GraphNodeStatusColor {
  switch (status) {
    case 'pending':
      return 'gray';
    case 'in-progress':
      return 'blue';
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    case 'blocked':
      return 'orange';
    case 'skipped':
      return 'yellow';
    default:
      return 'gray';
  }
}

/**
 * Truncate a string to a maximum length with ellipsis
 */
function truncateLabel(text: string, maxLength: number = 40): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generate a human-readable blocked-by label
 * e.g., "Waiting for step-A, step-B"
 */
function formatBlockedByLabel(blockedBy: string[]): string | undefined {
  if (blockedBy.length === 0) {
    return undefined;
  }
  if (blockedBy.length === 1) {
    return `Waiting for ${blockedBy[0]}`;
  }
  if (blockedBy.length === 2) {
    return `Waiting for ${blockedBy[0]} and ${blockedBy[1]}`;
  }
  return `Waiting for ${blockedBy[0]}, ${blockedBy[1]}, and ${blockedBy.length - 2} more`;
}

/**
 * Perform topological sort and assign layout positions
 * Uses Kahn's algorithm to determine row positions (depth in DAG)
 * Nodes at the same depth are assigned columns left-to-right
 */
function computeLayout(
  nodes: Map<string, { dependsOn: string[]; dependents: string[] }>
): Map<string, { row: number; column: number }> {
  const layout = new Map<string, { row: number; column: number }>();
  const inDegree = new Map<string, number>();
  const nodeIds = Array.from(nodes.keys());

  // Initialize in-degrees
  for (const id of nodeIds) {
    const node = nodes.get(id)!;
    inDegree.set(id, node.dependsOn.filter(dep => nodes.has(dep)).length);
  }

  // Find nodes with no dependencies (in-degree 0) - these are row 0
  let currentRow = 0;
  let currentQueue: string[] = [];

  for (const id of nodeIds) {
    if (inDegree.get(id) === 0) {
      currentQueue.push(id);
    }
  }

  // Process nodes level by level
  while (currentQueue.length > 0) {
    // Assign positions to all nodes in current row
    currentQueue.sort(); // Deterministic ordering
    for (let col = 0; col < currentQueue.length; col++) {
      layout.set(currentQueue[col], { row: currentRow, column: col });
    }

    // Find next level nodes
    const nextQueue: string[] = [];
    for (const id of currentQueue) {
      const node = nodes.get(id)!;
      for (const depId of node.dependents) {
        if (!nodes.has(depId)) continue;
        const newDegree = (inDegree.get(depId) ?? 0) - 1;
        inDegree.set(depId, newDegree);
        if (newDegree === 0 && !layout.has(depId)) {
          nextQueue.push(depId);
        }
      }
    }

    currentQueue = nextQueue;
    currentRow++;
  }

  // Handle any remaining nodes (cycles - should not happen with validated DAG)
  for (const id of nodeIds) {
    if (!layout.has(id)) {
      layout.set(id, { row: currentRow, column: 0 });
    }
  }

  return layout;
}

/**
 * Build dependency graph for a single for-each phase
 */
export function buildDependencyGraphForPhase(
  phase: CompiledTopPhase,
  depGraphs: CompiledDependencyGraph[],
  injectedStepIds: Set<string>
): DependencyGraph | null {
  // Only process phases with steps
  if (!phase.steps || phase.steps.length === 0) {
    return null;
  }

  // Find the dependency graph for this phase
  const depGraph = depGraphs.find(g => g['phase-id'] === phase.id);

  // Create a lookup map for dependency info
  const depNodeMap = new Map<string, CompiledDependencyNode>();
  if (depGraph) {
    for (const node of depGraph.nodes) {
      depNodeMap.set(node.id, node);
    }
  }

  // Build node map for layout computation
  const nodeMap = new Map<string, { dependsOn: string[]; dependents: string[] }>();
  for (const step of phase.steps) {
    const depNode = depNodeMap.get(step.id);
    const stepWithDeps = step as CompiledStep & { 'depends-on'?: string[] };
    const dependsOn = depNode?.['depends-on'] ?? stepWithDeps['depends-on'] ?? [];
    nodeMap.set(step.id, { dependsOn, dependents: [] });
  }

  // Build reverse edges (dependents)
  for (const [id, node] of nodeMap) {
    for (const depId of node.dependsOn) {
      const depNode = nodeMap.get(depId);
      if (depNode) {
        depNode.dependents.push(id);
      }
    }
  }

  // Compute layout positions
  const layout = computeLayout(nodeMap);

  // Build GraphNode array
  const graphNodes: GraphNode[] = [];
  const stats = {
    totalNodes: 0,
    completedNodes: 0,
    runningNodes: 0,
    blockedNodes: 0,
    readyNodes: 0,
    failedNodes: 0,
    skippedNodes: 0,
  };

  let maxRow = 0;
  let maxColumn = 0;

  for (const step of phase.steps) {
    const depNode = depNodeMap.get(step.id);
    const stepWithDeps = step as CompiledStep & { 'depends-on'?: string[] };
    const dependsOn = depNode?.['depends-on'] ?? stepWithDeps['depends-on'] ?? [];
    const blockedBy = depNode?.['blocked-by'] ?? [];
    const nodeInfo = nodeMap.get(step.id)!;
    const pos = layout.get(step.id) ?? { row: 0, column: 0 };

    // Determine if step is ready (blocked-by empty and status pending)
    const isReady = blockedBy.length === 0 && step.status === 'pending';
    const isRunning = step.status === 'in-progress';
    const isInjected = injectedStepIds.has(step.id);

    // Get label from step prompt
    const label = truncateLabel(step.prompt || step.id);

    // Compute elapsed time for in-progress steps
    const elapsed = computeElapsedIfNeeded(step.elapsed, step['started-at'], step.status);

    const graphNode: GraphNode = {
      id: step.id,
      label,
      status: step.status,
      statusColor: statusToColor(step.status),
      dependsOn,
      dependents: nodeInfo.dependents,
      blockedBy,
      isInjected,
      isRunning,
      isReady,
      layoutRow: pos.row,
      layoutColumn: pos.column,
      phaseId: phase.id,
      blockedByLabel: formatBlockedByLabel(blockedBy),
      startedAt: step['started-at'],
      completedAt: step['completed-at'],
      elapsed,
      error: step.error,
    };

    graphNodes.push(graphNode);

    // Update stats
    stats.totalNodes++;
    switch (step.status) {
      case 'completed':
        stats.completedNodes++;
        break;
      case 'in-progress':
        stats.runningNodes++;
        break;
      case 'blocked':
        stats.blockedNodes++;
        break;
      case 'failed':
        stats.failedNodes++;
        break;
      case 'skipped':
        stats.skippedNodes++;
        break;
      case 'pending':
        if (isReady) {
          stats.readyNodes++;
        } else {
          stats.blockedNodes++;
        }
        break;
    }

    // Track max dimensions
    if (pos.row > maxRow) maxRow = pos.row;
    if (pos.column > maxColumn) maxColumn = pos.column;
  }

  // Build edges
  const edges: GraphEdge[] = [];
  for (const node of graphNodes) {
    for (const depId of node.dependsOn) {
      // Find the source node to determine edge status
      const sourceNode = graphNodes.find(n => n.id === depId);
      let edgeStatus: GraphEdge['status'] = 'pending';
      if (sourceNode) {
        if (sourceNode.status === 'completed') {
          edgeStatus = 'satisfied';
        } else if (sourceNode.status === 'failed' || sourceNode.status === 'skipped') {
          edgeStatus = 'failed';
        }
      }

      edges.push({
        from: depId,
        to: node.id,
        status: edgeStatus,
      });
    }
  }

  // Check if parallel execution is enabled
  // A phase has parallel execution if it has a dependency graph
  const parallelEnabled = depGraph !== undefined && depGraph.nodes.length > 0;

  return {
    phaseId: phase.id,
    phaseLabel: phase.prompt ? truncateLabel(phase.prompt) : phase.id,
    nodes: graphNodes,
    edges,
    stats,
    maxRow,
    maxColumn,
    parallelEnabled,
  };
}

/**
 * Build all dependency graphs from CompiledProgress
 * Returns an array of DependencyGraph objects for phases with dependencies
 */
export function buildDependencyGraphs(progress: CompiledProgress): DependencyGraph[] {
  const graphs: DependencyGraph[] = [];

  // Get dependency graphs from PROGRESS.yaml
  const depGraphs = (progress as unknown as { 'dependency-graph'?: CompiledDependencyGraph[] })['dependency-graph'] ?? [];

  // Get set of injected step IDs (from step-queue or marked with injected flag)
  const injectedStepIds = new Set<string>();
  const stepQueue = (progress as unknown as { 'step-queue'?: { id: string }[] })['step-queue'];
  if (stepQueue) {
    for (const item of stepQueue) {
      injectedStepIds.add(item.id);
    }
  }

  // Check each step for injected flag
  for (const phase of progress.phases ?? []) {
    if (phase.steps) {
      for (const step of phase.steps) {
        const stepWithMeta = step as CompiledStep & { injected?: boolean };
        if (stepWithMeta.injected) {
          injectedStepIds.add(step.id);
        }
      }
    }
  }

  // Build graph for each phase with steps
  for (const phase of progress.phases ?? []) {
    const graph = buildDependencyGraphForPhase(phase, depGraphs, injectedStepIds);
    if (graph && graph.nodes.length > 0) {
      graphs.push(graph);
    }
  }

  return graphs;
}

/**
 * Extended version of toStatusUpdate that includes dependency graphs
 */
export function toStatusUpdateWithGraph(
  progress: CompiledProgress,
  includeRaw: boolean = false,
  timingInfo?: TimingInfo
): StatusUpdateWithGraph {
  // Get the base status update
  const baseUpdate = toStatusUpdate(progress, includeRaw, timingInfo);

  // Build dependency graphs
  const dependencyGraphs = buildDependencyGraphs(progress);

  // Check if any phase has parallel execution
  const hasParallelExecution = dependencyGraphs.some(g => g.parallelEnabled);

  return {
    ...baseUpdate,
    dependencyGraphs: dependencyGraphs.length > 0 ? dependencyGraphs : undefined,
    hasParallelExecution: hasParallelExecution || undefined,
  };
}
