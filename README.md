# Waveform

Une application de journal musical. Suivis tes écoutes, note tes albums, lis les avis de tes amis.

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
- Un projet Supabase (gratuit suffisant pour dev)

### Installation

```bash
git clone https://github.com/ton-user/waveform.git
cd waveform/frontend
npm install
```

### Configuration

```bash
cp .env.example .env.local
# Remplis les variables dans .env.local
```

Variables requises (voir [frontend/.env.example](frontend/.env.example)) :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...      # serveur uniquement
```

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
│   │   ├── albums/[id]/        # Page album
│   │   ├── artists/[id]/       # Page artiste
│   │   ├── auth/               # Login / Signup
│   │   ├── diary/              # Journal + entrée détaillée
│   │   ├── explore/            # Découverte
│   │   ├── feed/               # Fil d'activité
│   │   ├── import/             # Import depuis MusicBrainz
│   │   ├── me/                 # Profil personnel
│   │   ├── search/             # Recherche
│   │   ├── settings/           # Paramètres & favoris
│   │   └── u/[username]/       # Profil public
│   ├── components/             # Composants React
│   │   ├── avatars/            # 12 avatars SVG générés
│   │   ├── feed/cards/         # Cartes du feed par type
│   │   ├── icons/              # Icônes custom
│   │   ├── profile/            # Composants profil
│   │   └── social/             # Follow button
│   ├── lib/
│   │   ├── supabase/           # Clients Supabase (client + server)
│   │   ├── AuthContext.tsx     # Contexte auth global
│   │   └── ...
│   ├── types/
│   │   └── database.ts         # Types générés depuis Supabase
│   └── public/
│       ├── robots.txt
│       └── sitemap.xml
├── scripts/
│   ├── generate-supabase-types.sh   # Régénère frontend/types/database.ts
│   ├── generate-supabase-types.ps1  # (Windows)
│   ├── refresh_discover.sh          # Rafraîchit les items Discover
│   └── refresh_discover.ps1         # (Windows)
├── supabase_schema.sql         # Schéma Postgres de référence + RLS
├── .gitignore
└── README.md
```

---

## Base de données

Le schéma complet est dans [`supabase_schema.sql`](supabase_schema.sql).

**Tables principales :**

| Table | Description |
|-------|-------------|
| `profiles` | Métadonnées utilisateur (username, bio, avatar) |
| `albums` | Catalogue albums, FK → `artists` |
| `tracks` | Pistes, FK → `albums` |
| `diary_entries` | Écoutes/reviews d'un user pour un album |
| `diary_likes` | Likes sur les entrées |
| `diary_comments` | Commentaires sur les entrées |
| `follows` | Relations sociales |
| `feed_events` | Fil d'activité (fan-out en écriture) |
| `notifications` | Notifications (like, comment, follow, reco) |
| `saved_albums` | Albums sauvegardés (wishlist) |
| `user_favorite_albums` | Top 3 albums du profil (position 1–3) |
| `discover_items` | Algo de découverte |
| `recommendations` | Recommandations d'albums entre users |

**Vue :** `album_stats` — listeners, reviews, note moyenne par album.

### RLS

Le RLS est activé sur toutes les tables. Les policies sont définies dans `supabase_schema.sql`. Les écritures système (fan-out feed, discover) passent par la clé service role côté serveur uniquement.

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

Toute la logique métier est dans `frontend/app/actions/`. Pas d'API REST custom — les actions sont appelées directement depuis les composants (client ou serveur).

```
actions/
├── diary.ts          # upsertDiaryEntry, deleteDiaryEntry, toggleDiaryLike, addComment...
├── feed.ts           # getMyFeed, fanoutEvent
├── profile.ts        # ensureProfile, updateProfileSettings, changeUsername, deleteAccount
├── social.ts         # toggleFollow
├── recommendations.ts # createRecommendation
├── musicbrainz.ts    # search, preview, import depuis MusicBrainz
├── saved-albums.ts   # toggleSaveAlbum
└── search.ts         # searchInternal
```

### Fan-out du feed

Le feed utilise un modèle **fan-out en écriture** : quand un user effectue une action (review, like, follow...), un événement est inséré dans `feed_events` pour chacun de ses followers. La lecture du feed est une simple requête `WHERE user_id = auth.uid()`.

### Storage avatars

Upload signé vers Supabase Storage (bucket `avatars`). Le chemin est `{user_id}/avatar_{timestamp}.jpg`. Les avatars par défaut sont 12 SVG générés côté serveur (`/api/avatars/[userId]`).

---

## Scripts utiles

### Rafraîchir les items Discover

L'algo de découverte tourne manuellement (ou via cron) :

```bash
bash scripts/refresh_discover.sh
```

Il appelle l'endpoint admin qui remplit `discover_items` avec 7 catégories : trending semaine/mois, all-time top, momentum, hidden gems, nouvelles sorties, community pick.

---

## Déploiement (Vercel)

1. Connecter le repo sur [vercel.com](https://vercel.com)
2. Définir le **Root Directory** sur `frontend`
3. Ajouter les variables d'environnement (Supabase URL, anon key, service key)
4. Deploy

> La clé `SUPABASE_SERVICE_KEY` doit rester côté serveur — ne jamais la préfixer `NEXT_PUBLIC_`.

---

## Contribuer

```bash
# Créer une branche
git checkout -b feature/ma-feature

# Développer, puis
cd frontend && npm run build   # vérifie que ça compile

# PR sur main
```
