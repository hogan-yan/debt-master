import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthNavbar } from '../auth-navbar';

const mockLogout = vi.fn();
let mockAuthState = {
  isAuthenticated: false,
  isAdmin: false,
  user: null as { username: string } | null,
  logout: mockLogout,
  isLoading: false,
};
let mockPathname = '/';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select?: (s: { location: { pathname: string } }) => unknown }) => {
    const state = { location: { pathname: mockPathname } };
    return select ? select(state) : state;
  },
}));

vi.mock('@/utils/auth-context', () => ({
  useAuth: () => mockAuthState,
  AdminOnly: ({ children }: { children: React.ReactNode }) => {
    return mockAuthState.isAdmin ? children : null;
  },
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    appTitle: () => 'Debt Master',
    nav_dashboard: () => 'Dashboard',
    nav_expenses: () => 'Expenses',
    nav_colleagues: () => 'Colleagues',
    nav_restaurants: () => 'Restaurants',
    nav_payments: () => 'Payments',
    nav_settings: () => 'Settings',
    nav_logout: () => 'Logout',
    nav_openMenu: () => 'Open menu',
    nav_closeMenu: () => 'Close menu',
    role_admin: () => 'Admin',
    role_colleague: () => 'Colleague',
    role_administrator: () => 'Administrator',
    role_colleagueAccess: () => 'Colleague Access',
    theme_label: () => 'Theme',
    lang_label: () => 'Language',
  },
}));

vi.mock('@/components/ui/language-switcher', () => ({
  LanguageSwitcher: () => <button type="button">Language</button>,
}));

