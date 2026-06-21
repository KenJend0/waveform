# Waveform — Roadmap

---

## Beta → Lancement public

Ce qui doit être fait *avant* de dire "V1". Must-haves, pas des features.

### Légal & conformité
- [x] Pages légales (CGU, Politique de confidentialité, Mentions légales)
- [x] FAQ (usage, compte & données, droits musicaux)
- [x] Page hub `/legal` accessible depuis le hamburger menu
- [x] Liens CGU + confidentialité cliquables sur la page d'inscription
- [x] Bandeau consentement analytics — N/A : Vercel Analytics est anonyme et agrégé, exempté de consentement par la CNIL
- [ ] Export des données utilisateur sur demande (dump JSON diary) — DSAR RGPD → reporté en V1, géré manuellement via email en beta
- [x] Mettre à jour les pages légales suite à l'ajout de la page support (cohérence des liens/mentions) — `/support` fusionnée dans `/legal` (hub unique), chrome/style partagés, contenu FAQ/légal corrigé pour refléter le comportement réel

### Onboarding
- [x] Flow post-inscription : pseudo + follow des suggestions + écran de lancement
- [x] State "feed vide / sparse" amélioré avec CTA pour suivre des gens / logger un album
- [x] SMTP custom (Resend) pour les emails transactionnels

### Notifications
- [ ] ~~Page/composant notifications~~ — déplacé en V1 (voir ci-dessous)

### UX & pages
- [x] Refaire `/add` en une seule page unifiée (log + save avec toggle)
- [x] Auto-import au clic (SearchOverlay, /search, page artiste, diary) — plus de page `/preview` intermédiaire
- [x] Améliorer la recherche (pochette + artiste visible direct, recherche users)
- [x] Pages 404 custom pour albums/artistes non importés — `notFound()` déclenche la page 404 globale
- [x] Pages d'erreur custom (`not-found.tsx`, `error.tsx`, `global-error.tsx`, `loading.tsx`)

### Fiabilité
- [x] Reset password — flow complet `/auth/reset` fonctionnel (SMTP Resend + token_hash)
- [x] Pagination curseur sur le feed — plus de sauts/doublons au scroll (cursor = `created_at` du dernier event)
- [x] Rate limiting sur `/api/*` — 30 req/60 s par IP via Upstash (fail-open si `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` non définis)

### SEO & partage
- [x] `generateMetadata` sur les pages dynamiques (albums, artistes, profils, reviews)
- [x] `robots.txt` — bloquer `/api/*`, `/settings/*`, `/me/*`, `/auth/*`, `/onboarding/*`, `/add`
- [x] `sitemap.xml` — pages statiques indexables (`/`, `/search`)

---

## V1 — Correctifs & UX

Bugs et frictions identifiés, à régler avant de croître.

### Bugs
- [x] **Like optimistic UI** — sur le feed, liker est maintenant instantané coté client
- [x] **SearchOverlay** - sur /explore, la barre de recherche fonctionne correctement
- [x] **Régression : liste des likers disparue** — `LikesBottomSheet` généralisé (album/track) et réintégré sur `/track-diary` et la tab "critiques" du profil ; `/diary` l'avait déjà
- [x] **Régression : signalement de tracks ne retourne pas le texte du signalement** — `/admin` ne récupérait jamais le texte des `track_diary_entries`/`track_diary_comments`
- [x] **Régression : panel admin signalement non fonctionnel** — `adminAnalyzeContent` ne gérait pas les types track (items "Panel admin" et "Signalement de contenu" de V2 Infra › Modération & abus re-vérifiés OK)
- [ ] **Confirmation par email à l'inscription ne fonctionne pas** — retirée pour le moment ; à corriger (SMTP Resend déjà en place pour reset password, vérifier la config/template pour la confirmation)

