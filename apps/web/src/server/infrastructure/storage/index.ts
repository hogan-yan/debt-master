/**
 * Storage-adapter factory + caller-facing wrappers.
 *
 * Returns the single active {@link StorageAdapter} based on `STORAGE_PROVIDER`.
 * Callers should never import a concrete adapter directly — go through
 * {@link getStorageAdapter} or the higher-level wrappers below so the backend is
 * swappable via configuration.
 *
 * The factory is async so the MinIO adapter (and its `minio` dep) is
 * dynamically imported only when the deploy selects the `minio` provider.
 */
import { AppError, ErrorCode } from '@/utils/errors';

import { infraConfig } from '../config';
import type { StorageAdapter, StorageLocation } from './storage-adapter';

let cached: StorageAdapter | null = null;

export async function getStorageAdapter(): Promise<StorageAdapter> {
  if (cached) return cached;
  const provider = infraConfig.storageProvider;
  let adapter: StorageAdapter;
  if (provider === 'minio') {
    const mod = await import('./minio-adapter');
    adapter = mod.minioAdapter;
  } else if (provider === 'localfs') {
    // Dynamic import keeps the serve handler + its `node:fs` deps out of the
    // MinIO build path, mirroring the lazy MinIO-client import above.
    const { localfsAdapter } = await import('./localfs-adapter');
    adapter = localfsAdapter;
  } else {
    throw new AppError(
      ErrorCode.INFRASTRUCTURE_ERROR,
      `Unsupported storage provider: "${provider}". Set STORAGE_PROVIDER to one of: minio, localfs.`
    );
  }
  cached = adapter;
  return adapter;
}

/**
 * Test-only: reset the cached adapter. Used by adapter unit tests that vary
 * `STORAGE_PROVIDER` per case.
 */
export function __resetStorageAdapterCacheForTests(): void {
  cached = null;
}

/** Default presigned-URL expiry (24h), matching the prior MinIO behaviour. */
const DEFAULT_STORAGE_URL_EXPIRY_SECONDS = 24 * 60 * 60;

/**
 * Validate, buffer, and store a file in one step. Centralises the
 * validate → upload sequence used across expense and payment mutations.
 * Buffers the body exactly once and validates that single buffer — the
 * previous flow buffered twice (once inside validation, once for upload),
 * doubling peak memory per upload. The Bun-level MAX_BODY_SIZE_MB cap bounds
 * how large that single buffer can ever get.
 */
export async function uploadFileToStorage(file: File): Promise<StorageLocation> {
  const { validateUploadedFile } = await import('@/server/utils/file-validation');
  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateUploadedFile(buffer, file.size);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid file upload');
  }
  const adapter = await getStorageAdapter();
  return adapter.upload({
    buffer,
    fileName: file.name,
    contentType: validation.detectedMimeType || file.type,
  });
}

/** Delete a stored file by its persisted location. */
export async function deleteFromStorage(bucket: string, objectKey: string): Promise<void> {
  return (await getStorageAdapter()).delete(bucket, objectKey);
}

/** Resolve a browser-fetchable URL for a stored file. */
export async function getStorageUrl(
  bucket: string,
  objectKey: string,
  expirySeconds: number = DEFAULT_STORAGE_URL_EXPIRY_SECONDS
): Promise<string> {
  return (await getStorageAdapter()).getUrl(bucket, objectKey, expirySeconds);
}
