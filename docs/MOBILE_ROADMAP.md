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
- [x] Récupération du feed (`getMyFeed` — onglets Pour moi/Réseau + agrégation des likes/follows/commentaires consécutifs, comme le web ; regroupement des écoutes/likes rapprochés en carte dépliable [ListenGroup/LikeGroup] porté dans `components/feed/groupFeedEvents.ts`)
- [x] Infinite scroll
- [x] Carte `FeedCardReviewCreated` (review album)
- [x] Carte `FeedCardTrackReviewCreated` (review titre)
- [x] Carte `FeedCardReviewLiked` (like review album)
- [x] Carte `FeedCardTrackReviewLiked` (like review titre)
- [x] Carte `FeedCardCommentCreated` (commentaire album)
- [x] Carte `FeedCardTrackCommentCreated` (commentaire titre)
- [x] Carte `FeedCardCommentReply` (réponse commentaire)
- [x] Carte `FeedCardUserFollowed` (nouveau follower)
- [x] Carte `FeedCardUnratedListen` (écoute sans note)
- [x] Like sur une entrée
- [x] Ajout de commentaire

### 6.2 Recherche
- [x] Barre de recherche globale (SearchOverlay) sur decouverte
- [x] Recherche interne Supabase (albums, artistes, titres)
- [x] Recherche MusicBrainz en arrière-plan
- [x] Affichage des résultats unifiés
- [x] Recherches récentes (local)
- [x] Autocomplete (recherche live au fil de la frappe, debounce 300ms — comme le web)

Note : les pages album (6.3), titre (6.3bis), artiste (6.5) et profil (6.7, `/u/[username]`)
existent désormais — le tap sur un résultat de recherche interne (déjà en DB) navigue vers
`/albums/[id]`, `/tracks/[id]`, `/artists/[id]` ou `/u/[username]`. Les résultats MusicBrainz
non encore en DB (albums/titres/artistes) déclenchent l'import via l'Edge Function
`import-musicbrainz` (Phase 8) puis naviguent directement vers la page créée — même flux
qu'en web. Pas de branche import pour les profils : la recherche de profils est
Supabase-only (pas de source MusicBrainz pour un compte utilisateur).

### 6.3 Page album
- [x] Hero (comme sur la version web mobile)
- [x] Section "Mon ecoute"
- [x] Tracklist
- [x] Critique
- [x] Bouton "Ajouter à une liste"
- [x] Albums similaires
- [x] Du meme artiste (albums en DB + releases MusicBrainz complémentaires, cliquables pour import)

Notes de scope (mises à jour après Phase 8 — Edge Functions `import-musicbrainz` +
`enrich-album` créées, voir Phase 8) :
- **Enrichissement en tâche de fond** : `enrich-album` tourne en tâche de fond après import
  (voir 6.2 et Phase 8). Si la page se charge avant que ça finisse (genres/liens absents), un
  petit polling local (pas de Realtime Supabase — aucun usage existant dans ce projet, jugé
  disproportionné pour ce besoin ponctuel) réinterroge `album_genres`/`album_metadata` toutes
  les 3s pendant 15s max, et met à jour l'affichage dès qu'une donnée apparaît — sans action de
  l'utilisateur. Le pull-to-refresh reste disponible en secours. La description
  (`album_metadata.description`/`description_src`) n'est en revanche pas encore lue/affichée
  sur cette page mobile (seuls genres + liens streaming le sont) — à ajouter séparément si besoin.
- **"Du même artiste" cliquable pour import** : la section fusionne désormais albums DB +
  releases MusicBrainz complémentaires (`getArtistReleases`, même dédup par mbid/clé
  canonique que la page artiste) ; le tap sur une release MB déclenche l'import via
  `import-musicbrainz` (`lib/useMusicBrainzImport.ts`, réutilisé par `ArtistDiscographySection`)
  puis navigue directement vers la page créée. La page album elle-même reste atteignable
  uniquement pour des albums déjà en DB ou importés via cette section ou la recherche (pas
  d'`ImportButton` dédié en haut de la page pour un mbid passé en paramètre d'URL).
