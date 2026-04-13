import React from 'react';
import { notFound } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { createSupabaseServer, getAuthUser } from '@/lib/supabase/server';
import { ArtistPageContent } from '@/components/ArtistPageContent';
import { getArtistReleases } from '@/app/actions/musicbrainz';
import { getOrFetchArtistMeta, getSimilarArtists } from '@/app/actions/artists';

// Deduplicate concurrent calls within the same render cycle (cold DB cache path)
const cachedGetOrFetchArtistMeta = React.cache(async (artistId: string, mbid: string | null) => {
    return await getOrFetchArtistMeta(artistId, mbid);
});

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: any) {
    const resolvedParams = params && typeof params.then === "function" ? await params : params;
    const { id } = resolvedParams;
    const supabase = await createSupabaseServer();
    const { data: artist } = await supabase
        .from('artists')
        .select('id, name, mbid')
        .eq('id', id)
        .maybeSingle();

    if (!artist) return { title: 'Artiste' };

    const meta = await cachedGetOrFetchArtistMeta(artist.id, artist.mbid);

    return {
        title: `${artist.name}`,
        description: `Page de ${artist.name} — discographie, écoutes et critiques.`,
        openGraph: {
            images: meta?.imageUrl ? [{ url: meta.imageUrl }] : [],
        },
    };
}

export default async function ArtistPage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createSupabaseServer();

    // 1. Fetch artist
    const { data: artist } = await supabase
        .from("artists")
        .select("id, name, mbid")
        .eq("id", id)
        .maybeSingle();

    if (!artist) notFound();

    // 2. Fetch albums
    const { data: albums } = await supabase
        .from("albums")
        .select("id, title, cover_url, release_date")
        .eq("artist_id", id)
        .order("release_date", { ascending: false, nullsFirst: true })
        .order("title", { ascending: true });

    const albumIds = albums?.map(a => a.id) || [];

    // 3. Fetch stats from album_stats VIEW (1 query instead of N+1)
    let statsMap: Record<string, { avg_rating: number | null; reviews_count: number; listeners_count: number }> = {};
    if (albumIds.length > 0) {
        const { data: statsData } = await supabase
            .from("album_stats")
            .select("album_id, avg_rating, reviews_count, listeners_count")
            .in("album_id", albumIds);

        statsData?.forEach((s: any) => {
            statsMap[s.album_id] = {
                avg_rating: s.avg_rating !== null ? Number(s.avg_rating) : null,
                reviews_count: s.reviews_count ?? 0,
                listeners_count: s.listeners_count ?? 0,
            };
        });
    }

    // 4. Track counts (1 query)
    let trackCountMap: Record<string, number> = {};
    if (albumIds.length > 0) {
        const { data: trackCounts } = await supabase
            .from("tracks")
            .select("album_id")
            .in("album_id", albumIds);

        trackCounts?.forEach(t => {
            trackCountMap[t.album_id] = (trackCountMap[t.album_id] || 0) + 1;
        });
    }

    // Combine albums with stats
    const albumsWithStats = albums?.map(album => ({
        ...album,
        track_count: trackCountMap[album.id] || 0,
        avg_rating: statsMap[album.id]?.avg_rating ?? null,
        reviews_count: statsMap[album.id]?.reviews_count ?? 0,
        listeners_count: statsMap[album.id]?.listeners_count ?? 0,
    })) || [];

    // Aggregate artist stats — unique listeners across all albums
    const ratedAlbums = albumsWithStats.filter(a => a.avg_rating !== null);
    const globalAvgRating = ratedAlbums.length > 0
        ? ratedAlbums.reduce((s, a) => s + (a.avg_rating ?? 0), 0) / ratedAlbums.length
        : null;
    const totalReviews = Object.values(statsMap).reduce((s, v) => s + (v.reviews_count ?? 0), 0);

    // Fetch everything in parallel
    const [meta, relResult, user, similarArtistsRaw, allListenerRows] = await Promise.all([
        cachedGetOrFetchArtistMeta(artist.id, artist.mbid),
        artist.mbid ? getArtistReleases(artist.mbid) : Promise.resolve(null),
        getAuthUser(),
        getSimilarArtists(artist.name, artist.mbid),
        albumIds.length > 0
            ? supabase.from("diary_entries").select("user_id").in("album_id", albumIds)
            : Promise.resolve({ data: [] }),
    ]);

    const totalListeners = new Set((allListenerRows.data ?? []).map((r: { user_id: string }) => r.user_id)).size;

    let mbReleases: Array<{ mbid: string; releaseGroupMbid: string; title: string; date: string | null; type: string | null }> = [];
    if (relResult?.success && relResult.releases) {
        mbReleases = relResult.releases;
    }

    // Network activity — who among my follows listened to this artist
    type NetworkListener = {
        userId: string;
        username: string;
        avatarUrl: string | null;
    };
    let networkListeners: NetworkListener[] = [];
    if (user && albumIds.length > 0) {
        const { data: followsData } = await supabase
            .from("follows")
            .select("followee_id")
            .eq("follower_id", user.id);
        const followeeIds = new Set((followsData ?? []).map(f => f.followee_id));
        if (followeeIds.size > 0) {
            // Réutilise allListenerRows — filtre les abonnés côté JS
            const followeeListenerIds = [...new Set(
                (allListenerRows.data ?? [])
                    .filter((r: { user_id: string }) => followeeIds.has(r.user_id))
                    .map((r: { user_id: string }) => r.user_id)
            )];
            if (followeeListenerIds.length > 0) {
                const { data: followeeProfiles } = await supabase
                    .from("profiles")
                    .select("id, username, avatar_url")
                    .in("id", followeeListenerIds);
                const profileMap = new Map((followeeProfiles ?? []).map(p => [p.id, p]));
                for (const uid of followeeListenerIds) {
                    const p = profileMap.get(uid);
                    if (p) networkListeners.push({
                        userId: p.id,
                        username: (p as any).username ?? "",
                        avatarUrl: (p as any).avatar_url ?? null,
                    });
                }
            }
        }
    }

    const similarArtists = similarArtistsRaw;

    return (
        <main className="max-w-page mx-auto px-4 py-8 pb-24">
            <BackButton />
            <ArtistPageContent
                artist={artist}
                albums={albumsWithStats}
                mbReleases={mbReleases}
                imageUrl={meta.imageUrl}
                bio={meta.bio}
                artistStats={{ totalListeners, globalAvgRating, totalReviews }}
                networkListeners={networkListeners}
                similarArtists={similarArtists}
                userId={user?.id}
            />
        </main>
    );
}
