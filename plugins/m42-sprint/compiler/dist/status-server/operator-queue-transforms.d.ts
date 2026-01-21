/**
 * Transform functions for Operator Queue data
 * Converts PROGRESS.yaml operator-queue and BACKLOG.yaml to display format
 */
import type { CompiledProgress } from './status-types.js';
export interface OperatorRequestContext {
    discoveredIn: string;
    relatedFiles?: string[];
    codeSnippet?: string;
    suggestedWorkflow?: string;
}
export interface OperatorRequest {
    id: string;
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    type: 'bug' | 'improvement' | 'refactor' | 'test' | 'docs' | 'security';
    context?: OperatorRequestContext;
}
export interface InjectionConfig {
    position: {
        type: 'after-current' | 'end-of-phase';
    };
    prompt?: string;
    workflow?: string;
    idPrefix: string;
}
export interface OperatorDecision {
    requestId: string;
    decision: 'approve' | 'reject' | 'defer' | 'backlog';
    reasoning: string;
    injection?: InjectionConfig;
    deferredUntil?: 'end-of-phase' | 'end-of-sprint' | 'next-sprint';
    rejectionReason?: string;
}
export interface QueuedRequest extends OperatorRequest {
    status: 'pending' | 'approved' | 'rejected' | 'deferred' | 'backlog';
    'created-at': string;
    'discovered-in': string;
    'decided-at'?: string;
    'rejection-reason'?: string;
    'deferred-until'?: 'end-of-phase' | 'end-of-sprint' | 'next-sprint';
    decision?: OperatorDecision;
    'decision-source'?: 'operator' | 'manual';
}
export interface BacklogItemSource {
    'request-id': string;
    'discovered-in': string;
    'discovered-at': string;
}
export interface BacklogItem {
    id: string;
    title: string;
    description: string;
    category: string;
    'suggested-priority': 'high' | 'medium' | 'low';
    'operator-notes': string;
    source: BacklogItemSource;
    'created-at': string;
    status: 'pending-review' | 'acknowledged' | 'converted-to-issue';
}
export interface BacklogFile {
    items: BacklogItem[];
}
export interface OperatorQueueStats {
    pending: number;
    approved: number;
    rejected: number;
    deferred: number;
    backlog: number;
}
export interface OperatorQueueData {
    pending: QueuedRequest[];
    history: QueuedRequest[];
    backlog: BacklogItem[];
    stats: OperatorQueueStats;
}
export interface ManualDecision {
    decision: 'approve' | 'reject' | 'defer';
    reasoning: string;
    deferredUntil?: 'end-of-phase' | 'end-of-sprint' | 'next-sprint';
}
/**
 * Sort requests by priority (critical first, low last)
 */
export declare function sortByPriority(requests: QueuedRequest[]): QueuedRequest[];
/**
 * Calculate queue statistics from requests and backlog
 */
export declare function calculateQueueStats(queue: QueuedRequest[], backlog: BacklogItem[]): OperatorQueueStats;
/**
 * Format an ISO timestamp to a human-readable relative time
 * e.g., "2 min ago", "just now", "1 hour ago"
 */
export declare function formatRelativeTime(isoTimestamp: string): string;
/**
 * Apply a manual decision to a request
 * Updates status, adds decision object, and marks as manual
 */
export declare function applyManualDecision(request: QueuedRequest, decision: ManualDecision): QueuedRequest;
/**
 * Progress type with operator-queue field
 */
interface ProgressWithQueue extends CompiledProgress {
    'operator-queue'?: QueuedRequest[];
}
/**
 * Convert CompiledProgress and BacklogFile to OperatorQueueData
 * Separates pending requests from history, sorts appropriately
 */
export declare function toOperatorQueueData(progress: ProgressWithQueue, backlog: BacklogFile): OperatorQueueData;
export {};
//# sourceMappingURL=operator-queue-transforms.d.ts.map