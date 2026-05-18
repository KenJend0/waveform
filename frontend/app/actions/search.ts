"use server";

import { logAuthedProductEvent } from "@/lib/productEvents";
import { createSupabaseServer } from "@/lib/supabase/server";

export type SearchResultUI = {
  id: string;
  releaseId?: string;    // MB release MBID when source=musicbrainz+kind=album (for import & cover fallback)
  recordingMbid?: string; // MB recording MBID when source=musicbrainz+kind=track (for import)
  title: string;
  subtitle?: string;
  slug?: string;         // for users: actual username used in URLs (≠ display_name)
  kind: "album" | "artist" | "user" | "track";
  coverUrl?: string | null;
  releaseDate?: string | null;
  source: "internal" | "musicbrainz";
  score?: number;        // MB relevance score 0-100 — used for client-side re-ranking
  releaseCount?: number; // number of MB releases — proxy for album popularity
  // For kind="track" internal results — needed to submit diary entry
  trackAlbumId?: string;
  trackArtistId?: string;
};

/**
 * Escape special characters for ILIKE pattern matching
 * Prevents SQL injection with % and _ characters
 */
function escapeILike(str: string): string {
  return str.replace(/[%_]/g, '\\$&');
}

export async function searchInternal(
  q: string,
  kind: "all" | "albums" | "artists" | "users" | "tracks" = "all"
): Promise<SearchResultUI[]> {
  if (!q.trim()) return [];

  const supabase = await createSupabaseServer();
  const trimmed = q.trim();
  // Remove accents for FTS so "cafe" matches stored "café" (and vice-versa).
  // The stored tsvector uses immutable_unaccent(), so both sides must be normalized.
  const trimmedUnaccented = trimmed.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const escapedQuery = escapeILike(trimmed);

  // Use full-text search for 3+ character queries (handles accents, apostrophes, multi-word)
  // Fall back to ILIKE for very short queries where tokenization is unreliable
  const useTextSearch = trimmed.length >= 3;

  // Albums: textSearch with ILIKE fallback if column doesn't exist yet (migration pending)
  const albumsQuery = async () => {
    if (kind !== "all" && kind !== "albums") return { data: null };
    if (useTextSearch) {
      const r = await supabase
        .from("albums")
        .select("id, title, cover_url, release_date, artists(name)")
        .textSearch("search_vector", trimmedUnaccented, { type: "websearch", config: "simple" })
        .limit(5);
      if (!r.error) return r;
      // search_vector column doesn't exist yet — fall back to ILIKE
    }
    return supabase
      .from("albums")
      .select("id, title, cover_url, release_date, artists(name)")
      .ilike("title", `%${escapedQuery}%`)
      .limit(5);
  };

  // Artists: textSearch with ILIKE fallback if column doesn't exist yet (migration pending)
  const artistsQuery = async () => {
    if (kind !== "all" && kind !== "artists") return { data: null };
    if (useTextSearch) {
      const r = await (supabase
        .from("artists")
        .select("id, name, image_url, albums(id)") as any)
        .textSearch("search_vector", trimmedUnaccented, { type: "websearch", config: "simple" })
        .limit(5);
      if (!r.error) return r;
      // search_vector column doesn't exist yet — fall back to ILIKE
    }
    return (supabase
      .from("artists")
      .select("id, name, image_url, albums(id)") as any)
      .ilike("name", `%${escapedQuery}%`)
      .limit(5);
  };

  // Tracks: ILIKE on title, joined with album cover and artist name
  const tracksQuery = async () => {
    if (kind !== "tracks") return { data: null };
    return supabase
      .from("tracks")
      .select("id, title, mbid, albums(id, title, cover_url, artists(id, name))")
      .ilike("title", `%${escapedQuery}%`)
      .limit(10) as any;
  };

  // Run all needed queries in parallel
  const [albumsData, artistsData, usersData, tracksData] = await Promise.all([
    albumsQuery(),
    artistsQuery(),
    // Users — always ILIKE (no tsvector on profiles yet, username rarely has accents)
    (kind === "all" || kind === "users")
      ? supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .ilike("username", `%${escapedQuery}%`)
          .limit(5)
      : Promise.resolve({ data: null }),
    tracksQuery(),
  ]);

  const results: SearchResultUI[] = [];

  albumsData.data?.forEach((a: any) =>
    results.push({
      id: a.id,
      title: a.title,
      subtitle: a.artists?.name || "Unknown Artist",
      kind: "album",
      coverUrl: a.cover_url,
      releaseDate: a.release_date,
      source: "internal",
    })
  );

  (artistsData.data || []).forEach((a: any) =>
    results.push({
      id: a.id,
      title: a.name,
      kind: "artist",
      coverUrl: a.image_url || null,
      source: "internal",
    })
  );

  usersData.data?.forEach((u: any) => {
    if (u.username) {
      results.push({
        id: u.id,
        title: u.username,
        subtitle: `@${u.username}`,
        slug: u.username,
        kind: "user",
        coverUrl: u.avatar_url,
        source: "internal",
      });
    }
  });

  const seenTrackKeys = new Set<string>();
  (tracksData.data || []).forEach((t: any) => {
    const album = t.albums as any;
    const artist = album?.artists as any;
    // Deduplicate tracks with same title + artist (different versions on same single)
    const dedupeKey = `${t.title.toLowerCase().trim()}|||${(artist?.name || '').toLowerCase().trim()}`;
    if (seenTrackKeys.has(dedupeKey)) return;
    seenTrackKeys.add(dedupeKey);
    results.push({
      id: t.id,
      title: t.title,
      subtitle: `${artist?.name || 'Unknown'} · ${album?.title || 'Unknown'}`,
      kind: "track",
      coverUrl: album?.cover_url || null,
      source: "internal",
      trackAlbumId: album?.id || '',
      trackArtistId: artist?.id || '',
    });
  });

  // ── Fuzzy fallback via pg_trgm (only when primary queries return nothing) ──
  // Handles typos like "Nirvarna" → "Nirvana", "Radiohed" → "Radiohead".
  // Requires supabase_migration_trgm.sql to be applied.
  const needsAlbumFuzzy = (kind === "all" || kind === "albums") && !results.some((r) => r.kind === "album");
  const needsArtistFuzzy = (kind === "all" || kind === "artists") && !results.some((r) => r.kind === "artist");
  const needsTrackFuzzy = kind === "tracks" && !results.some((r) => r.kind === "track");

  if (needsAlbumFuzzy || needsArtistFuzzy || needsTrackFuzzy) {
    const fuzzyPromises = await Promise.all([
      needsAlbumFuzzy
        ? (supabase as any).rpc("fuzzy_search_albums", { query_text: trimmed, result_limit: 5 })
        : Promise.resolve({ data: null, error: null }),
      needsArtistFuzzy
        ? (supabase as any).rpc("fuzzy_search_artists", { query_text: trimmed, result_limit: 5 })
        : Promise.resolve({ data: null, error: null }),
      needsTrackFuzzy
        ? (supabase as any).rpc("fuzzy_search_tracks", { query_text: trimmed, result_limit: 10 })
        : Promise.resolve({ data: null, error: null }),
    ]);

    const [fuzzyAlbums, fuzzyArtists, fuzzyTracks] = fuzzyPromises;

    (fuzzyAlbums.data || []).forEach((a: any) =>
      results.push({
        id: a.id,
        title: a.title,
        subtitle: a.artist_name || "Unknown Artist",
        kind: "album",
        coverUrl: a.cover_url || null,
        releaseDate: a.release_date || null,
        source: "internal",
      })
    );

    (fuzzyArtists.data || []).forEach((a: any) =>
      results.push({
        id: a.id,
        title: a.name,
        kind: "artist",
        coverUrl: a.image_url || null,
        source: "internal",
      })
    );

    (fuzzyTracks.data || []).forEach((t: any) => {
      const dedupeKey = `${t.title.toLowerCase().trim()}|||${(t.artist_name || '').toLowerCase().trim()}`;
      if (seenTrackKeys.has(dedupeKey)) return;
      seenTrackKeys.add(dedupeKey);
      results.push({
        id: t.id,
        title: t.title,
        subtitle: `${t.artist_name || 'Unknown'} · ${t.album_title || 'Unknown'}`,
        kind: "track",
        coverUrl: t.album_cover || null,
        source: "internal",
        trackAlbumId: t.album_id || '',
        trackArtistId: t.artist_id || '',
      });
    });
  }

  // Client-side similarity ranking: exact > starts-with > contains
  const qLower = trimmed.toLowerCase();
  results.sort((a, b) => {
    const aT = a.title.toLowerCase();
    const bT = b.title.toLowerCase();
    const rankOf = (t: string) => {
      if (t === qLower) return 3;
      if (t.startsWith(qLower)) return 2;
      return 1;
    };
    return rankOf(bT) - rankOf(aT);
  });

  // Fire-and-forget — analytics must not block the search response
  logAuthedProductEvent("search_used", {
    surface: "internal_search",
    properties: {
      kind,
      query_length: trimmed.length,
      result_count: results.length,
    },
  }).catch(() => {});

  if (results.length === 0) {
    logAuthedProductEvent("search_no_results", {
      surface: "internal_search",
      properties: {
        kind,
        query_length: trimmed.length,
      },
    }).catch(() => {});
  }

  return results;
}