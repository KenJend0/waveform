-- ============================================================
-- Migration : RETIRE le trigger cleanup_avatar_storage (non fonctionnel)
-- À exécuter dans le dashboard Supabase → SQL Editor.
--
-- Tentative initiale : un trigger AFTER DELETE ON profiles qui supprimait
-- directement la ligne storage.objects correspondante. Échec confirmé :
-- Supabase a un trigger protecteur (storage.protect_delete()) qui bloque
-- toute suppression SQL directe sur storage.objects, y compris depuis une
-- fonction SECURITY DEFINER — il faut passer par la Storage API.
--
-- Remplacé par un script de nettoyage périodique
-- (scripts/cleanup-orphaned-avatars.mjs) qui utilise la vraie Storage API.
-- ============================================================

DROP TRIGGER IF EXISTS trg_cleanup_avatar_storage ON profiles;
DROP FUNCTION IF EXISTS cleanup_avatar_storage();
