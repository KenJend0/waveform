"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importAlbumFromMusicBrainz } from "@/app/actions/musicbrainz";
import { saveAlbumOnce } from "@/app/actions/saved-albums";
import { showToast } from "@/components/Toast";

type ImportButtonProps = {
    albumId: string;
};

export default function ImportButton({ albumId }: ImportButtonProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleImport = async () => {
        setLoading(true);
        try {
            const response = await importAlbumFromMusicBrainz(albumId);
            if (!response.success) {
                throw new Error("error" in response ? response.error : "Import failed");
            }

            const res = response as { albumId: string; redirectUrl?: string; imported?: boolean; title?: string; artist?: string; mbid?: string };
            const importedAlbumId = res.albumId;
            const wasImported = res.imported ?? true;

            await saveAlbumOnce(importedAlbumId);
            showToast("Importé", "success");

            // Enrichissement en arrière-plan (route API séparée pour éviter le timeout Vercel)
            if (wasImported && res.mbid && res.title && res.artist) {
                fetch('/api/enrich', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ albumId: importedAlbumId, mbid: res.mbid, title: res.title, artist: res.artist }),
                }).catch(() => {/* best-effort */});
            }

            const target = res.redirectUrl ?? (wasImported ? `/albums/${importedAlbumId}?addToDiary=1` : `/albums/${importedAlbumId}`);
            router.push(target);
        } catch (e) {
            showToast((e as Error).message || "Erreur lors de l'import", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={handleImport}
                disabled={loading}
                className="border border-border hover:bg-background-secondary disabled:opacity-50 disabled:cursor-not-allowed text-text-primary px-4 py-2 rounded-[8px] text-[14px] font-medium transition-colors duration-150"
            >
                {loading ? "Import en cours..." : "Ajouter a la bibliotheque"}
            </button>
        </>
    );
}
