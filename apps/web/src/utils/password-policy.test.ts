import { describe, expect, it } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_REQUIREMENTS,
  validatePassword,
} from '@/utils/password-policy';

describe('validatePassword', () => {
  it('accepts a strong password', () => {
    const result = validatePassword('Str0ng!Passw0rd');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a password that is too short', () => {
    const result = validatePassword('Short1!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`At least ${MIN_PASSWORD_LENGTH} characters`);
  });

  it('rejects a password without an uppercase letter', () => {
    const result = validatePassword('lowercase123!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('One uppercase letter');
  });

  it('rejects a password without a lowercase letter', () => {
    const result = validatePassword('UPPERCASE123!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('One lowercase letter');
  });

  it('rejects a password without a digit', () => {
    const result = validatePassword('NoDigitsHere!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('One digit');
  });

  it('rejects a password without a special character', () => {
    const result = validatePassword('NoSpecial123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('One special character (!@#$%^&* etc.)');
  });

  it('returns all failed requirements at once', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(PASSWORD_REQUIREMENTS.length);
  });
});
