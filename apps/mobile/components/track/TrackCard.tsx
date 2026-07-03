import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CoverImage } from '../album/CoverImage';

type Props = {
  track: {
    id: string;
    title: string;
    artistName: string;
    albumTitle?: string | null;
    coverSrc?: string | null;
  };
};

export function TrackCard({ track }: Props) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/tracks/${track.id}`)}
      className="flex-row items-center gap-3.5 py-2.5"
    >
      <View className="w-11 h-11 rounded-input overflow-hidden bg-background-secondary">
        {track.coverSrc ? (
          <CoverImage src={track.coverSrc} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full" />} />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-text-tertiary text-sm">♪</Text>
          </View>
        )}
      </View>
      <View className="flex-1 min-w-0">
        <Text numberOfLines={1} className="text-[14px] text-text-primary" style={{ fontFamily: 'Inter_500Medium' }}>
          {track.title}
        </Text>
        <Text numberOfLines={1} className="text-[12px] text-text-secondary mt-0.5" style={{ fontFamily: 'Inter_400Regular' }}>
          {track.artistName}
          {track.albumTitle ? ` · ${track.albumTitle}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}
