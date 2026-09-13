import { createFileRoute } from '@tanstack/react-router';
import { ForgotPasswordPage } from '@/components/auth/forgot-password-page';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: 'Reset password — Debt Master' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
});
