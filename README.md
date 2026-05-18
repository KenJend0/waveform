# Waveform

Journal musical social. Suis tes écoutes, note tes albums et titres, découvre ce qu'écoutent tes amis.

---

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | Next.js 15 (App Router) |
| Auth & BDD | Supabase (Postgres + Auth + Storage) |
| Styles | Tailwind CSS v4 |
| Données musicales | MusicBrainz API |
| Déploiement | Vercel |

Pas de backend custom. Tout passe par des **Server Actions** Next.js et le client Supabase côté serveur.

---

## Démarrage rapide

### Prérequis

- Node.js 20+
- Un projet Supabase (plan gratuit suffisant pour le dev)

### Installation

```bash
git clone https://github.com/KenJend0/waveform.git
cd waveform/frontend
npm install
```

### Configuration

```bash
cp .env.example .env.local
# Remplis les variables dans .env.local
```

Variables requises :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...      # serveur uniquement — ne jamais préfixer NEXT_PUBLIC_
```

Variables optionnelles :

```env
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

Sans elles, le rate limiting est désactivé (mode fail-open).

### Lancer en dev

```bash
cd frontend
npm run dev
# → http://localhost:3000
```

---

## Structure du projet

```
waveform/
├── frontend/                   # Application Next.js 15
│   ├── app/
│   │   ├── actions/            # Server Actions (logique métier)
│   │   ├── api/                # Route Handlers Next.js
│   │   ├── add/                # Ajouter une écoute (album ou titre)
│   │   ├── albums/[id]/        # Page album
│   │   ├── artists/[id]/       # Page artiste
│   │   ├── auth/               # Login / Signup
│   │   ├── diary/              # Journal + entrée détaillée
│   │   ├── explore/            # Découverte (tendances, listes, suggestions)
│   │   ├── feed/               # Fil d'activité
│   │   ├── lists/              # Listes d'albums
│   │   ├── me/                 # Profil personnel
│   │   ├── search/             # Page résultats de recherche
│   │   ├── settings/           # Paramètres & favoris
│   │   ├── tracks/[id]/        # Page titre
│   │   └── u/[username]/       # Profil public + followers/following
│   ├── components/             # Composants React
│   │   ├── avatars/            # 12 avatars SVG générés
│   │   ├── feed/cards/         # Cartes du feed par type
│   │   ├── icons/              # Icônes custom
│   │   ├── profile/            # Composants profil
│   │   └── social/             # Follow button
│   ├── lib/
│   │   ├── supabase/           # Clients Supabase (client + server)
│   │   ├── searchRanking.ts    # computeRank + mergeAndRank (partagé overlay/page)
│   │   ├── recentSearches.ts   # localStorage recent searches
│   │   ├── AuthContext.tsx     # Contexte auth global
│   │   └── ...
│   ├── types/
│   │   └── database.ts         # Types générés depuis Supabase
│   └── public/
│       ├── robots.txt
│       └── sitemap.xml
├── supabase_migrations/        # Migrations SQL à appliquer via le dashboard Supabase
│   ├── supabase_schema.sql     # Schéma de référence complet + RLS
│   ├── supabase_migration_fulltext_search.sql   # Colonnes tsvector (simple + unaccent)
│   ├── supabase_migration_trgm.sql              # pg_trgm + RPCs fuzzy search
│   ├── supabase_migration_search_cache.sql      # Cache MB 24h
│   └── ...                     # Autres migrations par feature
├── scripts/
│   ├── generate-supabase-types.sh / .ps1   # Régénère frontend/types/database.ts
│   └── refresh_discover.sh / .ps1          # Rafraîchit les items Discover
├── ml/                         # Scripts Python (recommandations, ML)
├── .gitignore
└── README.md
```

---

## Base de données

Le schéma complet est dans [`supabase_migrations/supabase_schema.sql`](supabase_migrations/supabase_schema.sql).

**Tables principales :**

| Table | Description |
|-------|-------------|
| `profiles` | Métadonnées utilisateur (username, bio, avatar) |
| `albums` | Catalogue albums, FK → `artists` |
| `artists` | Artistes |
| `tracks` | Pistes, FK → `albums` |
| `diary_entries` | Écoutes/reviews d'un user pour un album |
| `track_diary_entries` | Écoutes/reviews d'un user pour un titre |
| `diary_likes` | Likes sur les entrées |
| `diary_comments` | Commentaires sur les entrées |
| `follows` | Relations sociales |
| `feed_events` | Fil d'activité (fan-out en écriture) |
| `notifications` | Notifications (like, comment, follow, reco) |
| `saved_albums` | Albums sauvegardés |
| `user_favorite_albums` | Top 3 albums du profil (position 1–3) |
| `lists` | Listes d'albums créées par les users |
| `list_items` | Albums dans une liste |
| `recommendations` | Recommandations entre users |
| `discover_items` | Algo de découverte |
| `search_cache` | Cache des résultats MusicBrainz (24h) |

