import type { ReactNode } from 'react';

export function optionalImagePreview(
  preview: string | null,
  alt: string,
  className = 'max-w-full max-h-40 object-contain rounded border'
): ReactNode {
  if (!preview) {
    return null;
  }
  return (
    <div className="mt-3">
      <img src={preview} alt={alt} className={className} />
    </div>
  );
}
