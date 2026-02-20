"use client";

import Link from "next/link";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";

type User = {
    id: string; username: string; display_name: string; picture_url?: string;
    is_following?: boolean; is_me?: boolean;
};

export default function UserCard({
                                     user, onFollowToggle, currentUserId,
                                 }: { user: User; onFollowToggle?: (id: string, next?: boolean) => void; currentUserId?: string | null; }) {
    const hideButton = user.is_me || (!!currentUserId && user.id === currentUserId);

    return (
        <div className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-background-tertiary transition-colors duration-150 border-b border-border/40 last:border-b-0">
            <Link
                href={`/u/${user.username || user.id}`}
                className="flex items-center gap-3.5 flex-1 min-w-0"
            >
                {user.picture_url ? (
                    <img
                        src={user.picture_url}
                        alt={user.display_name}
                        className="w-11 h-11 rounded-full border border-border bg-background-tertiary flex-shrink-0 object-cover"
                    />
                ) : (
                    <div className="w-11 h-11 rounded-full border border-border bg-background-tertiary flex-shrink-0 flex items-center justify-center">
                        <UserAvatar userId={user.id} size={44} />
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-[14px] font-medium text-text-primary truncate">
                        {user.display_name}
                    </p>
                    <p className="text-[12px] text-text-secondary truncate">
                        @{user.username}
                    </p>
                </div>
            </Link>
            {!hideButton && onFollowToggle && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onFollowToggle(user.id, !user.is_following);
                    }}
                    className={`flex-shrink-0 px-4 py-1.5 text-[12px] font-medium rounded-[8px] transition-colors duration-150 ${
                        user.is_following
                            ? "bg-background-tertiary text-text-primary hover:bg-[#D8D3CB]"
                            : "bg-[#1C1C1C] text-[#F5F3EF] hover:opacity-85"
                    }`}
                >
                    {user.is_following ? "Suivi" : "Suivre"}
                </button>
            )}
        </div>
    );
}

