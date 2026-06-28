"use client";

import { useState } from "react";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import NetworkListenersBottomSheet from "@/components/NetworkListenersBottomSheet";

type NetworkListener = {
    userId: string;
    username: string;
    avatarUrl: string | null;
    rating: number | null;
    listenedAt: string | null;
    entryId: string | null;
    hasReview: boolean;
};

type Props = { listeners: NetworkListener[] };

export default function TrackNetworkListeners({ listeners }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    if (listeners.length === 0) return null;

    const shown = listeners.slice(0, 3);
    const rest = listeners.length - shown.length;
    const tokens = shown.map((l) => l.username);

    let label: string;
    if (tokens.length === 1) {
        label = `${tokens[0]} a écouté ce titre`;
    } else if (rest === 0) {
        label = `${tokens.slice(0, -1).join(", ")} et ${tokens[tokens.length - 1]} ont écouté ce titre`;
    } else {
        label = `${tokens.join(", ")} et ${rest} autre${rest > 1 ? "s" : ""} ont écouté ce titre`;
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 hover:opacity-75 transition-opacity duration-150"
            >
                <div className="flex -space-x-1.5">
                    {shown.map((l) => (
                        <div key={l.userId} className="border border-background-primary rounded-full flex-shrink-0">
                            <UserAvatar userId={l.userId} src={l.avatarUrl} size={20} />
                        </div>
                    ))}
                </div>
                <span className="text-[12px] text-text-tertiary leading-snug">{label}</span>
            </button>

            <NetworkListenersBottomSheet
                listeners={listeners}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Ont écouté ce titre"
                entryPrefix="/track-diary/"
            />
        </>
    );
}
