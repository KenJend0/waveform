'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BottomSheet from '@/components/ui/BottomSheet';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import type { FeedActor } from '@/app/actions/feed';

interface FeedActorsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Actors we already have from the aggregated event (up to 5) */
  knownActors: FeedActor[];
  totalCount: number;
  /** Called when totalCount > knownActors.length to fetch the full list */
  fetchActors?: () => Promise<FeedActor[]>;
}

export default function FeedActorsBottomSheet({
  isOpen,
  onClose,
  title,
  knownActors,
  totalCount,
  fetchActors,
}: FeedActorsBottomSheetProps) {
  const needsFetch = totalCount > knownActors.length && !!fetchActors;
  const [actors, setActors] = useState<FeedActor[]>(needsFetch ? [] : knownActors);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (!needsFetch) {
      setActors(knownActors);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const result = await fetchActors!();
        setActors(result);
      } catch {
        setActors(knownActors); // fallback to what we have
      } finally {
        setLoading(false);
      }
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`${title} · ${totalCount}`}
      maxHeight="max-h-[60vh]"
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8E6F5E]" />
        </div>
      ) : (
        <div className="divide-y divide-border-divider">
          {actors.map((actor) => (
            <Link
              key={actor.id}
              href={`/u/${actor.username}`}
              onClick={onClose}
              className="flex items-center gap-3 px-6 py-3 hover:bg-background-secondary transition-colors duration-150"
            >
              <div className="flex-shrink-0 rounded-full overflow-hidden border border-border">
                <UserAvatar userId={actor.id} src={actor.avatar_url} size={36} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-text-primary truncate">
                  @{actor.username}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
