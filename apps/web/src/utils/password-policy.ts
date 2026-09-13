/**
 * Shared admin password policy.
 *
 * All password entry points (setup, sign-up, reset, change password) should
 * validate against this policy so the rules live in one place.
 */

export const MIN_PASSWORD_LENGTH = 12;

export interface PasswordRequirement {
  readonly label: string;
  readonly test: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: readonly PasswordRequirement[] = [
  {
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    test: (p) => p.length >= MIN_PASSWORD_LENGTH,
  },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One digit', test: (p) => /\d/.test(p) },
  { label: 'One special character (!@#$%^&* etc.)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export interface PasswordValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validate a password against the admin policy.
 * Returns a list of human-readable requirement failures.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors = PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.test(password)).map(
    (requirement) => requirement.label
  );

  return {
    valid: errors.length === 0,
    errors,
  };
}
