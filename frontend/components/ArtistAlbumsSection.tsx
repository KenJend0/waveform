"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { importAlbumFromMusicBrainz } from "@/app/actions/musicbrainz";
import { showToast } from "@/components/Toast";
import { CoverImage } from "@/components/CoverImage";

type DbAlbum = {
    id: string;
    title: string;
    cover_url: string | null;
    release_date: string | null;
};

type MbAlbum = {
    mbid: string;
    title: string;
    date: string | null;
    type: string | null;
};

type Props = {
    dbAlbums: DbAlbum[];
    mbAlbums: MbAlbum[];
};

const CoverPlaceholder = () => (
    <div className="w-full aspect-square bg-background-tertiary flex items-center justify-center">
        <span className="text-[10px] text-text-disabled">Pas de cover</span>
    </div>
);

function AlbumCard({ title, coverSrc, year, onClick, href, importing }: {
    title: string;
    coverSrc: string | null;
    year: number | null;
    onClick?: () => void;
    href?: string;
    importing?: boolean;
}) {
    const inner = (
        <>
            <div className="rounded-[10px] overflow-hidden bg-background-secondary mb-2">
                {coverSrc ? (
                    <CoverImage
                        src={coverSrc}
                        alt={title}
                        width={300}
                        height={300}
                        className="object-cover w-full aspect-square"
                        placeholder={<CoverPlaceholder />}
                    />
                ) : (
                    <CoverPlaceholder />
                )}
            </div>
            {importing ? (
                <div className="flex items-center gap-2 py-0.5">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[#8E6F5E] flex-shrink-0" />
                    <span className="text-[12px] text-text-secondary">Import en cours…</span>
                </div>
            ) : (
                <>
                    <p className="text-[13px] text-text-primary font-medium leading-snug line-clamp-2 group-hover:text-[#8E6F5E] transition-colors duration-150">
                        {title}
                    </p>
                    {year && (
                        <p className="text-[11px] text-text-tertiary mt-0.5">{year}</p>
                    )}
                </>
            )}
        </>
    );

    if (href) {
        return (
            <Link href={href} className="block group">
                {inner}
            </Link>
        );
    }

    return (
        <button onClick={onClick} className="block text-left group w-full">
            {inner}
        </button>
    );
}

export default function ArtistAlbumsSection({ dbAlbums, mbAlbums }: Props) {
    const router = useRouter();
    const [importing, setImporting] = useState<string | null>(null);

    const handleImport = async (mbid: string) => {
        if (importing) return;
        setImporting(mbid);
        try {
            const res = await importAlbumFromMusicBrainz(mbid);
            if (!res.success) {
                showToast("Erreur lors de l'import", "error");
                return;
            }
            const albumId = (res as { albumId: string }).albumId;
            showToast("Album importé", "success");
            router.push(`/albums/${albumId}`);
        } catch {
            showToast("Erreur lors de l'import", "error");
        } finally {
            setImporting(null);
        }
    };

    const allEmpty = dbAlbums.length === 0 && mbAlbums.length === 0;
    if (allEmpty) return null;

    return (
        <section className="border-t border-border-divider pt-10 mb-20">
            <h2 className="text-h2 text-text-primary mb-8">Du même artiste</h2>
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2">
                {dbAlbums.map((a) => (
                    <div key={a.id} className="snap-center shrink-0 w-44 sm:w-48 md:w-52">
                        <AlbumCard
                            href={`/albums/${a.id}`}
                            title={a.title}
                            coverSrc={a.cover_url}
                            year={a.release_date ? new Date(a.release_date).getFullYear() : null}
                        />
                    </div>
                ))}
                {mbAlbums.map((a) => (
                    <div key={a.mbid} className="snap-center shrink-0 w-44 sm:w-48 md:w-52">
                        <AlbumCard
                            title={a.title}
                            coverSrc={`https://coverartarchive.org/release-group/${a.mbid}/front`}
                            year={a.date ? new Date(a.date).getFullYear() : null}
                            onClick={() => handleImport(a.mbid)}
                            importing={importing === a.mbid}
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}
