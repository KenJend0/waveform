import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMyFeed, getPublicFeed } from '@/app/actions/feed';
import { getAuthUser, createSupabaseServer } from '@/lib/supabase/server';
import FeedInfiniteList from '@/components/feed/FeedInfiniteList';
import PublicFeedCard from '@/components/feed/PublicFeedCard';
import MarkActivitySeen from '@/components/feed/MarkActivitySeen';
import UnauthCTA from '@/components/UnauthCTA';

export default async function FeedPage() {
  const user = await getAuthUser();

  // ── Visiteur non connecté ─────────────────────────────────────────────────
  if (!user) {
    const publicEntries = await getPublicFeed(30);

    return (
      <div className="px-3 md:px-5 lg:px-6 pb-28 lg:pb-12">
        <div className="pt-8 pb-6">
          <h1 className="text-h1 text-text-primary mb-2">Feed</h1>
          <p className="text-meta text-text-tertiary">Ce qui se passe autour de toi.</p>
        </div>

        <UnauthCTA
          className="mb-8"
          title={<>Ton carnet musical t&apos;attend — <em className="italic text-accent-deep">commence par noter un album.</em></>}
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
  if (needsOnboarding) {
    redirect('/onboarding');
  }

  const feedResult = await getMyFeed({ limit: 20 });
  if (!feedResult.success) console.error('Feed error:', feedResult.error);

  const events = feedResult.events;
  const hasEvents = events.length > 0;

  return (
    <div className="px-3 md:px-5 lg:px-6 pb-28 lg:pb-12">
      <MarkActivitySeen />
      <div className="pt-8 pb-6">
        <h1 className="text-h1 text-text-primary mb-2">Activité</h1>
        <p className="text-meta text-text-tertiary">Ce qui se passe autour de toi.</p>
      </div>

      {hasEvents ? (
        <FeedInfiniteList
          initialEvents={events}
          initialCursor={feedResult.nextCursor ?? null}
          currentUserId={user.id}
        />
      ) : (
        <div className="py-4">
          <p className="text-body text-text-secondary mb-2">Pas encore d&apos;activité.</p>
          <p className="text-meta text-text-tertiary mb-8 leading-relaxed">
            Les likes, commentaires et nouveaux abonnés apparaîtront ici.
          </p>
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
