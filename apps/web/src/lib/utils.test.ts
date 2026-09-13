import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn (className utility)', () => {
  it('merges class names correctly', () => {
    const result = cn('base-class', 'extra-class');
    expect(result).toBe('base-class extra-class');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    const result = cn('base', isActive && 'active', !isActive && 'inactive');
    expect(result).toBe('base active');
  });

  it('filters out falsy values', () => {
    const result = cn('base', false, null, undefined, '', 'valid');
    expect(result).toBe('base valid');
  });

  it('handles tailwind merge conflicts', () => {
    // Should resolve conflicting tailwind classes
    const result = cn('px-2 py-1', 'px-4');
    // Tailwind merge keeps the last conflicting class
    expect(result).toContain('px-4');
    expect(result).not.toContain('px-2');
  });

  it('handles empty input', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('handles single class', () => {
    const result = cn('single-class');
    expect(result).toBe('single-class');
  });

  it('handles array of classes', () => {
    const result = cn(['class1', 'class2'], 'class3');
    expect(result).toBe('class1 class2 class3');
  });

  it('handles object syntax', () => {
    const result = cn({ active: true, disabled: false, visible: true });
    expect(result).toBe('active visible');
  });
});
