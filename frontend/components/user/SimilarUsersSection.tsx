"use client";

import { useState } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import { toggleFollow } from "@/app/actions/social";
import { type SimilarUser } from "@/app/actions/explore";

function UserRow({ user }: { user: SimilarUser }) {
    const [followed, setFollowed] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleFollow(e: React.MouseEvent) {
        e.preventDefault();
        setLoading(true);
        const result = await toggleFollow(user.user_id, "explore_similar");
        if (result.success) setFollowed(true);
        setLoading(false);
    }

    return (
        <Link
            href={`/u/${user.username}`}
            className="group relative flex items-center gap-3 bg-gradient-to-b from-paper-hi to-background-secondary border border-border rounded-card pl-4 pr-3 py-2.5 overflow-hidden hover:border-accent transition-colors duration-150"
        >
            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent opacity-45" />

            <div className="rounded-full overflow-hidden border border-rule shrink-0" style={{ width: 42, height: 42 }}>
                <UserAvatar userId={user.user_id} src={user.avatar_url} size={42} />
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-text-primary truncate">@{user.username}</p>
                {user.shared_albums_count > 0 ? (
                    <p className="font-display italic text-[12.5px] text-text-secondary truncate">
                        <span className="text-accent-deep">{user.shared_albums_count}</span> album{user.shared_albums_count > 1 ? 's' : ''} en commun
                    </p>
                ) : (
                    <p className="font-display italic text-[12.5px] text-text-secondary truncate">
                        goûts similaires
                    </p>
                )}
            </div>

            {user.shared_covers.length > 0 && (
                <div className="flex gap-1 shrink-0">
                    {user.shared_covers.map((cover, i) => (
                        <img
                            key={i}
                            src={cover}
                            alt=""
                            className="w-6 h-6 rounded-[5px] object-cover border border-rule"
                        />
                    ))}
                    {user.shared_albums_count > user.shared_covers.length && (
                        <span className="w-6 h-6 rounded-[5px] bg-background-secondary border border-border flex items-center justify-center font-display italic text-[10px] text-text-secondary">
                            +{user.shared_albums_count - user.shared_covers.length}
                        </span>
                    )}
                </div>
            )}

            <button
                onClick={handleFollow}
                disabled={followed || loading}
                className={`shrink-0 text-[11.5px] font-medium px-3.5 py-1.5 rounded-full border transition-colors duration-150 whitespace-nowrap ${
                    followed
                        ? 'border-border text-text-tertiary cursor-default'
                        : 'border-sage text-sage hover:bg-sage hover:text-paper-hi'
                }`}
            >
                {followed ? 'Suivi' : 'Suivre'}
            </button>
        </Link>
    );
}

export default function SimilarUsersSection({ users }: { users: SimilarUser[] }) {
    if (users.length === 0) return null;

    return (
        <section>
            <div className="mb-5">
                <h2 className="text-h2 text-text-primary">
                    Goûts <em className="italic text-accent-deep">similaires</em>
                </h2>
                <p className="text-sm text-text-secondary mt-1">
                    Triés par affinité de goût. Au plus proche en premier.
                </p>
            </div>
            <div className="flex flex-col gap-2">
                {users.map((user) => (
                    <UserRow key={user.user_id} user={user} />
                ))}
            </div>
        </section>
    );
}
