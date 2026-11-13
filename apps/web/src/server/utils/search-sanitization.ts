/**
 * Sanitizes search input to prevent ReDoS and excessive query times.
 * - Trims whitespace
 * - Limits to 100 characters
 * - Strips special regex characters
 */
export function sanitizeSearchInput(input: string | undefined): string | undefined {
  if (!input) return undefined;

  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;

  const limited = trimmed.slice(0, 100);

  // Strip special regex characters to prevent ReDoS in case-insensitive searches
  return limited.replace(/[.*+?^${}()|[\]\\]/g, '');
}
