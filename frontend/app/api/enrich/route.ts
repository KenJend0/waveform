import { NextRequest, NextResponse } from 'next/server';
import { enrichAlbumMetadata } from '@/app/actions/metadata';
import { createSupabaseAdmin, getAuthUser } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/serverRateLimit';

export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseBody(value: unknown): { albumId: string } | null {
  if (!value || typeof value !== 'object') return null;
  const albumId = (value as { albumId?: unknown }).albumId;
  if (typeof albumId !== 'string' || !UUID_RE.test(albumId)) return null;
  return { albumId };
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req);
  if (limited) return limited;

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const body = parseBody(rawBody);
    if (!body) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Vérifie que l'album existe avant d'enrichir
    const { data: album } = await supabase
      .from('albums')
      .select('id, mbid, title, artists(name)')
      .eq('id', body.albumId)
      .maybeSingle();

    const artistName = (album?.artists as { name?: string } | null)?.name ?? null;
    if (!album?.mbid || !album.title || !artistName) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const result = await enrichAlbumMetadata(album.id, album.mbid, album.title, artistName, true);

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
