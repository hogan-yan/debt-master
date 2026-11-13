import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compressImage,
  convertHEICToJPEG,
  formatFileSize,
  isHEICFile,
  processImageFile,
  validateImageFile,
} from './image-processor';

vi.mock('browser-image-compression', () => ({
  default: vi.fn(),
}));

vi.mock('heic2any', () => ({
  default: vi.fn(),
}));

import imageCompression from 'browser-image-compression';
import heic2any from 'heic2any';

const mockedCompress = vi.mocked(imageCompression);
const mockedHeic2any = vi.mocked(heic2any);

function makeImageFile(name: string, type: string, size = 1024): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type, lastModified: Date.now() });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateImageFile', () => {
  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['img.png', 'image/png'],
    ['pic.webp', 'image/webp'],
    ['photo.heic', 'image/heic'],
  ] as const)('accepts valid %s by MIME type', (name, type) => {
    const result = validateImageFile(makeImageFile(name, type));
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it.each([
    ['photo.heic', ''],
    ['photo.heif', ''],
  ] as const)('accepts %s by extension without MIME type', (name, type) => {
    const result = validateImageFile(makeImageFile(name, type));
    expect(result.isValid).toBe(true);
  });

  it('rejects file exceeding 20MB', () => {
    const file = makeImageFile('big.jpg', 'image/jpeg', 1);
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 + 1 });
    const result = validateImageFile(file);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('20MB');
  });

  it('accepts file at exactly 20MB', () => {
    const file = makeImageFile('exact.jpg', 'image/jpeg', 1);
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 });
    const result = validateImageFile(file);
    expect(result.isValid).toBe(true);
  });

  it('rejects unsupported MIME type', () => {
    const result = validateImageFile(makeImageFile('doc.pdf', 'application/pdf'));
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Only JPEG');
  });

  it('rejects file with wrong extension and no MIME type', () => {
    const result = validateImageFile(makeImageFile('data.txt', ''));
    expect(result.isValid).toBe(false);
  });

  it.each([
    ['image.jpg', ''],
    ['image.jpeg', ''],
  ] as const)('accepts %s by extension match', (name, type) => {
    const result = validateImageFile(makeImageFile(name, type));
    expect(result.isValid).toBe(true);
  });
});

describe('isHEICFile', () => {
  it.each([
    ['photo.img', 'image/heic', true],
    ['photo.img', 'image/heif', true],
    ['photo.heic', '', true],
    ['photo.heif', '', true],
    ['photo.HEIC', '', true],
    ['photo.jpg', 'image/jpeg', false],
  ] as const)('detects %s/%s as HEIC=%s', (name, type, expected) => {
    expect(isHEICFile(makeImageFile(name, type))).toBe(expected);
  });
});

describe('formatFileSize', () => {
  it.each([
    [0, '0 Bytes'],
    [512, '512 Bytes'],
    [1024, '1 KB'],
    [1024 * 1024, '1 MB'],
    [1024 * 1024 * 1024, '1 GB'],
    [1536, '1.5 KB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});

describe('convertHEICToJPEG', () => {
  it('rejects conversion outside a browser runtime', async () => {
    vi.stubGlobal('window', undefined);

    await expect(convertHEICToJPEG(makeImageFile('photo.heic', 'image/heic'))).rejects.toThrow(
      'HEIC conversion is only available in the browser'
    );

    vi.unstubAllGlobals();
  });

  it('converts HEIC to JPEG', async () => {
    const blob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' });
    mockedHeic2any.mockResolvedValue(blob);

    const result = await convertHEICToJPEG(makeImageFile('photo.heic', 'image/heic'));

    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('photo_converted.jpg');
    expect(mockedHeic2any).toHaveBeenCalledWith({
      blob: expect.any(File),
      toType: 'image/jpeg',
      quality: 0.9,
    });
  });

  it('handles array result from heic2any', async () => {
    const blob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' });
    mockedHeic2any.mockResolvedValue([blob]);

    const result = await convertHEICToJPEG(makeImageFile('photo.heic', 'image/heic'));
    expect(result.type).toBe('image/jpeg');
  });

  it('throws on empty conversion result', async () => {
    // Intentionally mock null return from heic2any to test error handling
    mockedHeic2any.mockResolvedValue(null as unknown as Blob);

    await expect(convertHEICToJPEG(makeImageFile('photo.heic', 'image/heic'))).rejects.toThrow(
      'Failed to convert HEIC'
    );
  });

  it('throws on heic2any error', async () => {
    mockedHeic2any.mockRejectedValue(new Error('conversion failed'));

    await expect(convertHEICToJPEG(makeImageFile('photo.heic', 'image/heic'))).rejects.toThrow(
      'Failed to convert HEIC'
    );
  });

  it('handles .heif extension in filename', async () => {
    const blob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' });
    mockedHeic2any.mockResolvedValue(blob);

    const result = await convertHEICToJPEG(makeImageFile('photo.heif', 'image/heif'));
    expect(result.name).toBe('photo_converted.jpg');
  });
});

describe('compressImage', () => {
  it.each([
    ['blob', 'photo.jpg', 'photo.jpg'],
    ['image_compressed', 'photo.jpg', 'photo.jpg'],
    ['photo_compressed.jpg', 'photo.jpg', 'photo_compressed.jpg'],
  ] as const)(
    'handles compressed filename "%s" -> "%s"',
    async (compressedName, originalName, expected) => {
      mockedCompress.mockResolvedValue(makeImageFile(compressedName, 'image/jpeg', 500));
      const result = await compressImage(makeImageFile(originalName, 'image/jpeg', 1024));
      expect(result.name).toBe(expected);
    }
  );

  it('passes options to browser-image-compression', async () => {
    mockedCompress.mockResolvedValue(makeImageFile('out.jpg', 'image/jpeg', 500));

    await compressImage(makeImageFile('photo.jpg', 'image/jpeg', 1024), {
      maxSizeMB: 5,
      maxWidthOrHeight: 1080,
    });

    expect(mockedCompress).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ maxSizeMB: 5, maxWidthOrHeight: 1080 })
    );
  });

  it('throws user-friendly error on compression failure', async () => {
    mockedCompress.mockRejectedValue(new Error('lib error'));

    await expect(compressImage(makeImageFile('photo.jpg', 'image/jpeg', 1024))).rejects.toThrow(
      'Failed to compress image'
    );
  });

  it('uses the current time when preserving a generic file with no timestamp', async () => {
    const compressedFile = makeImageFile('blob', 'image/jpeg', 500);
    Object.defineProperty(compressedFile, 'lastModified', { value: 0 });
    mockedCompress.mockResolvedValue(compressedFile);

    await expect(
      compressImage(makeImageFile('photo.jpg', 'image/jpeg', 1024))
    ).resolves.toMatchObject({
      name: 'photo.jpg',
    });
  });

  it('passes onProgress callback when provided', async () => {
    mockedCompress.mockResolvedValue(makeImageFile('out.jpg', 'image/jpeg', 500));

    const onProgress = vi.fn();
    await compressImage(makeImageFile('photo.jpg', 'image/jpeg', 1024), { onProgress });

    expect(mockedCompress).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ onProgress })
    );
  });
});

