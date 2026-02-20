import BackButton from '@/components/BackButton';
import { createSupabaseServer } from '@/lib/supabase/server';
import { ArtistPageContent } from '@/components/ArtistPageContent';
import { getArtistReleases } from '@/app/actions/musicbrainz';
import { getOrFetchArtistMeta } from '@/app/actions/artists';

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

    const meta = await getOrFetchArtistMeta(artist.id, artist.mbid);

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

    if (!artist) {
        return (
            <main className="max-w-page mx-auto px-4 py-8 pb-24">
                <BackButton />
                <div className="mt-6 text-text-tertiary text-[14px]">Artiste introuvable</div>
            </main>
        );
    }

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
    })) || [];

    // 5. Fetch bio/image from DB cache (or fetch + cache if first time)
    const meta = await getOrFetchArtistMeta(artist.id, artist.mbid);

    // 6. Fetch MB releases WITHOUT covers (lightweight, 1 API call)
    let mbReleases: Array<{ mbid: string; releaseGroupMbid: string; title: string; date: string | null; type: string | null }> = [];
    if (artist.mbid) {
        const relResult = await getArtistReleases(artist.mbid);
        if (relResult.success && relResult.releases) {
            mbReleases = relResult.releases;
        }
    }

    return (
        <main className="max-w-page mx-auto px-4 py-8 pb-24">
            <BackButton />
            <ArtistPageContent
                artist={artist}
                albums={albumsWithStats}
                mbReleases={mbReleases}
                imageUrl={meta.imageUrl}
            />
        </main>
    );
}