- **Fanout feed pour les écoutes** : `upsertDiaryEntry`/`deleteDiaryEntry` (albums) et
  `upsertTrackDiaryEntry`/`deleteTrackDiaryEntry` (titres) passent désormais par l'Edge
  Function `log-listen` (`supabase/functions/log-listen`, déployée), miroir de
  `upsertDiaryEntry`/`upsertTrackDiaryEntry`/`deleteDiaryEntry`/`deleteTrackDiaryEntry`
  (web) — écriture RLS + fanout `feed_events` vers les abonnés, même pattern que
  `toggle-like`. `updateDiaryEntry` (modifier une note déjà enregistrée) reste un appel
  direct : le web ne fanout pas non plus sur l'édition simple.
- **Date d'écoute éditable** : `DatePickerField` (`components/ui/DatePickerField.tsx`) branché
  sur `@react-native-community/datetimepicker` (picker natif, pas `@expo/ui/community/
  datetime-picker` — crash Android confirmé sur ce composant, github.com/expo/expo/issues/39424,
  même prudence que pour le BottomSheet). Utilisé dans `DiaryEntryBottomSheet` et
  `TrackDiaryBottomSheet` — création ET édition permettent maintenant de choisir la date,
  comme sur le web (max = aujourd'hui).
- **Listes** : `lib/lists.ts` mobile n'est qu'un sous-ensemble minimal (get/toggle/liste par
  défaut) pour le bouton "Ajouter à une liste" — la Phase 7 (créer une liste, réordonner,
  couverture personnalisée) reste à faire.
- Seule `/lists/[id]` référencée depuis cette page n'existe pas encore (Phase 7) — les
  liens vers cette page affichent "Bientôt disponible", comme documenté en 6.2.
  `/artists/[id]`, `/diary/[id]`/`/track-diary/[id]`, `/u/[username]` existent désormais
  (6.5, 6.7bis, 6.7).

### 6.3bis Page titre (non prévue initialement — ajoutée car quasi identique à 6.3)
- [x] Hero (cover album, titre, artiste(s), lien album · année, genres hérités de l'album)
- [x] Section "Mon écoute"
- [x] Bouton "Ajouter à une liste"
- [x] Autres titres de l'album
- [x] Critiques
- [x] Plus de cet artiste (albums)

Mêmes notes de scope que 6.3 (mode dégradé Phase 8) : `lib/trackDiary.ts` n'a pas de
fanout feed, `lib/tracks.ts`/`lib/trackDiary.ts` n'importent rien depuis MusicBrainz. La
recherche (SearchOverlay) navigue désormais aussi vers `/tracks/[id]` pour les résultats
titres déjà en DB (miroir du branchement fait pour les albums en 6.3).

### 6.4 Page Ajouter
- [x] Pile de cartes swipeable (`AddQueueMobile`, miroir de la version mobile web
      `AddQueueMobile.tsx` — pas le layout desktop de `/add`, qui a un formulaire
      classique + file latérale distincts et hors scope ici)
- [x] Note (StarRating 0–10) + bouton "Écrire une critique" (déplie un textarea
      inline sur la carte)
- [x] Swipe horizontal (seuil 120px, react-native-gesture-handler + Reanimated) ou
      bouton Suivant/Passer pour avancer — la note n'est envoyée qu'à l'avancée
      (fire-and-forget, jamais bloquant), comme le web
- [x] Recherche compacte inline ("Chercher un album"/"Chercher un titre") qui
      réduit la carte courante en mini-carte ; sélection insère l'item en tête de
      file sans notation immédiate
- [x] État de fin de file (éventail des dernières pochettes notées + lien vers
      Découvrir)
- [x] Toujours `listenedAt = aujourd'hui` (pas de date picker sur cette page,
      comme le web)

Notes de scope :
- **Mode dégradé Phase 7** : `buildAddQueue.ts` (mirroré tel quel dans
  `lib/buildAddQueue.ts`) fusionne 4 tiers en tourniquet ; les tiers "Suggestion
  pour toi" et "À découvrir" (`getForYouSuggestions`/`getForYouTracks`/
  `getDiscoveryAlbums`, Phase 7 "Explore" — pas commencée côté mobile) sont
  passés en tableaux vides depuis `app/(tabs)/add/index.tsx`. La file ne
  contient donc pour l'instant que les tiers "Ajouté jamais noté" (`lib/lists.ts`
  → `getUnratedSavedItems`, nouvellement porté), "Depuis ta liste"
  (`getDefaultListAlbums`/`getDefaultListTracks`, nouvellement portés) et
  "Pour démarrer" (`lib/classicAlbums.ts`, copié tel quel). `buildAddQueue`
  n'aura rien à changer quand Phase 7 branchera les vraies données — il suffira
  de remplacer les tableaux vides.
