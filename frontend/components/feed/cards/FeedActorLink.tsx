import Link from 'next/link';

interface ActorLinkProps {
  username: string;
  /** Use the brighter "self" tone instead of the muted default — rare, only for special targets like a followee. */
  emphasis?: boolean;
}

/**
 * Canonical username link used by every feed sentence — one place to keep
 * the styling and href pattern in sync across all card types.
 */
export function ActorLink({ username, emphasis = false }: ActorLinkProps) {
  return (
    <Link
      href={`/u/${username}`}
      className={
        emphasis
          ? 'hover:text-text-primary transition-colors duration-150'
          : 'text-text-secondary hover:text-text-primary transition-colors duration-150'
      }
    >
      {username}
    </Link>
  );
}
