/**
 * Shared helpers for dashboard analytics functions
 */

export function formatDaysAgo(date: Date | string): string {
  const daysDiff = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff === 0 ? 'Today' : daysDiff === 1 ? '1 day ago' : `${daysDiff} days ago`;
}

export function daysSince(date: Date | string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}