- **Import MusicBrainz sans navigation** : la recherche inline de la queue
  n'utilise pas les hooks `useMusicBrainzAlbumImport`/`useMusicBrainzArtistImport`
  (`lib/useMusicBrainzImport.ts`, 6.5) car ceux-ci naviguent systématiquement vers
  la page créée après import — ici on veut au contraire insérer l'item dans la
  file et rester sur l'écran. Le composant appelle donc directement l'Edge
  Function `import-musicbrainz` (même endpoint, mêmes payloads `kind: 'album'`/
  `kind: 'track'` que `SearchOverlay`), sans redévelopper la logique d'import.
- **File reconstruite une fois par visite** : comme le web (RSC, un seul fetch
  par chargement de page), `app/(tabs)/add/index.tsx` construit la file une
  seule fois au montage de l'écran, pas à chaque retour sur l'onglet — l'état
  de progression dans la pile (index, pochettes notées) vit ensuite entièrement
  dans `AddQueueMobile`.
- **Animations simplifiées** : le swipe (translateX + rotation, seuil 120px) et
  la pile de peek-cards (offsets fixes, miroir de `PEEK_STYLES`/`FAN_STYLES` du
  web) sont portés avec `react-native-gesture-handler` + `Reanimated`, déjà
  utilisés ailleurs (BottomNav). Certaines transitions du web reposant sur
  `framer-motion` (`AnimatePresence mode="wait"`, layout crossfade entre les
  vues carte/commentaire/recherche, flou d'arrière-plan des badges) sont
  simplifiées en changements d'état directs (pas de lib d'équivalent élégant
  installée) — fonctionnellement identique, visuellement plus abrupt.
- **Risque de conflit de geste à vérifier sur device** : l'onglet Ajouter vit
  dans le `TopTabs` swipeable de `(tabs)/_layout.tsx` (navigation horizontale
  entre onglets). Le geste de swipe de carte utilise `activeOffsetX` pour capter
  le pan horizontal en priorité, ce qui devrait suffire (résolution de gestes
  imbriqués de RNGH), mais n'a pas été testé sur appareil physique — à valider
  qu'un swipe sur la carte ne déclenche pas accidentellement un changement
  d'onglet (ou l'inverse).
- Pas de `KeyboardAvoidingView` testé en conditions réelles avec le textarea de
  critique inline — comportement à valider sur device (iOS `padding` / Android
  `height`, même pattern que `BottomSheet.tsx`).

