/**
 * Operator Module - Operator Request System
 *
 * This module handles:
 * - Processing pending operator requests
 * - Executing operator decisions (approve/reject/defer/backlog)
 * - Loading operator prompts from skills
 * - Creating context for operator decision making
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { addBacklogItem, type BacklogItem } from './backlog.js';

// ============================================================================
// Types - Operator Request (from agent)
// ============================================================================

/**
 * Request context provided by the discovering agent
 */
export interface OperatorRequestContext {
  /** Phase ID where the issue was discovered */
  discoveredIn: string;
  /** Related source files */
  relatedFiles?: string[];
  /** Relevant code excerpt */
  codeSnippet?: string;
  /** Agent's suggested workflow for fixing */
  suggestedWorkflow?: string;
}

/**
 * Operator request submitted by Claude during phase execution
 */
export interface OperatorRequest {
  /** Unique identifier (nanoid) */
  id: string;
  /** Short description */
  title: string;
  /** Full description of what needs to be done */
  description: string;
  /** Request priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Request type */
  type: 'bug' | 'improvement' | 'refactor' | 'test' | 'docs' | 'security';
  /** Context for operator decision */
  context?: OperatorRequestContext;
}

/**
 * Queued request in PROGRESS.yaml with additional metadata
 */
export interface QueuedRequest extends OperatorRequest {
  /** Request status */
  status: 'pending' | 'approved' | 'rejected' | 'deferred' | 'backlog';
  /** When the request was created */
  'created-at': string;
  /** Phase where request was discovered */
  'discovered-in': string;
  /** When decision was made (if decided) */
  'decided-at'?: string;
  /** Rejection reason (if rejected) */
  'rejection-reason'?: string;
  /** When to revisit (if deferred) */
  'deferred-until'?: 'end-of-phase' | 'end-of-sprint' | 'next-sprint';
  /** Decision details (if decided) */
  decision?: OperatorDecision;
}

// ============================================================================
// Types - Operator Decision (from operator)
// ============================================================================

/**
 * Injection position specification
 */
export interface InsertPosition {
  type: 'after-current' | 'end-of-phase';
}

/**
 * Step injection configuration for approved requests
 */
export interface InjectionConfig {
  /** Workflow to compile (optional) */
  workflow?: string;
  /** Direct prompt if no workflow */
  prompt?: string;
  /** Where to inject */
  position: InsertPosition;
  /** Model override */
  model?: string;
  /** Prefix for generated IDs */
  idPrefix: string;
}

/**
 * Backlog entry configuration for backlogged requests
 */
export interface BacklogEntryConfig {
  /** Category (e.g., 'tech-debt', 'feature', 'investigation') */
  category: string;
  /** Suggested priority for human review */
  suggestedPriority: 'high' | 'medium' | 'low';
  /** Additional context for human */
  notes: string;
}

/**
 * Operator decision for a single request
 */
export interface OperatorDecision {
  /** Which request this decides */
  requestId: string;
  /** The decision */
  decision: 'approve' | 'reject' | 'defer' | 'backlog';
  /** Required: Explain the reasoning */
  reasoning: string;
  /** If approved: injection details */
  injection?: InjectionConfig;
  /** If deferred: when to revisit */
  deferredUntil?: 'end-of-phase' | 'end-of-sprint' | 'next-sprint';
  /** If backlog: for human review */
  backlogEntry?: BacklogEntryConfig;
  /** If rejected: why */
  rejectionReason?: string;
}

/**
 * Complete operator response
 */
export interface OperatorResponse {
  /** Decisions for each request */
  decisions: OperatorDecision[];
  /** Summary of operator's analysis */
  operatorLog: string;
  /** When the response was generated */
  timestamp: string;
}

// ============================================================================
// Types - Operator Configuration
// ============================================================================

/**
 * Operator configuration from workflow or sprint
 */
