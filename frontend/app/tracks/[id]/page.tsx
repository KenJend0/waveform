import { notFound } from 'next/navigation';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { msToMMSS } from '@/lib/time';
import { getTrack } from '@/app/actions/tracks';

type PageProps = { params: Promise<{ id: string }> };

export default async function TrackPage({ params }: PageProps) {
    const { id } = await params;
    const t = await getTrack(id);
    if (!t) notFound();
    const year = t.release_date ? new Date(t.release_date).getFullYear() : undefined;

    return (
        <main className="mx-auto max-w-page p-6">
            <BackButton />

            <div className="mt-4 flex gap-6">
                <div className="w-48 h-48 rounded-[10px] overflow-hidden bg-background-tertiary shrink-0">
                    {t.cover_url ? (
                        <img src={t.cover_url} alt={`${t.album_title} cover`} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full grid place-items-center text-[12px] text-text-tertiary">No cover</div>
                    )}
                </div>

                <div className="min-w-0">
                    <h1 className="text-h3 text-text-primary">{t.title}</h1>
                    <div className="text-text-secondary">
                        <Link href={`/artists/${t.artist_id}`} className="hover:text-[#8E6F5E] transition-colors duration-150">{t.artist_name}</Link>
                        {' — '}
                        <Link href={`/albums/${t.album_id}`} className="hover:text-[#8E6F5E] transition-colors duration-150">{t.album_title}</Link>
                        {year ? <> · <span>{year}</span></> : null}
                    </div>
                    <div className="mt-2 text-[14px] text-text-tertiary">
                        Disque {t.disc_no ?? 1}, piste {t.track_no ?? '-'} · {msToMMSS(t.duration_ms)}
                    </div>
                </div>
            </div>
        </main>
    );
}
