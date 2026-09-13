import { beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ storageProvider: 'minio' as string }));
vi.mock('../config', () => ({ infraConfig: config }));

const minioAdapter = {
  upload: vi.fn(),
  getUrl: vi.fn(),
  delete: vi.fn(),
};
vi.mock('./minio-adapter', () => ({ minioAdapter }));

const localfsAdapter = {
  upload: vi.fn(),
  getUrl: vi.fn(),
  delete: vi.fn(),
};
vi.mock('./localfs-adapter', () => ({ localfsAdapter }));

const mockValidate = vi.hoisted(() => vi.fn());
vi.mock('@/server/utils/file-validation', () => ({ validateUploadedFile: mockValidate }));

const {
  __resetStorageAdapterCacheForTests,
  deleteFromStorage,
  getStorageAdapter,
  getStorageUrl,
  uploadFileToStorage,
} = await import('./index');

describe('getStorageAdapter', () => {
  beforeEach(() => {
    __resetStorageAdapterCacheForTests();
    vi.clearAllMocks();
    config.storageProvider = 'minio';
  });

  it('returns the minio adapter when provider is minio', async () => {
    expect(await getStorageAdapter()).toBe(minioAdapter);
  });

  it('returns the localfs adapter when provider is localfs', async () => {
    config.storageProvider = 'localfs';
    expect(await getStorageAdapter()).toBe(localfsAdapter);
  });

  it('caches the adapter across calls', async () => {
    const first = await getStorageAdapter();
    const second = await getStorageAdapter();
    expect(first).toBe(second);
  });

  it('throws an INFRASTRUCTURE_ERROR for an unsupported provider', async () => {
    config.storageProvider = 's3-magic';
    await expect(getStorageAdapter()).rejects.toThrow(/Unsupported storage provider: "s3-magic"/);
    // A failed resolution must not poison the cache.
    config.storageProvider = 'minio';
    expect(await getStorageAdapter()).toBe(minioAdapter);
  });
});

describe('caller-facing wrappers', () => {
  beforeEach(() => {
    __resetStorageAdapterCacheForTests();
    vi.clearAllMocks();
    config.storageProvider = 'minio';
    minioAdapter.upload.mockResolvedValue({ bucket: 'debt-master', objectKey: 'receipts/x' });
    minioAdapter.getUrl.mockResolvedValue('https://minio.example.com/presigned');
    minioAdapter.delete.mockResolvedValue(undefined);
    mockValidate.mockReturnValue({ isValid: true, detectedMimeType: 'image/png' });
  });

  it('uploadFileToStorage buffers once, validates that buffer, and delegates to the adapter', async () => {
    const file = new File(['content'], 'receipt.png', { type: 'image/png' });
    const result = await uploadFileToStorage(file);

    // Single-buffer flow: validation receives the buffered body + the file
    // size, not the File object (which the old double-buffer path validated).
    expect(mockValidate).toHaveBeenCalledTimes(1);
    const [bufferArg, sizeArg] = mockValidate.mock.calls[0] as unknown as [Buffer, number];
    expect(Buffer.isBuffer(bufferArg)).toBe(true);
    expect(bufferArg.toString()).toBe('content');
    expect(sizeArg).toBe(file.size);
    expect(minioAdapter.upload).toHaveBeenCalledTimes(1);
    const call = minioAdapter.upload.mock.calls[0]?.[0] as {
      fileName: string;
      contentType: string;
    };
    expect(call.fileName).toBe('receipt.png');
    expect(call.contentType).toBe('image/png');
    expect(result.bucket).toBe('debt-master');
  });

  it('uploadFileToStorage rethrows when validation fails', async () => {
    mockValidate.mockReturnValue({ isValid: false, error: 'Invalid file type' });
    const file = new File(['x'], 'bad.exe', { type: 'application/x-msdownload' });
    await expect(uploadFileToStorage(file)).rejects.toThrow('Invalid file type');
  });

  it('uses fallback validation values when optional fields are absent', async () => {
    mockValidate.mockReturnValue({ isValid: false });
    const invalidFile = new File(['x'], 'unknown.bin', { type: 'application/octet-stream' });
    await expect(uploadFileToStorage(invalidFile)).rejects.toThrow('Invalid file upload');

    mockValidate.mockReturnValue({ isValid: true });
    const validFile = new File(['x'], 'unknown.bin', { type: 'application/octet-stream' });
    await uploadFileToStorage(validFile);

    expect(minioAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'application/octet-stream' })
    );
  });

  it('getStorageUrl delegates to the adapter', async () => {
    const url = await getStorageUrl('bucket', 'key');
    expect(url).toBe('https://minio.example.com/presigned');
    expect(minioAdapter.getUrl).toHaveBeenCalledWith('bucket', 'key', 86_400);
  });

  it('deleteFromStorage delegates to the adapter', async () => {
    await deleteFromStorage('bucket', 'key');
    expect(minioAdapter.delete).toHaveBeenCalledWith('bucket', 'key');
  });
});
