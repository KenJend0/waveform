"use client";

import Link from "next/link";
import Image from "next/image";
import BottomSheet from "@/components/ui/BottomSheet";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";

type Listener = {
    userId: string;
    username: string;
    avatarUrl: string | null;
    rating: number | null;
    listenedAt: string | null;
    entryId: string | null;
    hasReview: boolean;
};

type Props = {
    listeners: Listener[];
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    entryPrefix?: string;
    showRating?: boolean;
};

export default function NetworkListenersBottomSheet({ listeners, isOpen, onClose, title = "Ont écouté cet album", entryPrefix = "/diary/", showRating = true }: Props) {
    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title={title} maxHeight="h-[50vh]">
            <div className="px-6 py-2">
                {listeners.map((l) => {
                    const name = l.username;
                    const href = l.entryId ? `${entryPrefix}${l.entryId}` : `/u/${l.username}`;
                    return (
                        <Link
                            key={l.userId}
                            href={href}
                            onClick={onClose}
                            className="flex items-center gap-3 py-3 border-b border-border-divider last:border-0 hover:opacity-75 transition-opacity duration-150"
                        >
                            {/* Avatar */}
                            <UserAvatar userId={l.userId} src={l.avatarUrl} size={32} />

                            {/* Name */}
                            <span className="flex-1 text-meta text-text-primary font-medium">{name}</span>

                            {/* Rating + review indicator */}
                            {showRating && (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {l.rating && l.rating > 0 ? (
                                        <span className="text-meta text-text-primary font-medium">{l.rating}<span className="text-label text-text-tertiary">/10</span></span>
                                    ) : (
                                        <span className="text-label text-text-tertiary">—</span>
                                    )}
                                    {l.hasReview && (
                                        <span className="text-[10px] text-text-tertiary border border-border-divider rounded px-1 py-0.5 leading-none">critique</span>
                                    )}
                                </div>
                            )}
                        </Link>
                    );
                })}
            </div>
        </BottomSheet>
    );
}