### 6.5 Page artiste
- [x] Photo + nom (photo lue en DB uniquement — voir note de scope)
- [x] Activité réseau (qui dans mon réseau a écouté cet artiste — albums + titres)
- [x] Stats (auditeurs uniques, note moyenne, critiques — albums + titres fusionnés)
- [x] Populaires (top 3 albums par auditeurs)
- [x] Discographie (albums en DB + albums MB non importés, cliquables pour import)
- [x] Apparaît sur (albums crédités en featuring, album OU piste, dédupliqués par album)
- [x] Artistes similaires (via l'Edge Function `similar-artists` — voir note de scope)

Notes de scope (Phase 8 backend mobile non faite au moment de l'implémentation) :
- **Photo en mode dégradé** : `getOrFetchArtistMeta` (web) fetch MusicBrainz/Wikidata et écrit
  le cache via le client admin (service_role) si l'artiste n'a pas encore de photo — jamais
  exposable côté mobile. La page mobile lit `artists.image_url` tel quel, avec fallback sur
  la première cover d'album trouvée en DB (lecture seule), sans déclencher de nouvelle
  recherche ni écriture. Même dégradation que 6.3/6.3bis.
- **Discographie cliquable pour import** : les releases MusicBrainz non encore en DB sont
  affichées (API publique, comme le web) et déclenchent désormais l'import via l'Edge Function
  `import-musicbrainz` au tap (`lib/useMusicBrainzImport.ts`), avec spinner sur la cover pendant
  l'import puis navigation directe vers la page créée — même flux que la recherche globale (6.2)
  et "Du même artiste" (6.3).
- **Artistes similaires** : `getSimilarArtists` (web) appelle l'API Last.fm avec
  `LASTFM_API_KEY`, un secret serveur jamais exposable côté mobile. Portée via la nouvelle
  Edge Function `similar-artists` (supabase/functions/similar-artists), qui reprend la même
  logique (matching DB par MBID/nom, max 6, DB en priorité) — appelée depuis
  `lib/artists.ts` (`getSimilarArtists`). **Divergence volontaire du web** : le web
  n'affiche jamais un artiste similaire hors DB (`ArtistPageContent.tsx` filtre `id !== null`
  avant rendu) ; le mobile les affiche aussi et les rend cliquables quand un mbid est
  disponible (`ArtistSimilarSection` + `lib/useMusicBrainzImport.ts` — `useMusicBrainzArtistImport`),
  déclenchant l'import via `import-musicbrainz` au tap puis la navigation vers la page créée.
  Un artiste similaire sans mbid (Last.fm ne l'a pas fourni) reste masqué, faute de moyen de
  l'importer.
- Navigation `/artists/[id]` déjà référencée depuis AlbumHero, TrackHero, ArtistCard et la
  page titre (6.3/6.3bis) — ces liens menaient à un 404 jusqu'ici ; la route existe désormais.
  La recherche (SearchOverlay) navigue aussi vers `/artists/[id]` pour les résultats artiste
  déjà en DB (miroir du branchement fait pour albums/titres en 6.2).


### 6.6 Profil utilisateur (soi-même)
- [x] Avatar + username + bio
- [x] Top 3 albums favoris (affichage seul — voir note de scope)
- [x] Stats d'écoute (mini-ligne critiques/abonnés/suivis + histogramme des notes)
- [x] Tabs : Mon journal / Critiques / Listes (3 onglets réels, comme le web — "Titres" n'est
      pas un onglet séparé, c'est un toggle Albums/Titres à l'intérieur de l'onglet journal)
- [x] Journal d'écoutes (albums)
- [x] Journal d'écoutes (titres)
- [x] Critiques (unifiées albums + titres, like fonctionnel)
- [x] Listes (affichage seul — voir note de scope)

### 6.7 Profil public
- [x] Même structure que le profil perso mais en lecture (3 mêmes onglets — PublicProfileTabs
      web a aussi un onglet Listes, contrairement à ce que laissait supposer le nom)
- [x] Bouton Follow / Unfollow
- [x] Nombre de followers / following
- [x] Page followers
- [x] Page following
- [x] Menu 3 points (bloquer/débloquer) — ProfileActionsMenu
- [x] Écran "utilisateur bloqué" (contenu masqué, mêmes conditions que le web)

Notes de scope (6.6 + 6.7) :
- **Follow/unfollow avec fanout** : `toggleFollow` (web) écrit `feed_events` (fanout vers
  l'acteur + backfill des écoutes récentes du suivi) via `createSupabaseAdmin()` — même
  famille que `toggle-like`/`log-listen` (Phase 8), jamais exposable côté mobile. Portée
  via une nouvelle Edge Function `toggle-follow` (`supabase/functions/toggle-follow`),
  qui reprend exactement la même logique (insert/delete `follows`, purge + insert
  `feed_events`, backfill des dernières écoutes du suivi) — appelée depuis
  `lib/social.ts` (`toggleFollow`). Déployée : `supabase functions deploy toggle-follow`
  (pas de nouveau secret requis).
- **Bloquer/débloquer en mode dégradé** : `toggleBlock` (web) nettoie aussi les
  `feed_events` de l'utilisateur bloqué via le client admin. Ce nettoyage est ignoré côté
  mobile (`lib/social.ts`) — sans conséquence visible puisque `getMyFeed` (`lib/feed.ts`)
  filtre déjà les acteurs bloqués à la lecture. L'insert/delete sur `follows`/`user_blocks`
  reste un appel RLS direct (permis par les policies existantes, comme côté web).
- **Top 3 albums favoris** : affichage seul (`components/profile/Top3Albums.tsx`).
  L'édition/réordonnancement (`SortableAlbumItem`, `SearchAlbumModal` côté web) reste
  Phase 7 Settings ("Modifier les 3 albums favoris") — jugé hors scope de cette passe,
  pas de valeur ajoutée à le faire en avance sans le reste des Settings.
- **Histogramme des notes avec filtre** : `RatingDistribution` mobile est cliquable et
  filtre le Journal/les Critiques, comme le web — porté via `lib/RatingFilterContext.tsx`
  (mirroir de `RatingFilterContext.tsx` web), fourni par un `RatingFilterProvider`
  englobant l'histogramme + `ProfileTabs` dans `/me` et `/u/[username]`. `DiaryList`
  reprend le même pattern optimiste que le web (filtre immédiat sur ce qui est déjà
  chargé, puis complète via une requête `getUserDiary`/`getUserTrackDiary` avec
  `ratingFilter` si l'histogramme indique qu'il manque des résultats) ; `ReviewsList`
  filtre simplement côté client (comme le web, qui charge déjà tout jusqu'à 100 par
  type sans pagination serveur).
- **Listes en lecture seule (mais y compris les sauvegardées)** : `ListsTab`/`ListCard`
  mobile n'affichent que les listes existantes (miennes + sauvegardées pour /me — via
  `getUserSavedLists`, avec le filtre Tout/Mes listes/Sauvegardées comme le web dès qu'il
  y a au moins une liste sauvegardée —, publiques uniquement pour /u/[username], le web
  ne montre pas les sauvegardées d'un autre utilisateur) avec compteur d'albums,
  couvertures et badge créateur (@username + avatar) sur les listes sauvegardées.
  Créer/renommer/supprimer une liste (`CreateListForm`/`ListCardWithMenu` côté web), la
  cover personnalisée et la page détail `/lists/[id]` restent Phase 7 ("Listes" y figure
  déjà comme non fait) — taper une liste affiche "Bientôt disponible", comme les autres
  routes manquantes déjà documentées en 6.2/6.3.
- **Page d'entrée de journal** : `/diary/[entry_id]` et `/track-diary/[entry_id]` existent
  désormais (voir 6.7bis) — mais `DiaryList`/`ReviewsList` (grilles Journal/Critiques de
  *cet* onglet Profil) naviguent encore vers `/albums/[id]`/`/tracks/[id]` plutôt que vers
  le détail d'écoute ; les repointer vers `/diary/[entry_id]`/`/track-diary/[entry_id]`
  reste à faire (hors scope de la passe 6.7bis, qui ne portait que la page de détail et le
  branchement des liens qui l'attendaient déjà — `NetworkListenersSection`, le feed,
  `ReviewsSection`/`TrackReviewsSection` sur les pages album/titre). Les cartes de
  Critiques continuent d'utiliser `FeedActions`/`CommentSheet` pour like/commentaire
  rapide en `BottomSheet` sans quitter la grille.
- **Menu hamburger (soi)** : "Éditer profil", "Albums favoris", "Mes stats", "Aide &
  support" affichent tous "Bientôt disponible" (aucun de ces écrans n'existe encore côté
  mobile) ; seule la déconnexion est fonctionnelle. Pas d'entrée "Admin" (pas de notion
  d'admin établie côté mobile pour l'instant).
- **`ensureProfile`/`getCurrentStreak`/`getOrCreateDefaultList`** portés tels quels
  (100% RLS, déjà confirmé sans usage admin caché) — `apps/mobile/lib/profile.ts`.
- Navigation `/u/[username]` déjà référencée depuis `UserCard` (mobile) et
  `NetworkListenersSection` (6.3/6.5) — ces liens menaient à un 404 jusqu'ici ; la route
  existe désormais (`app/u/[username]/index.tsx` + `followers.tsx` + `following.tsx`).

### 6.7bis Page détail d'une écoute (non prévue initialement — ajoutée car de nombreux
liens déjà posés côté mobile pointaient dessus sans destination)
- [x] `/diary/[entry_id]` — détail d'une écoute album (hero, bloc critique, like, fil de
      réponses)
