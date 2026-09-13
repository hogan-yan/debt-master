import { describe, expect, it } from 'vitest';
import {
  accessCodeFailureMessage,
  accessCodeFieldError,
  assertValidAccessCode,
  firstIssueMessage,
  isInvalidAccessCodeResult,
  resolvePostLoginHref,
} from '../login-redirect';

describe('resolvePostLoginHref', () => {
  it('returns redirect when present and safe', () => {
    expect(resolvePostLoginHref('/dashboard', () => true)).toBe('/dashboard');
  });

  it('returns home when redirect missing', () => {
    expect(resolvePostLoginHref(undefined, () => true)).toBe('/');
  });

  it('returns home when redirect unsafe', () => {
    expect(resolvePostLoginHref('/dashboard', () => false)).toBe('/');
  });
});

describe('firstIssueMessage', () => {
  it('returns first issue message', () => {
    expect(firstIssueMessage([{ message: 'too short' }])).toBe('too short');
  });

  it('returns undefined for empty issues', () => {
    expect(firstIssueMessage([])).toBeUndefined();
  });

  it('returns undefined when first issue has no message', () => {
    expect(firstIssueMessage([{}])).toBeUndefined();
  });
});

describe('access code helpers', () => {
  it('isInvalidAccessCodeResult covers valid and invalid payloads', () => {
    expect(isInvalidAccessCodeResult({ valid: true })).toBe(false);
    expect(isInvalidAccessCodeResult({ valid: false })).toBe(true);
    expect(isInvalidAccessCodeResult(null)).toBe(true);
    expect(isInvalidAccessCodeResult('nope')).toBe(true);
  });

  it('accessCodeFieldError covers success and failure', () => {
    expect(accessCodeFieldError('abc', () => ({ success: true }))).toBeUndefined();
    expect(
      accessCodeFieldError('ab', () => ({
        success: false,
        error: { issues: [{ message: 'too short' }] },
      }))
    ).toBe('too short');
    expect(
      accessCodeFieldError('ab', () => ({
        success: false,
        error: { issues: [] },
      }))
    ).toBeUndefined();
    expect(accessCodeFieldError('ab', () => ({ success: false }))).toBeUndefined();
  });

  it('accessCodeFailureMessage covers error payloads and fallback', () => {
    expect(accessCodeFailureMessage({ error: 'Nope' })).toBe('Nope');
    expect(accessCodeFailureMessage({ valid: false })).toContain('Invalid access code');
    expect(accessCodeFailureMessage(null)).toContain('Invalid access code');
  });

  it('assertValidAccessCode throws for invalid results', () => {
    expect(() => assertValidAccessCode({ valid: true })).not.toThrow();
    expect(() => assertValidAccessCode({ valid: false, error: 'bad' })).toThrow('bad');
    expect(() => assertValidAccessCode(null)).toThrow(/Invalid access code/);
  });
});