### UX & interactions
- [x] **Bottom sheet pour reviews et commentaires** — remplacer les modals centrées par un panneau qui monte du bas et occupe la moitié inférieure de l'écran (style iOS / Letterboxd)
- [x] **Redesign du like** — remplacer "❤️ X" par "J'aime · X" ; au clic sur le compteur, ouvrir la liste des gens qui ont liké (bottom sheet)
- [x] **Supprimer les pages inutiles** — `/diary/page.tsx` et `/import/page.tsx` supprimées (remplacées par `/add` et auto-import), les liens dans le middleware mis à jour
- [ ] **Réintroduire like/répondre sur les cartes critique du feed** — boutons retirés (commentés, pas supprimés) dans `FeedCardReviewCreated`/`FeedCardTrackReviewCreated` pour la refonte ligne uniforme ; trouver une UI discrète (icône au survol/coin de carte) sans recharger la ligne
- [x] **Navigation retour** — `BottomNav` réintroduite sur toutes les pages mobile (plus seulement les 4 hubs), en mode compact hors hubs ; bouton retour unifié sur le composant `BackButton` partagé (`LegalPageShell` utilisait sa propre implémentation)
- [ ] **Revoir le parcours `/` → `/auth`** — vérifier si l'étape intermédiaire casse l'expérience d'entrée

### Layout desktop (version PC)
- [ ] Refonte du layout pour les écrans larges. garder le design mobile-first intact

---

## V1 — Contenu & enrichissement

Rendre les pages albums et artistes vraiment riches.

### Pages album
- [x] **Activité réseau** — afficher les amis qui ont déjà écouté cet album (avatars + note si disponible) directement sur la page album
- [x] **Enrichissement metadata** — genres (tags) via MusicBrainz ou Last.fm, description de l'album si disponible
- [x] **Albums similaires / de la même disco** — carousel "Du même artiste" et "Albums similaires" en bas de page album
- [ ] **Gérer l'état vide "Albums similaires"** — message ou fallback quand il n'y a aucun résultat, plutôt qu'un vide silencieux

### Pages artiste
- [x] **Bio et tags** — bio Wikipedia déjà fetchée (`fetchArtistMetadata`), l'afficher proprement avec genres et tags ; artistes similaires
- [ ] **Discographie complète** — filtres par type (Albums, EPs, Singles, Lives), tri par date
- [ ] **Gérer l'état vide "Artistes similaires"** — même besoin que côté album

### Enrichissement des tags & votes communautaires
- [ ] **Améliorer la couverture des tags d'albums** — actuellement ~30% (vs 99% covers/liens streaming) ; arbitrer entre saisie manuelle, IA, ou source externe complémentaire
- [ ] **Vérifier que les votes communautaires de genre sont réellement pris en compte** dans les tags affichés/utilisés pour la recommandation
- [ ] **Revoir l'UX du vote communautaire de genre** — beaucoup de skips car l'utilisateur ne sait pas quel style choisir ; proposer des suggestions/exemples plutôt qu'un champ ouvert


---

## V1 — Social & Feed

Ce qui rend l'app vraiment utilisable au quotidien.

### Feed
- [x] **Agrégation des événements** — *"Mehdi, Camille et 8 autres ont aimé GUTS"* (groupBy album + event_type + fenêtre de 24h)
- [x] **Section "Pour toi" dans Explore** — collaborative filtering Jaccard : voisins de goût (>= 3 albums notés >= 8 en commun, toute la plateforme), suggestions hors journal, disparaît proprement si pas assez de données
- [x] **Carousel "Découverte" dans Explore** — remplace "Récemment ajoutés" : albums bien notés globalement dont l'artiste est inconnu de l'utilisateur
- [ ] **Revoir les textes des cartes du feed** pour finaliser la refonte ligne uniforme
- [ ] **Feedback après notation** — un retour qui montre que le profil évolue (pas juste un toast "ajouté")
- [ ] **Notation rapide sur Explore** — noter un album directement depuis la carte, sans ouvrir la page album
- [ ] **Critique minimale / tags "vibe"** — alternative au texte libre (sombre, nostalgique, énergique...)
- [ ] **Collections implicites** — *"X/10 albums essentiels de cet artiste"*, *"albums des années 2010 explorés"* ; vérifier d'abord si les albums ont les métadonnées genre/décennie exploitables

