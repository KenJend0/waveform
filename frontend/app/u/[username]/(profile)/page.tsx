import { Suspense } from 'react';
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
      <main className="max-w-page mx-auto px-4 sm:px-6 pt-4 pb-6">
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
    allRatingsResult,
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
    supabase.from("diary_entries").select("rating").eq("user_id", profile.id),
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
  const allRatings = (allRatingsResult.data ?? []).map((e: any) => e.rating as number | null);
  const publicDiary = profileDiary.filter((e) => (e as any).is_public !== false);

  if (isBlocking) {
    return (
      <main className="max-w-page mx-auto px-4 sm:px-6 pt-4 pb-6">
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
      <div className="lg:flex lg:items-start lg:gap-12 lg:px-8 pb-28 lg:pb-12">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-[72px]">
          {/* Profil */}
          <div className="bg-background-secondary border-b border-border-divider lg:bg-transparent lg:border-0">
            <div className="max-w-page mx-auto px-4 sm:px-6 pt-4 pb-8 lg:max-w-none lg:px-0 lg:py-6 relative">
              {/* BackButton + menu 3 points — fixed côte à côte sur mobile */}
              <div className="lg:hidden">
                <BackButton />
                {authUser && authUser.id !== profile.id && (
                  <div className="fixed top-3 right-4 z-30">
                    <ProfileActionsMenu userId={profile.id} initialIsBlocking={false} />
                  </div>
                )}
              </div>

              {/* Menu 3 points desktop — top right absolu */}
              {authUser && authUser.id !== profile.id && (
                <div className="absolute top-6 right-0 hidden lg:block">
                  <ProfileActionsMenu userId={profile.id} initialIsBlocking={false} />
                </div>
              )}

              {/* Avatar + Nom */}
              <div className="flex gap-5 items-center">
                <div className="flex-shrink-0 rounded-full border border-border overflow-hidden">
                  <div className="w-[80px] h-[80px] lg:w-[96px] lg:h-[96px]">
                    <UserAvatar userId={profile.id} src={(profile as any).avatar_url} size={96} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-[24px] lg:text-[22px] font-medium text-text-primary tracking-[-0.02em] leading-[1.2]">
                    @{username}
                  </h1>
                  {authUser && authUser.id !== profile.id && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <FollowButton userId={profile.id} initialIsFollowing={isFollowing} />
                      {isFollowingYou && (
                        <span className="text-[11px] text-text-tertiary/60 italic">vous suit</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {bio && (
                <p className="text-meta text-text-secondary leading-relaxed max-w-lg mt-5 whitespace-pre-line">{bio}</p>
              )}

              {/* Stats — charte : font-display italic 28px text-text-warm, labels text-label */}
              <div className="flex w-full mt-5 pt-4 border-t border-rule">
                <div className="flex-1 flex flex-col border-r border-rule pr-4">
                  <span className="font-display italic text-[28px] text-text-warm leading-none">{reviewsCount}</span>
                  <span className="text-label uppercase tracking-[0.14em] text-text-tertiary mt-1.5">critique{reviewsCount !== 1 ? "s" : ""}</span>
                </div>
                <Link href={`/u/${username}/followers`} className="flex-1 flex flex-col hover:opacity-75 transition-opacity duration-150 border-r border-rule px-4">
                  <span className="font-display italic text-[28px] text-text-warm leading-none">{followersCount || 0}</span>
                  <span className="text-label uppercase tracking-[0.14em] text-text-tertiary mt-1.5">abonné{(followersCount || 0) !== 1 ? "s" : ""}</span>
                </Link>
                <Link href={`/u/${username}/following`} className="flex-1 flex flex-col hover:opacity-75 transition-opacity duration-150 pl-4">
                  <span className="font-display italic text-[28px] text-text-warm leading-none">{followingCount || 0}</span>
                  <span className="text-label uppercase tracking-[0.14em] text-text-tertiary mt-1.5">suivis</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Albums favoris + distribution */}
          <div className="max-w-page mx-auto px-4 sm:px-6 lg:max-w-none lg:px-0 lg:mt-4">
            {/* Distribution mobile — juste sous le hero */}
            <div className="lg:hidden mt-4 mb-2">
              <RatingDistribution ratings={allRatings} label="Ses" />
            </div>
            <Top3Albums userId={profile.id} initialAlbums={favoriteAlbums} />
            <div className="hidden lg:block mt-8">
              <RatingDistribution ratings={allRatings} label="Ses" />
            </div>
          </div>
        </aside>

        {/* ── Contenu principal ────────────────────────────────────────────── */}
        <div className="lg:flex-1 lg:min-w-0 mt-8 lg:pt-8 lg:mt-0">
          <Suspense fallback={null}>
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
          </Suspense>
        </div>
      </div>
    </>
  );
}
