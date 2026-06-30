#!/usr/bin/env python3
"""
Phase 1 — Hybrid recommendations: cosine CF + content-based genre similarity.

For each user with at least one diary rating:
  1. CF score: same neighbour-weighted-average as compute_recommendations.py,
     but computed for every unseen candidate (no MAX_RECS cap before blending,
     so genre-only candidates aren't starved out by CF candidates).
  2. Content score: cosine similarity between the user's genre profile (weighted
     average of genre vectors of albums they rated >= MIN_LIKED_RATING) and every
     unseen album that has genre data in album_genres.
  3. Blend: final = 0.7 * (cf_score / 10) + 0.3 * content_score when both signals
     exist; otherwise whichever signal is available is used alone. This is the
     cold-start fix: a user with too few/no similar neighbours (the case that used
     to fall through to the live Jaccard fallback) can still get genre-based
     recommendations as long as they've rated a handful of albums with genre data.
  4. Store top MAX_RECS in user_recommendations with method='hybrid'.

Usage:
  python ml/scripts/compute_hybrid_recommendations.py --dry-run
  python ml/scripts/compute_hybrid_recommendations.py
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.supabase_client import get_client
from utils.genre_vectors import build_user_genre_profile, cosine, fetch_album_genre_weights, normalize

MAX_NEIGHBOURS = 20
MIN_NEIGHBOUR_RATING = 7        # neighbour must have rated >= this to count for CF
MIN_SUPPORTING_NEIGHBOURS = 2   # an album needs >= this many rating neighbours to be CF-eligible
MIN_LIKED_RATING = 7            # rating threshold to build the user's genre taste profile
MAX_RECS = 20
BATCH_SIZE = 200
CF_WEIGHT = 0.7
CONTENT_WEIGHT = 0.3
RATING_SCALE = 10.0


def fetch_user_ids() -> list[str]:
    """Every user with at least one diary rating — broader than user_similarity, which
    only covers users with >= 3 ratings. This is what lets genre-only candidates reach
    users too new for collaborative filtering."""
    client = get_client()
    resp = client.table("diary_entries").select("user_id").execute()
    return list({row["user_id"] for row in (resp.data or []) if row.get("user_id")})


def fetch_neighbours(user_id: str) -> list[dict]:
    client = get_client()
    resp = (
        client.table("user_similarity")
        .select("user_b, score")
        .eq("user_a", user_id)
        .order("score", desc=True)
        .limit(MAX_NEIGHBOURS)
        .execute()
    )
    return resp.data or []


def fetch_user_diary(user_id: str) -> list[dict]:
    client = get_client()
    resp = client.table("diary_entries").select("album_id, rating").eq("user_id", user_id).execute()
    return resp.data or []


def fetch_dismissed_albums(user_id: str) -> set[str]:
    client = get_client()
    resp = (
        client.table("recommendation_feedback")
        .select("album_id")
        .eq("user_id", user_id)
        .not_.is_("album_id", "null")
        .execute()
    )
    return {row["album_id"] for row in (resp.data or [])}


def fetch_neighbour_ratings(neighbour_ids: list[str]) -> list[dict]:
    if not neighbour_ids:
        return []
    client = get_client()
    resp = (
        client.table("diary_entries")
        .select("user_id, album_id, rating")
        .in_("user_id", neighbour_ids)
        .gte("rating", MIN_NEIGHBOUR_RATING)
        .execute()
    )
    best: dict[tuple[str, str], float] = {}
    for row in resp.data or []:
        key = (row["user_id"], row["album_id"])
        if key not in best or row["rating"] > best[key]:
            best[key] = row["rating"]
    return [{"user_id": u, "album_id": a, "rating": r} for (u, a), r in best.items()]


def cf_scores(neighbours: list[dict], neighbour_ratings: list[dict], seen: set[str]) -> dict[str, float]:
    """Raw weighted-average CF score (0-10 scale) per candidate album."""
    sim_map = {n["user_b"]: n["score"] for n in neighbours}
    weighted_sum: dict[str, float] = defaultdict(float)
    weight_total: dict[str, float] = defaultdict(float)
    neighbour_count: dict[str, int] = defaultdict(int)

    for entry in neighbour_ratings:
        album_id = entry["album_id"]
        if album_id in seen:
            continue
        sim = sim_map.get(entry["user_id"], 0.0)
        if sim <= 0:
            continue
        weighted_sum[album_id] += sim * entry["rating"]
        weight_total[album_id] += sim
        neighbour_count[album_id] += 1

    return {
        album_id: weighted_sum[album_id] / weight_total[album_id]
        for album_id in weighted_sum
        if weight_total[album_id] > 0 and neighbour_count[album_id] >= MIN_SUPPORTING_NEIGHBOURS
    }


def content_scores(
    user_profile: dict[str, float],
    album_vectors: dict[str, dict[str, float]],
    seen: set[str],
) -> dict[str, float]:
    """Cosine similarity (0-1) between the user's genre profile and every unseen album
    with genre data."""
    if not user_profile:
        return {}
    scores: dict[str, float] = {}
    for album_id, vec in album_vectors.items():
        if album_id in seen:
            continue
        sim = cosine(user_profile, normalize(vec))
        if sim > 0:
            scores[album_id] = sim
    return scores


def blend(cf: dict[str, float], content: dict[str, float]) -> list[dict]:
    """Combine CF + content scores. A candidate with only one signal uses it alone —
    this is what lets genre-only candidates surface for cold-start users."""
    candidates = set(cf) | set(content)
    scored = []
    for album_id in candidates:
        cf_raw = cf.get(album_id)
        content_raw = content.get(album_id)
        if cf_raw is not None and content_raw is not None:
            score = CF_WEIGHT * (cf_raw / RATING_SCALE) + CONTENT_WEIGHT * content_raw
        elif cf_raw is not None:
            score = cf_raw / RATING_SCALE
        else:
            score = content_raw
        scored.append({"album_id": album_id, "score": score})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


def build_rec_rows(user_id: str, scored: list[dict], method: str, now: str) -> list[dict]:
    rows = []
    rank = 1
    for i, item in enumerate(scored):
        if i > 0 and item["score"] != scored[i - 1]["score"]:
            rank = i + 1
        rows.append({
            "user_id": user_id,
            "album_id": item["album_id"],
            "score": round(item["score"], 6),
            "method": method,
            "rank": rank,
            "computed_at": now,
        })
    return rows


def replace_recommendations(user_ids: list[str], rows: list[dict], method: str, dry_run: bool) -> None:
    """Delete each processed user's previous rows for this method, then insert the
    freshly computed ones — mirrors compute_recommendations.py's replace strategy so
    albums that fall out of the new top-N don't linger forever."""
    if dry_run:
        print(f"  [dry-run] would replace recommendations for {len(user_ids)} users with {len(rows)} rows")
        return
    client = get_client()
    for i in range(0, len(user_ids), BATCH_SIZE):
        batch = user_ids[i : i + BATCH_SIZE]
        client.table("user_recommendations").delete().eq("method", method).in_("user_id", batch).execute()
    for i in range(0, len(rows), BATCH_SIZE):
        client.table("user_recommendations").insert(rows[i : i + BATCH_SIZE]).execute()