vi.mock('@/components/ui/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

describe('AuthNavbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      isAuthenticated: false,
      isAdmin: false,
      user: null,
      logout: mockLogout,
      isLoading: false,
    };
    mockPathname = '/';
  });

  it('renders loading state', () => {
    mockAuthState.isLoading = true;
    render(<AuthNavbar />);
    expect(screen.getByText('Debt Master')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders minimal navbar when not authenticated', () => {
    mockAuthState.isAuthenticated = false;
    render(<AuthNavbar />);
    expect(screen.getByText('Debt Master')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('renders full navbar when authenticated', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { username: 'Alice' };
    render(<AuthNavbar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
    expect(screen.getByText('Colleagues')).toBeInTheDocument();
    expect(screen.getByText('Restaurants')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows admin nav items when admin', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = true;
    mockAuthState.user = { username: 'Admin' };
    render(<AuthNavbar />);
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1);
  });

  it('shows fallback role when no username', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = false;
    mockAuthState.user = null;
    render(<AuthNavbar />);
    expect(screen.getByText('Colleague')).toBeInTheDocument();
  });

  it('calls logout and redirects on logout click', async () => {
    mockAuthState.isAuthenticated = true;
    render(<AuthNavbar />);
    const userMenuBtn = screen.getByTestId('user-menu-btn');
    await userEvent.click(userMenuBtn);
    const logoutBtn = screen.getByTestId('user-menu-logout');
    await userEvent.click(logoutBtn);
    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('opens user menu and shows role information', async () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { username: 'Alice' };
    render(<AuthNavbar />);
    const userMenuBtn = screen.getByTestId('user-menu-btn');
    await userEvent.click(userMenuBtn);
    expect(screen.getByTestId('user-menu-logout')).toBeInTheDocument();
    expect(screen.getByText('Colleague Access')).toBeInTheDocument();
  });

  it('toggles mobile menu', async () => {
    mockAuthState.isAuthenticated = true;
    render(<AuthNavbar />);
    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await userEvent.click(menuBtn);
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
  });

  it('closes the mobile menu when the route changes', async () => {
    mockAuthState.isAuthenticated = true;
    mockPathname = '/expenses';
    const { rerender } = render(<AuthNavbar />);

    await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();

    mockPathname = '/colleagues';
    rerender(<AuthNavbar />);

    expect(screen.queryByRole('button', { name: /close menu/i })).not.toBeInTheDocument();
  });

  it('closes the mobile menu when Escape is pressed', async () => {
    mockAuthState.isAuthenticated = true;
    const user = userEvent.setup();
    render(<AuthNavbar />);

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('button', { name: /close menu/i })).not.toBeInTheDocument();
  });

  it('keeps the mobile menu open for non-Escape key presses', async () => {
    mockAuthState.isAuthenticated = true;
    const user = userEvent.setup();
    render(<AuthNavbar />);

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    fireEvent.keyDown(document, { key: 'a', code: 'KeyA' });

    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
  });

  it('closes the mobile menu when a pointer event occurs outside navigation', async () => {
    mockAuthState.isAuthenticated = true;
    const user = userEvent.setup();
    render(
      <>
        <AuthNavbar />
        <button type="button">Outside navigation</button>
      </>
    );

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await user.click(screen.getByRole('button', { name: 'Outside navigation' }));

    expect(screen.queryByRole('button', { name: /close menu/i })).not.toBeInTheDocument();
  });

  it('closes mobile menu when clicking a link', async () => {
    mockAuthState.isAuthenticated = true;
    render(<AuthNavbar />);
    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await userEvent.click(menuBtn);
    const dashboardLink = screen.getAllByText('Dashboard').pop();
    if (dashboardLink) await userEvent.click(dashboardLink);
    expect(screen.queryByText('Administrator')).not.toBeInTheDocument();
  });

  it('closes mobile menu when clicking expenses link', async () => {
    mockAuthState.isAuthenticated = true;
    render(<AuthNavbar />);
    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await userEvent.click(menuBtn);
    const expensesLink = screen.getAllByText('Expenses').pop();
    if (expensesLink) await userEvent.click(expensesLink);
    expect(screen.queryByRole('button', { name: /close menu/i })).not.toBeInTheDocument();
  });

  it('closes mobile menu when clicking colleagues link', async () => {
    mockAuthState.isAuthenticated = true;
    render(<AuthNavbar />);
    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await userEvent.click(menuBtn);
    const colleaguesLink = screen.getAllByText('Colleagues').pop();
    if (colleaguesLink) await userEvent.click(colleaguesLink);
    expect(screen.queryByRole('button', { name: /close menu/i })).not.toBeInTheDocument();
  });

  it('closes mobile menu when clicking restaurants link', async () => {
    mockAuthState.isAuthenticated = true;
    render(<AuthNavbar />);
    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await userEvent.click(menuBtn);
    const restaurantsLink = screen.getAllByText('Restaurants').pop();
    if (restaurantsLink) await userEvent.click(restaurantsLink);
    expect(screen.queryByRole('button', { name: /close menu/i })).not.toBeInTheDocument();
  });

  it('closes mobile menu when clicking payments link as admin', async () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = true;
    render(<AuthNavbar />);
    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await userEvent.click(menuBtn);
    const paymentsLink = screen.getAllByText('Payments').pop();
    if (paymentsLink) await userEvent.click(paymentsLink);
    expect(screen.queryByRole('button', { name: /close menu/i })).not.toBeInTheDocument();
  });

  it('shows admin mobile nav items when admin', async () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = true;
    render(<AuthNavbar />);
    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await userEvent.click(menuBtn);
    expect(screen.getAllByText('Payments').length).toBeGreaterThanOrEqual(1);
  });

  it('closes the mobile menu after an admin navigates to settings', async () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = true;
    const user = userEvent.setup();
    render(<AuthNavbar />);

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await user.click(screen.getAllByText('Settings').at(-1)!);

    expect(screen.queryByRole('button', { name: /close menu/i })).not.toBeInTheDocument();
  });

  it('shows admin fallback in mobile user section when no username', async () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = true;
    mockAuthState.user = null;
    render(<AuthNavbar />);
    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await userEvent.click(menuBtn);
    expect(screen.getByText('Administrator')).toBeInTheDocument();
  });

  it('shows colleague fallback in mobile user section when no username', async () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = false;
    mockAuthState.user = null;
    render(<AuthNavbar />);
    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    await userEvent.click(menuBtn);
    expect(screen.getByText('Colleague Access')).toBeInTheDocument();
  });

  it('sets aria-current for dashboard path', () => {
    mockAuthState.isAuthenticated = true;
    mockPathname = '/';
    render(<AuthNavbar />);
    const dashboardLink = screen.getByTestId('dashboard-link');
    expect(dashboardLink).toHaveAttribute('aria-current', 'page');
  });

  it('sets aria-current for expenses path', () => {
    mockAuthState.isAuthenticated = true;
    mockPathname = '/expenses';
    render(<AuthNavbar />);
    const expensesLink = screen.getByTestId('expenses-link');
    expect(expensesLink).toHaveAttribute('aria-current', 'page');
  });

  it('sets aria-current for colleagues path', () => {
    mockAuthState.isAuthenticated = true;
    mockPathname = '/colleagues';
    render(<AuthNavbar />);
    const colleaguesLink = screen.getByTestId('colleagues-link');
    expect(colleaguesLink).toHaveAttribute('aria-current', 'page');
  });

  it('sets aria-current for restaurants path', () => {
    mockAuthState.isAuthenticated = true;
    mockPathname = '/restaurants';
    render(<AuthNavbar />);
    const restaurantsLink = screen.getByTestId('restaurants-link');
    expect(restaurantsLink).toHaveAttribute('aria-current', 'page');
  });

  it('sets aria-current for payments path when admin', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = true;
    mockPathname = '/payments';
    render(<AuthNavbar />);
    const paymentsLink = screen.getByTestId('payments-link');
    expect(paymentsLink).toHaveAttribute('aria-current', 'page');
  });
});
