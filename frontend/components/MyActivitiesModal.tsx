"use client";

import { useEffect, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import EditDiaryEntryButton from "@/components/EditDiaryEntryButton";
import { getMyAlbumEntries } from "@/app/actions/album";
import { showToast } from "@/components/Toast";

type Entry = {
    id: string;
    rating: number | null;
    review_body: string | null;
    listened_at: string;
    created_at: string;
};

type MyActivitiesModalProps = {
    albumId: string;
    isOpen: boolean;
    onClose: () => void;
};

export default function MyActivitiesModal({
    albumId,
    isOpen,
    onClose,
}: MyActivitiesModalProps) {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<any>(null);

    const loadEntries = async () => {
        try {
            const result = await getMyAlbumEntries(albumId);

            if (result.error) {
                console.error("Error fetching entries:", result.error);
                showToast("Impossible de charger vos entrées", "error");
                setEntries([]);
                setUserProfile(null);
                return;
            }

            setEntries(result.entries || []);
            setUserProfile(result.profile || null);
        } catch (err) {
            console.error("Error loading my activities:", err);
            showToast("Impossible de charger vos activités", "error");
            setEntries([]);
            setUserProfile(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        loadEntries();
    }, [isOpen, albumId]);

    const displayName = userProfile?.username || "Toi";

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title={`Écoutes de ${displayName}`}
            maxHeight="h-[55vh]"
        >
            <div className="px-6 py-4">
                {loading ? (
                    <p className="text-[14px] text-text-tertiary py-8 text-center">Chargement...</p>
                ) : entries.length === 0 ? (
                    <p className="text-[14px] text-text-tertiary py-8 text-center">Pas d'entrées pour l'instant</p>
                ) : (
                    <div className="space-y-3">
                        {entries.map((entry, idx) => (
                            <div
                                key={entry.id}
                                className={`border rounded-[12px] p-4 transition-colors duration-150 ${
                                    idx === 0
                                        ? "border-border bg-background-secondary"
                                        : "border-border-divider hover:border-border"
                                }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        {idx === 0 && (
                                            <div className="text-[12px] text-[#8E6F5E] font-medium mb-2">
                                                Dernier
                                            </div>
                                        )}
                                        {entry.rating && (
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-text-primary font-medium">
                                                    {entry.rating}/10
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-[12px] text-text-secondary">
                                            {new Date(entry.created_at).toLocaleDateString('fr-FR')}
                                        </div>
                                        <EditDiaryEntryButton
                                            entryId={entry.id}
                                            albumId={albumId}
                                            currentRating={entry.rating}
                                            currentReview={entry.review_body}
                                            currentListenedAt={entry.listened_at}
                                            onUpdated={loadEntries}
                                            variant="compact"
                                        />
                                    </div>
                                </div>

                                {entry.review_body && (
                                    <p className="text-[14px] text-text-secondary leading-relaxed">
                                        {entry.review_body}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </BottomSheet>
    );
}