- [x] `/track-diary/[entry_id]` — détail d'une écoute titre (quasi identique, comme
      6.3/6.3bis pour album/titre)
- [x] Hero (cover, titre album/titre, artiste(s) + featuring, année ; titre lien vers
      `/albums/[id]` ou `/tracks/[id]`)
- [x] Bloc critique (auteur, note /10 en grand, texte de review, badge "ré-écoute" sur
      les albums)
- [x] Like + `LikesBottomSheet` (liste des personnes ayant aimé)
- [x] Partager (`Share.share` natif) / Copier le lien (`expo-clipboard`)
- [x] Menu "···" Modifier/Supprimer pour l'auteur (réutilise `AlbumEntryMenu`/
      `TrackEntryMenu` + `DiaryEntryBottomSheet`/`TrackDiaryBottomSheet`, déjà construits
      en 6.3/6.3bis — aucun nouveau champ d'édition)
- [x] Signaler pour un non-auteur (`lib/moderation.ts`, nouveau)
- [x] Fil de réponses avec réponses imbriquées (1 niveau, comme le web) — nouveau
      composant `components/social/CommentThread.tsx`
- [x] CTA "Continuer la lecture" vers les critiques de l'album/du titre (navigue vers
      `/albums/[id]`/`/tracks/[id]` — pas d'ancre `#reviews`, qui n'a pas de sens en
      navigation native)

