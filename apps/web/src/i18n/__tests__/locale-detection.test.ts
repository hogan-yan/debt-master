import { beforeEach, describe, expect, it } from 'vitest';
import {
  baseLocale,
  cookieName,
  deLocalizeHref,
  deLocalizeUrl,
  extractLocaleFromCookie,
  extractLocaleFromRequest,
  extractLocaleFromRequestWithStrategies,
  extractLocaleFromUrl,
  isLocale,
  locales,
  localizeHref,
  localizeUrl,
  overwriteGetUrlOrigin,
  toLocale,
} from '@/paraglide/runtime';

describe('toLocale', () => {
  it('matches valid locales', () => {
    expect(toLocale('en')).toBe('en');
    expect(toLocale('ja')).toBe('ja');
    expect(toLocale('zh-tw')).toBe('zh-tw');
  });

  it('is case-insensitive', () => {
    expect(toLocale('JA')).toBe('ja');
    expect(toLocale('ZH-TW')).toBe('zh-tw');
    expect(toLocale('En')).toBe('en');
  });

  it('returns undefined for unsupported locales', () => {
    expect(toLocale('fr')).toBeUndefined();
    expect(toLocale('de')).toBeUndefined();
  });

  it('returns undefined for non-string input', () => {
    // Testing defensive behavior with invalid input types (toLocale expects string)
    expect(toLocale(123 as unknown as string)).toBeUndefined();
    expect(toLocale(undefined as unknown as string)).toBeUndefined();
  });
});

