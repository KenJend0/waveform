Roadmap ML — Waveform Recommender System
Context
Waveform est une app de journal musical (ratings 0-10, social graph, diary public). L'objectif est de construire une couche ML réelle, crédible pour un poste MLE (Spotify-level), qui soit aussi un vrai produit évolutif. L'approche : poser des bases solides maintenant, même avec peu d'utilisateurs, pour absorber proprement une croissance future.

Décision d'architecture : Batch scripts Python + Supabase (pas de service live). Les résultats ML sont pré-calculés et stockés dans Supabase. Next.js lit directement. Zéro latence côté user, zéro infra supplémentaire à maintenir.

État actuel
frontend/app/actions/explore.ts → getForYouSuggestions() : Jaccard-based neighbor finding (intersection ≥ 3 albums, rating ≥ 8). Pas de cosine, pas d'embeddings.
similar_albums_cache table existe (pattern cache Supabase, TTL 24h) — à étendre.
Données ML disponibles : ratings (0-10), follows, likes, saved_albums, favorite_albums (top 3), genre votes.
27 utilisateurs seedés (~405 diary entries) + scripts/seed_users_from_file.py (Python existant).
Aucun pgvector, aucune table d'embeddings.
Architecture globale
GitHub Actions (cron daily/weekly)
  └─ ml/scripts/*.py
       ├─ compute_user_vectors.py     # Rating vectors → cosine sim → store
       ├─ compute_recommendations.py  # CF / hybrid → store recs
       └─ evaluate_metrics.py        # Precision@K, Recall@K, NDCG

Supabase (PostgreSQL + pgvector)
  ├─ user_taste_vectors              # Float[] de ratings normalisés
  ├─ user_similarity                 # Top-N pairs similaires + score
  ├─ user_recommendations            # Recs pré-calculées par user
  └─ recommendation_metrics          # Métriques offline (P@K, NDCG)

Next.js (frontend/)
  └─ app/actions/explore.ts          # Lit Supabase → zero change d'UX
Phase 0 — Foundation (implémenter maintenant)
Objectif : Poser l'infrastructure ML, sans toucher à l'UX.

Structure /ml/ (nouveau dossier racine)
ml/
├── requirements.txt          # numpy, scipy, scikit-learn, supabase, python-dotenv
├── .env.example              # SUPABASE_URL, SUPABASE_SERVICE_KEY
├── utils/
│   └── supabase_client.py    # Client Supabase réutilisable
├── scripts/
│   ├── compute_user_vectors.py     # Phase 0
│   ├── compute_recommendations.py  # Phase 1
│   └── evaluate_metrics.py         # Phase 2
└── README.md                  # Documenter le pipeline pour le CV
Nouvelles tables Supabase (migration SQL)
-- Vecteurs de ratings normalisés par user
CREATE TABLE user_taste_vectors (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  vector FLOAT[] NOT NULL,          -- indexed albums dans album_index
  album_index JSONB NOT NULL,       -- { album_id: position }
  computed_at TIMESTAMPTZ DEFAULT now()
);

-- Top similitudes user-user (cosine)
CREATE TABLE user_similarity (
  user_a UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_b UUID REFERENCES profiles(id) ON DELETE CASCADE,
  score FLOAT NOT NULL,             -- cosine similarity [0, 1]
  computed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_a, user_b)
);

-- Recommandations pré-calculées par user
CREATE TABLE user_recommendations (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  score FLOAT NOT NULL,
  method TEXT NOT NULL,             -- 'cosine_cf', 'hybrid', 'content'
  rank INT NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, album_id)
);

-- Métriques d'évaluation offline
CREATE TABLE recommendation_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT NOT NULL,
  k INT NOT NULL,
  precision_at_k FLOAT,
  recall_at_k FLOAT,
  ndcg_at_k FLOAT,
  n_users INT,
  computed_at TIMESTAMPTZ DEFAULT now()
);
ml/scripts/compute_user_vectors.py
Récupère tous les diary_entries (latest par user/album)
Construit la matrice user-item (ratings 0-10, NaN pour non-vu)
Normalise : mean-center par user (soustrait la note moyenne de chaque user)
Stocke vecteurs dans user_taste_vectors
Calcule cosine similarity entre toutes les paires (scipy sparse)
Stocke top 50 voisins par user dans user_similarity
GitHub Actions workflow (.github/workflows/ml_batch.yml)
on:
  schedule:
    - cron: '0 3 * * *'   # daily à 3h UTC
  workflow_dispatch:        # trigger manuel possible
Phase 1 — Cosine CF + Features utilisateurs (dès que Phase 0 est en place)
Objectif : Remplacer le Jaccard actuel par du vrai cosine similarity. Ajouter "Users with similar taste" et "Taste match %".

Modifier frontend/app/actions/explore.ts
getForYouSuggestions() : lire user_recommendations WHERE method='cosine_cf', rank ≤ 4. Fallback sur l'actuel Jaccard si table vide.
Ajouter getSimilarUsers(userId, limit) : lire user_similarity ORDER BY score DESC LIMIT 5.
Ajouter getTasteMatchScore(userId, targetUserId) : lire user_similarity WHERE (user_a, user_b) → retourner Math.round(score * 100).
ml/scripts/compute_recommendations.py
Pour chaque user, prendre ses top-N voisins (depuis user_similarity)
Récupérer les albums bien notés par ces voisins (non vus par le user cible)
Score pondéré : Σ (similarity_score × neighbor_rating) / Σ similarity_score
Stocker dans user_recommendations avec method='cosine_cf'
Nouveaux composants UI (pages existantes, pas de nouvelle page)
explore/page.tsx : section "Utilisateurs avec des goûts similaires" (data de getSimilarUsers)
u/[username]/page.tsx : badge "Taste match X%" visible quand connecté (data de getTasteMatchScore)
Phase 2 — Hybrid + Évaluation offline (100+ utilisateurs réels)
Objectif : Ajouter content-based (genres), hybridation, et métriques d'évaluation réelles.

Content-based (genres)
Vecteur genre par album depuis album_genres (avec weights)
Profil genre par user = somme pondérée (par rating) des vecteurs genre de ses albums
Similarité content-based = cosine(profil_user, vecteur_genre_album)
Stocké dans user_recommendations avec method='content_genre'
Hybrid recommendations
Score final = α × CF_score + (1-α) × content_score
α = 0.7 par défaut (CF dominant si données suffisantes)
Stocker avec method='hybrid'
ml/scripts/evaluate_metrics.py
Leave-one-out cross-validation sur les diary_entries
Calculer Precision@K, Recall@K pour K ∈ {5, 10, 20}
Calculer NDCG@K
Stocker dans recommendation_metrics
Exposer une route /api/admin/ml-metrics (admin seulement) pour visualiser
Phase 3 — Advanced ML (500+ utilisateurs)
Objectif : Vrai matrix factorization, NLP sur reviews, A/B testing.

Matrix Factorization (SVD / ALS)
scipy.sparse.linalg.svds ou implicit library (ALS pour feedback implicite)
Latent factors stockés dans pgvector (vector(64) dimension)
Inférence = dot product user_factor · item_factor
Review NLP
Embeddings des reviews texte (French + English) via sentence-transformers
paraphrase-multilingual-MiniLM-L12-v2 — bon pour le FR
Clustering de users par style de review → "Trending in your taste cluster"
"People you should follow"
Users similaires (cosine) non encore suivis
Weighted par : score similitude × (followers_in_common / total_followers)
Surface dans explore ou onboarding
A/B testing simple
Stocker dans recommendation_metrics le method utilisé par user (flag dans user_recommendations)
Comparer engagement (diary_likes, diary_entries) entre groupes A/B
Pas besoin de framework externe — SQL suffisant à ce stade
Fichiers critiques à créer / modifier
Fichier	Action
ml/requirements.txt	Créer
ml/utils/supabase_client.py	Créer
ml/scripts/compute_user_vectors.py	Créer
ml/scripts/compute_recommendations.py	Créer
ml/scripts/evaluate_metrics.py	Créer
ml/README.md	Créer (doc pipeline pour CV)
.github/workflows/ml_batch.yml	Créer
supabase_migration_ml_tables.sql	Créer
frontend/app/actions/explore.ts	Modifier (Phase 1)
frontend/app/actions/profile.ts ou nouveau	Modifier (taste match %)
Vérification end-to-end
Phase 0
cd ml && pip install -r requirements.txt
python scripts/compute_user_vectors.py --dry-run → vérifier la matrice générée
Vérifier les tables Supabase peuplées (user_taste_vectors, user_similarity)
Phase 1
Lancer le batch : python scripts/compute_recommendations.py
Vérifier user_recommendations table dans Supabase
Charger /explore en tant qu'utilisateur seedé → vérifier que "Pour toi" utilise les nouvelles recs
Vérifier getTasteMatchScore sur deux users seedés avec goûts similaires
Phase 2
python scripts/evaluate_metrics.py --method cosine_cf --k 5,10,20
Consulter recommendation_metrics table
Comparer scores hybrid vs cosine_cf seul
Notes CV / Portfolio
Le ml/README.md doit documenter : signals utilisés, algorithmes, métriques, résultats observés
Commenter le code Python avec les formules (cosine, mean-centering, weighted hybrid)
Les GitHub Actions logs sont visibles publiquement si repo public → preuve que le pipeline tourne
Mentionner : "batch ML pipeline sur Supabase + GitHub Actions, cosine CF → hybrid CF+CBF, évaluation Precision@K / NDCG"