// Types for scripts/sitemap-builders.mjs (plain JS so the node-run
// generator script can import it without a build step).
export declare const BASE_LOCALE: 'en';
export declare const SITEMAP_LOCALES: readonly ['en', 'ja', 'zh-tw'];
export declare const SITEMAP_PATHS: readonly ['/', '/app'];
export declare function localePath(locale: string): string;
export declare function pageUrl(base: string, path: string, locale: string): string;
export declare function localeUrls(base: string): string[];
export declare function buildSitemapXml(base: string): string;
export declare function buildRobotsTxt(base: string): string;
