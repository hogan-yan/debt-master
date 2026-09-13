/**
 * HMAC-signed URLs for the LocalFS serve route.
 *
 * The `/api/storage/` route used to grant any valid session read access to
 * every object, so one colleague could enumerate keys and read all receipts.
 * URL issuance is now per-resource authorized (see `src/server/utils/storage-authz.ts`)
 * and each generated URL carries an HMAC over bucket + key + expiry, keyed with
 * JWT_SECRET. The serve route verifies the signature AND the session, so a
 * leaked or guessed path is useless without a freshly signed link.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getJwtSecret } from '@/server/infrastructure/auth/auth-server-utils';

/** Default signed-URL lifetime, matching the MinIO presigned-URL default. */
export const STORAGE_URL_TTL_SECONDS = 24 * 60 * 60;

function computeSignature(bucket: string, objectKey: string, expiresAt: number): string {
  return createHmac('sha256', getJwtSecret())
    .update(`${bucket}/${objectKey}/${expiresAt}`)
    .digest('hex');
}

/**
 * Build the signed query string appended to a `/api/storage/` URL.
 */
export function signStoragePath(
  bucket: string,
  objectKey: string,
  ttlSeconds: number = STORAGE_URL_TTL_SECONDS
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = computeSignature(bucket, objectKey, expiresAt);
  return `expires=${expiresAt}&signature=${signature}`;
}

/**
 * Verify the `expires` + `signature` query params for a storage path.
 * Returns false for missing/malformed params, expiry, or signature mismatch.
 */
export function verifyStorageSignature(
  bucket: string,
  objectKey: string,
  expires: string | null,
  signature: string | null
): boolean {
  if (!expires || !signature) return false;
  const expiresAt = Number.parseInt(expires, 10);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = computeSignature(bucket, objectKey, expiresAt);
  const actual = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (actual.length !== expectedBuf.length) return false;
  return timingSafeEqual(actual, expectedBuf);
}
