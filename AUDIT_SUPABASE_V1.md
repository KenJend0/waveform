# Audit Supabase pré-V1 — Waveform

Audit de l'architecture base de données + du pipeline de suppression des critiques, mené avant le gel du schéma pour la V1. Coche au fur et à mesure qu'on traite chaque point.

---

## 0. Bug rapporté : critique supprimée toujours visible en feed

**Cause** : le feed est en fan-out à l'écriture (une ligne `feed_events` par abonné, pas une vue calculée). La suppression doit donc nettoyer explicitement ces copies chez chaque abonné — ce qui ne se produisait pas pour les critiques de titre.

- [x] `deleteTrackDiaryEntry` (track-diary.ts) ne supprimait aucun `feed_events` — corrigé (delete admin sur `track_diary_entry`/`track_like`/`track_comment` via `payload->>trackEntryId`)
- [x] `deleteTrackComment` (track-diary.ts) ne nettoyait pas les notifications de commentaire — corrigé
- [x] `deleteDiaryEntry` (diary.ts) utilisait le client RLS au lieu du client admin pour supprimer `feed_events` (ne supprimait rien, sauvé en pratique par la contrainte `ON DELETE CASCADE`) — corrigé pour utiliser `createSupabaseAdmin()`

---

## 1. Migration prête : `supabase_migrations/supabase_migration_v1_audit_fixes.sql`

**✅ Appliquée le 2026-06-30.**

- [x] **Sécurité** — `list_likes_select` rendait visibles les likes sur une liste privée à tout le monde (`USING (true)` sans vérifier `user_lists.is_public`). Corrigé pour hériter de la visibilité de la liste parente.
- [x] **Cohérence** — `feed_events.track_comment_id` était `ON DELETE SET NULL` au lieu de `CASCADE` (asymétrie avec `comment_id`) → laissait une notification fantôme après suppression d'un commentaire sur critique de titre.
- [x] **Index** `idx_diary_entries_public_created` — filtre `is_public` sur le feed public/trending (album)
- [x] **Index** `idx_track_diary_entries_public_created` — idem côté titres
- [x] **Index** `idx_feed_events_user_created` — requête la plus fréquente de l'app (chargement du fil d'activité)
- [x] **Index** `idx_feed_events_followee_id` — colonne FK filtrée (`getFollowActors`) sans index
- [x] **Index** `idx_feed_events_comment_id` — asymétrie avec `track_comment_id` déjà indexé
- [x] **Index** `idx_track_diary_comments_parent` — threading des réponses (équivalent manquant de l'index album)
- [x] **Index** `idx_user_similarity_user_b_score` — sens inverse de la relation directionnelle (utilisé par `explore.ts`)
- [x] **Index** `idx_diary_entries_user_listened` — tri du journal personnel par `listened_at` (seul `created_at` était indexé)

---

## 2. Décisions produit à trancher (bloquant avant le gel du schéma)

**Vérifié en base le 2026-06-30 — voir résultats des requêtes de diagnostic.**

- [x] **`recommendations` / `notifications` / `recommendation_likes`** — **CONFIRMÉ : n'existent pas en prod** (`information_schema.tables` ne retourne aucune ligne). `recommendations.ts` + `RecommendationModal.tsx` supprimés (code mort garanti cassé). Commentaire `supabase_schema.sql` mis à jour. PATCH 2 de `supabase_rls_patches.sql` (visait `recommendation_likes`, table inexistante) retiré avec note explicative.
- [x] **`album_stats_mat`** — **Résolu.** Migration `supabase_migrations/supabase_migration_album_stats_mat.sql` exécutée (rapatrie la vue + fonction RPC `refresh_album_stats_mat()` réservée au service role). Appel quotidien ajouté dans `.github/workflows/daily-enrich.yml`.
- [x] **`saved_albums` vs liste "À écouter" (`list_items`)** — **CONFIRMÉ divergent et migré.** Découverte en creusant l'UI : `SaveAlbumButton`/`SavedTracks` (les seuls composants qui *affichaient* `saved_albums`) n'étaient déjà rendus nulle part — `saved_albums` ne servait plus qu'en écriture muette (depuis `ImportButton`) et dans un toggle incohérent (`AddToDiaryButton` agissait sur `saved_albums` alors que sa checkbox était pilotée par l'état de `list_items`). Code migré vers `list_items`/`user_lists` (liste par défaut) :
  - `ImportButton.tsx` → `getOrCreateDefaultList()` + `toggleListItem()` au lieu de `saveAlbumOnce()`
  - `AddToDiaryButton.tsx` / `AlbumHero.tsx` → `toggleListItem(defaultListId, …)` au lieu de `toggleSaveAlbum()`
  - `explore.ts` (fallback trending) → lit `list_items.added_at` au lieu de `saved_albums.saved_at`
  - `export.ts` (RGPD) → `saved_albums` retiré (déjà couvert par `lists`/`list_items`)
  - 4 scripts de maintenance (`reconcile-duplicate-albums.mjs`, `reconcile-duplicate-tracks.mjs`, `refix-suspicious-albums.mjs`, `investigate-mbid-not-found.mjs`) → références à `saved_albums` retirées
  - Fichiers supprimés : `saved-albums.ts`, `SaveAlbumButton.tsx`, `SavedTracks.tsx` (code mort)
  - Backfill vérifié (0 ligne orpheline), `DROP TABLE saved_albums` exécuté. **Terminé.**
