"use server";

import { logAuthedProductEvent } from "@/lib/productEvents";
import { createSupabaseServer } from "@/lib/supabase/server";

export type SearchResultUI = {
  id: string;
  releaseId?: string;    // MB release MBID when source=musicbrainz+kind=album (for import & cover fallback)
  title: string;
  subtitle?: string;
  slug?: string;         // for users: actual username used in URLs (≠ display_name)
  kind: "album" | "artist" | "user";
  coverUrl?: string | null;
  releaseDate?: string | null;
  source: "internal" | "musicbrainz";
  score?: number;        // MB relevance score 0-100 — used for client-side re-ranking
  releaseCount?: number; // number of MB releases — proxy for album popularity
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
  kind: "all" | "albums" | "artists" | "users" = "all"
): Promise<SearchResultUI[]> {
  if (!q.trim()) return [];

  const supabase = await createSupabaseServer();
  const trimmed = q.trim();
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
        .textSearch("search_vector", trimmed, { type: "websearch", config: "english" })
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
        .textSearch("search_vector", trimmed, { type: "websearch", config: "english" })
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

  // Run all needed queries in parallel
  const [albumsData, artistsData, usersData] = await Promise.all([
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