Notes de scope :
- **RLS vérifiée avant de coder** : `diary_comments`/`track_diary_comments` ont bien une
  policy `DELETE` `auth.uid() = user_id` (confirmé via `supabase db query` sur le projet
  lié) — `deleteComment`/`deleteTrackComment` (`lib/feed.ts`) sont donc de simples appels
  RLS directs, pas d'Edge Function ni de client admin nécessaires (contrairement à
  `deleteComment` côté web, qui utilise `createSupabaseAdmin()` par commodité plutôt que
  par nécessité RLS réelle).
- **Réponses aux commentaires en mode dégradé (comme l'ajout de premier niveau, déjà
  acté en Phase 8)** : `addComment`/`addTrackComment` (`lib/feed.ts`) acceptent
  désormais un `parentCommentId` optionnel (1 seul niveau de nesting, comme le web) mais
  ne fanoutent aucune notification — même dégradation déjà documentée pour l'ajout de
  premier niveau, simplement étendue aux réponses.
- **Lecture d'une entrée + ses commentaires** : `getDiaryEntry`/`getEntryComments`
  (`lib/diary.ts`) et `getTrackDiaryEntry`/`getTrackEntryComments` (`lib/trackDiary.ts`)
  sont 100% RLS (confirmé, comme le web) — la policy `SELECT` de `diary_entries`/
  `track_diary_entries` filtre déjà public/propriétaire, donc pas besoin de revérifier la
  visibilité côté client comme le fait le web par défense en profondeur.
- **Signalement (`reportContent`, `lib/moderation.ts`, nouveau)** : écriture directe RLS
  (`content_reports` a une policy `INSERT` `reporter_id = auth.uid()`, confirmée) — pas
  de rate-limit ici, ce garde-fou reste côté serveur tant que la mobile n'a pas d'Edge
  Function équivalente (Phase 8).
- **`LikesBottomSheet` mobile (nouveau)** : `getEntryLikes`/`getTrackEntryLikes`
  (nouveaux, `lib/diary.ts`/`lib/trackDiary.ts`) lisent `diary_likes`/`track_diary_likes`
  directement (policy `SELECT` déjà scoping visible/owner) puis les profils associés —
  même pattern que `NetworkListenersSection`.
- **Menu "···" étendu plutôt que recréé** : Partager/Copier le lien/Signaler sont des
  boutons icône séparés à côté du menu Modifier/Supprimer existant (`AlbumEntryMenu`/
  `TrackEntryMenu`, inchangés) plutôt que fusionnés dans un seul dropdown comme le web —
  ces composants sont déjà utilisés ailleurs (`MyListenSection`/`TrackMyListenSection`)
  uniquement pour l'auteur, les y ajouter aurait changé leur contrat pour un besoin qui
  ne concerne que cette page.
- **`expo-clipboard` ajouté** aux dépendances (`npx expo install expo-clipboard`) — la
  seule nouvelle dépendance de cette passe.
- Voir la note mise à jour en 6.6/6.7 : les grilles Journal/Critiques du Profil ne
  pointent pas encore vers ces nouvelles pages (scope non demandé pour cette passe).

---

## Phase 7 — Features secondaires

- [x] **Explore** :
  - [x] Section "Pour toi" (albums + titres, dismiss "Pas pour moi" optimiste)
  - [x] Curator picks
  - [x] Tendances de la semaine
  - [x] Découverte
  - [x] Users similaires
  - [x] Listes populaires (section bonus, absente du checklist d'origine — présente
        sur le web via `CommunityListsSection`, inline dans `app/explore/page.tsx`)

Notes de scope :
- **Onboarding non porté (décision de scope explicite)** : le web fait un hard
  redirect vers `/onboarding` (choix de username, comptes suggérés à suivre) si
  `userNeedsOnboarding` — ce flow complet n'existe pas côté mobile et n'est dans
  aucune phase du roadmap ; hors scope de cette passe. Seul `getProfileTier()`
  (`lib/explore.ts`, 100% RLS, seuil de 3 entrées de journal comme le web) est
  repris pour l'affichage conditionnel déjà présent sur la page elle-même :
  `OnboardingCTASection` (nouveau, `components/auth/`) affichée à la place de
  "Pour toi" si `tier === 'new'`, "Pour toi"/"Users similaires" masqués si pas
  `'established'` — exactement le même comportement que le web une fois le
  redirect retiré.
