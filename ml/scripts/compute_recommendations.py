#!/usr/bin/env python3
"""
Phase 1 — Compute album recommendations per user via cosine CF.

Algorithm (user-based collaborative filtering):
  For each user U:
    1. Load U's top-N neighbours from `user_similarity`.
    2. Collect all albums rated >= MIN_NEIGHBOUR_RATING by those neighbours
       that U has NOT yet listened to.
    3. Score each candidate album:
         score = Σ(sim(U, neighbour) × neighbour_rating) / Σ sim(U, neighbour)
       (weighted average of neighbour ratings, weighted by similarity)
    4. Store top MAX_RECS results in `user_recommendations` with method='cosine_cf'.

Usage:
  python ml/scripts/compute_recommendations.py
  python ml/scripts/compute_recommendations.py --dry-run
  python ml/scripts/compute_recommendations.py --method cosine_cf --limit 20
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.supabase_client import get_client

MAX_NEIGHBOURS = 20       # top neighbours to consider per user
MIN_NEIGHBOUR_RATING = 7  # neighbour must have rated >= this to recommend
MIN_SUPPORTING_NEIGHBOURS = 2  # an album needs >= this many rating neighbours to be eligible
MAX_RECS = 20             # max recommendations stored per user
BATCH_SIZE = 200


def fetch_user_ids() -> list[str]:
    client = get_client()
    resp = client.table("user_similarity").select("user_a").execute()
    return list({row["user_a"] for row in (resp.data or [])})


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


def fetch_user_albums(user_id: str) -> set[str]:
    """Return album_ids already in user's diary."""
    client = get_client()
    resp = (
        client.table("diary_entries")
        .select("album_id")
        .eq("user_id", user_id)
        .execute()
    )
    return {row["album_id"] for row in (resp.data or [])}


def fetch_dismissed_albums(user_id: str) -> set[str]:
    """Return album_ids the user explicitly marked "Pas pour moi"."""
    client = get_client()
    resp = (
        client.table("recommendation_feedback")
        .select("album_id")
        .eq("user_id", user_id)
        .execute()
    )
    return {row["album_id"] for row in (resp.data or [])}


def fetch_neighbour_ratings(neighbour_ids: list[str]) -> list[dict]:
    """Return latest high-rated diary entries for a list of neighbour user_ids."""
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
    # Deduplicate: keep highest rating per (user_id, album_id)
    best: dict[tuple[str, str], float] = {}
    for row in (resp.data or []):
        key = (row["user_id"], row["album_id"])
        if key not in best or row["rating"] > best[key]:
            best[key] = row["rating"]
    return [
        {"user_id": u, "album_id": a, "rating": r}
        for (u, a), r in best.items()
    ]


def score_albums(
    neighbours: list[dict],
    neighbour_ratings: list[dict],
    seen_albums: set[str],
) -> list[dict]:
    """
    Weighted average score per candidate album.
    score(album) = Σ(sim × rating) / Σ sim

    Requires MIN_SUPPORTING_NEIGHBOURS distinct neighbours — a single neighbour's
    rating collapses the weighted average to exactly that rating regardless of
    how weak the similarity is, letting one-off matches outscore consensus picks.
    """
    sim_map = {n["user_b"]: n["score"] for n in neighbours}

    # Accumulate weighted sum and total weight per album
    weighted_sum: dict[str, float] = defaultdict(float)
    weight_total: dict[str, float] = defaultdict(float)
    neighbour_count: dict[str, int] = defaultdict(int)

    for entry in neighbour_ratings:
        album_id = entry["album_id"]
        if album_id in seen_albums:
            continue
        neighbour_id = entry["user_id"]
        sim = sim_map.get(neighbour_id, 0.0)
        if sim <= 0:
            continue
        weighted_sum[album_id] += sim * entry["rating"]
        weight_total[album_id] += sim
        neighbour_count[album_id] += 1

    scored = [
        {"album_id": album_id, "score": weighted_sum[album_id] / weight_total[album_id]}
        for album_id in weighted_sum
        if weight_total[album_id] > 0 and neighbour_count[album_id] >= MIN_SUPPORTING_NEIGHBOURS
    ]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:MAX_RECS]


def build_rec_rows(
    user_id: str, scored: list[dict], method: str, now: str
) -> list[dict]:
    rows = []
    rank = 1
    for i, item in enumerate(scored):
        # Increment rank only when score changes (no duplicate ranks on ties)
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


def replace_recommendations(
    user_ids: list[str], rows: list[dict], method: str, dry_run: bool
) -> None:
    """Delete each processed user's previous rows, then insert the freshly
    computed ones. A plain upsert would never remove an album that fell out
    of the new top-N, leaving stale rows that keep winning the
    `.order('rank')` query forever — this is why recos never rotated.

    The delete is NOT scoped to `method`: PRIMARY KEY (user_id, album_id) has
    no method column, so a row written under a different method still
    collides with this method's insert. Since the schema can only ever hold
    one row per (user_id, album_id) regardless of method, clearing by
    user_id alone is what the constraint actually requires."""
    if dry_run:
        print(f"  [dry-run] would replace recommendations for {len(user_ids)} users with {len(rows)} rows")
        return
    client = get_client()
    for i in range(0, len(user_ids), BATCH_SIZE):
        batch = user_ids[i : i + BATCH_SIZE]
        client.table("user_recommendations").delete().in_("user_id", batch).execute()
    for i in range(0, len(rows), BATCH_SIZE):
        client.table("user_recommendations").insert(rows[i : i + BATCH_SIZE]).execute()


def main(dry_run: bool, method: str, limit: int) -> None:
    print("=== compute_recommendations ===")

    user_ids = fetch_user_ids()
    print(f"  {len(user_ids)} users with similarity data")

    all_rows: list[dict] = []
    now = datetime.now(timezone.utc).isoformat()

    for i, user_id in enumerate(user_ids):
        neighbours = fetch_neighbours(user_id)
        if not neighbours:
            continue

        neighbour_ids = [n["user_b"] for n in neighbours]
        seen_albums = fetch_user_albums(user_id) | fetch_dismissed_albums(user_id)
        neighbour_ratings = fetch_neighbour_ratings(neighbour_ids)

        scored = score_albums(neighbours, neighbour_ratings, seen_albums)
        scored = scored[:limit]

        rows = build_rec_rows(user_id, scored, method, now)
        all_rows.extend(rows)

        if (i + 1) % 10 == 0:
            print(f"  processed {i + 1}/{len(user_ids)} users...")

    print(f"  {len(all_rows)} recommendation rows computed")

    if dry_run:
        print("  [dry-run] sample:")
        for r in all_rows[:5]:
            print(f"    user={r['user_id'][:8]}… album={r['album_id'][:8]}… score={r['score']:.4f} rank={r['rank']}")
        return

    print("Writing to Supabase...")
    replace_recommendations(user_ids, all_rows, method, dry_run)
    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compute cosine CF recommendations")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--method", default="cosine_cf")
    parser.add_argument("--limit", type=int, default=MAX_RECS)
    args = parser.parse_args()
    main(dry_run=args.dry_run, method=args.method, limit=args.limit)
