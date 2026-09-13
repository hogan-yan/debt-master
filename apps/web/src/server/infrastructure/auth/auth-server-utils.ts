/**
 * Server-side authentication utilities
 * All server functions should use these helpers to validate JWT tokens
 */

import type { StringValue } from 'ms';
import * as z from 'zod';
import { AppError, ErrorCode } from '@/utils/errors';

// JWT secret - must be provided via environment variable
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Dynamically import jsonwebtoken (server-only).
 * Centralises the ESM/CJS interop shim so every caller can just `await getJwt()`.
 */
export async function getJwt() {
  const jwtModule = await import('jsonwebtoken');
  return jwtModule.default || jwtModule;
}

// Token expiry in days, configurable via env (default: 30)
const JWT_EXPIRY_DAYS = Number(process.env.JWT_EXPIRY_DAYS) || 30;

if (JWT_EXPIRY_DAYS <= 0 || !Number.isFinite(JWT_EXPIRY_DAYS)) {
  throw new Error('FATAL: JWT_EXPIRY_DAYS must be a positive number.');
}

/**
 * Build the expiresIn string for jwt.sign.
 *
 * Uses a lookup table so the return type is inferred as a StringValue
 * template literal (e.g. `"30d"`) instead of the overly-wide `string`,
 * which keeps the jsonwebtoken types happy without any type cast.
 */
function buildExpiryString(days: number): StringValue {
  // Pre-defined entries cover every realistic value;
  // anything outside this range falls back to a numeric (seconds) expiry.
  const table: Record<number, StringValue> = {
    1: '1d',
    2: '2d',
    3: '3d',
    5: '5d',
    7: '7d',
    14: '14d',
    15: '15d',
    21: '21d',
    30: '30d',
    60: '60d',
    90: '90d',
    180: '180d',
    365: '365d',
  };

  const entry = table[days];
  if (entry !== undefined) return entry;

  // Fallback: return seconds as a numeric string value (also valid StringValue)
  return `${days * 24 * 60 * 60}` satisfies StringValue;
}

export function getJwtExpiry(): StringValue {
  return buildExpiryString(JWT_EXPIRY_DAYS);
}

export function getJwtExpirySeconds(): number {
  return 60 * 60 * 24 * JWT_EXPIRY_DAYS;
}

export function getJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is required. Set it before starting the server.'
    );
  }
  // This secret signs cookies carrying `isAdmin`, so a guessable secret is a
  // privilege-escalation vector. Production fails loud; dev/test stay permissive.
  if (process.env.NODE_ENV === 'production' && JWT_SECRET.length < 32) {
    throw new Error(
      'FATAL: JWT_SECRET must be at least 32 characters in production. Generate one with `openssl rand -base64 32`.'
    );
  }
  return JWT_SECRET;
}

// Define token payload interface
export interface TokenPayload {
  isAdmin: boolean;
  permissions: string[];
  username?: string | undefined;
  accessCodeId?: number | undefined;
}

// Zod schema for validating JWT token payloads at runtime
const tokenPayloadSchema = z.object({
  isAdmin: z.boolean(),
  permissions: z.array(z.string()),
  username: z.string().optional(),
  accessCodeId: z.number().optional(),
});

/**
 * Validate and parse a JWT decoded payload into a typed TokenPayload.
 * Throws if the payload shape is invalid.
 */
export function validateTokenPayload(data: unknown): TokenPayload {
  return tokenPayloadSchema.parse(data);
}

// Rate limiting storage (using in-memory Map - in production, use Redis/Valkey)
interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/** Tunables for one rate-limit bucket (shared by memory and Valkey stores). */
export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  blockedForMs?: number;
}

/**
 * Rate limiting configuration.
 * Exported for the server-only access-code rate limiter
 * (`auth-rate-limit.ts`).
 */
