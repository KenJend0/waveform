import { View } from 'react-native';
import { Heart, MessageCircle, CornerUpLeft, Plus, type LucideIcon } from 'lucide-react-native';
import { Avatar } from '../Avatar';
import type { FeedActor } from '../../lib/feed';

export type Glyph = 'like' | 'comment' | 'reply' | 'follow';

const GLYPH_STYLE: Record<Glyph, { icon: LucideIcon; color: string; fill?: string }> = {
  like: { icon: Heart, color: '#C86C6C', fill: '#C86C6C' },
  comment: { icon: MessageCircle, color: '#8E6F5E' },
  reply: { icon: CornerUpLeft, color: '#5C4538' },
  follow: { icon: Plus, color: '#7A8471' },
};

type Props = {
  actor: FeedActor;
  actors?: FeedActor[];
  isAggregate?: boolean;
  glyph?: Glyph;
  size?: number;
};

/** Avatar seul (avec pastille de type) ou pile de 2 avatars quand l'événement est agrégé. */
export function FeedAvatarCluster({ actor, actors, isAggregate, glyph, size = 32 }: Props) {
  const glyphStyle = glyph ? GLYPH_STYLE[glyph] : null;
  const glyphSize = Math.round(size * 0.47);

  if (!isAggregate) {
    return (
      <View style={{ width: size, height: size }}>
        <Avatar src={actor.avatar_url} size={size} />
        {glyphStyle && <GlyphBadge style={glyphStyle} size={glyphSize} />}
      </View>
    );
  }

  const shown = (actors ?? []).slice(0, 2);
  const frontSize = Math.round(size * 0.68);
  const backSize = Math.round(size * 0.56);
  // Épaisseur du liseré de séparation entre les deux avatars empilés — miroir de
  // `ring-2 ring-background` (web). Contrairement au web, on ne peut pas simplement
  // superposer un ring qui déborde de la boîte : on agrandit donc le conteneur de chaque
  // avatar de `ring` de chaque côté (rempli de la couleur de fond) tout en gardant l'avatar
  // lui-même à sa taille et sa position d'origine, pour ne pas le rogner.
  const ring = 2;

  return (
    <View style={{ width: size, height: size }}>
      {shown.map((a, i) => {
        const miniSize = i === 0 ? frontSize : backSize;
        const baseLeft = i === 0 ? 0 : size - miniSize;
        const baseTop = i === 0 ? 0 : size - miniSize;
        return (
          <View
            key={a.id}
            className="rounded-full items-center justify-center"
            style={{
              position: 'absolute',
              width: miniSize + ring * 2,
              height: miniSize + ring * 2,
              left: baseLeft - ring,
              top: baseTop - ring,
              backgroundColor: '#F5F3EF',
              zIndex: shown.length - i,
            }}
          >
            <View className="rounded-full overflow-hidden" style={{ width: miniSize, height: miniSize }}>
              <Avatar src={a.avatar_url} size={miniSize} />
            </View>
          </View>
        );
      })}
      {glyphStyle && <GlyphBadge style={glyphStyle} size={glyphSize} />}
    </View>
  );
}

function GlyphBadge({ style, size }: { style: { icon: LucideIcon; color: string; fill?: string }; size: number }) {
  const Icon = style.icon;
  return (
    <View
      className="bg-background border border-border rounded-full items-center justify-center"
      style={{ position: 'absolute', width: size, height: size, right: -4, bottom: -4, zIndex: 10 }}
    >
      <Icon size={Math.round(size * 0.6)} color={style.color} fill={style.fill ?? 'transparent'} />
    </View>
  );
}
