/**
 * Server-only email transport.
 *
 * Wraps nodemailer and provides a dev fallback that logs emails to the console
 * when SMTP is not configured. Production requires SMTP to be configured.
 */

import { createTransport } from 'nodemailer';
import { createServerLogger } from '@/server/infrastructure/logger';
import { AppError, ErrorCode } from '@/utils/errors';

const logger = createServerLogger('email', process.env.NODE_ENV === 'development');

export interface SendEmailOptions {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text?: string | undefined;
}

interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly auth: {
    readonly user: string;
    readonly pass: string;
  };
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const parsedPort = port ? Number.parseInt(port, 10) : 587;
  if (Number.isNaN(parsedPort)) {
    return null;
  }

  return {
    host,
    port: parsedPort,
    auth: { user, pass },
  };
}

function createTransporter() {
  const config = getSmtpConfig();
  if (!config) {
    return null;
  }

  return createTransport({
    host: config.host,
    port: config.port,
    auth: config.auth,
    secure: config.port === 465,
  });
}

/**
 * Send an email via SMTP, or log it in development when SMTP is not configured.
 * Always resolves; rejects only when SMTP is configured but the send fails.
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const from = process.env.SMTP_FROM || 'noreply@example.com';
  const transporter = createTransporter();

  if (!transporter) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      throw new AppError(
        ErrorCode.INFRASTRUCTURE_ERROR,
        'SMTP is not configured and email is required in production'
      );
    }

    logger.info('Email not sent (SMTP not configured)', {
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return;
  }

  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}
