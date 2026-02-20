/**
 * Deterministic avatar index from user ID
 * Returns stable index 0-11 based on userId hash
 */
export function getAvatarIndex(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Keep 32-bit integer
  }
  return Math.abs(hash) % 12;
}
