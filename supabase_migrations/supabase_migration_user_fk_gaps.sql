-- ============================================================
-- Migration : comble deux trous de FK manquants vers profiles/auth.users
-- À exécuter dans le dashboard Supabase → SQL Editor.
--
-- Découvert en vérifiant que la suppression d'un compte efface bien tout
-- son contenu : ces deux tables ont une colonne user_id sans AUCUNE
-- contrainte FK (contrairement à l'ancien supabase_schema.sql maintenu à
-- la main, qui prétendait à tort que user_favorite_albums.user_id avait
-- déjà ON DELETE CASCADE — même type d'erreur que feed_events.entry_id
-- découvert plus tôt dans cette session).
-- ============================================================

-- user_favorite_albums : 0 ligne orpheline confirmée, contrainte directe.
-- Top 3 favoris affiché publiquement — doit disparaître avec le compte.
ALTER TABLE user_favorite_albums
  ADD CONSTRAINT user_favorite_albums_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;

-- product_events : 548 lignes historiques référencent déjà des comptes
-- supprimés avant qu'aucune contrainte n'existe — nettoyage nécessaire
-- avant de pouvoir ajouter la FK (sinon ALTER TABLE échoue à la validation).
-- SET NULL (pas CASCADE) : ce sont des événements analytics/produit,
-- l'historique agrégé (dashboard admin) reste pertinent même anonymisé,
-- contrairement aux favoris qui n'ont aucun sens sans leur propriétaire.
UPDATE product_events
SET user_id = NULL
WHERE user_id IS NOT NULL
  AND user_id NOT IN (SELECT id FROM profiles);

ALTER TABLE product_events
  ADD CONSTRAINT product_events_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;
