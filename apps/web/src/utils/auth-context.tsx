import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { CurrentUser } from '@/server/auth';
import { getCurrentUserFromCookie, logout as logoutServerFn } from '@/server/auth';

export type User = CurrentUser;

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Resolve identity from the httpOnly auth cookie once on mount. No token is
  // held client-side — the cookie is the single source of truth and is
  // unreadable by JS, so XSS cannot exfiltrate it. Server fns re-validate the
  // cookie on every call, so this state is advisory for UI only.
  useEffect(() => {
    let active = true;
    getCurrentUserFromCookie()
      .then((resolved) => {
        if (active) setUser(resolved);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutServerFn();
    } catch {
      // best-effort: clear local state regardless of server response
    }
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: string): boolean => user?.permissions.includes(permission) ?? false,
    [user]
  );

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin ?? false,
    isLoading,
    logout,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper components for conditional rendering
export const AdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin } = useAuth();
  return isAdmin ? children : null;
};

export const AuthenticatedOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : null;
};

export const ColleagueOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAdmin } = useAuth();
  return isAuthenticated && !isAdmin ? children : null;
};
