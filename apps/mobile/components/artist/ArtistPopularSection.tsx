import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CoverImage } from '../album/CoverImage';
import { coverSrcWithFallback } from '../../lib/cover';
import { h2Style } from '../../lib/typography';

type PopularAlbum = {
  id: string;
  title: string;
  cover_url: string | null;
  mbid: string | null;
  release_date: string | null;
  avg_rating: number | null;
  listeners_count: number;
};

type Props = { albums: PopularAlbum[] };

/** Miroir de la section "Populaires" de ArtistPageContent (web) — top 3 albums par auditeurs. */
export function ArtistPopularSection({ albums }: Props) {
  const router = useRouter();
  if (albums.length === 0) return null;

  return (
    <View className="mb-12">
      <Text className="text-text-primary mb-6" style={h2Style}>Populaires</Text>
      <View className="gap-2">
        {albums.map((album, idx) => {
          const { src, fallback } = coverSrcWithFallback(album.mbid, album.cover_url);
          const year = album.release_date ? new Date(album.release_date).getFullYear() : null;
          return (
            <Pressable
              key={album.id}
              onPress={() => router.push(`/albums/${album.id}` as any)}
              className="flex-row items-center gap-4 py-2"
            >
              <Text
                className="text-accent w-5 text-right"
                style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 16, lineHeight: 16 }}
              >
                {idx + 1}
              </Text>
              <View className="w-10 h-10 rounded-[6px] overflow-hidden bg-background-secondary">
                {src ? (
                  <CoverImage src={src} fallback={fallback} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full bg-background-secondary" />} />
                ) : (
                  <View className="w-full h-full bg-background-secondary" />
                )}
              </View>
              <View className="flex-1 min-w-0">
                <Text numberOfLines={1} className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 14 }}>
                  {album.title}
                </Text>
                <Text className="text-text-tertiary" style={{ fontFamily: 'Inter_500Medium', fontSize: 12, letterSpacing: 0.72 }}>
                  {[year, album.listeners_count > 0 ? `${album.listeners_count.toLocaleString()} auditeurs` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              {album.avg_rating != null && (
                <View className="flex-row items-baseline gap-0.5 bg-[#FAF8F4] border border-accent rounded-[6px] w-[58px] py-0.5 justify-center">
                  <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 15, lineHeight: 15, paddingRight: 2 }}>
                    {album.avg_rating.toFixed(1).replace('.', ',')}
                  </Text>
                  <Text className="text-accent uppercase opacity-70" style={{ fontFamily: 'Inter_400Regular', fontSize: 9 }}>/10</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
