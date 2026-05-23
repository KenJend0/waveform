import { createSupabaseServer, getAuthUser } from "@/lib/supabase/server";
import { ensureProfile } from "@/app/actions/profile";
import UnauthCTA from "@/components/UnauthCTA";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileTabs from "@/components/profile/ProfileTabs";
import Top3Albums from "@/components/profile/Top3Albums";
import RatingDistribution from "@/components/profile/RatingDistribution";
import { getUserDiary, getUserReviewsUnified } from "@/app/actions/diary";
import { getUserLists, getOrCreateDefaultList } from "@/app/actions/lists";
import { getUserTrackDiary } from "@/app/actions/track-diary";

export const revalidate = 0; // Pas de cache, recharger à chaque accès

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export default async function MyProfilePage() {
    const user = await getAuthUser();

    if (!user) {
        return (
            <div className="px-4 md:px-6 lg:px-8 pb-28 lg:pb-12">
                <div className="pt-8 pb-6">
                    <h1 className="text-h1 text-text-primary mb-2">Mon profil</h1>
                    <p className="text-meta text-text-tertiary">Ton journal, tes stats, tes albums favoris.</p>
                </div>
                <UnauthCTA
                    title={<>Ton profil musical t&apos;attend — <em className="italic text-accent-deep">journal, stats et albums favoris.</em></>}
                />
            </div>
        );
    }

    const supabase = await createSupabaseServer();

    // Créer le profil + liste "À écouter" par défaut si première connexion
    await ensureProfile();
    await getOrCreateDefaultList();

    // Fetch user profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, bio, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

    // Fetch all data in parallel
    const [
        followersResult,
        followingResult,
        diaryEntries,
        reviewsTotalResult,
        userLists,
        favoriteAlbumsResult,
        trackEntries,
        unifiedReviews,
        allRatingsResult,
        trackReviewsCountResult,
    ] = await Promise.all([
        supabase
            .from("follows")
            .select("*", { count: "exact" })
            .eq("followee_id", user.id),
        supabase
            .from("follows")
            .select("*", { count: "exact" })
            .eq("follower_id", user.id),
        getUserDiary(user.id, 0, 51),
        supabase
            .from("diary_entries")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .not("review_body", "is", null),
        getUserLists(user.id),
        supabase
            .from("user_favorite_albums")
            .select("position, album_id, albums (id, title, cover_url, artists (name))")
            .eq("user_id", user.id)
            .order("position", { ascending: true })
            .limit(3),
        getUserTrackDiary(user.id),
        getUserReviewsUnified(user.id),
        supabase.from("diary_entries").select("rating").eq("user_id", user.id),
        (supabase as any)
            .from("track_diary_entries")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .not("review_body", "is", null)
            .neq("review_body", ""),
    ]);

    const favoriteAlbums = (favoriteAlbumsResult.data || []).map((item: any) => ({
        id: item.albums?.id || item.album_id,
        title: item.albums?.title || "Album inconnu",
        artist_name: item.albums?.artists?.name || "Artiste inconnu",
        cover_url: item.albums?.cover_url ?? null,
        position: item.position,
    }));

    const followersCount = followersResult.count || 0;
    const followingCount = followingResult.count || 0;

    const allRatings = (allRatingsResult.data ?? []).map((e: any) => e.rating as number | null);
    const reviewsCount = (reviewsTotalResult.count ?? 0) + (trackReviewsCountResult.count ?? 0);

    const username = profile?.username || user.email?.split("@")[0] || "user";
    const isAdmin = ADMIN_IDS.includes(user.id);

    const userData = {
        id: user.id,
        username: username,
        picture_url: profile?.avatar_url ?? null,
        is_me: true,
        is_admin: isAdmin,
        followers_count: followersCount || 0,
        following_count: followingCount || 0,
        bio: profile?.bio || null,
    };

    const stats = {
        reviews_count: reviewsCount,
    };

    return (
        <div className="lg:flex lg:items-start lg:gap-12 lg:px-8">
            {/* Sidebar gauche (desktop) / Layout empilé (mobile) */}
            <aside className="lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-[72px]">
                <ProfileHeader user={userData} stats={stats} />
                <div className="max-w-page mx-auto px-4 sm:px-6 lg:max-w-none lg:px-0 lg:mt-4">
                    {/* Histogramme mobile : juste sous le hero */}
                    <div className="lg:hidden mt-4 mb-2">
                        <RatingDistribution ratings={allRatings} />
                    </div>
                    <Top3Albums userId={user.id} isMe={true} initialAlbums={favoriteAlbums} />
                    <div className="hidden lg:block mt-8">
                        <RatingDistribution ratings={allRatings} />
                    </div>
                </div>
            </aside>

            {/* Contenu principal : tabs */}
            <div className="lg:flex-1 lg:min-w-0 mt-8 lg:pt-8 lg:mt-0">
                <ProfileTabs
                    isMe={true}
                    userId={user.id}
                    diaryEntries={diaryEntries}
                    userLists={userLists}
                    trackEntries={trackEntries}
                    unifiedReviews={unifiedReviews}
                />
            </div>
        </div>
    );
}
