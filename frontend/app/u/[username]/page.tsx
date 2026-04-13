import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getAuthUser, createSupabaseAdmin } from "@/lib/supabase/server";

export async function generateMetadata({ params }: any) {
  const resolvedParams = params && typeof params.then === "function" ? await params : params;
  const { username } = resolvedParams;
  const supabase = await createSupabaseServer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (!profile) return { title: `@${username}` };

  return {
    title: `@${username}`,
    description: `Profil de @${username}`,
    openGraph: {
      images: profile.avatar_url ? [{ url: profile.avatar_url }] : [],
    },
  };
}

import FollowButton from "@/components/social/FollowButton";
import ProfileActionsMenu from "@/components/social/ProfileActionsMenu";
import BackButton from "@/components/BackButton";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import PublicProfileTabs from "@/components/profile/PublicProfileTabs";
import { getUserDiary } from "@/app/actions/diary";
import { getUserSavedAlbums } from "@/app/actions/saved-albums";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const resolvedParams = await params;
  const username = resolvedParams.username;
  const supabase = await createSupabaseServer();
  const authUser = await getAuthUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, bio, created_at, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return (
      <main className="max-w-page mx-auto px-4 sm:px-6 py-6">
        <BackButton />
        <div className="mt-16 text-center">
          <h1 className="text-h2 text-text-primary mb-2">Utilisateur non trouvé</h1>
          <p className="text-text-tertiary text-[14px]">Le profil @{username} n&apos;existe pas</p>
        </div>
      </main>
    );
  }

  if (authUser && authUser.id === profile.id) {
    redirect("/me");
  }

  // ── Counts, diary, saved ────────────────────────────────
  const adminClient = createSupabaseAdmin();
  const [
    { count: followersCount },
    { count: followingCount },
    { count: diaryCount },
    profileDiary,
    profileSaved,
    favoriteAlbumsResult,
  ] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
    supabase.from("diary_entries").select("*", { count: "exact", head: true }).eq("user_id", profile.id).eq("is_public", true),
    getUserDiary(profile.id),
    getUserSavedAlbums(profile.id),
    adminClient
      .from("user_favorite_albums")
      .select("position, album_id, albums (id, title, cover_url, artists (name))")
      .eq("user_id", profile.id)
      .order("position", { ascending: true })
      .limit(3),
  ]);

  const favoriteAlbums = (favoriteAlbumsResult.data || []).map((item: any) => ({
    id: (item.albums as any)?.id || item.album_id,
    title: (item.albums as any)?.title || "Album inconnu",
    artist_name: (item.albums as any)?.artists?.name || "Artiste inconnu",
    cover_url: (item.albums as any)?.cover_url ?? null,
    position: item.position,
  }));

  let isFollowing = false;
  let isFollowingYou = false;
  let isBlocking = false;
  let myListenedAlbums: Record<string, number | null> = {};
  let mySavedAlbumIds: string[] = [];

  if (authUser) {
    // Run follow/block checks and current user lookups in parallel (single roundtrip)
    const [
      { data: followStatus },
      { data: followBackStatus },
      { data: blockStatus },
      myDiaryRes,
      mySavedRes,
    ] = await Promise.all([
      supabase.from("follows").select("follower_id").eq("follower_id", authUser.id).eq("followee_id", profile.id).maybeSingle(),
      supabase.from("follows").select("follower_id").eq("follower_id", profile.id).eq("followee_id", authUser.id).maybeSingle(),
      (supabase as any).from("user_blocks").select("blocked_id").eq("blocker_id", authUser.id).eq("blocked_id", profile.id).maybeSingle(),
      supabase.from("diary_entries").select("album_id, rating").eq("user_id", authUser.id),
      supabase.from("saved_albums").select("album_id").eq("user_id", authUser.id),
    ]);

    isFollowing = !!followStatus;
    isFollowingYou = !!followBackStatus;
    isBlocking = !!blockStatus;

    (myDiaryRes.data || []).forEach((e) => {
      myListenedAlbums[e.album_id] = e.rating;
    });
    mySavedAlbumIds.push(...(mySavedRes.data || []).map((e) => e.album_id));
  }

  const displayName = username;
  const bio = (profile as any).bio || "";

  // ── Profil bloqué ───────────────────────────────────────────────────────
  if (isBlocking) {
    return (
      <main className="max-w-page mx-auto px-4 sm:px-6 py-6">
        <BackButton />
        <div className="mt-8 flex items-start gap-5">
          <div className="flex-shrink-0 rounded-full border border-border overflow-hidden">
            <div style={{ width: "80px", height: "80px" }}>
              <UserAvatar userId={profile.id} src={(profile as any).avatar_url} size={80} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] font-medium text-text-primary tracking-[-0.02em] leading-[1.2]">
              {displayName}
            </h1>
            <p className="text-[12px] text-text-tertiary mt-0.5">@{username}</p>
            <div className="mt-3">
              <ProfileActionsMenu userId={profile.id} initialIsBlocking={true} />
            </div>
          </div>
        </div>
        <p className="text-[14px] text-text-tertiary mt-8">
          Tu as bloqué cet utilisateur. Son contenu est masqué.
        </p>
      </main>
    );
  }

  // Public diary entries only
  const publicDiary = profileDiary.filter((e) => (e as any).is_public !== false);

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-background-secondary border-b border-border-divider">
        <div className="max-w-page mx-auto px-4 sm:px-6 py-8">
          <BackButton />

          {/* Avatar + Name + Follow */}
          <div className="mt-8 flex items-start gap-5">
            <div className="flex-shrink-0 rounded-full border border-border overflow-hidden">
              <div style={{ width: "80px", height: "80px" }}>
                <UserAvatar userId={profile.id} src={(profile as any).avatar_url} size={80} />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-[24px] font-medium text-text-primary tracking-[-0.02em] leading-[1.2]">
                {displayName}
              </h1>
              <p className="text-[12px] text-text-tertiary mt-0.5">@{username}</p>

              {authUser && authUser.id !== profile.id && (
                <div className="flex items-center gap-3 mt-3">
                  <FollowButton userId={profile.id} initialIsFollowing={isFollowing} />
                  {isFollowingYou && (
                    <span className="text-[12px] text-text-tertiary">Vous suit</span>
                  )}
                  <ProfileActionsMenu userId={profile.id} initialIsBlocking={false} />
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {bio && (
            <p className="text-[14px] text-text-secondary leading-relaxed max-w-lg mt-5">{bio}</p>
          )}

          {/* Stats */}
          <div className="flex gap-6 text-[12px] text-text-tertiary mt-6">
            <span>
              <span className="font-medium text-text-primary">{diaryCount || 0}</span>{" "}
              écoute{diaryCount !== 1 ? "s" : ""}
            </span>
            <Link
              href={`/u/${username}/followers`}
              className="hover:text-text-primary transition-colors duration-150"
            >
              <span className="font-medium text-text-primary">{followersCount || 0}</span>{" "}
              abonné{followersCount !== 1 ? "s" : ""}
            </Link>
            <Link
              href={`/u/${username}/following`}
              className="hover:text-text-primary transition-colors duration-150"
            >
              <span className="font-medium text-text-primary">{followingCount || 0}</span>{" "}
              abonnements
            </Link>
          </div>
        </div>
      </div>

      {/* ── Top 3 + Tabs ───────────────────────────────────────────────── */}
      <PublicProfileTabs
        profileUserId={profile.id}
        username={username}
        diaryEntries={publicDiary}
        savedAlbums={profileSaved}
        myListenedAlbums={myListenedAlbums}
        mySavedAlbumIds={mySavedAlbumIds}
        isLoggedIn={!!authUser}
        favoriteAlbums={favoriteAlbums}
      />
    </>
  );
}
