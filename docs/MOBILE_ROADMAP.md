# Waveform Mobile — Roadmap & Checklist

Application mobile native (React Native / Expo) partageant le même backend Supabase que la version web.

---

## Contexte technique

- **Framework** : Expo (pas React Native CLI)
- **Routing** : Expo Router (file-based, quasi-identique au App Router Next.js)
- **Styles** : NativeWind (Tailwind pour React Native)
- **Auth** : Supabase JS client + `expo-secure-store` pour la persistance de session
- **Build** : EAS Build (compilation cloud, pas besoin de Mac au quotidien)
- **Distribution test** : TestFlight (iOS) + APK direct (Android)
- **Soumission** : EAS Submit → App Store / Google Play
- **Backend** : Supabase (même instance que le web) + Supabase Edge Functions pour les secrets (Spotify, Last.fm)

---

## Phase 1 — Préparation du repo

- [x] Restructurer en monorepo :
  - [x] Déplacer `frontend/` → `apps/web/`
  - [x] Créer `apps/mobile/` avec `npx create-expo-app`
  - [x] Créer `packages/db/` avec les types Supabase partagés (`types/database.ts`)
  - [x] Mettre en place `npm workspaces` dans le `package.json` racine
- [x] Vérifier que le web tourne toujours après la restructuration (`npm run dev`)
- [x] Mettre à jour la config Vercel (Root Directory : `apps/web`)
- [x] Vérifier que Vercel redéploie correctement

---

## Phase 2 — Setup Expo

- [x] Installer et configurer **NativeWind** dans `apps/mobile/`
- [x] Configurer **Expo Router** (file-based routing)
- [x] Connecter **Supabase** :
  - [x] Installer `@supabase/supabase-js` + `expo-secure-store`
  - [x] Créer le client Supabase mobile avec persistance de session
- [x] Configurer **EAS Build** :
  - [x] Créer `eas.json` (profils development / preview / production)
  - [x] Lier au compte Expo
  - [x] Configurer Apple Developer account (99$/an)
- [x] Faire un premier build vide pour valider le pipeline (✓ build iOS simulator + Android APK)
- [x] Vérifier que l'app vide tourne sur les deux téléphones (✓ Android émulateur validé, iPhone dès confirmation Apple)

---

## Phase 3 — Auth

- [x] Écran de login (email + password)
- [x] Écran de signup
- [x] Gestion de la session Supabase (persistance avec SecureStore)
- [x] Redirection automatique si connecté → home
- [x] Redirection automatique si déconnecté → login
- [x] Écran de reset de mot de passe
- [x] Layout authentifié vs non-authentifié
- [x] Tester le flow complet login → session persistante après fermeture de l'app

---

## Phase 4 — Navigation et layout

- [x] Structure de navigation principale (tabs du bas) en reference au Bottom Navbar du web :
  - [x] Tab Decouvir (/explore du web)
  - [x] Tab Ajouter (/add du web)
  - [x] Tab Activité (/feed du web)
  - [x] Tab Moi (/me du web)
- [x] Ne pas autoriser la rotation d'ecran toujours verticale
- [x] Layout global (fond, couleurs, safe areas iOS/Android)
- [x] Navigation stack dans chaque tab (retour arrière)
- [x] Transitions entre pages

---

## Phase 5 — Composants de base

Briques réutilisables que tout le reste va utiliser.

- [x] `CoverImage` — avec fallback, équivalent du composant web (expo-image)
- [x] `StarRating` — notation 0–10
- [x] `Toast` — notifications éphémères
- [x] `BottomSheet` — modal qui remonte du bas (@gorhom/bottom-sheet)
- [x] `BackButton` — retour natif
- [x] `Avatar` —  avatar par défaut
- [x] `AlbumCard` — cover + titre + artiste + année
- [x] `ArtistCard` — photo + nom
- [x] `TrackCard` — titre + artiste + album
- [x] `UserCard` — avatar + username
- [x] `GenrePills` — tags genre cliquables
- [x] `StreamingLinks` — boutons Spotify / Apple Music / Deezer
- [x] `StarRating` — composant de notation interactif
- [x] Skeleton loaders (états de chargement)
- [x] `PullToRefresh` — rafraîchissement par glissement

