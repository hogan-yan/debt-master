import { describe, expect, it } from 'vitest';
import {
  buildResetPasswordEmail,
  buildVerificationEmail,
} from '@/server/infrastructure/auth/better-auth-email-handlers';

describe('better-auth email templates', () => {
  it('builds a reset password email', () => {
    const email = buildResetPasswordEmail({
      user: { email: 'admin@example.com', name: 'Admin' },
      url: 'http://localhost:3000/reset-password?token=abc',
    });

    expect(email.subject).toContain('password reset');
    expect(email.text).toContain('http://localhost:3000/reset-password?token=abc');
    expect(email.html).toContain('Reset password');
    expect(email.html).toContain('token=abc');
  });

  it('falls back to email when name is missing', () => {
    const email = buildResetPasswordEmail({
      user: { email: 'admin@example.com' },
      url: 'http://localhost:3000/reset-password?token=abc',
    });

    expect(email.text).toContain('Hi admin@example.com');
  });

  it('escapes HTML in user name', () => {
    const email = buildResetPasswordEmail({
      user: { email: 'a@b.com', name: '<script>' },
      url: 'http://localhost:3000/reset?token=">',
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('builds a verification email', () => {
    const email = buildVerificationEmail({
      user: { email: 'admin@example.com' },
      url: 'http://localhost:3000/verify?token=xyz',
    });

    expect(email.subject).toContain('Verify');
    expect(email.text).toContain('http://localhost:3000/verify?token=xyz');
    expect(email.html).toContain('Verify email');
  });
});
