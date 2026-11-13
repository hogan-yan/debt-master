/**
 * Swappable object-storage adapter interface (DEBTCOM-3).
 *
 * Abstracts the receipt/payment-proof storage so the backend is swappable via
 * `STORAGE_PROVIDER` (minio today; localfs in a follow-up). Callers go through
 * {@link getStorageAdapter} (or the higher-level wrappers in `./index`) and
 * never import a concrete adapter directly.
 *
 * The persisted identifier is a `{ bucket, objectKey }` pair — stored on the
 * `Expense`/`Payment` rows — so swapping backends does not require a schema
 * migration.
 */

export interface StorageLocation {
  readonly bucket: string;
  readonly objectKey: string;
}

/**
 * Input to {@link StorageAdapter.upload}: an already-validated, buffered file.
 * File validation (magic-byte detection) stays storage-agnostic and is run by
 * the caller-facing `uploadValidatedFile` wrapper, not per adapter.
 */
export interface StorageUpload {
  readonly buffer: Buffer;
  readonly fileName: string;
  readonly contentType: string;
}

export interface StorageAdapter {
  /** Store the buffered file; return its persisted location. */
  upload(params: StorageUpload): Promise<StorageLocation>;

  /**
   * Return a browser-fetchable URL for the stored file. `expirySeconds` is a
   * hint — MinIO honours it via presigned URLs; the localfs adapter (follow-up)
   * serves a non-expiring route URL.
   */
  getUrl(bucket: string, objectKey: string, expirySeconds?: number): Promise<string>;

  /** Remove the stored file. Tolerant of a missing object (best-effort). */
  delete(bucket: string, objectKey: string): Promise<void>;
}
