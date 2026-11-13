import { describe, expect, it } from 'vitest';
import { AppError, AUTH_ERROR_CODES, ErrorCode, getErrorCode, isAppError } from './errors';

describe('AppError', () => {
  it('sets code and message', () => {
    const err = new AppError(ErrorCode.NOT_FOUND_EXPENSE, 'Expense not found');
    expect(err.message).toBe('Expense not found');
    expect(err.code).toBe('NOT_FOUND_EXPENSE');
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('preserves stack trace', () => {
    const err = new AppError(ErrorCode.VALIDATION_FAILED, 'bad input');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('AppError');
  });
});

describe('isAppError', () => {
  it('returns true for AppError instances', () => {
    expect(isAppError(new AppError(ErrorCode.VALIDATION_FAILED, 'bad input'))).toBe(true);
  });

  it('returns true for plain Error with code property (simulates deserialized)', () => {
    const err = new Error('test');
    Object.defineProperty(err, 'code', { value: 'NOT_FOUND_EXPENSE', writable: true });
    expect(isAppError(err)).toBe(true);
  });

  it('returns false for plain Error without code', () => {
    expect(isAppError(new Error('test'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isAppError('string')).toBe(false);
    expect(isAppError(42)).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });

  it('returns false for Error with non-string code', () => {
    const err = new Error('test');
    Object.defineProperty(err, 'code', { value: 123 });
    expect(isAppError(err)).toBe(false);
  });
});

describe('getErrorCode', () => {
  it('returns code for AppError', () => {
    expect(getErrorCode(new AppError(ErrorCode.AUTH_REQUIRED, 'msg'))).toBe('AUTH_REQUIRED');
  });

  it('returns code for deserialized error with code property', () => {
    const err = new Error('msg');
    Object.defineProperty(err, 'code', { value: 'NOT_FOUND_PARTICIPANT' });
    expect(getErrorCode(err)).toBe('NOT_FOUND_PARTICIPANT');
  });

  it('returns null for plain Error', () => {
    expect(getErrorCode(new Error('msg'))).toBeNull();
  });

  it('returns null for non-Error', () => {
    expect(getErrorCode(null)).toBeNull();
    expect(getErrorCode(undefined)).toBeNull();
  });
});

describe('AUTH_ERROR_CODES', () => {
  it('contains all auth codes', () => {
    expect(AUTH_ERROR_CODES.has(ErrorCode.AUTH_REQUIRED)).toBe(true);
    expect(AUTH_ERROR_CODES.has(ErrorCode.AUTH_INVALID_TOKEN)).toBe(true);
    expect(AUTH_ERROR_CODES.has(ErrorCode.AUTH_ADMIN_REQUIRED)).toBe(true);
    expect(AUTH_ERROR_CODES.has(ErrorCode.AUTH_NO_TOKEN)).toBe(true);
  });

  it('does not contain non-auth codes', () => {
    expect(AUTH_ERROR_CODES.has(ErrorCode.NOT_FOUND_EXPENSE)).toBe(false);
    expect(AUTH_ERROR_CODES.has(ErrorCode.VALIDATION_FAILED)).toBe(false);
    expect(AUTH_ERROR_CODES.has(ErrorCode.BUSINESS_ALREADY_PAID)).toBe(false);
  });
});