**Vue :** `album_stats` — listeners, reviews, note moyenne par album.

### RLS

Activé sur toutes les tables. Les policies sont dans `supabase_schema.sql`. Les écritures système (fan-out feed, discover) utilisent la clé service role côté serveur uniquement.

### Migrations

Les migrations sont dans `supabase_migrations/` et s'appliquent manuellement via l'éditeur SQL du dashboard Supabase. Aucun outil de migration automatique n'est utilisé.

Migrations à appliquer pour un nouveau projet (dans l'ordre) :

1. `supabase_schema.sql` — schéma de base
2. `supabase_migration_fulltext_search.sql` — recherche plein texte (nécessite l'extension `unaccent`)
3. `supabase_migration_trgm.sql` — fuzzy search via pg_trgm
4. `supabase_migration_search_cache.sql` — cache des résultats MB
5. Les autres migrations par ordre de dépendance feature

### Régénérer les types TypeScript

```bash
# Unix
bash scripts/generate-supabase-types.sh

# Windows
.\scripts\generate-supabase-types.ps1
```

---

## Architecture

### Auth

Supabase Auth (email/password). Côté serveur : `getAuthUser()` via cookies SSR. Côté client : `AuthContext` avec `supabase.auth.getUser()`.

### Server Actions

Toute la logique métier est dans `frontend/app/actions/`. Pas d'API REST custom.

```
actions/
├── diary.ts            # upsertDiaryEntry, deleteDiaryEntry, toggleDiaryLike, addComment...
├── track-diary.ts      # upsertTrackDiaryEntry, getTrackDiaryEntry...
├── feed.ts             # getMyFeed, fanoutEvent
├── profile.ts          # ensureProfile, updateProfileSettings, changeUsername, deleteAccount
├── social.ts           # toggleFollow
├── lists.ts            # createList, addAlbumToList...
├── recommendations.ts  # createRecommendation
├── musicbrainz.ts      # search, preview, import depuis MusicBrainz
├── artists.ts          # getArtistMeta, getArtistReleases, getArtistImagesByMbids
├── search.ts           # searchInternal (Supabase FTS + ILIKE + fuzzy pg_trgm)
└── explore.ts          # getTrendingThisWeek, getForYouSuggestions, getDiscoveryAlbums...
```

### Recherche

Deux niveaux de recherche, toujours en deux phases (interne d'abord, MB en arrière-plan) :

- **Interne** (`searchInternal`) : Supabase full-text search (`tsvector`, config `simple` + `unaccent`), fallback ILIKE, fallback fuzzy pg_trgm en cas de 0 résultats
- **MusicBrainz** : requêtes Lucene multi-clauses (phrase, per-term, split artist/title), cache L1 mémoire 5min + L2 Supabase 24h
- **Ranking unifié** (`lib/searchRanking.ts`) : `computeRank` + `mergeAndRank` partagés entre l'overlay et la page `/search`

### Fan-out du feed

Modèle **fan-out en écriture** : chaque action (review, like, follow…) insère un événement dans `feed_events` pour chacun des followers. La lecture est une simple requête filtrée par `user_id`.

### Storage avatars

Upload signé vers Supabase Storage (bucket `avatars`). Chemin : `{user_id}/avatar_{timestamp}.jpg`. Les avatars par défaut sont 12 SVG générés via `/api/avatars/[userId]`.

---

## Scripts utiles

### Rafraîchir les items Discover

```bash
# Unix
bash scripts/refresh_discover.sh

# Windows
.\scripts\refresh_discover.ps1
```

Remplit `discover_items` avec 7 catégories : trending semaine/mois, all-time top, momentum, hidden gems, nouvelles sorties, community pick.

En production (Vercel) : planifier l'appel via cron externe ou GitHub Actions (la clé `SUPABASE_SERVICE_KEY` est requise).

---

## Déploiement (Vercel)

1. Connecter le repo sur [vercel.com](https://vercel.com)
2. Définir le **Root Directory** sur `frontend`
3. Ajouter les variables d'environnement
4. Deploy

---

## Contribuer

```bash
git checkout -b feature/ma-feature
cd frontend && npm run build   # vérifie que ça compile
# PR sur main
```
