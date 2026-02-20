/**
 * Génère l'URL de l'avatar pour un utilisateur
 * Si avatar_url existe, l'utilise
 * Sinon, utilise un avatar déterministe basé sur l'userId
 */
export function getAvatarUrl(
  avatarUrl?: string | null,
  userId?: string
): string {
  // Si l'utilisateur a un avatar personnalisé, l'utiliser
  if (avatarUrl) {
    return avatarUrl;
  }

  // Utiliser l'avatar déterministe basé sur l'userId
  if (userId) {
    return `/api/avatars/${userId}`;
  }

  // Fallback generic
  return `/api/avatars/default`;
}
