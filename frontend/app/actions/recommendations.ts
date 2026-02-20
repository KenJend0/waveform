'use server';

import { getAuthUser, createSupabaseServer } from '@/lib/supabase/server';

export async function createRecommendation({
  albumId,
  recommendedToId,
  message,
}: {
  albumId: string;
  recommendedToId: string | null;
  message: string | null;
}) {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const supabase = await createSupabaseServer();

  const { error } = await supabase.from('recommendations' as any).insert({
    recommended_by_id: user.id,
    recommended_to_id: recommendedToId || null,
    album_id: albumId,
    message: message || null,
  });

  if (error) return { ok: false, error: error.message };

  // Create a notification for private recommendations
  if (recommendedToId) {
    await supabase.from('notifications' as any).insert({
      user_id: recommendedToId,
      actor_id: user.id,
      type: 'recommendation',
    }).then(() => {});  // fire-and-forget, non-blocking
  }

  return { ok: true };
}
