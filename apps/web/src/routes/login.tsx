import { createFileRoute, redirect as routerRedirect } from '@tanstack/react-router';
import * as z from 'zod';
import { LoginForm } from '@/components/login-form';
import { m } from '@/paraglide/messages';
import { isFirstRun } from '@/server/setup';
import { AUTH } from '@/test/test-ids';
import { APP_URL } from '@/utils/app-url';

// Define the search schema to handle redirect parameter
const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  // First-run gate (DEBTCOM-2): when no admin exists yet, redirect to the
  // one-time setup wizard BEFORE the login form renders. Doing this in
  // beforeLoad (not a component effect) means the login page never paints on a
  // fresh instance — no flash of the wrong screen on the deployer's first
  // impression. /login is the universal unauthenticated funnel (deep links and
  // `/` all land here), so this single gate covers every entry point without a
  // per-navigation DB cost for authenticated users.
  beforeLoad: async () => {
    let setupRequired = false;
    try {
      ({ setupRequired } = await isFirstRun());
    } catch {
      // Transient failure (e.g. DB hiccup): don't block login. Fall through to
      // the normal form rather than dead-ending the deployer.
      return;
    }
    if (setupRequired) throw routerRedirect({ to: '/setup/' });
  },
  component: LoginPage,
  validateSearch: loginSearchSchema,
  head: () => {
    const appUrl = APP_URL;
    const title = `${m.login_title_colleague()} — Debt Master`;
    return {
      meta: [
        { title },
        // The landing page at / is the only indexable surface; auth pages
        // stay crawlable (follow) but out of the index.
        { name: 'robots', content: 'noindex, follow' },
        { property: 'og:title', content: title },
        {
          property: 'og:description',
          content: m.login_meta_description(),
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Debt Master' },
        { property: 'og:image', content: `${appUrl}/og-image.png` },
        { property: 'og:url', content: `${appUrl}/login` },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        {
          name: 'twitter:description',
          content: m.login_meta_description(),
        },
        { name: 'twitter:image', content: `${appUrl}/og-image.png` },
      ],
    };
  },
});

function LoginPage() {
  const { redirect } = Route.useSearch();

  return (
    <div className="flex flex-1 w-full h-full items-center justify-center pt-10 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6" data-testid={AUTH.LOGIN_HEADING}>
          {m.login_title_colleague()}
        </h1>
        <LoginForm redirectTo={redirect} />
      </div>
    </div>
  );
}
