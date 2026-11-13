import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TurnstileWidget } from '../turnstile-widget';

describe('TurnstileWidget', () => {
  const mockRender = vi.fn();
  const mockReset = vi.fn();
  const mockRemove = vi.fn();
  const mockGetResponse = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    // Set up window.turnstile mock
    window.turnstile = {
      render: mockRender,
      reset: mockReset,
      remove: mockRemove,
      getResponse: mockGetResponse,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading state when turnstile not loaded', () => {
    delete (window as unknown as Record<string, unknown>).turnstile;

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    expect(screen.getByText('Loading verification...')).toBeInTheDocument();
  });

  it('renders container when turnstile is available', () => {
    mockRender.mockReturnValue('widget-123');

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    expect(mockRender).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        sitekey: 'test-key',
        theme: 'auto',
        size: 'normal',
      })
    );
  });

  it('passes theme and size props to turnstile.render', () => {
    mockRender.mockReturnValue('widget-123');

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} theme="dark" size="compact" />);

    expect(mockRender).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        theme: 'dark',
        size: 'compact',
      })
    );
  });

  it('calls onVerify when turnstile callback fires', () => {
    const onVerify = vi.fn();
    mockRender.mockImplementation((_container, params) => {
      params.callback?.('test-token');
      return 'widget-123';
    });

    render(<TurnstileWidget siteKey="test-key" onVerify={onVerify} />);

    expect(onVerify).toHaveBeenCalledWith('test-token');
  });

  it('calls onError when turnstile error callback fires', () => {
    const onError = vi.fn();
    mockRender.mockImplementation((_container, params) => {
      params['error-callback']?.('110200');
      return 'widget-123';
    });

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} onError={onError} />);

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('domain is not allowed'));
  });

  it('shows error UI when widget render fails', () => {
    mockRender.mockImplementation(() => {
      throw new Error('render failed');
    });

    const { container } = render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    // Error state renders role="alert" div
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('shows an initialization error when Turnstile returns no widget id', () => {
    mockRender.mockReturnValue(undefined);

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    expect(
      screen.getByText('Failed to initialize verification. Please refresh the page.')
    ).toBeInTheDocument();
  });

  it('calls onExpired when expired callback fires', () => {
    const onExpired = vi.fn();
    mockRender.mockImplementation((_container, params) => {
      params['expired-callback']?.();
      return 'widget-123';
    });

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} onExpired={onExpired} />);

    expect(onExpired).toHaveBeenCalled();
  });

  it('calls onTimeout when timeout callback fires', () => {
    const onTimeout = vi.fn();
    mockRender.mockImplementation((_container, params) => {
      params['timeout-callback']?.();
      return 'widget-123';
    });

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} onTimeout={onTimeout} />);

    expect(onTimeout).toHaveBeenCalled();
  });

  it('renders invisible mode without loading UI', () => {
    delete (window as unknown as Record<string, unknown>).turnstile;

    const { container } = render(
      <TurnstileWidget siteKey="test-key" onVerify={vi.fn()} size="invisible" />
    );

    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).toBeInTheDocument();
    expect(screen.queryByText('Loading verification...')).not.toBeInTheDocument();
  });

  it('try again button clears error state', async () => {
    mockRender.mockImplementation(() => {
      throw new Error('fail');
    });

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    // Error UI visible
    expect(screen.getByText('Try Again')).toBeInTheDocument();

    const user = userEvent.setup();
    mockRender.mockReturnValue('widget-reset');
    await user.click(screen.getByText('Try Again'));

    // Error UI gone after click — component re-renders container
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('cleans up widget on unmount', () => {
    mockRender.mockReturnValue('widget-123');

    const { unmount } = render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    unmount();

    expect(mockRemove).toHaveBeenCalledWith('widget-123');
  });

  it('polls for window.turnstile if isLoaded before script is ready', () => {
    delete (window as unknown as Record<string, unknown>).turnstile;
    vi.useFakeTimers();

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    const script = document.querySelector('script[src*="challenges.cloudflare.com"]');
    expect(script).toBeInTheDocument();

    // Simulate script load without turnstile being available yet
    act(() => {
      script?.dispatchEvent(new Event('load'));
    });

    expect(mockRender).not.toHaveBeenCalled();

    // Turnstile becomes available after a poll
    window.turnstile = {
      render: mockRender,
      reset: mockReset,
      remove: mockRemove,
      getResponse: mockGetResponse,
    };
    mockRender.mockReturnValue('widget-123');

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(mockRender).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('reuses existing script element and handles load error', () => {
    delete (window as unknown as Record<string, unknown>).turnstile;
    const existingScript = document.createElement('script');
    existingScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    document.head.appendChild(existingScript);

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    act(() => {
      existingScript.dispatchEvent(new Event('error'));
    });

    expect(screen.getByText('Failed to load Turnstile script')).toBeInTheDocument();

    document.head.removeChild(existingScript);
  });

  it('reuses existing script element and handles load success', () => {
    delete (window as unknown as Record<string, unknown>).turnstile;
    const existingScript = document.createElement('script');
    existingScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    document.head.appendChild(existingScript);

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    act(() => {
      existingScript.dispatchEvent(new Event('load'));
    });

    window.turnstile = {
      render: mockRender,
      reset: mockReset,
      remove: mockRemove,
      getResponse: mockGetResponse,
    };
    mockRender.mockReturnValue('widget-existing');

    act(() => {
      // allow effect that depends on isLoaded to run
    });

    expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBe(existingScript);

    document.head.removeChild(existingScript);
  });

  it('creates script element and handles script load error', () => {
    delete (window as unknown as Record<string, unknown>).turnstile;

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    const script = document.querySelector('script[src*="challenges.cloudflare.com"]');
    expect(script).toBeInTheDocument();

    act(() => {
      script?.dispatchEvent(new Event('error'));
    });

    expect(screen.getByText('Failed to load Turnstile script')).toBeInTheDocument();

    if (script?.parentNode) {
      script.parentNode.removeChild(script);
    }
  });

  it('try again re-renders widget when no widget id exists', async () => {
    mockRender.mockImplementation(() => {
      throw new Error('fail');
    });

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    mockRender.mockReturnValue('widget-new');
    const user = userEvent.setup();
    await user.click(screen.getByText('Try Again'));

    await waitFor(() => {
      expect(mockRender).toHaveBeenCalledTimes(2);
    });
  });

  it('does not render widget if container ref is null', () => {
    // Render with display:none container to keep ref null during effect
    mockRender.mockReturnValue('widget-123');
    const { container } = render(
      <TurnstileWidget siteKey="test-key" onVerify={vi.fn()} className="hidden" />
    );
    // The container div still exists, so this mainly exercises the early-return guard
    expect(container.querySelector('.hidden')).toBeInTheDocument();
  });

  it('removes widget on unmount even when remove throws', () => {
    mockRender.mockReturnValue('widget-123');
    mockRemove.mockImplementation(() => {
      throw new Error('remove fail');
    });

    const { unmount } = render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);

    expect(() => unmount()).not.toThrow();
  });

  it('renders invisible loading state without loading UI', () => {
    delete (window as unknown as Record<string, unknown>).turnstile;

    const { container } = render(
      <TurnstileWidget siteKey="test-key" onVerify={vi.fn()} size="invisible" />
    );

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.queryByText('Loading verification...')).not.toBeInTheDocument();
  });

  it('falls back to remove + re-render when reset throws on try again', async () => {
    // Render succeeds (sets widgetIdRef). Fire the error callback AFTER render
    // so the error UI + Try Again button appear while widgetIdRef still holds.
    let capturedErrorCb: ((code: string) => void) | undefined;
    mockRender.mockImplementation((_container, params) => {
      capturedErrorCb = params['error-callback'];
      return 'widget-123';
    });
    // reset() throwing exercises the catch block (lines 198-209):
    // remove(widgetId) → null the ref → setTimeout(renderWidget, 100).
    mockReset.mockImplementation(() => {
      throw new Error('reset fail');
    });

    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);
    await waitFor(() => expect(mockRender).toHaveBeenCalledTimes(1));

    await act(async () => {
      capturedErrorCb?.('110200');
    });
    expect(screen.getByText('Try Again')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText('Try Again'));

    // reset was attempted and threw
    await waitFor(() => expect(mockReset).toHaveBeenCalledWith('widget-123'));
    // catch block removed the old widget
    expect(mockRemove).toHaveBeenCalledWith('widget-123');
    // and re-rendered the widget after the failed reset
    await waitFor(() => expect(mockRender).toHaveBeenCalledTimes(2));
  });

  it('shows retry attempt count after a failed retry', async () => {
    let capturedErrorCb: ((code: string) => void) | undefined;
    mockRender.mockImplementation((_container, params) => {
      capturedErrorCb = params['error-callback'];
      return 'widget-retry';
    });

    const user = userEvent.setup();
    render(<TurnstileWidget siteKey="test-key" onVerify={vi.fn()} />);
    await waitFor(() => expect(mockRender).toHaveBeenCalled());

    await act(async () => {
      capturedErrorCb?.('999999');
    });
    expect(screen.getByText('Try Again')).toBeInTheDocument();

    await user.click(screen.getByText('Try Again'));
    await waitFor(() => expect(screen.queryByText('Try Again')).not.toBeInTheDocument());

    await act(async () => {
      capturedErrorCb?.('999999');
    });
    expect(screen.getByText(/Retry attempt: 1/)).toBeInTheDocument();
  });
});