describe('isLocale', () => {
  it('returns true for configured locales', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ja')).toBe(true);
    expect(isLocale('zh-tw')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('extractLocaleFromUrl', () => {
  it('extracts ja from /ja/ path', () => {
    expect(extractLocaleFromUrl('http://localhost/ja/expenses')).toBe('ja');
  });

  it('extracts zh-tw from /zh-tw/ path', () => {
    expect(extractLocaleFromUrl('http://localhost/zh-tw/login')).toBe('zh-tw');
  });

  it('returns base locale for unprefixed paths', () => {
    expect(extractLocaleFromUrl('http://localhost/expenses')).toBe('en');
  });

  it('returns base locale for root path', () => {
    expect(extractLocaleFromUrl('http://localhost/')).toBe('en');
  });

  it('handles nested paths', () => {
    expect(extractLocaleFromUrl('http://localhost/ja/expenses/123')).toBe('ja');
  });
});

describe('extractLocaleFromCookie', () => {
  function setCookie(cookie: string): void {
    // biome-ignore lint/suspicious/noDocumentCookie: test environment needs explicit cookie control
    document.cookie = cookie;
  }

  beforeEach(() => {
    setCookie(`${cookieName}=; max-age=0`);
  });

  it('extracts ja from cookie', () => {
    setCookie(`${cookieName}=ja`);
    expect(extractLocaleFromCookie()).toBe('ja');
  });

  it('extracts zh-tw from cookie', () => {
    setCookie(`${cookieName}=zh-tw`);
    expect(extractLocaleFromCookie()).toBe('zh-tw');
  });

  it('returns undefined when no locale cookie is set', () => {
    expect(extractLocaleFromCookie()).toBeUndefined();
  });

  it('returns undefined for invalid locale in cookie', () => {
    setCookie(`${cookieName}=fr`);
    expect(extractLocaleFromCookie()).toBeUndefined();
  });
});

describe('extractLocaleFromRequest', () => {
  it('extracts locale from cookie header', () => {
    const request = new Request('http://localhost/expenses', {
      headers: { cookie: `${cookieName}=ja` },
    });
    expect(extractLocaleFromRequestWithStrategies(request, ['cookie', 'url', 'baseLocale'])).toBe(
      'ja'
    );
  });

  it('extracts zh-tw from cookie header', () => {
    const request = new Request('http://localhost/expenses', {
      headers: { cookie: `${cookieName}=zh-tw` },
    });
    expect(extractLocaleFromRequestWithStrategies(request, ['cookie', 'url', 'baseLocale'])).toBe(
      'zh-tw'
    );
  });

  it('falls back to base locale with no cookie', () => {
    const request = new Request('http://localhost/expenses');
    expect(extractLocaleFromRequest(request)).toBe(baseLocale);
  });

  it('falls back to base locale for invalid cookie value', () => {
    const request = new Request('http://localhost/expenses', {
      headers: { cookie: `${cookieName}=fr` },
    });
    expect(extractLocaleFromRequest(request)).toBe(baseLocale);
  });

  it('cookie takes priority over other headers', () => {
    const request = new Request('http://localhost/expenses', {
      headers: {
        cookie: `${cookieName}=ja`,
        'accept-language': 'zh-TW',
      },
    });
    expect(extractLocaleFromRequestWithStrategies(request, ['cookie', 'url', 'baseLocale'])).toBe(
      'ja'
    );
  });
});

describe('URL localization round-trip', () => {
  const testUrl = 'http://localhost/expenses';

  it('round-trips for en (base locale)', () => {
    const localized = localizeUrl(testUrl, { locale: 'en' });
    const delocalized = deLocalizeUrl(localized);
    expect(delocalized.pathname).toBe('/expenses');
  });

  it('round-trips for ja', () => {
    const localized = localizeUrl(testUrl, { locale: 'ja' });
    expect(localized.pathname).toBe('/ja/expenses');
    const delocalized = deLocalizeUrl(localized);
    expect(delocalized.pathname).toBe('/expenses');
  });

  it('round-trips for zh-tw', () => {
    const localized = localizeUrl(testUrl, { locale: 'zh-tw' });
    expect(localized.pathname).toBe('/zh-tw/expenses');
    const delocalized = deLocalizeUrl(localized);
    expect(delocalized.pathname).toBe('/expenses');
  });

  it('switching locale from ja to en strips prefix', () => {
    const jaUrl = 'http://localhost/ja/expenses';
    const enUrl = localizeUrl(jaUrl, { locale: 'en' });
    expect(enUrl.pathname).toBe('/expenses');
  });

  it('switching locale from en to ja adds prefix', () => {
    const enUrl = 'http://localhost/expenses';
    const jaUrl = localizeUrl(enUrl, { locale: 'ja' });
    expect(jaUrl.pathname).toBe('/ja/expenses');
  });

  it('switching between non-base locales', () => {
    const jaUrl = 'http://localhost/ja/expenses';
    const zhTwUrl = localizeUrl(jaUrl, { locale: 'zh-tw' });
    expect(zhTwUrl.pathname).toBe('/zh-tw/expenses');
  });

  it('deLocalizeUrl is idempotent', () => {
    const url = new URL('http://localhost/expenses');
    expect(deLocalizeUrl(deLocalizeUrl(url)).pathname).toBe('/expenses');
  });
});

describe('localizeHref / deLocalizeHref', () => {
  beforeEach(() => {
    overwriteGetUrlOrigin(() => 'http://localhost:3000');
  });

  it('localizeHref adds ja prefix to relative path', () => {
    expect(localizeHref('/expenses', { locale: 'ja' })).toBe('/ja/expenses');
  });

  it('localizeHref adds zh-tw prefix to relative path', () => {
    expect(localizeHref('/expenses', { locale: 'zh-tw' })).toBe('/zh-tw/expenses');
  });

  it('localizeHref keeps en paths unprefixed', () => {
    expect(localizeHref('/expenses', { locale: 'en' })).toBe('/expenses');
  });

  it('deLocalizeHref strips locale prefix', () => {
    expect(deLocalizeHref('/ja/expenses')).toBe('/expenses');
    expect(deLocalizeHref('/zh-tw/expenses')).toBe('/expenses');
  });

  it('deLocalizeHref leaves unprefixed paths unchanged', () => {
    expect(deLocalizeHref('/expenses')).toBe('/expenses');
  });

  it('round-trip: deLocalizeHref(localizeHref(x)) preserves path', () => {
    const path = '/expenses';
    for (const locale of locales) {
      const localized = localizeHref(path, { locale });
      const delocalized = deLocalizeHref(localized);
      expect(delocalized).toBe(path);
    }
  });
});
