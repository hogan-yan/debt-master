import { useLocation } from '@tanstack/react-router';
import { Globe } from 'lucide-react';
import { m } from '@/paraglide/messages';
import {
  deLocalizeHref,
  getLocale,
  type Locale,
  locales,
  localizeHref,
  setLocale,
} from '@/paraglide/runtime';
import { languageMenuitemId, NAV } from '@/test/test-ids';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

const localeLabels: Record<Locale, () => string> = {
  en: m.locale_en,
  'zh-tw': m.locale_zh_tw,
  ja: m.locale_ja,
};

export function LanguageSwitcher() {
  const currentLocale = getLocale();
  const location = useLocation();

  const handleLocaleChange = (locale: Locale) => {
    if (locale === currentLocale) return;

    // Set the locale cookie so the server knows the preferred locale.
    setLocale(locale, { reload: false });

    // Navigate to the localized URL via full page load.
    // TanStack Router's rewrite API treats localized and delocalized URLs
    // as the same internal route, so navigate() is a no-op when the
    // resolved route doesn't change. window.location.href bypasses this.
    const basePath = deLocalizeHref(location.pathname);
    const localizedPath = localizeHref(basePath, { locale });
    window.location.href = localizedPath;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={m.lang_switch()}
          data-testid={NAV.LANGUAGE_SWITCHER_BTN}
          className="relative"
        >
          <Globe className="h-4 w-4" />
          <span className="sr-only">{m.lang_switch()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            data-testid={languageMenuitemId(locale)}
            onSelect={() => handleLocaleChange(locale)}
            className={locale === currentLocale ? 'bg-accent' : ''}
          >
            <span className={locale === currentLocale ? 'font-medium' : ''}>
              {localeLabels[locale]()}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
