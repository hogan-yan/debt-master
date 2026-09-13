import { beforeEach, describe, expect, it, vi } from 'vitest';

const { config, mockMethods } = vi.hoisted(() => ({
  config: {
    minio: {
      endpoint: 'localhost',
      port: 9000,
      useSsl: false,
      accessKey: 'test-access-key',
      secretKey: 'test-secret-key',
      bucket: 'debt-master',
    },
  },
  mockMethods: {
    bucketExists: vi.fn(),
    makeBucket: vi.fn(),
    putObject: vi.fn(),
    presignedGetObject: vi.fn(),
    removeObject: vi.fn(),
  },
}));

vi.mock('../config', () => ({ infraConfig: config }));
vi.mock('minio', () => {
  // Regular function so it can be used as a constructor with `new`
  const ClientMock = vi.fn(function (this: Record<string, unknown>) {
    Object.assign(this, mockMethods);
  });
  return { Client: ClientMock };
});

import { __resetMinioClientForTests, minioAdapter } from './minio-adapter';

describe('minioAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetMinioClientForTests();
    config.minio.accessKey = 'test-access-key';
    config.minio.secretKey = 'test-secret-key';
    config.minio.bucket = 'debt-master';
    mockMethods.bucketExists.mockResolvedValue(true);
    mockMethods.makeBucket.mockResolvedValue(undefined);
    mockMethods.putObject.mockResolvedValue(undefined);
    mockMethods.presignedGetObject.mockResolvedValue('https://minio.example.com/presigned-url');
    mockMethods.removeObject.mockResolvedValue(undefined);
  });

  describe('upload', () => {
    it('uploads and returns bucket/objectKey', async () => {
      const result = await minioAdapter.upload({
        buffer: Buffer.from('test'),
        fileName: 'receipt.jpg',
        contentType: 'image/jpeg',
      });

      expect(result.bucket).toBe('debt-master');
      expect(result.objectKey).toContain('receipts/');
      expect(result.objectKey).toContain('receipt.jpg');
      expect(mockMethods.putObject).toHaveBeenCalledTimes(1);
    });

    it('creates the bucket if missing', async () => {
      mockMethods.bucketExists.mockResolvedValue(false);

      await minioAdapter.upload({
        buffer: Buffer.from('test'),
        fileName: 'receipt.jpg',
        contentType: 'image/jpeg',
      });

      expect(mockMethods.makeBucket).toHaveBeenCalledWith('debt-master');
    });

    it('sanitizes the header metadata filename', async () => {
      await minioAdapter.upload({
        buffer: Buffer.from('test'),
        fileName: 'my receipt.jpg',
        contentType: 'image/jpeg',
      });

      const putCall = mockMethods.putObject.mock.calls[0];
      if (!putCall) {
        throw new Error('Expected putObject to be called');
      }
      const metadata = putCall[4] as Record<string, string>;
      expect(metadata['X-Amz-Meta-Original-Name']).toBe('my receipt.jpg');
    });

    it('throws "Failed to upload file" on putObject failure', async () => {
      mockMethods.putObject.mockRejectedValue(new Error('Network error'));

      await expect(
        minioAdapter.upload({
          buffer: Buffer.from('test'),
          fileName: 'receipt.jpg',
          contentType: 'image/jpeg',
        })
      ).rejects.toThrow('Failed to upload file');
    });

    it('throws "Failed to upload file" when bucket setup fails', async () => {
      mockMethods.bucketExists.mockRejectedValue(new Error('Connection failed'));

      await expect(
        minioAdapter.upload({
          buffer: Buffer.from('test'),
          fileName: 'receipt.jpg',
          contentType: 'image/jpeg',
        })
      ).rejects.toThrow('Failed to upload file');
    });

    it('rejects when credentials are empty (lazy validation)', async () => {
      config.minio.accessKey = '';
      await expect(minioAdapter.getUrl('bucket', 'key')).rejects.toThrow(
        'Failed to generate file URL'
      );
    });

    it('rejects when the MinIO secret key is empty', async () => {
      config.minio.secretKey = '';

      await expect(minioAdapter.getUrl('bucket', 'key')).rejects.toThrow(
        'Failed to generate file URL'
      );
    });
  });

  describe('getUrl', () => {
    it('generates a presigned URL with the default 24h expiry', async () => {
      const url = await minioAdapter.getUrl('bucket', 'object-key');

      expect(url).toBe('https://minio.example.com/presigned-url');
      expect(mockMethods.presignedGetObject).toHaveBeenCalledWith('bucket', 'object-key', 86_400);
    });

    it('supports a custom expiry', async () => {
      await minioAdapter.getUrl('bucket', 'object-key', 3600);

      expect(mockMethods.presignedGetObject).toHaveBeenCalledWith('bucket', 'object-key', 3600);
    });

    it('throws "Failed to generate file URL" on failure', async () => {
      mockMethods.presignedGetObject.mockRejectedValue(new Error('Connection failed'));

      await expect(minioAdapter.getUrl('bucket', 'key')).rejects.toThrow(
        'Failed to generate file URL'
      );
    });
  });

  describe('delete', () => {
    it('removes the object by bucket and key', async () => {
      await minioAdapter.delete('bucket', 'object-key');

      expect(mockMethods.removeObject).toHaveBeenCalledWith('bucket', 'object-key');
    });

    it('throws "Failed to delete file" on failure', async () => {
      mockMethods.removeObject.mockRejectedValue(new Error('Not found'));

      await expect(minioAdapter.delete('bucket', 'key')).rejects.toThrow('Failed to delete file');
    });
  });
});
