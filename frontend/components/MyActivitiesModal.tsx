"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
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

    if (!isOpen) return null;

    const displayName = userProfile?.display_name || "Toi";

    return (
        <div className="fixed inset-0 bg-[#1C1C1C]/20 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-[12px] max-w-2xl w-full max-h-[80vh] flex flex-col border border-border">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-border-divider">
                    <h2 className="text-[16px] font-medium text-text-primary">
                        Evaluations de {displayName}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-background-secondary rounded-[8px] transition-colors duration-150"
                    >
                        <X size={18} className="text-text-secondary" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <p className="text-[14px] text-text-tertiary">Chargement...</p>
                    ) : entries.length === 0 ? (
                        <p className="text-[14px] text-text-tertiary">Pas d'entrees pour l'instant</p>
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
            </div>
        </div>
    );
}