- **Tout porté sans dégradation** (contrairement à 6.4 où "Pour toi"/"Découverte"
  avaient été passés en tableaux vides) : `getTrendingThisWeek`, `getForYouSuggestions`
  (fallback Jaccard inclus), `getForYouTracks` (idem), `getDiscoveryAlbums` (modes
  "bubble"/"discover"), `getSimilarUsers`, `getCuratorPick`, `getTrendingTracks`,
  `getPublicLists` sont tous 100% lectures RLS/anon — confirmé avant de coder,
  aucune Edge Function nécessaire pour cette page. Nouveaux fichiers :
  `lib/explore.ts`, `lib/curator.ts` ; `getTrendingTracks`/`TrackWithStats` ajoutés
  à `lib/trackDiary.ts` (n'existaient pas encore côté mobile) ; `getPublicLists`
  ajouté à `lib/lists.ts` (miroir simplifié, sans `is_saved` — `ListCard` mobile
  n'a pas de bouton sauvegarder pour l'instant).
- **`buildAddQueue.ts` (6.4) peut maintenant être branché sur les vraies données** :
  les tiers "Suggestion pour toi"/"À découvrir" de la page Ajouter étaient en
  tableaux vides en attendant cette phase — `getForYouSuggestions`/`getForYouTracks`/
  `getDiscoveryAlbums` existent désormais côté mobile, mais le branchement dans
  `app/(tabs)/add/index.tsx` n'a pas été refait dans cette passe (pas demandé) :
  à faire séparément si besoin.
- **3 écrans, dans l'onglet `(tabs)/explore/`** : `index.tsx` (page principale),
  `tendances.tsx` et `decouverte.tsx` (pages "voir tout", 20/24 items) — poussées
  dans le `Stack` déjà existant de cet onglet plutôt qu'en pile plein écran hors
  `(tabs)`, comme le web les traite en pages secondaires classiques avec
  `BackButton`.
- **"Listes populaires" réutilise `components/profile/ListCard.tsx`** (déjà
  construit en 6.6/6.7) plutôt que d'en dupliquer un ; le tap sur "voir tout"
  affiche un toast "Bientôt disponible" (comme le tap sur une liste individuelle)
  puisque ni `/lists` ni `/lists/[id]` n'existent encore côté mobile (Phase 7
  "Listes" séparée, pas commencée).
- **Cartes avec bouton "Pas pour moi" non fusionnées dans `AlbumCard`/`TrackCard`**
  existants : ce contrat (bouton de dismiss superposé à la cover) est spécifique
  aux sections de recommandations et aurait changé le contrat de composants déjà
  utilisés ailleurs sans lien avec les recos — `PourToiSection`/`DiscoverCard`
  définissent leur propre petite cellule de cover, comme `DiscoverCard`/`AlbumCard`
  (web) le font déjà séparément l'un de l'autre.
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
- [ ] **Settings** :
  - [ ] Modifier bio / username
  - [ ] Changer d'avatar
  - [ ] Modifier les 3 albums favoris
  - [ ] Export des données
  - [ ] Supprimer le compte

---

## Phase 8 — Backend mobile

Les secrets (Spotify, Last.fm) ne peuvent pas être exposés dans l'app. Ils passent par **Supabase Edge Functions** (remplaçant de `/api/enrich`).

