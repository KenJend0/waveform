import { NextRequest, NextResponse } from 'next/server';
import { enrichAlbumMetadata } from '@/app/actions/metadata';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { albumId, mbid, title, artist } = await req.json();
    if (!albumId || !mbid || !title || !artist) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    // Vérifie que l'album existe avant d'enrichir
    const supabase = createSupabaseAdmin();
    const { data: album } = await supabase
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .maybeSingle();

    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    await enrichAlbumMetadata(albumId, mbid, title, artist);

    // Renvoie ce qui a été enrichi pour le feedback UI
    const [genresResult, metaResult] = await Promise.all([
      supabase.from('album_genres').select('*', { count: 'exact', head: true }).eq('album_id', albumId),
      supabase.from('album_metadata').select('description').eq('album_id', albumId).maybeSingle(),
    ]);

    return NextResponse.json({
      ok: true,
      genres: genresResult.count ?? 0,
      hasDescription: !!metaResult.data?.description,
    });
  } catch (err) {
    console.error('[/api/enrich] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
