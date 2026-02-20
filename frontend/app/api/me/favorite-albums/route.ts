import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getAuthUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .limit(3);

  if (error) {
    return NextResponse.json({ albums: [] });
  }

  const albums = (data || []).map((item) => ({
    id: (item.albums as any)?.id || item.album_id,
    title: (item.albums as any)?.title || "Album inconnu",
    artist_name: (item.albums as any)?.artists?.name || "Artiste inconnu",
    cover_url: (item.albums as any)?.cover_url ?? null,
    position: item.position,
  }));

  return NextResponse.json({ albums });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServer();

  let body: { albums: { album_id: string; position: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const albums = (body.albums || [])
    .filter((a) => a.album_id && a.position >= 1 && a.position <= 3)
    .slice(0, 3);

  // Delete existing favorites
  await supabase
    .from("user_favorite_albums")
    .delete()
    .eq("user_id", user.id);

  // Insert new favorites
  if (albums.length > 0) {
    const { error } = await supabase
      .from("user_favorite_albums")
      .insert(albums.map((a) => ({
        user_id: user.id,
        album_id: a.album_id,
        position: a.position,
      })));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
