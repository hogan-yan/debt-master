import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  useLocation: vi.fn().mockReturnValue({ pathname: '/dashboard' }),
}));

vi.mock('@/paraglide/runtime', async () => {
  const actual = await vi.importActual('@/paraglide/runtime');
  return {
    ...actual,
    getLocale: vi.fn().mockReturnValue('en'),
    setLocale: vi.fn(),
    deLocalizeHref: vi.fn().mockReturnValue('/dashboard'),
    localizeHref: vi.fn().mockReturnValue('/zh-tw/dashboard'),
  };
});

import { deLocalizeHref, getLocale, setLocale } from '@/paraglide/runtime';
import { languageMenuitemId, NAV } from '@/test/test-ids';
import { LanguageSwitcher } from '../language-switcher';

const originalLocation = window.location;

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { href: '' },
  });
});

afterAll(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: originalLocation,
  });
});

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocale).mockReturnValue('en');
    window.location.href = '';
  });

  it('renders language switcher button', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByTestId(NAV.LANGUAGE_SWITCHER_BTN)).toBeInTheDocument();
  });

  it('opens dropdown with locale options', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByTestId(NAV.LANGUAGE_SWITCHER_BTN));

    expect(screen.getByTestId(languageMenuitemId('en'))).toBeInTheDocument();
    expect(screen.getByTestId(languageMenuitemId('zh-tw'))).toBeInTheDocument();
    expect(screen.getByTestId(languageMenuitemId('ja'))).toBeInTheDocument();
  });

  it('highlights current locale', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByTestId(NAV.LANGUAGE_SWITCHER_BTN));

    const enOption = screen.getByTestId(languageMenuitemId('en'));
    expect(enOption).toHaveClass('bg-accent');
  });

  it('changes locale when different locale selected', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByTestId(NAV.LANGUAGE_SWITCHER_BTN));
    await user.click(screen.getByTestId(languageMenuitemId('zh-tw')));

    expect(setLocale).toHaveBeenCalledWith('zh-tw', { reload: false });
    expect(window.location.href).toBe('/zh-tw/dashboard');
  });

  it('does nothing when current locale is selected', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByTestId(NAV.LANGUAGE_SWITCHER_BTN));
    await user.click(screen.getByTestId(languageMenuitemId('en')));

    expect(setLocale).not.toHaveBeenCalled();
  });

  it('uses deLocalized path for navigation', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByTestId(NAV.LANGUAGE_SWITCHER_BTN));
    await user.click(screen.getByTestId(languageMenuitemId('zh-tw')));

    expect(deLocalizeHref).toHaveBeenCalledWith('/dashboard');
  });
});
