// Generates public/robots.txt + public/sitemap.xml from PUBLIC_APP_URL.
// Both are gitignored: the absolute URLs depend on each deployment's env,
// so a committed copy would bake in the wrong domain. The sitemap lists all
// three locale landing URLs with reciprocal hreflang alternates.
import { writeFileSync } from 'node:fs';

import { buildRobotsTxt, buildSitemapXml } from './sitemap-builders.mjs';

const base = process.env.PUBLIC_APP_URL || 'http://localhost:3000';

writeFileSync('public/robots.txt', buildRobotsTxt(base));
writeFileSync('public/sitemap.xml', buildSitemapXml(base));

console.log(`[generate-sitemap] robots.txt + sitemap.xml for ${base}`);
