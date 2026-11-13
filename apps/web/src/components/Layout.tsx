import { Outlet, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { m } from '@/paraglide/messages';
import { NAV } from '@/test/test-ids';
import { AuthProvider } from '@/utils/auth-context';
import { AuthNavbar } from './ui/auth-navbar';

/**
 * Manages focus on route changes for SPA accessibility.
 * Moves focus to the main content area after navigation.
 */
function FocusManager() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      const main = document.getElementById('main-content');
      if (main) {
        main.setAttribute('tabIndex', '-1');
        main.focus({ preventScroll: true });
      }
    }
  }, [pathname]);

  return null;
}

interface LayoutProps {
  children?: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background flex flex-col" data-testid={NAV.APP_ROOT}>
        <a
          href="#main-content"
          className="absolute -top-10 left-2 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg transition-[top] focus:top-2"
        >
          {m.nav_skipToContent()}
        </a>
        <AuthNavbar />
        <FocusManager />

        <main
          id="main-content"
          className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full"
        >
          {children || <Outlet />}
        </main>

        <footer className="border-t bg-background py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-muted-foreground">
              {m.footer_copyright({ year: String(new Date().getFullYear()) })}
            </p>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
