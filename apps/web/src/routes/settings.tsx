/**
 * Settings route — Admin-only access code management
 */

import { createFileRoute, useRouter } from '@tanstack/react-router';
import { AccessCodeManager } from '@/components/settings/access-code-manager';
import { SecurityPanel } from '@/components/settings/security-panel';
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
        <AccessCodeManager
          initialAccessCodes={initialAccessCodes}
          onRefresh={() => router.invalidate()}
        />
        <SecurityPanel />
      </div>
    </ProtectedRoute>
  );
}