---

## Phase 6 — Features core

Dans cet ordre, du plus important au moins important.

### 6.1 Feed
- [ ] Récupération du feed (`getMyFeed`)
- [ ] Infinite scroll
- [ ] Carte `FeedCardReviewCreated` (review album)
- [ ] Carte `FeedCardTrackReviewCreated` (review titre)
- [ ] Carte `FeedCardReviewLiked` (like review)
- [ ] Carte `FeedCardCommentCreated` (commentaire)
- [ ] Carte `FeedCardCommentReply` (réponse commentaire)
- [ ] Carte `FeedCardUserFollowed` (nouveau follower)
- [ ] Carte `FeedCardUnratedListen` (écoute sans note)
- [ ] Like sur une entrée
- [ ] Ajout de commentaire

### 6.2 Recherche
- [ ] Barre de recherche globale (overlay ou page dédiée)
- [ ] Recherche interne Supabase (albums, artistes, titres)
- [ ] Recherche MusicBrainz en arrière-plan
- [ ] Affichage des résultats unifiés
- [ ] Recherches récentes (local)
- [ ] Autocomplete

### 6.3 Page album
- [ ] Cover + titre + artiste + année + type
- [ ] Note moyenne + nombre de reviews
- [ ] Tracklist
- [ ] Section "Ma review" (noter + écrire)
- [ ] Reviews du réseau
- [ ] Genres
- [ ] Description (Last.fm / Wikipedia)
- [ ] Liens streaming (Spotify, Apple Music, Deezer)
- [ ] Bouton "Ajouter à une liste"
- [ ] Albums similaires
- [ ] Lien vers la page artiste

### 6.4 Ajouter une écoute
- [ ] Rechercher un album ou titre
- [ ] Sélectionner l'album/titre
- [ ] Choisir une note (0–10)
- [ ] Écrire une review (optionnel)
- [ ] Sélectionner une liste (optionnel)
- [ ] Soumettre → import depuis MB si nécessaire + fan-out feed
- [ ] Ré-écoute (si déjà une entrée existante)

### 6.5 Page artiste
- [ ] Photo + nom + bio
- [ ] Discographie (albums en DB + albums MB non importés)
- [ ] Stats (listeners, reviews)

### 6.6 Profil utilisateur (soi-même)
- [ ] Avatar + username + bio
- [ ] Tabs : Journal / Reviews / Titres / Listes / Stats
- [ ] Journal d'écoutes (albums)
- [ ] Journal d'écoutes (titres)
- [ ] Reviews
- [ ] Top 3 albums favoris
- [ ] Listes créées
- [ ] Stats d'écoute

### 6.7 Profil public
- [ ] Même structure que le profil perso mais en lecture
- [ ] Bouton Follow / Unfollow
- [ ] Nombre de followers / following
- [ ] Page followers
- [ ] Page following

---

## Phase 7 — Features secondaires

- [ ] **Explore** :
  - [ ] Tendances de la semaine
  - [ ] Section "Pour toi"
  - [ ] Découverte (algo suggestions)
  - [ ] Curator picks
  - [ ] Users similaires
- [ ] **Listes** :
  - [ ] Créer une liste
  - [ ] Ajouter / retirer un album
  - [ ] Cover personnalisée
  - [ ] Page détail liste
  - [ ] Likes sur les listes
- [ ] **Stats** (`/me/stats`) :
  - [ ] Albums écoutés par mois
  - [ ] Distribution des notes
  - [ ] Genres les plus écoutés
  - [ ] Angles morts (artistes peu explorés)
- [ ] **Social** :
  - [ ] Recommander un album à un ami
  - [ ] Notifications (like, commentaire, follow, reco)
- [ ] **Settings** :
  - [ ] Modifier bio / username
  - [ ] Changer d'avatar
  - [ ] Modifier les 3 albums favoris
  - [ ] Export des données
  - [ ] Supprimer le compte

---

## Phase 8 — Backend mobile

Les secrets (Spotify, Last.fm) ne peuvent pas être exposés dans l'app. Ils passent par **Supabase Edge Functions** (remplaçant de `/api/enrich`).

