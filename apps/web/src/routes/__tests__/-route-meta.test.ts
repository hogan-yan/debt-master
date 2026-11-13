import { describe, expect, it } from 'vitest';

interface RouteModule {
  Route: {
    options: {
      head?: (ctx: unknown) =>
        | Promise<{
            meta?: Array<Record<string, string>>;
            links?: Array<Record<string, string>>;
          }>
        | {
            meta?: Array<Record<string, string>>;
            links?: Array<Record<string, string>>;
          };
    };
  };
}

async function getRouteMeta(
  mod: RouteModule,
  ctx: unknown = {}
): Promise<Array<Record<string, string>>> {
  const head = mod.Route.options.head;
  if (!head) return [];
  const result = await head(ctx);
  return result.meta ?? [];
}

async function getRouteLinks(
  mod: RouteModule,
  ctx: unknown = {}
): Promise<Array<Record<string, string>>> {
  const head = mod.Route.options.head;
  if (!head) return [];
  const result = await head(ctx);
  return result.links ?? [];
}

/**
 * DEBTM-56: Page titles for all routes
 * Each route should export a head function that returns the correct page title.
 */
describe('DEBTM-56: Page titles', () => {
  it('root route (/) shows the landing title when anonymous (public landing is the indexable surface)', async () => {
    const mod = await import('../index');
    const meta = await getRouteMeta(mod as RouteModule);
    const titleMeta = meta.find((m) => 'title' in m);
    expect(titleMeta?.title).toBe('Debt Master — Free, self-hosted team lunch debt tracker');
  });

  it('root route (/) shows the dashboard title when SSR dashboard data is present (signed in)', async () => {
    const mod = await import('../index');
    const meta = await getRouteMeta(mod as RouteModule, {
      loaderData: {
        debtLeaderboard: { debtors: [{ name: 'Priya' }] },
        selfUrl: 'https://dm.example/',
      },
    });
    const titleMeta = meta.find((m) => 'title' in m);
    expect(titleMeta?.title).toBe('Dashboard — Debt Master');
  });

  it('login route has title "Colleague Access — Debt Master"', async () => {
    const mod = await import('../login');
    const meta = await getRouteMeta(mod as RouteModule);
    const titleMeta = meta.find((m) => 'title' in m);
    expect(titleMeta?.title).toBe('Colleague Access — Debt Master');
  });

  it('app route (/app) shows the mobile app landing title', async () => {
    const mod = await import('../app');
    const meta = await getRouteMeta(mod as RouteModule);
    const titleMeta = meta.find((m) => 'title' in m);
    expect(titleMeta?.title).toBe('Debt Master for iPhone & Android — split expenses with friends');
  });

  it('app route (/app) has absolute og:url and a canonical per locale', async () => {
    const mod = await import('../app');
    const meta = await getRouteMeta(mod as RouteModule);
    const ogUrl = meta.find((m) => m.property === 'og:url');
    expect(ogUrl?.content).toMatch(/^https?:\/\/.+\/app$/);
    const links = await getRouteLinks(mod as RouteModule);
    const { APP_URL } = await import('@/utils/app-url');
    expect(links).toContainEqual({ rel: 'canonical', href: `${APP_URL}/app` });
    expect(links).toContainEqual({
      rel: 'alternate',
      hrefLang: 'ja',
      href: `${APP_URL}/ja/app`,
    });
    expect(links).toContainEqual({
      rel: 'alternate',
      hrefLang: 'x-default',
      href: `${APP_URL}/app`,
    });
  });

  it('expenses route has title "Expenses — Debt Master"', async () => {
    const mod = await import('../expenses');
    const meta = await getRouteMeta(mod as RouteModule);
    const titleMeta = meta.find((m) => 'title' in m);
    expect(titleMeta?.title).toBe('Expenses — Debt Master');
  });

  it('expense detail route has title "Expense Details — Debt Master"', async () => {
    const mod = await import('../expense.$id');
    const meta = await getRouteMeta(mod as RouteModule);
    const titleMeta = meta.find((m) => 'title' in m);
    expect(titleMeta?.title).toBe('Expense Details — Debt Master');
  });

  it('colleagues route has title "Colleagues — Debt Master"', async () => {
    const mod = await import('../colleagues');
    const meta = await getRouteMeta(mod as RouteModule);
    const titleMeta = meta.find((m) => 'title' in m);
    expect(titleMeta?.title).toBe('Colleagues — Debt Master');
  });

  it('colleague detail route has title "Colleague Details — Debt Master"', async () => {
    const mod = await import('../colleagues.$colleagueId');
    const meta = await getRouteMeta(mod as RouteModule);
    const titleMeta = meta.find((m) => 'title' in m);
    expect(titleMeta?.title).toBe('Colleague Details — Debt Master');
  });

  it('restaurants route has title "Restaurants — Debt Master"', async () => {
    const mod = await import('../restaurants');
    const meta = await getRouteMeta(mod as RouteModule);
    const titleMeta = meta.find((m) => 'title' in m);
    expect(titleMeta?.title).toBe('Restaurants — Debt Master');
  });

  it('restaurant detail route has title "Restaurant Details — Debt Master"', async () => {
    const mod = await import('../restaurants.$id');
    const meta = await getRouteMeta(mod as RouteModule);
    const titleMeta = meta.find((m) => 'title' in m);
    expect(titleMeta?.title).toBe('Restaurant Details — Debt Master');
  });

  it('payments route has title "Payments — Debt Master"', async () => {
    const mod = await import('../payments');
    const meta = await getRouteMeta(mod as RouteModule);
    const titleMeta = meta.find((m) => 'title' in m);
    expect(titleMeta?.title).toBe('Payments — Debt Master');
  });
});

