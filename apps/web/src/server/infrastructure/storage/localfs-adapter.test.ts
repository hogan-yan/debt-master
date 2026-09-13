import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({
  localfs: {
    rootDir: '/srv/storage',
    bucket: 'debt-master',
    publicBaseUrl: '',
  },
}));

// auth-server-utils captures JWT_SECRET at import time; vi.hoisted runs
// before static imports, so set it here.
vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-for-storage-signing-0123456789';
});

vi.mock('../config', () => ({ infraConfig: config }));

import { localfsAdapter, readLocalFile, resolveLocalPath } from './localfs-adapter';

const tmpRoot = path.join(tmpdir(), `debt-master-localfs-${process.pid}`);

beforeAll(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(tmpRoot, { recursive: true });
});

afterAll(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe('localfsAdapter', () => {
  beforeEach(() => {
    config.localfs.rootDir = tmpRoot;
    config.localfs.bucket = 'debt-master';
    config.localfs.publicBaseUrl = '';
  });

  describe('upload', () => {
    it('writes the buffer under <rootDir>/<bucket>/receipts and returns the location', async () => {
      const result = await localfsAdapter.upload({
        buffer: Buffer.from('test-bytes'),
        fileName: 'receipt.jpg',
        contentType: 'image/jpeg',
      });

      expect(result.bucket).toBe('debt-master');
      expect(result.objectKey).toMatch(/^receipts\/\d+-receipt\.jpg$/);

      const written = await readFile(path.join(tmpRoot, 'debt-master', result.objectKey));
      expect(written.toString()).toBe('test-bytes');
    });

    it('throws "Failed to upload file" when the target dir is not writable', async () => {
      // Point rootDir at a path under an existing file so mkdir fails.
      const fileAsDir = path.join(tmpRoot, 'a-file');
      await writeFile(fileAsDir, 'x');
      config.localfs.rootDir = fileAsDir;

      await expect(
        localfsAdapter.upload({
          buffer: Buffer.from('x'),
          fileName: 'f.png',
          contentType: 'image/png',
        })
      ).rejects.toThrow('Failed to upload file');
    });
  });

  describe('getUrl', () => {
    it('returns a signed relative serve URL when publicBaseUrl is empty', async () => {
      config.localfs.publicBaseUrl = '';
      const url = await localfsAdapter.getUrl('debt-master', 'receipts/123-x.png');
      expect(url).toMatch(
        /^\/api\/storage\/debt-master\/receipts\/123-x\.png\?expires=\d+&signature=[0-9a-f]{64}$/
      );
    });

    it('prefixes publicBaseUrl when set', async () => {
      config.localfs.publicBaseUrl = 'https://cdn.example.com';
      const url = await localfsAdapter.getUrl('debt-master', 'receipts/123-x.png');
      expect(url).toMatch(
        /^https:\/\/cdn\.example\.com\/api\/storage\/debt-master\/receipts\/123-x\.png\?expires=\d+&signature=[0-9a-f]{64}$/
      );
    });

    it('produces a signature the serve route accepts', async () => {
      const { verifyStorageSignature } = await import('./storage-signing');
      const url = new URL(
        await localfsAdapter.getUrl('debt-master', 'receipts/123-x.png'),
        'http://localhost'
      );
      expect(
        verifyStorageSignature(
          'debt-master',
          'receipts/123-x.png',
          url.searchParams.get('expires'),
          url.searchParams.get('signature')
        )
      ).toBe(true);
    });

    it('honours a caller-supplied positive expiry over the default TTL', async () => {
      const before = Math.floor(Date.now() / 1000);
      const url = await localfsAdapter.getUrl('debt-master', 'receipts/123-x.png', 300);
      const expires = new URL(url, 'http://localhost').searchParams.get('expires');
      if (expires === null) throw new Error('Expected an expires param on the signed URL');

      const expiresAt = Number.parseInt(expires, 10);
      expect(expiresAt).toBeGreaterThanOrEqual(before + 300);
      expect(expiresAt).toBeLessThanOrEqual(before + 300 + 5);
    });
  });

  describe('delete', () => {
    it('removes the file from disk', async () => {
      config.localfs.bucket = 'del-bucket';
      const { objectKey } = await localfsAdapter.upload({
        buffer: Buffer.from('gone'),
        fileName: 'd.jpg',
        contentType: 'image/jpeg',
      });
      const fullPath = path.join(tmpRoot, 'del-bucket', objectKey);
      await expect(stat(fullPath)).resolves.toBeTruthy();

      await localfsAdapter.delete('del-bucket', objectKey);

      await expect(stat(fullPath)).rejects.toThrow();
    });

    it('treats a missing file (ENOENT) as a no-op', async () => {
      await expect(
        localfsAdapter.delete('debt-master', 'receipts/never-existed.png')
      ).resolves.toBeUndefined();
    });

    it('wraps filesystem errors other than missing files', async () => {
      const directoryKey = 'receipts/not-a-file';
      await mkdir(path.join(tmpRoot, 'debt-master', directoryKey), { recursive: true });

      await expect(localfsAdapter.delete('debt-master', directoryKey)).rejects.toThrow(
        'Failed to delete file'
      );
    });
  });

  describe('readLocalFile', () => {
    it('reads the bytes back from disk', async () => {
      config.localfs.bucket = 'read-bucket';
      const { objectKey } = await localfsAdapter.upload({
        buffer: Buffer.from('round-trip'),
        fileName: 'r.png',
        contentType: 'image/png',
      });
      const buffer = await readLocalFile('read-bucket', objectKey);
      expect(buffer.toString()).toBe('round-trip');
    });
  });

  describe('resolveLocalPath (traversal guard)', () => {
    it('allows nested keys within the bucket', () => {
      expect(() => resolveLocalPath('debt-master', 'receipts/123-x.png')).not.toThrow();
    });

    it('rejects a key that escapes the bucket via ".."', () => {
      expect(() => resolveLocalPath('debt-master', '../escape')).toThrow(/outside its bucket/);
      expect(() => resolveLocalPath('debt-master', 'receipts/../../escape')).toThrow(
        /outside its bucket/
      );
    });
  });
});