- [ ] Créer la Edge Function `enrich-album` :
  - [ ] Reprendre la logique de `frontend/app/api/enrich/route.ts` + `actions/metadata.ts`
  - [ ] Gérer les secrets via les variables d'env Supabase
  - [ ] Tester depuis l'app mobile
- [ ] Brancher `EnrichmentPoller` mobile sur la Edge Function
- [ ] Vérifier que l'enrichissement (genres, description, liens streaming) fonctionne après import

---

## Phase 9 — Polish natif

C'est là que l'app passe de "ça marche" à "c'est vraiment natif".

- [ ] **Animations** avec Reanimated :
  - [ ] Transitions entre pages
  - [ ] Press feedback sur les cartes
  - [ ] Animations du BottomSheet
- [ ] **Gestes** avec Gesture Handler :
  - [ ] Swipe pour revenir en arrière
  - [ ] Pull-to-refresh
  - [ ] Swipe sur les cartes du feed
- [ ] **Haptics** :
  - [ ] Vibration légère sur like
  - [ ] Vibration légère sur submit
- [ ] **Clavier** :
  - [ ] `KeyboardAvoidingView` sur les formulaires
  - [ ] Dismiss clavier au tap en dehors
- [ ] **Safe areas** iOS (notch, Dynamic Island, home indicator)
- [ ] **Dark mode** (si thème unique non décidé)
- [ ] Icône d'app + splash screen
- [ ] Tester sur iPhone physique via TestFlight
- [ ] Tester sur Android physique via APK

---

## Phase 10 — Soumission App Store

- [ ] **Préparation** :
  - [ ] Captures d'écran aux tailles obligatoires (6.7", 6.1", iPad si nécessaire)
  - [ ] Description de l'app (FR + EN)
  - [ ] Mots-clés App Store
  - [ ] Catégorie : Music
  - [ ] Politique de confidentialité (URL obligatoire)
  - [ ] Notes de confidentialité (Data practices dans App Store Connect)
- [ ] **Build final** :
  - [ ] `eas build --platform ios --profile production`
  - [ ] Vérifier le build sur TestFlight
  - [ ] Tests finaux sur vrais appareils
- [ ] **Soumission** :
  - [ ] `eas submit --platform ios`
  - [ ] Remplir les infos dans App Store Connect
  - [ ] Soumettre pour review Apple (délai : 1–3 jours en général)
  - [ ] Répondre aux éventuelles demandes de clarification Apple
- [ ] **Google Play** (si Android aussi) :
  - [ ] `eas build --platform android --profile production`
  - [ ] Créer la fiche Google Play
  - [ ] `eas submit --platform android`

---

## Récapitulatif des délais estimés

| Phase | Description | Durée estimée |
|-------|-------------|---------------|
| 1 | Préparation repo (monorepo) | 1–2 jours |
| 2 | Setup Expo + EAS | 1–2 jours |
| 3 | Auth | 2–3 jours |
| 4 | Navigation & layout | 2–3 jours |
| 5 | Composants de base | 3–5 jours |
| 6 | Features core | 2–3 semaines |
| 7 | Features secondaires | 1–2 semaines |
| 8 | Backend Edge Functions | 2–3 jours |
| 9 | Polish natif | 1–2 semaines |
| 10 | Soumission App Store | 1 semaine |
| **Total** | | **~2–3 mois** |

---

## Décisions techniques prises

- **Expo** (pas React Native CLI) — pas besoin de toucher à Xcode au quotidien
- **EAS Build** — compilation iOS dans le cloud, pas besoin de Mac
- **Pas de Capacitor** — app vraiment native, pas un WebView
- **NativeWind** — Tailwind pour React Native, syntaxe identique au web
- **Monorepo** — un seul repo pour web + mobile, types Supabase partagés dans `packages/db/`
- **Même backend Supabase** — RLS gère la sécurité, pas besoin de dupliquer
- **Supabase Edge Functions** pour Spotify + Last.fm — secrets jamais exposés dans l'app
- **MusicBrainz, iTunes, Deezer** — APIs publiques, appelées directement depuis l'app
