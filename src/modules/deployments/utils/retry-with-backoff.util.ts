import { Logger } from '@nestjs/common';

/**
 * Options for configuring retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds between retries (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add jitter to delay to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Function to determine if an error is retryable (default: all errors) */
  isRetryable?: (error: Error) => boolean;
  /** Optional logger for debugging */
  logger?: Logger;
  /** Context string for logging */
  context?: string;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The result data if successful */
  data?: T;
  /** The last error if all retries failed */
  error?: Error;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent in milliseconds */
  totalTimeMs: number;
}

/**
 * Default options for retry operations
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'logger' | 'context'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: () => true,
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: boolean,
): number {
  // Calculate exponential delay: baseDelay * (multiplier ^ attempt)
  const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt);

  // Cap at maximum delay
  let delay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter (±25% of the delay) to prevent thundering herd
  if (jitter) {
    const jitterRange = delay * 0.25;
    const jitterValue = Math.random() * jitterRange * 2 - jitterRange;
    delay = Math.max(0, delay + jitterValue);
  }

  return Math.round(delay);
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is related to GitHub API rate limiting
 */
export function isRateLimitError(error: Error): boolean {
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('rate limit') ||
    message.includes('api rate') ||
    message.includes('secondary rate') ||
    message.includes('too many requests') ||
    message.includes('403') ||
    message.includes('429')
  );
}

/**
 * Check if an error is a transient network error
 */
export function isTransientError(error: Error): boolean {
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('socket') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('504') ||
    isRateLimitError(error)
  );
}

/**
 * Default retryable error checker for GitHub API operations
 */
export function isGitHubRetryableError(error: Error): boolean {
  // Always retry rate limit and transient errors
  if (isRateLimitError(error) || isTransientError(error)) {
    return true;
  }

  const message = error.message?.toLowerCase() || '';

  // Retry server errors
  if (message.includes('500') || message.includes('internal server error')) {
    return true;
  }

  // Don't retry authentication or authorization errors
  if (message.includes('401') || message.includes('unauthorized')) {
    return false;
  }

  // Don't retry not found errors
  if (message.includes('404') || message.includes('not found')) {
    return false;
  }

  // Don't retry validation errors
  if (message.includes('422') || message.includes('validation')) {
    return false;
  }

  // Default: retry unknown errors
  return true;
}

/**
 * Execute an operation with exponential backoff retry
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => octokit.actions.createWorkflowDispatch({...}),
 *   {
 *     maxRetries: 3,
 *     isRetryable: isGitHubRetryableError,
 *     logger: this.logger,
 *     context: 'createWorkflowDispatch'
 *   }
 * );
 *
 * if (result.success) {
 *   console.log('Operation succeeded:', result.data);
 * } else {
 *   console.error('Operation failed after', result.attempts, 'attempts:', result.error);
 * }
 * ```
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const { maxRetries, baseDelayMs, maxDelayMs, backoffMultiplier, jitter, isRetryable, logger } =
    config;
  const context = options.context || 'retryWithBackoff';

  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      const totalTimeMs = Date.now() - startTime;

      if (attempt > 0 && logger) {
        logger.log(`${context}: Operation succeeded after ${attempt + 1} attempt(s)`);
      }

      return {
        success: true,
        data: result,
        attempts: attempt + 1,
        totalTimeMs,
      };
    } catch (err) {
      const error = err as Error;
      lastError = error;

      const isLastAttempt = attempt >= maxRetries;
      const canRetry = !isLastAttempt && isRetryable(error);

      if (logger) {
        const attemptInfo = `(attempt ${attempt + 1}/${maxRetries + 1})`;
        if (canRetry) {
          const delay = calculateBackoffDelay(
            attempt,
            baseDelayMs,
            maxDelayMs,
            backoffMultiplier,
            jitter,
          );
          logger.warn(
            `${context}: Operation failed ${attemptInfo}, retrying in ${delay}ms: ${error.message}`,
          );
        } else if (isLastAttempt) {
          logger.error(
            `${context}: Operation failed ${attemptInfo}, no more retries: ${error.message}`,
          );
        } else {
          logger.error(`${context}: Non-retryable error ${attemptInfo}: ${error.message}`);
        }
      }

      if (!canRetry) {
        break;
      }

      // Calculate and apply delay
      const delay = calculateBackoffDelay(
        attempt,
        baseDelayMs,
        maxDelayMs,
        backoffMultiplier,
        jitter,
      );
      await sleep(delay);
    }
  }

  const totalTimeMs = Date.now() - startTime;

  return {
    success: false,
    error: lastError,
    attempts: maxRetries + 1,
    totalTimeMs,
  };
}
