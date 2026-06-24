import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { applyRateLimit } from "@/lib/serverRateLimit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const { userId } = await params;

  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ albums: [] });
  }

  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("user_favorite_albums")
    .select(`
      id,
      position,
      album_id,
      albums (
        id,
        title,
        cover_url,
        artists (
          id,
          name
        )
      )
    `)
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .limit(3);

  if (error) {
    console.error("Error fetching favorite albums:", error);
    return NextResponse.json({ albums: [] });
  }

  const albums = (data || []).map((item: any) => ({
    id: item.albums?.id || item.album_id,
    title: item.albums?.title || "Album inconnu",
    artist_name: item.albums?.artists?.name || "Artiste inconnu",
    cover_url: item.albums?.cover_url ?? null,
    position: item.position,
  }));

  return NextResponse.json({ albums });
}
