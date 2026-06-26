const ERROR_MESSAGES: Record<string, string> = {
  "List title is required": "Donne un nom a ta liste.",
  "List title too long": "Le nom de la liste est trop long.",
  "List description too long": "La description de la liste est trop longue.",
  "Exactly one of albumId or trackId is required": "Impossible d'ajouter cet element a la liste.",
  "Invalid payload": "Impossible d'enregistrer cette selection.",
  "Invalid JSON": "Impossible de lire la demande.",
  "Unauthorized": "Connecte-toi pour continuer.",
  "Not authenticated": "Connecte-toi pour continuer.",
};

export function toastErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return ERROR_MESSAGES[message] ?? fallback;
}

export function toastErrorMessageFromStatus(status: number, error: unknown, fallback: string): string {
  if (status === 401) return ERROR_MESSAGES.Unauthorized;

  if (error && typeof error === "object" && "error" in error) {
    return toastErrorMessage((error as { error: unknown }).error, fallback);
  }

  return fallback;
}
