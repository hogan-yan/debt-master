// Pure builders for robots.txt + sitemap.xml content. Kept dependency-free
// so both the generator script and the vitest suite can import them.
// hreflang clusters in the sitemap mirror the landing routes' <head> links:
// one <xhtml:link> per locale plus x-default, on every URL (self-referencing
// entry included — a cluster missing the self link is ignored by Google).

export const BASE_LOCALE = 'en';
export const SITEMAP_LOCALES = ['en', 'ja', 'zh-tw'];

// Every indexable page path, in cluster order. '/' is the web landing,
// '/app' the mobile app landing; both are public, SSR-rendered surfaces.
export const SITEMAP_PATHS = ['/', '/app'];

export function localePath(locale) {
  return locale === BASE_LOCALE ? '/' : `/${locale}/`;
}

export function pageUrl(base, path, locale) {
  const prefix = locale === BASE_LOCALE ? '' : `/${locale}`;
  return `${base}${prefix}${path}`;
}

export function localeUrls(base) {
  return SITEMAP_LOCALES.map((locale) => pageUrl(base, '/', locale));
}

function alternateLinks(base, path) {
  const perLocale = SITEMAP_LOCALES.map(
    (locale) =>
      `    <xhtml:link rel="alternate" hreflang="${locale}" href="${pageUrl(base, path, locale)}"/>`
  );
  const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${base}${path}"/>`;
  return [...perLocale, xDefault].join('\n');
}

export function buildSitemapXml(base) {
  // One <url> entry per locale URL (a <url> may carry only one <loc>),
  // each with the full reciprocal cluster for its page path.
  const entries = SITEMAP_PATHS.flatMap((path) =>
    SITEMAP_LOCALES.map(
      (locale) =>
        `  <url>\n    <loc>${pageUrl(base, path, locale)}</loc>\n${alternateLinks(base, path)}\n  </url>`
    )
  );
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`
  );
}

export function buildRobotsTxt(base) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;
}
