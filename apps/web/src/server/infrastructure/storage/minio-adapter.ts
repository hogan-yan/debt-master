/**
 * MinIO (S3-compatible) storage adapter (DEBTCOM-3).
 *
 * Refactored from `src/utils/minio.ts` into an object literal implementing
 * {@link StorageAdapter}. Connection config comes from `infraConfig.minio`
 * rather than inline `process.env` reads. Credentials default to empty and the
 * client throws lazily when first used, so dev environments without MinIO
 * configured still boot.
 */

import type { Client as MinioClient } from 'minio';
import { Client } from 'minio';
import { createServerLogger } from '@/server/infrastructure/logger';
import { infraConfig } from '../config';
import { generateObjectKey, sanitizeForHeader } from './keys';
import type { StorageAdapter } from './storage-adapter';

const logger = createServerLogger('minio', process.env.NODE_ENV === 'development');

let minioClient: MinioClient | null = null;

/**
 * Validate MinIO credentials are configured and return the client.
 * Throws on missing credentials to prevent silent fallback to defaults.
 */
function getClient(): MinioClient {
  if (minioClient) {
    return minioClient;
  }

  const { accessKey, secretKey } = infraConfig.minio;
  if (!accessKey) {
    throw new Error(
      'MINIO_ACCESS_KEY environment variable is required. Set it before starting the server.'
    );
  }
  if (!secretKey) {
    throw new Error(
      'MINIO_SECRET_KEY environment variable is required. Set it before starting the server.'
    );
  }

  const { endpoint, port, useSsl } = infraConfig.minio;
  minioClient = new Client({
    endPoint: endpoint,
    port,
    useSSL: useSsl,
    accessKey,
    secretKey,
  });

  return minioClient;
}

/** Ensure the receipts bucket exists. */
async function ensureBucketExists(): Promise<void> {
  try {
    const bucket = infraConfig.minio.bucket;
    const client = getClient();
    const bucketExists = await client.bucketExists(bucket);
    if (!bucketExists) {
      await client.makeBucket(bucket);
    }
  } catch (_error) {
    throw new Error('Failed to ensure bucket exists');
  }
}

export const minioAdapter: StorageAdapter = {
  async upload({ buffer, fileName, contentType }) {
    try {
      await ensureBucketExists();

      // Generate unique object key with timestamp
      const timestamp = Date.now();
      const objectKey = generateObjectKey(fileName, timestamp);

      // Sanitize filename for header usage
      const headerSafeFileName = sanitizeForHeader(fileName);
      const bucket = infraConfig.minio.bucket;

      await getClient().putObject(bucket, objectKey, buffer, buffer.length, {
        'Content-Type': contentType,
        'X-Amz-Meta-Original-Name': headerSafeFileName,
        'X-Amz-Meta-Upload-Time': new Date().toISOString(),
      });

      return {
        bucket,
        objectKey,
      };
    } catch (error) {
      logger.error('Failed to upload file to MinIO', error);
      throw new Error('Failed to upload file');
    }
  },

  async getUrl(bucket, objectKey, expirySeconds = 24 * 60 * 60) {
    try {
      const presignedUrl = await getClient().presignedGetObject(bucket, objectKey, expirySeconds);
      return presignedUrl;
    } catch (_error) {
      throw new Error('Failed to generate file URL');
    }
  },

  async delete(bucket, objectKey) {
    try {
      await getClient().removeObject(bucket, objectKey);
    } catch (_error) {
      throw new Error('Failed to delete file');
    }
  },
};

/**
 * Reset the cached MinIO client. Used only in tests to ensure a fresh client
 * is created with current mock implementations.
 */
export function __resetMinioClientForTests(): void {
  minioClient = null;
}
