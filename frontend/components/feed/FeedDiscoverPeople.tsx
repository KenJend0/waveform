'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { toggleFollow } from '@/app/actions/social';
import { type SimilarUser } from '@/app/actions/explore';

function DiscoverPersonRow({ user }: { user: SimilarUser }) {
  const [followed, setFollowed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleFollow(e: React.MouseEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await toggleFollow(user.user_id, 'feed_discover');
    if (result.success) setFollowed(true);
    setLoading(false);
  }

  return (
    <Link
      href={`/u/${user.username}`}
      className="flex items-center gap-2 pl-1.5 pr-1.5 py-1 rounded-full border border-border bg-background hover:border-accent transition-colors duration-150"
    >
      <UserAvatar userId={user.user_id} src={user.avatar_url} size={28} className="rounded-full" />
      <span className="text-[12.5px] font-medium text-text-primary truncate max-w-[90px]">
        @{user.username}
      </span>
      <button
        onClick={handleFollow}
        disabled={followed || loading}
        className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors duration-150 whitespace-nowrap ${
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

/** Suggestions de profils — utilisées uniquement quand on a de vraies suggestions (pas de redirection à l'aveugle). */
export default function FeedDiscoverPeople({ users }: { users: SimilarUser[] }) {
  if (users.length === 0) return null;

  return (
    <div className="mx-3 rounded-card border border-border bg-paper-hi px-4 py-4">
      <p className="font-display italic text-[14px] text-text-warm text-center mb-3">
        Des profils qui pourraient te <span className="text-accent-deep">plaire</span>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {users.map((user) => (
          <DiscoverPersonRow key={user.user_id} user={user} />
        ))}
      </div>
    </div>
  );
}
