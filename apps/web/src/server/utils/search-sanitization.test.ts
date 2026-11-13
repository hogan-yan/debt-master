import { describe, expect, it } from 'vitest';
import { sanitizeSearchInput } from './search-sanitization';

describe('sanitizeSearchInput', () => {
  it('should return undefined for empty string', () => {
    expect(sanitizeSearchInput('')).toBeUndefined();
  });

  it('should return undefined for undefined', () => {
    expect(sanitizeSearchInput(undefined)).toBeUndefined();
  });

  it('should trim whitespace', () => {
    expect(sanitizeSearchInput('  hello  ')).toBe('hello');
  });

  it('should return undefined for whitespace-only input', () => {
    expect(sanitizeSearchInput('   ')).toBeUndefined();
  });

  it('should limit string length to 100 characters', () => {
    const longInput = 'a'.repeat(200);
    expect(sanitizeSearchInput(longInput)).toBe('a'.repeat(100));
  });

  it('should strip special regex characters', () => {
    expect(sanitizeSearchInput('hello.world')).toBe('helloworld');
    expect(sanitizeSearchInput('C++')).toBe('C');
    expect(sanitizeSearchInput('test*')).toBe('test');
    expect(sanitizeSearchInput('a+b')).toBe('ab');
    expect(sanitizeSearchInput('a?b')).toBe('ab');
    expect(sanitizeSearchInput('^start')).toBe('start');
    expect(sanitizeSearchInput('end$')).toBe('end');
    expect(sanitizeSearchInput('a{b}')).toBe('ab');
    expect(sanitizeSearchInput('a(b)')).toBe('ab');
    expect(sanitizeSearchInput('a[b]')).toBe('ab');
    expect(sanitizeSearchInput('a|b')).toBe('ab');
    expect(sanitizeSearchInput('a\\b')).toBe('ab');
  });

  it('should preserve normal characters', () => {
    expect(sanitizeSearchInput('Hello World 123')).toBe('Hello World 123');
    expect(sanitizeSearchInput('café')).toBe('café');
    expect(sanitizeSearchInput('test@email.com')).toBe('test@emailcom');
  });
});
