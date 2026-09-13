import { createFileRoute } from '@tanstack/react-router';
import { ResetPasswordPage } from '@/components/auth/reset-password-page';

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: 'Set new password — Debt Master' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
});