### Profils & stats
- [ ] **Stats sur le profil** — note moyenne globale, distribution des notes (histogramme), top artistes, top genres ; dans un onglet dédié ou accessible depuis le menu (desktop : accessible depuis le hamburger menu)
- [ ] **Compte privé / public** — toggle dans les paramètres : compte privé = diary et feed visibles uniquement par les abonnés approuvés

### Notifications
- [ ] **Centre de notifications** — icône cloche dans l'header ; types : like, commentaire, follow, recommandation
- [ ] **Notifications contextuelles** (pas des notifs sociales classiques) :
  - Reminder wishlist : *"X est dans ta liste depuis 3 semaines, tu l'as écouté ?"* (cron hebdo)
  - Convergence sociale : *"3 personnes que tu suis ont écouté X cette semaine"*
  - Suggestions de comptes périodiques
  - Reminder d'écoute via streaming lié (Spotify/Deezer/Apple Music) : *"tu as écouté X récemment, tu veux le noter ?"* — voir recherche intégration streaming, V2 Découverte

### Recherche
- [ ] **Améliorer les scores de pertinence** — pondération par popularité (listeners_count, reviews_count), boost exact-match, dé-boost des entrées sans cover ou sans reviews

### Import & données
- [ ] **Import historique Last.fm** — vrai onboarding des music nerds ; récupérer les scrobbles et pré-remplir le diary
- [ ] **Export RGPD** — dump JSON du diary sur demande (automatisé, pas manuel)

### Listes (wishlist)
- [ ] **Ajout rapide à la liste**
- [ ] **Retrait automatique de la liste** quand l'album passe en diary noté

### Partage
- [x] **OG images dynamiques** pour les reviews (partage Twitter/Discord) — génération via `@vercel/og`
- [ ] **Mettre en avant le ShareButton après notation** — actuellement une icône de 15px planquée dans un sous-menu d'entrée de journal, quasi invisible ; lui donner un vrai CTA visible juste après avoir noté un album

---

## V2 — Infrastructure & plateforme

Une fois que l'app est stable et qu'il y a des utilisateurs.

### Monitoring
- [ ] **Monitoring** — Sentry côté client + serveur, alertes sur les erreurs 5xx et les latences anormales
- [ ] **Instrumentation analytics produit** — events de rétention (note, follow, partage...) trackés + dashboard rétention J1/J7 ; aucun event de ce type aujourd'hui, prérequis pour mesurer l'impact des features d'engagement plutôt que de designer à l'aveugle

### Migration VPS / REST API
> ⏸ Reporté en V3. Le pipeline ML batch (Python + GitHub Actions → Supabase) ne nécessite pas de sortir de ce stack. pgvector + PostgreSQL couvrent les besoins jusqu'à plusieurs centaines de milliers d'utilisateurs. Réévaluer uniquement si inférence temps réel ou volume de vecteurs > 1M.
- [ ] **Évaluer la migration** — sortir de la dépendance Supabase/Vercel : REST API custom (Fastify ou Hono), même schéma Postgres, même RLS ou ACL applicatif
- [ ] **Schéma de migration des données** — script de transfert zero-downtime

### Performance & optimisation BDD
- [x] **Audit des requêtes N+1** — identifier les Server Actions qui font des requêtes en boucle (ex : enrichissement feed event par event) et les remplacer par des joins ou des batchs
- [x] **Index manquants** — analyser avec `EXPLAIN ANALYZE` les requêtes lentes ; candidats identifiés : `feed_events(actor_id)`, `diary_entries(album_id, user_id)`, `diary_comments(entry_id)`
- [x] **Vue matérialisée `album_stats`** — la vue actuelle recalcule à chaque appel ; la matérialiser et la rafraîchir via trigger ou cron
- [ ] **Mise en cache Server Actions** — utiliser `unstable_cache` (Next.js) ou React `cache()` sur les lectures fréquentes et stables (stats album, bio artiste, discographie)
- [ ] **Pagination sur les pages artiste / profil** — les requêtes sans LIMIT peuvent devenir lentes avec de la donnée ; cursor-based comme le feed

