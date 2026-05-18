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
import Top3Albums from "@/components/profile/Top3Albums";
import RatingDistribution from "@/components/profile/RatingDistribution";
import { getUserDiary, getUserReviewsUnified } from "@/app/actions/diary";
import { getPublicUserLists } from "@/app/actions/lists";
import { getUserTrackDiary } from "@/app/actions/track-diary";

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

  const adminClient = createSupabaseAdmin();
  const [
    { count: followersCount },
    { count: followingCount },
    profileDiary,
    profilePublicLists,
    favoriteAlbumsResult,
    profileTrackDiary,
    profileUnifiedReviews,
  ] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
    getUserDiary(profile.id),
    getPublicUserLists(profile.id),
    adminClient
      .from("user_favorite_albums")
      .select("position, album_id, albums (id, title, cover_url, artists (name))")
      .eq("user_id", profile.id)
      .order("position", { ascending: true })
      .limit(3),
    getUserTrackDiary(profile.id),
    getUserReviewsUnified(profile.id),
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

  if (authUser) {
    const [
      { data: followStatus },
      { data: followBackStatus },
      { data: blockStatus },
      myDiaryRes,
    ] = await Promise.all([
      supabase.from("follows").select("follower_id").eq("follower_id", authUser.id).eq("followee_id", profile.id).maybeSingle(),
      supabase.from("follows").select("follower_id").eq("follower_id", profile.id).eq("followee_id", authUser.id).maybeSingle(),
      (supabase as any).from("user_blocks").select("blocked_id").eq("blocker_id", authUser.id).eq("blocked_id", profile.id).maybeSingle(),
      supabase.from("diary_entries").select("album_id, rating").eq("user_id", authUser.id).limit(2000),
    ]);

    isFollowing = !!followStatus;
    isFollowingYou = !!followBackStatus;
    isBlocking = !!blockStatus;

    (myDiaryRes.data || []).forEach((e) => {
      myListenedAlbums[e.album_id] = e.rating;
    });
  }

  const bio = (profile as any).bio || "";
  const reviewsCount = profileUnifiedReviews.length;
  const publicDiary = profileDiary.filter((e) => (e as any).is_public !== false);

  if (isBlocking) {
    return (
      <main className="max-w-page mx-auto px-4 sm:px-6 py-6">
        <BackButton />
        <div className="mt-8 flex items-start gap-5">
          <div className="flex-shrink-0 rounded-full border border-border overflow-hidden">
            <UserAvatar userId={profile.id} src={(profile as any).avatar_url} size={80} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] font-medium text-text-primary tracking-[-0.02em]">@{username}</h1>
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

  return (
    <>
      {/* BackButton mobile uniquement */}
      <div className="lg:hidden px-4 sm:px-6 pt-4">
        <BackButton />
      </div>

      <div className="lg:flex lg:items-start lg:gap-12 lg:px-8 pb-28 lg:pb-12">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-[72px]">
          {/* Profil */}
          <div className="bg-background-secondary border-b border-border-divider lg:bg-transparent lg:border-0">
            <div className="px-4 sm:px-6 py-8 lg:px-0 lg:py-6">
              <div className="flex gap-5 items-center">
                <div className="flex-shrink-0 rounded-full border border-border overflow-hidden">
                  <div className="w-[80px] h-[80px] lg:w-[96px] lg:h-[96px]">
                    <UserAvatar userId={profile.id} src={(profile as any).avatar_url} size={96} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-[22px] font-medium text-text-primary tracking-[-0.02em] leading-[1.2]">
                    @{username}
                  </h1>
                  {authUser && authUser.id !== profile.id && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <FollowButton userId={profile.id} initialIsFollowing={isFollowing} />
                      {isFollowingYou && (
                        <span className="text-[12px] text-text-tertiary">Vous suit</span>
                      )}
                      <ProfileActionsMenu userId={profile.id} initialIsBlocking={false} />
                    </div>
                  )}
                </div>
              </div>

              {bio && (
                <p className="text-[14px] text-text-secondary leading-relaxed mt-5 whitespace-pre-line">{bio}</p>
              )}

              {/* Stats empilées */}
              <div className="flex gap-8 mt-6">
                <div className="flex flex-col">
                  <span className="text-[18px] font-semibold text-text-primary leading-none">{reviewsCount}</span>
                  <span className="text-[11px] text-text-tertiary mt-1">revue{reviewsCount !== 1 ? "s" : ""}</span>
                </div>
                <Link href={`/u/${username}/followers`} className="flex flex-col hover:opacity-75 transition-opacity duration-150">
                  <span className="text-[18px] font-semibold text-text-primary leading-none">{followersCount || 0}</span>
                  <span className="text-[11px] text-text-tertiary mt-1">abonné{(followersCount || 0) !== 1 ? "s" : ""}</span>
                </Link>
                <Link href={`/u/${username}/following`} className="flex flex-col hover:opacity-75 transition-opacity duration-150">
                  <span className="text-[18px] font-semibold text-text-primary leading-none">{followingCount || 0}</span>
                  <span className="text-[11px] text-text-tertiary mt-1">abonnements</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Albums favoris + distribution */}
          <div className="px-4 sm:px-6 lg:px-0 lg:mt-4">
            <Top3Albums userId={profile.id} initialAlbums={favoriteAlbums} />
            <div className="hidden lg:block mt-8">
              <RatingDistribution ratings={publicDiary.map((e) => e.rating)} />
            </div>
          </div>
        </aside>

        {/* ── Contenu principal ────────────────────────────────────────────── */}
        <div className="lg:flex-1 lg:min-w-0 mt-8 lg:pt-8 lg:mt-0">
          <PublicProfileTabs
            profileUserId={profile.id}
            username={username}
            diaryEntries={publicDiary}
            publicLists={profilePublicLists}
            myListenedAlbums={myListenedAlbums}
            isLoggedIn={!!authUser}
            trackEntries={profileTrackDiary}
            unifiedReviews={profileUnifiedReviews}
          />
        </div>
      </div>
    </>
  );
}
