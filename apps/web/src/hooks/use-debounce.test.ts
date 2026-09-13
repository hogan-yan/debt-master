import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDebounce } from './use-debounce';

describe('useDebounce', () => {
  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('should update debounced value after delay', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'first', delay: 500 },
    });

    expect(result.current).toBe('first');

    rerender({ value: 'second', delay: 500 });
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('second');

    vi.useRealTimers();
  });

  it('should reset timer when value changes before delay expires', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'a', delay: 500 },
    });

    rerender({ value: 'b', delay: 500 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('a');

    rerender({ value: 'c', delay: 500 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('c');

    vi.useRealTimers();
  });

  it('should handle numeric values', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 0, delay: 300 },
    });

    rerender({ value: 42, delay: 300 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(42);

    vi.useRealTimers();
  });

  it('should handle object values', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const initialObj = { count: 1 };
    const updatedObj = { count: 5 };

    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: initialObj, delay: 400 },
    });

    rerender({ value: updatedObj, delay: 400 });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toEqual({ count: 5 });

    vi.useRealTimers();
  });

  it('should handle delay changes', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'x', delay: 1000 },
    });

    rerender({ value: 'y', delay: 200 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('y');

    vi.useRealTimers();
  });

  it('should clear timeout on unmount', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result, rerender, unmount } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'start', delay: 500 } }
    );

    rerender({ value: 'end', delay: 500 });
    unmount();

    // Timer should be cleared; advancing should not crash
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('start');

    vi.useRealTimers();
  });
});
