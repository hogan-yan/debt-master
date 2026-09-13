import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile: {
      render: (
        container: string | HTMLElement,
        params: TurnstileRenderParams
      ) => string | undefined;
      getResponse: (widgetId?: string) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

interface TurnstileRenderParams {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: (code: string) => void;
  'expired-callback'?: () => void;
  'timeout-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact' | 'invisible';
}

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: (errorMessage: string) => void;
  onExpired?: () => void;
  onTimeout?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact' | 'invisible';
  className?: string;
}

const KNOWN_TURNSTILE_ERRORS: Record<string, string> = {
  '110200': 'This domain is not allowed. Please check your Cloudflare Turnstile settings.',
  '110100': 'Invalid sitekey. Please check your configuration.',
  '110110': 'Invalid sitekey. Please check your configuration.',
  '110500': 'Your browser is not supported.',
  '300010': 'Challenge execution failed. This might be related to Private Access Token issues.',
  '600010': 'Challenge execution failed. This might be related to Private Access Token issues.',
};

export function turnstileErrorMessage(code: string): string {
  return KNOWN_TURNSTILE_ERRORS[code] || `Verification failed (Error: ${code}). Please try again.`;
}

export function wireExistingTurnstileScript(
  existingScript: Element,
  onLoad: () => void,
  onError: () => void
): void {
  existingScript.addEventListener('load', onLoad);
  existingScript.addEventListener('error', onError);
}

export function retryTurnstileWidget(options: {
  widgetId: string | null;
  turnstile: Window['turnstile'] | undefined;
  clearWidgetId: () => void;
  scheduleRerender: () => void;
}): void {
  const { widgetId, turnstile, clearWidgetId, scheduleRerender } = options;
  if (widgetId && turnstile) {
    try {
      turnstile.reset(widgetId);
    } catch {
      try {
        turnstile.remove(widgetId);
      } catch {
        // ignore remove failures during recovery
      }
      clearWidgetId();
      scheduleRerender();
    }
  } else {
    scheduleRerender();
  }
}

export function TurnstileWidget({
  siteKey,
  onVerify,
  onError,
  onExpired,
  onTimeout,
  theme = 'auto',
  size = 'normal',
  className = '',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (window.turnstile) {
      setIsLoaded(true);
      return;
    }

    const existingScript = document.querySelector(
      'script[src*="challenges.cloudflare.com/turnstile"]'
    );
    if (existingScript) {
      wireExistingTurnstileScript(
        existingScript,
        () => setIsLoaded(true),
        () => setError('Failed to load Turnstile script')
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsLoaded(true);
    };
    script.onerror = (_error) => {
      setError('Failed to load Turnstile script');
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const renderWidget = useCallback(() => {
    if (!window.turnstile || !containerRef.current || widgetIdRef.current) {
      return;
    }

    try {
      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          setError(null);
          setRetryCount(0);
          onVerify(token);
        },
        'error-callback': (code: string) => {
          const friendlyMessage = turnstileErrorMessage(code);
          setError(friendlyMessage);
          onError?.(friendlyMessage);
        },
        'expired-callback': () => {
          onExpired?.();
        },
        'timeout-callback': () => {
          onTimeout?.();
        },
        theme,
        size,
      });

      if (widgetId) {
        widgetIdRef.current = widgetId;
        setError(null);
      } else {
        throw new Error('Widget render returned no ID');
      }
    } catch (_err) {
      setError('Failed to initialize verification. Please refresh the page.');
    }
  }, [siteKey, onVerify, onError, onExpired, onTimeout, theme, size]);

  useEffect(() => {
    if (isLoaded) {
      if (window.turnstile) {
        renderWidget();
      } else {
        const checkTurnstile = () => {
          if (window.turnstile) {
            renderWidget();
          } else {
            setTimeout(checkTurnstile, 100);
          }
        };
        checkTurnstile();
      }
    }
  }, [isLoaded, renderWidget]);

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (_err) {}
      }
    };
  }, []);

  if (error) {
    return (
      <div
        className={`p-4 border-destructive/20 rounded-md bg-destructive/5 ${className}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-destructive-text">Verification Error</h3>
            <div className="mt-2 text-sm text-destructive-text">
              <p>{error}</p>
              {retryCount > 0 && <p className="mt-1 text-xs">Retry attempt: {retryCount}</p>}
            </div>
            <div className="mt-4">
              <button
                type="button"
                className="bg-destructive/15 px-2 py-1 text-sm font-medium text-destructive-text rounded-md hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
                onClick={() => {
                  setError(null);
                  setRetryCount((prev) => prev + 1);
                  retryTurnstileWidget({
                    widgetId: widgetIdRef.current,
                    turnstile: window.turnstile,
                    clearWidgetId: () => {
                      widgetIdRef.current = null;
                    },
                    scheduleRerender: () => {
                      setTimeout(() => renderWidget(), 100);
                    },
                  });
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    // For invisible mode, don't show loading UI
    if (size === 'invisible') {
      return <div className={className} style={{ display: 'none' }} aria-hidden="true" />;
    }
    return (
      <div
        className={`flex items-center justify-center p-4 bg-muted/50 rounded-md ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center space-x-2">
          <div
            className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground"
            aria-hidden="true"
          />
          <span className="text-sm text-muted-foreground">Loading verification...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={containerRef} />
    </div>
  );
}
