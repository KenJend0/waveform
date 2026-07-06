import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { CoverImage } from '../album/CoverImage';
import { dismissRecommendation, type DiscoveryAlbum } from '../../lib/explore';
import { labelStyle } from '../../lib/typography';

type Props = {
  album: DiscoveryAlbum;
  onDismiss?: (albumId: string) => void;
  width?: number | `${number}%`;
};

/** Miroir simplifié de DiscoverCard (web) — utilisé par DiscoverySection et Découverte "voir tout". */
export function DiscoverCard({ album, onDismiss, width }: Props) {
  const router = useRouter();

  function handleDismiss() {
    onDismiss?.(album.album_id);
    dismissRecommendation(album.album_id);
  }

  return (
    <Pressable onPress={() => router.push(`/albums/${album.album_id}` as any)} style={width ? { width } : { flex: 1 }}>
      <View className="rounded-cover overflow-hidden bg-background-secondary mb-2 aspect-square">
        {album.cover_url ? (
          <CoverImage src={album.cover_url} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full bg-background-tertiary" />} />
        ) : (
          <View className="w-full h-full bg-background-tertiary" />
        )}
        {onDismiss && (
          <Pressable
            onPress={handleDismiss}
            hitSlop={6}
            className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/45 items-center justify-center"
          >
            <X size={13} color="#F5F3EF" />
          </Pressable>
        )}
      </View>
      {album.via_username && (
        <Text numberOfLines={1} className="text-text-secondary bg-background-secondary self-start px-2 py-0.5 rounded-full mb-1" style={{ fontSize: 11 }}>
          via @{album.via_username}
        </Text>
      )}
      <Text numberOfLines={2} className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 14, lineHeight: 18 }}>
        {album.title}
      </Text>
      <Text numberOfLines={1} className="text-text-tertiary mt-0.5" style={labelStyle}>
        {album.artist}
      </Text>
    </Pressable>
  );
}