/**
 * DEBTM-55: OG meta tags for /login (only public route in a private app)
 */
describe('DEBTM-55: OG meta tags on /login', () => {
  it('login route has og:title', async () => {
    const mod = await import('../login');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta).toContainEqual({
      property: 'og:title',
      content: 'Colleague Access — Debt Master',
    });
  });

  it('login route has og:description', async () => {
    const mod = await import('../login');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta).toContainEqual({
      property: 'og:description',
      content:
        "Sign in to your team's lunch ledger. Colleagues sign in with an access code; admins log lunches and payments.",
    });
  });

  it('login route has og:type', async () => {
    const mod = await import('../login');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta).toContainEqual({ property: 'og:type', content: 'website' });
  });

  it('login route has og:site_name', async () => {
    const mod = await import('../login');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta).toContainEqual({ property: 'og:site_name', content: 'Debt Master' });
  });

  it('login route has og:image with absolute URL', async () => {
    const mod = await import('../login');
    const meta = await getRouteMeta(mod as RouteModule);
    const ogImage = meta.find((m) => m.property === 'og:image');
    expect(ogImage?.content).toMatch(/^https?:\/\/.+\/og-image\.png$/);
  });

  it('login route has og:url with absolute URL', async () => {
    const mod = await import('../login');
    const meta = await getRouteMeta(mod as RouteModule);
    const ogUrl = meta.find((m) => m.property === 'og:url');
    expect(ogUrl?.content).toMatch(/^https?:\/\/.+\/login$/);
  });

  it('login route has twitter:card', async () => {
    const mod = await import('../login');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' });
  });

  it('login route has twitter:title', async () => {
    const mod = await import('../login');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta).toContainEqual({
      name: 'twitter:title',
      content: 'Colleague Access — Debt Master',
    });
  });

  it('login route has twitter:description', async () => {
    const mod = await import('../login');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta).toContainEqual({
      name: 'twitter:description',
      content:
        "Sign in to your team's lunch ledger. Colleagues sign in with an access code; admins log lunches and payments.",
    });
  });

  it('login route has twitter:image with absolute URL', async () => {
    const mod = await import('../login');
    const meta = await getRouteMeta(mod as RouteModule);
    const twitterImage = meta.find((m) => m.name === 'twitter:image');
    expect(twitterImage?.content).toMatch(/^https?:\/\/.+\/og-image\.png$/);
  });
});

/**
 * Indexation hygiene: the public landing at / is the only indexable surface.
 * Auth and utility pages carry robots noindex so thin/duplicate surfaces
 * never enter the index; the landing itself must stay indexable.
 */
describe('indexation hygiene (noindex on auth/utility routes)', () => {
  it('login route is noindex, follow', async () => {
    const mod = await import('../login');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta).toContainEqual({ name: 'robots', content: 'noindex, follow' });
  });

  it('setup route is noindex, nofollow', async () => {
    const mod = await import('../setup');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta).toContainEqual({ name: 'robots', content: 'noindex, nofollow' });
  });

  it('forgot-password route is noindex, nofollow', async () => {
    const mod = await import('../forgot-password');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta).toContainEqual({ name: 'robots', content: 'noindex, nofollow' });
  });

  it('reset-password route is noindex, nofollow', async () => {
    const mod = await import('../reset-password');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta).toContainEqual({ name: 'robots', content: 'noindex, nofollow' });
  });

  it('auth callback route is noindex, nofollow', async () => {
    const mod = await import('../auth.callback');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta).toContainEqual({ name: 'robots', content: 'noindex, nofollow' });
  });

  it('landing meta never carries noindex', async () => {
    const mod = await import('../index');
    const meta = await getRouteMeta(mod as RouteModule);
    expect(meta.find((m) => m.name === 'robots')).toBeUndefined();
  });
});

/**
 * Hreflang cluster on the landing: reciprocal en/ja/zh-tw alternates plus
 * x-default, and a self-referencing canonical (a cluster without the self
 * entry is ignored by Google entirely).
 */
describe('landing hreflang cluster', () => {
  it('ships alternates for en, ja, zh-tw and x-default with a self canonical', async () => {
    const mod = await import('../index');
    const links = await getRouteLinks(mod as RouteModule);
    const canonical = links.find((l) => l.rel === 'canonical');
    expect(canonical?.href).toMatch(/\/$/);

    const alternates = links.filter((l) => l.rel === 'alternate');
    const hreflangs = alternates.map((l) => l.hrefLang).sort();
    expect(hreflangs).toEqual(['en', 'ja', 'x-default', 'zh-tw']);

    for (const link of alternates) {
      expect(link.href).toMatch(/\/$/);
    }
    expect(alternates.find((l) => l.hrefLang === 'ja')?.href).toContain('/ja/');
    expect(alternates.find((l) => l.hrefLang === 'zh-tw')?.href).toContain('/zh-tw/');
  });
});