export interface OperatorConfig {
  /** Whether operator is enabled */
  enabled: boolean;
  /** Model for operator (default: sonnet) */
  model?: string;
  /** Skill to use (default: sprint-operator) */
  skill?: string;
  /** Custom prompt (overrides skill if provided) */
  prompt?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPERATOR_SKILL = 'sprint-operator';

/** Default injection position for approved requests */
const DEFAULT_INJECT_POSITION: InsertPosition = { type: 'after-current' };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an approval decision for a request
 */
function createApprovalDecision(
  request: QueuedRequest,
  reasoning: string,
  promptPrefix: string
): OperatorDecision {
  return {
    requestId: request.id,
    decision: 'approve',
    reasoning,
    injection: {
      position: DEFAULT_INJECT_POSITION,
      prompt: `${promptPrefix}: ${request.title}\n\n${request.description}`,
      idPrefix: `fix-${request.id}`,
    },
  };
}

/**
 * Create a decision based on request priority and type
 */
function createDecisionForRequest(request: QueuedRequest): OperatorDecision {
  // Critical security issues should be approved
  if (request.priority === 'critical' && request.type === 'security') {
    return createApprovalDecision(
      request,
      'Critical security issue - must be addressed immediately',
      'Fix the security issue'
    );
  }

  // High priority bugs should be approved
  if (request.priority === 'high' && request.type === 'bug') {
    return createApprovalDecision(
      request,
      'High priority bug - should be fixed before proceeding',
      'Fix the bug'
    );
  }

  // Low priority items go to backlog
  if (request.priority === 'low') {
    return {
      requestId: request.id,
      decision: 'backlog',
      reasoning: 'Low priority - added to backlog for human review',
      backlogEntry: {
        category: request.type === 'docs' ? 'documentation' : 'tech-debt',
        suggestedPriority: 'low',
        notes: `Discovered during sprint execution. ${request.description}`,
      },
    };
  }

  // Medium priority gets deferred to end of phase
  return {
    requestId: request.id,
    decision: 'defer',
    reasoning: 'Medium priority - will review at end of current phase',
    deferredUntil: 'end-of-phase',
  };
}

/**
 * Find skill path in common locations
 */
function findSkillPath(skillName: string): string | null {
  const locations = [
    // Plugin skills directory
    path.join(process.cwd(), 'plugins/m42-sprint/skills', skillName, 'skill.md'),
    // Current directory skills
    path.join(process.cwd(), 'skills', skillName, 'skill.md'),
    // .claude/skills directory
    path.join(process.cwd(), '.claude/skills', skillName, 'skill.md'),
  ];

  for (const location of locations) {
    if (fs.existsSync(location)) {
      return location;
    }
  }

  return null;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Process pending operator requests and return decisions
 *
 * @param requests - Queued requests to process
 * @param config - Operator configuration
 * @param sprintDir - Sprint directory path
 * @returns Promise resolving to OperatorResponse
 */
export async function processOperatorRequests(
  requests: QueuedRequest[],
  config: OperatorConfig,
  _sprintDir: string
): Promise<OperatorResponse> {
  // Filter to only pending requests
  const pendingRequests = requests.filter((r) => r.status === 'pending');

  if (pendingRequests.length === 0) {
    return {
      decisions: [],
      operatorLog: 'No pending requests to process',
      timestamp: new Date().toISOString(),
    };
  }

  // Load operator prompt
  const operatorPrompt = await loadOperatorPrompt(config);

  // For now, create auto-decisions based on priority
  // In a full implementation, this would invoke Claude with the operator prompt
  const decisions: OperatorDecision[] = pendingRequests.map((request) =>
    createDecisionForRequest(request)
  );

  return {
    decisions,
    operatorLog: `Processed ${pendingRequests.length} pending requests. Operator prompt loaded: ${operatorPrompt.length > 0 ? 'yes' : 'no'}`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Execute a single operator decision
 *
 * @param decision - The decision to execute
 * @param request - The original request
 * @param sprintDir - Sprint directory path
 */
export async function executeOperatorDecision(
  decision: OperatorDecision,
  request: QueuedRequest,
  sprintDir: string
): Promise<void> {
  const decidedAt = new Date().toISOString();

  // Map decision type to request status
  const statusMap: Record<OperatorDecision['decision'], QueuedRequest['status']> = {
    approve: 'approved',
    reject: 'rejected',
    defer: 'deferred',
    backlog: 'backlog',
  };

  // Common fields for all decision types
  request.status = statusMap[decision.decision];
  request['decided-at'] = decidedAt;
  request.decision = decision;

  // Decision-specific handling
  switch (decision.decision) {
    case 'approve':
      // Injection happens in the caller (loop.ts) since it needs access to PROGRESS.yaml
      break;

    case 'reject':
      request['rejection-reason'] = decision.rejectionReason || decision.reasoning;
      break;

    case 'defer':
      request['deferred-until'] = decision.deferredUntil;
      break;

    case 'backlog':
      if (decision.backlogEntry) {
        const backlogItem: BacklogItem = {
          id: request.id,
          title: request.title,
          description: request.description,
          category: decision.backlogEntry.category,
          'suggested-priority': decision.backlogEntry.suggestedPriority,
          'operator-notes': decision.backlogEntry.notes,
          source: {
            'request-id': request.id,
            'discovered-in': request['discovered-in'],
            'discovered-at': request['created-at'],
          },
          'created-at': decidedAt,
          status: 'pending-review',
        };
        addBacklogItem(sprintDir, backlogItem);
      }
      break;
  }
}

/**
 * Load operator prompt from skill or config
 *
 * @param config - Operator configuration
 * @returns Promise resolving to the operator prompt string
 */
export async function loadOperatorPrompt(config: OperatorConfig): Promise<string> {
  // If custom prompt provided, use it directly
  if (config.prompt) {
    return config.prompt;
  }

  // Load from skill file
  const skillName = config.skill || DEFAULT_OPERATOR_SKILL;
  const skillPath = findSkillPath(skillName);

  if (!skillPath) {
    // Return default inline prompt if skill file not found
    return getDefaultOperatorPrompt();
  }

  return fs.readFileSync(skillPath, 'utf8');
}

/**
 * Get the default operator prompt (inline fallback)
 */
function getDefaultOperatorPrompt(): string {
  return `# Sprint Operator

You are the sprint operator responsible for reviewing discovered issues
and deciding how to handle them.

## Your Responsibilities

1. **Triage**: Assess each request's urgency and relevance
2. **Decide**: Choose appropriate action (approve/reject/defer/backlog)
3. **Reason**: Always explain your decision clearly
4. **Place**: If approving, determine optimal injection point

## Decision Guidelines

### Approve when:
- Issue blocks current sprint progress
- Fix is small and well-defined
- Directly related to sprint goals

### Reject when:
- Request is invalid or duplicate
- Already addressed elsewhere
- Not actually an issue

### Defer when:
- Valid but not urgent
- Can wait until later in sprint
- Dependencies not yet ready

### Backlog when:
- Valid but out of scope for sprint
- Needs human review/discussion
- Significant scope or architectural impact
- "Nice to have" improvements
`;
}

/**
 * Create context for operator decision making
 *
 * @param request - The request to create context for
 * @param sprintDir - Sprint directory path
 * @returns Context object for operator
 */
export function createOperatorContext(
  request: QueuedRequest,
  sprintDir: string
): Record<string, unknown> {
  // Read sprint progress to get goals and current state
  const progressPath = path.join(sprintDir, 'PROGRESS.yaml');
  let progress: Record<string, unknown> = {};

  if (fs.existsSync(progressPath)) {
    const content = fs.readFileSync(progressPath, 'utf8');
    progress = yaml.load(content) as Record<string, unknown>;
  }

  return {
    request: {
      id: request.id,
      title: request.title,
      description: request.description,
      priority: request.priority,
      type: request.type,
      discoveredIn: request['discovered-in'],
      createdAt: request['created-at'],
      context: request.context,
    },
    sprint: {
      id: progress['sprint-id'],
      status: progress.status,
      currentPhase: progress.current,
      totalPhases: (progress.stats as Record<string, unknown>)?.['total-phases'],
      completedPhases: (progress.stats as Record<string, unknown>)?.['completed-phases'],
    },
  };
}
