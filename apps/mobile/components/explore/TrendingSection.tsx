import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChartRow } from './ChartRow';
import { type TrendingAlbum } from '../../lib/explore';
import { type TrackWithStats } from '../../lib/trackDiary';
import { h2Style, labelStyle, smStyle } from '../../lib/typography';

type Props = {
  albums: TrendingAlbum[];
  tracks: TrackWithStats[];
};

/** Miroir de TrendingSection (web) — top 5, lien "voir tout" vers /explore/tendances (20). */
export function TrendingSection({ albums, tracks }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'albums' | 'titres'>('albums');

  if (albums.length === 0 && tracks.length === 0) return null;

  return (
    <View>
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 pr-3">
          <Text style={h2Style} className="text-text-primary">
            <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }} className="text-accent-deep">Tendances</Text> de la semaine
          </Text>
          <Text style={smStyle} className="text-text-secondary mt-1">
            Ce que la communauté écoute en ce moment.
          </Text>
        </View>
        <Pressable onPress={() => router.push('/explore/tendances' as any)} className="border-b border-accent pb-0.5">
          <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 14 }}>
            voir tout
          </Text>
        </Pressable>
      </View>

      <View className="flex-row gap-1.5 mb-4">
        {(['albums', 'titres'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} className={`px-3 py-1 rounded-full ${tab === t ? 'bg-text-primary' : 'bg-background-secondary'}`}>
            <Text className={tab === t ? 'text-background' : 'text-text-secondary'} style={labelStyle}>
              {t === 'albums' ? 'Albums' : 'Titres'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'albums' && (
        albums.length > 0 ? (
          <View>
            {albums.slice(0, 5).map((item, index) => (
              <ChartRow key={item.id} href={`/albums/${item.album_id}`} rank={index + 1} cover_url={item.cover_url} title={item.album_title} subtitle={item.artist_name} delta={item.delta} />
            ))}
          </View>
        ) : (
          <Text className="text-text-tertiary" style={smStyle}>Rien pour le moment.</Text>
        )
      )}

      {tab === 'titres' && (
        tracks.length > 0 ? (
          <View>
            {tracks.slice(0, 5).map((track, index) => (
              <ChartRow key={track.track_id} href={`/tracks/${track.track_id}`} rank={index + 1} cover_url={track.cover_url || ''} title={track.track_title} subtitle={track.artist_name} delta={track.delta} />
            ))}
          </View>
        ) : (
          <Text className="text-text-tertiary" style={smStyle}>Rien pour le moment.</Text>
        )
      )}
    </View>
  );
}
