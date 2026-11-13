/**
 * Settings route — Admin-only access code management
 */

import { createFileRoute, useRouter } from '@tanstack/react-router';
import { AccessCodeManager } from '@/components/settings/access-code-manager';
import { SecurityPanel } from '@/components/settings/security-panel';
import { m } from '@/paraglide/messages';
import { getAccessCodes } from '@/server/auth';
import { ProtectedRoute } from '@/utils/route-protection';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  head: () => ({
    meta: [{ title: 'Settings — Debt Master' }],
  }),
  loader: async () => {
    // Auth is enforced server-side via the httpOnly cookie (requireAdminFromCookie).
    try {
      const accessCodes = await getAccessCodes();
      return { accessCodes };
    } catch {
      return { accessCodes: [] };
    }
  },
});

function SettingsPage() {
  const { accessCodes: initialAccessCodes } = Route.useLoaderData();
  const router = useRouter();

  return (
    <ProtectedRoute adminOnly>
      <div className="space-y-6">
        {/* Visible page h1 matches the nav item ("Settings"); the sections
            below keep their specific headings (Access Codes, Security). */}
        <h1 className="text-2xl font-semibold tracking-tight">{m.nav_settings()}</h1>
        <AccessCodeManager
          initialAccessCodes={initialAccessCodes}
          onRefresh={() => router.invalidate()}
        />
        <SecurityPanel />
      </div>
    </ProtectedRoute>
  );
}
