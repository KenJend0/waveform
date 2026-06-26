"use server";

import { createSupabaseServer, getAuthUser } from "@/lib/supabase/server";

export async function getFollowingList(username: string) {
  const supabase = await createSupabaseServer();
  const currentUser = await getAuthUser();

  try {
    // Récupérer l'utilisateur par username
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (profileError || !profile) {
      return { success: false, error: "User not found" };
    }

    // Récupérer les IDs des utilisateurs que cette personne suit
    const { data: follows, error: followsError } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", profile.id)
      .limit(2000);

    if (followsError) {
      return { success: false, error: followsError.message };
    }

    const followeeIds = (follows || []).map((f) => f.followee_id);

    if (followeeIds.length === 0) {
      return { success: true, items: [] };
    }

    // Récupérer les profils des utilisateurs suivis
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", followeeIds);

    if (profilesError) {
      return { success: false, error: profilesError.message };
    }

    // Transformer les données
    const currentUserId = currentUser?.id || null;
    let followingIds = new Set<string>();

    if (currentUserId && profiles && profiles.length > 0) {
      const profileIds = profiles.map((p) => p.id);
      const { data: following } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", currentUserId)
        .in("followee_id", profileIds);

      followingIds = new Set((following || []).map((f) => f.followee_id));
    }

    const items = (profiles || []).map((p) => ({
      id: p.id,
      username: p.username || '',
      display_name: p.display_name,
      picture_url: p.avatar_url ?? undefined,
      is_following: currentUserId ? followingIds.has(p.id) : false,
      is_me: currentUserId ? p.id === currentUserId : false,
    }));

    return { success: true, items };
  } catch (error) {
    console.error("Error fetching following list:", error);
    return { success: false, error: "Failed to fetch following list" };
  }
}
