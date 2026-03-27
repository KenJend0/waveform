import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/server";
import { applyRateLimit } from "@/lib/serverRateLimit";

type SuggestItem = {
  id: string;
  label: string;
  sublabel: string | null;
  cover_url: string | null;
};

function escapeILike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  if (q.length < 2) return NextResponse.json({ items: [] });

  const safeQ = escapeILike(q);

  const supabase = await createSupabaseServer();
  const user = await getAuthUser();

  // Get album IDs from user's diary (only albums they've listened to)
  let albumIds: string[] = [];
  if (user) {
    const { data: entries } = await supabase
      .from("diary_entries")
      .select("album_id")
      .eq("user_id", user.id);
    albumIds = [...new Set((entries || []).map((e) => e.album_id))];
  }

  if (albumIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // Search by album title
  const { data: byTitle } = await supabase
    .from("albums")
    .select("id, title, cover_url, artists(id, name)")
    .in("id", albumIds)
    .ilike("title", `%${safeQ}%`)
    .limit(limit);

  // Search by artist name
  const { data: matchingArtists } = await supabase
    .from("artists")
    .select("id")
    .ilike("name", `%${safeQ}%`);

  const artistIds = (matchingArtists || []).map((a) => a.id);

  const { data: byArtist } = artistIds.length > 0
    ? await supabase
        .from("albums")
        .select("id, title, cover_url, artists(id, name)")
        .in("id", albumIds)
        .in("artist_id", artistIds)
        .limit(limit)
    : { data: [] };

  // Merge and deduplicate
  const all = [...(byTitle || []), ...(byArtist || [])];
  const seen = new Set<string>();
  const unique = all.filter((a) => !seen.has(a.id) && seen.add(a.id));

  const items: SuggestItem[] = unique.slice(0, limit).map((a) => ({
    id: a.id,
    label: a.title,
    sublabel: (a.artists as any)?.name ?? null,
    cover_url: a.cover_url ?? null,
  }));

  return NextResponse.json({ items });
}
