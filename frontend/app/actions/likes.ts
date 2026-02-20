"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/server";

export async function getLikeInfo(entryId: string) {
  const supabase = await createSupabaseServer();
  const user = await getAuthUser();

  // Get like count
  const { count } = await supabase
    .from("diary_likes")
    .select("*", { count: "exact" })
    .eq("entry_id", entryId);

  // Check if current user liked it
  let isLiked = false;
  if (user) {
    const { data: like } = await supabase
      .from("diary_likes")
      .select("id")
      .eq("entry_id", entryId)
      .eq("user_id", user.id)
      .maybeSingle();

    isLiked = !!like;
  }

  return {
    count: count || 0,
    isLiked,
  };
}
