/**
 * Format date relative to now with french abbreviations:
 * - 1m for minutes when 'now'
 * - Xm for X minutes
 * - Xh for X hours
 * - Xj for X days
 * - Xs for X weeks
 */
export function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return '1m';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}j`;
  if (seconds < 2419200) return `${Math.floor(seconds / 604800)}s`; // 4 semaines

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
