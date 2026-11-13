import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { AppError, ErrorCode } from '@/utils/errors';

// Move environment variable access inside server functions to prevent client-side execution
const turnstileValidationSchema = z.object({
  token: z.string().min(1, 'Turnstile token is required'),
  remoteip: z.string().optional(),
});

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export const validateTurnstileToken = createServerFn({ method: 'POST' })
  .validator((data) => turnstileValidationSchema.parse(data))
  .handler(async ({ data }) => {
    // Access environment variable only on server side
    const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

    if (!TURNSTILE_SECRET) {
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Turnstile secret key not configured');
    }

    const formData = new URLSearchParams();
    formData.append('secret', TURNSTILE_SECRET);
    formData.append('response', data.token);
    if (data.remoteip) {
      formData.append('remoteip', data.remoteip);
    }
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    if (!response.ok) {
      throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Failed to validate Turnstile token');
    }
    const result: TurnstileResponse = await response.json();
    return {
      success: result.success,
      errorCodes: result['error-codes'] || [],
      hostname: result.hostname,
      challenge_ts: result.challenge_ts,
    };
  });

export const getTurnstileSiteKey = createServerFn({ method: 'GET' }).handler(async () => {
  // Access environment variable only on server side
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!siteKey) {
    throw new AppError(ErrorCode.INFRASTRUCTURE_ERROR, 'Turnstile site key not configured');
  }

  return {
    siteKey,
    isConfigured: !!(siteKey && secretKey),
  };
});

export const isTurnstileConfigured = () => {
  return !!(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
};
