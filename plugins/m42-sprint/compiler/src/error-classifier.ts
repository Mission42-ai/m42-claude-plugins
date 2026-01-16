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
  confidence: number; // 0-1 scale
  matchedPattern?: string;
}

/**
 * Pattern definitions for each error category
 */
const errorPatterns: Record<ErrorCategory, RegExp[]> = {
  'network': [
    /ECONNREFUSED/i,
    /ENOTFOUND/i,
    /ETIMEDOUT/i,
    /ECONNRESET/i,
    /EHOSTUNREACH/i,
    /ENETUNREACH/i,
    /connection.*refused/i,
    /connection.*reset/i,
    /connection.*failed/i,
    /DNS.*failed/i,
    /DNS.*lookup/i,
    /network.*error/i,
    /socket.*hang.*up/i,
    /socket.*closed/i,
    /unable.*to.*connect/i,
  ],
  'rate-limit': [
    /429/,
    /rate.*limit/i,
    /too.*many.*requests/i,
    /throttl/i,
    /quota.*exceeded/i,
    /request.*limit/i,
    /overloaded/i,
    /capacity/i,
  ],
  'timeout': [
    /timeout/i,
    /timed.*out/i,
    /exceeded.*time/i,
    /deadline.*exceeded/i,
    /operation.*timed/i,
    /request.*timeout/i,
    /execution.*timeout/i,
  ],
  'validation': [
    /invalid.*input/i,
    /invalid.*parameter/i,
    /invalid.*argument/i,
    /schema.*error/i,
    /schema.*validation/i,
    /validation.*failed/i,
    /validation.*error/i,
    /required.*field/i,
    /missing.*required/i,
    /malformed/i,
    /parse.*error/i,
    /syntax.*error/i,
    /type.*error/i,
    /unexpected.*token/i,
  ],
  'logic': [
    // Default fallback - matches most error messages
    /error/i,
    /failed/i,
    /exception/i,
  ],
};

/**
 * Priority order for matching - more specific categories first
 */
const categoryPriority: ErrorCategory[] = [
  'network',
  'rate-limit',
  'timeout',
  'validation',
  'logic', // Fallback last
];

/**
 * Categories that are automatically retryable
 */
const retryableCategories: ErrorCategory[] = ['network', 'rate-limit', 'timeout'];

/**
 * Classify an error based on exit code and error message
 *
 * @param exitCode - The exit code from the failed process
 * @param errorMessage - The error message or output
 * @returns Classification result with category and retry recommendation
 */
export function classifyError(exitCode: number, errorMessage: string): ClassificationResult {
  // Check for specific exit codes
  if (exitCode === 124 || exitCode === 137) {
    // timeout command exit code (124) or killed by SIGKILL (137)
    return {
      category: 'timeout',
      isRetryable: true,
      confidence: 1.0,
      matchedPattern: `exit_code:${exitCode}`,
    };
  }

  // Try to match patterns in priority order
  for (const category of categoryPriority) {
    const patterns = errorPatterns[category];
    for (const pattern of patterns) {
      if (pattern.test(errorMessage)) {
        // Skip the generic 'logic' patterns if we're still early in priority
        if (category === 'logic' && categoryPriority.indexOf(category) < categoryPriority.length - 1) {
          continue;
        }

        return {
          category,
          isRetryable: retryableCategories.includes(category),
          confidence: category === 'logic' ? 0.5 : 0.9,
          matchedPattern: pattern.source,
        };
      }
    }
  }

  // Default to logic error if nothing matched
  return {
    category: 'logic',
    isRetryable: false,
    confidence: 0.3,
  };
}

/**
 * Check if an error category should be retried
 *
 * @param category - The error category
 * @param retryOn - List of categories configured for retry
 * @returns Whether to retry this error
 */
export function shouldRetry(category: ErrorCategory, retryOn: ErrorCategory[]): boolean {
  return retryOn.includes(category);
}

/**
 * Get the recommended action for an error category
 *
 * @param category - The error category
 * @returns Recommended action string
 */
export function getRecoveryAction(category: ErrorCategory): 'auto-retry' | 'skip' | 'human-intervention' {
  switch (category) {
    case 'network':
    case 'rate-limit':
    case 'timeout':
      return 'auto-retry';
    case 'validation':
      return 'skip';
    case 'logic':
    default:
      return 'human-intervention';
  }
}

/**
 * Format an intervention queue entry
 *
 * @param phaseId - ID of the failed phase
 * @param error - Error message
 * @param category - Error category
 * @returns JSON string for intervention queue
 */
export function formatInterventionEntry(
  phaseId: string,
  error: string,
  category: ErrorCategory
): string {
  const entry = {
    phaseId,
    error: error.substring(0, 1000), // Truncate long errors
    category,
    action: getRecoveryAction(category),
    timestamp: new Date().toISOString(),
  };
  return JSON.stringify(entry);
}
