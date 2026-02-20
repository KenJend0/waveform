"use server";

import { createSupabaseServer } from "@/lib/supabase/server";

export type SearchResultUI = {
  id: string;
  title: string;
  subtitle?: string;
  kind: "album" | "artist" | "user";
  coverUrl?: string | null;
  releaseDate?: string | null;
  source: "internal" | "musicbrainz";
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
  const results: SearchResultUI[] = [];
  
  // Escape special characters to prevent SQL injection
  const escapedQuery = escapeILike(q.trim());

  // Albums
  if (kind === "all" || kind === "albums") {
    const { data: albums } = await supabase
      .from("albums")
      .select("id, title, cover_url, release_date, artists(name)")
      .ilike("title", `%${escapedQuery}%`)
      .limit(5);

    albums?.forEach((a) =>
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
  }

  // Artists
  if (kind === "all" || kind === "artists") {
    const { data: artists } = await supabase
      .from("artists")
      .select("id, name")
      .ilike("name", `%${escapedQuery}%`)
      .limit(5);

    artists?.forEach((a) =>
      results.push({
        id: a.id,
        title: a.name,
        kind: "artist",
        source: "internal",
      })
    );
  }

  // Users
  if (kind === "all" || kind === "users") {
    const { data: users } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${escapedQuery}%,display_name.ilike.%${escapedQuery}%`)
      .limit(5);

    users?.forEach((u) => {
      if (u.username) {
        results.push({
          id: u.id,
          title: u.display_name || u.username,
          subtitle: `@${u.username}`,
          kind: "user",
          coverUrl: u.avatar_url,
          source: "internal",
        });
      }
    });
  }

  return results;
}