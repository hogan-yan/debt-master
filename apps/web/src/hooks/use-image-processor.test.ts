import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useImageProcessor } from './use-image-processor';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    imageProcessor_converting: () => 'Converting HEIC...',
    imageProcessor_convertingDesc: () => 'Please wait',
    imageProcessor_converted: () => 'Converted',
    imageProcessor_compressed: ({ percent, size }: { percent: string; size: string }) =>
      `Compressed ${percent}% (${size})`,
    imageProcessor_success: () => 'Success',
    imageProcessor_failed: () => 'Failed',
  },
}));

const mockValidateImageFile = vi.fn();
const mockIsHEICFile = vi.fn();
const mockProcessImageFile = vi.fn();
const mockFormatFileSize = vi.fn();

vi.mock('@/utils/image-processor', () => ({
  validateImageFile: (...args: unknown[]) => mockValidateImageFile(...args),
  isHEICFile: (...args: unknown[]) => mockIsHEICFile(...args),
  processImageFile: (...args: unknown[]) => mockProcessImageFile(...args),
  formatFileSize: (...args: unknown[]) => mockFormatFileSize(...args),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useImageProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => useImageProcessor());

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('should process a valid file successfully without conversion/compression', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    mockValidateImageFile.mockReturnValue({ isValid: true });
    mockIsHEICFile.mockReturnValue(false);
    mockProcessImageFile.mockResolvedValue({
      processedFile: file,
      wasConverted: false,
      wasCompressed: false,
      originalSize: 1000,
      finalSize: 1000,
    });

    const { result } = renderHook(() => useImageProcessor());

    await act(async () => {
      const processed = await result.current.processFile(file);
      expect(processed).toBe(file);
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progress).toBe(100);
    expect(result.current.error).toBeNull();
    expect(result.current.result).not.toBeNull();
  });

  it('should show info toast for HEIC files', async () => {
    const file = new File(['content'], 'test.heic', { type: 'image/heic' });
    const { toast } = await import('sonner');

    mockValidateImageFile.mockReturnValue({ isValid: true });
    mockIsHEICFile.mockReturnValue(true);
    mockProcessImageFile.mockResolvedValue({
      processedFile: file,
      wasConverted: true,
      wasCompressed: false,
      originalSize: 2000,
      finalSize: 2000,
    });

    const { result } = renderHook(() => useImageProcessor());

    await act(async () => {
      await result.current.processFile(file);
    });

    expect(toast.info).toHaveBeenCalledWith('Converting HEIC...', {
      description: 'Please wait',
    });
  });

  it('should show success toast with conversion and compression messages', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const { toast } = await import('sonner');

    mockValidateImageFile.mockReturnValue({ isValid: true });
    mockIsHEICFile.mockReturnValue(false);
    mockFormatFileSize.mockReturnValue('1.5 KB');
    mockProcessImageFile.mockImplementation((_f, opts) => {
      opts?.onProgress?.(50);
      return Promise.resolve({
        processedFile: file,
        wasConverted: true,
        wasCompressed: true,
        originalSize: 2000,
        finalSize: 1000,
      });
    });

    const { result } = renderHook(() => useImageProcessor());

    await act(async () => {
      await result.current.processFile(file);
    });

    expect(toast.success).toHaveBeenCalledWith('Success', {
      description: 'Converted • Compressed 50% (1.5 KB)',
    });
  });

  it('should update progress during processing', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    mockValidateImageFile.mockReturnValue({ isValid: true });
    mockIsHEICFile.mockReturnValue(false);
    mockProcessImageFile.mockImplementation((_f, opts) => {
      opts?.onProgress?.(25);
      opts?.onProgress?.(75);
      return Promise.resolve({
        processedFile: file,
        wasConverted: false,
        wasCompressed: true,
        originalSize: 2000,
        finalSize: 1500,
      });
    });

    const { result } = renderHook(() => useImageProcessor());

    await act(async () => {
      const promise = result.current.processFile(file);
      // progress updates happen synchronously within the mock
      await promise;
    });

    await waitFor(() => {
      expect(result.current.progress).toBe(100);
    });
  });

  it('should handle validation failure', async () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const { toast } = await import('sonner');

    mockValidateImageFile.mockReturnValue({ isValid: false, error: 'Invalid file type' });

    const { result } = renderHook(() => useImageProcessor());

    await act(async () => {
      const processed = await result.current.processFile(file);
      expect(processed).toBeNull();
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBe('Invalid file type');
    expect(toast.error).toHaveBeenCalledWith('Failed', {
      description: 'Invalid file type',
    });
  });

  it('should handle processing errors', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const { toast } = await import('sonner');

    mockValidateImageFile.mockReturnValue({ isValid: true });
    mockIsHEICFile.mockReturnValue(false);
    mockProcessImageFile.mockRejectedValue(new Error('Processing failed'));

    const { result } = renderHook(() => useImageProcessor());

    await act(async () => {
      const processed = await result.current.processFile(file);
      expect(processed).toBeNull();
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBe('Processing failed');
    expect(toast.error).toHaveBeenCalledWith('Failed', {
      description: 'Processing failed',
    });
  });

  it('should handle non-Error exceptions', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const { toast } = await import('sonner');

    mockValidateImageFile.mockReturnValue({ isValid: true });
    mockIsHEICFile.mockReturnValue(false);
    mockProcessImageFile.mockRejectedValue('string error');

    const { result } = renderHook(() => useImageProcessor());

    await act(async () => {
      const processed = await result.current.processFile(file);
      expect(processed).toBeNull();
    });

    expect(result.current.error).toBe('Unknown error occurred');
    expect(toast.error).toHaveBeenCalledWith('Failed', {
      description: 'Unknown error occurred',
    });
  });

  it('should reset state', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    mockValidateImageFile.mockReturnValue({ isValid: true });
    mockIsHEICFile.mockReturnValue(false);
    mockProcessImageFile.mockResolvedValue({
      processedFile: file,
      wasConverted: false,
      wasCompressed: false,
      originalSize: 1000,
      finalSize: 1000,
    });

    const { result } = renderHook(() => useImageProcessor());

    await act(async () => {
      await result.current.processFile(file);
    });

    expect(result.current.result).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('should pass options to processImageFile', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const options = { maxSizeMB: 1, maxWidthOrHeight: 1024 };

    mockValidateImageFile.mockReturnValue({ isValid: true });
    mockIsHEICFile.mockReturnValue(false);
    mockProcessImageFile.mockResolvedValue({
      processedFile: file,
      wasConverted: false,
      wasCompressed: false,
      originalSize: 1000,
      finalSize: 1000,
    });

    const { result } = renderHook(() => useImageProcessor(options));

    await act(async () => {
      await result.current.processFile(file);
    });

    expect(mockProcessImageFile).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        onProgress: expect.any(Function),
      })
    );
  });
});