- [x] **`user_taste_vectors` / `recommendation_metrics`** — **CONFIRMÉ actifs** : pipeline ML externe toujours en fonctionnement (dernier calcul du jour même, 2026-06-30). Tables légitimes, à conserver telles quelles. Aucune action requise.

---

## 3. Nettoyage mineur / cosmétique (non bloquant, à faire si le temps le permet)

- [x] Migrations dupliquées supprimées : `supabase_migration_track_diary_likes.sql` (doublon exact des sections 6-8 de `track_ratings.sql`) et `supabase_migration_beta_dashboard_weekly.sql` (doublon de `product_events.sql` + vue maintenant supprimée). Aucun impact en base — fichiers locaux uniquement, le contenu était déjà appliqué via les fichiers d'origine.
- [x] Supprimer la vue `beta_dashboard_weekly` — confirmé morte : `app/admin/page.tsx` interroge `product_events` directement avec une plage de dates personnalisable (lignes 235, 629), incompatible avec le découpage hebdomadaire figé de la vue. `product_events` (la table) reste active et nécessaire — seule la vue est à supprimer :
  ```sql
  DROP VIEW IF EXISTS beta_dashboard_weekly;
  ```
- [x] Supprimer le filtre mort `.neq('type', 'discover')` dans `feed.ts` (lignes ~168, ~1157) — devenu un no-op depuis que la contrainte CHECK rejette ce type
- [x] **`external_ids` supprimée.** Re-creusé après la passe "vérification finale" : la table était bien écrite/nettoyée par `importAlbumFromMusicBrainz` + 10 scripts de maintenance (donc pas un faux positif d'usage), mais **jamais lue** nulle part (zéro `.select()` dans tout le repo) — les vrais lookups MBID passent par `albums.mbid`/`tracks.mbid` (colonnes dédiées). Son intention d'origine (table générique multi-sources d'ID externes) a même été contournée dans les faits : un ID Spotify a fini en colonne dédiée (`album_metadata.spotify_url`) plutôt qu'en ligne `external_ids`. Pur surcoût d'écriture + dette de maintenance (nettoyage manuel dans 10 fichiers, pas de CASCADE) pour zéro bénéfice. Code retiré dans `musicbrainz.ts`, `admin/actions.ts` et 10 scripts ; `DROP TABLE external_ids` exécuté ; `supabase_schema.sql` régénéré.
- [x] Supprimer les scripts orphelins `scripts/refresh_discover.sh` / `.ps1` (référencent une ancienne API Express qui n'existe plus dans le repo) — supprimés + référence retirée de `README.md`
- [x] **Régénéré.** `supabase_schema.sql` remplacé par un dump fidèle de la prod (`npx supabase db dump --linked --schema public`, CLI authentifié et lié au projet). Vérifié : `saved_albums`/`recommendations`/`recommendation_likes`/`beta_dashboard_weekly` absents, `album_stats_mat` et les colonnes `likes_count`/`comments_count` dénormalisées présentes. À régénérer avec la même commande après tout futur changement de schéma significatif.
- [x] **Harmonisé** — comptage likes/comments aligné partout sur le pattern triggers + colonnes dénormalisées (déjà utilisé par `diary_entries`). Migration : `supabase_migrations/supabase_migration_harmonize_counts.sql` :
  - `track_diary_entries.likes_count`/`comments_count` ajoutées + triggers sur `track_diary_likes`/`track_diary_comments`. La vue `track_diary_entry_stats` est redéfinie en simple lecture de ces colonnes (même forme exposée, donc **aucun changement requis** dans `feed.ts`/`track-diary.ts`/`diary.ts`)
  - `user_lists.likes_count` ajoutée + trigger sur `list_likes`. Code mis à jour : `attachListMeta()` et `getListWithItems()` (lists.ts) lisent directement la colonne au lieu de recompter `list_likes` à chaque appel
  - Migration exécutée avec succès (après correction d'un conflit de type bigint/integer sur `track_diary_entry_stats`). **Terminé.**

---

## 4. Trouvé en relisant le dump fidèle ligne par ligne (post-régénération)

Une fois `supabase_schema.sql` régénéré, une relecture des 60 contraintes FK + RLS a révélé deux derniers points que les 3 audits précédents (basés sur l'ancien fichier maintenu à la main, lui-même inexact sur ce point) n'avaient pas vus :

- [x] **`feed_events.entry_id` était en réalité `ON DELETE SET NULL`**, pas `CASCADE` comme l'ancien `supabase_schema.sql` l'affirmait à tort — seule colonne polymorphe de la table à déroger au pattern (`comment_id`, `track_comment_id`, `album_id`, `actor_id`, `user_id`, `followee_id` sont tous en `CASCADE`). Sans nettoyage explicite côté code, ça laisse une ligne `feed_events` orpheline (`entry_id=NULL`) qui ne s'affiche plus mais gonfle indéfiniment le badge "non lu". Migration : `supabase_migrations/supabase_migration_feed_events_entry_cascade.sql` (FK alignée sur `CASCADE` + nettoyage des orphelins déjà accumulés).
- [x] **`adminDeleteContent` (modération) avait le même bug que celui du début de cette session**, sur un chemin de code différent (suppression de contenu signalé par un admin, pas par l'utilisateur lui-même) — aucun nettoyage de `feed_events` pour les 4 types de contenu, donc une critique de titre supprimée en modération restait visible chez les abonnés exactement comme avant la correction de `deleteTrackDiaryEntry`. Corrigé dans `frontend/app/actions/moderation.ts`.

## 5. Suppression de compte — vérification de bout en bout

Question posée : la suppression d'un utilisateur (dashboard admin ou auto-suppression depuis Settings) efface-t-elle vraiment tout son contenu ? Vérifié, et non — plusieurs trous trouvés et corrigés :

- [x] **`Database error deleting user`** — `update_track_entry_likes_count`/`update_track_entry_comments_count`/`update_list_likes_count` (créées dans `supabase_migration_harmonize_counts.sql`) n'avaient pas de `search_path` fixe ni de tables qualifiées par schéma, contrairement au trigger `diary_entries` déjà en place. Corrigé : `supabase_migration_fix_trigger_search_path.sql`.
- [x] **Toujours en échec après le fix précédent** — cause réelle : ces triggers s'exécutent par défaut avec les droits de l'appelant (`SECURITY INVOKER`). Le rôle qui exécute la suppression de compte (`supabase_auth_admin`) n'a **aucun grant** sur le schéma `public` (vérifié via `information_schema.role_table_grants` — y compris sur `diary_entries`, donc ce bug était probablement latent avant cette session). Corrigé en passant les 5 triggers de comptage en `SECURITY DEFINER` : `supabase_migration_trigger_security_definer.sql`.
- [x] **`user_favorite_albums.user_id` sans aucune contrainte FK** — l'ancien `supabase_schema.sql` prétendait à tort qu'elle existait déjà (même type d'erreur que `feed_events.entry_id`). Le Top 3 favoris d'un compte supprimé restait orphelin en base indéfiniment. Vérifié exhaustivement : aucune autre colonne `user_id`/`*_id` référençant un utilisateur n'avait ce problème. Corrigé (`ON DELETE CASCADE`) + `product_events.user_id` (548 lignes orphelines historiques nettoyées puis FK `ON DELETE SET NULL` ajoutée, cohérent avec son rôle analytics). Migration : `supabase_migrations/supabase_migration_user_fk_gaps.sql`.
- [x] **Avatar Storage non nettoyé en cas de suppression hors app** — `deleteAccount()` (Settings) supprime l'avatar via la Storage API, mais une suppression depuis le dashboard Auth contourne ce code applicatif. Un trigger SQL direct sur `storage.objects` est impossible (Supabase bloque ça via `storage.protect_delete()`, même en `SECURITY DEFINER`). Remplacé par un nettoyage périodique : `frontend/scripts/cleanup-orphaned-avatars.mjs`, ajouté au workflow `daily-enrich.yml` (run quotidien avec `--apply`).

Vérification finale : `BEGIN; DELETE FROM auth.users WHERE id = '<user_id>'; ROLLBACK;` passe sans erreur après tous ces correctifs.

## 5. Vérification du volume (39 tables, 68 profils)

Demande de l'utilisateur : "ça sert à quoi d'avoir autant de tables ?" — vérifié par comptage de lignes réel plutôt que par supposition. Avec seulement 68 utilisateurs, les tables à 0-4 lignes (`user_blocks`, `list_likes`, `content_reports`, `saved_lists`, `curator_picks`, `cron_health`, `import_requests`, `external_imports`, `recommendation_feedback`) sont proportionnelles au volume — pas des signaux de feature morte. Aucune table supplémentaire identifiée comme candidate à la suppression sur cette base.

---

## Notes de méthode

Audit croisé via 3 passes indépendantes (recherche exhaustive par grep sur `frontend/app/actions/*.ts` + lecture des 57 fichiers de migration). Les points ci-dessus sont ceux qui ont survécu à la vérification croisée ; les faux positifs (ex. RLS de `track_diary_likes`/`track_diary_comments`, en réalité déjà correctement durcie) ont été écartés.
