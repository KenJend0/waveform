import Link from 'next/link';
import { getMyFeed } from '@/app/actions/feed';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/supabase/server';
import FeedInfiniteList from '@/components/feed/FeedInfiniteList';

export default async function FeedPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect('/auth?mode=login');
  }

  const feedResult = await getMyFeed({ limit: 20, offset: 0 });

  if (!feedResult.success) {
    console.error('Feed error:', feedResult.error);
  }

  const events = feedResult.events;

  return (
    <div className="mx-auto max-w-page px-4 md:px-6">
      <div className="pt-8 pb-6">
        <h1 className="text-h1 text-text-primary mb-2">Feed</h1>
        <p className="text-[14px] text-text-tertiary">
          Ce qui se passe autour de toi.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-[16px] text-text-secondary mb-3">
            Le fil est calme pour l&apos;instant.
          </p>
          <p className="text-[14px] text-text-tertiary mb-8 leading-relaxed">
            Quand tu suivras quelqu&apos;un, ses Ã©coutes<br />
            et ses notes apparaÃ®tront ici.
          </p>
          <Link
            href="/explore"
            className="text-[14px] text-text-secondary hover:text-[#8E6F5E] transition-colors duration-150"
          >
            DÃ©couvrir des albums
          </Link>
        </div>
      ) : (
        <FeedInfiniteList initialEvents={events} currentUserId={user.id} />
      )}
    </div>
  );
}

