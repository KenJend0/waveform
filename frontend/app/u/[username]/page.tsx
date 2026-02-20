import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/server";

export async function generateMetadata({ params }: any) {
  const resolvedParams = params && typeof params.then === "function" ? await params : params;
  const { username } = resolvedParams;
  const supabase = await createSupabaseServer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (!profile) return { title: `@${username}` };

  return {
    title: profile.display_name || `@${username}`,
    description: profile.display_name ? `Profil de ${profile.display_name}` : `Profil de @${username}`,
    openGraph: {
      images: profile.avatar_url ? [{ url: profile.avatar_url }] : [],
    },
  };
}
import FollowButton from "@/components/social/FollowButton";
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
    .select("id, display_name, bio, created_at, avatar_url")
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

  // ── Counts, diary, saved, follow status ────────────────────────────────
  const [
    { count: followersCount },
    { count: followingCount },
    { count: diaryCount },
    profileDiary,
    profileSaved,
  ] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
    supabase.from("diary_entries").select("*", { count: "exact", head: true }).eq("user_id", profile.id).eq("is_public", true),
    getUserDiary(profile.id),
    getUserSavedAlbums(profile.id),
  ]);

  let isFollowing = false;
  let isFollowingYou = false;

  if (authUser) {
    const [{ data: followStatus }, { data: followBackStatus }] = await Promise.all([
      supabase.from("follows").select("follower_id").eq("follower_id", authUser.id).eq("followee_id", profile.id).maybeSingle(),
      supabase.from("follows").select("follower_id").eq("follower_id", profile.id).eq("followee_id", authUser.id).maybeSingle(),
    ]);
    isFollowing = !!followStatus;
    isFollowingYou = !!followBackStatus;
  }

  // ── Current user's data for filters & sort ─────────────────────────────
  const myListenedAlbums: Record<string, number | null> = {};
  const mySavedAlbumIds: string[] = [];

  if (authUser) {
    const [myDiaryRes, mySavedRes] = await Promise.all([
      supabase.from("diary_entries").select("album_id, rating").eq("user_id", authUser.id),
      supabase.from("saved_albums").select("album_id").eq("user_id", authUser.id),
    ]);
    (myDiaryRes.data || []).forEach((e) => {
      myListenedAlbums[e.album_id] = e.rating;
    });
    mySavedAlbumIds.push(...(mySavedRes.data || []).map((e) => e.album_id));
  }

  // Public diary entries only
  const publicDiary = profileDiary.filter((e) => (e as any).is_public !== false);
  const displayName = (profile as any).display_name || username;
  const bio = (profile as any).bio || "";

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
      />
    </>
  );
}
