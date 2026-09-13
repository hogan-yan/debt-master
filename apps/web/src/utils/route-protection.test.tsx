import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute, useRouteProtection } from './route-protection';

const mockAuthState = {
  isAuthenticated: false,
  isAdmin: false,
  isLoading: false,
};

vi.mock('./auth-context', () => ({
  useAuth: () => mockAuthState,
}));

function RouteProtectionConsumer({ adminOnly = false }: { adminOnly?: boolean }) {
  const { requireAuthentication, requireAdminAccess, canAccess } = useRouteProtection();
  return (
    <div>
      <div data-testid="can-access">{canAccess(adminOnly) ? 'yes' : 'no'}</div>
      <div data-testid="require-auth">{requireAuthentication() ? 'yes' : 'no'}</div>
      <div data-testid="require-admin">{requireAdminAccess() ? 'yes' : 'no'}</div>
    </div>
  );
}

describe('ProtectedRoute', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = false;
    mockAuthState.isLoading = false;
  });

  it('renders children when hasSsrData and authenticated', () => {
    render(
      <ProtectedRoute hasSsrData>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows spinner while auth is loading', () => {
    mockAuthState.isLoading = true;
    render(
      <ProtectedRoute hasSsrData>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders nothing when not authenticated', async () => {
    mockAuthState.isAuthenticated = false;
    const { container } = render(
      <ProtectedRoute hasSsrData>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    await waitFor(() => {
      expect(container.innerHTML).not.toContain('Protected Content');
    });
  });

  it('renders nothing when adminOnly and user is not admin', async () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = false;
    const { container } = render(
      <ProtectedRoute adminOnly hasSsrData>
        <div>Admin Content</div>
      </ProtectedRoute>
    );
    await waitFor(() => {
      expect(container.innerHTML).not.toContain('Admin Content');
    });
  });

  it('renders children for admin user with adminOnly', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = true;
    render(
      <ProtectedRoute adminOnly hasSsrData>
        <div>Admin Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('renders children for regular authenticated user without adminOnly', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = false;
    render(
      <ProtectedRoute hasSsrData>
        <div>User Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('User Content')).toBeInTheDocument();
  });

  it('renders children after hydration without hasSsrData', async () => {
    mockAuthState.isAuthenticated = true;
    render(
      <ProtectedRoute>
        <div>Hydrated Content</div>
      </ProtectedRoute>
    );
    await waitFor(() => {
      expect(screen.getByText('Hydrated Content')).toBeInTheDocument();
    });
  });
});

describe('useRouteProtection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.isAdmin = false;
    mockAuthState.isLoading = false;
  });

  it('returns canAccess true for authenticated user', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isLoading = false;
    render(<RouteProtectionConsumer />);
    expect(screen.getByTestId('can-access').textContent).toBe('yes');
  });

  it('returns canAccess false for unauthenticated user', () => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = false;
    render(<RouteProtectionConsumer />);
    expect(screen.getByTestId('can-access').textContent).toBe('no');
  });

  it('returns canAccess true during loading', () => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = true;
    render(<RouteProtectionConsumer />);
    expect(screen.getByTestId('can-access').textContent).toBe('yes');
  });

  it('returns canAccess false for adminOnly with non-admin', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = false;
    mockAuthState.isLoading = false;
    render(<RouteProtectionConsumer adminOnly />);
    expect(screen.getByTestId('can-access').textContent).toBe('no');
  });

  it('returns canAccess true for adminOnly with admin', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = true;
    mockAuthState.isLoading = false;
    render(<RouteProtectionConsumer adminOnly />);
    expect(screen.getByTestId('can-access').textContent).toBe('yes');
  });

  it('returns requireAuthentication false during loading', () => {
    mockAuthState.isLoading = true;
    render(<RouteProtectionConsumer />);
    expect(screen.getByTestId('require-auth').textContent).toBe('no');
  });

  it('returns requireAuthentication true for authenticated user', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isLoading = false;
    render(<RouteProtectionConsumer />);
    expect(screen.getByTestId('require-auth').textContent).toBe('yes');
  });

  it('returns requireAdminAccess true for admin', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = true;
    mockAuthState.isLoading = false;
    render(<RouteProtectionConsumer />);
    expect(screen.getByTestId('require-admin').textContent).toBe('yes');
  });

  it('returns requireAdminAccess false for non-admin', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = false;
    mockAuthState.isLoading = false;
    render(<RouteProtectionConsumer />);
    expect(screen.getByTestId('require-admin').textContent).toBe('no');
  });
});
