/**
 * Operator Queue Page Generator
 * Generates HTML page for viewing and managing operator requests
 */
import type { OperatorQueueData, OperatorQueueStats, QueuedRequest, BacklogItem } from './operator-queue-transforms.js';
/**
 * Render a priority badge with appropriate color
 */
export declare function renderPriorityBadge(priority: string): string;
/**
 * Render a collapsible reasoning block
 */
export declare function renderReasoningBlock(reasoning: string): string;
/**
 * Render action buttons for a pending request
 */
export declare function renderActionButtons(requestId: string): string;
/**
 * Render a single pending request card with all details
 */
export declare function renderPendingRequestCard(request: QueuedRequest): string;
/**
 * Render the pending requests section
 */
export declare function renderPendingRequestsSection(requests: QueuedRequest[]): string;
/**
 * Render the decision history section with filter controls
 */
export declare function renderDecisionHistorySection(history: QueuedRequest[]): string;
/**
 * Render the backlog section
 */
export declare function renderBacklogSection(backlog: BacklogItem[]): string;
/**
 * Render queue statistics summary bar
 */
export declare function renderQueueStats(stats: OperatorQueueStats): string;
/**
 * Render navigation badge with pending count
 */
export declare function renderOperatorNavBadge(pendingCount: number): string;
/**
 * Generate the complete operator queue page HTML
 */
export declare function generateOperatorQueuePage(queueData: OperatorQueueData, sprintId: string): string;
//# sourceMappingURL=operator-queue-page.d.ts.map