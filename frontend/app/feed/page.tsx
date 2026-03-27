import Link from 'next/link';
import { getMyFeed } from '@/app/actions/feed';
import { redirect } from 'next/navigation';
import { getAuthUser, createSupabaseServer } from '@/lib/supabase/server';
import FeedInfiniteList from '@/components/feed/FeedInfiniteList';
import { getSuggestedUsers } from '@/app/actions/social';
import type { SuggestedUser } from '@/app/actions/social';
import FollowButton from '@/components/social/FollowButton';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';

/**
 * Feed state machine — calculé une seule fois, drive fetches ET rendu.
 *
 * empty   0 events  → CTAs + suggestions
 * sparse  1-2 ev.   → feed + suggestions
 * normal  ≥3 ev.    → feed seul
 */
type FeedState = 'empty' | 'sparse' | 'normal';

function computeFeedState(eventCount: number): FeedState {
  if (eventCount >= 3) return 'normal';
  if (eventCount === 0) return 'empty';
  return 'sparse';
}

export default async function FeedPage() {
  const user = await getAuthUser();
  if (!user) redirect('/auth?mode=login');

  const supabase = await createSupabaseServer();

  // Redirect to onboarding if user still has a default UUID-like username
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  const defaultUsername = user.id.substring(0, 8);
  const needsOnboarding =
    !profile ||
    !profile.username ||
    profile.username === defaultUsername;
  if (needsOnboarding) redirect('/onboarding');

  // Count followings
  const { count: followingCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', user.id);

  const following = followingCount ?? 0;

  const [feedResult, suggestedUsers] = await Promise.all([
    getMyFeed({ limit: 20 }),
    following < 5 ? getSuggestedUsers(5) : Promise.resolve([] as SuggestedUser[]),
  ]);

  if (!feedResult.success) console.error('Feed error:', feedResult.error);

  const events = feedResult.events;
  const state = computeFeedState(events.length);

  const SuggestedUsersSection = () => (
    <div className="divide-y divide-border-divider">
      {suggestedUsers.map((p: SuggestedUser) => (
        <div key={p.id} className="flex items-center gap-4 py-4">
          <Link href={`/u/${p.username}`} className="flex-shrink-0">
            <div className="rounded-full overflow-hidden border border-border">
              <UserAvatar userId={p.id} src={p.avatar_url} size={40} />
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/u/${p.username}`} className="block hover:opacity-70 transition-opacity duration-150">
              <p className="text-[14px] font-medium text-text-primary truncate">
                {p.display_name || p.username}
              </p>
              <p className="text-[12px] text-text-tertiary mt-0.5">@{p.username}</p>
            </Link>
          </div>
          <FollowButton userId={p.id} initialIsFollowing={false} />
        </div>
      ))}
    </div>
  );

  const AddAlbumCTA = () => (
    <Link
      href="/add"
      className="flex items-center justify-between px-4 py-4 bg-background-secondary border border-border rounded-[12px] hover:bg-background-tertiary transition-colors duration-150"
    >
      <p className="text-[14px] text-text-primary font-medium">Noter un album</p>
      <span className="text-[18px] leading-none ml-4 text-text-tertiary">→</span>
    </Link>
  );

  return (
    <div className="mx-auto max-w-page px-4 md:px-6 pb-28">
      <div className="pt-8 pb-6">
        <h1 className="text-h1 text-text-primary mb-2">Feed</h1>
        <p className="text-[14px] text-text-tertiary">Ce qui se passe autour de toi.</p>
      </div>

      {/* ── empty ────────────────────────────────────────────────────────────── */}
      {state === 'empty' && (
        <div className="py-4">
          <p className="text-[16px] text-text-secondary mb-2">Le fil est calme pour l&apos;instant.</p>
          <p className="text-[14px] text-text-tertiary mb-8 leading-relaxed">
            Suis des gens pour voir leurs écoutes ici, ou commence par noter un album.
          </p>
          <div className="flex flex-col gap-3 mb-12">
            <AddAlbumCTA />
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
      )}

      {/* ── sparse ───────────────────────────────────────────────────────────── */}
      {state === 'sparse' && (
        <>
          <FeedInfiniteList
            initialEvents={events}
            initialCursor={feedResult.nextCursor ?? null}
            currentUserId={user.id}
          />
          {suggestedUsers.length > 0 && (
            <div className="mt-12">
              <p className="text-[12px] text-text-secondary font-medium uppercase tracking-[0.08em] mb-4">
                Personnes à suivre
              </p>
              <SuggestedUsersSection />
              <div className="mt-6">
                <AddAlbumCTA />
              </div>
            </div>
          )}
        </>
      )}

      {/* ── normal ───────────────────────────────────────────────────────────── */}
      {state === 'normal' && (
        <FeedInfiniteList
          initialEvents={events}
          initialCursor={feedResult.nextCursor ?? null}
          currentUserId={user.id}
        />
      )}
    </div>
  );
}
