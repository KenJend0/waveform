import { ReactNode } from 'react';
import type { FeedActor } from '@/app/actions/feed';
import { formatActors } from '@/components/feed/formatActors';
import { ActorLink } from './FeedActorLink';

interface InteractionContextParams {
  currentUserId?: string;
  actor: FeedActor;
  /** Past participle, invariant whether the subject is singular or plural ("a/ont aimé", "a/ont commenté"). */
  verb: 'aimé' | 'commenté';
  isAggregate?: unknown;
  actors?: FeedActor[];
  actorsCount?: number;
  onShowMore?: () => void;
  entryOwnerId?: string;
  /** Current user already reacted the same way on this entry — only meaningful for comments today. */
  alsoActed?: boolean;
}

/**
 * Shared sentence builder for the four "reaction" feed cards (like/comment,
 * on an album or a track diary entry) — they all share the same four shapes:
 * self, aggregated, on-your-entry, and generic. Centralized so album and
 * track variants can't drift apart in wording.
 */
export function buildInteractionContext({
  currentUserId,
  actor,
  verb,
  isAggregate,
  actors,
  actorsCount,
  onShowMore,
  entryOwnerId,
  alsoActed,
}: InteractionContextParams): ReactNode {
  if (currentUserId === actor.id) {
    return <span>{`Tu as ${verb} une écoute`}</span>;
  }

  if (isAggregate && actors && actorsCount) {
    return (
      <>
        {formatActors(actors, actorsCount, onShowMore)}{' '}
        {`ont ${verb} ton écoute`}
      </>
    );
  }

  if (entryOwnerId === currentUserId) {
    return (
      <>
        <ActorLink username={actor.username} />
        {` a ${verb} ton écoute`}
      </>
    );
  }

  if (alsoActed) {
    return (
      <>
        <ActorLink username={actor.username} />
        {` a aussi ${verb} l'écoute`}
      </>
    );
  }

  return (
    <>
      <ActorLink username={actor.username} />
      {` a ${verb} une écoute`}
    </>
  );
}
