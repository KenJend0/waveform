import React from 'react';
import Link from 'next/link';
import type { FeedActor } from '@/app/actions/feed';

/**
 * Renders a list of actors as linked names.
 *
 * If we have data for all actors (totalCount <= actors.length):
 *   2 → "X et Y"
 *   3 → "X, Y et Z"
 *   4 → "X, Y, Z et W"   (all clickable)
 *
 * If totalCount exceeds what we stored (max 5):
 *   → "X, Y et 58 autres"
 *   When onShowAll is provided, "58 autres" becomes a clickable button.
 */
export function formatActors(
  actors: FeedActor[],
  totalCount: number,
  onShowAll?: () => void,
): React.ReactNode {
  const makeLink = (a: FeedActor) => (
    <Link
      key={a.id}
      href={`/u/${a.username}`}
      className="text-text-secondary hover:text-text-primary transition-colors duration-150"
    >
      {a.display_name || a.username}
    </Link>
  );

  const hasAll = totalCount <= actors.length;

  if (hasAll) {
    if (actors.length === 1) return makeLink(actors[0]);
    const allButLast = actors.slice(0, -1);
    const last = actors[actors.length - 1];
    return (
      <>
        {allButLast.map((a, i) => (
          <React.Fragment key={a.id}>
            {makeLink(a)}{i < allButLast.length - 1 ? ', ' : ' '}
          </React.Fragment>
        ))}
        et {makeLink(last)}
      </>
    );
  }

  // More than we have — show first 2 as links, rest as plain count or button
  const shown = actors.slice(0, 2);
  const othersCount = totalCount - shown.length;
  const othersLabel = onShowAll ? (
    <button
      onClick={onShowAll}
      className="underline text-text-tertiary hover:text-text-secondary transition-colors duration-150"
    >
      {othersCount} autres
    </button>
  ) : (
    <>{othersCount} autres</>
  );

  return (
    <>
      {shown.map((a, i) => (
        <React.Fragment key={a.id}>
          {i > 0 ? ', ' : ''}{makeLink(a)}
        </React.Fragment>
      ))}
      {' '}et {othersLabel}
    </>
  );
}
