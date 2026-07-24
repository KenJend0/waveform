import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Check } from 'lucide-react-native';
import { CoverImage } from '../album/CoverImage';
import { GenrePills } from '../album/GenrePills';
import { StreamingLinks } from '../album/StreamingLinks';
import { creditParts, type FeaturedCredit } from '../../lib/creditedArtists';

type Props = {
  track: {
    id: string;
    title: string;
    artist: string;
    artistId: string;
    albumId: string;
    albumTitle: string;
    albumType: string;
    coverSrc: string | null;
    coverFallback?: string;
    year?: number | null;
    featuredArtists?: FeaturedCredit[];
  };
  genres?: string[];
  streamingLinks?: { spotify?: string | null; appleMusic?: string | null; deezer?: string | null };
  onAddToDiary: () => void;
  onAddToList: () => void;
  diaryButtonLabel: string;
  listsContainingCount?: number;
};

/** Miroir pixel du hero de apps/web/app/tracks/[id]/page.tsx — mêmes dimensions/typo qu'AlbumHero (voir ce fichier pour le détail des tokens). */
export function TrackHero({ track, genres, streamingLinks, onAddToDiary, onAddToList, diaryButtonLabel, listsContainingCount = 0 }: Props) {
  const router = useRouter();

  const coverPlaceholder = (
    <View className="w-full h-full items-center justify-center bg-background-secondary">
      <Text className="text-[12px] text-text-tertiary" style={{ fontFamily: 'Inter_400Regular' }}>Pas de couverture</Text>
    </View>
  );

  const parts = track.featuredArtists && track.featuredArtists.length > 0
    ? creditParts({ id: track.artistId, name: track.artist }, track.featuredArtists)
    : [{ prefix: '', artist: { id: track.artistId, name: track.artist } }];

  const isSingle = track.albumType === 'Single';
  const isInAnyList = listsContainingCount > 0;
  const listLabel = listsContainingCount === 0
    ? 'Ajouter à une liste'
    : listsContainingCount === 1
      ? 'Dans 1 liste'
      : `Dans ${listsContainingCount} listes`;

  return (
    <View>
      <View className="w-60 h-60 self-center rounded-cover overflow-hidden bg-background-secondary mb-2">
        {track.coverSrc ? (
          <CoverImage src={track.coverSrc} fallback={track.coverFallback} style={{ width: '100%', height: '100%' }} placeholder={coverPlaceholder} />
        ) : coverPlaceholder}
      </View>

      <Text
        className="text-text-primary mb-2"
        style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 32, lineHeight: 38, letterSpacing: -0.64 }}
      >
        {track.title}
      </Text>

      {/* Ligne 1 — artiste(s) */}
      <Text className="text-text-secondary" style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 }}>
        {parts.map((part, i) => (
          <Text key={part.artist.id || i}>
            {part.prefix}
            <Text onPress={() => router.push(`/artists/${part.artist.id}` as any)} style={{ textDecorationLine: 'underline' }}>
              {part.artist.name}
            </Text>
          </Text>
        ))}
      </Text>

      {/* Ligne 2 — album · année */}
      <Text className="text-text-tertiary mt-0.5" style={{ fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19.5 }}>
        {!isSingle && (
          <Text onPress={() => router.push(`/albums/${track.albumId}` as any)}>{track.albumTitle}</Text>
        )}
        {track.year ? `${!isSingle ? ' · ' : ''}${track.year}` : ''}
      </Text>

      {genres !== undefined && genres.length > 0 && (
        <View className="mt-3">
          <GenrePills genres={genres} />
        </View>
      )}

      <View className="flex-row items-center gap-2 mt-4">
        <Pressable onPress={onAddToDiary} className="bg-accent-deep px-4 py-2.5 rounded-button">
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: '#FAF8F4' }}>{diaryButtonLabel}</Text>
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
