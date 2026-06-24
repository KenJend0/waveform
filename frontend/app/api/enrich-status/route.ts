import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/serverRateLimit';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req);
  if (limited) return limited;

  const albumId = req.nextUrl.searchParams.get('albumId');
  if (!albumId || !UUID_RE.test(albumId)) {
    return NextResponse.json({ ready: false });
  }

  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from('album_metadata')
    .select('fetched_at')
    .eq('album_id', albumId)
    .maybeSingle();

  return NextResponse.json({ ready: !!data?.fetched_at });
}
