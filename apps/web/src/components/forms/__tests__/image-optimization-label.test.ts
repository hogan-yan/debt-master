import { describe, expect, it } from 'vitest';
import {
  fileNameOrEmpty,
  fileSizeMbLabel,
  hasPreviewSrc,
  optimizationLabel,
} from '../image-optimization-label';

describe('optimizationLabel', () => {
  it('returns label when converted or compressed', () => {
    expect(optimizationLabel(true, false, 'opt')).toBe('opt');
    expect(optimizationLabel(false, true, 'opt')).toBe('opt');
    expect(optimizationLabel(true, true, 'opt')).toBe('opt');
  });

  it('returns empty string when neither optimized', () => {
    expect(optimizationLabel(false, false, 'opt')).toBe('');
  });
});

describe('file display helpers', () => {
  it('fileNameOrEmpty covers missing files', () => {
    expect(fileNameOrEmpty(null)).toBe('');
    expect(fileNameOrEmpty(new File(['x'], 'a.png'))).toBe('a.png');
  });

  it('fileSizeMbLabel covers missing files', () => {
    expect(fileSizeMbLabel(null)).toBe('0.0');
    const file = new File([new Uint8Array(1024 * 1024)], 'a.png');
    expect(fileSizeMbLabel(file)).toBe('1.0');
  });

  it('hasPreviewSrc covers empty and present values', () => {
    expect(hasPreviewSrc(null)).toBe(false);
    expect(hasPreviewSrc('')).toBe(false);
    expect(hasPreviewSrc('data:image')).toBe(true);
  });
});
