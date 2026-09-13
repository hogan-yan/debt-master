/**
 * Better Auth email template helpers.
 *
 * Builds reset-password and email-verification messages from the URLs that
 * Better Auth generates. Keeps template logic out of the auth instance config.
 */

export interface ResetPasswordEmailInput {
  readonly user: {
    readonly email: string;
    readonly name?: string | null | undefined;
  };
  readonly url: string;
}

export interface VerificationEmailInput {
  readonly user: {
    readonly email: string;
    readonly name?: string | null | undefined;
  };
  readonly url: string;
}

function appName(): string {
  return process.env.PUBLIC_APP_NAME || 'Debt Master';
}

export function buildResetPasswordEmail(input: ResetPasswordEmailInput): {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
} {
  const name = input.user.name || input.user.email;
  const subject = `${appName()} password reset`;
  const text = `Hi ${name},\n\nYou requested a password reset. Click the link below to set a new password:\n\n${input.url}\n\nIf you did not request this, you can safely ignore this email.`;
  const html = `<div style="font-family: sans-serif; max-width: 480px;">
      <p>Hi ${escapeHtml(name)},</p>
      <p>You requested a password reset. Click the button below to set a new password:</p>
      <p><a href="${escapeHtml(input.url)}" style="display: inline-block; padding: 12px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 6px;">Reset password</a></p>
      <p style="color: #666;">If you did not request this, you can safely ignore this email.</p>
    </div>`;

  return { subject, text, html };
}

export function buildVerificationEmail(input: VerificationEmailInput): {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
} {
  const name = input.user.name || input.user.email;
  const subject = `Verify your ${appName()} account`;
  const text = `Hi ${name},\n\nPlease verify your email by clicking the link below:\n\n${input.url}\n\nIf you did not create this account, you can safely ignore this email.`;
  const html = `<div style="font-family: sans-serif; max-width: 480px;">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Please verify your email by clicking the button below:</p>
      <p><a href="${escapeHtml(input.url)}" style="display: inline-block; padding: 12px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 6px;">Verify email</a></p>
      <p style="color: #666;">If you did not create this account, you can safely ignore this email.</p>
    </div>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
