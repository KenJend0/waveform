import Link from 'next/link';
import { getMyFeed, getSupplementalFeedActivity } from '@/app/actions/feed';
import { redirect } from 'next/navigation';
import { getAuthUser, createSupabaseServer } from '@/lib/supabase/server';
import FeedInfiniteList from '@/components/feed/FeedInfiniteList';
import { getSuggestedUsers } from '@/app/actions/social';
import FollowButton from '@/components/social/FollowButton';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';

/**
 * Feed state machine — calculé une seule fois, drive fetches ET rendu.
 *
 * empty_no_network    0 events  <2 followings  → CTAs + suggestions
 * empty_with_network  0 events  ≥2 followings  → CTAs + activité récente
 * sparse_no_network   1-2 ev.   <2 followings  → feed + suggestions
 * sparse_with_network 1-2 ev.   ≥2 followings  → feed + activité récente
 * normal              ≥3 ev.    (peu importe)  → feed seul
 */
type FeedState =
  | 'empty_no_network'
  | 'empty_with_network'
  | 'sparse_no_network'
  | 'sparse_with_network'
  | 'normal';

function computeFeedState(eventCount: number, followingCount: number): FeedState {
  if (eventCount >= 3) return 'normal';
  const hasNetwork = followingCount >= 2;
  if (eventCount === 0) return hasNetwork ? 'empty_with_network' : 'empty_no_network';
  return hasNetwork ? 'sparse_with_network' : 'sparse_no_network';
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

  if (profile) {
    const defaultUsername = user.id.substring(0, 8);
    if (!profile.username || profile.username === defaultUsername) {
      redirect('/onboarding');
    }
  }

  // Count followings
  const { count: followingCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', user.id);

  const following = followingCount ?? 0;

  const feedResult = await getMyFeed({ limit: 20 });
  if (!feedResult.success) console.error('Feed error:', feedResult.error);

  const events = feedResult.events;
  const state = computeFeedState(events.length, following);

  // Fetch only what this state needs
  const needsSupplemental = state === 'empty_with_network' || state === 'sparse_with_network';
  const needsSuggestions = state === 'empty_no_network' || state === 'sparse_no_network';

  const [supplementalEvents, suggestedUsers] = await Promise.all([
    needsSupplemental ? getSupplementalFeedActivity(user.id, 5) : Promise.resolve([]),
    needsSuggestions ? getSuggestedUsers(5) : Promise.resolve([]),
  ]);

  const SuggestedUsersSection = () => (
    <div className="divide-y divide-border-divider">
      {suggestedUsers.map((p) => (
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
      <p className="text-[14px] text-text-primary font-medium">Logger un album</p>
      <span className="text-[18px] leading-none ml-4 text-text-tertiary">→</span>
    </Link>
  );

  return (
    <div className="mx-auto max-w-page px-4 md:px-6 pb-28">
      <div className="pt-8 pb-6">
        <h1 className="text-h1 text-text-primary mb-2">Feed</h1>
        <p className="text-[14px] text-text-tertiary">Ce qui se passe autour de toi.</p>
      </div>

      {/* ── empty_no_network ─────────────────────────────────────────────────── */}
      {state === 'empty_no_network' && (
        <div className="py-4">
          <p className="text-[16px] text-text-secondary mb-2">Le fil est calme pour l&apos;instant.</p>
          <p className="text-[14px] text-text-tertiary mb-8 leading-relaxed">
            Suis des gens pour voir leurs écoutes ici, ou commence par noter un album.
          </p>
          <div className="flex flex-col gap-3 mb-12">
            <AddAlbumCTA />
            <Link
              href="/search"
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

      {/* ── empty_with_network ───────────────────────────────────────────────── */}
      {state === 'empty_with_network' && (
        <div className="py-4">
          <p className="text-[16px] text-text-secondary mb-2">Le fil est calme pour l&apos;instant.</p>
          <p className="text-[14px] text-text-tertiary mb-8 leading-relaxed">
            Les gens que tu suis ne sont pas encore très actifs. En attendant, voici leurs dernières écoutes.
          </p>
          <div className="mb-10">
            <AddAlbumCTA />
          </div>
          {supplementalEvents.length > 0 && (
            <div>
              <p className="text-[12px] text-text-secondary font-medium uppercase tracking-[0.08em] mb-4">
                Activité récente
              </p>
              <FeedInfiniteList
                initialEvents={supplementalEvents}
                initialCursor={null}
                currentUserId={user.id}
              />
            </div>
          )}
        </div>
      )}

      {/* ── sparse_no_network ────────────────────────────────────────────────── */}
      {state === 'sparse_no_network' && (
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

      {/* ── sparse_with_network ──────────────────────────────────────────────── */}
      {state === 'sparse_with_network' && (
        <>
          <FeedInfiniteList
            initialEvents={events}
            initialCursor={feedResult.nextCursor ?? null}
            currentUserId={user.id}
          />
          {supplementalEvents.length > 0 && (
            <div className="mt-12">
              <p className="text-[12px] text-text-secondary font-medium uppercase tracking-[0.08em] mb-4">
                Activité récente
              </p>
              <FeedInfiniteList
                initialEvents={supplementalEvents}
                initialCursor={null}
                currentUserId={user.id}
              />
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
