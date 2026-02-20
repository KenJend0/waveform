"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importAlbumFromMusicBrainz } from "@/app/actions/musicbrainz";
import { showToast } from "@/components/Toast";

type ImportButtonProps = {
    albumId: string;
};

export default function ImportButton({ albumId }: ImportButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleImport = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await importAlbumFromMusicBrainz(albumId);
            if (!response.success) {
                throw new Error("error" in response ? response.error : "Import failed");
            }

            const importedAlbumId = (response as { albumId: string }).albumId;
            const wasImported = (response as { imported?: boolean }).imported ?? true;

            if (!wasImported) {
                showToast("Deja dans la bibliotheque", "info");
            }

            const target = wasImported ? `/albums/${importedAlbumId}?addToDiary=1` : `/albums/${importedAlbumId}`;
            router.push(target);
        } catch (e) {
            setError((e as Error).message);
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
            {error && <p className="mt-2 text-[14px] text-[#C86C6C]">{error}</p>}
        </>
    );
}

