#!/usr/bin/env python3
"""
Phase 0 — Compute user taste vectors and user-user cosine similarity.

What this does:
  1. Fetch all diary entries (latest rating per user/album).
  2. Build a user-item matrix R where R[u][i] = rating (0-10), NaN if unseen.
  3. Mean-center each user row: R_centered[u][i] = R[u][i] - mean(R[u])
     This corrects for rating scale bias (a harsh rater's 7 ≈ a lenient rater's 9).
  4. Compute cosine similarity between all user pairs on the centered matrix.
     sim(u, v) = dot(R_u, R_v) / (||R_u|| * ||R_v||)  — only on co-rated items.
  5. Store top MAX_NEIGHBOURS neighbours per user in `user_similarity`.
  6. Store the raw mean-centered vector + album index in `user_taste_vectors`.

Usage:
  python ml/scripts/compute_user_vectors.py
  python ml/scripts/compute_user_vectors.py --dry-run   # print stats, no writes
  python ml/scripts/compute_user_vectors.py --top 50    # neighbours per user
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.supabase_client import get_client

MAX_NEIGHBOURS = 50   # top-N similar users stored per user
MIN_RATINGS = 3       # users with fewer ratings are skipped (not enough signal)
BATCH_SIZE = 200      # rows per Supabase upsert call
DISMISS_SYNTHETIC_RATING = 2.0  # implicit "not for me" signal injected into the matrix


def fetch_dismissed_pairs() -> list[tuple[str, str]]:
    """Return (user_id, album_id) pairs explicitly dismissed via "Pas pour moi"."""
    client = get_client()
    resp = (
        client.table("recommendation_feedback")
        .select("user_id, album_id")
        .not_.is_("album_id", "null")
        .execute()
    )
    return [(row["user_id"], row["album_id"]) for row in (resp.data or [])]


def fetch_diary_entries() -> list[dict[str, Any]]:
    """Return latest rating per (user_id, album_id) across all public entries."""
    client = get_client()
    rows: list[dict] = []
    page = 0
    page_size = 1000

    while True:
        resp = (
            client.table("diary_entries")
            .select("user_id, album_id, rating, created_at")
            .order("user_id")
            .order("album_id")
            .order("created_at", desc=True)
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        page += 1

    # Keep only the latest entry per (user_id, album_id)
    seen: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for row in rows:
        key = (row["user_id"], row["album_id"])
        if key not in seen:
            seen.add(key)
            deduped.append(row)

    return deduped


def build_matrix(
    entries: list[dict[str, Any]],
) -> tuple[np.ndarray, list[str], list[str]]:
    """
    Build a dense user-item matrix from diary entries.

    Returns:
        matrix  — shape (n_users, n_albums), NaN for unrated
        users   — ordered list of user_ids (row index)
        albums  — ordered list of album_ids (col index)
    """
    user_ids = sorted({e["user_id"] for e in entries})
    album_ids = sorted({e["album_id"] for e in entries})

    user_idx = {u: i for i, u in enumerate(user_ids)}
    album_idx = {a: i for i, a in enumerate(album_ids)}

    matrix = np.full((len(user_ids), len(album_ids)), np.nan)

    for e in entries:
        if e["rating"] is not None:
            u = user_idx[e["user_id"]]
            a = album_idx[e["album_id"]]
            matrix[u][a] = float(e["rating"])

    return matrix, user_ids, album_ids


def mean_center(matrix: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Subtract each user's mean rating (ignoring NaN).
    Users with no ratings get a zero vector.

    Returns:
        centered  — same shape as matrix, NaN replaced by 0 after centering
        means     — per-user mean rating, shape (n_users,)
    """
    means = np.nanmean(matrix, axis=1)  # shape (n_users,)
    centered = matrix - means[:, np.newaxis]
    # Replace remaining NaN (unseen items) with 0 — neutral in dot product
    centered = np.nan_to_num(centered, nan=0.0)
    return centered, means


def compute_similarities(
    centered: np.ndarray,
    user_ids: list[str],
    top_n: int,
) -> list[dict[str, Any]]:
    """
    Compute cosine similarity between all user pairs and return top-N per user.

    Uses sklearn's cosine_similarity on the dense centered matrix.
    For large user bases, switch to sparse representation (see comment below).
    """
    # cosine_similarity returns shape (n_users, n_users)
    # For >5k users consider: cosine_similarity(csr_matrix(centered))
    sim_matrix = cosine_similarity(centered)  # shape (n, n)
    np.fill_diagonal(sim_matrix, 0.0)  # exclude self

    now = datetime.now(timezone.utc).isoformat()
    rows: list[dict] = []

    for u_idx, user_a in enumerate(user_ids):
        scores = sim_matrix[u_idx]  # shape (n_users,)
        top_indices = np.argsort(scores)[::-1][:top_n]

        for v_idx in top_indices:
            score = float(scores[v_idx])
            if score <= 0.0:
                continue  # skip non-positive pairs but don't stop — other neighbours may be positive
            rows.append(
                {
                    "user_a": user_a,
                    "user_b": user_ids[v_idx],
                    "score": round(score, 6),
                    "computed_at": now,
                }
            )

    return rows


