import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMyFeed, getPublicFeed } from '@/app/actions/feed';
import { getSimilarUsers } from '@/app/actions/explore';
import { createSupabaseServer, getAuthUser, userNeedsOnboarding } from '@/lib/supabase/server';
import FeedInfiniteList from '@/components/feed/FeedInfiniteList';
import PublicFeedCard from '@/components/feed/PublicFeedCard';
import SimilarUsersSection from '@/components/user/SimilarUsersSection';
import UnauthTeaser from '@/components/auth/UnauthTeaser';

export default async function FeedPage() {
  const user = await getAuthUser();

  // ── Visiteur non connecté ─────────────────────────────────────────────────
  if (!user) {
    const publicEntries = await getPublicFeed(30);

    return (
      <div className="mx-auto max-w-6xl px-3 pb-28 md:px-5 lg:px-8 lg:pb-12">
        <div className="pt-8 lg:pt-10" />

        <UnauthTeaser ctaTitle={<>Tes likes, commentaires et abonnés t&apos;attendent — <em className="italic text-accent-deep">crée un compte pour suivre ton activité.</em></>}>
          {publicEntries.length === 0 ? (
            <p className="text-meta text-text-tertiary py-8 text-center">Aucune activité récente.</p>
          ) : (
            <div className="flex flex-col gap-3 lg:max-w-3xl">
              {publicEntries.map((entry) => (
                <PublicFeedCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </UnauthTeaser>
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
    <div className="mx-auto max-w-6xl px-3 pb-28 md:px-5 lg:flex lg:h-[calc(100vh-68px)] lg:flex-col lg:overflow-hidden lg:px-8 lg:pb-6">
      <div className="pt-8 lg:pt-10 lg:shrink-0" />

      {hasEvents ? (
        <FeedInfiniteList
          initialNotifications={notificationEvents}
          initialNotificationsCursor={notificationsResult.nextCursor ?? null}
          initialActivity={activityEvents}
          initialActivityCursor={activityResult.nextCursor ?? null}
          currentUserId={user.id}
          lastSeenActivityAt={lastSeenActivityAt}
          similarUsers={similarUsers}
          showDiscoverPeople={true}
        />
      ) : (
        <div className="lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,720px)_320px] lg:items-start lg:gap-10">
          <section className="min-w-0 py-4 lg:py-6">
            <p className="text-body text-text-secondary mb-2 lg:text-[17px]">Pas encore d&apos;activité.</p>
            <p className="text-meta text-text-tertiary mb-8 leading-relaxed lg:max-w-xl lg:text-[15px]">
              Les likes, commentaires et nouveaux abonnés apparaîtront ici.
            </p>

            {similarUsers.length > 0 ? (
              <div className="mb-8 lg:hidden">
                <SimilarUsersSection users={similarUsers} />
              </div>
            ) : (
              <p className="text-meta text-text-tertiary mb-6 leading-relaxed">
                Note quelques albums pour qu&apos;on puisse te suggérer des profils qui te ressemblent.
              </p>
            )}

            <Link
              href="/explore"
              className="flex items-center justify-between rounded-[12px] border border-border bg-background-secondary px-4 py-4 transition-colors duration-150 hover:bg-background-tertiary lg:max-w-md lg:px-5 lg:py-5"
            >
              <p className="text-meta text-text-primary font-medium lg:text-[15px]">Découvrir des albums</p>
              <span className="text-[18px] leading-none ml-4 text-text-tertiary">→</span>
            </Link>
          </section>

          {similarUsers.length > 0 && (
            <aside className="hidden lg:block lg:sticky lg:top-24">
              <SimilarUsersSection users={similarUsers} />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
