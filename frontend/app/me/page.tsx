import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ensureProfile } from "@/app/actions/profile";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileTabs from "@/components/profile/ProfileTabs";
import Top3Albums from "@/components/profile/Top3Albums";
import { getUserDiary } from "@/app/actions/diary";
import { getUserSavedAlbums } from "@/app/actions/saved-albums";

export const revalidate = 0; // Pas de cache, recharger à chaque accès

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export default async function MyProfilePage() {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/auth?mode=login");

    // Créer le profil s'il n'existe pas (première connexion)
    await ensureProfile();

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
        savedAlbums,
        favoriteAlbumsResult,
    ] = await Promise.all([
        supabase
            .from("follows")
            .select("*", { count: "exact" })
            .eq("followee_id", user.id),
        supabase
            .from("follows")
            .select("*", { count: "exact" })
            .eq("follower_id", user.id),
        getUserDiary(user.id),
        getUserSavedAlbums(user.id),
        supabase
            .from("user_favorite_albums")
            .select("position, album_id, albums (id, title, cover_url, artists (name))")
            .eq("user_id", user.id)
            .order("position", { ascending: true })
            .limit(3),
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

    // Compute stats from fetched data
    const albumsCount = diaryEntries.length;
    const reviewsCount = diaryEntries.filter(e => e.review_body).length;

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
        albums_count: albumsCount,
    };

    return (
        <div className="lg:flex lg:items-start lg:gap-12 lg:max-w-5xl lg:mx-auto lg:px-8 lg:pt-8">
            {/* Sidebar gauche (desktop) / Layout empilé (mobile) */}
            <aside className="lg:w-64 lg:flex-shrink-0 lg:sticky lg:top-[72px]">
                <ProfileHeader user={userData} stats={stats} />
                <div className="max-w-page mx-auto px-4 sm:px-6 lg:max-w-none lg:px-0 lg:mt-4">
                    <Top3Albums userId={user.id} isMe={true} initialAlbums={favoriteAlbums} />
                </div>
            </aside>

            {/* Contenu principal : tabs */}
            <div className="lg:flex-1 lg:min-w-0">
                <ProfileTabs
                    isMe={true}
                    diaryEntries={diaryEntries}
                    savedAlbums={savedAlbums}
                />
            </div>
        </div>
    );
}