export const RATE_LIMIT = {
  // Access code validation: 5 attempts per 5 minutes (per code+IP bucket)
  ACCESS_CODE: {
    maxAttempts: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
    blockDurationMs: 15 * 60 * 1000, // 15 minutes block
  },
  // Per-IP bucket: caps code enumeration across distinct codes from one client.
  // Sits above the per-code bucket so a legitimate user mistyping their own
  // code is still governed by ACCESS_CODE, not this wider budget.
  ACCESS_CODE_IP: {
    maxAttempts: 20,
    windowMs: 5 * 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
  },
  // Password reset: 5 emails per 15 minutes per IP (anti email-bombing).
  PASSWORD_RESET: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
  },
  // 2FA code verification: 10 attempts per 5 minutes per IP.
  TWO_FACTOR: {
    maxAttempts: 10,
    windowMs: 5 * 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
  },
};

/**
 * Verify JWT token and return payload
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const jwt = await getJwt();

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return validateTokenPayload(decoded);
  } catch {
    throw new AppError(ErrorCode.AUTH_INVALID_TOKEN, 'Invalid or expired token');
  }
}

/**
 * Refresh a valid JWT token by re-signing it with a fresh expiry (configurable via JWT_EXPIRY_DAYS).
 * Throws if the token is invalid or expired.
 */
export async function refreshToken(token: string): Promise<string> {
  const jwt = await getJwt();

  const payload = await verifyToken(token);
  return jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpiry() });
}

/**
 * Extract token from request headers or data
 */
export function extractToken(data: { token?: string } | FormData | unknown): string | null {
  // Handle FormData
  if (data instanceof FormData) {
    const token = data.get('token');
    return token ? String(token) : null;
  }

  // Handle object with token property
  if (data && typeof data === 'object' && 'token' in data) {
    const token = data.token;
    return typeof token === 'string' ? token : null;
  }

  return null;
}

/**
 * Check rate limit for a key (IP address or identifier)
 * Returns true if allowed, false if blocked
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  // Clean up expired entries periodically (simple approach)
  if (entry?.blockedUntil && now > entry.blockedUntil) {
    rateLimitMap.delete(key);
    return { allowed: true, remainingAttempts: config.maxAttempts };
  }

  // Check if currently blocked
  if (entry?.blockedUntil && now < entry.blockedUntil) {
    return {
      allowed: false,
      remainingAttempts: 0,
      blockedForMs: entry.blockedUntil - now,
    };
  }

  // Check if window has expired
  if (entry && now - entry.firstAttempt > config.windowMs) {
    // Reset window
    rateLimitMap.set(key, {
      attempts: 1,
      firstAttempt: now,
    });
    return { allowed: true, remainingAttempts: config.maxAttempts - 1 };
  }

  // Check attempts within window
  if (entry) {
    if (entry.attempts >= config.maxAttempts) {
      // Block the key
      const blockedUntil = now + config.blockDurationMs;
      rateLimitMap.set(key, {
        ...entry,
        blockedUntil,
      });
      return {
        allowed: false,
        remainingAttempts: 0,
        blockedForMs: config.blockDurationMs,
      };
    }

    // Increment attempts
    entry.attempts++;
    return { allowed: true, remainingAttempts: config.maxAttempts - entry.attempts };
  }

  // First attempt
  rateLimitMap.set(key, {
    attempts: 1,
    firstAttempt: now,
  });
  return { allowed: true, remainingAttempts: config.maxAttempts - 1 };
}

/**
 * Hash a string for use as rate limit key (prevents storing raw codes)
 */
export function hashIdentifier(identifier: string): string {
  // Simple hash - in production use crypto.createHash
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return String(Math.abs(hash));
}

/**
 * Clean up old rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    // Remove entries older than the max window + block duration
    const maxAge = Math.max(
      RATE_LIMIT.ACCESS_CODE.windowMs + RATE_LIMIT.ACCESS_CODE.blockDurationMs
    );
    if (now - entry.firstAttempt > maxAge) {
      rateLimitMap.delete(key);
    }
  }
}

// Periodic cleanup every 10 minutes. unref'd so this timer alone never keeps
// the process (or a graceful shutdown drain) alive.
if (typeof window === 'undefined') {
  const cleanupTimer = setInterval(cleanupRateLimits, 10 * 60 * 1000);
  cleanupTimer.unref?.();
}
