import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMyFeed, getPublicFeed } from '@/app/actions/feed';
import { getSimilarUsers } from '@/app/actions/explore';
import { createSupabaseServer, getAuthUser, userNeedsOnboarding } from '@/lib/supabase/server';
import FeedInfiniteList from '@/components/feed/FeedInfiniteList';
import PublicFeedCard from '@/components/feed/PublicFeedCard';
import SimilarUsersSection from '@/components/SimilarUsersSection';
import UnauthCTA from '@/components/UnauthCTA';

export default async function FeedPage() {
  const user = await getAuthUser();

  // ── Visiteur non connecté ─────────────────────────────────────────────────
  if (!user) {
    const publicEntries = await getPublicFeed(30);

    return (
      <div className="px-3 md:px-5 lg:px-6 pb-28 lg:pb-12">
        <div className="pt-8 pb-6">
          <h1 className="text-h1 text-text-primary mb-2">Activité</h1>
          <p className="text-meta text-text-tertiary">Ce qui se passe autour de toi.</p>
        </div>

        <UnauthCTA
          className="mb-8"
          title={<>Tes likes, commentaires et abonnés t&apos;attendent — <em className="italic text-accent-deep">crée un compte pour suivre ton activité.</em></>}
        />

        {/* Feed public */}
        {publicEntries.length === 0 ? (
          <p className="text-meta text-text-tertiary py-8 text-center">Aucune activité récente.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {publicEntries.map((entry) => (
              <PublicFeedCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Utilisateur connecté ─────────────────────────────────────────────────
  if (await userNeedsOnboarding(user.id)) {
    redirect('/onboarding');
  }

  const supabase = await createSupabaseServer();
  const [{ data: profile }, notificationsResult, activityResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('last_seen_activity_at')
      .eq('id', user.id)
      .maybeSingle(),
    getMyFeed({ limit: 20, scope: 'notifications' }),
    getMyFeed({ limit: 20, scope: 'activity' }),
  ]);

  if (!notificationsResult.success) console.error('Feed notifications error:', notificationsResult.error);
  if (!activityResult.success) console.error('Feed activity error:', activityResult.error);

  const notificationEvents = notificationsResult.events;
  const activityEvents = activityResult.events;
  const hasEvents = notificationEvents.length > 0 || activityEvents.length > 0;
  const lastSeenActivityAt = (profile as any)?.last_seen_activity_at ?? null;
  const similarUsers = await getSimilarUsers(3);

  return (
    <div className="px-3 md:px-5 lg:px-6 pb-28 lg:pb-12">
      <div className="pt-8 pb-6">
        <h1 className="text-h1 text-text-primary mb-2">Activité</h1>
        <p className="text-meta text-text-tertiary">Ce qui se passe autour de toi.</p>
      </div>

      {hasEvents ? (
        <FeedInfiniteList
          initialNotifications={notificationEvents}
          initialNotificationsCursor={notificationsResult.nextCursor ?? null}
          initialActivity={activityEvents}
          initialActivityCursor={activityResult.nextCursor ?? null}
          currentUserId={user.id}
          lastSeenActivityAt={lastSeenActivityAt}
          similarUsers={similarUsers}
        />
      ) : (
        <div className="py-4">
          <p className="text-body text-text-secondary mb-2">Pas encore d&apos;activité.</p>
          <p className="text-meta text-text-tertiary mb-8 leading-relaxed">
            Les likes, commentaires et nouveaux abonnés apparaîtront ici.
          </p>

          {similarUsers.length > 0 ? (
            <div className="mb-8">
              <SimilarUsersSection users={similarUsers} />
            </div>
          ) : (
            <p className="text-meta text-text-tertiary mb-6 leading-relaxed">
              Note quelques albums pour qu&apos;on puisse te suggérer des profils qui te ressemblent.
            </p>
          )}

          <Link
            href="/explore"
            className="flex items-center justify-between px-4 py-4 bg-background-secondary border border-border rounded-[12px] hover:bg-background-tertiary transition-colors duration-150"
          >
            <p className="text-meta text-text-primary font-medium">Découvrir des albums</p>
            <span className="text-[18px] leading-none ml-4 text-text-tertiary">→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
