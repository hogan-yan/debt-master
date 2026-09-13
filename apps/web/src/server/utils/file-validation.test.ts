import { describe, expect, it, vi } from 'vitest';
import * as fileValidation from './file-validation';
import { validateUploadedFile, validateUploadedFileObject } from './file-validation';

const jpegMagic = [0xff, 0xd8, 0xff, 0xe0];
const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2d];
const webpHeader = [
  0x52,
  0x49,
  0x46,
  0x46, // RIFF
  0x00,
  0x00,
  0x00,
  0x00,
  0x57,
  0x45,
  0x42,
  0x50, // WEBP
];

function makeBuffer(bytes: number[], padTo = 64): Buffer {
  const buf = Buffer.alloc(padTo);
  for (let i = 0; i < bytes.length; i++) {
    buf[i] = bytes[i] ?? 0;
  }
  return buf;
}

const MAX_SIZE = 20 * 1024 * 1024;

describe('validateUploadedFile', () => {
  describe('valid files', () => {
    it.each([
      ['image/jpeg', jpegMagic],
      ['image/png', pngMagic],
      ['application/pdf', pdfMagic],
      ['image/webp', webpHeader],
    ] as const)('accepts valid %s', (expectedType, magic) => {
      const result = validateUploadedFile(makeBuffer([...magic]), 1024);
      expect(result).toEqual({ isValid: true, detectedMimeType: expectedType });
    });

    it('accepts file at exactly the size limit', () => {
      const result = validateUploadedFile(makeBuffer(jpegMagic), MAX_SIZE);
      expect(result.isValid).toBe(true);
    });
  });

  describe('size validation', () => {
    it('rejects file 1 byte over limit', () => {
      const result = validateUploadedFile(makeBuffer(jpegMagic), MAX_SIZE + 1);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('20 MB');
    });

    it('rejects empty file', () => {
      const result = validateUploadedFile(Buffer.alloc(0), 0);
      expect(result).toEqual({
        isValid: false,
        detectedMimeType: null,
        error: 'File is empty',
      });
    });
  });

  describe('magic byte validation', () => {
    it('detects PNG magic bytes regardless of caller intent', () => {
      // Magic bytes determine type — the function has no extension parameter
      const result = validateUploadedFile(makeBuffer(pngMagic), 1024);
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('image/png');
    });

    it('rejects file with unrecognized magic bytes', () => {
      // ZIP: 50 4B 03 04
      const result = validateUploadedFile(makeBuffer([0x50, 0x4b, 0x03, 0x04]), 1024);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('rejects random garbage bytes', () => {
      const result = validateUploadedFile(makeBuffer([0xde, 0xad, 0xbe, 0xef]), 1024);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('rejects buffer too short for magic bytes', () => {
      const result = validateUploadedFile(Buffer.from([0x89]), 1);
      expect(result.isValid).toBe(false);
    });

    it('rejects WebP with RIFF but missing WEBP at offset 8', () => {
      const brokenWebp = [
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00, // not WEBP
      ];
      const result = validateUploadedFile(makeBuffer(brokenWebp), 1024);
      expect(result.isValid).toBe(false);
    });

    it('rejects a detected MIME type outside the allowlist', () => {
      const detectMimeType = vi
        .spyOn(fileValidation.mimeTypeDetector, 'detectMimeType')
        .mockReturnValue('application/x-executable' as never);

      const result = validateUploadedFile(makeBuffer(jpegMagic), 1024);

      expect(result).toEqual({
        isValid: false,
        detectedMimeType: 'application/x-executable',
        error: 'File type not allowed. Only JPEG, PNG, WebP, and PDF files are permitted.',
      });
      detectMimeType.mockRestore();
    });
  });
});

describe('validateUploadedFileObject', () => {
  it('validates a valid JPEG File object', async () => {
    const file = new File([new Uint8Array(makeBuffer(jpegMagic))], 'photo.jpg', {
      type: 'image/jpeg',
    });
    const result = await validateUploadedFileObject(file);
    expect(result).toEqual({ isValid: true, detectedMimeType: 'image/jpeg' });
  });

  it('rejects oversized File object', async () => {
    const file = new File([new Uint8Array(makeBuffer(jpegMagic))], 'big.jpg', {
      type: 'image/jpeg',
    });
    Object.defineProperty(file, 'size', { value: MAX_SIZE + 1 });
    const result = await validateUploadedFileObject(file);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('20 MB');
  });

  it('rejects empty File object', async () => {
    const file = new File([], 'empty.jpg', { type: 'image/jpeg' });
    const result = await validateUploadedFileObject(file);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('File is empty');
  });
});
