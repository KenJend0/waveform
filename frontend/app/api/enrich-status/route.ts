import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const albumId = req.nextUrl.searchParams.get('albumId');
  if (!albumId) return NextResponse.json({ ready: false });

  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from('album_metadata')
    .select('fetched_at')
    .eq('album_id', albumId)
    .maybeSingle();

  return NextResponse.json({ ready: !!data?.fetched_at });
}
