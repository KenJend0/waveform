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
- [ ] Reset password — tester le flow complet `/auth/reset` _(bloqué : domaine custom Resend requis)_
- [x] Pagination curseur sur le feed — plus de sauts/doublons au scroll (cursor = `created_at` du dernier event)
- [x] Rate limiting sur `/api/*` — 30 req/60 s par IP via Upstash (fail-open si `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` non définis)

### SEO & partage
- [x] `generateMetadata` sur les pages dynamiques (albums, artistes, profils, reviews)
- [x] `robots.txt` — bloquer `/api/*`, `/settings/*`, `/me/*`, `/auth/*`, `/onboarding/*`, `/add`
- [x] `sitemap.xml` — pages statiques indexables (`/`, `/search`)

---

## V1 — Produit complet

Ce qui rend l'app vraiment utilisable au quotidien.

### Feed & social
- [ ] Agrégation des événements — *"Mehdi, Camille et 8 autres ont aimé GUTS"* (groupBy album + event_type + time_window)
- [ ] Notifications intelligentes — pas des notifs sociales classiques, mais des nudges contextuels :
  - Reminder wishlist : *"X est dans ta liste depuis 3 semaines, tu l'as écouté ?"* (cron hebdo)
  - Convergence sociale : *"3 personnes que tu suis ont tous écouté X cette semaine"* (lié à l'agrégation du feed)
  - Suggestions de comptes périodiques
- [ ] Liens streaming sur les pages album (Spotify, Apple Music, Deezer via MusicBrainz external URLs)
- [ ] Optimistic UI sur like / follow (supprimer le lag visible)
- [ ] Activité réseau sur les pages album — qui dans tes abonnements l'a écouté
- [ ] OG images dynamiques pour les reviews (partage Twitter/Discord)

### Discovery & Explore
- [ ] Section "Pour toi" — albums bien notés par les gens que tu suis (collaborative filtering simple, pas de ML)
- [ ] Enrichissement pages artiste/album — genres et biographies via Last.fm API (gratuite)

### Profils & stats
- [ ] Stats complètes sur le profil public (note moyenne, distribution, top artistes)
- [ ] Statuts d'écoute : "Envie d'écouter" / "En cours" / "Écouté"

### Import & données
- [ ] Import historique Last.fm (le vrai onboarding des music nerds)

---

## V2 — Croissance & profondeur

Une fois que tu as des utilisateurs actifs et de la donnée.

- [ ] Recommandations ML — matrix factorization (SVD/ALS) ou user-based CF sur ratings + follows + saves
- [ ] Listes thématiques — *"Best of 2024"*, *"Albums pluvieux"* (contenu UGC à la Letterboxd)
- [ ] Stats avancées — graphes par année / genre / artiste, distribution des notes
- [ ] Design system complet — refonte visuelle cohérente, dark/light mode
- [ ] Pages artiste enrichies — discographie complète, membres, liens entre artistes
- [ ] Profils "critiques" — score de crédibilité basé sur cohérence des notes et ancienneté
- [ ] Notifications email intelligentes — opt-in, fréquence hebdo max (Resend ou Postmark)
- [ ] Monitoring erreurs — Sentry côté client + serveur

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
