import React, { useEffect, useState } from 'react';
import { m } from '@/paraglide/messages';
import { useAuth } from './auth-context';

// Detect SSR without useState/useEffect flip — prevents hydration spinner flash
const isServer = () => typeof window === 'undefined';

// Component wrappers for route protection
export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  adminOnly?: boolean;
  /** When true, the route loader already returned real data during SSR,
   *  so we skip the hydration spinner and render children immediately. */
  hasSsrData?: boolean;
}> = ({ children, adminOnly = false, hasSsrData = false }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark hydration as complete after first client-side render
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    // Only redirect after hydration and loading is complete
    if (isHydrated && !isLoading) {
      if (!isAuthenticated) {
        // Store the current URL for redirect after login
        const currentUrl = window.location.pathname + window.location.search;
        const redirectUrl = `/login?redirect=${encodeURIComponent(currentUrl)}`;
        window.location.href = redirectUrl;
        return;
      }

      if (adminOnly && !isAdmin) {
        window.location.href = '/';
        return;
      }
    }
  }, [isAuthenticated, isAdmin, adminOnly, isLoading, isHydrated]);

  // During SSR or initial hydration, show loading spinner instead of children
  // — unless the route loader already fetched real data (hasSsrData).
  // This prevents unauthenticated users from seeing protected data before redirect
  // while avoiding flicker for routes that already have valid SSR data.
  if ((isServer() || !isHydrated) && !hasSsrData) {
    return (
      <div className="flex items-center justify-center min-h-96" role="status" aria-live="polite">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 border-border mx-auto"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm text-muted-foreground">{m.common_loading()}</p>
        </div>
      </div>
    );
  }

  // After hydration, show loading state while auth is being restored
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96" role="status" aria-live="polite">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 border-border mx-auto"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm text-muted-foreground">{m.common_loading()}</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated or not authorized
  if (!isAuthenticated || (adminOnly && !isAdmin)) {
    return null;
  }

  return <>{children}</>;
};

// Hook for programmatic route protection
export const useRouteProtection = () => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  const requireAuthentication = () => {
    if (isLoading) return false; // Don't redirect while loading
    if (!isAuthenticated) {
      // Store the current URL for redirect after login
      const currentUrl = window.location.pathname + window.location.search;
      const redirectUrl = `/login?redirect=${encodeURIComponent(currentUrl)}`;
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  };

  const requireAdminAccess = () => {
    if (isLoading) return false; // Don't redirect while loading
    if (!isAuthenticated) {
      // Store the current URL for redirect after login
      const currentUrl = window.location.pathname + window.location.search;
      const redirectUrl = `/login?redirect=${encodeURIComponent(currentUrl)}`;
      window.location.href = redirectUrl;
      return false;
    }
    if (!isAdmin) {
      window.location.href = '/';
      return false;
    }
    return true;
  };

  return {
    requireAuthentication,
    requireAdminAccess,
    canAccess: (adminOnly = false) => {
      if (isLoading) return true; // Allow access while loading
      if (!isAuthenticated) return false;
      if (adminOnly && !isAdmin) return false;
      return true;
    },
  };
};
