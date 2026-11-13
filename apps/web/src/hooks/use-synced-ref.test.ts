import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSyncedRef } from './use-synced-ref';

describe('useSyncedRef', () => {
  it('keeps the same ref while exposing the latest value', () => {
    const { result, rerender } = renderHook(({ value }: { value: string }) => useSyncedRef(value), {
      initialProps: { value: 'first' },
    });

    const initialRef = result.current;
    rerender({ value: 'second' });

    expect(result.current).toBe(initialRef);
    expect(result.current.current).toBe('second');
  });
});
