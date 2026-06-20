import { Heart, MessageCircle, CornerUpLeft, Plus } from 'lucide-react';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';

export type Glyph = 'like' | 'comment' | 'reply' | 'follow';

interface FeedAvatarGlyphProps {
  userId: string;
  avatarUrl?: string | null;
  size?: number;
  glyph?: Glyph;
}

export const GLYPH_STYLE: Record<Glyph, { icon: typeof Heart; className: string; strokeWidth: number }> = {
  like: { icon: Heart, className: 'text-like fill-like', strokeWidth: 0 },
  comment: { icon: MessageCircle, className: 'text-accent', strokeWidth: 2.2 },
  reply: { icon: CornerUpLeft, className: 'text-accent-deep', strokeWidth: 2.4 },
  follow: { icon: Plus, className: 'text-sage', strokeWidth: 2.6 },
};

/**
 * Avatar with a small colored glyph overlaid bottom-right, used on
 * pure-notification feed lines (no musical object) to signal the event
 * type at a glance without reading the sentence.
 */
export function FeedAvatarGlyph({ userId, avatarUrl, size = 32, glyph }: FeedAvatarGlyphProps) {
  if (!glyph) {
    return <UserAvatar userId={userId} src={avatarUrl} size={size} />;
  }

  const { icon: Icon, className, strokeWidth } = GLYPH_STYLE[glyph];
  // Glyph stays a small corner accent — the avatar must read first.
  const glyphSize = Math.round(size * 0.47);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <UserAvatar userId={userId} src={avatarUrl} size={size} />
      <span
        className="absolute rounded-full bg-background border border-border flex items-center justify-center"
        style={{ width: glyphSize, height: glyphSize, right: -4, bottom: -4 }}
      >
        <Icon size={Math.round(glyphSize * 0.6)} className={className} strokeWidth={strokeWidth} />
      </span>
    </div>
  );
}
