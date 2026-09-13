import { describe, expect, it } from 'vitest';

import {
  buildRobotsTxt,
  buildSitemapXml,
  localeUrls,
  pageUrl,
  SITEMAP_LOCALES,
  SITEMAP_PATHS,
} from '../../scripts/sitemap-builders.mjs';

const BASE = 'https://dm.example';

describe('sitemap builders', () => {
  it('lists every locale landing URL', () => {
    const xml = buildSitemapXml(BASE);
    for (const url of localeUrls(BASE)) {
      expect(xml).toContain(`<loc>${url}</loc>`);
    }
    expect(localeUrls(BASE)).toEqual([
      'https://dm.example/',
      'https://dm.example/ja/',
      'https://dm.example/zh-tw/',
    ]);
  });

  it('lists the mobile app landing under every locale, prefix before path', () => {
    const xml = buildSitemapXml(BASE);
    expect(pageUrl(BASE, '/app', 'en')).toBe('https://dm.example/app');
    expect(pageUrl(BASE, '/app', 'ja')).toBe('https://dm.example/ja/app');
    expect(pageUrl(BASE, '/app', 'zh-tw')).toBe('https://dm.example/zh-tw/app');
    for (const locale of SITEMAP_LOCALES) {
      expect(xml).toContain(`<loc>${pageUrl(BASE, '/app', locale)}</loc>`);
    }
  });

  it('gives every URL a reciprocal hreflang cluster with a self-referencing entry', () => {
    const xml = buildSitemapXml(BASE);
    const urlBlocks = xml.split('<url>').slice(1);
    const expected = SITEMAP_PATHS.flatMap((path) =>
      SITEMAP_LOCALES.map((locale) => ({ path, locale })),
    );
    expect(urlBlocks).toHaveLength(expected.length);

    for (const [index, { path, locale }] of expected.entries()) {
      const block = urlBlocks[index];
      if (!block) throw new Error(`missing sitemap <url> block at index ${index}`);
      const cluster = block.match(/hreflang="([^"]+)"/g) ?? [];
      expect(cluster).toHaveLength(SITEMAP_LOCALES.length + 1); // + x-default
      expect(block).toContain(`hreflang="${locale}" href="${pageUrl(BASE, path, locale)}"`);
      expect(block).toContain(`hreflang="x-default" href="${BASE}${path}"`);
    }
  });

  it('declares the xhtml namespace', () => {
    const xml = buildSitemapXml(BASE);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it('keeps base URLs free of double slashes', () => {
    const xml = buildSitemapXml(BASE);
    expect(xml).not.toContain('//ja');
    expect(xml).not.toContain('//zh-tw');
    expect(xml).not.toContain('//app');
  });

  it('points robots.txt at the sitemap', () => {
    expect(buildRobotsTxt(BASE)).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://dm.example/sitemap.xml\n',
    );
  });
});