def upsert_in_batches(
    table: str, rows: list[dict], dry_run: bool
) -> None:
    if not rows:
        print(f"  [skip] no rows for {table}")
        return
    if dry_run:
        print(f"  [dry-run] would upsert {len(rows)} rows into {table}")
        return

    client = get_client()
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        client.table(table).upsert(batch).execute()
    print(f"  [ok] upserted {len(rows)} rows into {table}")


def replace_similarities(
    user_ids: list[str], rows: list[dict], dry_run: bool
) -> None:
    """Delete each processed user's previous neighbour rows, then insert the
    fresh top-N. An upsert alone never removes a pair that fell out of the
    new top-N, leaving stale (user_a, user_b) rows with outdated scores that
    keep winning fetch_neighbours()'s `order('score').limit(N)` forever."""
    if not user_ids:
        print("  [skip] no users for user_similarity")
        return
    if dry_run:
        print(f"  [dry-run] would replace similarity rows for {len(user_ids)} users with {len(rows)} rows")
        return

    client = get_client()
    for i in range(0, len(user_ids), BATCH_SIZE):
        batch = user_ids[i : i + BATCH_SIZE]
        client.table("user_similarity").delete().in_("user_a", batch).execute()
    for i in range(0, len(rows), BATCH_SIZE):
        client.table("user_similarity").insert(rows[i : i + BATCH_SIZE]).execute()
    print(f"  [ok] replaced user_similarity with {len(rows)} rows for {len(user_ids)} users")


def main(dry_run: bool, top_n: int) -> None:
    print("=== compute_user_vectors ===")

    print("Fetching diary entries...")
    entries = fetch_diary_entries()
    print(f"  {len(entries)} entries (latest per user/album)")

    print("Fetching dismissed recommendations (implicit negative signal)...")
    rated_pairs = {(e["user_id"], e["album_id"]) for e in entries}
    dismissed_pairs = {
        pair for pair in fetch_dismissed_pairs() if pair not in rated_pairs
    }
    print(f"  {len(dismissed_pairs)} dismiss-only pairs injected as rating={DISMISS_SYNTHETIC_RATING}")
    entries = entries + [
        {"user_id": u, "album_id": a, "rating": DISMISS_SYNTHETIC_RATING}
        for u, a in dismissed_pairs
    ]

    print("Building user-item matrix...")
    matrix, user_ids, album_ids = build_matrix(entries)
    print(f"  {len(user_ids)} users × {len(album_ids)} albums")

    # Filter users with too few ratings
    rating_counts = (~np.isnan(matrix)).sum(axis=1)
    active_mask = rating_counts >= MIN_RATINGS
    active_users = [u for u, ok in zip(user_ids, active_mask) if ok]
    matrix = matrix[active_mask]
    print(f"  {len(active_users)} users with >= {MIN_RATINGS} ratings")

    if len(active_users) == 0:
        print("Not enough users. Exiting.")
        return

    print("Mean-centering...")
    centered, means = mean_center(matrix)

    # --- Prepare user_taste_vectors rows ---
    album_index = {album_id: pos for pos, album_id in enumerate(album_ids)}
    now = datetime.now(timezone.utc).isoformat()
    vector_rows = [
        {
            "user_id": active_users[i],
            "vector": centered[i].tolist(),
            "album_index": album_index,
            "n_ratings": int((~np.isnan(matrix[i])).sum()),
            "computed_at": now,
        }
        for i in range(len(active_users))
    ]

    print("Computing cosine similarities...")
    sim_rows = compute_similarities(centered, active_users, top_n)
    print(f"  {len(sim_rows)} (user_a, user_b) pairs with score > 0")

    if dry_run:
        print("\n--- DRY RUN STATS ---")
        print(f"  user_taste_vectors : {len(vector_rows)} rows")
        print(f"  user_similarity    : {len(sim_rows)} rows")
        sample = sim_rows[:5] if sim_rows else []
        for s in sample:
            print(f"    {s['user_a'][:8]}… ↔ {s['user_b'][:8]}… score={s['score']:.4f}")
        return

    print("Writing to Supabase...")
    upsert_in_batches("user_taste_vectors", vector_rows, dry_run)
    replace_similarities(active_users, sim_rows, dry_run)

    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compute user taste vectors + cosine similarity")
    parser.add_argument("--dry-run", action="store_true", help="Print stats without writing to DB")
    parser.add_argument("--top", type=int, default=MAX_NEIGHBOURS, help="Neighbours per user")
    args = parser.parse_args()
    main(dry_run=args.dry_run, top_n=args.top)
