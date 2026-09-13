import { Layout } from '@/components/Layout';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import '@/styles/app.css';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import { type ReactNode, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { UmamiTracker } from '@/components/umami-tracker';
import { ThemeProvider, useTheme } from '@/hooks';
import { isAuthError, logout } from '@/utils/auth-client';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 text-center">
      <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-muted-foreground mb-2">{m.error_404()}</h2>
      <p className="text-muted-foreground mb-8">{m.error_404Desc()}</p>
      <a
        href="/"
        className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
      >
        {m.error_goHome()}
      </a>
    </div>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  let locale = 'unknown';
  try {
    locale = getLocale();
  } catch {
    locale = 'error';
  }
  // Body face — radical restraint: one quiet grotesk for every locale.
  // CJK locales additionally load Noto (cjkFontUrl) for CJK glyphs.
  // See docs/design-system.md §3
  const bodyFontLink =
    'https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap';
  // CJK body face — latin glyphs still come from Hanken above
  const cjkFontUrl =
    locale === 'zh-tw'
      ? 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap'
      : locale === 'ja'
        ? 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap'
        : null;

  return (
    <html lang={locale} data-locale={locale} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="stylesheet" href={bodyFontLink} />
        {cjkFontUrl && <link rel="stylesheet" href={cjkFontUrl} />}
        <HeadContent />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Theme initialization script required before hydration
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('debt-master-theme'),t=s==='light'||s==='dark'||s==='system'?s:'system';if((t==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:t==='dark'))document.documentElement.classList.add('dark');if(t==='light')document.documentElement.classList.add('light')}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <UmamiTracker />
        <Scripts />
      </body>
    </html>
  );
}

function handleAuthError(error: unknown): void {
  if (isAuthError(error) && typeof window !== 'undefined') {
    toast.info(m.error_sessionExpiredToast());
    logout();
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(currentUrl)}`;
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      handleAuthError(error);
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry auth errors
        if (isAuthError(error)) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry auth errors
        if (isAuthError(error)) return false;
        return failureCount < 3;
      },
      onError: (error) => {
        handleAuthError(error);
      },
    },
  },
});

function ThemedToaster() {
  const { effectiveTheme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      theme={effectiveTheme}
      style={{
        zIndex: 2147483647,
      }}
    />
  );
}

function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const isAuth = isAuthError(error);

  // Auto-logout and show session expired message for auth errors
  useEffect(() => {
    if (isAuth && typeof window !== 'undefined') {
      logout();
    }
  }, [isAuth]);

  if (isAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 text-center p-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">{m.error_sessionExpired()}</h1>
        <p className="text-muted-foreground mb-8">{m.error_sessionExpiredDesc()}</p>
        <a
          href="/login"
          className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
        >
          {m.error_logIn()}
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-96 text-center p-8">
      <h1 className="text-4xl font-bold text-foreground mb-4">{m.error_unexpected()}</h1>
      <p className="text-muted-foreground mb-8">{m.error_unexpectedDesc()}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
      >
        {m.error_tryAgain()}
      </button>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorFallback,
  // Fallback title for surfaces without a route head (404, error). Routes
  // with their own head() override this through HeadContent, which renders
  // exactly one <title> — a static one here would win in browsers (first
  // tag) and kill every route title (DEBTM-56).
  head: () => ({
    meta: [{ title: m.appTitle() }],
  }),
});

function RootComponent() {
  return (
    <RootDocument>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Layout />
          <ThemedToaster />
        </QueryClientProvider>
      </ThemeProvider>
    </RootDocument>
  );
}