def main(dry_run: bool, method: str, limit: int) -> None:
    print("=== compute_hybrid_recommendations ===")

    print("Fetching album genre vectors...")
    album_vectors = fetch_album_genre_weights()
    print(f"  {len(album_vectors)} albums with genre data")

    user_ids = fetch_user_ids()
    print(f"  {len(user_ids)} users with at least one rating")

    all_rows: list[dict] = []
    now = datetime.now(timezone.utc).isoformat()
    both, cf_only, content_only, neither = 0, 0, 0, 0

    for i, user_id in enumerate(user_ids):
        neighbours = fetch_neighbours(user_id)
        diary = fetch_user_diary(user_id)
        seen = {e["album_id"] for e in diary if e.get("album_id")} | fetch_dismissed_albums(user_id)

        neighbour_ids = [n["user_b"] for n in neighbours]
        neighbour_ratings = fetch_neighbour_ratings(neighbour_ids)
        cf = cf_scores(neighbours, neighbour_ratings, seen) if neighbour_ratings else {}

        rated_albums = [
            (e["album_id"], e["rating"])
            for e in diary
            if e.get("album_id") and e.get("rating") is not None
        ]
        user_profile = build_user_genre_profile(rated_albums, album_vectors, min_rating=MIN_LIKED_RATING)
        content = content_scores(user_profile, album_vectors, seen)

        if cf and content:
            both += 1
        elif cf:
            cf_only += 1
        elif content:
            content_only += 1
        else:
            neither += 1

        scored = blend(cf, content)[:limit]
        all_rows.extend(build_rec_rows(user_id, scored, method, now))

        if (i + 1) % 10 == 0:
            print(f"  processed {i + 1}/{len(user_ids)} users...")

    print(f"  {len(all_rows)} recommendation rows computed")
    print(f"  signal coverage: {both} hybrid, {cf_only} cf-only, {content_only} content-only, {neither} no candidates")

    if dry_run:
        print("  [dry-run] sample:")
        for r in all_rows[:5]:
            print(f"    user={r['user_id'][:8]}… album={r['album_id'][:8]}… score={r['score']:.4f} rank={r['rank']}")
        return

    print("Writing to Supabase...")
    replace_recommendations(user_ids, all_rows, method, dry_run)
    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compute hybrid (CF + genre content) recommendations")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--method", default="hybrid")
    parser.add_argument("--limit", type=int, default=MAX_RECS)
    args = parser.parse_args()
    main(dry_run=args.dry_run, method=args.method, limit=args.limit)
