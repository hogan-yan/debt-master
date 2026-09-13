/**
 * Build a FormData object from a record of fields for testing FormData-based handlers.
 *
 * Null values are skipped (mimicking missing form fields).
 */
export function createFormData(fields: Record<string, string | Blob | null>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) form.append(key, value);
  }
  return form;
}
