import Link from "next/link";
import BackButton from "@/components/BackButton";
import AddToDiaryForm from "@/components/AddToDiaryForm";
import { msToMMSS } from "@/lib/time";
import { api } from "@/lib/api";
import Reviews from "@/components/Reviews"; 

type AlbumResponse = {
    album: {
        id: string;
        title: string;
        cover_url: string | null;
        release_date: string | null;
        artist_id: string;
        artist_name: string;
    };
    tracks: Array<{
        id: string;
        title: string;
        duration_ms: number | null;
        track_no: number | null;
        disc_no: number | null;
    }>;
};

type PageProps = { params: Promise<{ id: string }> };

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;  // OK pour Next 15:contentReference[oaicite:5]{index=5}
    const data = await api<AlbumResponse>(`/api/albums/${id}`);  // requête via le proxy /api
    const { album, tracks } = data;
    const year = album.release_date ? new Date(album.release_date).getFullYear() : undefined;

    return (
        <main className="mx-auto max-w-3xl p-6">
            <BackButton />

            <div className="mt-4 flex gap-6">
                <div className="w-40 h-40 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {album.cover_url ? (
                        <img
                            src={album.cover_url}
                            alt={`${album.title} cover`}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full grid place-items-center text-xs text-gray-400">
                            No cover
                        </div>
                    )}
                </div>

                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold leading-tight">{album.title}</h1>
                    <div className="text-gray-600">
                        <Link
                            href={`/artists/${album.artist_id}`}
                            className="font-medium hover:underline"
                        >
                            {album.artist_name}
                        </Link>
                        {year ? <> · <span>{year}</span></> : null}
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                        {tracks.length} track{tracks.length !== 1 ? "s" : ""}
                    </div>

                    {/* Journal rapide */}
                    <AddToDiaryForm albumId={album.id} />
                </div>
            </div>

            <section className="mt-6">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-2 w-10">#</th>
                        <th className="py-2">Title</th>
                        <th className="py-2 pl-2 text-right w-16">Time</th>
                    </tr>
                    </thead>
                    <tbody>
                    {tracks.map((t, idx) => (
                        <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-2 pr-2 align-middle">{t.track_no ?? idx + 1}</td>
                            <td className="py-2 align-middle">
                                <Link href={`/tracks/${t.id}`} className="truncate hover:underline">
                                    {t.title}
                                </Link>
                            </td>
                            <td className="py-2 pl-2 align-middle text-right tabular-nums">
                                {msToMMSS(t.duration_ms)}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </section>

            {/* Reviews client-side */}
            <Reviews albumId={album.id} />
        </main>
    );
}
