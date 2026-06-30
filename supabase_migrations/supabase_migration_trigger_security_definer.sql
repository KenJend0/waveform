-- ============================================================
-- Migration : passe les triggers de comptage en SECURITY DEFINER
-- À exécuter dans le dashboard Supabase → SQL Editor.
--
-- Bug réel (au-delà du search_path déjà corrigé) : ces triggers
-- s'exécutent par défaut avec les droits de l'appelant (SECURITY INVOKER).
-- Quand un compte est supprimé via l'API Admin Auth, l'appelant est le
-- rôle `supabase_auth_admin`, qui n'a AUCUN grant sur le schéma public
-- (vérifié : information_schema.role_table_grants ne retourne rien pour
-- ce rôle sur diary_entries/track_diary_entries/user_lists/etc.).
-- Dès qu'un des triggers tente un UPDATE cross-table pendant la cascade
-- (ex: suppression des diary_likes d'un utilisateur → trigger qui met à
-- jour diary_entries.likes_count), Postgres refuse pour permission
-- manquante → toute la transaction de suppression échoue
-- ("Database error deleting user"). Ce bug était probablement latent
-- avant cette session (jamais déclenché car aucun compte supprimé
-- n'avait encore de likes/commentaires sur l'entrée d'un autre user).
--
-- SECURITY DEFINER fait tourner la fonction avec les droits de son
-- propriétaire (postgres, déjà confirmé via ALTER FUNCTION ... OWNER TO
-- "postgres"), qui a tous les droits — sans avoir à accorder de grants
-- supplémentaires à supabase_auth_admin. Sûr ici car combiné à un
-- search_path fixe + des références de table qualifiées par schéma
-- (déjà en place), qui neutralisent le risque habituel de SECURITY
-- DEFINER (search_path mutable). Même pattern que delete_user_account(),
-- déjà SECURITY DEFINER dans ce schéma.
-- ============================================================

ALTER FUNCTION update_entry_likes_count() SECURITY DEFINER;
ALTER FUNCTION update_entry_comments_count() SECURITY DEFINER;
ALTER FUNCTION update_track_entry_likes_count() SECURITY DEFINER;
ALTER FUNCTION update_track_entry_comments_count() SECURITY DEFINER;
ALTER FUNCTION update_list_likes_count() SECURITY DEFINER;
