#!/usr/bin/env python3
"""
Phase 1 (tracks) — Cosine CF recommendations on track_diary_entries.

Same algorithm as compute_recommendations.py but on the track-user matrix:
  1. Fetch track_diary_entries (latest rating per user/track).
  2. Reuse user_similarity (computed from album ratings) as the neighbour source.
     Rationale: album taste similarity is a good proxy for track taste.
  3. For each user, score candidate tracks from neighbours (not yet rated by user).
     score(track) = Σ(sim × neighbour_rating) / Σ sim
  4. Store top MAX_RECS in user_track_recommendations with method='cosine_cf'.

Usage:
  python ml/scripts/compute_track_recommendations.py
  python ml/scripts/compute_track_recommendations.py --dry-run
  python ml/scripts/compute_track_recommendations.py --limit 20
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.supabase_client import get_client

MAX_NEIGHBOURS  = 20
MIN_TRACK_RATING = 7   # neighbour must have rated >= this to recommend
MAX_RECS        = 20
BATCH_SIZE      = 200


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


def fetch_user_tracks(user_id: str) -> set[str]:
    """Return track_ids already rated by this user."""
    client = get_client()
    resp = (
        client.table("track_diary_entries")
        .select("track_id")
        .eq("user_id", user_id)
        .execute()
    )
    return {row["track_id"] for row in (resp.data or [])}


def fetch_dismissed_tracks(user_id: str) -> set[str]:
    """Return track_ids the user explicitly marked "Pas pour moi"."""
    client = get_client()
    resp = (
        client.table("recommendation_feedback")
        .select("track_id")
        .eq("user_id", user_id)
        .not_.is_("track_id", "null")
        .execute()
    )
    return {row["track_id"] for row in (resp.data or [])}


def fetch_neighbour_track_ratings(neighbour_ids: list[str]) -> list[dict]:
    """Return latest high-rated track entries for a list of neighbours."""
    if not neighbour_ids:
        return []
    client = get_client()
    resp = (
        client.table("track_diary_entries")
        .select("user_id, track_id, rating")
        .in_("user_id", neighbour_ids)
        .gte("rating", MIN_TRACK_RATING)
        .execute()
    )
    # Keep highest rating per (user_id, track_id)
    best: dict[tuple[str, str], float] = {}
    for row in (resp.data or []):
        if row.get("rating") is None:
            continue
        key = (row["user_id"], row["track_id"])
        if key not in best or row["rating"] > best[key]:
            best[key] = row["rating"]
    return [{"user_id": u, "track_id": t, "rating": r} for (u, t), r in best.items()]


def score_tracks(
    neighbours: list[dict],
    neighbour_ratings: list[dict],
    seen_tracks: set[str],
    limit: int,
) -> list[dict]:
    sim_map = {n["user_b"]: n["score"] for n in neighbours}
    weighted_sum: dict[str, float] = defaultdict(float)
    weight_total: dict[str, float] = defaultdict(float)

    for entry in neighbour_ratings:
        track_id = entry["track_id"]
        if track_id in seen_tracks:
            continue
        sim = sim_map.get(entry["user_id"], 0.0)
        if sim <= 0:
            continue
        weighted_sum[track_id] += sim * entry["rating"]
        weight_total[track_id] += sim

    scored = [
        {"track_id": tid, "score": weighted_sum[tid] / weight_total[tid]}
        for tid in weighted_sum
        if weight_total[tid] > 0
    ]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


def build_rows(user_id: str, scored: list[dict], method: str, now: str) -> list[dict]:
    rows = []
    rank = 1
    for i, item in enumerate(scored):
        if i > 0 and item["score"] != scored[i - 1]["score"]:
            rank = i + 1
        rows.append({
            "user_id": user_id,
            "track_id": item["track_id"],
            "score": round(item["score"], 6),
            "method": method,
            "rank": rank,
            "computed_at": now,
        })
    return rows


def replace_recommendations(
    user_ids: list[str], rows: list[dict], method: str, dry_run: bool
) -> None:
    """Delete each processed user's previous rows for this method, then insert
    the freshly computed ones — an upsert alone never removes albums that fell
    out of the new top-N, leaving stale ranked rows that never rotate out."""
    if dry_run:
        return
    client = get_client()
    for i in range(0, len(user_ids), BATCH_SIZE):
        batch = user_ids[i : i + BATCH_SIZE]
        client.table("user_track_recommendations").delete().eq("method", method).in_("user_id", batch).execute()
    for i in range(0, len(rows), BATCH_SIZE):
        client.table("user_track_recommendations").insert(rows[i: i + BATCH_SIZE]).execute()


def main(dry_run: bool, method: str, limit: int) -> None:
    print("=== compute_track_recommendations ===")

    user_ids = fetch_user_ids()
    print(f"  {len(user_ids)} users with similarity data")

    all_rows: list[dict] = []
    now = datetime.now(timezone.utc).isoformat()

    for i, user_id in enumerate(user_ids):
        neighbours = fetch_neighbours(user_id)
        if not neighbours:
            continue

        neighbour_ids = [n["user_b"] for n in neighbours]
        seen_tracks = fetch_user_tracks(user_id) | fetch_dismissed_tracks(user_id)
        neighbour_ratings = fetch_neighbour_track_ratings(neighbour_ids)

        if not neighbour_ratings:
            continue

        scored = score_tracks(neighbours, neighbour_ratings, seen_tracks, limit)
        all_rows.extend(build_rows(user_id, scored, method, now))

        if (i + 1) % 10 == 0:
            print(f"  processed {i + 1}/{len(user_ids)} users...")

    print(f"  {len(all_rows)} track recommendation rows computed")

    if dry_run:
        print("  [dry-run] sample:")
        for r in all_rows[:5]:
            print(f"    user={r['user_id'][:8]}… track={r['track_id'][:8]}… score={r['score']:.4f} rank={r['rank']}")
        return

    print("Writing to Supabase...")
    replace_recommendations(user_ids, all_rows, method, dry_run)
    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compute cosine CF track recommendations")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--method", default="cosine_cf")
    parser.add_argument("--limit", type=int, default=MAX_RECS)
    args = parser.parse_args()
    main(dry_run=args.dry_run, method=args.method, limit=args.limit)
