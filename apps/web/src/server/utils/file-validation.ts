/**
 * Server-side file upload validation
 *
 * Validates uploaded files using magic byte detection (not client-provided MIME types)
 * to prevent malicious file uploads. Only allows specific file types.
 *
 * NOTE: This module must ONLY be imported in server-side code (server functions,
 * API routes, workflow handlers). Do NOT import from client-bundled code.
 */

export interface FileValidationResult {
  isValid: boolean;
  detectedMimeType: string | null;
  error?: string;
}

// Allowed file types with their magic byte signatures
const ALLOWED_FILE_TYPES: Record<string, { magic: number[]; offset?: number }[]> = {
  'image/jpeg': [
    { magic: [0xff, 0xd8, 0xff] }, // JPEG start marker
  ],
  'image/png': [
    { magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }, // PNG signature
  ],
  'image/webp': [
    { magic: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header
    { magic: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // WEBP at offset 8
  ],
  'application/pdf': [
    { magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  ],
};

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Check if buffer matches a magic byte signature
 */
function matchesMagicBytes(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Detect MIME type from file magic bytes.
 *
 * Exported so the LocalFS serve route can set a correct `Content-Type` on
 * downloaded files (the persisted object key carries no extension guarantee).
 */
export function detectMimeType(buffer: Buffer): string | null {
  for (const [mimeType, signatures] of Object.entries(ALLOWED_FILE_TYPES)) {
    // For WEBP, both signatures must match
    if (mimeType === 'image/webp') {
      const allMatch = signatures.every((sig) => matchesMagicBytes(buffer, sig.magic, sig.offset));
      if (allMatch) return mimeType;
      continue;
    }

    // For other types, any signature match is sufficient
    const anyMatch = signatures.some((sig) =>
      matchesMagicBytes(buffer, sig.magic, sig.offset ?? 0)
    );
    if (anyMatch) return mimeType;
  }
  return null;
}

export const mimeTypeDetector = {
  detectMimeType,
};

/**
 * Validate an uploaded file using magic byte detection.
 *
 * @param buffer - The file buffer
 * @param fileSize - The size of the file in bytes
 * @returns Validation result with detected MIME type
 */
export function validateUploadedFile(buffer: Buffer, fileSize: number): FileValidationResult {
  // Check file size
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      detectedMimeType: null,
      error: 'File size exceeds maximum allowed size of 20 MB',
    };
  }

  if (fileSize === 0) {
    return {
      isValid: false,
      detectedMimeType: null,
      error: 'File is empty',
    };
  }

  // Detect MIME type from magic bytes
  const detectedMimeType = mimeTypeDetector.detectMimeType(buffer);

  if (!detectedMimeType) {
    return {
      isValid: false,
      detectedMimeType: null,
      error: 'File type not allowed. Only JPEG, PNG, WebP, and PDF files are permitted.',
    };
  }

  // Check if detected type is in allowed list
  if (!ALLOWED_FILE_TYPES[detectedMimeType]) {
    return {
      isValid: false,
      detectedMimeType,
      error: 'File type not allowed. Only JPEG, PNG, WebP, and PDF files are permitted.',
    };
  }

  return {
    isValid: true,
    detectedMimeType,
  };
}

/**
 * Convenience function that validates a File object from FormData.
 * Reads the file into a buffer and validates it.
 *
 * @param file - The File object from FormData
 * @returns Promise resolving to validation result with detected MIME type
 */
export async function validateUploadedFileObject(file: File): Promise<FileValidationResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return validateUploadedFile(buffer, file.size);
}
