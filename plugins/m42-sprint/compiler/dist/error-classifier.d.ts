/**
 * Error Classification Module
 *
 * Classifies errors into categories for determining retry strategies:
 * - network: Connection failures, DNS issues
 * - rate-limit: API rate limiting (429 errors)
 * - timeout: Execution timeout exceeded
 * - validation: Schema/input validation failures
 * - logic: Claude reasoning/execution errors
 */
/**
 * Error category types for classification
 */
export type ErrorCategory = 'network' | 'rate-limit' | 'timeout' | 'validation' | 'logic';
/**
 * Result of error classification
 */
export interface ClassificationResult {
    category: ErrorCategory;
    isRetryable: boolean;
    confidence: number;
    matchedPattern?: string;
}
/**
 * Classify an error based on exit code and error message
 *
 * @param exitCode - The exit code from the failed process
 * @param errorMessage - The error message or output
 * @returns Classification result with category and retry recommendation
 */
export declare function classifyError(exitCode: number, errorMessage: string): ClassificationResult;
/**
 * Check if an error category should be retried
 *
 * @param category - The error category
 * @param retryOn - List of categories configured for retry
 * @returns Whether to retry this error
 */
export declare function shouldRetry(category: ErrorCategory, retryOn: ErrorCategory[]): boolean;
/**
 * Get the recommended action for an error category
 *
 * @param category - The error category
 * @returns Recommended action string
 */
export declare function getRecoveryAction(category: ErrorCategory): 'auto-retry' | 'skip' | 'human-intervention';
/**
 * Format an intervention queue entry
 *
 * @param phaseId - ID of the failed phase
 * @param error - Error message
 * @param category - Error category
 * @returns JSON string for intervention queue
 */
export declare function formatInterventionEntry(phaseId: string, error: string, category: ErrorCategory): string;
//# sourceMappingURL=error-classifier.d.ts.map