describe('processImageFile', () => {
  it('processes a regular JPEG (no conversion, with compression)', async () => {
    mockedCompress.mockResolvedValue(makeImageFile('photo.jpg', 'image/jpeg', 512));

    const result = await processImageFile(makeImageFile('photo.jpg', 'image/jpeg', 1024));

    expect(result.wasConverted).toBe(false);
    expect(result.wasCompressed).toBe(true);
    expect(result.originalSize).toBe(1024);
    expect(result.finalSize).toBe(512);
  });

  it('returns wasCompressed=false when compression does not reduce size', async () => {
    mockedCompress.mockResolvedValue(makeImageFile('photo.jpg', 'image/jpeg', 2048));

    const result = await processImageFile(makeImageFile('photo.jpg', 'image/jpeg', 1024));

    expect(result.wasCompressed).toBe(false);
    expect(result.originalSize).toBe(1024);
    expect(result.finalSize).toBe(1024);
  });

  it('converts HEIC then compresses', async () => {
    const convertedBlob = new Blob([new Uint8Array(800)], { type: 'image/jpeg' });
    mockedHeic2any.mockResolvedValue(convertedBlob);
    mockedCompress.mockResolvedValue(makeImageFile('photo_converted.jpg', 'image/jpeg', 400));

    const result = await processImageFile(makeImageFile('photo.heic', 'image/heic', 1024));

    expect(result.wasConverted).toBe(true);
    expect(result.wasCompressed).toBe(true);
    expect(mockedHeic2any).toHaveBeenCalled();
  });

  it('skips compression for non-image files', async () => {
    const file = new File([new Uint8Array(1024)], 'data.bin', { type: 'application/octet-stream' });

    const result = await processImageFile(file);

    expect(result.wasConverted).toBe(false);
    expect(result.wasCompressed).toBe(false);
    expect(result.finalSize).toBe(1024);
    expect(mockedCompress).not.toHaveBeenCalled();
  });

  it('continues with uncompressed file if compression fails', async () => {
    mockedCompress.mockRejectedValue(new Error('compression error'));

    const result = await processImageFile(makeImageFile('photo.jpg', 'image/jpeg', 1024));

    expect(result.wasCompressed).toBe(false);
    expect(result.finalSize).toBe(1024);
  });

  it('calls onProgress callbacks', async () => {
    mockedCompress.mockImplementation(async (_file, options) => {
      options.onProgress?.(50);
      return makeImageFile('photo.jpg', 'image/jpeg', 512);
    });

    const onProgress = vi.fn();
    await processImageFile(makeImageFile('photo.jpg', 'image/jpeg', 1024), { onProgress });

    expect(onProgress).toHaveBeenCalledWith(10);
    expect(onProgress).toHaveBeenCalledWith(70);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it('preserves filename when compression result has generic name', async () => {
    mockedCompress.mockResolvedValue(makeImageFile('blob', 'image/jpeg', 512));

    const result = await processImageFile(makeImageFile('original_name.jpg', 'image/jpeg', 1024));

    expect(result.processedFile.name).toBe('original_name.jpg');
  });

  it('uses the current filename when a compressed result becomes generic', async () => {
    const compressedFile = makeImageFile('compressed.jpg', 'image/jpeg', 512);
    let nameReads = 0;
    Object.defineProperty(compressedFile, 'name', {
      get: () => {
        nameReads++;
        return nameReads === 1 ? 'compressed.jpg' : 'blob';
      },
    });
    Object.defineProperty(compressedFile, 'lastModified', { value: 0 });
    mockedCompress.mockResolvedValue(compressedFile);

    const result = await processImageFile(makeImageFile('original_name.jpg', 'image/jpeg', 1024));

    expect(result.processedFile.name).toBe('original_name.jpg');
  });

  it('uses the original filename when neither compression filename is usable', async () => {
    const compressedFile = makeImageFile('compressed.jpg', 'image/jpeg', 512);
    let nameReads = 0;
    Object.defineProperty(compressedFile, 'name', {
      get: () => {
        nameReads++;
        return nameReads === 1 ? 'compressed.jpg' : 'blob';
      },
    });
    mockedCompress.mockResolvedValue(compressedFile);

    const result = await processImageFile(makeImageFile('', 'image/jpeg', 1024));

    expect(result.processedFile.name).toBe('');
  });
});
