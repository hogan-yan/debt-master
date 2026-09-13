/**
 * Storage-agnostic filename/object-key helpers.
 *
 * Pure string operations shared by every storage adapter (minio, localfs, …).
 * Moved here from `src/utils/minio.ts` so they are not coupled to the MinIO
 * implementation.
 */

/**
 * Sanitize a filename for use in HTTP headers.
 * Removes or replaces characters that are not valid in HTTP headers.
 */
export const sanitizeForHeader = (filename: string): string => {
  return (
    filename
      // Replace non-ASCII characters with underscores
      .replace(/[^\x20-\x7E]/g, '_')
      // Replace problematic characters with underscores
      .replace(/["\\\r\n\t]/g, '_')
      // Trim whitespace and limit length
      .trim()
      .substring(0, 200)
  );
};

/**
 * Sanitize a filename for use as an object storage key component.
 * Replaces non-alphanumeric characters (except dots and dashes) with underscores.
 */
export const sanitizeForStorage = (fileName: string): string => {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
};

/**
 * Generate a unique object key for file storage.
 */
export const generateObjectKey = (fileName: string, timestamp: number): string => {
  const sanitizedFileName = sanitizeForStorage(fileName);
  return `receipts/${timestamp}-${sanitizedFileName}`;
};
