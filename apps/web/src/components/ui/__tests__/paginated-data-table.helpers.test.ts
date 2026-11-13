import { describe, expect, it, vi } from 'vitest';
import {
  clearDebounceTimer,
  getColStyle,
  hasAnySize,
  headerCellContent,
} from '../paginated-data-table';

describe('paginated-data-table helpers', () => {
  it('getColStyle returns size styles when size is set', () => {
    expect(getColStyle({ size: 120 })).toEqual({ width: 120, maxWidth: 120 });
  });

  it('getColStyle returns undefined without size', () => {
    expect(getColStyle({})).toBeUndefined();
    expect(getColStyle({ size: undefined })).toBeUndefined();
  });

  it('hasAnySize detects sized columns', () => {
    expect(hasAnySize([{ size: 10 }])).toBe(true);
    expect(hasAnySize([{}, { size: undefined }])).toBe(false);
  });

  it('clearDebounceTimer clears when timer id is present', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const id = setTimeout(() => {}, 1000);
    clearDebounceTimer(id);
    expect(clearSpy).toHaveBeenCalledWith(id);
    clearSpy.mockRestore();
  });

  it('clearDebounceTimer is a no-op for null', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    clearDebounceTimer(null);
    expect(clearSpy).not.toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('headerCellContent hides placeholders', () => {
    expect(headerCellContent(true, 'Name')).toBeNull();
    expect(headerCellContent(false, 'Name')).toBe('Name');
  });
});
