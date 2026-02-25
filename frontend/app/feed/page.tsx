import Link from 'next/link';
import { getMyFeed } from '@/app/actions/feed';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/supabase/server';
import FeedInfiniteList from '@/components/feed/FeedInfiniteList';
import { getSuggestedUsers } from '@/app/actions/social';
import FollowButton from '@/components/social/FollowButton';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';

export default async function FeedPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect('/auth?mode=login');
  }

  const feedResult = await getMyFeed({ limit: 20 });

  if (!feedResult.success) {
    console.error('Feed error:', feedResult.error);
  }

  const events = feedResult.events;
  // Show suggestions + CTAs when feed has fewer than 3 events
  const showSuggestions = events.length < 3;
  const suggestedUsers = showSuggestions ? await getSuggestedUsers(5) : [];

  const SuggestedUsersSection = () => (
    <div className="divide-y divide-border-divider">
      {suggestedUsers.map((profile) => (
        <div key={profile.id} className="flex items-center gap-4 py-4">
          <Link href={`/u/${profile.username}`} className="flex-shrink-0">
            <div className="rounded-full overflow-hidden border border-border">
              <UserAvatar userId={profile.id} src={profile.avatar_url} size={40} />
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/u/${profile.username}`} className="block hover:opacity-70 transition-opacity duration-150">
              <p className="text-[14px] font-medium text-text-primary truncate">
                {profile.display_name || profile.username}
              </p>
              <p className="text-[12px] text-text-tertiary mt-0.5">@{profile.username}</p>
            </Link>
          </div>
          <FollowButton userId={profile.id} initialIsFollowing={false} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-page px-4 md:px-6">
      <div className="pt-8 pb-6">
        <h1 className="text-h1 text-text-primary mb-2">Feed</h1>
        <p className="text-[14px] text-text-tertiary">
          Ce qui se passe autour de toi.
        </p>
      </div>

      {events.length === 0 ? (
        /* ── Feed complètement vide ── */
        <div className="py-4">
          <p className="text-[16px] text-text-secondary mb-2">
            Le fil est calme pour l&apos;instant.
          </p>
          <p className="text-[14px] text-text-tertiary mb-8 leading-relaxed">
            Suis des gens pour voir leurs écoutes ici, ou commence par noter un album.
          </p>
                          <Link
                  href="/diary"
                  className="flex items-center justify-between px-4 py-4 bg-background-secondary border border-border rounded-[12px] hover:bg-background-tertiary transition-colors duration-150"
                >
                  <p className="text-[14px] text-text-primary font-medium">Logger un album</p>
                  <span className="text-[18px] leading-none ml-4 text-text-tertiary">→</span>
                </Link>

          <div className="flex flex-col gap-3 mb-12">
            <Link
              href="/explore"
              className="flex items-center justify-between px-4 py-4 bg-background-secondary border border-border rounded-[12px] hover:bg-background-tertiary transition-colors duration-150"
            >
              <p className="text-[14px] text-text-primary font-medium">Explorer des albums</p>
              <span className="text-[18px] leading-none ml-4 text-text-tertiary">→</span>
            </Link>
          </div>

          {suggestedUsers.length > 0 && (
            <div>
              <p className="text-[12px] text-text-secondary font-medium uppercase tracking-[0.08em] mb-4">
                Personnes à suivre
              </p>
              <SuggestedUsersSection />
            </div>
          )}
        </div>
      ) : (
        /* ── Feed avec events ── */
        <>
          <FeedInfiniteList initialEvents={events} initialCursor={feedResult.nextCursor ?? null} currentUserId={user.id} />

          {/* Suggestions en bas si feed peu fourni */}
          {showSuggestions && suggestedUsers.length > 0 && (
            <div className="mt-12 pb-20">
              <p className="text-[12px] text-text-secondary font-medium uppercase tracking-[0.08em] mb-4">
                Personnes à suivre
              </p>
              <SuggestedUsersSection />
              <div className="mt-6">
                <Link
                  href="/diary"
                  className="flex items-center justify-between px-4 py-4 bg-background-secondary border border-border rounded-[12px] hover:bg-background-tertiary transition-colors duration-150"
                >
                  <p className="text-[14px] text-text-primary font-medium">Logger un album</p>
                  <span className="text-[18px] leading-none ml-4 text-text-tertiary">→</span>
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
