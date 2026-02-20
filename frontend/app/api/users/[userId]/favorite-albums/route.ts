import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  // Use service role to bypass RLS — favorite albums are public profile data
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

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
