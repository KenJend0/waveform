import { Fragment, type ReactNode } from 'react';
import { Text } from 'react-native';
import type { FeedActor } from '../../lib/feed';
import { ActorLink } from './cards/ActorLink';

/**
 * "X et Y", "X, Y et Z", ou "X, Y et 58 autres" au-delà de 5 acteurs connus.
 * Contrairement au web, "N autres" n'est pas cliquable — pas de fetch de la
 * liste complète côté mobile pour l'instant.
 */
export function formatActors(actors: FeedActor[], totalCount: number): ReactNode {
  const hasAll = totalCount <= actors.length;

  if (hasAll) {
    if (actors.length === 1) return <ActorLink username={actors[0].username} />;
    const allButLast = actors.slice(0, -1);
    const last = actors[actors.length - 1];
    return (
      <Text>
        {allButLast.map((a, i) => (
          <Fragment key={a.id}>
            <ActorLink username={a.username} />
            <Text>{i < allButLast.length - 1 ? ', ' : ' '}</Text>
          </Fragment>
        ))}
        <Text>et </Text>
        <ActorLink username={last.username} />
      </Text>
    );
  }

  const shown = actors.slice(0, 2);
  const othersCount = totalCount - shown.length;
  return (
    <Text>
      {shown.map((a, i) => (
        <Fragment key={a.id}>
          {i > 0 && <Text>, </Text>}
          <ActorLink username={a.username} />
        </Fragment>
      ))}
      <Text>{` et ${othersCount} autres`}</Text>
    </Text>
  );
}
