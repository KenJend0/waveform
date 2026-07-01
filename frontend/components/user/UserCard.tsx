"use client";

import Link from "next/link";
import Image from "next/image";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";

type User = {
    id: string; username: string; picture_url?: string;
    is_following?: boolean; is_me?: boolean;
};

export default function UserCard({
                                     user, onFollowToggle, currentUserId, isLoading = false,
                                 }: { user: User; onFollowToggle?: (id: string, next?: boolean) => void; currentUserId?: string | null; isLoading?: boolean; }) {
    const hideButton = user.is_me || (!!currentUserId && user.id === currentUserId);

    return (
        <div className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-background-tertiary transition-colors duration-150 border-b border-border/40 last:border-b-0">
            <Link
                href={`/u/${user.username || user.id}`}
                className="flex items-center gap-3.5 flex-1 min-w-0"
            >
                {user.picture_url ? (
                    <Image
                        src={user.picture_url}
                        alt={user.username}
                        width={44}
                        height={44}
                        className="rounded-full border border-border bg-background-tertiary flex-shrink-0 object-cover"
                    />
                ) : (
                    <div className="w-11 h-11 rounded-full border border-border bg-background-tertiary flex-shrink-0 flex items-center justify-center">
                        <UserAvatar userId={user.id} size={44} />
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-meta font-medium text-text-primary truncate">
                        @{user.username}
                    </p>
                </div>
            </Link>
            {!hideButton && onFollowToggle && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isLoading) onFollowToggle(user.id, !user.is_following);
                    }}
                    disabled={isLoading}
                    className={`flex-shrink-0 px-4 py-1.5 text-label font-medium rounded-pill transition-colors duration-150 inline-flex items-center gap-1.5 disabled:cursor-not-allowed ${
                        user.is_following
                            ? "bg-background-tertiary text-text-secondary hover:border hover:border-accent hover:text-accent"
                            : "border border-sage text-sage hover:bg-sage hover:text-paper-hi"
                    }`}
                >
                    {isLoading && (
                        <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin flex-shrink-0" />
                    )}
                    {user.is_following ? "Suivi" : "Suivre"}
                </button>
            )}
        </div>
    );
}

