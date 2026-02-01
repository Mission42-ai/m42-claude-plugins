/**
 * Operator Module - Operator Request System
 *
 * This module handles:
 * - Processing pending operator requests
 * - Executing operator decisions (approve/reject/defer/backlog)
 * - Loading operator prompts from skills
 * - Creating context for operator decision making
 */
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
/**
 * Process pending operator requests and return decisions
 *
 * @param requests - Queued requests to process
 * @param config - Operator configuration
 * @param sprintDir - Sprint directory path
 * @returns Promise resolving to OperatorResponse
 */
export declare function processOperatorRequests(requests: QueuedRequest[], config: OperatorConfig, _sprintDir: string): Promise<OperatorResponse>;
/**
 * Execute a single operator decision
 *
 * @param decision - The decision to execute
 * @param request - The original request
 * @param sprintDir - Sprint directory path
 */
export declare function executeOperatorDecision(decision: OperatorDecision, request: QueuedRequest, sprintDir: string): Promise<void>;
/**
 * Load operator prompt from skill or config
 *
 * @param config - Operator configuration
 * @returns Promise resolving to the operator prompt string
 */
export declare function loadOperatorPrompt(config: OperatorConfig): Promise<string>;
/**
 * Create context for operator decision making
 *
 * @param request - The request to create context for
 * @param sprintDir - Sprint directory path
 * @returns Context object for operator
 */
export declare function createOperatorContext(request: QueuedRequest, sprintDir: string): Record<string, unknown>;
//# sourceMappingURL=operator.d.ts.map