- [x] Créer la Edge Function `import-musicbrainz` (`supabase/functions/import-musicbrainz/`) :
  - [x] Reprendre `importAlbumFromMusicBrainz` / `importArtistFromMusicBrainz` /
        `importTrackFromMusicBrainz` (`apps/web/app/actions/musicbrainz.ts`) à l'identique
  - [x] Client user-scope (RLS) pour les écritures albums/artistes/tracks, client service_role
        uniquement pour l'upload cover + `album_featured_artists`/`track_featured_artists`
        (mêmes usages qu'en web, rien de plus exposé)
  - [x] Brancher `SearchOverlay` mobile dessus (clic sur un résultat MusicBrainz non importé →
        import → navigation directe, comme le web)
- [x] Créer la Edge Function `enrich-album` (`supabase/functions/enrich-album/`) :
  - [x] Reprendre la logique de `apps/web/app/api/enrich/route.ts` + `actions/metadata.ts`
        (liens streaming + genres/tags + description — le mobile peut se permettre le pipeline
        complet à chaque import, contrairement au web qui ne déclenche que les liens pour ne
        pas exploser le quota CPU Vercel)
  - [x] `import-musicbrainz` déclenche automatiquement l'enrichissement en tâche de fond
        (`EdgeRuntime.waitUntil`) après chaque import d'album réussi
  - [x] Gérer les secrets via les variables d'env Supabase — **à faire manuellement** :
        `supabase secrets set SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... LASTFM_API_KEY=...`
  - [x] Déployer les deux fonctions : `supabase functions deploy import-musicbrainz` et
        `supabase functions deploy enrich-album`
  - [x] Tester depuis l'app mobile (import d'un album/titre/artiste pas encore en DB, vérifier
        que `album_metadata`/`genres`/`album_genres` se remplissent après quelques secondes)
- [x] Créer la Edge Function `similar-artists` (`supabase/functions/similar-artists/`) :
  - [x] Reprendre `getSimilarArtists` (`apps/web/app/actions/artists.ts`) à l'identique
        (Last.fm `artist.getSimilar` + matching DB par MBID/nom, DB en priorité, max 6)
  - [x] Client user-scope (RLS) uniquement, aucune écriture — pas besoin de service_role
  - [x] Brancher la page artiste mobile dessus (`lib/artists.ts` → `getSimilarArtists`,
        section "Artistes similaires" affichée pour les résultats déjà en DB)
  - [x] Déployer : `supabase functions deploy similar-artists` — **LASTFM_API_KEY déjà
        configuré côté Supabase** (secret partagé avec `enrich-album`)
  - [ ] Tester depuis l'app mobile (page artiste → section "Artistes similaires" en bas)
- [x] Créer la Edge Function `log-listen` (`supabase/functions/log-listen/`) :
  - [x] Reprendre `upsertDiaryEntry`/`deleteDiaryEntry` (`apps/web/app/actions/diary.ts`) et
        `upsertTrackDiaryEntry`/`deleteTrackDiaryEntry` (`apps/web/app/actions/track-diary.ts`)
        à l'identique — validation (date, note, longueur, mots bannis), écriture RLS,
        fanout `feed_events` vers les abonnés + l'acteur (même calcul que `fanoutEvent` web)
  - [x] Une seule fonction pour albums et titres, discriminée par `kind: 'album' | 'track'`
        et `action: 'upsert' | 'delete'` — même style que `toggle-like` (`kind: 'diary' | 'track'`)
  - [x] Client user-scope (RLS) pour les écritures diary_entries/track_diary_entries, client
        service_role uniquement pour le fanout `feed_events` (mêmes usages qu'en web)
  - [x] Copié `findBannedContentWord` (`_shared/bannedWords.ts`) et
        `parseListenedAt`/`parseDiaryRating` (`_shared/diaryInputValidation.ts`) depuis leurs
        équivalents web — logique pure, portable telle quelle vers Deno
  - [x] Branché `lib/diary.ts`/`lib/trackDiary.ts` mobile dessus (`upsertDiaryEntry`,
        `deleteDiaryEntry`, `upsertTrackDiaryEntry`, `deleteTrackDiaryEntry` appellent
        désormais `supabase.functions.invoke('log-listen', ...)`) ; `updateDiaryEntry`
        (édition simple) reste un appel RLS direct, comme sur le web (pas de fanout à l'édition)
  - [x] Déployé : `supabase functions deploy log-listen`
  - [ ] Pas de rate-limiting (Upstash) ni de `logAuthedProductEvent` (analytics) côté Edge
        Function — même simplification déjà acceptée pour `toggle-like`, à revoir si abus constaté
  - [x] Tester depuis l'app mobile (noter un album/titre, vérifier que l'écoute apparaît dans
        le feed "Réseau" d'un compte qui suit l'auteur ; supprimer une écoute et vérifier que
        l'event disparaît du feed)
- [x] Pas encore branché : `EnrichmentPoller` mobile (rafraîchir l'UI albums sans re-fetch
      manuel une fois l'enrichissement en tâche de fond terminé) — `enrich-album` est déjà
      invocable indépendamment pour ce futur usage.

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
