/**
 * Label shown when an uploaded image was converted and/or compressed.
 */
export function optimizationLabel(
  wasConverted: boolean,
  wasCompressed: boolean,
  label: string
): string {
  return wasConverted || wasCompressed ? label : '';
}

export function fileNameOrEmpty(file: File | null): string {
  return file?.name ?? '';
}

export function fileSizeMbLabel(file: File | null): string {
  return ((file?.size ?? 0) / 1024 / 1024).toFixed(1);
}

export function hasPreviewSrc(preview: string | null): preview is string {
  return Boolean(preview);
}
