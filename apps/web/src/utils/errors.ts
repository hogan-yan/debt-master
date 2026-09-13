/**
 * Application error codes for structured error handling.
 * Frontend consumers match by code, not message text.
 *
 * TanStack Start (Seroval) preserves own properties on Error objects
 * across the serialization boundary, so `error.code` survives the
 * server-to-client round-trip. However, `instanceof AppError` checks
 * do NOT survive — use `isAppError()` for client-side detection.
 */

export const ErrorCode = {
  // Auth errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_ADMIN_REQUIRED: 'AUTH_ADMIN_REQUIRED',
  AUTH_NO_TOKEN: 'AUTH_NO_TOKEN',
  STORAGE_ACCESS_DENIED: 'STORAGE_ACCESS_DENIED',

  // Not-found errors
  NOT_FOUND_PARTICIPANT: 'NOT_FOUND_PARTICIPANT',
  NOT_FOUND_EXPENSE: 'NOT_FOUND_EXPENSE',
  NOT_FOUND_PAYMENT: 'NOT_FOUND_PAYMENT',
  NOT_FOUND_COLLEAGUE: 'NOT_FOUND_COLLEAGUE',
  NOT_FOUND_RESTAURANT: 'NOT_FOUND_RESTAURANT',

  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  VALIDATION_INVALID_INPUT: 'VALIDATION_INVALID_INPUT',

  // Business logic errors
  BUSINESS_ALREADY_PAID: 'BUSINESS_ALREADY_PAID',
  BUSINESS_CLAIM_PENDING: 'BUSINESS_CLAIM_PENDING',
  BUSINESS_NO_PENDING_CLAIM: 'BUSINESS_NO_PENDING_CLAIM',
  BUSINESS_NO_APPROVED_PAYMENTS: 'BUSINESS_NO_APPROVED_PAYMENTS',
  BUSINESS_HAS_RELATED_EXPENSES: 'BUSINESS_HAS_RELATED_EXPENSES',
  BUSINESS_NO_UNPAID_EXPENSES: 'BUSINESS_NO_UNPAID_EXPENSES',
  BUSINESS_NO_UNAPPLIED_FUNDS: 'BUSINESS_NO_UNAPPLIED_FUNDS',
  BUSINESS_AMOUNT_EXCEEDS_APPLIED: 'BUSINESS_AMOUNT_EXCEEDS_APPLIED',
  BUSINESS_PARTICIPANT_NOT_FOUND_OR_INACTIVE: 'BUSINESS_PARTICIPANT_NOT_FOUND_OR_INACTIVE',

  // Infrastructure errors
  INFRASTRUCTURE_ERROR: 'INFRASTRUCTURE_ERROR',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Typed application error with a structured code.
 * Use `isAppError()` for client-side detection (instanceof does not survive serialization).
 */
export class AppError extends Error {
  readonly code: ErrorCodeType;

  constructor(code: ErrorCodeType, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

/**
 * Type guard for checking if an error has an error code.
 * Works across the TanStack Start serialization boundary because
 * Seroval preserves own properties (like `code`) on Error objects.
 */
export function isAppError(error: unknown): error is Error & { code: string } {
  if (!(error instanceof Error)) return false;
  return 'code' in error && typeof (error as { code: unknown }).code === 'string';
}

/**
 * Get the error code from an error, or null if not an AppError.
 */
export function getErrorCode(error: unknown): string | null {
  if (isAppError(error)) return error.code;
  return null;
}

/**
 * Auth error codes for quick checking.
 * Used by isAuthError() on the client.
 */
export const AUTH_ERROR_CODES: ReadonlySet<string> = new Set([
  ErrorCode.AUTH_REQUIRED,
  ErrorCode.AUTH_INVALID_TOKEN,
  ErrorCode.AUTH_ADMIN_REQUIRED,
  ErrorCode.AUTH_NO_TOKEN,
]);
