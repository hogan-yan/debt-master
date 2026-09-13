import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvalidate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: mockInvalidate }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';

const mockToastSuccess = toast.success as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

import { useFormSubmission } from './use-form-submission';

describe('useFormSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits successfully and calls onSuccess', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useFormSubmission({ onSuccess, successTitle: 'Done', successMessage: 'Saved' })
    );

    await act(async () => {
      const res = await result.current.handleSubmit(async () => 'data');
      expect(res).toBe('data');
    });

    expect(onSuccess).toHaveBeenCalledWith('data');
    expect(mockToastSuccess).toHaveBeenCalledWith('Saved', { description: 'Done' });
    expect(mockInvalidate).toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('uses custom success message when provided', async () => {
    const { result } = renderHook(() => useFormSubmission({ successMessage: 'Default' }));

    await act(async () => {
      await result.current.handleSubmit(async () => {}, 'Custom Msg');
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Custom Msg', { description: undefined });
  });

  it('does not refresh when shouldRefresh is false', async () => {
    const { result } = renderHook(() => useFormSubmission({ shouldRefresh: false }));

    await act(async () => {
      await result.current.handleSubmit(async () => {});
    });

    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('handles error and calls onError', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useFormSubmission({ onError, errorTitle: 'Fail', errorMessage: 'Oops' })
    );

    await act(async () => {
      const res = await result.current.handleSubmit(async () => {
        throw new Error('boom');
      });
      expect(res).toBeNull();
    });

    expect(onError).toHaveBeenCalledWith(new Error('boom'));
    expect(mockToastError).toHaveBeenCalledWith('boom', { description: 'Fail' });
    expect(result.current.error).toBe('boom');
  });

  it('uses custom error message for non-Error throws', async () => {
    const { result } = renderHook(() => useFormSubmission({ errorMessage: 'DefaultErr' }));

    await act(async () => {
      await result.current.handleSubmit(
        async () => {
          throw 'string-error';
        },
        undefined,
        'CustomErr'
      );
    });

    expect(mockToastError).toHaveBeenCalledWith('CustomErr', { description: undefined });
  });

  it('uses default error message for non-Error throws without custom message', async () => {
    const { result } = renderHook(() => useFormSubmission({ errorMessage: 'DefaultErr' }));

    await act(async () => {
      await result.current.handleSubmit(async () => {
        throw 'string-error';
      });
    });

    expect(mockToastError).toHaveBeenCalledWith('DefaultErr', { description: undefined });
  });

  it('resets state', () => {
    const { result } = renderHook(() => useFormSubmission());

    act(() => result.current.reset());

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets isSubmitting true during submission', async () => {
    const { result } = renderHook(() => useFormSubmission());

    let resolveFn: (() => void) | undefined;
    const promise = new Promise<void>((resolve) => {
      resolveFn = resolve;
    });

    act(() => {
      result.current.handleSubmit(async () => {
        await promise;
      });
    });

    expect(result.current.isSubmitting).toBe(true);

    act(() => resolveFn?.());
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
  });
});