### Rate limiting & sécurité
- [x] **Rate limiting généralisé** — étendre au-delà de `/api/*` : actions serveur sensibles (like, comment, follow, review), pas seulement les routes publiques
- [ ] **Headers de sécurité** — Content-Security-Policy, X-Frame-Options, HSTS via middleware Next.js

### Modération & abus
- [x] **Signalement de contenu** — bouton "Signaler" sur les reviews et commentaires, file de modération admin
- [x] **Blocage d'utilisateurs** — bloquer un user retire ses events du feed et cache son profil
- [x] **Panel admin** — dashboard liste des signalements, actions ban/warn/delete
  > ⚠️ Signalement tracks + panel admin actuellement cassés en pratique — bugs trackés dans V1 Correctifs & UX › Bugs
- [ ] **Signalement des commentaires** — à trancher si on l'ajoute en plus des reviews/tracks
- [ ] **Rate limit sur les signalements** — éviter le spam (ex. 1 signalement/objet/24h par user)

---

## V2 — Découverte & recommandations

Une fois qu'il y a assez de données.

- [ ] **Recherche par titre de chanson** — si l'utilisateur tape "Come Together", remonter l'album parent ("Abbey Road") via l'endpoint `/recording` de MusicBrainz, puis lookup release-group ; nécessite 2 appels MB + déduplication avec les résultats album classiques
- [ ] **Tags de genre MusicBrainz sur les albums** — stocker les tags MB (`/release-group/{mbid}?inc=tags`) au moment de l'import dans un champ `tags[]` sur la table `albums` ; débloque la découverte par genre (proposer des albums bien notés *hors* des genres habituels du user) et l'amélioration des stats profil
- [ ] **Pipeline ML batch** — répertoire `/ml/` Python (numpy, scipy, scikit-learn), tables Supabase (`user_taste_vectors`, `user_similarity`, `user_recommendations`, `recommendation_metrics`), cron GitHub Actions quotidien ; résultats lus directement par Next.js — pas de service live
- [ ] **Vérifier que le batch ML (`user_similarity`) tourne réellement en prod** — `SimilarUsersSection` dépend de cette table sur Explore et reste vide tant que le batch n'a pas tourné pour l'utilisateur
- [ ] **Recommandations ML** — Phase 0 : cosine similarity sur matrice user-item (ratings mean-centered) → remplace le Jaccard actuel. Phase 1 : hybrid CF + content-based genre. Phase 2 : matrix factorization SVD/ALS
- [ ] **"Users with similar taste" + Taste match %** — section dans /explore et badge sur les profils publics, calculés par le batch ML
- [ ] **Feedback explicite sur les recommandations** — bouton "Pas pour moi" sur les recs "Pour toi" ; signal négatif stocké, utilisé pour filtrer les recs suivantes
- [ ] **listen_count sur les diary_entries** — migrer `re_listen BOOLEAN` vers `listen_count INT DEFAULT 1` ; signal implicite d'attachement plus fin pour le ML
- [ ] **Listes thématiques UGC** — *"Best of 2024"*, *"Albums pluvieux"* (à la Letterboxd) — créer, partager, commenter
- [ ] **Stats avancées** — graphes par année / genre / artiste, distribution des notes, tendances temporelles
- [ ] **Profils "critiques"** — score de crédibilité basé sur cohérence des notes et ancienneté
- [ ] **Weekly recap** — genre dominant, album le plus clivant de la semaine ; demande de vraies agrégations, à activer une fois le volume de données suffisant
- [ ] **Comparaisons sociales** — *"plus sévère que 72% des gens"* ; à n'activer qu'avec une base d'utilisateurs plus large, sinon pourcentages statistiquement creux
- [ ] **Recherche : intégration streaming (Spotify/Deezer/Apple Music)** — donner du contexte à l'app sur les habitudes d'écoute réelles. Deux usages : (1) reminder/widget "tu as écouté X récemment, tu veux le noter ?" via historique d'écoute, (2) récupérer artistes favoris/les plus écoutés pour personnaliser le contenu proposé. À creuser : contraintes d'accès à l'historique d'écoute par plateforme (Spotify a resserré ses scopes ces dernières années), proche par nature de l'item "Import historique Last.fm" (V1 Social & Feed › Import & données) mais en temps différé, pas en synchro continue

