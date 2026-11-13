import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/server/auth';
import { AUTH_GUARD, COMMON, NAV } from '@/test/test-ids';
import { AdminOnly, AuthenticatedOnly, AuthProvider, ColleagueOnly, useAuth } from './auth-context';

const mockGetCurrentUser = vi.fn<() => Promise<CurrentUser | null>>();
const mockLogout = vi.fn<() => Promise<void>>();

vi.mock('@/server/auth', () => ({
  getCurrentUserFromCookie: (...args: unknown[]) => mockGetCurrentUser(...(args as [])),
  logout: (...args: unknown[]) => mockLogout(...(args as [])),
}));

function TestConsumer() {
  const { user, isAuthenticated, isAdmin, isLoading, hasPermission } = useAuth();
  return (
    <div>
      <div data-testid={COMMON.LOADING}>{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid={NAV.AUTHENTICATED}>{isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid={AUTH_GUARD.ADMIN}>{isAdmin ? 'yes' : 'no'}</div>
      <div data-testid={NAV.USERNAME}>{user?.username ?? 'none'}</div>
      <div data-testid={AUTH_GUARD.CAN_VIEW}>{hasPermission('view') ? 'yes' : 'no'}</div>
      <div data-testid={AUTH_GUARD.CAN_DELETE}>{hasPermission('delete') ? 'yes' : 'no'}</div>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLogout.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('AuthProvider', () => {
  it('finishes unauthenticated when server has no session', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
    expect(screen.getByTestId('admin')).toHaveTextContent('no');
  });

  it('resolves identity from the server (httpOnly cookie) on mount', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      isAdmin: false,
      permissions: ['view'],
      username: 'alice',
      accessCodeId: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('yes'));
    expect(screen.getByTestId('username')).toHaveTextContent('alice');
    expect(screen.getByTestId('can-view')).toHaveTextContent('yes');
    expect(screen.getByTestId('can-delete')).toHaveTextContent('no');
  });

  it('exposes admin flag for an admin session', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      isAdmin: true,
      permissions: ['view', 'delete'],
      username: 'admin',
      accessCodeId: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('admin')).toHaveTextContent('yes'));
    expect(screen.getByTestId('can-delete')).toHaveTextContent('yes');
  });

  it('clears the local user when the server resolves to null', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
  });

  it('clears loading and local identity when session resolution fails', async () => {
    mockGetCurrentUser.mockRejectedValueOnce(new Error('Session lookup failed'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
  });

  it('does not update state after unmount when session resolution succeeds', async () => {
    let resolveUser: (user: CurrentUser | null) => void = () => {};
    mockGetCurrentUser.mockReturnValueOnce(
      new Promise<CurrentUser | null>((resolve) => {
        resolveUser = resolve;
      })
    );

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    unmount();
    resolveUser(null);

    await Promise.resolve();
  });

  it('does not update state after unmount when session resolution fails', async () => {
    let rejectUser: (error: Error) => void = () => {};
    mockGetCurrentUser.mockReturnValueOnce(
      new Promise<CurrentUser | null>((_, reject) => {
        rejectUser = reject;
      })
    );

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    unmount();
    rejectUser(new Error('Session lookup failed'));

    await Promise.resolve();
  });
});

describe('logout', () => {
  function LogoutButton() {
    const { logout, isAuthenticated } = useAuth();
    return (
      <div>
        <div data-testid={NAV.AUTH}>{isAuthenticated ? 'yes' : 'no'}</div>
        <button type="button" data-testid={NAV.LOGOUT_BTN} onClick={logout}>
          Logout
        </button>
      </div>
    );
  }

  it('calls the server logout fn and clears the local user', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      isAdmin: true,
      permissions: ['view', 'delete'],
      username: 'admin',
      accessCodeId: null,
    });

    render(
      <AuthProvider>
        <LogoutButton />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'));

    screen.getByTestId('logout-btn').click();

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('no'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('clears the local user when server logout fails', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      isAdmin: false,
      permissions: ['view'],
      username: 'alice',
      accessCodeId: null,
    });
    mockLogout.mockRejectedValueOnce(new Error('Logout request failed'));

    render(
      <AuthProvider>
        <LogoutButton />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'));

    screen.getByTestId('logout-btn').click();

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('no'));
  });
});

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    function BadComponent() {
      useAuth();
      return <div>bad</div>;
    }

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BadComponent />)).toThrow('useAuth must be used within an AuthProvider');
    consoleError.mockRestore();
  });
});

describe('permission guard components', () => {
  const guardCases: {
    name: string;
    component: React.FC<{ children: React.ReactNode }>;
    user: CurrentUser | null;
    expectVisible: boolean;
  }[] = [
    {
      name: 'AdminOnly',
      component: AdminOnly,
      user: { isAdmin: true, permissions: ['view'], username: 'a', accessCodeId: null },
      expectVisible: true,
    },
    {
      name: 'AdminOnly',
      component: AdminOnly,
      user: { isAdmin: false, permissions: ['view'], username: 'a', accessCodeId: null },
      expectVisible: false,
    },
    {
      name: 'AuthenticatedOnly',
      component: AuthenticatedOnly,
      user: { isAdmin: false, permissions: ['view'], username: 'a', accessCodeId: null },
      expectVisible: true,
    },
    { name: 'AuthenticatedOnly', component: AuthenticatedOnly, user: null, expectVisible: false },
    {
      name: 'ColleagueOnly',
      component: ColleagueOnly,
      user: { isAdmin: false, permissions: ['view'], username: 'a', accessCodeId: 1 },
      expectVisible: true,
    },
    {
      name: 'ColleagueOnly',
      component: ColleagueOnly,
      user: { isAdmin: true, permissions: ['view'], username: 'a', accessCodeId: null },
      expectVisible: false,
    },
    { name: 'ColleagueOnly', component: ColleagueOnly, user: null, expectVisible: false },
  ];

  it.each(guardCases)(
    '$name renders children=$expectVisible',
    async ({ component: Guard, user, expectVisible }) => {
      mockGetCurrentUser.mockResolvedValueOnce(user);

      render(
        <AuthProvider>
          <Guard>
            <div data-testid={COMMON.GUARD_CONTENT}>content</div>
          </Guard>
        </AuthProvider>
      );

      if (expectVisible) {
        await waitFor(() => expect(screen.queryByTestId('guard-content')).toBeInTheDocument());
      } else {
        await waitFor(() => expect(screen.queryByTestId('guard-content')).not.toBeInTheDocument());
      }
    }
  );
});
