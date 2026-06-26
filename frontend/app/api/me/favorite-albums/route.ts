import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getAuthUser } from "@/lib/supabase/server";
import { applyRateLimit } from "@/lib/serverRateLimit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FavoriteAlbumInput = {
  album_id: string;
  position: number;
};

function parseFavoriteAlbumsBody(value: unknown): FavoriteAlbumInput[] | null {
  if (!value || typeof value !== "object" || !Array.isArray((value as { albums?: unknown }).albums)) {
    return null;
  }

  const seenPositions = new Set<number>();
  const albums: FavoriteAlbumInput[] = [];

  for (const item of (value as { albums: unknown[] }).albums.slice(0, 3)) {
    if (!item || typeof item !== "object") return null;

    const albumId = (item as { album_id?: unknown }).album_id;
    const position = (item as { position?: unknown }).position;

    if (typeof albumId !== "string" || !UUID_RE.test(albumId)) return null;
    if (typeof position !== "number" || !Number.isInteger(position) || position < 1 || position > 3) return null;
    if (seenPositions.has(position)) return null;

    seenPositions.add(position);
    albums.push({ album_id: albumId, position });
  }

  return albums;
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

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
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServer();

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const albums = parseFavoriteAlbumsBody(rawBody);
  if (!albums) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Replacement runs inside a single Postgres function (replace_favorite_albums)
  // so the delete-old + insert-new steps are atomic: either both happen or
  // neither does, instead of risking a wiped-out Top 3 if the insert step
  // failed after the old favorites were already deleted.
  // `replace_favorite_albums` isn't in the generated Supabase types yet
  // (same situation as get_trending_albums/get_trending_tracks) — cast until
  // database.ts is regenerated.
  const { error } = await (supabase as any).rpc("replace_favorite_albums", {
    p_albums: albums,
  });

  if (error) {
    console.error("[favorite-albums] replace_favorite_albums failed:", error.message);

    if (error.message.includes("ALBUM_NOT_FOUND")) {
      return NextResponse.json({ error: "Invalid album" }, { status: 400 });
    }
    if (
      error.message.includes("INVALID_PAYLOAD") ||
      error.message.includes("INVALID_POSITION") ||
      error.message.includes("DUPLICATE_POSITION") ||
      error.message.includes("DUPLICATE_ALBUM")
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (error.message.includes("UNAUTHENTICATED")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Unable to save favorite albums" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
