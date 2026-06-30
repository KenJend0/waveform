from __future__ import annotations

from collections import defaultdict

from utils.supabase_client import get_client


def fetch_album_genre_weights() -> dict[str, dict[str, float]]:
    """Return { album_id: { genre_id: raw_weight } } from album_genres (paginated)."""
    client = get_client()
    rows: list[dict] = []
    page, page_size = 0, 1000
    while True:
        resp = (
            client.table("album_genres")
            .select("album_id, genre_id, weight")
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        page += 1

    vectors: dict[str, dict[str, float]] = defaultdict(dict)
    for row in rows:
        vectors[row["album_id"]][row["genre_id"]] = float(row.get("weight") or 1.0)
    return dict(vectors)


def normalize(vector: dict[str, float]) -> dict[str, float]:
    """L2-normalize a sparse vector so cosine similarity reduces to a dot product."""
    norm = sum(v * v for v in vector.values()) ** 0.5
    if norm == 0:
        return {}
    return {k: v / norm for k, v in vector.items()}


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    """Cosine similarity between two sparse vectors. Assumes both are already L2-normalized."""
    if not a or not b:
        return 0.0
    common = a.keys() & b.keys()
    if not common:
        return 0.0
    return sum(a[k] * b[k] for k in common)


def build_user_genre_profile(
    rated_albums: list[tuple[str, float]],
    album_vectors: dict[str, dict[str, float]],
    min_rating: float,
) -> dict[str, float]:
    """
    Weighted sum of the (normalized) genre vectors of albums the user rated >= min_rating,
    weighted by how much they liked it (rating - min_rating + 1, so a 10 counts more than
    a borderline 7). Albums without genre data are skipped — silent, since ~15% of the
    catalogue still lacks genre coverage.
    """
    profile: dict[str, float] = defaultdict(float)
    for album_id, rating in rated_albums:
        if rating is None or rating < min_rating:
            continue
        vec = album_vectors.get(album_id)
        if not vec:
            continue
        weight = rating - min_rating + 1
        for genre_id, w in normalize(vec).items():
            profile[genre_id] += w * weight
    return normalize(dict(profile))
