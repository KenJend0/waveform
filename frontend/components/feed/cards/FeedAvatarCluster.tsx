import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { FeedAvatarGlyph, GLYPH_STYLE, type Glyph } from './FeedAvatarGlyph';

interface Actor {
  id: string;
  avatar_url?: string | null;
}

interface FeedAvatarClusterProps {
  isAggregate: unknown;
  actor: Actor;
  actors?: Actor[];
  glyph?: Glyph;
  size?: number;
}

/**
 * Avatar slot shared by every feed line, single or aggregated. Always
 * occupies the same width as a lone avatar so the text column starts at the
 * same x on every row, whether one or several people did the thing.
 */
export function FeedAvatarCluster({ isAggregate, actor, actors, glyph, size = 32 }: FeedAvatarClusterProps) {
  if (!isAggregate) {
    return <FeedAvatarGlyph userId={actor.id} avatarUrl={actor.avatar_url} size={size} glyph={glyph} />;
  }

  const shown = (actors ?? []).slice(0, 2);
  // Front avatar top-left, second one tucked behind bottom-right — leaves the
  // corner clear enough for the glyph badge to read as its own thing.
  const frontSize = Math.round(size * 0.68);
  const backSize = Math.round(size * 0.56);
  const glyphSize = Math.round(size * 0.47);
  const glyphStyle = glyph ? GLYPH_STYLE[glyph] : null;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {shown.map((a, i) => {
        const miniSize = i === 0 ? frontSize : backSize;
        return (
          <div
            key={a.id}
            className="absolute rounded-full ring-2 ring-background"
            style={{
              width: miniSize,
              height: miniSize,
              left: i === 0 ? 0 : size - miniSize,
              top: i === 0 ? 0 : size - miniSize,
              zIndex: shown.length - i,
            }}
          >
            <UserAvatar userId={a.id} src={a.avatar_url} size={miniSize} />
          </div>
        );
      })}
      {glyphStyle && (
        <span
          className="absolute rounded-full bg-background border border-border flex items-center justify-center"
          style={{ width: glyphSize, height: glyphSize, right: -4, bottom: -4, zIndex: 10 }}
        >
          <glyphStyle.icon size={Math.round(glyphSize * 0.6)} className={glyphStyle.className} strokeWidth={glyphStyle.strokeWidth} />
        </span>
      )}
    </div>
  );
}
