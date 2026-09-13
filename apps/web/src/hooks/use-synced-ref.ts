import { useRef } from 'react';

/**
 * Returns a ref that always holds the latest value.
 * Useful for reading current state inside stable useCallback closures.
 */
export function useSyncedRef<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
