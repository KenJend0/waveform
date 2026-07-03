import type { ReactNode } from 'react';
import { Text } from 'react-native';
import type { FeedActor } from '../../../lib/feed';
import { formatActors } from '../formatActors';
import { ActorLink } from './ActorLink';

type Params = {
  currentUserId?: string;
  actor: FeedActor;
  verb: 'aimé' | 'commenté';
  isAggregate?: boolean;
  actors?: FeedActor[];
  actorsCount?: number;
  entryOwnerId?: string;
  alsoActed?: boolean;
  targetHasReview?: boolean;
};

/** Miroir mobile de feedInteractionContext.tsx (web) — même arbre de décision, sans le bottom sheet "afficher plus". */
export function buildInteractionContext({
  currentUserId,
  actor,
  verb,
  isAggregate,
  actors,
  actorsCount,
  entryOwnerId,
  alsoActed,
  targetHasReview,
}: Params): ReactNode {
  const genericTarget = targetHasReview ? 'une critique' : 'une note';
  const ownedTarget = targetHasReview ? 'ta critique' : 'ta note';
  const demonstrativeTarget = targetHasReview ? 'cette critique' : 'cette note';

  if (currentUserId === actor.id) {
    return <Text>{`Tu as ${verb} ${genericTarget}`}</Text>;
  }

  if (isAggregate && actors && actorsCount) {
    return (
      <Text>
        {formatActors(actors, actorsCount)}
        <Text>{` ont ${verb} ${ownedTarget}`}</Text>
      </Text>
    );
  }

  if (entryOwnerId === currentUserId) {
    return (
      <Text>
        <ActorLink username={actor.username} />
        <Text>{` a ${verb} ${ownedTarget}`}</Text>
      </Text>
    );
  }

  if (alsoActed) {
    return (
      <Text>
        <ActorLink username={actor.username} />
        <Text>{` a aussi ${verb} ${demonstrativeTarget}`}</Text>
      </Text>
    );
  }

  return (
    <Text>
      <ActorLink username={actor.username} />
      <Text>{` a ${verb} ${genericTarget}`}</Text>
    </Text>
  );
}
