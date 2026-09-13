/**
 * Shared post-login redirect resolution for colleague and admin flows.
 */
export function resolvePostLoginHref(
  redirectTo: string | undefined,
  isSafe: (url: string) => boolean
): string {
  return redirectTo && isSafe(redirectTo) ? redirectTo : '/';
}

/**
 * First Zod issue message, if any.
 */
export function firstIssueMessage(issues: ReadonlyArray<{ message?: string }>): string | undefined {
  return issues[0]?.message;
}

export function isInvalidAccessCodeResult(result: unknown): boolean {
  return !(
    result &&
    typeof result === 'object' &&
    'valid' in result &&
    (result as { valid?: unknown }).valid
  );
}

export function accessCodeFieldError(
  value: string,
  safeParse: (value: string) => {
    success: boolean;
    error?: { issues: ReadonlyArray<{ message?: string }> };
  }
): string | undefined {
  const result = safeParse(value);
  if (result.success) {
    return undefined;
  }
  const issues = result.error ? result.error.issues : [];
  return firstIssueMessage(issues);
}

export function accessCodeFailureMessage(result: unknown): string {
  if (result && typeof result === 'object' && 'error' in result && result.error) {
    return String(result.error);
  }
  return 'Invalid access code. Please check with your admin.';
}

export function assertValidAccessCode(result: unknown): void {
  if (isInvalidAccessCodeResult(result)) {
    throw new Error(accessCodeFailureMessage(result));
  }
}