---

## V2 — Design system

- [ ] **Refonte design & UX** — passer par une session dédiée avec un agent spécialisé : tokens de couleur, typographie, espacement, composants cohérents
- [ ] **Refaire `/` et `/auth` avec Claude design** (`/add` déjà refait)
- [ ] **Repenser `/explore` comme vraie page d'entrée de l'app** — design + contenu, une fois la couverture de tags/recommandations améliorée (V1 Contenu › Enrichissement des tags)
- [ ] **Nav contextuelle** — bouton "+" qui change de label selon le contexte ; risque de complexité pour un gain cosmétique, à examiner seulement si bandwidth
- [ ] **Dark / light mode** — bascule dans les paramètres, respect du `prefers-color-scheme`
- [ ] **Design system complet** — documenter les composants de base (boutons, cartes, modals, toasts) pour accélérer les développements futurs

---

## V2 — Croissance

- [ ] **Notifications email** — opt-in, fréquence max hebdo (Resend ou Postmark) — digest des activités, nouvelles recommendations
- [ ] **Programme bêta invité** — codes d'invitation pour contrôler la croissance et qualifier les premiers utilisateurs
- [ ] **Contenu pour les nouveaux utilisateurs** — peu de contenu/follows disponibles au tout début, à traiter avant de pousser l'acquisition
- [ ] **Repenser l'onboarding** au-delà du flow actuel (pseudo → suggestions → lancement), si jugé insuffisant après mesure (lié à l'instrumentation analytics, V2 Infra › Monitoring)

---

## Hors scope (pour l'instant)

Messagerie privée, ML lourd au-delà du pipeline batch actuel, refonte complète du feed, multiplication des badges/notifs push, marketplace de recommandations, playlists trop ambitieuses.

---

## Fait ✓

- [x] Feed social avec infinite scroll
- [x] Diary (log, note, avis, public/privé)
- [x] Wishlist / albums sauvegardés
- [x] Profils publics + abonnements
- [x] Explore (trending semaine + récemment ajoutés)
- [x] Recherche albums + artistes (MusicBrainz)
- [x] Recommandations entre utilisateurs
- [x] Import albums depuis MusicBrainz
- [x] Likes et commentaires sur les reviews
- [x] Top 3 albums favoris
- [x] Paramètres profil (avatar, bio, username — modifiable 1 fois)
- [x] Suppression de compte
- [x] Vercel Analytics
- [x] Pages légales + FAQ
- [x] Email de contact : waveform.contact@proton.me
- [x] Onboarding flow 3 étapes (pseudo → suggestions → lancement)
- [x] SMTP Resend configuré
- [x] Intégrité données follows (CASCADE FK + cleanup orphelins)
- [x] Auto-import albums au clic (SearchOverlay, /search, page artiste, AlbumSearchForDiary)
- [x] Rate limiting `/api/*` via Upstash
- [x] SEO — generateMetadata, robots.txt, sitemap.xml
- [x] Durées des pistes (multi-disques) depuis MusicBrainz
- [x] Recherche artistes filtrée par albums studio
- [x] Liens streaming fetchés (Spotify, Apple Music, Deezer, Tidal) via MusicBrainz external URLs
- [x] Bio artiste via Wikipedia / Wikidata (avec cache DB)
- [x] Agrégation des événements
