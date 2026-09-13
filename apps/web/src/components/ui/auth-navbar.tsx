import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronDown, LogOut, Menu, Mountain, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { m } from '@/paraglide/messages';
import { NAV } from '@/test/test-ids';
import { AdminOnly, useAuth } from '@/utils/auth-context';
import { EnhancedAvatar } from './avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';

// Admin badge pill next the user menu. unslop-ignore
const ADMIN_PILL_CLASS = 'px-2 py-0.5 text-xs font-medium bg-info/10 text-info rounded-full'; // unslop-ignore

interface NavLinkProps {
  readonly to: string;
  readonly testId: string;
  readonly children: React.ReactNode;
  readonly mobile?: boolean;
  readonly onNavigate?: () => void;
}

function normalizeRoute(route: string): string {
  return route.replace(/\/$/, '') || '/';
}

function isActiveRoute(currentPath: string, to: string): boolean {
  const normalized = normalizeRoute(to);
  if (normalized === '/') {
    return currentPath === '/';
  }
  return currentPath.startsWith(normalized);
}

function NavLink({ to, testId, children, mobile, onNavigate }: NavLinkProps) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const active = isActiveRoute(currentPath, to);

  const baseClasses =
    'rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
  const desktopClasses =
    'hidden lg:inline-flex px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent';
  const mobileClasses =
    'block lg:hidden px-3 py-2 text-base text-muted-foreground hover:text-foreground hover:bg-accent';
  const activeClasses = 'bg-accent text-foreground';

  return (
    <Link
      to={to}
      data-testid={testId}
      className={`${baseClasses} ${mobile ? mobileClasses : desktopClasses} ${active ? activeClasses : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
    >
      {children}
    </Link>
  );
}

export function AuthNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { isAuthenticated, isAdmin, user, logout, isLoading } = useAuth();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navRef = useRef<HTMLElement>(null);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  // Close mobile menu on Escape and outside clicks.
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (navRef.current && !navRef.current.contains(target)) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  // Close mobile menu when the route changes.
  const prevPathRef = useRef(currentPath);
  useEffect(() => {
    if (prevPathRef.current !== currentPath) {
      prevPathRef.current = currentPath;
      setIsMobileMenuOpen(false);
    }
  });

  const displayName = user?.username || (isAdmin ? m.role_admin() : m.role_colleague());
  const roleLabel = isAdmin ? m.role_administrator() : m.role_colleagueAccess();

  // Show loading navbar while auth is being restored
  if (isLoading) {
    return (
      <nav className="border-b bg-background sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <Mountain className="h-6 w-6" />
                <span className="text-xl font-bold">{m.appTitle()}</span>
              </div>
            </div>
            <div className="flex items-center">
              <div className="animate-pulse bg-muted rounded h-4 w-20" />
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // If not authenticated, show minimal navbar with language and theme toggles
  if (!isAuthenticated) {
    return (
      <nav className="border-b bg-background sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              {/* Logged out, "/" is the public landing page — brand goes home */}
              <Link to="/" className="flex items-center space-x-2">
                <Mountain className="h-6 w-6" />
                <span className="text-xl font-bold">{m.appTitle()}</span>
              </Link>
            </div>
            <div className="flex items-center space-x-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const navItems = (
    <>
      <NavLink to="/" testId={NAV.DASHBOARD_LINK}>
        {m.nav_dashboard()}
      </NavLink>
      <NavLink to="/expenses/" testId={NAV.EXPENSES_LINK}>
        {m.nav_expenses()}
      </NavLink>
      <NavLink to="/colleagues/" testId={NAV.COLLEAGUES_LINK}>
        {m.nav_colleagues()}
      </NavLink>
      <NavLink to="/restaurants/" testId={NAV.RESTAURANTS_LINK}>
        {m.nav_restaurants()}
      </NavLink>
      <AdminOnly>
        <NavLink to="/payments/" testId={NAV.PAYMENTS_LINK}>
          {m.nav_payments()}
        </NavLink>
        <NavLink to="/settings/" testId={NAV.SETTINGS_LINK}>
          {m.nav_settings()}
        </NavLink>
      </AdminOnly>
    </>
  );

  return (
    <nav ref={navRef} className="border-b bg-background sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 shrink-0">
              <Mountain className="h-6 w-6 shrink-0" />
              <span className="text-xl font-bold whitespace-nowrap">{m.appTitle()}</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div
            className="hidden lg:flex items-center space-x-1"
            data-testid={NAV.DESKTOP_NAV_LINKS}
          >
            {navItems}

            {/* Utility controls */}
            <div className="flex items-center space-x-1 pl-4 ml-2 border-l border-border">
              <ThemeToggle />
              <LanguageSwitcher />

              {/* User menu */}
              <DropdownMenu open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-testid={NAV.USER_MENU_BTN}
                    className="flex items-center space-x-2 ml-2 pl-2 border-l border-border rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-label={`${displayName} user menu`}
                    aria-expanded={isUserMenuOpen}
                  >
                    <EnhancedAvatar name={displayName} size="sm" />
                    <span className="hidden lg:inline text-foreground">{displayName}</span>
                    {isAdmin && <span className={ADMIN_PILL_CLASS}>{m.role_admin()}</span>}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium text-foreground">{displayName}</p>
                      <p className="text-xs text-muted-foreground">{roleLabel}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid={NAV.USER_MENU_LOGOUT}
                    onSelect={handleLogout}
                    className="cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {m.nav_logout()}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center space-x-2">
            <ThemeToggle />
            <LanguageSwitcher />
            <button
              type="button"
              data-testid={NAV.MOBILE_MENU_TOGGLE_BTN}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMobileMenuOpen ? m.nav_closeMenu() : m.nav_openMenu()}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div id="mobile-menu" className="lg:hidden border-t border-border">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <NavLink
                to="/"
                testId={NAV.DASHBOARD_LINK}
                mobile
                onNavigate={() => setIsMobileMenuOpen(false)}
              >
                {m.nav_dashboard()}
              </NavLink>
              <NavLink
                to="/expenses/"
                testId={NAV.EXPENSES_LINK}
                mobile
                onNavigate={() => setIsMobileMenuOpen(false)}
              >
                {m.nav_expenses()}
              </NavLink>
              <NavLink
                to="/colleagues/"
                testId={NAV.COLLEAGUES_LINK}
                mobile
                onNavigate={() => setIsMobileMenuOpen(false)}
              >
                {m.nav_colleagues()}
              </NavLink>
              <NavLink
                to="/restaurants/"
                testId={NAV.RESTAURANTS_LINK}
                mobile
                onNavigate={() => setIsMobileMenuOpen(false)}
              >
                {m.nav_restaurants()}
              </NavLink>
              <AdminOnly>
                <NavLink
                  to="/payments/"
                  testId={NAV.PAYMENTS_LINK}
                  mobile
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  {m.nav_payments()}
                </NavLink>
                <NavLink
                  to="/settings/"
                  testId={NAV.SETTINGS_LINK}
                  mobile
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  {m.nav_settings()}
                </NavLink>
              </AdminOnly>

              {/* Mobile user section */}
              <div className="border-t border-border pt-4 mt-4">
                <div className="flex items-center px-3 py-2">
                  <EnhancedAvatar name={displayName} size="sm" className="mr-3" />
                  <div>
                    <div className="text-base font-medium text-foreground">{displayName}</div>
                    <div className="text-sm text-muted-foreground">{roleLabel}</div>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid={NAV.LOGOUT_BTN}
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <div className="flex items-center">
                    <LogOut className="h-5 w-5 mr-2" />
                    {m.nav_logout()}
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default AuthNavbar;
