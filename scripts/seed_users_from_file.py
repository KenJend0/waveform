#!/usr/bin/env python3
"""
Import seed users from a JSON file into existing Supabase tables only:
- auth.users (via Admin API)
- profiles
- artists/albums (if missing, reused by diary_entries FK)
- diary_entries

No schema change. No table creation.

Usage:
  python scripts/seed_users_from_file.py \
    --input seed_users_data.txt \
    --password "ChangeMe_123!" \
    --reset

Required env vars:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_KEY

Optional env vars:
  SEED_USERS_PASSWORD (fallback for --password)
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from supabase import Client, create_client

MUSICBRAINZ_API = "https://musicbrainz.org/ws/2"
USER_AGENT = "WaveformSeed/1.0 (https://waveform.app)"



def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import seed users from JSON file")
    parser.add_argument("--input", default="seed_users_data.txt", help="Path to JSON file with users")
    parser.add_argument("--password", help="Password used for created auth users")
    parser.add_argument("--reset", action="store_true", help="Delete existing diary entries for imported users")
    parser.add_argument(
        "--strict-mb",
        action="store_true",
        help="Require MusicBrainz identifiers for missing artist/album metadata",
    )
    return parser.parse_args()


def read_required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing env var: {name}")
    return value


def parse_input_file(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {path}")
    raw = path.read_text(encoding="utf-8-sig")
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("Input JSON must be an array of users")
    return data


def build_email(username: str) -> str:
    return f"{username}@seed.waveform.local"


def fetch_users_by_email(client: Client) -> Dict[str, str]:
    out: Dict[str, str] = {}
    page = 1
    per_page = 200

    while True:
        response = client.auth.admin.list_users(page=page, per_page=per_page)
        # Newer supabase-py versions return a list directly
        if isinstance(response, list):
            users = response
        else:
            users = getattr(response, "users", None)
            if users is None and isinstance(response, dict):
                users = response.get("users", [])
        if not users:
            break

        for u in users:
            if isinstance(u, dict):
                email = u.get("email")
                uid = u.get("id")
            else:
                email = getattr(u, "email", None)
                uid = getattr(u, "id", None)
            if email and uid:
                out[email.lower()] = uid

        if len(users) < per_page:
            break
        page += 1

    return out


def ensure_auth_user(client: Client, username: str, password: str, known_by_email: Dict[str, str]) -> str:
    email = build_email(username)
    existing_id = known_by_email.get(email.lower())
    if existing_id:
        return existing_id

    resp = client.auth.admin.create_user(
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"seed": True, "username": username},
        }
    )

    created_user = getattr(resp, "user", None)
    if created_user is None and isinstance(resp, dict):
        created_user = resp.get("user")

    if isinstance(created_user, dict):
        uid = created_user.get("id")
    else:
        uid = getattr(created_user, "id", None)

    if not uid:
        raise RuntimeError(f"Could not create auth user for '{username}'")

    known_by_email[email.lower()] = uid
    return uid


def to_iso_timestamp(date_or_ts: str, minute_offset: int = 0) -> str:
    # Input can be YYYY-MM-DD or full timestamp
    text = str(date_or_ts).strip()
    if "T" in text:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = datetime.fromisoformat(text + "T12:00:00+00:00")
    dt = dt.replace(second=0, microsecond=0)
    if minute_offset:
        dt = dt + timedelta(minutes=minute_offset)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_release_date(date_value: Optional[str]) -> Optional[str]:
    if not date_value:
        return None
    text = str(date_value).strip()
    if not text:
        return None
    if len(text) == 4 and text.isdigit():
        return f"{text}-01-01"
    if len(text) == 7 and text[4] == "-":
        return f"{text}-01"
    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        return text
    return None


def mb_escape_token(value: str) -> str:
    return "".join(ch for ch in value if ch not in '+-&|!(){}[]^"~*?:\\/')


def mb_fetch_json(url: str, timeout: float = 12.0) -> Dict[str, Any]:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=timeout) as resp:
        payload = resp.read().decode("utf-8")
    data = json.loads(payload)
    if not isinstance(data, dict):
        return {}
    return data


def fetch_cover_url_for_release_group(release_group_mbid: str) -> Optional[str]:
    if not release_group_mbid:
        return None
    return f"https://coverartarchive.org/release-group/{quote(release_group_mbid)}/front"


def lookup_musicbrainz_album(title: str, artist: str) -> Dict[str, Optional[str]]:
    """
    Resolve metadata close to importAlbumFromMusicBrainz:
    - artist_mbid
    - album_mbid (release-group MBID canonical)
    - release_date normalized
    - cover_url (release-group endpoint)
    """
    safe_title = mb_escape_token(title).strip()
    safe_artist = mb_escape_token(artist).strip()
    if not safe_title:
        return {
            "artist_name": artist,
            "artist_mbid": None,
            "album_mbid": None,
            "release_date": None,
            "cover_url": None,
        }

    if safe_artist:
        lucene_query = f'releasegroup:"{safe_title}" AND artist:{safe_artist}'
    else:
        lucene_query = f'releasegroup:"{safe_title}"'

    params = urlencode(
        {
            "query": lucene_query,
            "fmt": "json",
            "limit": "5",
            "inc": "releases",
        }
    )
    url = f"{MUSICBRAINZ_API}/release-group?{params}"

    try:
        data = mb_fetch_json(url)
        release_groups = data.get("release-groups") or []
        if not release_groups:
            return {
                "artist_name": artist,
                "artist_mbid": None,
                "album_mbid": None,
                "release_date": None,
                "cover_url": None,
            }

        best = sorted(release_groups, key=lambda rg: rg.get("score", 0), reverse=True)[0]
        artist_credit = best.get("artist-credit") or []
        artist_data = (artist_credit[0] or {}).get("artist") if artist_credit else {}

        artist_name = (artist_data or {}).get("name") or artist
        artist_mbid = (artist_data or {}).get("id")
        album_mbid = best.get("id")
        release_date = normalize_release_date(best.get("first-release-date"))
        cover_url = fetch_cover_url_for_release_group(album_mbid) if album_mbid else None

        return {
            "artist_name": artist_name,
            "artist_mbid": artist_mbid,
            "album_mbid": album_mbid,
            "release_date": release_date,
            "cover_url": cover_url,
        }
    except Exception:
        return {
            "artist_name": artist,
            "artist_mbid": None,
            "album_mbid": None,
            "release_date": None,
            "cover_url": None,
        }


def ensure_profile(client: Client, user_id: str, payload_user: Dict[str, Any]) -> None:
    created_at = to_iso_timestamp(payload_user.get("created_at", "2025-01-01"))
    username = str(payload_user["username"]).strip()
    bio = str(payload_user.get("bio", "") or "")

    client.table("profiles").upsert(
        {
            "id": user_id,
            "username": username,
            "display_name": username,
            "bio": bio,
            "created_at": created_at,
        },
        on_conflict="id",
    ).execute()


def get_or_create_artist(
    client: Client,
    artist_name: str,
    artist_mbid: Optional[str],
    artist_cache: Dict[str, str],
) -> str:
    key = artist_name.strip()
    if key in artist_cache:
        return artist_cache[key]

    if artist_mbid:
        found_by_mbid = client.table("artists").select("id,name,mbid").eq("mbid", artist_mbid).limit(1).execute()
        data_by_mbid = getattr(found_by_mbid, "data", None) or []
        if data_by_mbid:
            artist_id = data_by_mbid[0]["id"]
            artist_cache[key] = artist_id
            return artist_id

    found = client.table("artists").select("id,mbid").eq("name", key).limit(1).execute()
    data = getattr(found, "data", None) or []
    if data:
        artist_id = data[0]["id"]
        if artist_mbid and not data[0].get("mbid"):
            client.table("artists").update({"mbid": artist_mbid}).eq("id", artist_id).execute()
        artist_cache[key] = artist_id
        return artist_id

    payload: Dict[str, Any] = {"name": key}
    if artist_mbid:
        payload["mbid"] = artist_mbid

    inserted = client.table("artists").insert(payload).execute()
    inserted_data = getattr(inserted, "data", None) or []
    if not inserted_data:
        retry = client.table("artists").select("id").eq("name", key).limit(1).execute()
        retry_data = getattr(retry, "data", None) or []
        if not retry_data:
            raise RuntimeError(f"Unable to create artist: {key}")
        artist_id = retry_data[0]["id"]
    else:
        artist_id = inserted_data[0]["id"]

    artist_cache[key] = artist_id
    return artist_id


def get_or_create_album(
    client: Client,
    artist_id: str,
    album_title: str,
    album_mbid: Optional[str],
    release_date: Optional[str],
    cover_url: Optional[str],
    album_cache: Dict[Tuple[str, str], str],
) -> str:
    key = (artist_id, album_title.strip())
    if key in album_cache:
        return album_cache[key]

    if album_mbid:
        found_by_mbid = client.table("albums").select("id").eq("mbid", album_mbid).limit(1).execute()
        data_by_mbid = getattr(found_by_mbid, "data", None) or []
        if data_by_mbid:
            album_id = data_by_mbid[0]["id"]
            album_cache[key] = album_id
            return album_id

    found = (
        client.table("albums")
        .select("id,mbid,release_date,cover_url")
        .eq("artist_id", artist_id)
        .eq("title", key[1])
        .limit(1)
        .execute()
    )
    data = getattr(found, "data", None) or []
    if data:
        album_id = data[0]["id"]
        updates: Dict[str, Any] = {}
        if album_mbid and not data[0].get("mbid"):
            updates["mbid"] = album_mbid
        if release_date and not data[0].get("release_date"):
            updates["release_date"] = release_date
        if cover_url and not data[0].get("cover_url"):
            updates["cover_url"] = cover_url
        if updates:
            client.table("albums").update(updates).eq("id", album_id).execute()
        album_cache[key] = album_id
        return album_id

    payload: Dict[str, Any] = {
        "artist_id": artist_id,
        "title": key[1],
        "mbid": album_mbid,
        "release_date": release_date,
        "cover_url": cover_url,
    }
    inserted = client.table("albums").insert(payload).execute()
    inserted_data = getattr(inserted, "data", None) or []
    if not inserted_data:
        retry = (
            client.table("albums")
            .select("id")
            .eq("artist_id", artist_id)
            .eq("title", key[1])
            .limit(1)
            .execute()
        )
        retry_data = getattr(retry, "data", None) or []
        if not retry_data:
            raise RuntimeError(f"Unable to create album: {key[1]} ({artist_id})")
        album_id = retry_data[0]["id"]
    else:
        album_id = inserted_data[0]["id"]

    album_cache[key] = album_id
    return album_id


def reset_user_diary_entries(client: Client, user_id: str) -> None:
    client.table("diary_entries").delete().eq("user_id", user_id).execute()


def to_int_rating(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        rating = int(value)
    except Exception:
        return None
    return max(0, min(10, rating))


def insert_diary_entries(
    client: Client,
    user_id: str,
    logs: List[Dict[str, Any]],
    artist_cache: Dict[str, str],
    album_cache: Dict[Tuple[str, str], str],
    metadata_cache: Dict[Tuple[str, str], Dict[str, Optional[str]]],
    strict_mb: bool,
) -> int:
    rows: List[Dict[str, Any]] = []

    for i, log in enumerate(logs):
        title = str(log.get("title", "")).strip()
        artist = str(log.get("artist", "")).strip()
        if not title or not artist:
            continue

        cache_key = (artist.lower(), title.lower())
        metadata = metadata_cache.get(cache_key)
        if metadata is None:
            metadata = lookup_musicbrainz_album(title, artist)
            metadata_cache[cache_key] = metadata

        artist_name = metadata.get("artist_name") or artist
        artist_mbid = metadata.get("artist_mbid")
        album_mbid = metadata.get("album_mbid")
        release_date = metadata.get("release_date")
        cover_url = metadata.get("cover_url")

        if strict_mb and (not artist_mbid or not album_mbid):
            raise RuntimeError(
                f"Strict MB mode: missing MBID for '{artist} - {title}' "
                f"(artist_mbid={artist_mbid}, album_mbid={album_mbid})"
            )

        artist_id = get_or_create_artist(client, artist_name, artist_mbid, artist_cache)
        album_id = get_or_create_album(
            client,
            artist_id,
            title,
            album_mbid,
            release_date,
            cover_url,
            album_cache,
        )

        created_at = to_iso_timestamp(log.get("created_at", "2025-02-01"), minute_offset=i)
        rating = to_int_rating(log.get("rating"))
        review_body = log.get("review")
        if review_body is not None:
            review_body = str(review_body).strip() or None

        rows.append(
            {
                "user_id": user_id,
                "album_id": album_id,
                "listened_at": created_at,
                "rating": rating,
                "review_body": review_body,
                "is_public": True,
                "created_at": created_at,
            }
        )

    if rows:
        client.table("diary_entries").upsert(rows, on_conflict="user_id,album_id,listened_at").execute()
    return len(rows)


def main() -> None:
    args = parse_args()

    supabase_url = read_required_env("NEXT_PUBLIC_SUPABASE_URL")
    service_key = read_required_env("SUPABASE_SERVICE_KEY")
    password = (args.password or os.getenv("SEED_USERS_PASSWORD", "")).strip()
    if not password:
        raise RuntimeError("Provide --password or SEED_USERS_PASSWORD")

    input_path = Path(args.input)
    users = parse_input_file(input_path)

    client = create_client(supabase_url, service_key)
    known_by_email = fetch_users_by_email(client)

    artist_cache: Dict[str, str] = {}
    album_cache: Dict[Tuple[str, str], str] = {}
    metadata_cache: Dict[Tuple[str, str], Dict[str, Optional[str]]] = {}

    total_profiles = 0
    total_entries = 0

    for payload_user in users:
        username = str(payload_user.get("username", "")).strip()
        if not username:
            continue

        user_id = ensure_auth_user(client, username, password, known_by_email)
        ensure_profile(client, user_id, payload_user)
        total_profiles += 1

        if args.reset:
            reset_user_diary_entries(client, user_id)

        logs = payload_user.get("logs") or []
        if not isinstance(logs, list):
            logs = []

        if args.strict_mb:
            print(f"[seed] strict MB ON for {username}")
        inserted = insert_diary_entries(
            client,
            user_id,
            logs,
            artist_cache,
            album_cache,
            metadata_cache,
            args.strict_mb,
        )
        total_entries += inserted
        print(f"[seed] {username}: {inserted} diary entries")

    print("[seed] done")
    print(f"[seed] profiles upserted: {total_profiles}")
    print(f"[seed] diary entries inserted: {total_entries}")


if __name__ == "__main__":
    main()
