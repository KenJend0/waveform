import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../../components/ui/BackButton';
import { ChartRow } from '../../../components/explore/ChartRow';
import { getTrendingThisWeek, type TrendingAlbum } from '../../../lib/explore';
import { getTrendingTracks, type TrackWithStats } from '../../../lib/trackDiary';
import { labelStyle, smStyle } from '../../../lib/typography';

/** "Voir tout" des tendances — miroir de apps/web/app/explore/tendances/. */
export default function TendancesScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'albums' | 'titres'>('albums');
  const [albums, setAlbums] = useState<TrendingAlbum[]>([]);
  const [tracks, setTracks] = useState<TrackWithStats[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [a, t] = await Promise.all([getTrendingThisWeek(20), getTrendingTracks(20)]);
        setAlbums(a);
        setTracks(t);
      } catch (err) {
        console.error('Tendances fetch failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 100 }}>
      <BackButton label="Explorer" className="mb-4" />
      <Text style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 26 }} className="text-text-primary mb-1">
        Tendances
      </Text>
      <Text className="text-text-secondary mb-5" style={smStyle}>
        Ce que la communauté écoute en ce moment.
      </Text>

      <View className="flex-row gap-1.5 mb-4">
        {(['albums', 'titres'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} className={`px-3 py-1 rounded-full ${tab === t ? 'bg-text-primary' : 'bg-background-secondary'}`}>
            <Text className={tab === t ? 'text-background' : 'text-text-secondary'} style={labelStyle}>
              {t === 'albums' ? 'Albums' : 'Titres'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View className="py-16 items-center">
          <ActivityIndicator color="#8E6F5E" />
        </View>
      ) : tab === 'albums' ? (
        albums.length > 0 ? (
          <View>
            {albums.map((item, index) => (
              <ChartRow key={item.id} href={`/albums/${item.album_id}`} rank={index + 1} cover_url={item.cover_url} title={item.album_title} subtitle={item.artist_name} delta={item.delta} />
            ))}
          </View>
        ) : (
          <Text className="text-text-tertiary" style={smStyle}>Rien pour le moment.</Text>
        )
      ) : tracks.length > 0 ? (
        <View>
          {tracks.map((track, index) => (
            <ChartRow key={track.track_id} href={`/tracks/${track.track_id}`} rank={index + 1} cover_url={track.cover_url || ''} title={track.track_title} subtitle={track.artist_name} delta={track.delta} />
          ))}
        </View>
      ) : (
        <Text className="text-text-tertiary" style={smStyle}>Rien pour le moment.</Text>
      )}
    </ScrollView>
  );
}
