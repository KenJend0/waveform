import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Check } from 'lucide-react-native';
import { CoverImage } from './CoverImage';
import { GenrePills } from './GenrePills';
import { StreamingLinks } from './StreamingLinks';
import { creditParts, type FeaturedCredit } from '../../lib/creditedArtists';

type Props = {
  album: {
    id: string;
    title: string;
    artist: string;
    artistId?: string;
    coverSrc: string | null;
    coverFallback?: string;
    year?: number | null;
    featuredArtists?: FeaturedCredit[];
  };
  genres?: string[];
  genreWeights?: Record<string, number>;
  streamingLinks?: { spotify?: string | null; appleMusic?: string | null; deezer?: string | null };
  onAddToDiary: () => void;
  onAddToList: () => void;
  diaryButtonLabel: string;
  /** Nombre de listes de l'utilisateur contenant cet album — pilote le libellé/style du bouton "+ Liste" (miroir de AddToListButton, web). */
  listsContainingCount?: number;
};

/**
 * Miroir pixel de AlbumHero (web, apps/web/components/album/AlbumHero.tsx) — viewport
 * mobile du web (< md), où le hero est en colonne : cover carrée plafonnée à 192px
 * (w-48) centrée, PUIS titre/meta/genres en dessous en pleine largeur (pas de flex-row
 * cover+texte côte à côte, ça n'apparaît qu'à partir du breakpoint md sur le web).
 *
 * Le h1 web hérite du style global `h1 { font-family: Instrument Serif; font-size: 32px;
 * letter-spacing: -0.01em; line-height: 1.1 }` (apps/web/app/globals.css) — les classes
 * Tailwind du composant ne font qu'override size/tracking/leading (32px, -0.02em, 1.2),
 * pas la famille. RN n'a pas d'équivalent "tous les h1" : on applique donc explicitement
 * Instrument Serif ici plutôt que la police système par défaut.
 */
export function AlbumHero({
  album,
  genres,
  genreWeights,
  streamingLinks,
  onAddToDiary,
  onAddToList,
  diaryButtonLabel,
  listsContainingCount = 0,
}: Props) {
  const router = useRouter();

  const coverPlaceholder = (
    <View className="w-full h-full items-center justify-center bg-background-secondary">
      <Text className="text-[12px] text-text-tertiary" style={{ fontFamily: 'Inter_400Regular' }}>Pas de couverture</Text>
    </View>
  );

  const parts = album.featuredArtists && album.featuredArtists.length > 0
    ? creditParts({ id: album.artistId ?? '', name: album.artist }, album.featuredArtists)
    : [{ prefix: '', artist: { id: album.artistId ?? '', name: album.artist } }];

  const isInAnyList = listsContainingCount > 0;
  const listLabel = listsContainingCount === 0
    ? 'Ajouter à une liste'
    : listsContainingCount === 1
      ? 'Dans 1 liste'
      : `Dans ${listsContainingCount} listes`;

  return (
    <View>
      {/* Cover — 240px (au lieu des 192px web) : légèrement plus imposante sur mobile, sur demande explicite. */}
      <View className="w-60 h-60 self-center rounded-cover overflow-hidden bg-background-secondary mb-2">
        {album.coverSrc ? (
          <CoverImage
            src={album.coverSrc}
            fallback={album.coverFallback}
            style={{ width: '100%', height: '100%' }}
            placeholder={coverPlaceholder}
          />
        ) : coverPlaceholder}
      </View>

      {/* Titre — h1 global (Instrument Serif) + overrides du composant (32px, -0.02em, leading 1.2) */}
      <Text
        className="text-text-primary mb-2"
        style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 32, lineHeight: 38, letterSpacing: -0.64 }}
      >
        {album.title}
      </Text>

      {/* Meta — text-meta (14px/1.5) text-secondary */}
      <Text className="text-text-secondary" style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 }}>
        {parts.map((part, i) => (
          <Text key={part.artist.id || i}>
            {part.prefix}
            {part.artist.id ? (
              <Text
                onPress={() => router.push(`/artists/${part.artist.id}` as any)}
                style={{ textDecorationLine: 'underline' }}
              >
                {part.artist.name}
              </Text>
            ) : (
              part.artist.name
            )}
          </Text>
        ))}
        {album.year ? ` · ${album.year}` : ''}
      </Text>

      {genres !== undefined && genres.length > 0 && (
        <View className="mt-3">
          <GenrePills genres={genres} genreWeights={genreWeights} />
        </View>
      )}

      {/* Actions — flex gap-2 mt-4. "+ Liste" = texte simple (pas de bordure), sauf déjà
          dans une liste (accent + bordure) — miroir exact de AddToListButton (web). */}
      <View className="flex-row items-center gap-2 mt-4">
        <Pressable onPress={onAddToDiary} className="bg-accent-deep px-4 py-2.5 rounded-button">
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: '#FAF8F4' }}>
            {diaryButtonLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={onAddToList}
          className={`flex-row items-center gap-2 px-3 py-2.5 rounded-button ${isInAnyList ? 'border border-accent' : ''}`}
        >
          {isInAnyList ? <Check size={14} color="#8E6F5E" /> : <Plus size={14} color="#9A9A9A" />}
          <Text
            numberOfLines={1}
            style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: isInAnyList ? '#8E6F5E' : '#9A9A9A', maxWidth: 140 }}
          >
            {listLabel}
          </Text>
        </Pressable>
      </View>

      {streamingLinks && (
        <View className="mt-5">
          <StreamingLinks links={streamingLinks} showSeparator={false} />
        </View>
      )}
    </View>
  );
}
