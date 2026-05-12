import { NextRequest, NextResponse } from 'next/server';
import { enrichAlbumMetadata } from '@/app/actions/metadata';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/serverRateLimit';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req);
  if (limited) return limited;

  try {
    const { albumId, mbid, title, artist } = await req.json();
    if (!albumId || !mbid || !title || !artist) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Vérifie que l'album existe avant d'enrichir
    const { data: album } = await supabase
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .maybeSingle();

    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const result = await enrichAlbumMetadata(albumId, mbid, title, artist, true);

    return NextResponse.json({
      ok: true,
      genres: result.genres,
      hasDescription: result.hasDescription,
      mbTagsRaw: result.mbTagsRaw,
      lfmTagsRaw: result.lfmTagsRaw,
      errors: result.errors,
    });
  } catch (err) {
    console.error('[/api/enrich] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
