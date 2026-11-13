import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Layout } from '../Layout';

const mockLocation = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div data-testid="outlet">Outlet</div>,
  useRouterState: ({ select }: { select: (state: { location: typeof mockLocation }) => string }) =>
    select({ location: mockLocation }),
}));

vi.mock('@/paraglide/messages', () => ({
  m: {
    nav_skipToContent: () => 'Skip to content',
    footer_copyright: () => 'Copyright',
  },
}));

vi.mock('@/utils/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/auth-navbar', () => ({
  AuthNavbar: () => <nav data-testid="auth-navbar">Navbar</nav>,
}));

describe('Layout', () => {
  it('renders children when provided', () => {
    render(
      <Layout>
        <div data-testid="child">Child Content</div>
      </Layout>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders Outlet when no children provided', () => {
    render(<Layout />);
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('renders skip to content link', () => {
    render(<Layout />);
    expect(screen.getByText('Skip to content')).toBeInTheDocument();
  });

  it('renders auth navbar', () => {
    render(<Layout />);
    expect(screen.getByTestId('auth-navbar')).toBeInTheDocument();
  });

  it('renders footer with copyright', () => {
    render(<Layout />);
    expect(screen.getByText('Copyright')).toBeInTheDocument();
  });

  it('moves focus to main content on route change', () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    const setAttributeSpy = vi.spyOn(HTMLElement.prototype, 'setAttribute');

    const { rerender } = render(<Layout />);

    expect(document.getElementById('main-content')).toBeInTheDocument();

    mockLocation.pathname = '/expenses';
    rerender(<Layout />);

    const main = document.getElementById('main-content');
    expect(setAttributeSpy).toHaveBeenCalledWith('tabIndex', '-1');
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(main);

    focusSpy.mockRestore();
    setAttributeSpy.mockRestore();
  });

  it('does not focus when the main content element is unavailable', () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    const getElementByIdSpy = vi.spyOn(document, 'getElementById').mockReturnValue(null);

    const { rerender } = render(<Layout />);
    mockLocation.pathname = '/missing-main-content';
    rerender(<Layout />);

    expect(focusSpy).not.toHaveBeenCalled();

    getElementByIdSpy.mockRestore();
    focusSpy.mockRestore();
  });
});
