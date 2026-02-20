'use server';

import { createSupabaseServer, getAuthUser } from '@/lib/supabase/server';

type MyAlbumEntry = {
  id: string;
  rating: number | null;
  review_body: string | null;
  listened_at: string;
  created_at: string;
};

type MyAlbumProfile = {
  display_name: string | null;
  username: string | null;
};

export async function getMyAlbumEntries(albumId: string): Promise<{
  entries: MyAlbumEntry[];
  profile: MyAlbumProfile | null;
  error: string | null;
}> {
  const user = await getAuthUser();
  if (!user) {
    return { entries: [], profile: null, error: 'Not authenticated' };
  }

  const supabase = await createSupabaseServer();

  const { data: entries, error: entriesError } = await supabase
    .from('diary_entries')
    .select('id, rating, review_body, listened_at, created_at')
    .eq('album_id', albumId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', user.id)
    .maybeSingle();

  return {
    entries: entries ?? [],
    profile: profile ?? null,
    error: entriesError?.message ?? null,
  };
}
