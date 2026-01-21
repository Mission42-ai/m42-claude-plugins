/**
 * Transform functions for Operator Queue data
 * Converts PROGRESS.yaml operator-queue and BACKLOG.yaml to display format
 */

import type { CompiledProgress } from './status-types.js';

// ============================================================================
// Type Definitions
// ============================================================================

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
  position: { type: 'after-current' | 'end-of-phase' };
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

// ============================================================================
// Priority Ordering
// ============================================================================

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Sort requests by priority (critical first, low last)
 */
export function sortByPriority(requests: QueuedRequest[]): QueuedRequest[] {
  return [...requests].sort((a, b) => {
    const aPriority = PRIORITY_ORDER[a.priority] ?? 999;
    const bPriority = PRIORITY_ORDER[b.priority] ?? 999;
    return aPriority - bPriority;
  });
}

// ============================================================================
// Stats Calculation
// ============================================================================

/**
 * Calculate queue statistics from requests and backlog
 */
export function calculateQueueStats(
  queue: QueuedRequest[],
  backlog: BacklogItem[]
): OperatorQueueStats {
  const stats: OperatorQueueStats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    deferred: 0,
    backlog: backlog.length,
  };

  for (const request of queue) {
    switch (request.status) {
      case 'pending':
        stats.pending++;
        break;
      case 'approved':
        stats.approved++;
        break;
      case 'rejected':
        stats.rejected++;
        break;
      case 'deferred':
        stats.deferred++;
        break;
      // 'backlog' status in queue is counted via backlog array
    }
  }

  return stats;
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Format an ISO timestamp to a human-readable relative time
 * e.g., "2 min ago", "just now", "1 hour ago"
 */
export function formatRelativeTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// ============================================================================
// Manual Decision Application
// ============================================================================

/**
 * Apply a manual decision to a request
 * Updates status, adds decision object, and marks as manual
 */
export function applyManualDecision(
  request: QueuedRequest,
  decision: ManualDecision
): QueuedRequest {
  const updated: QueuedRequest = { ...request };
  const now = new Date().toISOString();

  // Map decision to status
  switch (decision.decision) {
    case 'approve':
      updated.status = 'approved';
      break;
    case 'reject':
      updated.status = 'rejected';
      break;
    case 'defer':
      updated.status = 'deferred';
      if (decision.deferredUntil) {
        updated['deferred-until'] = decision.deferredUntil;
      }
      break;
  }

  updated['decided-at'] = now;
  updated['decision-source'] = 'manual';
  updated.decision = {
    requestId: request.id,
    decision: decision.decision,
    reasoning: `Manual: ${decision.reasoning}`,
    deferredUntil: decision.deferredUntil,
  };

  return updated;
}

// ============================================================================
// Main Transform Function
// ============================================================================

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
export function toOperatorQueueData(
  progress: ProgressWithQueue,
  backlog: BacklogFile
): OperatorQueueData {
  const queue = progress['operator-queue'] ?? [];
  const backlogItems = backlog.items ?? [];

  // Separate pending from decided requests
  const pending: QueuedRequest[] = [];
  const history: QueuedRequest[] = [];

  for (const request of queue) {
    if (request.status === 'pending') {
      pending.push(request);
    } else if (
      request.status === 'approved' ||
      request.status === 'rejected' ||
      request.status === 'deferred'
    ) {
      history.push(request);
    }
  }

  // Sort pending by priority (critical first)
  const sortedPending = sortByPriority(pending);

  // Sort history by decided-at descending (most recent first)
  const sortedHistory = [...history].sort((a, b) => {
    const aTime = a['decided-at'] ? new Date(a['decided-at']).getTime() : 0;
    const bTime = b['decided-at'] ? new Date(b['decided-at']).getTime() : 0;
    return bTime - aTime;
  });

  // Calculate stats
  const stats = calculateQueueStats(queue, backlogItems);

  return {
    pending: sortedPending,
    history: sortedHistory,
    backlog: backlogItems,
    stats,
  };
}
