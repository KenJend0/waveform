#!/usr/bin/env python3
"""
Backfill genres for albums that have no genre data in album_genres.

Targets albums imported by the seed script (or before enrichment was added)
that were never passed through /api/enrich.

For each album without genres:
  1. Fetch genres + tags from MusicBrainz release-group endpoint
  2. Upsert into `genres` table (name + slug, deduplicated)
  3. Upsert into `album_genres` with source='musicbrainz', weight=tag_count

Respects MusicBrainz rate limit: 1 req/s.

Usage:
  python ml/scripts/backfill_genres.py
  python ml/scripts/backfill_genres.py --dry-run
  python ml/scripts/backfill_genres.py --limit 50   # process at most N albums
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen

from postgrest.exceptions import APIError

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.supabase_client import get_client

MB_API = "https://musicbrainz.org/ws/2"
USER_AGENT = "WaveformML/1.0 (https://waveform.app)"
RATE_LIMIT_S = 1.1   # MB allows 1 req/s
MIN_TAG_COUNT = 3     # ignore tags with fewer votes
MAX_TAGS = 12


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return slug.strip("-")


def mb_fetch(path: str) -> dict | None:
    url = f"{MB_API}/{path}"
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                return json.loads(resp.read())
            return None
    except Exception as e:
        print(f"  [warn] MB fetch failed for {url}: {e}")
        return None


def resolve_release_group_mbid(mbid: str) -> str:
    """
    If mbid is a release MBID, resolve it to its release-group MBID.
    Returns the original mbid if it's already a release-group or resolution fails.
    """
    time.sleep(RATE_LIMIT_S)
    data = mb_fetch(f"release/{quote(mbid)}?fmt=json&inc=release-groups")
    if data and "release-group" in data:
        rg_id = data["release-group"].get("id")
        if rg_id:
            return rg_id
    return mbid


def fetch_mb_genres(mbid: str) -> list[dict[str, Any]]:
    """
    Fetch genres + tags for a MBID (release or release-group).
    Resolves release MBIDs to their release-group automatically.
    Returns list of { name, count } dicts, max MAX_TAGS entries.
    """
    time.sleep(RATE_LIMIT_S)
    data = mb_fetch(f"release-group/{quote(mbid)}?fmt=json&inc=genres+tags")

    # 404 → likely a release MBID, resolve to release-group and retry
    if not data:
        rg_mbid = resolve_release_group_mbid(mbid)
        if rg_mbid == mbid:
            return []  # resolution failed too
        time.sleep(RATE_LIMIT_S)
        data = mb_fetch(f"release-group/{quote(rg_mbid)}?fmt=json&inc=genres+tags")
        if not data:
            return []

    genres = [
        {"name": g["name"].lower().strip(), "count": g.get("count", 1)}
        for g in data.get("genres", [])
    ]
    tags = [
        {"name": t["name"].lower().strip(), "count": t["count"]}
        for t in data.get("tags", [])
        if (t.get("count") or 0) >= MIN_TAG_COUNT
    ]

    # Merge genres + tags, deduplicated by name
    seen: set[str] = set()
    combined: list[dict] = []
    for item in genres + tags:
        if item["name"] not in seen:
            seen.add(item["name"])
            combined.append(item)

    return combined[:MAX_TAGS]


def fetch_albums_without_genres(limit: int) -> list[dict]:
    """Return albums that have no rows in album_genres."""
    client = get_client()
    resp = (
        client.rpc(
            "albums_without_genres",  # fallback: plain query below if RPC missing
            {},
        )
        .limit(limit)
        .execute()
    )
    # Fallback: direct query if RPC doesn't exist
    if resp.data is None:
        resp = (
            client.table("albums")
            .select("id, mbid, title")
            .limit(limit * 10)  # fetch more, filter client-side
            .execute()
        )
        all_album_ids = {row["id"] for row in (resp.data or [])}

        # Get album_ids that already have genres
        genres_resp = client.table("album_genres").select("album_id").execute()
        has_genres = {row["album_id"] for row in (genres_resp.data or [])}

        albums = [
            row for row in (resp.data or [])
            if row["id"] not in has_genres and row.get("mbid")
        ]
        return albums[:limit]

    return resp.data or []


def fetch_albums_missing_genres(limit: int) -> list[dict]:
    """
    Find albums without any genre data.
    Uses a NOT IN subquery approach via two separate calls (Supabase PostgREST limitation).
    """
    client = get_client()

    # Step 1: all album_ids that already have genres
    genres_resp = client.table("album_genres").select("album_id").execute()
    has_genres_ids = list({row["album_id"] for row in (genres_resp.data or [])})

    # Step 2: albums with a valid mbid NOT in that set
    query = client.table("albums").select("id, mbid, title")
    if has_genres_ids:
        query = query.not_.in_("id", has_genres_ids)

    resp = query.not_.is_("mbid", "null").limit(limit).execute()
    return resp.data or []


def upsert_genres_and_link(
    album_id: str, tags: list[dict[str, Any]], dry_run: bool
) -> int:
    """
    Upsert each tag into `genres`, then link to album via `album_genres`.
    Returns number of genres linked.
    """
    if not tags:
        return 0

    client = get_client()

    genre_rows = [
        {"name": t["name"], "slug": slugify(t["name"])}
        for t in tags
    ]

    if dry_run:
        return len(tags)

    # Insert genres idempotently. A name conflict is expected when the row was
    # created by a previous run or concurrent worker.
    for row in genre_rows:
        try:
            client.table("genres").insert(row).execute()
        except APIError as error:
            if error.code != "23505":
                raise

    # Fetch the genre IDs we just upserted
    slugs = [r["slug"] for r in genre_rows]
    id_resp = client.table("genres").select("id, slug").in_("slug", slugs).execute()
    slug_to_id = {row["slug"]: row["id"] for row in (id_resp.data or [])}

    # Build album_genres rows
    tag_count_map = {t["name"]: t["count"] for t in tags}
    album_genre_rows = [
        {
            "album_id": album_id,
            "genre_id": genre_id,
            "source": "musicbrainz",
            "weight": tag_count_map.get(slugify(slug).replace("-", " "), 1),
        }
        for slug, genre_id in slug_to_id.items()
    ]

    if album_genre_rows:
        client.table("album_genres").upsert(
            album_genre_rows, on_conflict="album_id,genre_id"
        ).execute()

    return len(album_genre_rows)


def main(dry_run: bool, limit: int) -> None:
    print("=== backfill_genres ===")

    print("Finding albums without genre data...")
    albums = fetch_albums_missing_genres(limit)
    print(f"  {len(albums)} albums to process")

    if not albums:
        print("Nothing to backfill.")
        return

    total_linked = 0
    skipped = 0

    for i, album in enumerate(albums):
        mbid = album.get("mbid")
        title = album.get("title", "?")

        if not mbid:
            skipped += 1
            continue

        print(f"  [{i+1}/{len(albums)}] {title} (mbid={mbid[:8]}…)", end=" ")

        tags = fetch_mb_genres(mbid)
        if not tags:
            print("→ no tags found")
            skipped += 1
            continue

        n = upsert_genres_and_link(album["id"], tags, dry_run)
        total_linked += n

        tag_names = ", ".join(t["name"] for t in tags[:4])
        suffix = "…" if len(tags) > 4 else ""
        action = "[dry-run]" if dry_run else "→"
        print(f"{action} {n} genres ({tag_names}{suffix})")

    print(f"\nDone. {total_linked} genre links {'would be ' if dry_run else ''}created, {skipped} albums skipped (no mbid or no MB data).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill MB genres for albums without genre data")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=500, help="Max albums to process")
    args = parser.parse_args()
    main(dry_run=args.dry_run, limit=args.limit)
