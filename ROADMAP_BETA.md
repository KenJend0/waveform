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
- [ ] **Like optimistic UI** — sur le feed, liker nécessite un refresh pour voir le cœur s'activer ; doit être instantané côté client
- [ ] **Liens streaming** — implémentés dans `musicbrainz.ts` (`getAlbumStreamingLinks`) mais pas affichés dans l'UI des pages album → brancher sur `AlbumHero`

### UX & interactions
- [ ] **Bottom sheet pour reviews et commentaires** — remplacer les modals centrées par un panneau qui monte du bas et occupe la moitié inférieure de l'écran (style iOS / Letterboxd)
- [ ] **Redesign du like** — remplacer "❤️ X" par "J'aime · X" ; au clic sur le compteur, ouvrir la liste des gens qui ont liké (bottom sheet)
- [ ] **Supprimer les pages inutiles** — `/diary` (redondant avec `/me`) et `/import` (remplacé par l'auto-import), les dépages correspondantes et les liens dans la nav

### Layout desktop (version PC)
- [ ] Refonte du layout pour les écrans larges : sidebar gauche (nav), colonne centrale (contenu), sidebar droite (contexte / widgets) — garder le design mobile-first intact

---

## V1 — Contenu & enrichissement

Rendre les pages albums et artistes vraiment riches.

### Pages album
- [ ] **Activité réseau** — afficher les amis qui ont déjà écouté cet album (avatars + note si disponible) directement sur la page album
- [ ] **Enrichissement metadata** — genres (tags) via MusicBrainz ou Last.fm, description de l'album si disponible
- [ ] **Albums similaires / de la même disco** — carousel "Du même artiste" et "Albums similaires" en bas de page album
- [ ] **Singles dans la recherche** — inclure les singles et EPs (types MusicBrainz) dans les résultats de recherche et dans la discographie artiste

### Pages artiste
- [ ] **Bio et tags** — bio Wikipedia déjà fetchée (`fetchArtistMetadata`), l'afficher proprement avec genres et tags ; artistes similaires
- [ ] **Discographie complète** — filtres par type (Albums, EPs, Singles, Lives), tri par date

### Likes sur les titres (tracks)
- [ ] **Liker un titre sur la page album** — bouton like par piste (table `track_likes` à créer, RLS, fanout)
- [ ] **Feed card dédiée** — `FeedCardTrackLiked` : *"X aime [Titre] sur [Album]"*

---

## V1 — Social & Feed

Ce qui rend l'app vraiment utilisable au quotidien.

### Feed
- [ ] **Agrégation des événements** — *"Mehdi, Camille et 8 autres ont aimé GUTS"* (groupBy album + event_type + fenêtre de 24h)
- [ ] **Section "Pour toi" dans Explore** — albums bien notés par tes abonnements que tu n'as pas encore écouté (collaborative filtering simple, pas de ML)

### Profils & stats
- [ ] **Stats sur le profil** — note moyenne globale, distribution des notes (histogramme), top artistes, top genres ; dans un onglet dédié ou accessible depuis le menu
- [ ] **Compte privé / public** — toggle dans les paramètres : compte privé = diary et feed visibles uniquement par les abonnés approuvés

### Notifications
- [ ] **Centre de notifications** — icône cloche dans l'header ; types : like, commentaire, follow, recommandation
- [ ] **Notifications contextuelles** (pas des notifs sociales classiques) :
  - Reminder wishlist : *"X est dans ta liste depuis 3 semaines, tu l'as écouté ?"* (cron hebdo)
  - Convergence sociale : *"3 personnes que tu suis ont écouté X cette semaine"*
  - Suggestions de comptes périodiques

### Recherche
- [ ] **Améliorer les scores de pertinence** — pondération par popularité (listeners_count, reviews_count), boost exact-match, dé-boost des entrées sans cover ou sans reviews

### Import & données
- [ ] **Import historique Last.fm** — vrai onboarding des music nerds ; récupérer les scrobbles et pré-remplir le diary
- [ ] **Export RGPD** — dump JSON du diary sur demande (automatisé, pas manuel)

### Partage
- [ ] **OG images dynamiques** pour les reviews (partage Twitter/Discord) — génération via `@vercel/og`

---

## V2 — Infrastructure & plateforme

Une fois que l'app est stable et qu'il y a des utilisateurs.

### Migration VPS / REST API
- [ ] **Évaluer la migration** — sortir de la dépendance Supabase/Vercel : REST API custom (Fastify ou Hono), même schéma Postgres, même RLS ou ACL applicatif
- [ ] **Schéma de migration des données** — script de transfert zero-downtime
- [ ] **Monitoring** — Sentry côté client + serveur, alertes sur les erreurs 5xx et les latences anormales

### Performance & optimisation BDD
- [ ] **Audit des requêtes N+1** — identifier les Server Actions qui font des requêtes en boucle (ex : enrichissement feed event par event) et les remplacer par des joins ou des batchs
- [ ] **Index manquants** — analyser avec `EXPLAIN ANALYZE` les requêtes lentes ; candidats identifiés : `feed_events(actor_id)`, `diary_entries(album_id, user_id)`, `diary_comments(entry_id)`
- [ ] **Vue matérialisée `album_stats`** — la vue actuelle recalcule à chaque appel ; la matérialiser et la rafraîchir via trigger ou cron
- [ ] **Mise en cache Server Actions** — utiliser `unstable_cache` (Next.js) ou React `cache()` sur les lectures fréquentes et stables (stats album, bio artiste, discographie)
- [ ] **Pagination sur les pages artiste / profil** — les requêtes sans LIMIT peuvent devenir lentes avec de la donnée ; cursor-based comme le feed

### Rate limiting & sécurité
- [ ] **Rate limiting généralisé** — étendre au-delà de `/api/*` : actions serveur sensibles (like, comment, follow, review), pas seulement les routes publiques
- [ ] **Headers de sécurité** — Content-Security-Policy, X-Frame-Options, HSTS via middleware Next.js

### Modération & abus
- [ ] **Signalement de contenu** — bouton "Signaler" sur les reviews et commentaires, file de modération admin
- [ ] **Blocage d'utilisateurs** — bloquer un user retire ses events du feed et cache son profil
- [ ] **Panel admin** — dashboard liste des signalements, actions ban/warn/delete

---

## V2 — Découverte & recommandations

Une fois qu'il y a assez de données.

- [ ] **Recommandations ML** — matrix factorization (SVD/ALS) ou user-based CF sur ratings + follows + saves
- [ ] **Listes thématiques UGC** — *"Best of 2024"*, *"Albums pluvieux"* (à la Letterboxd) — créer, partager, commenter
- [ ] **Stats avancées** — graphes par année / genre / artiste, distribution des notes, tendances temporelles
- [ ] **Profils "critiques"** — score de crédibilité basé sur cohérence des notes et ancienneté

---

## V2 — Design system

- [ ] **Refonte design & UX** — passer par une session dédiée avec un agent spécialisé : tokens de couleur, typographie, espacement, composants cohérents
- [ ] **Dark / light mode** — bascule dans les paramètres, respect du `prefers-color-scheme`
- [ ] **Design system complet** — documenter les composants de base (boutons, cartes, modals, toasts) pour accélérer les développements futurs

---

## V2 — Croissance

- [ ] **Notifications email** — opt-in, fréquence max hebdo (Resend ou Postmark) — digest des activités, nouvelles recommendations
- [ ] **Programme bêta invité** — codes d'invitation pour contrôler la croissance et qualifier les premiers utilisateurs

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
- [x] Confirmation email à l'inscription
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
